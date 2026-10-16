import { CRAFT, library as L, run } from '@moovi/graph';
import { catalogue } from '../library/catalog';
import { LIBRARY as S4 } from '../s4/library';
import { library as pictures, score as pictureScore } from '../s4/library-pics';
import type { Edl, EdlBeat } from './edl';
import { EDIT } from './lib';

/**
 * D2.5, inserts from the generation styles (R4b): a beat of the edit gets a small designed scene drawn into an insert
 * frame over the user's footage, cast by need from the library graph's `insert` rows of two generation styles:
 *
 * - **Style 1 UI** (`insert:s1-*`, packages/library/src/style-1/scenes.ts): a count-up stat card on a number, a
 *   ticked checklist on a list, a phone notification on a name or story, a comment composer on a call to action. Drawn
 *   in Style 1's own tokens (cream #FFFFEB cards, ink #1A1A1A, green ticks #034F46).
 * - **Editorial posters** (`insert:s4-*`, packages/engine/src/s4/library.ts): a full-frame cream poster with the
 *   Editorial library picture that best matches the line (packages/library/src/style-4/pictures.json, the same
 *   matcher Editorial uses) and the line's key words set in the serif, KEY words in caps. A line no picture serves
 *   gets the type-only title card.
 *
 * The graph answers which set-ups serve the beat's needs (`assetsServing`, category `insert`, by runtime s1 / s4);
 * when FalkorDB is down the catalogue rows the graph is seeded from answer the same way. Pure data out: each insert
 * carries `kind`, `frame`, `asset_ref` and `params` (the words, the number, the list, the picture), so the preview
 * player and the MP4 overlay draw it with `INSERT_DRAW_SRC` and nothing is fetched at play time.
 *
 * House rules: one insert at a time, at least `gap` seconds between two, a drawer kind at most twice per edit and
 * never twice in a row, the two libraries alternate when both can serve, nothing in the first 0.8 s or the last 1 s,
 * a card never covers the face (else it becomes a full-frame cut-in), and captions step aside under a full-frame poster
 * (the poster already says the line).
 */

export type InsertLib = 's1' | 's4';
export type InsertDraw = 'stat' | 'checklist' | 'notify' | 'comment' | 'poster' | 'title';
export interface InsertPick { id: string; lib: InsertLib; impl: string; hits: number }
export interface InsertSource {
  source: 'graph' | 'catalogue';
  /** insert set-ups of one library that serve these needs, most shared needs first */
  inserts(needs: string[], lib: InsertLib): Promise<InsertPick[]>;
}
export interface InsertTrace { source: 'graph' | 'catalogue'; picks: { t0: number; t1: number; tag: string; asset: string; draw: InsertDraw; frame: string; why: string }[]; skipped: { t0: number; tag: string; why: string }[] }

/** Style 1 scenes the edit can draw, by the drawer that draws them. */
export const S1_DRAW: Record<string, InsertDraw> = {
  'stat-reveal': 'stat', 'problem-crash': 'stat', 'list-steps': 'checklist', 'problem-reject-list': 'checklist', 'list-picker': 'checklist',
  'notification-landing': 'notify', 'hook-question': 'notify', 'hook-story-lockscreen': 'notify', 'social-chat': 'notify', 'cta-comment': 'comment', 'cta-pill': 'comment', 'cta-save-share': 'comment',
};
/** What each beat tag needs from the insert library (the graph's :Need ids), and which drawers can say it. */
export const INSERT_NEEDS: Record<string, { needs: string[]; s1: InsertDraw[]; s4: InsertDraw[] }> = {
  number: { needs: ['proof', 'number'], s1: ['stat'], s4: [] },
  list: { needs: ['list'], s1: ['checklist'], s4: ['poster'] },
  name: { needs: ['people', 'reveal', 'brand'], s1: ['notify'], s4: ['poster', 'title'] },
  story: { needs: ['people', 'process'], s1: ['notify'], s4: ['poster'] },
  quote: { needs: ['emotion', 'people', 'quote'], s1: [], s4: ['title', 'poster'] },
  claim: { needs: ['claim', 'idea', 'focus'], s1: [], s4: ['poster', 'title'] },
  hook: { needs: ['hook', 'claim'], s1: ['notify'], s4: ['poster', 'title'] },
  cta: { needs: ['cta'], s1: ['comment'], s4: [] },
};
/** Fallback set-ups when the library serves nothing drawable for a beat. */
const FALLBACK: Record<InsertDraw, string> = { stat: 'insert:s1-stat-reveal', checklist: 'insert:s1-list-steps', notify: 'insert:s1-notification-landing', comment: 'insert:s1-cta-comment', poster: 'insert:s4-hero-stack', title: 'insert:s4-pull-quote' };
/** Editorial set-ups by what the edit draws for them: type-only ones as a title card, one-picture ones as a poster. */
const S4_TITLE = new Set(S4.filter(s => s.typeOnly).map(s => s.id));
const S4_POSTER = new Set(S4.filter(s => s.pics === 1 && !s.echo).map(s => s.id));
const KIND: Record<InsertDraw, 'number' | 'checklist' | 'phone' | 'ui' | 'poster' | 'title'> = { stat: 'number', checklist: 'checklist', notify: 'phone', comment: 'ui', poster: 'poster', title: 'title' };
/** Beat tags worth an insert, strongest first. */
const PRIORITY = ['number', 'list', 'cta', 'name', 'quote', 'story', 'claim', 'hook'];

