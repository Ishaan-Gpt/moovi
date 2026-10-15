import { createHash } from 'node:crypto';
import { existsSync, readFileSync, rmSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { ensureDir, sh } from '../bench';
import { config } from '../config';
import { checkClip } from './quality';
import { rank } from './rank';
import { activeSources, ADAPTERS, type ClipCandidate, type Fetch, type Provider } from './sources';

/**
 * The clip fetcher: search the free sources (all at once, merged in priority order), rank what came back by how well its own words match
 * the scene, download the best few (only the seconds a scene can use, normalised to H.264 so the live player and the
 * render pool both play it), and judge each one's pixels. Every candidate, kept or rejected, comes back with its
 * source, licence and the reason, so the graph holds the whole search (src/footage/graph.ts writes it).
 */

export interface Clip extends ClipCandidate {
  /** stable id: provider + the source's own ref */
  id: string;
  relevance: number;
  status: 'accepted' | 'rejected';
  why: string[];
  path?: string;
  poster?: string;
  sha?: string;
  query: string;
  /** a slow push-in made from a still photo when no source had moving footage */
  still?: boolean;
}

export interface Timings { search: Partial<Record<Provider, number>>; searchMs?: number; downloads: { provider: Provider; ms: number; ok: boolean }[]; totalMs: number }
export interface FindResult { query: string; asked: Provider[]; found: number; accepted: Clip[]; rejected: Clip[]; timings?: Timings }

const UA = 'Mozilla/5.0 (compatible; Moovi/0.1; +https://github.com/Ishaan-Gpt/moovi)';
export const clipId = (c: { provider: string; ref: string }) => `clip:${c.provider}:${c.ref}`.slice(0, 200);
const safe = (s: string) => s.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').slice(0, 60).toLowerCase();
/** ffmpeg's HTTP input options (a browser-like agent, a read timeout); none for a local file */
const httpIn = (u: string) => (/^https?:\/\//.test(u) ? ['-user_agent', UA, '-rw_timeout', '20000000'] : []);
const sha256 = (f: string) => createHash('sha256').update(readFileSync(f)).digest('hex');

/** Commons serves smaller transcodes beside every original: try the 720p one before a possibly 4K original. */
export function downloadUrls(c: ClipCandidate): string[] {
  if (c.provider !== 'commons') return [c.url];
  const m = c.url.match(/^(https:\/\/upload\.wikimedia\.org\/wikipedia\/commons)\/([0-9a-f])\/([0-9a-f]{2})\/(.+)$/);
  if (!m) return [c.url];
  const [, base, a, ab, name] = m as unknown as [string, string, string, string, string];
  return [`${base}/transcoded/${a}/${ab}/${name}/${name}.720p.vp9.webm`, `${base}/transcoded/${a}/${ab}/${name}/${name}.720p.webm`, c.url];
}

/** Where to start in a source clip: past a long clip's intro titles, never past what is left. */
export function startAt(duration: number | undefined, seconds: number): number {
  if (!duration || duration <= seconds + 2) return 0;
  return +Math.min(duration * 0.15, 30, duration - seconds).toFixed(2);
}

/**
 * Fetch `seconds` of a clip into `out` as H.264 (no audio, ≤1920 px on the long side, ≤30 fps, even sizes,
 * faststart). ffmpeg reads straight from the URL with range requests, so a long original is never downloaded whole.
 */
export async function fetchClip(c: ClipCandidate, out: string, seconds = config.footage.maxSeconds): Promise<string> {
  let last: Error | null = null;
  for (const url of downloadUrls(c)) {
    try {
      const ss = startAt(c.duration, seconds);
      await sh(config.ffmpeg, ['-v', 'error', '-y', ...httpIn(url), ...(ss ? ['-ss', String(ss)] : []), '-i', url, '-t', String(seconds), '-an',
        '-vf', "scale='if(gt(iw,ih),min(1920,iw),-2)':'if(gt(iw,ih),-2,min(1920,ih))',fps='min(30,source_fps)',format=yuv420p,scale=trunc(iw/2)*2:trunc(ih/2)*2",
        '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '22', '-movflags', '+faststart', out], { timeout: 180_000 });
      if (existsSync(out) && statSync(out).size > 2_000) return out;
      last = new Error('the file came back empty');
    } catch (e) { last = e as Error; }
  }
  throw last ?? new Error('no URL worked');
}

/** One frame in the middle, for eyes (a model's or a person's). */
export async function posterOf(file: string, at: number, out: string) {
  await sh(config.ffmpeg, ['-v', 'error', '-y', '-ss', at.toFixed(2), '-i', file, '-frames:v', '1', '-vf', 'scale=640:-2', '-q:v', '4', out], { timeout: 60_000 });
  return out;
}

export interface FindOptions {
  dir: string;
  /** clips to accept before stopping */
  want?: number;
  /** most downloads to try */
  tries?: number;
  seconds?: number;
  sources?: Provider[];
  /** refs already used (by this project or user): skipped before download */
  skip?: (c: ClipCandidate) => boolean | Promise<boolean>;
  fetch?: Fetch;
  log?: (s: string) => void;
  signal?: AbortSignal;
}

/** Search (all sources at once) → rank → download → judge, until `want` clips pass or the tries run out. */
export async function findClips(query: string, o: FindOptions): Promise<FindResult> {
  const want = o.want ?? 2, tries = o.tries ?? 6, seconds = o.seconds ?? config.footage.maxSeconds;
  const t0 = Date.now();
  const sources = o.sources ?? activeSources();
  const timings: Timings = { search: {}, downloads: [], totalMs: 0 };
  // every source is asked at once; results are merged in the configured priority order, so a Mixkit clip still beats
  // an equally relevant Archive one
  const pending = sources.map(async p => {
    const s = Date.now();
    const got = await ADAPTERS[p](query, 8, o.fetch).catch(e => { o.log?.(`${p}: ${(e as Error).message.slice(0, 120)}`); return [] as ClipCandidate[]; });
    timings.search[p] = Date.now() - s;
    return got;
  });
  // walk the answers in priority order; once the sources answered so far give enough relevant clips, stop waiting for
  // the slower ones (they keep running and are simply not used)
  const asked: Provider[] = [], pool: (ClipCandidate & { relevance: number })[] = [];
  let found = 0;
  for (const [i, pr] of pending.entries()) {
    const got = await pr;
    asked.push(sources[i]!);
    found += got.length;
    pool.push(...rank(query, got));
    if (pool.length >= want * 3) break;
  }
  timings.searchMs = Date.now() - t0;
  // keep the sources' priority among equally relevant clips: a stable sort on relevance only
  const ranked = pool.map((c, i) => ({ c, i })).sort((a, b) => b.c.relevance - a.c.relevance || a.i - b.i).map(x => x.c);
  const dir = ensureDir(o.dir);
  const accepted: Clip[] = [], rejected: Clip[] = [];
  let tried = 0;
  for (const c of ranked) {
    if (accepted.length >= want || tried >= tries || o.signal?.aborted) break;
    const base: Clip = { ...c, id: clipId(c), status: 'rejected', why: [], query };
    if (await o.skip?.(c)) { rejected.push({ ...base, why: ['already used'] }); continue; }
    tried++;
    const out = join(dir, `${c.provider}-${safe(c.ref)}.mp4`);
    const d0 = Date.now();
    try {
      await fetchClip(c, out, seconds);
      const v = await checkClip(out);
      timings.downloads.push({ provider: c.provider, ms: Date.now() - d0, ok: v.ok });
      if (!v.ok) { rejected.push({ ...base, why: v.why }); rmSync(out, { force: true }); o.log?.(`✗ ${c.provider} "${c.title}": ${v.why.join(', ')}`); continue; }
      const poster = await posterOf(out, v.duration / 2, out.replace(/\.mp4$/, '.jpg'));
      accepted.push({ ...base, status: 'accepted', path: out, poster, sha: sha256(out), duration: v.duration, width: v.width, height: v.height });
      o.log?.(`✓ ${c.provider} "${c.title}" (${c.relevance})`);
    } catch (e) {
      timings.downloads.push({ provider: c.provider, ms: Date.now() - d0, ok: false });
      rejected.push({ ...base, why: [`download failed: ${(e as Error).message.slice(0, 120)}`] });
      rmSync(out, { force: true });
    }
  }
  timings.totalMs = Date.now() - t0;
  return { query, asked, found, accepted, rejected, timings };
}

/* ───────── last resort: a slow push-in on a still from Commons ───────── */

export async function commonsPhoto(query: string, f: Fetch = fetch): Promise<ClipCandidate | null> {
  const u = new URL('https://commons.wikimedia.org/w/api.php');
  for (const [k, v] of Object.entries({ action: 'query', format: 'json', generator: 'search', gsrnamespace: '6', gsrlimit: '8', gsrsearch: `${query} filetype:bitmap`, prop: 'imageinfo', iiprop: 'url|size|mime|extmetadata', iiurlwidth: '1920', iiextmetadatafilter: 'LicenseShortName|LicenseUrl|Artist|ImageDescription' })) u.searchParams.set(k, v);
  const r = await f(u.toString(), { headers: { 'user-agent': UA }, signal: AbortSignal.timeout(20_000) }).catch(() => null);
  if (!r?.ok) return null;
  const pages = Object.values(((await r.json()) as { query?: { pages?: Record<string, { title: string; index?: number; imageinfo?: { thumburl?: string; url: string; descriptionurl: string; width: number; height: number; extmetadata?: Record<string, { value: string }> }[] }> } }).query?.pages ?? {}).sort((a, b) => (a.index ?? 0) - (b.index ?? 0));
  const ranked = rank(query, pages.map(p => ({ p, title: p.title.replace(/^File:/, '').replace(/\.[a-z]+$/i, '').replace(/[_-]+/g, ' '), tags: [p.imageinfo?.[0]?.extmetadata?.ImageDescription?.value ?? ''] })), 0.34)
    .filter(x => (x.p.imageinfo?.[0]?.width ?? 0) >= 1000);
  const best = ranked[0];
  const ii = best?.p.imageinfo?.[0];
  if (!best || !ii) return null;
  const md = ii.extmetadata ?? {};
  return { provider: 'commons', ref: best.p.title, title: best.title, tags: [], page: ii.descriptionurl, url: ii.thumburl ?? ii.url, width: ii.width, height: ii.height, licence: (md.LicenseShortName?.value ?? 'see source').replace(/<[^>]+>/g, ''), licenceUrl: md.LicenseUrl?.value, author: md.Artist?.value?.replace(/<[^>]+>/g, '').trim().slice(0, 120) };
}

/** A still → `seconds` of slow push-in at the film's size (ffmpeg zoompan, eased, 30 fps). */
export async function stillPush(img: string, out: string, o: { seconds?: number; w?: number; h?: number } = {}) {
  const s = o.seconds ?? 6, w = o.w ?? 1080, h = o.h ?? 1920, n = Math.round(s * 30);
  await sh(config.ffmpeg, ['-v', 'error', '-y', ...httpIn(img), '-i', img,
    '-vf', `scale=${w * 2}:${h * 2}:force_original_aspect_ratio=increase,crop=${w * 2}:${h * 2},zoompan=z='1+0.12*(1-cos(PI*on/${n}))/2':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=${n}:s=${w}x${h}:fps=30,format=yuv420p`,
    '-frames:v', String(n), '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '20', '-movflags', '+faststart', out], { timeout: 180_000 });
  return out;
}

/** findClips, and when nothing moving passed, one still from Commons as a slow push-in (still: true). */
export async function findClipsOrStill(query: string, o: FindOptions & { w?: number; h?: number }): Promise<FindResult> {
  const r = await findClips(query, o);
  if (r.accepted.length) return r;
  const photo = await commonsPhoto(query, o.fetch).catch(() => null);
  if (!photo) return r;
  const out = join(ensureDir(o.dir), `still-${safe(photo.ref)}.mp4`);
  try {
    await stillPush(photo.url, out, { seconds: Math.min(8, o.seconds ?? 8), w: o.w, h: o.h });
    const poster = await posterOf(out, 2, out.replace(/\.mp4$/, '.jpg'));
    r.accepted.push({ ...photo, id: clipId(photo), relevance: 0.34, status: 'accepted', why: [], path: out, poster, sha: sha256(out), duration: Math.min(8, o.seconds ?? 8), width: o.w ?? 1080, height: o.h ?? 1920, query, still: true });
  } catch (e) { o.log?.(`still push-in failed: ${(e as Error).message.slice(0, 120)}`); }
  return r;
}

export { activeSources, type ClipCandidate, type Provider } from './sources';
export { checkClip, judgeFrames } from './quality';
export { rank, relevance } from './rank';
