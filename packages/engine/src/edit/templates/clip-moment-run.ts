import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { sh } from '../../bench';
import { config } from '../../config';
import { speakLines } from '../../audio/lines';
import { bedStem, castStem, sfxStem, type Ev } from '../../audio/mix';
import { checkClip, clipId, fetchClip, rank, type Clip, type ClipCandidate } from '../../footage';
import { clipAssetId } from '../../footage/graph';
import { mixkit } from '../../footage/sources';
import { validateEdl } from '../edl';
import { clipMomentEdl, cmLines, plateSpans, spoken, CM_PALETTE, CM_TAIL, CM_TRANSITIONS, type CmEdl, type CmScript, type CmTheme, type TimedWord } from './clip-moment';
import { cmPlan, cmTopic, mixkitLicence, CM_CAMERAS } from './clip-moment-plan';
import { gradeClips, spreadOf, CM_FINISH_CHAIN, CM_GRADE, CM_GRADE_IDS, CM_LOOK_CHAIN, type ClipGrade } from './clip-moment-grade';

/**
 * Clip Moment's topic path, end to end and fast: plan the lines by content → voice → one licence-checked Mixkit clip
 * per beat (all beats searched and fetched at once) → a 9:16 plate with the mixed audio on it → the EDL the edit
 * player plays live. Clips, their licence verdicts and the sfx come from (and go back to) the craft graph when it is
 * up; the run never waits on it (a down graph falls back to the file cache and the kit's sfx table, and says so).
 */

export interface CmRunInput {
  dir: string;
  /** plain script lines (planned by content), or a script already planned */
  lines?: string[];
  script?: CmScript;
  /** the user's brand (the pill and the end card); none = no pill */
  brand?: string;
  theme?: CmTheme;
  /** an Edge/ElevenLabs voice id; default rotates Brian, Ava and Laura by the script's length */
  voice?: string;
  rate?: string;
  look?: number | string;
  /** output size of the plate and the player (the capture can scale) */
  w?: number; h?: number;
  log?: (s: string) => void;
  /** tests and benches: no graph reads or writes */
  noGraph?: boolean;
  signal?: AbortSignal;
}

export interface CmClipPick { beat: number; query: string; id: string; ref: string; title: string; page: string; licence: string; file: string; score?: number; why?: string }
export interface CmTraceBeat { beat: number; line: string; queries: string[]; candidates: number; checked: { ref: string; title: string; score: number; verdict: string; tags?: string[] }[]; picked: { ref: string; title: string; query: string; score: number; verdict: string }[]; graphic?: string; components?: string[]; library?: string[] }
export interface CmRunResult { edl: CmEdl; dir: string; timings: Record<string, number>; clips: CmClipPick[]; rejected: { ref: string; why: string; beat?: number }[]; why: string[]; graph: string }

export const CM_VOICES = ['en-US-BrianMultilingualNeural', 'en-US-AvaMultilingualNeural', 'en-US-EmmaMultilingualNeural'];
const UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36';
const r3 = (x: number) => Math.round(x * 1000) / 1000;

/* ── the licence gate: only "Mixkit Stock Video Free License" clips; unknown = rejected; verdict cached per clip id ── */
const verdictFile = () => join(config.data, 'cache', 'mixkit-licence.json');
const readVerdicts = (): Record<string, { v: 'free' | 'restricted' | 'unknown'; at: string; tags?: string[] }> => { try { return JSON.parse(readFileSync(verdictFile(), 'utf8')); } catch { return {}; } };

/**
 * Every Mixkit page request (searches and licence pages) goes through one pace: at most 2 at once, CM_MIXKIT_GAP ms
 * apart. Mixkit sits behind Cloudflare and answers a busy client with 429 or a "Just a moment" challenge; the first one
 * opens a breaker for CM_MIXKIT_COOL s. While it is open the run backs off and decides from cached verdicts; a clip with
 * no cached verdict stays unknown, which the gate rejects (the line takes its next clip or a graphic scene). A reader
 * mirror is OFF by default (Claude 1, 2026-10-16: honour Mixkit's rate limit, do not route around it); setting
 * MOOVI_MIXKIT_MIRROR to a reader URL (for example https://r.jina.ai/) turns it back on for local experiments only.
 */
