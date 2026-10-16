/**
 * The edit preview's logic, shared by Node (tests, the server) and the browser player (inlined with toString, like
 * anatomy/iso.ts). Everything a frame needs is a pure function of the output time `t`: which shot is on, which source
 * second it shows, its zoom, and the caption state. Field names follow the EDL fields in
 * docs/agents/research/R4-edit-styles.md (times are output seconds unless named `src_`), so the player reads D1.1's
 * EDL as soon as it lands; this file holds only the subset the player draws.
 */

export type Role = 'ink' | 'paper' | 'accent' | 'accent2' | 'deep' | 'pop';
export type Palette = Record<Role, string>;

export interface EdlWord { src_t0: number; src_t1: number; text: string; role?: 'connector' | 'key' | 'number' | 'title'; line_id?: number }
/** a framing key; `rot` = roll in degrees, clockwise (the camera layer's roll-left/right, roll-settle, shake) */
export interface EdlZoom { t: number; scale: number; cx: number; cy: number; ease?: 'out' | 'inout' | 'linear' | 'cut'; dur?: number; rot?: number }
export interface EdlShot {
  t_in: number; t_out: number; src_in: number; src_out: number;
  layout?: 'full' | 'fit' | 'split_top' | 'split_bottom' | 'card' | 'pip' | 'grid' | 'full_insert';
  /** 'blur': the same footage, blurred, fills the frame behind a 'fit' shot (a landscape clip in a vertical film) */
  bg?: { mode: 'original' | 'blur' | 'matte_fill' | 'matte_texture'; role?: Role; asset_ref?: string };
  framing?: { scale: number; cx: number; cy: number; rot?: number };
  zoom?: EdlZoom[];
  /** the named camera move this shot plays (camera:<move id>, @moovi/library/camera); its keys are in `zoom` */
  camera?: { asset_ref: string; t?: number; dur?: number; params?: Record<string, unknown>; rule_id?: string };
}
export interface EdlInsert { t0: number; t1: number; kind: string; frame: 'full' | 'top_half' | 'card_box' | 'beside_head'; label?: string; asset_ref?: string }
export interface PlayerEdl {
  version: string; style_id: string; seed?: number;
  source: { file: string; duration: number; w: number; h: number; fps: number };
  output: { w: number; h: number; fps: number };
  palette: Palette;
  caption_style_id: string;
  words: EdlWord[];
  shots: EdlShot[];
  inserts?: EdlInsert[];
  /** face boxes in SOURCE time, fractions of the source frame (the look step); the crop follows them */
  faces?: { src_t: number; x: number; y: number; w: number; h: number }[];
}

/** R8's caption schema, the part the player draws (docs/agents/research/R8-captions.md). */
export interface CaptionStyle {
  id: string; family: string; energy: number;
  font: { family: string; weight: number; case: 'upper' | 'title' | 'as-is' | 'lower'; tracking: number; italic?: boolean };
  size: 'S' | 'M' | 'L' | 'XL' | 'XXL';
  chunk: { mode: 'word' | '2w' | '3w' | 'phrase' | 'line'; maxChars: number; breakOnPause: number };
  look: { fill: Role; stroke?: { px: number; role: Role }; shadow?: 'soft' | 'hard' | 'long' | '3d' | 'glow'; box?: 'pill' | 'block' | 'per-word' | 'underline' | 'chip' };
  highlight: { rule: 'current' | 'keyword' | 'number' | 'none'; treat: 'colour' | 'scale' | 'box' | 'underline' | 'weight'; role?: Role };
  entry: 'pop' | 'stamp' | 'slide-up' | 'fade' | 'blur-in' | 'typewriter' | 'none';
  position: 'lower' | 'center' | 'upper' | 'face-safe' | 'chest';
  /** a second font for key words (the two-tier styles: a small connector over a big key word) */
  key?: { family: string; weight: number; case: 'upper' | 'as-is'; size: 'S' | 'M' | 'L' | 'XL' | 'XXL'; role: Role; italic?: boolean; /** the key word sits on its own line under the connector */ line?: boolean };
}

