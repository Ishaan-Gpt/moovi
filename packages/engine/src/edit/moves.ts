import type { Edl } from './edl';
import { faceCover, headlineOf, itemsOf, numberOf, FRAMES } from './inserts';
import { EDIT, type PlayerEdl } from './lib';

/**
 * D2.7, the X1 effects (R4: tenfoldmarc's 17, docs/agents/research/R4-edit-styles.md "X1 as the move list") as library
 * moves any edit style can call by number. Each move writes plain EDL (zoom keys, a cut type, or an insert whose
 * drawer is in edit/inserts-draw.ts), so the preview player and the MP4 renderer play it with no extra code path and
 * no style owns it. Nine of the seventeen play on user footage today:
 *
 *   05 digital zoom   a punch-in on the word (zoom keys, the camera layer's punch)
 *   07 checklist      ticked rows that land one by one (Style 1 checklist card)
 *   08 headline wall  a wall of headline cards, the line's own slams in the middle (full-frame cut-in)
 *   09 zoom-through   the picture flies through the cut into the next shot (cut type zoom_through)
 *   10 chart grow     the number counts up over a growing reach line (Style 1 stat card)
 *   13 paper cut      a torn sheet sweeps up across a cut and tears away (cut type paper_tear + its sheet)
 *   14 doodle boil    the key word with a marker ring and arrow, every line boiling on twos
 *   16 cover story    a magazine header strip whose section tabs are the edit's beats, this one lit
 *   17 glass type     the key word on a slab of glass that tips up into place, a sheen across it
 *
 * The other eight (orbit, couch wall, UI world, frame break, phone mockup, pull-back reveal, green screen, vertigo)
 * need the picture itself re-composited (a matte, depth, the shot inside a device) and stay spec rows for now.
 * The catalogue (library/edit-styles.ts X1) names the asset that implements each, so `assetsByX1` finds them.
 */

type Frame = keyof typeof FRAMES;
export interface X1Move { n: string; name: string; layer: 'camera' | 'cut' | 'insert'; asset: string; draw?: string; kind?: NonNullable<Edl['inserts']>[number]['kind']; frames?: Frame[]; seconds: number; tags: string[] }
export const X1_MOVES: Record<string, X1Move> = {
  '05': { n: '05', name: 'digital zoom', layer: 'camera', asset: 'camera:punch-in', seconds: 1.2, tags: ['claim', 'number', 'hook', 'name'] },
  '07': { n: '07', name: 'checklist', layer: 'insert', asset: 'insert:s1-list-steps', draw: 'checklist', kind: 'checklist', frames: ['card_box', 'top_half', 'full'], seconds: 2.4, tags: ['list'] },
  '08': { n: '08', name: 'headline wall', layer: 'insert', asset: 'effect:x1-08-headline-wall', draw: 'wall', kind: 'poster', frames: ['full'], seconds: 2.2, tags: ['claim', 'hook', 'story'] },
  '09': { n: '09', name: 'zoom-through cut', layer: 'cut', asset: 'transition:visual-zoom-through', seconds: 0.32, tags: ['*'] },
  '10': { n: '10', name: 'chart grow', layer: 'insert', asset: 'insert:s1-stat-reveal', draw: 'stat', kind: 'number', frames: ['card_box', 'top_half', 'beside_head', 'full'], seconds: 2.4, tags: ['number'] },
  '13': { n: '13', name: 'paper cut', layer: 'insert', asset: 'effect:x1-13-paper-cut', draw: 'papercut', kind: 'panel', frames: ['full'], seconds: 0.62, tags: ['*'] },
  '14': { n: '14', name: 'doodle boil', layer: 'insert', asset: 'effect:x1-14-doodle-boil', draw: 'doodle', kind: 'card', frames: ['card_box', 'beside_head', 'top_half'], seconds: 1.8, tags: ['claim', 'cta', 'name', 'quote'] },
  '16': { n: '16', name: 'cover story', layer: 'insert', asset: 'effect:x1-16-cover-story', draw: 'cover', kind: 'panel', frames: ['top_band'], seconds: 2.4, tags: ['hook', 'story', 'claim'] },
  '17': { n: '17', name: 'glass type', layer: 'insert', asset: 'effect:x1-17-glass-type', draw: 'glass', kind: 'card', frames: ['card_box', 'top_half', 'beside_head'], seconds: 1.8, tags: ['claim', 'name', 'cta', 'hook'] },
};
export const X1_EDIT = Object.keys(X1_MOVES);