export const CM_MIXKIT_GAP = 350;
/** the gate's clocks: an unknown verdict is not asked again for this long; a run's footage search stops starting new searches and checks after fetchBudgetMs */
export const CM_GATE = { unknownRetryMs: 120_000, fetchBudgetMs: 13_000 };
export const CM_MIXKIT_COOL = 90;
const MIRROR = (() => { const m = process.env.MOOVI_MIXKIT_MIRROR?.trim(); return m && m !== '0' ? m : ''; })();
let mxOpenUntil = 0, mxLast = 0, mxTrips = 0, mxMirrored = 0;
const mxGate = limiter(2), mirrorGate = limiter(6);
const walled = (status: number, body: string) => status === 429 || status === 403 || status === 503 || /<title>Just a moment/i.test(body);
async function viaMirror(url: string, init?: RequestInit): Promise<Response> {
  if (!MIRROR) return new Response('', { status: 429, statusText: 'mixkit walled, no mirror' });
  return mirrorGate(async () => {
    for (let a = 0; a < 2; a++) {
      try {
        const r = await fetch(MIRROR + url, { headers: { 'x-return-format': 'html' }, signal: AbortSignal.timeout(20_000) });
        const body = await r.text();
        if (r.ok && !walled(r.status, body)) { mxMirrored++; return new Response(body, { status: 200 }); }
      } catch { /* once more */ }
      await new Promise(res => setTimeout(res, 1200));
    }
    return new Response('', { status: 429, statusText: 'mirror walled' });
  });
}
export const mixkitFetch = async (url: string, init?: RequestInit): Promise<Response> => {
  if (Date.now() < mxOpenUntil) return viaMirror(url, init);
  const direct = await mxGate(async () => {
    const wait = mxLast + CM_MIXKIT_GAP - Date.now();
    if (wait > 0) await new Promise(r => setTimeout(r, wait));
    mxLast = Date.now();
    try { const r = await fetch(url, init); return { status: r.status, body: await r.text() }; } catch { return { status: 0, body: '' }; }
  });
  if (direct.status === 200 && !walled(200, direct.body)) return new Response(direct.body, { status: 200 });
  if (direct.status === 404) return new Response('', { status: 404 });
  if (walled(direct.status, direct.body)) { mxOpenUntil = Date.now() + CM_MIXKIT_COOL * 1000; mxTrips++; }
  return viaMirror(url, init);
};
/** the breaker's state, for the trace */
export const mixkitBreaker = () => ({ open: Date.now() < mxOpenUntil, trips: mxTrips, mirrored: mxMirrored });
/** tests only */
export const _resetMixkitBreaker = (openFor = 0) => { mxOpenUntil = openFor ? Date.now() + openFor : 0; mxTrips = 0; mxLast = 0; mxMirrored = 0; };

let verdicts: ReturnType<typeof readVerdicts> | null = null;
/** a Mixkit clip page's "Item Tags" (its own words for what the clip shows) */
export function mixkitTags(html: string): string[] {
  const i = html.indexOf('Item Tags');
  if (i < 0) return [];
  return [...new Set([...html.slice(i, i + 6000).matchAll(/href="\/free-stock-video\/([a-z0-9-]+)\/"/g)].map(m => m[1]!.replace(/-/g, ' ')))].slice(0, 20);
}
/** the tags a licence check saw for a clip (cached with its verdict) */
export const tagsOf = (ref: string): string[] => (verdicts ??= readVerdicts())[ref]?.tags ?? [];
/** a clip's tags that the line or its searches say: +1 each, at most +3 */
export function tagBonus(tags: string[], line: string, ladder: string[]): number {
  const words = new Set([...line.toLowerCase().split(/[^a-z0-9]+/), ...ladder.flatMap(q => q.toLowerCase().split(/[^a-z0-9]+/))].filter(w => w.length > 2 && !STOPW.has(w)).map(stem));
  return Math.min(3, tags.filter(t => t.split(' ').every(w => words.has(stem(w)))).length);
}

export async function licenceOf(c: Pick<ClipCandidate, 'ref' | 'page'>, g?: GraphIo): Promise<'free' | 'restricted' | 'unknown'> {
  verdicts ??= readVerdicts();
  const hit = verdicts[c.ref];
  if (hit && hit.v !== 'unknown') return hit.v;
  // an unknown (a rate limit, a challenge page) is asked again, but not inside CM_GATE.unknownRetryMs: one run that meets
  // the same clip in three beats asks Mixkit once
  if (hit && Date.now() - Date.parse(hit.at) < CM_GATE.unknownRetryMs) return 'unknown';
  const fromGraph = await g?.licence(c.ref).catch(() => null);
  if (fromGraph) { verdicts[c.ref] = { v: fromGraph, at: new Date().toISOString() }; return fromGraph; }
  let v: 'free' | 'restricted' | 'unknown' = 'unknown', tags: string[] = [];
  try {
    const r = await mixkitFetch(c.page, { headers: { 'user-agent': UA, accept: 'text/html' }, signal: AbortSignal.timeout(12_000) });
    const html = r.ok ? await r.text() : '';
    v = html ? mixkitLicence(html) : 'unknown';
    tags = mixkitTags(html);
  } catch { v = 'unknown'; }
  verdicts[c.ref] = { v, at: new Date().toISOString(), ...(tags.length ? { tags } : {}) };
  mkdirSync(join(config.data, 'cache'), { recursive: true });
  writeFileSync(verdictFile(), JSON.stringify(verdicts));
  return v;
}


/* ── the footage picker's numbers and its ranking (pure, tested) ── */
/** candidates per search (Mixkit's search page lists about 24 on its first page; a phrase with few falls back to its words) */
export const CM_PER_QUERY = 24;
/** searches run at once per rung of a beat's ladder */
export const CM_RUNG = 4;
/** a candidate must share at least one strong word with the line or its search */
export const CM_MIN_SCORE = 2;
/** seconds fetched per clip (preview quality, 720p): a beat's part is under 4 s */
export const CM_SECONDS = 6;
/** licence pages checked at once per beat */
export const CM_CHECK_BATCH = 6;
/** candidates licence-checked per rung at most (best first) */
export const CM_CHECK_MAX = 12;
const stem = (w: string) => w.toLowerCase().replace(/[^a-z0-9]/g, '').replace(/ies$/, 'y').replace(/(ss|sh|ch|x|z)es$/, '$1').replace(/([^s])s$/, '$1');
const STOPW = new Set('a an the of and or in on at to with for from by its it is are this that over into its his her their at under while'.split(' '));
const OFF = new Set(['woman', 'women', 'man', 'men', 'girl', 'boy', 'couple', 'dancing', 'dance', 'party', 'kiss', 'fashion', 'model', 'models', 'posing', 'portrait', 'selfie', 'wedding', 'yoga', 'smiling', 'happy', 'young', 'hipster', 'friends', 'laughing']);
/** shot words that say how, not what (never count against a clip) */
const NEUTRAL = new Set('close up closeup view shot slow motion detail detailed aerial top above below night day time lapse timelapse background side front back inside outside interior exterior small big large old new during through along around next near seen'.split(' '));
const MOTION = new Set(['driving', 'moving', 'spinning', 'turning', 'working', 'running', 'rotating', 'closeup', 'close', 'detail', 'opening', 'closing', 'traffic']);
/**
 * How well a clip's own words (its Mixkit title) fit a line: a word the line says scores 3, a word of the search that
 * found it 2, the topic 1; motion and close-up words add a little; people and party words the line does not say
 * subtract (a "woman dancing on a bus" is not a bus engine). Below CM_MIN_SCORE the clip is never used.
 */
