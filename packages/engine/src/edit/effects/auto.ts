import { run, library as L, CRAFT, graphOptional, needGraph } from '@moovi/graph';
import { detectNeeds, listItems } from '../../styles/kit/needs';
import { FX, FX_IDS, isFx, type FxId } from './catalog';
import { FX_NEEDS } from './needs';
export { FX_NEEDS } from './needs';
import { fitFx, placeFx, type FxCue, type FxEvent, type FxWord } from './plan';

/**
 * The effects library picks itself (Vignesh, 2026-10-17 12:30 IST: "so it genuinely chooses whenever it is needed").
 * Each effect SERVES some of the shared needs (styles/kit/needs.ts); a clip's spoken lines are read for their needs
 * (detectNeeds, the same words every style uses), the library graph answers which effects serve them
 * (`assetsServing`, category `effect`, runtime `fx`; the catalogue answers only with MOOVI_GRAPH_OPTIONAL=1), and
 * the best one per line becomes a cue on that line's key word. placeFx + fitFx then hold the house rules (one overlay
 * at a time, no type twice in a row, lengths inside each effect's range). Pure apart from the graph call.
 */

export interface FxServe { id: FxId; hits: number }
export interface FxSource { source: 'graph' | 'catalogue'; serving: (needs: string[]) => Promise<FxServe[]> }

const idOf = (assetId: string): FxId | null => { const x = assetId.replace(/^effect:reel-/, ''); return isFx(x) ? x : null; };

/** The catalogue's own answer (the rows the graph is seeded from): effects ranked by how many of the needs they serve. */
export function catalogueFx(): FxSource {
  return {
    source: 'catalogue',
    serving: async needs => FX_IDS.map(id => ({ id, hits: FX_NEEDS[id].filter(n => needs.includes(n)).length }))
      .filter(r => r.hits > 0).sort((a, b) => b.hits - a.hits || FX_IDS.indexOf(a.id) - FX_IDS.indexOf(b.id)),
  };
}

/** The library graph (FalkorDB): the effect assets that serve these needs. */
export function graphFx(timeoutMs = 4000): FxSource {
  return {
    source: 'graph',
    serving: async needs => (await run<{ id: string; hits: number }>(CRAFT, L.assetsServing, { needs, category: 'effect', runtime: 'fx', shipOnly: true, n: 20 }, timeoutMs))
      .map(r => ({ id: idOf(r.id), hits: r.hits })).filter((r): r is FxServe => !!r.id),
  };
}

/** The graph when it holds the effects (an unseeded graph: the catalogue). Down: the job stops (decision 13). */
export async function openFx(o: { graph?: boolean } = {}): Promise<FxSource> {
  if (o.graph === false || (graphOptional() && process.env.MOOVI_LIBRARY === 'catalogue')) return catalogueFx();
  if (await needGraph('edit effects: the library')) { const g = graphFx(); if ((await g.serving(['number'])).length) return g; }
  return catalogueFx();
}

export interface FxLine { words: FxWord[]; text: string; t0: number; t1: number }
const CLAUSE = new Set(['and', 'because', 'which', 'so', 'but', 'then', 'while', 'where']);
/** Spoken words -> lines: a line closes at sentence punctuation, a pause over `gap` seconds, or a clause once it runs 2.6 s. */
export function fxLines(words: FxWord[], gap = 0.6): FxLine[] {
  const out: FxLine[] = []; let cur: FxWord[] = [];
  const close = () => { if (cur.length) out.push({ words: cur, text: cur.map(w => w.word).join(' '), t0: cur[0]!.t, t1: cur[cur.length - 1]!.end }); cur = []; };
  words.forEach((w, i) => {
    cur.push(w);
    const next = words[i + 1];
    // a long run-on sentence ("...and you will love it because it will edit...") splits at its clauses, so a 10 s
    // sentence gets more than one beat (measured 2026-10-18: one effect for 10 s of Vignesh's selfie); a line with a comma
    // is a list ("first, ..., then ..., and finally ...") and stays whole for the checklist
    const long = cur.length > 3 && w.end - cur[0]!.t >= 2.6 && !!next && !cur.some(x => /,$/.test(x.word)) && CLAUSE.has(next.word.toLowerCase().replace(/[^a-z]/g, ''));
    if (/[.!?]$/.test(w.word) || (next && next.t - w.end > gap) || long) close();
  });
  close();
  return out;
}

