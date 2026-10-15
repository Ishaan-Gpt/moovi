import { config } from '../config';

/**
 * Free stock footage, one adapter per source. Every candidate keeps where it came from (the source's own page for it),
 * who made it and the licence it is under, so a film can credit it and the graph can answer "what is this clip and
 * may we use it". Order matters: `config.footage.sources` is the priority; every source is asked at once and the
 * answers are merged in that order, so among equally relevant clips the cleaner sources (Mixkit, then Wikimedia
 * Commons) win and NASA or the Internet Archive fill in when the stock sites have nothing on the topic.
 *
 * Mixkit, Commons, NASA and the Archive need no key. Pixabay and Pexels join when PIXABAY_API_KEY / PEXELS_API_KEY
 * are set. Every adapter takes a `fetch` so tests run on recorded answers.
 */

export type Provider = 'mixkit' | 'commons' | 'pixabay' | 'pexels' | 'nasa' | 'archive';
export const PROVIDERS: Provider[] = ['mixkit', 'commons', 'pixabay', 'pexels', 'nasa', 'archive'];

export interface ClipCandidate {
  provider: Provider;
  /** the source's own id for the clip (stable across searches) */
  ref: string;
  title: string;
  tags: string[];
  /** the human page for the clip (what a credit links to) */
  page: string;
  /** a direct video file */
  url: string;
  width?: number;
  height?: number;
  duration?: number;
  licence: string;
  licenceUrl?: string;
  author?: string;
}

export type Fetch = (url: string, init?: RequestInit) => Promise<Response>;
const UA = 'Mozilla/5.0 (compatible; Moovi/0.1; +https://github.com/Ishaan-Gpt/moovi)';
const get = (f: Fetch, url: string, headers: Record<string, string> = {}) => f(url, { headers: { 'user-agent': UA, ...headers }, signal: AbortSignal.timeout(20_000) });
const stripTags = (h: string) => h.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#0?39;/g, "'").replace(/\s+/g, ' ').trim();
const slugWords = (s: string) => s.replace(/-\d+$/, '').replace(/-/g, ' ');

/* ───────── Mixkit (keyless: its own search pages; every clip is under the Mixkit free licence) ───────── */
export async function mixkit(query: string, n = 6, f: Fetch = fetch): Promise<ClipCandidate[]> {
  const toSlug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  // Mixkit's search pages are phrase pages: a long phrase often has none, so the two leading content words are tried next
  const terms = query.toLowerCase().match(/[a-z0-9]+/g)?.filter(w => w.length > 2 && !/^(the|and|for|with|from|into|that|this|over|under|while|about)$/.test(w)) ?? [];
  const tries = [...new Set([toSlug(query), toSlug(terms.slice(0, 2).join(' ')), toSlug(terms[0] ?? '')])].filter(Boolean);
  const out: ClipCandidate[] = [];
  for (const slug of tries) {
    const r = await get(f, `https://mixkit.co/free-stock-video/discover/${slug}/`).catch(() => null);
    if (r?.ok) for (const c of parseMixkit(await r.text())) if (!out.some(x => x.ref === c.ref)) out.push(c);
    if (out.length >= n) break;
  }
  return out.slice(0, n * 2);
}
export function parseMixkit(html: string): ClipCandidate[] {
  const out: ClipCandidate[] = [], seen = new Set<string>();
  for (const m of html.matchAll(/href="\/free-stock-video\/([a-z0-9-]+?)-(\d{3,7})\/"/g)) {
    const [, slug, id] = m as unknown as [string, string, string];
    if (seen.has(id)) continue;
    seen.add(id);
    out.push({
      provider: 'mixkit', ref: id, title: slugWords(slug), tags: [], page: `https://mixkit.co/free-stock-video/${slug}-${id}/`,
      url: `https://assets.mixkit.co/videos/${id}/${id}-720.mp4`, height: 720, licence: 'Mixkit Stock Video Free License', licenceUrl: 'https://mixkit.co/license/#videoFree',
    });
  }
  return out;
}