export function clipScore(title: string, line: string, query: string, topic?: string, ladder?: string[], o: { tags?: string[]; found?: string } = {}): number {
  const tw = title.toLowerCase().split(/[^a-z0-9]+/).filter(w => w && !STOPW.has(w)), lineW = new Set(line.toLowerCase().split(/[^a-z0-9]+/).filter(w => w.length > 2 && !STOPW.has(w)).map(stem));
  const qW = new Set(query.toLowerCase().split(/[^a-z0-9]+/).filter(w => w.length > 2).map(stem)), topW = new Set((topic ?? '').toLowerCase().split(/\s+/).filter(Boolean).map(stem));
  const vocab = new Set((ladder ?? []).flatMap(q => q.toLowerCase().split(/[^a-z0-9]+/)).filter(w => w.length > 2).map(stem));
  let s = 0; const seen = new Set<string>();
  for (const w of tw) {
    const st = stem(w); if (seen.has(st)) continue; seen.add(st);
    if (lineW.has(st)) s += 3; else if (qW.has(st)) s += 2; else if (topW.has(st)) s += 1; else if (vocab.has(st)) s += 0.5;
    if (MOTION.has(w)) s += 0.5;
    if (OFF.has(w) && !lineW.has(st)) s -= 2;
    // a word the line, its searches and the topic never say is a sign the clip shows something else ("hot air balloon"
    // only shares "air" with an air brake line; "pottery wheel" only "wheel" with a gearbox)
    else if (ladder && !lineW.has(st) && !qW.has(st) && !topW.has(st) && !vocab.has(st) && !NEUTRAL.has(w) && w.length > 2) s -= 0.75;
  }
  // the search page that listed it is evidence too (Mixkit lists a clip under its tags, not only its title words)
  const f = o.found ? stem(o.found) : '';
  if (f && !seen.has(f) && (lineW.has(f) || topW.has(f))) s += 2;
  // its own tags: each one the line or its searches say, +1 (at most +3)
  if (o.tags?.length) s += tagBonus(o.tags, line, ladder ?? [query]);
  // a line that names the subject wants the subject on screen ("a city bus" over night traffic with no bus in it)
  const subj = [...topW].filter(t => lineW.has(t));
  if (subj.length && !subj.some(t => seen.has(t) || t === f || (o.tags ?? []).some(x => x.split(' ').map(stem).includes(t)))) s -= 6;
  return Math.round(s * 10) / 10;
}
/** the graph needs a line's footage serves (`footage:<word>`), for clips the library already keeps (assetsServing) */
export const footageNeeds = (line: string, ladder: string[]) => [...new Set([...ladder.flatMap(q => q.split(/\s+/)), ...line.toLowerCase().split(/[^a-z]+/).filter(w => w.length > 3 && !STOPW.has(w))].map(w => `footage:${w.toLowerCase()}`))];
/** at most n promises at once */
export function limiter(n: number) {
  let on = 0; const q: (() => void)[] = [];
  return async <T>(f: () => Promise<T>): Promise<T> => {
    if (on >= n) await new Promise<void>(r => q.push(r));
    on++;
    try { return await f(); } finally { on--; q.shift()?.(); }
  };
}