const r3 = (x: number) => +x.toFixed(3);
const beatAt = (e: Edl, t: number) => (e.beats ?? []).find(b => t >= b.t0 - 1e-6 && t < b.t1 + 0.2) ?? null;
const wordsOf = (e: Edl, idx: number[]) => idx.map(i => e.words[i]).filter(Boolean) as Edl['words'];
/** the cut (shot boundary) nearest to t, never the first or last frame */
function cutNear(e: Edl, t: number): number | null {
  const ts = e.shots.slice(0, -1).map(s => s.t_out); if (!ts.length) return null;
  return ts.reduce((a, b) => Math.abs(b - t) < Math.abs(a - t) ? b : a);
}

export interface MoveAt { t: number; dur?: number; gap?: number }
export interface MoveResult { ok: boolean; n: string; why: string; t0?: number; t1?: number }

/**
 * Apply X1 move `n` at output time `at.t`, in place. It refuses (ok false, the reason) rather than break a house rule:
 * one insert at a time with `gap` seconds around it, a card never on the face, nothing past the end.
 */
export function applyMove(e: Edl, n: string, at: MoveAt): MoveResult {
  const m = X1_MOVES[n]; if (!m) return { ok: false, n, why: `X1 ${n} does not play on footage yet` };
  const dur = e.shots.at(-1)!.t_out, gap = at.gap ?? 1.5, len = at.dur ?? m.seconds;
  if (m.layer === 'camera') {
    const si = EDIT.shotAt(e as unknown as PlayerEdl, at.t), s = e.shots[si]!, t0 = r3(Math.max(s.t_in, at.t)), t1 = r3(Math.min(s.t_out, t0 + len));
    if (t1 - t0 < 0.3) return { ok: false, n, why: 'no room in the shot for a punch-in' };
    const f = s.framing ?? { scale: 1, cx: 0.5, cy: 0.42 }, keep = (s.zoom ?? []).filter(z => z.t < t0 - 0.05 || z.t > t1 + 0.05);
    s.zoom = [...keep, { t: t0, scale: r3(f.scale * 1.25), cx: f.cx, cy: f.cy, ease: 'cut' as const, rule_id: 'x1.05' }, ...(t1 < s.t_out - 0.05 ? [{ t: t1, scale: f.scale, cx: f.cx, cy: f.cy, ease: 'cut' as const, rule_id: 'x1.05' }] : [])].sort((a, b) => a.t - b.t);
    return { ok: true, n, why: `punch-in ${t0}..${t1}`, t0, t1 };
  }
  if (m.layer === 'cut') {
    const c = cutNear(e, at.t); if (c === null) return { ok: false, n, why: 'the edit has no cut' };
    const cuts = (e.cuts ?? []).filter(x => Math.abs(x.t - c) > 0.02);
    e.cuts = [...cuts, { t: c, type: 'zoom_through' as const, dur: len, trigger: 'beat' as const, rule_id: 'x1.09' }].sort((a, b) => a.t - b.t);
    return { ok: true, n, why: `zoom-through at the cut ${c}`, t0: c, t1: c };
  }
  // an insert: where, how long, and that nothing else is on screen then
  let t0 = at.t, t1 = at.t + len;
  if (n === '13') { const c = cutNear(e, at.t); if (c === null) return { ok: false, n, why: 'the edit has no cut' }; t0 = c - len / 2; t1 = c + len / 2; }
  t0 = r3(Math.max(0.3, t0)); t1 = r3(Math.min(dur - 0.3, t1));
  if (t1 - t0 < Math.min(0.6, len)) return { ok: false, n, why: 'too close to the start or the end' };
  const clash = (e.inserts ?? []).find(x => t0 < x.t1 + gap && t1 > x.t0 - gap);
  if (clash) return { ok: false, n, why: `another insert is up at ${clash.t0}..${clash.t1}` };
  const face = EDIT.faceOutAt(e as unknown as PlayerEdl, (t0 + t1) / 2);
  const frame = (m.frames ?? ['full']).find(f => faceCover(f, face) < 0.12);
  if (!frame) return { ok: false, n, why: 'every frame this move uses would cover the face' };
  const b = beatAt(e, t0), ws = b ? wordsOf(e, b.word_idx) : [];
  const params: Record<string, unknown> = { draw: m.draw, x1: n, words: headlineOf(ws) };
  if (n === '10') { const v = numberOf(ws.map(w => w.text)); if (!v) return { ok: false, n, why: 'no number in the line' }; params.value = v.value; params.unit = v.unit; }
  if (n === '07') { const items = itemsOf(ws.map(w => w.text).join(' '), headlineOf(ws).filter(w => w.key).map(w => w.text)); if (items.length < 2) return { ok: false, n, why: 'not a list' }; params.items = items; }
  if (n === '08' || n === '16') {
    const beats = e.beats ?? [], keyOf = (bb: NonNullable<Edl['beats']>[number]) => { const h = headlineOf(wordsOf(e, bb.word_idx)); return (h.find(w => w.key) ?? h[0])?.text ?? bb.tag; };
    if (n === '08') params.others = beats.filter(x => x !== b).map(x => headlineOf(wordsOf(e, x.word_idx)).slice(0, 3).map(w => w.text).join(' ')).filter(Boolean);
    else {
      // the masthead is the edit's first named thing (a capital mid-sentence or an acronym), else "The story"
      const named = e.words.find((w, i) => i > 0 && (/^[A-Z][a-z]{2,}/.test(w.text) && !/[.!?]$/.test(e.words[i - 1]!.text) || /^[A-Z]{2,}\W*$/.test(w.text)));
      const withKey = beats.filter(x => headlineOf(wordsOf(e, x.word_idx)).length).slice(0, 4);
      params.tabs = withKey.map(keyOf); params.tab = Math.max(0, withKey.findIndex(x => x === b));
      params.masthead = named ? named.text.replace(/[^\p{L}\p{N}]/gu, '') : 'The story';
    }
  }
  if (frame === 'full' && n !== '13') params.hide_captions = true;
  const ins = { t0, t1, kind: m.kind!, frame, asset_ref: m.asset, need: `x1-${n}`, rule_id: `x1.${n}`, ...(ws.length ? { label: ws.map(w => w.text).join(' ').slice(0, 80) } : {}), params } as NonNullable<Edl['inserts']>[number];
  e.inserts = [...(e.inserts ?? []), ins].sort((a, c) => a.t0 - c.t0);
  if (n === '13') { const c = r3((t0 + t1) / 2); e.cuts = [...(e.cuts ?? []).filter(x => Math.abs(x.t - c) > 0.02), { t: c, type: 'paper_tear' as const, dur: len, trigger: 'beat' as const, rule_id: 'x1.13' }].sort((a, z) => a.t - z.t); }
  return { ok: true, n, why: `${m.name} ${frame} ${t0}..${t1}`, t0, t1 };
}

/**
 * A style (or any caller) asks for X1 moves by number; each lands on the first beat it suits where `applyMove` takes
 * it (its tags; '*' = any beat change), in the asked order, at most once. Deterministic.
 */
export function castMoves(e: Edl, want: string[], o: { gap?: number } = {}): MoveResult[] {
  const out: MoveResult[] = [], beats = e.beats ?? [];
  for (const n of want) {
    const m = X1_MOVES[n]; if (!m) { out.push({ ok: false, n, why: 'not playable on footage yet' }); continue; }
    let r: MoveResult | null = null;
    const fits = beats.filter(b => m.tags.includes('*') || m.tags.includes(b.tag));
    for (const b of fits) {
      // a beat-change move sits on the cut that opens the beat; the rest come in just after the beat starts
      const t = m.tags.includes('*') ? b.t0 : Math.max(b.t0 + 0.15, n === '16' ? 0.9 : 0.6);
      const tried = applyMove(e, n, { t, ...(o.gap !== undefined ? { gap: o.gap } : {}) });
      if (tried.ok) { r = tried; break; }
      r = tried;
    }
    out.push(r ?? { ok: false, n, why: 'no beat for this move' });
  }
  return out;
}
