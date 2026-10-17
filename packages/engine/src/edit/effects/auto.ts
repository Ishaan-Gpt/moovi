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
/** Spoken words -> lines: a line closes at sentence punctuation or a pause over `gap` seconds. */
export function fxLines(words: FxWord[], gap = 0.6): FxLine[] {
  const out: FxLine[] = []; let cur: FxWord[] = [];
  const close = () => { if (cur.length) out.push({ words: cur, text: cur.map(w => w.word).join(' '), t0: cur[0]!.t, t1: cur[cur.length - 1]!.end }); cur = []; };
  words.forEach((w, i) => {
    cur.push(w);
    const next = words[i + 1];
    if (/[.!?]$/.test(w.word) || (next && next.t - w.end > gap)) close();
  });
  close();
  return out;
}

const clean = (s: string) => s.replace(/[^\p{L}\p{N}%$₹€£.'-]/gu, '').replace(/^[.'-]+|[.'-]+$/g, '');
const STOP = new Set("a an the and or but so to of in on at for with is are was were be it this that you your i we our my me us they it's just like really very can will do does did have has had not no yes all its from by as if then than there here what when how who why which".split(' '));
const NUM_WORDS: Record<string, number> = { two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, twenty: 20, thirty: 30, fifty: 50, hundred: 100, thousand: 1000 };
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

const CTA_WORDS = /\b(comment|subscribe|follow|link in (my )?bio|dm me)\b/i;

export interface AutoFx { events: FxEvent[]; picks: { fx: FxId; needs: string[]; line: string; at: number; face?: boolean }[]; missed: string[]; source: 'graph' | 'catalogue' }

/** effects that wrap the speaker's head (the head swirl: cards pass behind the head and in front of it) need a face on screen */
export const HEAD_FX: ReadonlySet<FxId> = new Set<FxId>(['orbit']);

/**
 * Pick the effects a clip's words call for. Every line's needs go to the source; the best effect not used yet (and
 * not the one before it) becomes that line's cue. At most `max` effects, and lines closer than `spacing` seconds to
 * the last pick are left plain (an effect per beat, not per word); the house rules hold on the result.
 */
export async function autoFx(words: FxWord[], o: { src?: FxSource; max?: number; spacing?: number; total?: number; faces?: { src_t: number }[] } = {}): Promise<AutoFx> {
  // the footage side: with face samples (edit/look.ts) the head swirl only goes where a face is on screen, and wins a
  // hook or people line that has one; without samples (the look step did not run) the words alone decide
  const faceIn = (l: FxLine) => !o.faces || o.faces.some(f => f.src_t >= l.t0 - 0.75 && f.src_t <= l.t1 + 0.75);
  const src = o.src ?? catalogueFx(), lines = fxLines(words), max = o.max ?? Math.max(2, Math.min(7, Math.round((o.total ?? (words.at(-1)?.end ?? 0)) / 5)));
  const spacing = o.spacing ?? 2.4, used = new Set<FxId>(), cues: FxCue[] = [], picks: AutoFx['picks'] = [];
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
    cues.push({ fx: best.id, at: c.at, ...(c.params ? { params: c.params } : {}) });
    picks.push({ fx: best.id, needs, line: l.text, at: typeof c.at === 'number' ? c.at : l.t0, ...(o.faces ? { face } : {}) });
    used.add(best.id); last = best.id; lastT = l.t0;
  }
  // one transition between two picked moments, on the longest pause between lines (a whip for fast talk, else a flip)
  const gaps = lines.slice(1).map((l, i) => ({ t: lines[i]!.t1, g: l.t0 - lines[i]!.t1 })).filter(g => g.g > 0.25 && g.t > 1).sort((a, b) => b.g - a.g);
  if (gaps[0] && cues.length >= 2) { const wps = words.length / Math.max(1, words.at(-1)!.end - words[0]!.t); cues.push({ fx: wps > 2.6 ? 'whip-spin' : 'card-flip', at: gaps[0].t }); }
  const placed = placeFx(words, cues, o.total);
  return { events: fitFx(placed.events), picks, missed: placed.missed, source: src.source };
}