/* ── the craft graph: clips it already keeps in (assetsServing), 3D cast from its camera and 3d assets, chosen clips (with their licence) out as Asset nodes ── */
const OBJ_NEEDS: Record<string, string[]> = { tower: ['number', 'data', 'growth'], cubes: ['build', 'data', 'layers'], gyro: ['process', 'cycle'], knot: ['process', 'connect'], coin: ['money', 'payoff'], dotglobe: ['global', 'network', 'location'], network: ['network', 'connect'] };
interface GraphIo { licence(ref: string): Promise<'free' | 'restricted' | null>; serving(needs: string[]): Promise<ClipCandidate[]>; cast3d(s: CmScript): Promise<{ script: CmScript; notes: string[] }>; keep(rows: { ref: string; title: string; page: string; url: string; query: string; licence: 'free' | 'restricted' }[]): Promise<number> }
async function graphIo(log: (s: string) => void): Promise<GraphIo | null> {
  try {
    const g = await import('@moovi/graph');
    const h = await Promise.race([g.health(), new Promise<{ ok: false }>(res => setTimeout(() => res({ ok: false }), 1500))]);
    if (!h.ok) { log('graph: down, using the file cache and the kit sfx table'); return null; }
    const LIC = { free: 'Mixkit Stock Video Free License', restricted: 'Mixkit Restricted License' };
    return {
      async licence(ref) {
        // the verdict this gate read off the clip's own page (params.mixkit_licence); a bare 'mixkit' code from another
        // path is not a checked verdict, a 'mixkit-restricted' code always is
        const rows = await g.read<{ licence: string | null; params: string | null }>(g.CRAFT, 'cmLicence', 'MATCH (a:Asset {id: $id}) RETURN a.licence AS licence, a.params AS params', { id: clipAssetId({ provider: 'mixkit', ref }) });
        const r = rows[0]; if (!r) return null;
        const v = (() => { try { return (JSON.parse(r.params ?? '{}') as { mixkit_licence?: string }).mixkit_licence; } catch { return undefined; } })();
        return v === 'free' || v === 'restricted' ? v : r.licence === 'mixkit-restricted' ? 'restricted' : null;
      },
      // clips the library already keeps (licence-clean, shippable) that serve this line's footage needs
      async serving(needs) {
        const rows = await g.run<{ id: string; name: string; params: string | null; impl: string | null }>(g.CRAFT, g.library.assetsServing, { needs, category: 'insert', runtime: 'edit-player', shipOnly: true, n: 12 });
        return rows.flatMap(r => {
          const p = (() => { try { return JSON.parse(r.params ?? '{}') as { page?: string; url?: string; mixkit_licence?: string }; } catch { return {}; } })(), im = (() => { try { return JSON.parse(r.impl ?? '{}') as { mixkit?: string }; } catch { return {}; } })();
          return im.mixkit && p.page && p.url && p.mixkit_licence === 'free' ? [{ provider: 'mixkit' as const, ref: im.mixkit, title: r.name, tags: [], page: p.page, url: p.url, height: 720, licence: LIC.free, licenceUrl: 'https://mixkit.co/license/#videoFree' }] : [];
        });
      },
      // the 3D the library serves: camera moves (camera layer / visual runtime) for shots and entrances, 3d objects by need
      async cast3d(s) {
        const notes: string[] = [];
        const cams = new Set((await g.read<{ id: string }>(g.CRAFT, 'cmCameras', "MATCH (a:Asset {category: 'camera'}) WHERE 'visual' IN a.runtime OR 'camera-layer' IN a.runtime RETURN a.id AS id")).map(r => r.id));
        const okCam = (id: string) => cams.has(id) ? id : cams.has('camera:push-in') ? 'camera:push-in' : null;
        const used = new Set<string>();
        const beats = await Promise.all(s.beats.map(async (b, k) => {
          const camera = (b.camera ?? CM_CAMERAS.slice(k % CM_CAMERAS.length, k % CM_CAMERAS.length + 1)).flatMap(c => { const v = okCam(c); return v ? [v] : []; });
          const enter = b.enter ? okCam(b.enter) ?? undefined : undefined;
          const obj = async (sh?: CmScript['beats'][number]['show']) => {
            if (sh?.kind !== 'obj3d') return sh;
            const needs = OBJ_NEEDS[sh.obj.replace('3d:obj-', '')] ?? ['process'];
            const rows = await g.run<{ id: string; runtime: string[] }>(g.CRAFT, g.library.assetsServing, { needs, category: '3d', runtime: 'visual', shipOnly: true, n: 6 });
            const ids = rows.map(r => r.id).filter(id => id.startsWith('3d:obj-'));
            const pick = ids.includes(sh.obj) && !used.has(sh.obj) ? sh.obj : ids.find(id => !used.has(id)) ?? sh.obj;
            used.add(pick); notes.push(`beat ${k + 1}: ${pick} via assetsServing(${needs.join(', ')})`);
            return { ...sh, obj: pick };
          };
          notes.push(`beat ${k + 1}: shots ${camera.join(', ') || 'push-punch'}${enter ? `, entrance ${enter}` : ''} (camera layer)`);
          return { ...b, camera, ...(enter ? { enter } : {}), show: await obj(b.show), show2: await obj(b.show2) };
        }));
        return { script: { ...s, beats: beats.map(b => { const { show2, ...rest } = b; return show2 ? { ...rest, show2 } : rest; }) }, notes };
      },
      async keep(rows) {
        // one seed per clip: a later run never retires an earlier run's clips
        const seeds = rows.map(r => ({
          seed: `clip-moment:mixkit:${r.ref}`,
          rows: [{
            id: clipAssetId({ provider: 'mixkit', ref: r.ref }), category: 'insert' as const, name: r.title, about: `Mixkit clip "${r.title}", found for "${r.query}"`,
            runtime: ['edit-player'], licence: LIC[r.licence], licenceUrl: r.licence === 'free' ? 'https://mixkit.co/license/#videoFree' : 'https://mixkit.co/license/#videoRestricted', sourceUrl: r.page, credit: 'Mixkit', ship: r.licence === 'free', attribution: false, file: null, vendored: false,
            energy: null, tags: ['footage', 'mixkit', ...r.query.split(/\s+/)], impl: { mixkit: r.ref }, params: { page: r.page, url: r.url, mixkit_licence: r.licence, licence_checked_at: new Date().toISOString() },
            src: 'packages/engine/src/edit/templates/clip-moment-run.ts', needs: r.query.split(/\s+/).map(w => `footage:${w}`), styles: ['clip-moment'],
          }],
        }));
        let n = 0; for (const s of seeds) { await g.seedLibrary([s]); n++; }
        return n;
      },
    };
  } catch (e) { log(`graph: ${(e as Error).message.slice(0, 120)}`); return null; }
}

/** Run promises at most `n` at a time, in order. */
async function pool<T, R>(xs: T[], n: number, f: (x: T, i: number) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(xs.length); let k = 0;
  await Promise.all(Array.from({ length: Math.min(n, xs.length) }, async () => { while (k < xs.length) { const i = k++; out[i] = await f(xs[i]!, i); } }));
  return out;
}