const clean = (s: string) => s.replace(/[^\p{L}\p{N}%$₹€£.'-]/gu, '').replace(/^[.'-]+|[.'-]+$/g, '');
const STOP = new Set("a an the and or but so to of in on at for with is are was were be it this that you your i we our my me us they it's just like really very can will do does did have has had not no yes all its from by as if then than there here what when how who why which".split(' '));
const NUM_WORDS: Record<string, number> = { two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, twenty: 20, thirty: 30, fifty: 50, hundred: 100, thousand: 1000 };
/** the giant word of a line: a number first, then a name (capitalised, not the line's first word), then the longest word */
function keyWord(l: FxLine): string {
  const ws = l.words.map(w => clean(w.word)).filter(w => w && !STOP.has(w.toLowerCase()) && w.length <= 12);
  return ws.find(w => /\d/.test(w)) ?? ws.slice(1).find(w => /^[A-Z]/.test(w)) ?? [...ws].sort((a, b) => b.length - a.length)[0] ?? '';
}

/** the word a line's effect lands on, and that effect's words (params) */
function cueFor(fx: FxId, l: FxLine): { at: string | number; params?: Record<string, unknown> } {
  const ws = l.words.map(w => clean(w.word)), key = ws.filter(w => w && !STOP.has(w.toLowerCase())).sort((a, b) => b.length - a.length)[0] ?? ws[0] ?? '';
  const atWord = (w: string) => l.words.find(x => clean(x.word) === w)?.t ?? l.t0;
  switch (fx) {
    case 'stat-counter': {
      const i = ws.findIndex(w => /\d/.test(w) || NUM_WORDS[w.toLowerCase()] !== undefined);
      if (i < 0) break;
      const w = ws[i]!, n = /\d/.test(w) ? Number(w.replace(/[^\d.]/g, '')) : NUM_WORDS[w.toLowerCase()]!;
      const next = (ws[i + 1] ?? '').toLowerCase();
      const pct = /%$/.test(w) || next === 'percent';
      return { at: atWord(w), params: { to: Number.isFinite(n) ? n : 100, prefix: /^[$₹€£]/.test(w) ? w[0] : '', suffix: pct ? '%' : '', label: pct ? '' : (next && !STOP.has(next) ? next : '') } };
    }
    case 'checklist': {
      const items = listItems(l.text).slice(0, 4).map(s => s.split(/\s+/).slice(0, 4).join(' '));
      return { at: l.t0, params: { items: items.length >= 2 ? items : ws.filter(w => w && !STOP.has(w.toLowerCase())).slice(0, 3), title: 'Checklist' } };
    }
    case 'comment-cta': return { at: l.t0, params: { word: (key || 'YES').toUpperCase().slice(0, 12) } };
    case 'giant-word': return { at: atWord(key), params: { word: key.toUpperCase() } };
    case 'strike-tags': return { at: l.t0, params: { tags: listItems(l.text).slice(0, 3).length >= 2 ? listItems(l.text).slice(0, 3) : ws.filter(w => /^[A-Z]/.test(w)).slice(0, 3) } };
    case 'headline-wall': return { at: l.t0, params: { cards: [{ title: l.text.split(/\s+/).slice(0, 6).join(' ') }, ...ws.filter(w => w.length > 4).slice(0, 4).map(w => ({ title: w }))] } };
    default: break;
  }
  return { at: atWord(key) };
}

/** effects that show the word itself, so they land on it even on the hook line */
const WORD_FX: ReadonlySet<FxId> = new Set<FxId>(['stat-counter', 'giant-word']);
/** how late into the first line its effect may start before it is pulled to the line's start, seconds */
const HOOK_LEAD = 0.6;

const CTA_WORDS = /\b(comment|subscribe|follow|link in (my )?bio|dm me)\b/i;

export interface AutoFx { events: FxEvent[]; picks: { fx: FxId; needs: string[]; line: string; at: number; face?: boolean }[]; missed: string[]; source: 'graph' | 'catalogue' }

/** effects that wrap the speaker's head (the head swirl: cards pass behind the head and in front of it) need a face on screen */
export const HEAD_FX: ReadonlySet<FxId> = new Set<FxId>(['orbit']);

/** seconds of plain talking head between two effects that earn one more device */
export const FILL_GAP = 3;
/** the devices a flat stretch may take: each keeps the speaker's face clear (a punch in on the face, the room dimmed
 *  around it, a timeline or a comment box low in the frame) */
export const FILL_SAFE: ReadonlySet<FxId> = new Set<FxId>(['digital-zoom', 'spotlight', 'timeline-ui', 'comment-cta']);

/**
 * Pick the effects a clip's words call for. Every line's needs go to the source; the best effect not used yet (and
 * not the one before it) becomes that line's cue. At most `max` effects (default one per 5 s, 3 to 5: a reel with more reads as noise), and lines closer than `spacing` seconds to
 * the last pick are left plain (an effect per beat, not per word); the house rules hold on the result.
 */
export async function autoFx(words: FxWord[], o: { src?: FxSource; max?: number; spacing?: number; total?: number; faces?: { src_t: number }[] } = {}): Promise<AutoFx> {
  // the footage side: with face samples (edit/look.ts) the head swirl only goes where a face is on screen, and wins a
  // hook or people line that has one; without samples (the look step did not run) the words alone decide
  const faceIn = (l: FxLine) => !o.faces || o.faces.some(f => f.src_t >= l.t0 - 0.75 && f.src_t <= l.t1 + 0.75);
  const src = o.src ?? catalogueFx(), lines = fxLines(words), max = o.max ?? Math.max(3, Math.min(5, Math.round((o.total ?? (words.at(-1)?.end ?? 0)) / 5)));
  const spacing = o.spacing ?? 1.2, used = new Set<FxId>(), cues: FxCue[] = [], picks: AutoFx['picks'] = [];
  let last: FxId | null = null, lastT = -Infinity;
  for (let i = 0; i < lines.length && cues.length < max; i++) {
    const l = lines[i]!;
    if (l.t0 - lastT < spacing) continue;
    const needs: string[] = detectNeeds(l.text, { index: i, count: lines.length });
    if (i === 0 && !needs.includes('hook')) needs.unshift('hook');
    if (CTA_WORDS.test(l.text) && !needs.includes('cta')) needs.push('cta');
    if (!needs.length) continue;
    // a line that says the thing outright wins its effect over a broader match: "comment X" is the comment box, a digit the counter
    const face = faceIn(l), seen = !!o.faces?.length && face;
    const boost = (id: FxId) => (id === 'comment-cta' && CTA_WORDS.test(l.text) ? 3 : 0) + (id === 'stat-counter' && /\d/.test(l.text) ? 1 : 0)
      + (HEAD_FX.has(id) && seen && (needs.includes('hook') || needs.includes('people')) ? 2 : 0);
    const ranked = (await src.serving(needs)).filter(r => !used.has(r.id) && r.id !== last && FX[r.id].kind !== 'transition' && (face || !HEAD_FX.has(r.id)))
      .map(r => ({ ...r, hits: r.hits + boost(r.id) })).sort((a, b) => b.hits - a.hits);
    const best = ranked.find(r => r.id !== 'stat-counter' || /\d|\b(two|three|four|five|six|seven|eight|nine|ten|twenty|thirty|fifty|hundred|thousand)\b/i.test(l.text));
    if (!best) continue;
    const c = cueFor(best.id, l);
    // the hook moves at once: a pro reel shows something in its first 2.7 s (Ishaan's audit, measured 2026-10-18 on the
    // live server: Orbit on "introducing" at 2.5 s left the opening a plain talking head), so the first line's effect
    // starts with the line, not on its longest word; a number or a giant word still waits for its own word
    if (i === 0 && typeof c.at === 'number' && c.at - l.t0 > HOOK_LEAD && !WORD_FX.has(best.id)) c.at = +(l.t0 + 0.15).toFixed(3);
    cues.push({ fx: best.id, at: c.at, ...(c.params ? { params: c.params } : {}) });
    picks.push({ fx: best.id, needs, line: l.text, at: typeof c.at === 'number' ? c.at : l.t0, ...(o.faces ? { face } : {}) });
    used.add(best.id); last = best.id; lastT = l.t0;
  }
  // one giant keyword on the strongest line left plain (a pro edit's word punch): the payoff (last line) first, then a
  // line with a number, a name or a claim; never closer than `spacing` to another pick. It comes on top of `max`: it is
  // the word, not a scene, and the caption steps aside while it is up
  if (!used.has('giant-word') && words.length >= 8) {
    const KEEP = new Set(['claim', 'payoff', 'reveal', 'answer', 'hook', 'stat']);
    const free = lines.map((l, i) => ({ l, i })).filter(({ l }) => l.words.length >= 3 && !picks.some(p => p.line === l.text)
      && picks.every(p => Math.abs(p.at - l.t0) >= spacing && Math.abs(p.at - l.t1) >= spacing));
    const score = ({ l, i }: { l: FxLine; i: number }) => (i === lines.length - 1 ? 3 : 0) + (/\d/.test(l.text) ? 2 : 0)
      + (l.words.slice(1).some(w => /^[A-Z]/.test(clean(w.word))) ? 1 : 0)
      + detectNeeds(l.text, { index: i, count: lines.length }).filter(n => KEEP.has(n)).length;
    const best = free.sort((x, y) => score(y) - score(x))[0];
    if (best) {
      const word = keyWord(best.l);
      if (word) {
        const at = best.l.words.find(x => clean(x.word) === word)?.t ?? best.l.t0;
        cues.push({ fx: 'giant-word', at, params: { word: word.toUpperCase() } });
        picks.push({ fx: 'giant-word', needs: ['payoff'], line: best.l.text, at, ...(o.faces ? { face: faceIn(best.l) } : {}) });
        used.add('giant-word');
      }
    }
  }
  // one transition between two picked moments, on the longest pause between lines (a whip for fast talk, else a flip)
  const gaps = lines.slice(1).map((l, i) => ({ t: lines[i]!.t1, g: l.t0 - lines[i]!.t1 })).filter(g => g.g > 0.25 && g.t > 1).sort((a, b) => b.g - a.g);
  // never under an effect that is up: the render drops a transition there (onedit.ts), and the live run announced a
  // Whip Spin that the finished video did not have (2026-10-18). So the longest pause that is clear of every overlay.
  const up = cues.length >= 2 ? placeFx(words, cues, o.total).events.filter(e => FX[e.fx].kind !== 'transition') : [];
  const gap = gaps.find(g => !up.some(e => g.t > e.t0 - 0.05 && g.t < e.t1 + 0.05));
  if (gap && cues.length >= 2) { const wps = words.length / Math.max(1, words.at(-1)!.end - words[0]!.t); cues.push({ fx: wps > 2.6 ? 'whip-spin' : 'card-flip', at: gap.t }); }
  // a flat stretch gets one more device: r5 (2026-10-18) held a plain talking head from 7.0 to 10.2 s with every pick
  // spent. Where FILL_GAP s or more pass with nothing placed (a transition breaks a stretch too), a word near the middle
  // of the longest such gap takes the library's best unused device that keeps the face clear (FILL_SAFE), else a
  // Digital Zoom, held inside the gap; on top of `max` but never past 5 up, once per clip
  if (cues.length >= 2) {
    // every placed move breaks a stretch, the transition too (r6 first plan: the filler went to a gap the whip already broke)
    const all = placeFx(words, cues, o.total).events.sort((a, b) => a.t0 - b.t0), ups = all.filter(e => FX[e.fx].kind !== 'transition');
    const end = o.total ?? words.at(-1)!.end;
    const holes: { a: number; b: number }[] = [];
    let reach = all[0]?.t1 ?? end;
    for (const e of all.slice(1)) { if (e.t0 - reach >= FILL_GAP) holes.push({ a: reach, b: e.t0 }); reach = Math.max(reach, e.t1); }
    if (end - reach >= FILL_GAP) holes.push({ a: reach, b: end });
    holes.sort((x, y) => (y.b - y.a) - (x.b - x.a));
    // never past 5 effects up in one reel (more reads as noise; the transition is not counted)
    if (ups.length >= 5) holes.length = 0;
    fill: for (const h of holes) {
      // the spoken words inside the gap (clear of its edges), nearest its middle first: a long line can span the gap
      // and own an effect already, so the cue goes on a word, and that word's line gives the needs
      const mid = (h.a + h.b) / 2;
      const inside = words.filter(w => w.t >= h.a + 0.35 && w.t <= h.b - 0.35 - 0.6).sort((x, y) => Math.abs(x.t - mid) - Math.abs(y.t - mid));
      for (const w of inside.slice(0, 6)) {
        const i = lines.findIndex(l => w.t >= l.t0 && w.t <= l.t1), l = lines[i];
        if (!l) continue;
        const needs = detectNeeds(l.text, { index: i, count: lines.length });
        const served = needs.length ? (await src.serving(needs)).map(r => r.id) : [];
        const fx = [...served, 'digital-zoom' as FxId].find(id => FILL_SAFE.has(id) && !used.has(id) && (id !== 'comment-cta' || CTA_WORDS.test(l.text)));
        if (!fx) continue;
        const c = cueFor(fx, l), at = w.t, room = h.b - 0.3 - at, s = FX[fx];
        if (room < s.min) continue;
        cues.push({ fx, at, hold: +Math.min((s.min + s.max) / 3, room).toFixed(3), ...(c.params ? { params: c.params } : {}) });
        picks.push({ fx, needs: needs.length ? needs : ['fill'], line: l.text, at, ...(o.faces ? { face: faceIn(l) } : {}) });
        used.add(fx);
        break fill;
      }
    }
  }
  const placed = placeFx(words, cues, o.total);
  return { events: fitFx(placed.events), picks, missed: placed.missed, source: src.source };
}
