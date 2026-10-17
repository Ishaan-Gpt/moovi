import { toEdlZoom, type CameraCall } from '@moovi/library/camera';
import { metricsOf, type Edl } from '../edl';
import { EDIT } from '../lib';

/**
 * Studio Cut: the upload edit as a studio would cut it (the grammar of the owner-approved reference reel, 2026-10-17,
 * data/edits/ishaan/studio). It dresses the edit the builder already made from the user's own clip; the words, shots
 * and timing stay. What it adds, all as EDL data the player's studio-cut runtime draws (./studio-cut-runtime.ts):
 *
 *   camera     one continuous camera per shot from Moovi's camera layer (drift, a pulse on accent words, a ramped push
 *              into a title, a crash zoom on a lock-in line), baked into each shot's zoom keys with toEdlZoom, capped
 *              by the source's zoom budget so a small clip is never blown up past what it holds
 *   captions   Atlas tier-two stacks: up to three connector words over one slammed key word, placed on the side of the
 *              face with room (else low and centred), each with an in, a during and an out (inserts `studio-cut:stack`)
 *   graphics   at most one per sentence, never overlapping, picked from what is said: a title pull-back (introducing X),
 *              a name card, half-screen chips (a spoken list), a raw → finished compare (convert / turn / into), an edit
 *              timeline (edit / effects / animations), a phone mockup (post / upload / a platform), a growth chart
 *              (results / views / a number), a crash-zoom lock-in (a short command), and the end card
 *   sound      Style 1 events (sfx[] with `event` and no file): a typing note per connector word, a snap per key word,
 *              woosh peaks on arrivals, air cuts on scene changes, at most two punches, risers that end on their cut;
 *              audio/style1.ts renders them into the mix the player plays (planEdit, beside the voice clean-up)
 *
 * Same base EDL + same options = the same EDL (no clock, no Math.random).
 */
export const SC_ID = 'studio-cut';
export const SC_VERSION = '1';

type Ins = NonNullable<Edl['inserts']>[number] & { params?: Record<string, unknown> };
type Sfx = NonNullable<Edl['sfx']>[number];
export interface ScOptions {
  /** the product or channel name (title card, name card subline, end card); none = those cards use the spoken words */
  brand?: string;
  /** a url or handle for the end card */
  url?: string;
  /** a short line under the brand ("The AI video editor") */
  tagline?: string;
  /** the logo image in the edit folder (served at /v/<file>) */
  logo?: string;
  /** the original upload in the edit folder, for the raw side of a compare (the ungraded clip) */
  raw?: string;
  /** the source's zoom budget (job.ts castMaxZoom) */
  maxZoom?: number;
}
export type ScEdl = Edl & { template: { id: string; version: string; brand: string; url?: string; tagline?: string; logo?: string; raw?: string }; inserts: Ins[] };