/** One output-timed word, with where it belongs (its chunk) and whether it is the key of its chunk. */
export interface OutWord { text: string; t0: number; t1: number; role: string; chunk: number }
export interface Chunk { t0: number; t1: number; words: number[] }
export interface WordState { i: number; text: string; on: boolean; hot: boolean; key: boolean; p: number }

/** Self-contained (no outer references): the browser gets `(${editLib.toString()})()`. */
export function editLib() {
  const clamp = (x: number, a = 0, b = 1) => Math.min(b, Math.max(a, x));
  const easeOut = (x: number) => 1 - Math.pow(1 - clamp(x), 3);
  const easeInOut = (x: number) => { const c = clamp(x); return c < 0.5 ? 4 * c * c * c : 1 - Math.pow(-2 * c + 2, 3) / 2; };
  /** a spring-ish overshoot for pops: 0 → 1.08 → 1 */
  const back = (x: number) => { const c = clamp(x), s = 1.9; return 1 + (s + 1) * Math.pow(c - 1, 3) + s * Math.pow(c - 1, 2); };

  /** Shots sorted and checked: contiguous in output time, each range inside the source. Returns the output length. */
  function timeline(e: PlayerEdl): { duration: number; problems: string[] } {
    const problems: string[] = [], s = e.shots;
    if (!s.length) problems.push('no shots');
    for (let i = 0; i < s.length; i++) {
      const g = s[i]!;
      if (g.t_out <= g.t_in) problems.push(`shot ${i}: t_out <= t_in`);
      if (Math.abs((g.t_out - g.t_in) - (g.src_out - g.src_in)) > 0.02) problems.push(`shot ${i}: output and source lengths differ (speed changes are not in v0)`);
      if (g.src_in < 0 || g.src_out > e.source.duration + 0.05) problems.push(`shot ${i}: source range outside the clip`);
      if (i && Math.abs(g.t_in - s[i - 1]!.t_out) > 0.002) problems.push(`shot ${i}: gap or overlap at ${g.t_in}`);
    }
    return { duration: s.length ? s[s.length - 1]!.t_out : 0, problems };
  }

  /** The shot on screen at output time t (the last one holds past the end). */
  function shotAt(e: PlayerEdl, t: number): number {
    const s = e.shots; let lo = 0, hi = s.length - 1;
    if (t <= 0) return 0;
    while (lo < hi) { const m = (lo + hi + 1) >> 1; if (s[m]!.t_in <= t) lo = m; else hi = m - 1; }
    return lo;
  }

  /** The source second shown at output time t. */
  function srcAt(e: PlayerEdl, t: number): number { const g = e.shots[shotAt(e, t)]!; return g.src_in + clamp(t - g.t_in, 0, g.src_out - g.src_in); }

  /** Output time of a source second, or null when that second was cut. */
  function outOf(e: PlayerEdl, src: number): number | null {
    for (const g of e.shots) if (src >= g.src_in - 1e-6 && src < g.src_out) return g.t_in + (src - g.src_in);
    return null;
  }

  /** The framing at output time t: the shot's base framing, then its zoom keys eased in (output-timed); rot = roll, degrees. */
  function framingAt(e: PlayerEdl, t: number): { scale: number; cx: number; cy: number; rot: number } {
    const g = e.shots[shotAt(e, t)]!, base = g.framing ?? { scale: 1, cx: 0.5, cy: 0.42 };
    let cur = { scale: base.scale, cx: base.cx, cy: base.cy, rot: base.rot ?? 0 };
    for (const z of g.zoom ?? []) {
      if (t < z.t) break;
      const d = z.ease === 'cut' ? 0 : (z.dur ?? 0.25), a = d ? (z.ease === 'inout' ? easeInOut : z.ease === 'linear' ? clamp : easeOut)((t - z.t) / d) : 1;
      const r = z.rot ?? cur.rot;
      cur = { scale: cur.scale + (z.scale - cur.scale) * a, cx: cur.cx + (z.cx - cur.cx) * a, cy: cur.cy + (z.cy - cur.cy) * a, rot: cur.rot + (r - cur.rot) * a };
    }
    return cur;
  }

  /** Words kept by the edit, in output time (words inside cut ranges are dropped). */
  function outWords(e: PlayerEdl): Omit<OutWord, 'chunk'>[] {
    const out: Omit<OutWord, 'chunk'>[] = [];
    for (const w of e.words) {
      const a = outOf(e, w.src_t0); if (a === null) continue;
      const b = outOf(e, Math.max(w.src_t0, w.src_t1 - 0.001));
      out.push({ text: w.text, t0: a, t1: b === null ? a + (w.src_t1 - w.src_t0) : b + 0.001, role: w.role ?? (/\d/.test(w.text) ? 'number' : 'connector') });
    }
    return out;
  }

  /** Chunks by the caption style's rule: n words, or a phrase up to maxChars that breaks on a pause or a full stop. */
  function chunk(ws: Omit<OutWord, 'chunk'>[], st: CaptionStyle): { words: OutWord[]; chunks: Chunk[] } {
    const per = st.chunk.mode === 'word' ? 1 : st.chunk.mode === '2w' ? 2 : st.chunk.mode === '3w' ? 3 : 99;
    const maxC = st.chunk.mode === 'line' ? Math.max(st.chunk.maxChars, 32) : st.chunk.maxChars;
    const chunks: Chunk[] = [], words: OutWord[] = [];
    let cur: Chunk | null = null, chars = 0;
    ws.forEach((w, i) => {
      const prev = ws[i - 1], gap = prev ? w.t0 - prev.t1 : 0, stop = !!prev && /[.!?]$/.test(prev.text);
      if (!cur || cur.words.length >= per || chars + w.text.length > maxC || gap > st.chunk.breakOnPause || stop) { cur = { t0: w.t0, t1: w.t1, words: [] }; chunks.push(cur); chars = 0; }
      cur.words.push(i); cur.t1 = w.t1; chars += w.text.length + 1;
      words.push({ ...w, chunk: chunks.length - 1 });
    });
    // a chunk stays up until the next one starts when the gap is short (no flicker between chunks)
    for (let i = 0; i + 1 < chunks.length; i++) if (chunks[i + 1]!.t0 - chunks[i]!.t1 < 0.5) chunks[i]!.t1 = chunks[i + 1]!.t0;
    return { words, chunks };
  }

  /** What the caption layer shows at output time t: the chunk on screen and, per word, whether it has entered and its entry progress. */
  function captionAt(words: OutWord[], chunks: Chunk[], st: CaptionStyle, t: number): { chunk: number; words: WordState[] } | null {
    let k = -1;
    for (let i = 0; i < chunks.length; i++) { if (chunks[i]!.t0 - 0.04 <= t && t < chunks[i]!.t1 + 0.12) { k = i; } if (chunks[i]!.t0 > t) break; }
    if (k < 0) return null;
    const entryDur = st.entry === 'stamp' ? 0.14 : st.entry === 'pop' ? 0.2 : st.entry === 'none' ? 0 : 0.18;
    const all = st.chunk.mode === 'line' || st.entry === 'none';
    const out = chunks[k]!.words.map(i => {
      const w = words[i]!, start = all ? chunks[k]!.t0 : w.t0;
      const isKey = w.role === 'key' || w.role === 'number' || w.role === 'title';
      const hot = st.highlight.rule === 'current' ? t >= w.t0 && t < w.t1 + 0.05
        : st.highlight.rule === 'keyword' ? isKey && t >= w.t0
        : st.highlight.rule === 'number' ? w.role === 'number' && t >= w.t0 : false;
      return { i, text: w.text, on: t >= start - 0.02, hot, key: isKey, p: entryDur ? clamp((t - start) / entryDur) : 1 };
    });
    return { chunk: k, words: out };
  }

  /** Per-word entry transform: [scale, translateY px, opacity, blur px]. */
  function entryOf(st: CaptionStyle, p: number): [number, number, number, number] {
    switch (st.entry) {
      case 'pop': return [0.55 + 0.45 * back(p), 0, clamp(p * 3), 0];
      case 'stamp': return [1.35 - 0.35 * easeOut(p), 0, clamp(p * 4), 0];
      case 'slide-up': return [1, 28 * (1 - easeOut(p)), clamp(p * 2), 0];
      case 'blur-in': return [1, 0, clamp(p * 1.5), 12 * (1 - easeOut(p))];
      case 'fade': case 'typewriter': return [1, 0, clamp(p), 0];
      default: return [1, 0, 1, 0];
    }
  }

  const SIZE = { S: 4.5, M: 6, L: 7.5, XL: 9.5, XXL: 12 } as const;
  const sizePx = (s: keyof typeof SIZE, w: number) => Math.round(SIZE[s] / 100 * w);
  /** Where the caption block's centre sits, as a fraction of frame height (face-safe uses the chest band until faces are in the EDL). */
  const POS = { upper: 0.2, center: 0.46, chest: 0.66, 'face-safe': 0.66, lower: 0.74 } as const;
  const posY = (p: CaptionStyle['position']) => POS[p] ?? 0.66;
  const caseOf = (s: string, c: string) => c === 'upper' ? s.toUpperCase() : c === 'lower' ? s.toLowerCase() : c === 'title' ? s.replace(/\b\p{L}/gu, m => m.toUpperCase()) : s;

  /** The face centre at source second `src` (linear between samples), or null when the EDL has no faces. */
  function faceAt(e: PlayerEdl, src: number): { x: number; y: number } | null {
    const f = e.faces; if (!f || !f.length) return null;
    let k = 0; while (k + 1 < f.length && f[k + 1]!.src_t <= src) k++;
    const a = f[k]!, b = f[k + 1], c = (q: typeof a) => ({ x: q.x + q.w / 2, y: q.y + q.h / 2 });
    if (!b || src <= a.src_t) return c(a);
    const u = clamp((src - a.src_t) / Math.max(1e-6, b.src_t - a.src_t)), A = c(a), B = c(b);
    return { x: A.x + (B.x - A.x) * u, y: A.y + (B.y - A.y) * u };
  }

  /**
   * Where a 'full' (cover) shot crops the source, as CSS object-position percentages: centred on the face when the
   * EDL has faces (the face sits a little above the middle), else centred. A landscape clip in a vertical film shows
   * about a third of its width, so without this the speaker drifts out of frame.
   */
  function cropAt(e: PlayerEdl, t: number): { px: number; py: number } {
    const sa = e.source.w / e.source.h, oa = e.output.w / e.output.h, f = faceAt(e, srcAt(e, t));
    if (!f) return { px: 50, py: 50 };
    const pos = (centre: number, visible: number) => visible >= 1 ? 50 : 100 * clamp((centre - visible / 2) / (1 - visible));
    // visible fraction of the source along each axis under object-fit: cover
    const vw = sa > oa ? oa / sa : 1, vh = sa > oa ? 1 : sa / oa;
    return { px: pos(f.x, vw), py: pos(f.y + 0.08, vh) };
  }

  return { faceAt, cropAt, clamp, easeOut, easeInOut, back, timeline, shotAt, srcAt, outOf, framingAt, outWords, chunk, captionAt, entryOf, sizePx, posY, caseOf };
}

export const EDIT = editLib();
export type EditLib = ReturnType<typeof editLib>;
/** The same functions as source, for the player page (esbuild's __name helper is shimmed, as in anatomy/iso.ts). */
export const EDIT_SRC = `var __name = function (f) { return f; };\nvar EDIT = (${editLib.toString()})();`;