const implOf = (impl: unknown, lib: InsertLib): string => {
  const o = typeof impl === 'string' ? (() => { try { return JSON.parse(impl); } catch { return {}; } })() : (impl ?? {});
  return String((o as Record<string, string>)[lib] ?? '');
};

/** The catalogue rows the graph is seeded from, answering as the graph would. */
export function catalogueInserts(rows = catalogue().flatMap(s => s.rows).filter(r => r.category === 'insert')): InsertSource {
  return {
    source: 'catalogue',
    inserts: async (needs, lib) => rows.filter(r => r.runtime.includes(lib))
      .map(r => { const n = (r.needs ?? []).filter(x => needs.includes(x)); return { id: r.id, lib, impl: implOf(r.impl, lib), hits: n.length }; })
      .filter(r => r.hits > 0).sort((a, b) => b.hits - a.hits || a.id.localeCompare(b.id)),
  };
}

/** The library graph (FalkorDB). */
export function graphInserts(): InsertSource {
  return {
    source: 'graph',
    inserts: async (needs, lib) => (await run<{ id: string; impl: unknown; hits: number }>(CRAFT, L.assetsServing, { needs, category: 'insert', runtime: lib, shipOnly: false, n: 60 }))
      .map(r => ({ id: r.id, lib, impl: implOf(r.impl, lib), hits: r.hits })),
  };
}