/* ───────── Wikimedia Commons (keyless: the MediaWiki API, video files only) ───────── */
export async function commons(query: string, n = 6, f: Fetch = fetch): Promise<ClipCandidate[]> {
  const u = new URL('https://commons.wikimedia.org/w/api.php');
  for (const [k, v] of Object.entries({ action: 'query', format: 'json', generator: 'search', gsrnamespace: '6', gsrlimit: String(Math.max(n * 2, 8)), gsrsearch: `${query} filetype:video`, prop: 'imageinfo', iiprop: 'url|size|mime|extmetadata', iiextmetadatafilter: 'LicenseShortName|LicenseUrl|Artist|ImageDescription|Categories' })) u.searchParams.set(k, v);
  const r = await get(f, u.toString());
  if (!r.ok) return [];
  return parseCommons(await r.json()).slice(0, n);
}
type CommonsPage = { title: string; index?: number; imageinfo?: { url: string; descriptionurl: string; width?: number; height?: number; duration?: number; size?: number; mime?: string; extmetadata?: Record<string, { value: string }> }[] };
export function parseCommons(j: unknown): ClipCandidate[] {
  const pages = Object.values(((j as { query?: { pages?: Record<string, CommonsPage> } }).query?.pages) ?? {}).sort((a, b) => (a.index ?? 0) - (b.index ?? 0));
  const out: ClipCandidate[] = [];
  for (const p of pages) {
    const ii = p.imageinfo?.[0];
    if (!ii || !/^video\//.test(ii.mime ?? 'video/')) continue;
    const md = ii.extmetadata ?? {};
    const lic = stripTags(md.LicenseShortName?.value ?? '');
    if (!lic) continue;
    out.push({
      provider: 'commons', ref: p.title, title: p.title.replace(/^File:/, '').replace(/\.[a-z0-9]+$/i, '').replace(/[_-]+/g, ' '),
      tags: [stripTags(md.ImageDescription?.value ?? '').slice(0, 200), ...(md.Categories?.value ?? '').split('|')].filter(Boolean),
      page: ii.descriptionurl, url: ii.url.replace(/\?.*$/, ''), width: ii.width, height: ii.height, duration: ii.duration,
      licence: lic, licenceUrl: md.LicenseUrl?.value, author: stripTags(md.Artist?.value ?? '').slice(0, 120) || undefined,
    });
  }
  return out;
}

/* ───────── Pixabay (PIXABAY_API_KEY; the Pixabay Content License) ───────── */
export async function pixabay(query: string, n = 6, f: Fetch = fetch, key = config.searchKeys.pixabay): Promise<ClipCandidate[]> {
  if (!key) return [];
  const r = await get(f, `https://pixabay.com/api/videos/?key=${encodeURIComponent(key)}&q=${encodeURIComponent(query.slice(0, 100))}&per_page=${Math.max(3, n)}&safesearch=true`);
  if (!r.ok) return [];
  return parsePixabay(await r.json()).slice(0, n);
}
type PixVid = { url: string; width: number; height: number };
export function parsePixabay(j: unknown): ClipCandidate[] {
  const hits = (j as { hits?: { id: number; pageURL: string; tags: string; duration: number; user: string; videos: Record<string, PixVid> }[] }).hits ?? [];
  return hits.flatMap(h => {
    const v = pickRendition(Object.values(h.videos ?? {}).filter(x => x?.url));
    if (!v) return [];
    const title = h.pageURL.replace(/\/$/, '').split('/').pop()!.replace(/-\d+$/, '').replace(/-/g, ' ');
    return [{ provider: 'pixabay' as const, ref: String(h.id), title, tags: h.tags.split(',').map(t => t.trim()), page: h.pageURL, url: v.url, width: v.width, height: v.height, duration: h.duration, licence: 'Pixabay Content License', licenceUrl: 'https://pixabay.com/service/license-summary/', author: h.user }];
  });
}

/* ───────── Pexels (PEXELS_API_KEY; the Pexels License) ───────── */
export async function pexels(query: string, n = 6, f: Fetch = fetch, key = config.searchKeys.pexels): Promise<ClipCandidate[]> {
  if (!key) return [];
  const r = await get(f, `https://api.pexels.com/videos/search?query=${encodeURIComponent(query)}&per_page=${Math.max(3, n)}`, { authorization: key });
  if (!r.ok) return [];
  return parsePexels(await r.json()).slice(0, n);
}
export function parsePexels(j: unknown): ClipCandidate[] {
  const vids = (j as { videos?: { id: number; url: string; duration: number; user?: { name: string }; video_files: { link: string; width: number; height: number; file_type: string }[] }[] }).videos ?? [];
  return vids.flatMap(v => {
    const file = pickRendition(v.video_files.filter(x => x.file_type === 'video/mp4').map(x => ({ url: x.link, width: x.width, height: x.height })));
    if (!file) return [];
    const title = v.url.replace(/\/$/, '').split('/').pop()!.replace(/-\d+$/, '').replace(/-/g, ' ');
    return [{ provider: 'pexels' as const, ref: String(v.id), title, tags: [], page: v.url, url: file.url, width: file.width, height: file.height, duration: v.duration, licence: 'Pexels License', licenceUrl: 'https://www.pexels.com/license/', author: v.user?.name }];
  });
}

/* ───────── NASA Image and Video Library (keyless; NASA media is generally not copyrighted) ───────── */
export async function nasa(query: string, n = 6, f: Fetch = fetch): Promise<ClipCandidate[]> {
  const r = await get(f, `https://images-api.nasa.gov/search?media_type=video&q=${encodeURIComponent(query)}`);
  if (!r.ok) return [];
  const items = parseNasa(await r.json()).slice(0, n);
  // the file list is one more call per item (its asset manifest): the medium mp4 is 720p-ish and small
  const out: ClipCandidate[] = [];
  for (const it of items) {
    const m = await get(f, `https://images-api.nasa.gov/asset/${encodeURIComponent(it.ref)}`).catch(() => null);
    if (!m?.ok) continue;
    const files = ((await m.json()) as { collection?: { items?: { href: string }[] } }).collection?.items?.map(x => x.href) ?? [];
    const pick = ['~medium.mp4', '~large.mp4', '~mobile.mp4', '~orig.mp4'].map(s => files.find(h => h.endsWith(s))).find(Boolean);
    if (pick) out.push({ ...it, url: pick.replace(/^http:/, 'https:') });
  }
  return out;
}
export function parseNasa(j: unknown): ClipCandidate[] {
  const items = (j as { collection?: { items?: { data?: { nasa_id: string; title: string; keywords?: string[]; description?: string; center?: string; photographer?: string }[] }[] } }).collection?.items ?? [];
  return items.flatMap(i => {
    const d = i.data?.[0];
    if (!d) return [];
    return [{ provider: 'nasa' as const, ref: d.nasa_id, title: d.title, tags: [...(d.keywords ?? []), (d.description ?? '').slice(0, 200)], page: `https://images.nasa.gov/details/${encodeURIComponent(d.nasa_id)}`, url: '', licence: 'NASA media (not copyrighted; NASA media usage guidelines)', licenceUrl: 'https://www.nasa.gov/nasa-brand-center/images-and-media/', author: d.photographer ?? (d.center ? `NASA ${d.center}` : 'NASA') }];
  });
}

/* ───────── Internet Archive (keyless; only items whose licence allows edits: public domain, CC0, CC BY, CC BY-SA) ───────── */
export const editableLicence = (url: string) => /publicdomain|\/zero\/|\/licenses\/by(-sa)?\//i.test(url) && !/-nc|-nd/i.test(url);
export async function archive(query: string, n = 6, f: Fetch = fetch): Promise<ClipCandidate[]> {
  const q = `(${query.replace(/[()"]/g, ' ')}) AND mediatype:movies AND licenseurl:*`;
  const r = await get(f, `https://archive.org/advancedsearch.php?q=${encodeURIComponent(q)}&fl[]=identifier&fl[]=title&fl[]=licenseurl&fl[]=subject&fl[]=creator&rows=${n * 3}&output=json`);
  if (!r.ok) return [];
  const docs = parseArchive(await r.json()).slice(0, n);
  const out: ClipCandidate[] = [];
  for (const d of docs) {
    const m = await get(f, `https://archive.org/metadata/${encodeURIComponent(d.ref)}`).catch(() => null);
    if (!m?.ok) continue;
    const files = ((await m.json()) as { files?: { name: string; format?: string; size?: string; length?: string; width?: string; height?: string }[] }).files ?? [];
    const v = files.filter(x => /\.mp4$/i.test(x.name) && Number(x.size ?? 0) < 400e6).sort((a, b) => Number(b.width ?? 0) - Number(a.width ?? 0))[0];
    if (v) out.push({ ...d, url: `https://archive.org/download/${encodeURIComponent(d.ref)}/${encodeURIComponent(v.name)}`, width: Number(v.width) || undefined, height: Number(v.height) || undefined, duration: Number(v.length) || undefined });
  }
  return out;
}
export function parseArchive(j: unknown): ClipCandidate[] {
  const docs = (j as { response?: { docs?: { identifier: string; title?: string; licenseurl?: string; subject?: string | string[]; creator?: string | string[] }[] } }).response?.docs ?? [];
  return docs.filter(d => d.licenseurl && editableLicence(d.licenseurl)).map(d => ({
    provider: 'archive' as const, ref: d.identifier, title: d.title ?? d.identifier, tags: ([] as string[]).concat(d.subject ?? []),
    page: `https://archive.org/details/${d.identifier}`, url: '', licence: licenceName(d.licenseurl!), licenceUrl: d.licenseurl,
    author: ([] as string[]).concat(d.creator ?? [])[0],
  }));
}
export function licenceName(url: string): string {
  if (/publicdomain\/mark/i.test(url)) return 'Public Domain Mark';
  if (/publicdomain\/zero/i.test(url)) return 'CC0';
  const m = url.match(/licenses\/([a-z-]+)\/([\d.]+)/i);
  return m ? `CC ${m[1]!.toUpperCase()} ${m[2]}` : url;
}

/** The rendition closest to 720p on its short side (big enough for a phone, small enough to fetch fast). */
export function pickRendition<T extends { width: number; height: number }>(rs: T[]): T | null {
  const ok = rs.filter(r => r.width > 0 && r.height > 0);
  if (!ok.length) return null;
  const short = (r: T) => Math.min(r.width, r.height);
  return [...ok].sort((a, b) => Math.abs(short(a) - 720) + (short(a) < 480 ? 1000 : 0) - (Math.abs(short(b) - 720) + (short(b) < 480 ? 1000 : 0)))[0]!;
}

export const ADAPTERS: Record<Provider, (q: string, n: number, f?: Fetch) => Promise<ClipCandidate[]>> = { mixkit, commons, pixabay: (q, n, f) => pixabay(q, n, f), pexels: (q, n, f) => pexels(q, n, f), nasa, archive };

/** The sources asked, in order: the configured list, minus keyed ones without a key. */
export function activeSources(list: string[] = config.footage.sources, keys: { pixabay?: string; pexels?: string } = config.searchKeys): Provider[] {
  return list.filter((s): s is Provider => (PROVIDERS as string[]).includes(s)).filter(s => (s === 'pixabay' ? !!keys.pixabay : s === 'pexels' ? !!keys.pexels : true));
}