export async function makeClipMoment(i: CmRunInput): Promise<CmRunResult> {
  const log = i.log ?? (() => {}), T: Record<string, number> = {}, dir = i.dir, W = i.w ?? 720, H = i.h ?? 1280;
  mkdirSync(dir, { recursive: true });
  let t = Date.now();
  const lap = (k: string) => { T[k] = r3((Date.now() - t) / 1000); t = Date.now(); };
  const g = i.noGraph ? null : await graphIo(log);
  lap('graph');

  // 1. plan by content
  let why: string[] = [];
  let script = i.script;
  const brand = i.brand?.trim();
  if (!script) { const p = cmPlan(i.lines ?? [], { ...(brand ? { brand } : {}), ...(i.theme ? { theme: i.theme } : {}) }); script = p.script; why = p.why; }
  { const { brand: _b, ...rest } = script; script = { ...rest, ...(brand ? { brand } : {}), ...(i.theme ? { theme: i.theme } : {}) }; }
  const lines = cmLines(script);
  writeFileSync(join(dir, 'script.json'), JSON.stringify(script, null, 1));
  lap('plan');

  // 2. voice (and, at the same time, every beat's footage: the searches do not depend on the voice)
  const voice = i.voice ?? CM_VOICES[lines.join(' ').length % CM_VOICES.length]!;
  const topic = cmTopic(script.beats.map(b => b.say));
  const used = new Set<string>(), rejected: { ref: string; why: string; beat?: number }[] = [];
  const cache = join(config.data, 'cache', 'clips-cm');
  // searches are cached per query (Mixkit's search pages rate-limit after ~20); a hit costs nothing
  const searchCache = join(config.data, 'cache', 'mixkit-search.json');
  let searches: Record<string, ClipCandidate[]> = {};
  try { searches = JSON.parse(readFileSync(searchCache, 'utf8')); } catch { searches = {}; }
  const search = async (q: string) => {
    if (searches[q]?.length) return searches[q]!;
    const got = await mixkit(q, CM_PER_QUERY, mixkitFetch).catch(() => [] as ClipCandidate[]);
    if (got.length) searches[q] = got;
    return got;
  };
  const gate = limiter(6);
  const trace: CmTraceBeat[] = script.beats.map((b, k) => ({ beat: k + 1, line: spoken(b.say), queries: [], candidates: 0, checked: [], picked: [] }));
  /**
   * One beat's footage: its ladder's first rungs searched at once (20+ candidates each), plus the clips the graph already
   * keeps for these words (assetsServing), ranked by how well their words match the line, licence-checked in parallel
   * (only the Mixkit Stock Video Free License passes; Restricted or unknown = rejected), then fetched (the seconds
   * needed, preview quality) and judged. Nothing licence-clean that matches: the next, broader rungs; still nothing: no
   * clip (the beat becomes a graphic scene, never a wrong or repeated clip).
   */
  let fetchStart = Date.now();
  const overBudget = () => Date.now() - fetchStart > CM_GATE.fetchBudgetMs;
  const fetchBeat = async (b: CmScript['beats'][number], bi: number): Promise<(Clip & { query: string; score: number })[]> => {
    const ladder = [...new Set([...(Array.isArray(b.broll) ? b.broll : b.broll ? [b.broll] : [])])], want = Math.max(1, b.clips ?? 1), tr = trace[bi]!;
    const out: (Clip & { query: string; score: number })[] = [];
    const known = g ? await g.serving(footageNeeds(b.say, ladder)).catch(() => [] as ClipCandidate[]) : [];
    for (let r = 0; r < ladder.length && out.length < want && (r === 0 || !overBudget()); r += CM_RUNG) {
      const rung = ladder.slice(r, r + CM_RUNG);
      tr.queries.push(...rung);
      const found = await Promise.all(rung.map(async q => (await search(q)).map(c => ({ c, q }))));
      const pool2 = new Map<string, { c: ClipCandidate; q: string }>();
      for (const x of [...(r === 0 ? known.map(c => ({ c, q: 'graph' })) : []), ...found.flat()]) if (!pool2.has(x.c.ref)) pool2.set(x.c.ref, x);
      tr.candidates += pool2.size;
      // ranked by the title and the search that found it; the best CM_CHECK_MAX are licence-checked, then re-scored with
      // the tags their pages carry, and only a free clip still at CM_MIN_SCORE or more is ever used
      const foundWord = (q: string) => q === 'graph' ? '' : (q.toLowerCase().match(/[a-z0-9]+/g) ?? []).find(w => w.length > 2 && !STOPW.has(w)) ?? '';
      const ranked = [...pool2.values()].map(x => ({ ...x, score: clipScore(x.c.title, b.say, x.q, topic, ladder, { found: foundWord(x.q), tags: tagsOf(x.c.ref) }) }))
        .filter(x => x.score >= CM_MIN_SCORE - 1 && !used.has(x.c.ref) && !/^1\d{5}$/.test(x.c.ref)).sort((x, y) => y.score - x.score || Number(x.c.ref) - Number(y.c.ref)).slice(0, CM_CHECK_MAX);
      // licence pages are checked best first, a few at a time, and only until the beat has its clips (every page
      // fetch counts against Mixkit's rate limit; a cached verdict costs nothing)
      const lic: string[] = [];
      for (let k0 = 0; k0 < ranked.length && out.length < want && (k0 === 0 || !overBudget()); k0 += CM_CHECK_BATCH) {
        const batch = ranked.slice(k0, k0 + CM_CHECK_BATCH), vs = await Promise.all(batch.map(x => gate(() => licenceOf(x.c, g ?? undefined))));
        batch.forEach((x, k) => { x.score = clipScore(x.c.title, b.say, x.q, topic, ladder, { found: foundWord(x.q), tags: tagsOf(x.c.ref) }); const tb = tagsOf(x.c.ref).length; lic[k0 + k] = vs[k]!; tr.checked.push({ ref: x.c.ref, title: x.c.title, score: x.score, verdict: vs[k]!, ...(tb ? { tags: tagsOf(x.c.ref).slice(0, 8) } : {}) }); if (vs[k] !== 'free') rejected.push({ ref: x.c.ref, why: `licence ${vs[k]}`, beat: bi + 1 }); });
        // the clip's own tags can lift it above a neighbour in its batch: the best-scored free clip is taken first
        const order = batch.map((x, k) => ({ x, v: lic[k0 + k]! })).sort((p, q) => q.x.score - p.x.score);
        order.forEach((o, k) => { ranked[k0 + k] = o.x; lic[k0 + k] = o.v; });
        if (order.some(o => o.v === 'free' && o.x.score >= CM_MIN_SCORE && !used.has(o.x.c.ref))) await take(ranked, lic, k0, k0 + batch.length);
      }
    }
    if (!out.length) { tr.graphic = overBudget() ? 'no licence-clean clip matched the line inside the fetch budget: a graphic scene' : 'no licence-clean clip matched the line: a graphic scene'; log(`beat ${bi + 1}: no matching free clip, graphic scene`); }
    return out;
    async function take(ranked: { c: ClipCandidate; q: string; score: number }[], lic: string[], from: number, to: number) {
      for (let k = from; k < to; k++) {
        const x = ranked[k]!;
        if (out.length >= want || i.signal?.aborted) break;
        if (lic[k] !== 'free' || used.has(x.c.ref) || x.score < CM_MIN_SCORE) continue;
        used.add(x.c.ref); // claimed before the download, so two beats never fetch the same clip
        const file = join(cache, `mixkit-${x.c.ref}.mp4`);
        try {
          if (!existsSync(file)) await fetchClip(x.c, file, CM_SECONDS);
          const v = await checkClip(file);
          if (!v.ok) { rejected.push({ ref: x.c.ref, why: v.why.join(', '), beat: bi + 1 }); continue; }
          log(`beat ${bi + 1}: "${x.q}" -> mixkit ${x.c.ref} "${x.c.title}" (score ${x.score}, free)`);
          tr.picked.push({ ref: x.c.ref, title: x.c.title, query: x.q, score: x.score, verdict: 'free' });
          out.push({ ...x.c, id: clipId(x.c), status: 'accepted', why: [], query: x.q, score: x.score, relevance: x.score, path: file, duration: v.duration, width: v.width, height: v.height, licence: 'Mixkit Stock Video Free License' });
        } catch (e) { rejected.push({ ref: x.c.ref, why: `download failed: ${(e as Error).message.slice(0, 80)}`, beat: bi + 1 }); }
      }
    }
  };
  const tv = Date.now();
  fetchStart = tv;
  mkdirSync(cache, { recursive: true });
  const [spoken2, clips] = await Promise.all([
    speakLines(join(dir, 'voice'), lines, { voice, rate: i.rate ?? '+12%', ...(i.signal ? { signal: i.signal } : {}) }).then(v => { T.voice = r3((Date.now() - tv) / 1000); return v; }),
    pool(script.beats, 6, (b, k) => fetchBeat(b, k)).then(v => { T.clips = r3((Date.now() - tv) / 1000); writeFileSync(searchCache, JSON.stringify(searches)); return v; }),
  ]);
  t = Date.now();
  copyFileSync(spoken2.wav, join(dir, 'vo.wav'));
  const words: TimedWord[] = spoken2.words.map((w: { word?: string; text?: string; t?: number; start?: number; end: number }) => ({ word: String(w.word ?? w.text ?? ''), t: Number(w.t ?? w.start ?? 0), end: Number(w.end) }));
  if (!clips.some(c => c.length)) throw new Error('clip-moment: no Mixkit clip passed the licence gate');
  // a beat cuts between as many clips as it got (never the same clip twice)
  script = { ...script, beats: script.beats.map((b, k) => ({ ...b, clips: Math.max(1, clips[k]!.length) })) };

  // the grade (Vignesh, 2026-10-16: "keep the colour consistent"): every clip measured and brought to one mean luma and
  // saturation, then the one shared look; the filmstrip stills and the plate both use it (clip-moment-grade.ts)
  const allClips = clips.flat();
  const grades = await gradeClips(allClips.map(c => ({ file: c.path!, ss: 0.4, t: Math.min(4, Math.max(1, (c.duration ?? CM_SECONDS) - 0.6)) })));
  const gradeOf = new Map<string, ClipGrade>(allClips.map((c, k) => [c.path!, grades[k]!]));
  // the first second is a strong shot: the opening beat starts on its clip that shows the topic, brightest first
  const topicWord = ((topic ?? '').toLowerCase().match(/[a-z]+/g) ?? []).find(w => w.length > 2) ?? '';
  if ((clips[0]?.length ?? 0) > 1) clips[0]!.sort((a, b) => Number(!!topicWord && b.title.toLowerCase().includes(topicWord)) - Number(!!topicWord && a.title.toLowerCase().includes(topicWord)) || gradeOf.get(b.path!)!.raw.luma - gradeOf.get(a.path!)!.raw.luma);
  lap('grade');

  // the library casts the 3D: camera moves for the shots and component entrances, 3D objects for ideas (graph down: the
  // plan's own library ids, said so in the trace)
  const lib = g ? await g.cast3d(script).catch(e => ({ script: script!, notes: [`graph cast failed: ${(e as Error).message.slice(0, 80)}`] })) : { script, notes: ['graph down: the plan\'s library ids'] };
  script = lib.script;
  // stills for a filmstrip: one frame from each of three clips picked for other beats
  const stills: Record<number, string[]> = {};
  const fs = script.beats.findIndex(b => b.show?.kind === 'filmstrip' || b.show2?.kind === 'filmstrip');
  if (fs >= 0) {
    const src = clips.flatMap((c, k) => (k !== fs ? c.slice(0, 1) : [])).slice(-3);
    stills[fs] = await Promise.all(src.map(async (c, k) => {
      const f = `still-${k + 1}.jpg`;
      await sh(config.ffmpeg, ['-v', 'error', '-y', '-ss', '1.2', '-i', c.path!, '-frames:v', '1', '-vf', `scale=480:-2,${gradeOf.get(c.path!)?.chain ?? CM_LOOK_CHAIN}`, '-q:v', '4', join(dir, f)], { timeout: 20_000 });
      return f;
    }));
  }
  lap('cast');

  // 3. the EDL on a placeholder source, for the shot spans; then the plate is built to exactly those spans
  const D0 = r3(words.at(-1)!.end + CM_TAIL);
  const pre = clipMomentEdl({ script, words, stills, source: { file: 'plate.mp4', duration: D0, w: W, h: H, fps: 30 }, output: { w: W, h: H, fps: 30 }, ...(i.look !== undefined ? { look: i.look } : {}) });
  const spans = plateSpans(pre);
  const beatOf = (t0: number) => Math.max(0, pre.beats!.findIndex(b => t0 >= b.t0 - 1e-3 && t0 < b.t1 - 1e-3));
  const parts: string[] = [], inputs: string[] = [], partOf = new Map<number, number>();
  spans.forEach((s, k) => {
    // the end card's span has no clip of its own: a dark graphic under the card (never the last beat's clip again)
    const bi = beatOf(s.t0), n = partOf.get(bi) ?? 0, mine = bi >= clips.length ? [] : clips[bi] ?? [], c = mine[n % Math.max(1, mine.length)], len = Math.max(0.1, s.t1 - s.t0);
    partOf.set(bi, n + 1);
    // no licence-clean clip that matches: a dark graphic scene under the beat's cards (never a wrong clip)
    if (!c) inputs.push('-f', 'lavfi', '-t', len.toFixed(3), '-i', `color=c=0x0c0b0a:s=${W}x${H}:r=30`);
    else inputs.push('-stream_loop', '-1', '-ss', '0.4', '-t', len.toFixed(3), '-i', c.path!);
    parts.push(`[${k}:v]scale=${W}:${H}:force_original_aspect_ratio=increase,crop=${W}:${H},setsar=1,fps=30,format=yuv420p,${(c && gradeOf.get(c.path!)?.chain) || CM_LOOK_CHAIN},trim=duration=${len.toFixed(3)},setpts=PTS-STARTPTS[v${k}]`);
  });
  const vf = `${parts.join(';')};${spans.map((_, k) => `[v${k}]`).join('')}concat=n=${spans.length}:v=1:a=0,${CM_FINISH_CHAIN},format=yuv420p[v]`;

  // 4. audio: voice + the sfx the EDL places + the bed, ducked under the voice, -14 LUFS
  // the sfx are cast from the library graph like every style's (audio/mix castStem → assetsForEvent; map.json if down)
  const evs: Ev[] = (pre.sfx ?? []).map(s => ({ t: s.t, event: String((s as { event?: string }).event ?? 'pop'), ...(s.gain_db !== undefined ? { gain_db: s.gain_db } : {}) }));
  const { cast } = i.noGraph ? { cast: null } : await castStem(evs, join(dir, 'sfx.wav'), dir);
  if (!cast) sfxStem(evs, join(dir, 'sfx.wav'));
  const sfxIds: Record<string, string> = {};
  if (cast?.source === 'graph') for (const [ev, ids] of Object.entries(cast.events)) if (ids[0]) sfxIds[ev] = ids[0];
  bedStem(D0 + 0.5, join(dir, 'music.wav'));
  await sh(config.ffmpeg, ['-v', 'error', '-y', '-i', join(dir, 'vo.wav'), '-i', join(dir, 'music.wav'), '-i', join(dir, 'sfx.wav'), '-filter_complex',
    '[0:a]aresample=48000,asplit=2[vo][key];[1:a]aresample=48000,volume=0.32[bed];[bed][key]sidechaincompress=threshold=0.03:ratio=8:attack=20:release=300[ducked];[2:a]aresample=48000,volume=0.55[fx];[vo][ducked][fx]amix=inputs=3:normalize=0:duration=longest,acompressor=threshold=-20dB:ratio=3:attack=5:release=80,loudnorm=I=-14:TP=-1.5:LRA=7[a]',
    '-map', '[a]', '-t', D0.toFixed(3), '-ar', '48000', '-c:a', 'aac', '-b:a', '160k', join(dir, 'master.m4a')], { timeout: 120_000 });
  lap('audio');

  // 5. the plate: every beat's clip, full bleed 9:16, denavied, with the mix on it (the live player plays its sound)
  await sh(config.ffmpeg, ['-v', 'error', '-y', ...inputs, '-i', join(dir, 'master.m4a'), '-filter_complex', vf, '-map', '[v]', '-map', `${spans.length}:a`,
    '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '20', '-g', '15', '-c:a', 'copy', '-shortest', '-movflags', '+faststart', join(dir, 'plate.mp4')], { timeout: 300_000 });
  lap('plate');

  // 6. the final EDL on the real plate; the graph keeps every clip used (and every licence verdict) as an Asset
  const edl = clipMomentEdl({ script, words, stills, source: { file: 'plate.mp4', duration: D0, w: W, h: H, fps: 30 }, output: { w: W, h: H, fps: 30 }, ...(i.look !== undefined ? { look: i.look } : {}) });
  if (Object.keys(sfxIds).length) edl.sfx = (edl.sfx ?? []).map(s => ({ ...s, asset_ref: sfxIds[String((s as { event?: string }).event)] ?? s.asset_ref }));
  const { problems } = validateEdl(edl);
  if (problems.length) throw new Error(`clip-moment EDL: ${problems.slice(0, 3).join('; ')}`);
  writeFileSync(join(dir, 'edl.json'), JSON.stringify(edl));
  const picks: CmClipPick[] = clips.flatMap((cs, k) => cs.map(c => ({ beat: k + 1, query: c.query, id: clipId(c), ref: c.ref, title: c.title, page: c.page, licence: c.licence, file: c.path!, score: c.score })));
  // credits stay off screen (the free licence needs none): here and on the Asset nodes
  writeFileSync(join(dir, 'credits.json'), JSON.stringify({ footage: picks.map(({ file: _f, ...p }) => p), rejected, voice, sfx: sfxIds }, null, 1));
  // the trace: per line, what was searched, what was checked (score, licence) and picked, its components and 3D ids
  const comps = edl.inserts.filter(x => String(x.asset_ref ?? '').startsWith('clip-moment:'));
  script.beats.forEach((b, k) => {
    const tb = trace[k]!; tb.components = [b.kicker ? 'kicker' : '', b.show?.kind ?? '', b.show2?.kind ?? ''].filter(x => x && x !== 'none');
    tb.library = [...(b.camera ?? []).slice(0, Math.max(1, b.clips ?? 1)), ...(b.enter ? [b.enter] : []), ...[b.show, b.show2].flatMap(s => (s?.kind === 'obj3d' ? [s.obj] : []))];
  });
  const threeD = comps.filter(x => (x as { params?: { enter?: string } }).params?.enter || x.asset_ref === 'clip-moment:obj3d').length + edl.shots.filter(s => /camera:(orbit|tilt|rise|drift-left|drift-right|pull-out)/.test(s.camera?.asset_ref ?? '')).length;
  const gradeTrace = {
    ids: CM_GRADE_IDS, target: { luma: CM_GRADE.luma, sat: CM_GRADE.sat }, look: CM_LOOK_CHAIN, finish: CM_FINISH_CHAIN,
    clips: allClips.map(c => { const q = gradeOf.get(c.path!)!; return { ref: c.ref, title: c.title, raw: q.raw, after: q.after, gamma: q.gamma, sat: q.sat }; }),
    spread: { raw: spreadOf(grades.map(q => q.raw)), after: spreadOf(grades.map(q => q.after)) },
  };
  const transitions = (edl.cuts ?? []).map(c => ({ t: c.t, type: c.type, ref: String(c.rule_id).replace(/^cm\.tr\./, '') }));
  const sfxTrace = (edl.sfx ?? []).map(s => ({ t: s.t, event: String((s as { event?: string }).event ?? ''), ref: s.asset_ref, rule: s.rule_id }));
  writeFileSync(join(dir, 'trace.json'), JSON.stringify({ topic, library: lib.notes, components: comps.length, kinds: [...new Set(comps.map(x => String(x.asset_ref).slice(12)))], threeD, palette: CM_PALETTE, grade: gradeTrace, transitions, transitionKinds: CM_TRANSITIONS.map(x => x.ref), sfx: sfxTrace, sound: sfxIds, mixkit: mixkitBreaker(), beats: trace }, null, 1));
  let graph = 'off';
  if (g) {
    const verdictsNow = readVerdicts();
    const rows = [...picks.map(p => ({ ref: p.ref, title: p.title, page: p.page, url: `https://assets.mixkit.co/videos/${p.ref}/${p.ref}-720.mp4`, query: p.query, licence: 'free' as const })),
      ...rejected.filter(r => verdictsNow[r.ref]?.v === 'restricted').map(r => ({ ref: r.ref, title: `mixkit ${r.ref}`, page: `https://mixkit.co/free-stock-video/${r.ref}/`, url: '', query: topic ?? 'footage', licence: 'restricted' as const }))];
    const uniq = [...new Map(rows.map(r => [r.ref, r])).values()];
    graph = await g.keep(uniq).then(n => `${n} clips kept as assets`).catch(e => `write failed: ${(e as Error).message.slice(0, 80)}`);
  }
  lap('edl');
  T.total = r3(Object.entries(T).filter(([k]) => k !== 'voice' && k !== 'clips').reduce((a, [, v]) => a + v, 0) + Math.max(T.voice ?? 0, T.clips ?? 0));
  return { edl, dir, timings: T, clips: picks, rejected, why, graph };
}

/** Topic mode needs a plate on disk; this says whether a dir already holds a playable Clip Moment. */
export const cmReady = (dir: string) => existsSync(join(dir, 'edl.json')) && existsSync(join(dir, 'plate.mp4'));