const r3 = (x: number) => +x.toFixed(3);
const NUM_WORDS: Record<string, number> = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, twelve: 12, fifteen: 15, twenty: 20, thirty: 30, fifty: 50, hundred: 100, thousand: 1000, million: 1e6, billion: 1e9 };
const STOP = new Set('a an the and or but so to of in on at for with is are was were be it this that you your i we our my me us they it\'s just like really very can will do does did have has had not no yes all its from by as if then than there here what when how who why which'.split(' '));
const clean = (s: string) => s.replace(/[^\p{L}\p{N}%$₹€£.'-]/gu, '').replace(/^[.'-]+|[.'-]+$/g, '');
/** Proper-noun-ish and acronym casing: "ai" → "AI", names keep their capital. */
const tidy = (w: string) => /^(ai|ui|ux|api|ceo|usa|uk|tv|pc|ok)$/i.test(w) ? w.toUpperCase() : w;

/** The number a beat says, and its unit: "5 minutes", "$40", "90%". */
export function numberOf(words: string[]): { value: string; unit: string } | null {
  for (let i = 0; i < words.length; i++) {
    const w = clean(words[i]!), lw = w.toLowerCase();
    let value = '';
    if (/\d/.test(w)) value = w;
    else if (NUM_WORDS[lw] !== undefined && !(lw === 'one' && i + 1 < words.length && /^(of|day|thing|more)$/i.test(clean(words[i + 1]!)))) value = String(NUM_WORDS[lw]);
    if (!value) continue;
    const next = clean(words[i + 1] ?? '').toLowerCase();
    const unit = next && !STOP.has(next) && /^[a-z%]+$/.test(next) && !/\d/.test(next) ? next : (next === 'percent' ? '%' : '');
    return { value, unit };
  }
  return null;
}

/** 2 to 4 list items from a list beat: split on commas and "and", each at most 4 words; else its key words. */
export function itemsOf(text: string, keys: string[]): string[] {
  const parts = text.split(/,|;|\band\b|\bthen\b/i).map(s => s.trim().split(/\s+/).filter(w => clean(w)).map(w => tidy(clean(w))).slice(-4).join(' ')).filter(s => s.length > 1);
  if (parts.length >= 2) return parts.slice(0, 4);
  return keys.slice(0, 3);
}

/** Spoken padding a card never sets. */
const PAD = new Set('hello hey hi guys okay ok so well um uh like going gonna because also actually basically literally right yeah thing things stuff kind sort start thank thanks please'.split(' '));
const weak = (w: string) => STOP.has(w.toLowerCase()) || PAD.has(w.toLowerCase());

/**
 * The words a poster or card sets: the line's strongest clause (split on its punctuation), trimmed of the spoken
 * padding at its ends, at most 5 words, a KEY word marked (the hearing's key/number/title words, else the longest).
 * "And this is going to be extremely flabbergasting, and you'll love it." → "extremely FLABBERGASTING".
 */
export function headlineOf(ws: { text: string; role?: string }[]): { text: string; key: boolean }[] {
  // a named thing (a capital mid-sentence, an acronym) is a key word too
  const named = (w: string, i: number) => i > 0 && /^[A-Z][a-z]/.test(w) && !/[.!?]$/.test(ws[i - 1]!.text) && w !== 'I' || /^[A-Z]{2,}$/.test(tidy(clean(w)));
  const all = ws.map((w, i) => ({ i, text: tidy(clean(w.text)), raw: w.text, key: w.role === 'key' || w.role === 'number' || w.role === 'title' || named(clean(w.text), i) })).filter(w => w.text);
  const clauses: (typeof all)[] = [[]];
  for (const w of all) { clauses.at(-1)!.push(w); if (/[,.;:!?]$/.test(w.raw)) clauses.push([]); }
  const trim = (c: typeof all) => { let a = 0, b = c.length; while (a < b && weak(c[a]!.text)) a++; while (b > a && weak(c[b - 1]!.text)) b--; return c.slice(a, b); };
  const scoreOf = (c: typeof all) => c.reduce((s, w) => s + (w.key ? 3 : weak(w.text) ? 0 : 1 + Math.min(1, w.text.length / 10)), 0) - Math.max(0, c.length - 5) * 1.5;
  const ranked = clauses.map(trim).filter(c => c.length).sort((x, y) => scoreOf(y) - scoreOf(x));
  let pick = ranked[0] ?? [];
  if (pick.length > 5) { const k = Math.max(0, pick.findIndex(w => w.key)); const a = Math.max(0, Math.min(k - 1, pick.length - 5)); pick = trim(pick.slice(a, a + 5)); }
  // one word alone reads weak: the next strongest clause joins it, in spoken order
  if (pick.length === 1 && ranked[1]) pick = [...pick, ...ranked[1].slice(0, 4)].sort((x, y) => x.i - y.i);
  const out = pick.map(w => ({ text: w.text, key: w.key }));
  if (!out.some(w => w.key) && out.length) { const c = out.filter(w => !weak(w.text)); (c.length ? c : out).sort((a, b) => b.text.length - a.text.length)[0]!.key = true; }
  return out;
}

/** Card frames on the 9:16 output (x, y, w, h as fractions), the same boxes the player draws. */
export const FRAMES = { full: [0, 0, 1, 1], top_half: [0.04, 0.03, 0.92, 0.44], card_box: [0.12, 0.12, 0.76, 0.34], beside_head: [0.54, 0.16, 0.42, 0.26], top_band: [0.05, 0.035, 0.9, 0.13] } as const;
type Frame = keyof typeof FRAMES;
/** How much of the face a card frame covers (0 = clear). */
export function faceCover(frame: Frame, face: { x0: number; x1: number; y0: number; y1: number } | null): number {
  if (!face || frame === 'full') return 0;
  const [l, t, w, h] = FRAMES[frame], ix = Math.max(0, Math.min(l + w, face.x1) - Math.max(l, face.x0)), iy = Math.max(0, Math.min(t + h, face.y1) - Math.max(t, face.y0));
  return (ix * iy) / Math.max(1e-6, (face.x1 - face.x0) * (face.y1 - face.y0));
}

export interface CastInsertsOpts { src?: InsertSource; gap?: number; max?: number; seed?: number; libs?: InsertLib[] }

/** Cast the edit's inserts from the two libraries, in place (appended to `e.inserts`); returns the trace. */
export async function castInserts(e: Edl, o: CastInsertsOpts = {}): Promise<InsertTrace> {
  const src = o.src ?? await openInserts();
  const dur = e.shots.at(-1)!.t_out, gap = o.gap ?? 2.2, libs = o.libs ?? ['s1', 's4'];
  const max = o.max ?? Math.max(1, Math.min(5, Math.floor(dur / 6)));
  const trace: InsertTrace = { source: src.source, picks: [], skipped: [] };
  const beats = (e.beats ?? []).map((b, i) => ({ b, i })).filter(({ b }) => INSERT_NEEDS[b.tag]);
  // strongest beats first, then by time; a hook at the very start is the speaker's own moment
  beats.sort((x, y) => PRIORITY.indexOf(x.b.tag) - PRIORITY.indexOf(y.b.tag) || x.b.t0 - y.b.t0);
  const taken: { t0: number; t1: number; draw: InsertDraw; lib: InsertLib }[] = (e.inserts ?? []).map(x => ({ t0: x.t0, t1: x.t1, draw: 'title' as InsertDraw, lib: 's4' as InsertLib }));
  const used = new Map<InsertDraw, number>(), usedPics = new Set<string>();
  const libCount = { s1: 0, s4: 0 };
  const out: NonNullable<Edl['inserts']> = [];
  const pending = [...beats];
  while (pending.length) {
    // once one library has an insert, a beat the other library can serve comes next, so an edit shows both
    const missing = libs.filter(l => libCount[l] === 0);
    let at = 0;
    if (out.length && missing.length) { const j = pending.findIndex(({ b }) => missing.some(l => INSERT_NEEDS[b.tag]![l].length)); if (j >= 0) at = j; }
    const { b } = pending.splice(at, 1)[0]!;
    if (out.length >= max) { trace.skipped.push({ t0: b.t0, tag: b.tag, why: 'enough inserts for this length' }); continue; }
    // the beat's window, kept clear of the inserts already placed (trimmed to fit, never shorter than 1.2 s)
    let t0 = r3(Math.max(b.t0 + 0.12, 0.8)), t1 = r3(Math.min(b.t1 + 0.2, t0 + 2.6, dur - 1));
    for (const x of taken) { if (x.t0 >= t0 && t1 > x.t0 - gap) t1 = r3(x.t0 - gap); if (x.t0 < t0 && t0 < x.t1 + gap) t0 = r3(x.t1 + gap); }
    if (t1 - t0 < 1.2) { trace.skipped.push({ t0: b.t0, tag: b.tag, why: taken.length ? 'too close to another insert' : 'beat too short or at the edge' }); continue; }
    const ws = b.word_idx.map(i => e.words[i]).filter(Boolean) as Edl['words'];
    const text = ws.map(w => w.text).join(' ');
    const want = INSERT_NEEDS[b.tag]!;
    // the libraries in turn: the one used less so far first, so two inserts come from both
    const order = [...libs].filter(l => want[l].length).sort((a, c) => libCount[a] - libCount[c] || libs.indexOf(a) - libs.indexOf(c));
    let chosen: { lib: InsertLib; draw: InsertDraw; asset: string; why: string } | null = null;
    const titleRow = async () => (await src.inserts([...want.needs, 'quote', 'claim', 'idea'], 's4')).find(r => S4_TITLE.has(r.impl))?.id ?? FALLBACK.title;
    for (const lib of order) {
      const rows = await src.inserts(want.needs, lib);
      for (const draw of want[lib]) {
        if ((used.get(draw) ?? 0) >= 2 || nextToSame(out, t0, draw)) continue;
        const row = lib === 's1' ? rows.find(r => S1_DRAW[r.impl] === draw) : rows.find(r => (draw === 'title' ? S4_TITLE : S4_POSTER).has(r.impl));
        chosen = { lib, draw, asset: row?.id ?? FALLBACK[draw], why: row ? `${src.source}: serves ${want.needs.join('/')} (${row.hits})` : 'library had no drawable set-up; fallback' };
        break;
      }
      if (chosen) break;
    }
    if (!chosen) { trace.skipped.push({ t0: b.t0, tag: b.tag, why: 'no drawer left (each kind at most twice, never twice in a row)' }); continue; }
    const params: Record<string, unknown> = { lib: chosen.lib, draw: chosen.draw, words: headlineOf(ws) };
    if (chosen.draw === 'stat') { const n = numberOf(ws.map(w => w.text)); if (!n) { trace.skipped.push({ t0: b.t0, tag: b.tag, why: 'number beat with no number' }); continue; } params.value = n.value; params.unit = n.unit; }
    if (chosen.draw === 'checklist') params.items = itemsOf(text, headlineOf(ws).filter(w => w.key).map(w => w.text));
    if (chosen.draw === 'poster') {
      let best: { key: string; s: number; svg: string } | null = null;
      for (const p of pictures()) { if (usedPics.has(p.key) || !p.svg) continue; const s = pictureScore(p, text); if (s > (best?.s ?? 0)) best = { key: p.key, s, svg: p.svg }; }
      if (best && best.s >= 1.4) { params.pic = best.key; params.svg = best.svg; usedPics.add(best.key); }
      else { chosen.draw = 'title'; params.draw = 'title'; chosen.asset = await titleRow(); chosen.why += '; no library picture matched, type-only'; }
      if ((used.get(chosen.draw) ?? 0) >= 2 || nextToSame(out, t0, chosen.draw)) { trace.skipped.push({ t0: b.t0, tag: b.tag, why: 'title card used twice already or next to one' }); continue; }
    }
    // frame: a card where it clears the face, else a full-frame cut-in; posters and titles are full-frame cut-ins
    let frame: Frame = 'full';
    if (chosen.lib === 's1') {
      const face = EDIT.faceOutAt(e as never, (t0 + t1) / 2);
      // a notification lands where a phone shows one, in a band at the top; the other cards in the upper box
      const tries: Frame[] = chosen.draw === 'notify' ? ['top_band', 'beside_head'] : chosen.draw === 'comment' ? ['card_box', 'top_half', 'top_band'] : ['card_box', 'top_half', 'beside_head'];
      frame = tries.find(f => faceCover(f, face) < 0.12) ?? 'full';
    }
    if (frame === 'full') {
      // the opening seconds are the speaker's: a full-frame cut-in waits until 2 s in
      if (t0 < 2) { t0 = 2; if (t1 - t0 < 1.2) { trace.skipped.push({ t0: b.t0, tag: b.tag, why: 'a full-frame cut-in would cover the opening' }); continue; } }
      params.hide_captions = true;
    }
    const ins = { t0, t1, kind: KIND[chosen.draw], frame, label: text.slice(0, 80), asset_ref: chosen.asset, need: want.needs[0], params } as NonNullable<Edl['inserts']>[number];
    out.push(ins); taken.push({ t0, t1, draw: chosen.draw, lib: chosen.lib });
    used.set(chosen.draw, (used.get(chosen.draw) ?? 0) + 1); libCount[chosen.lib]++;
    trace.picks.push({ t0, t1, tag: b.tag, asset: chosen.asset, draw: chosen.draw, frame, why: chosen.why });
  }
  out.sort((a, b) => a.t0 - b.t0);
  e.inserts = [...(e.inserts ?? []), ...out].sort((a, b) => a.t0 - b.t0);
  trace.picks.sort((a, b) => a.t0 - b.t0);
  return trace;
}
const drawOf = (x: NonNullable<Edl['inserts']>[number]) => String((x.params as { draw?: string } | undefined)?.draw ?? '');
/** Would an insert of this drawer at t0 sit right before or after one of the same drawer (in time order)? */
function nextToSame(out: NonNullable<Edl['inserts']>, t0: number, draw: InsertDraw): boolean {
  const before = out.filter(x => x.t0 < t0).sort((a, b) => b.t0 - a.t0)[0], after = out.filter(x => x.t0 > t0).sort((a, b) => a.t0 - b.t0)[0];
  return (!!before && drawOf(before) === draw) || (!!after && drawOf(after) === draw);
}

/** FalkorDB when it answers, else the catalogue. */
export async function openInserts(o: { graph?: boolean } = {}): Promise<InsertSource> {
  if (o.graph === false || process.env.MOOVI_LIBRARY === 'catalogue') return catalogueInserts();
  try { const { health } = await import('@moovi/graph'); if ((await health()).ok) return graphInserts(); } catch { /* down */ }
  return catalogueInserts();
}

/** Does any full-frame insert with hidden captions cover output time t? (the caption layer steps aside) */
export const captionsHiddenAt = (e: { inserts?: { t0: number; t1: number; params?: Record<string, unknown> }[] }, t: number) => (e.inserts ?? []).some(x => x.params?.hide_captions === true && t >= x.t0 && t < x.t1);

export type { EdlBeat };