const r3 = (x: number) => Math.round(x * 1000) / 1000;
const clean = (s: string) => s.replace(/[^\p{L}\p{N}'%$-]/gu, '');
const low = (s: string) => clean(s).toLowerCase();
const STOP = new Set(['the', 'a', 'an', 'and', 'or', 'but', 'so', 'to', 'of', 'in', 'on', 'at', 'for', 'with', 'is', 'are', 'was', 'were', 'be', 'it', 'its', "it's", 'this', 'that', 'these', 'those', 'i', "i'm", 'am', 'you', 'your', 'we', 'our', 'they', 'he', 'she', 'my', 'me', 'us', 'can', 'will', 'just', 'now', 'then', 'which', 'what', 'how', 'basically', 'really', 'very', 'get', 'got', 'do', 'does', 'did', 'have', 'has', 'had', 'okay', 'ok', 'like', 'into', 'them', 'there', 'here', 'all', 'some', 'any', 'more', 'also', 'up', 'out', 'about', 'if', 'not', 'no', 'yes']);

interface OW { text: string; t0: number; t1: number; role?: string }
interface Sentence { words: OW[]; t0: number; t1: number; last: boolean }
interface Stack { conn: OW[]; key: OW; t0: number; out: number; side: 'L' | 'R' | 'C'; accent: boolean; sub?: string; doodle?: boolean }

/** sentences: a full stop, question or exclamation ends one, so does a pause over 0.6 s */
function sentences(ws: OW[]): Sentence[] {
  const out: Sentence[] = []; let cur: OW[] = [];
  ws.forEach((w, i) => {
    cur.push(w);
    const next = ws[i + 1], end = /[.!?]$/.test(w.text) || !next || next.t0 - w.t1 > 0.6;
    if (end) { out.push({ words: cur, t0: cur[0]!.t0, t1: w.t1, last: false }); cur = []; }
  });
  if (out.length) out.at(-1)!.last = true;
  return out;
}
/** a word that can carry a stack: a number, the brand, a proper noun, or a content word of four letters or more */
const content = (w: OW, brand: string) => /\d/.test(w.text) || (!!brand && low(w.text) === brand) || (!STOP.has(low(w.text)) && clean(w.text).length >= 4) || (/^\p{Lu}/u.test(clean(w.text)) && !STOP.has(low(w.text)) && clean(w.text).length > 1);

/**
 * Atlas groups: small words gather as the connector line until a key word lands. The key is the LAST content word of a
 * run ("after effects style ANIMATIONS"), the brand or a number always closes a group, the last word of a sentence closes
 * it, and a connector line never passes four words (the longest word so far then takes the key).
 */
function stacks(ss: Sentence[], brand: string, side: (t: number) => 'L' | 'R' | 'C'): Stack[] {
  const out: Stack[] = [];
  const close = (conn: OW[], key: OW) => out.push({ conn, key, t0: (conn[0] ?? key).t0, out: 0, side: clean(key.text).length > 9 ? 'C' : side(key.t0), accent: !!brand && low(key.text) === brand });
  for (const s of ss) {
    let conn: OW[] = [];
    const skip = new Set<OW>();
    s.words.forEach((w, i) => {
      if (skip.has(w)) return;
      const next = s.words[i + 1], hard = /\d/.test(w.text) || (!!brand && low(w.text) === brand);
      const runEnds = !next || !content(next, brand) || next.t0 - w.t1 > 0.35 || (!!brand && low(next.text) === brand);
      if (!next || hard || (content(w, brand) && runEnds)) {
        const part = next && /^(in|up|out|on|off|down|over)$/.test(low(next.text)) && next.t0 - w.t1 < 0.3 && content(w, brand) ? next : undefined;
        close(conn, part ? { ...w, text: `${w.text} ${part.text}`, t1: part.t1 } : w); conn = []; if (part) skip.add(part); return;
      }
      conn.push(w);
      if (conn.length > 4) { const k = conn.reduce((m, x) => clean(x.text).length > clean(m.text).length ? x : m, conn[0]!), j = conn.indexOf(k); close(conn.slice(0, j), k); conn = conn.slice(j + 1); }
    });
  }
  out.forEach((g, i) => { const n = out[i + 1]; g.out = r3(n ? n.t0 - 0.04 : g.key.t1 + 0.6); });
  return out;
}

interface Pick { kind: string; t0: number; t1: number; params: Record<string, unknown> }
const has = (s: Sentence, re: RegExp) => s.words.find(w => re.test(low(w.text)));

/**
 * The graphic beats, picked from what is said, each in a window around its own trigger words (never a whole sentence),
 * several per sentence when they fit, in priority order, never overlapping (0.2 s apart at least: the reference cuts graphic to graphic).
 */
function picks(ss: Sentence[], o: ScOptions, D: number): Pick[] {
  const brand = (o.brand ?? '').toLowerCase(), out: Pick[] = [];
  const free = (t0: number, t1: number) => out.every(p => t1 <= p.t0 - 0.2 || t0 >= p.t1 + 0.2);
  // a window that overlaps a neighbour is trimmed to fit beside it, as long as its trigger (`at`) stays inside
  const add = (kind: string, t0: number, t1: number, params: Record<string, unknown>, at = (t0 + t1) / 2) => {
    t0 = Math.max(0, t0); t1 = Math.min(D, t1);
    for (const p of out) { if (p.t1 + 0.2 > t0 && p.t1 <= at) t0 = p.t1 + 0.2; if (p.t0 - 0.2 < t1 && p.t0 >= at) t1 = p.t0 - 0.2; }
    t0 = r3(t0); t1 = r3(t1); if (t1 - t0 < 0.6 || at < t0 - 0.05 || at > t1 || !free(t0, t1)) return false;
    out.push({ kind, t0, t1, params }); return true;
  };
  const all = ss.flatMap(s => s.words), lastS = ss.at(-1);
  // 1 the end card: the last sentence's brand word (or its last 1.8 s) to the end
  if (lastS && ss.length > 1) {
    const k = lastS.words.find(w => brand && low(w.text) === brand), w0 = lastS.words.find(w => /^(watch|try|visit|follow|check)$/.test(low(w.text)));
    const t0 = Math.max(lastS.t0, (w0 ?? k)?.t0 ?? D - 1.8) - 0.1;
    add('end', Math.min(t0, D - 1.2), D, { title: o.brand || clean((k ?? lastS.words.at(-1)!).text), url: o.url ?? '', logo: o.logo ?? '', hit: r3(lastS.words.at(-1)!.t0), brandAt: r3((k ?? lastS.words.at(-1)!).t0) });
  }
  // 2 the title pull-back: the brand after "introducing", else the first time the brand is said
  const intro = all.find(w => /^(introducing|presenting|meet)$/.test(low(w.text))), afterIntro = intro ? all[all.indexOf(intro) + 1] : undefined;
  const bw = brand ? all.find(w => low(w.text) === brand) : undefined, at = (afterIntro && (!brand || low(afterIntro.text) === brand)) ? afterIntro : bw ?? afterIntro;
  if (at) add('title', at.t0 - 0.02, Math.min(at.t0 + 1.3, Math.max(at.t1 + 0.4, at.t0 + 0.9)), { title: o.brand || clean(at.text), tagline: o.tagline ?? '', logo: o.logo ?? '' });
  // 3 the lock-in: a short command in the last three sentences (crash zoom, a cold vignette); before the rest, which trim around it
  for (const s of ss.slice(-3)) { const cmd = has(s, /^(lock|subscribe|follow|start|go|comment|join)$/); if (cmd) add('crash', cmd.t0 - 0.05, cmd.t0 + 0.6, { at: r3(cmd.t0) }, cmd.t0); }
  for (const s of ss) {
    // 3 the phone: post / upload and a platform
    const platform = has(s, /^(instagram|youtube|tiktok|reels?|shorts|linkedin|twitter)$/), post = has(s, /^(post|posted|upload|uploading|share|publish)$/);
    if (platform || post) { const a = (post ?? platform)!, b = (platform ?? post)!; add('phone', a.t0 - 0.75, b.t1 + 0.6, { tap: r3(a.t0), posted: r3(b.t0), platform: platform ? clean(platform.text).replace(/^\p{L}/u, c => c.toUpperCase()) : '' }, a.t0); }
    // 4 the chart: a number or a growth word
    const num = s.words.find(w => /\d/.test(w.text)), grow = has(s, /^(results?|views|growth|grow|followers|sales|revenue|subscribers|reach)$/);
    if (num || grow) { const k = (num ?? grow)!, n = num ? Number(clean(num.text).replace(/[^\d.]/g, '')) * (/k$/i.test(clean(num.text)) ? 1e3 : /m$/i.test(clean(num.text)) ? 1e6 : 1) : 0;
      add('chart', k.t0 - 0.7, k.t1 + 0.6, { at: r3(k.t0), value: Number.isFinite(n) ? n : 0, label: clean((grow ?? num)!.text).toUpperCase() }, k.t0); }
    // 5 the compare: convert / turn ... into (the raw clip wiped into the finished one)
    const turn = has(s, /^(convert|converts|converting|turn|turns|transform|transforms)$/), into = has(s, /^(into|finished|final)$/);
    if (turn && o.raw) add('compare', turn.t0 - 0.1, (into ?? turn).t1 + 0.4, { wipe: r3((into ?? turn).t0), raw: o.raw }, turn.t0);
    // 6 the timeline: editing words, three or more content words to key
    const ed = [...s.words].reverse().find(w => /^(effects|animations?|motion|timeline|transitions|keyframes)$/.test(low(w.text)));
    if (ed) { const ix = s.words.indexOf(ed), span = s.words.slice(Math.max(0, ix - 3), ix + 1), keys = span.filter(w => !STOP.has(low(w.text))).map(w => r3(w.t0));
      if (keys.length >= 2) add('timeline', span[0]!.t0 - 0.1, ed.t1 + 0.5, { keys }, ed.t0); }
    // 7 half-screen chips: a real spoken list, three or more comma-separated items of at most three words each
    const parts = s.words.map(w => w.text).join(' ').split(',').map(x => x.trim()).filter(Boolean);
    const items = parts.length >= 3 && parts.every(p => p.split(/\s+/).length <= 3) ? parts.map(p => p.split(/\s+/).filter(y => !STOP.has(low(y))).join(' ')).filter(x => x.length >= 3) : [];
    if (items.length >= 3) add('chips', s.t0 + 0.1, s.t1 + 0.3, { items: items.slice(0, 5).map(x => x.split(' ').map(clean).join(' ')) });
  }
  return out.sort((a, b) => a.t0 - b.t0);
}

/** the continuous camera of one shot: drift, pulses on accent keys, a ramped push into a title, a crash zoom on a lock-in */
function cameraOf(shot: Edl['shots'][number], st: Stack[], pk: Pick[], maxZoom: number, srcAspect: number) {
  const t0 = shot.t_in, t1 = shot.t_out, calls: CameraCall[] = [];
  const marks: { t: number; call: CameraCall }[] = [];
  for (const s of st) if (s.accent && s.key.t0 > t0 + 0.4 && s.key.t0 < t1 - 0.4) marks.push({ t: s.key.t0 - 0.03, call: { move: 'pulse', amount: 1.06 } });
  for (const p of pk) {
    if (p.kind === 'title' && p.t0 - 0.5 > t0 && p.t0 < t1) marks.push({ t: p.t0 - 0.5, call: { move: 'fast-zoom-in', duration: 0.5, ease: 'ramp-up', amount: 1.08 } });
    if (p.kind === 'crash' && p.t0 > t0 && p.t0 < t1 - 0.3) marks.push({ t: p.t0, call: { move: 'crash-zoom-in', duration: 0.3, amount: 1.16 } });
  }
  marks.sort((a, b) => a.t - b.t);
  let cur = t0;
  for (const m of marks) {
    if (m.t < cur + 0.05) continue;
    calls.push({ move: 'drift', duration: +(m.t - cur).toFixed(3), intensity: 1.2 }); calls.push(m.call);
    cur = m.t + (m.call.duration ?? (m.call.move === 'pulse' ? 0.6 : 0.3));
    if (m.call.move === 'crash-zoom-in') { calls.push({ move: 'drift', duration: 0.5, intensity: 1 }, { move: 'fast-zoom-out', duration: 0.6, ease: 'smooth', amount: 1.16 }); cur += 1.1; }
  }
  if (t1 - cur > 0.05) calls.push({ move: 'drift', duration: +(t1 - cur).toFixed(3), intensity: 1.2 });
  const base = shot.framing ?? { scale: 1.04, cx: 0.5, cy: 0.42 };
  const framing = { ...base, scale: Math.min(base.scale, maxZoom - 0.12) };
  const keys = toEdlZoom(calls, { t0, framing, source: srcAspect, rate: 12 }).filter(k => k.t <= t1 + 1e-6)
    .map(k => ({ ...k, scale: r3(Math.min(maxZoom, k.scale)), rule_id: 'sc.camera' }));
  return { framing, keys };
}

/** Dress the builder's EDL as a Studio Cut. */
export function studioCutEdl(base: Edl, o: ScOptions = {}): ScEdl {
  const D = base.shots.at(-1)!.t_out, brand = (o.brand ?? '').toLowerCase(), maxZoom = o.maxZoom ?? 1.25;
  const ws: OW[] = EDIT.outWords(base);
  const ss = sentences(ws);
  // the side of the frame with room for a stack, from where the face sits at that moment (fractions of the output)
  const side = (t: number): 'L' | 'R' | 'C' => { const f = EDIT.faceOutAt(base, t); if (!f) return 'C'; const cx = (f.x0 + f.x1) / 2; return cx < 0.44 ? 'R' : cx > 0.56 ? 'L' : (f.x0 > 0.3 ? 'L' : 'C'); };
  const st = stacks(ss, brand, side);
  const pk = picks(ss, o, D);
  // the name card: "I am X" / "I'm X" / "my name is X" makes X's stack a name (subline, a marker stroke)
  for (const s of ss) { const i = s.words.findIndex((w, j) => /^(am|i'm|im)$/.test(low(w.text)) || (low(w.text) === 'is' && j > 0 && low(s.words[j - 1]!.text) === 'name')); const nm = i >= 0 ? s.words[i + 1] : undefined; const g = nm && st.find(x => x.key === nm); if (g) { g.sub = o.brand ? `BUILDING ${o.brand.toUpperCase()}` : ''; g.doodle = true; } }
  // stacks hide while a full-screen graphic owns the frame; inside a half-screen one they move into the speaker's half
  const full = pk.filter(p => p.kind === 'title' || p.kind === 'end'), half = pk.filter(p => p.kind === 'chips' || p.kind === 'compare' || p.kind === 'timeline');
  const shown = st.filter(g => !full.some(p => g.key.t0 >= p.t0 - 0.05 && g.key.t0 < p.t1));
  const inserts: Ins[] = [...(base.inserts ?? [])];
  for (const g of shown) {
    const h = half.find(p => g.key.t0 >= p.t0 && g.key.t0 < p.t1);
    const sideNow: 'L' | 'R' | 'C' | 'H' | 'T' = h ? (h.kind === 'timeline' ? 'T' : 'H') : g.side;
    const outT = Math.min(g.out, ...full.filter(p => p.t0 > g.key.t0).map(p => p.t0 - 0.06));
    inserts.push({ t0: r3(g.t0 - 0.05), t1: r3(Math.max(g.key.t1, outT) + 0.3), kind: 'title', frame: 'full', label: g.key.text, asset_ref: `${SC_ID}:stack`, rule_id: 'sc.stack',
      params: { conn: g.conn.map(w => ({ s: clean(w.text).toLowerCase(), t: r3(w.t0) })), key: { s: g.key.text.split(' ').map(clean).join(' ').toUpperCase(), t: r3(g.key.t0) }, out: r3(outT), side: sideNow, accent: g.accent, ...(g.sub !== undefined ? { sub: g.sub } : {}), ...(g.doodle ? { doodle: true } : {}) } });
  }
  for (const p of pk) inserts.push({ t0: p.t0, t1: p.t1, kind: p.kind === 'phone' ? 'phone' : p.kind === 'chart' ? 'number' : p.kind === 'timeline' ? 'ui' : 'panel', frame: p.kind === 'title' || p.kind === 'end' || p.kind === 'timeline' ? 'full' : p.kind === 'phone' || p.kind === 'chart' ? 'beside_head' : 'top_half', label: p.kind, asset_ref: `${SC_ID}:${p.kind}`, rule_id: `sc.${p.kind}`, params: p.params });
  // the camera: every shot gets its continuous track
  const srcAspect = base.source.w / base.source.h;
  const shots = base.shots.map(s => { const c = cameraOf(s, st, pk, maxZoom, srcAspect); return { ...s, framing: c.framing, zoom: c.keys, rule_id: s.rule_id ?? 'sc.camera' }; });
  // Style 1 sound events (no file: the mix renders them; the player plays the mix)
  const sfx: Sfx[] = []; let punches = 0;
  const S = (t: number, event: string, extra: Partial<Sfx> = {}) => { if (t >= 0 && t <= D) sfx.push({ t: r3(t), event: event as Sfx['event'], asset_ref: `sfx:${event}`, rule_id: 'sc.sound.' + event, ...extra } as Sfx); };
  for (const g of shown) { g.conn.forEach(w => S(w.t0 - 0.03, 'word')); S(g.key.t0 - 0.02, 'key-word'); }
  for (const p of pk) {
    const P = p.params as Record<string, number>;
    if (p.kind === 'title') { S(p.t0, 'build', { sound: 'riser-short' }); S(p.t0 + 0.18, 'scene'); if (punches++ < 2) S(p.t0 + 0.3, 'hard-hit'); S(p.t1 - 0.1, 'scene'); }
    if (p.kind === 'end') { S(p.t0 + 0.3, 'scene'); S(p.t0 + 0.55, 'card-in'); S(p.t0 + 0.4, 'stat'); S(P.hit!, 'cta'); }
    if (p.kind === 'chips') { S(p.t0 + 0.4, 'card-in'); S(p.t0 + 0.45, 'cascade', { count: ((p.params.items as string[]) ?? []).length, spacing: 0.09 }); S(p.t1 - 0.2, 'slide-out'); }
    if (p.kind === 'compare') { S(p.t0 + 0.35, 'card-in'); S(P.wipe! - 0.04, 'scene'); S(P.wipe! + 0.3, 'accent'); S(p.t1 - 0.2, 'slide-out'); }
    if (p.kind === 'timeline') { S(p.t0, 'ui-reveal'); S(p.t0 + 0.25, 'scene'); for (const k of (p.params.keys as number[]) ?? []) S(k, 'list-item'); S(p.t1 - 0.2, 'scene'); }
    if (p.kind === 'phone') { S(p.t0 + 0.45, 'card-in'); S(P.tap!, 'click-ui'); S(P.posted!, 'notify'); S(p.t1 - 0.2, 'slide-out'); }
    if (p.kind === 'chart') { S(p.t0 + 0.4, 'card-in'); S(P.at!, 'stat'); S(p.t1 - 0.2, 'slide-out'); }
    if (p.kind === 'crash') { S(P.at!, 'build', { sound: 'riser-short' }); if (punches++ < 2) S(P.at!, 'hard-hit'); }
  }
  const out: ScEdl = {
    ...base, style_id: SC_ID, shots, inserts: inserts.sort((a, b) => a.t0 - b.t0),
    template: { id: SC_ID, version: SC_VERSION, brand: o.brand ?? '', ...(o.url ? { url: o.url } : {}), ...(o.tagline ? { tagline: o.tagline } : {}), ...(o.logo ? { logo: o.logo } : {}), ...(o.raw ? { raw: o.raw } : {}) },
    sfx: sfx.sort((a, b) => a.t - b.t), // Studio Cut owns the sound: the library cast's file sounds would double the mix
  };
  out.metrics = metricsOf(out);
  return out;
}

/** The Style 1 events of a Studio Cut EDL, for audio/style1.ts sfxStem (cascades keep their count and spacing). */
export function scSfxEvents(e: Edl): { t: number; event: string; sound?: string; count?: number; spacing?: number }[] {
  return (e.sfx ?? []).filter(x => !x.file).map(y => ({ t: y.t, event: y.event, ...(y.sound ? { sound: y.sound } : {}), ...(y.count ? { count: y.count, spacing: y.spacing ?? 0.05 } : {}) }));
}
