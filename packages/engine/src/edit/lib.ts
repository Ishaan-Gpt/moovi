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
export interface EdlZoom { t: number; scale: number; cx: number; cy: number; ease?: 'out' | 'inout' | 'linear' | 'cut'; dur?: number }
export interface EdlShot {
  t_in: number; t_out: number; src_in: number; src_out: number;
  layout?: 'full' | 'fit' | 'split_top' | 'split_bottom' | 'card' | 'pip' | 'grid' | 'full_insert';
  /** 'blur': the same footage, blurred, fills the frame behind a 'fit' shot (a landscape clip in a vertical film) */
  bg?: { mode: 'original' | 'blur' | 'matte_fill' | 'matte_texture'; role?: Role; asset_ref?: string };
  framing?: { scale: number; cx: number; cy: number };
  zoom?: EdlZoom[];
}
export interface EdlInsert { t0: number; t1: number; kind: string; frame: 'full' | 'top_half' | 'card_box' | 'beside_head' | 'top_band'; label?: string; asset_ref?: string; params?: Record<string, unknown> }
export interface PlayerEdl {
  version: string; style_id: string; seed?: number;
  source: { file: string; duration: number; w: number; h: number; fps: number };
  output: { w: number; h: number; fps: number };
  palette: Palette;
  caption_style_id: string;
  words: EdlWord[];
  shots: EdlShot[];
  inserts?: EdlInsert[];
  /** cuts with a transition the player draws (whip, zoom_through, blur_zoom, slide, flash); others are hard cuts */
  cuts?: { t: number; type: string; dur?: number }[];
  /** one-shot sounds in output time (the library's sfx assets, cast by edit/cast.ts) */
  sfx?: { t: number; asset_ref: string; event: string; gain_db?: number; file?: string }[];
  /** face boxes in SOURCE time, fractions of the source frame (the look step); the crop follows them */
  faces?: { src_t: number; x: number; y: number; w: number; h: number }[];
  /** the D2.2 style layer's notes (edit/styles.ts); caption_hide: outWords indexes a card already shows (the caption drops them) */
  style_laws?: { caption_hide?: number[] } & Record<string, unknown>;
}

/** R8's caption schema, the part the player draws (docs/agents/research/R8-captions.md). */
export interface CaptionStyle {
  id: string; family: string; energy: number;
  font: { family: string; weight: number; case: 'upper' | 'title' | 'as-is' | 'lower'; tracking: number; italic?: boolean };
  size: 'S' | 'M' | 'L' | 'XL' | 'XXL';
  /** minWords/maxWords (D2.2 Atlas): a chunk shorter than minWords joins a neighbour (same sentence first, gap at most 1 s) while the
   * pair stays inside maxWords words and maxChars + 8 characters, so no lone small word stands as a caption */
  chunk: { mode: 'word' | '2w' | '3w' | 'phrase' | 'line'; maxChars: number; breakOnPause: number; minWords?: number; maxWords?: number; /** the chunk's words enter together (the key word still lights when spoken) */ together?: boolean };
  look: { fill: Role; stroke?: { px: number; role: Role }; shadow?: 'soft' | 'hard' | 'long' | '3d' | 'glow' | 'lift'; box?: 'pill' | 'block' | 'per-word' | 'underline' | 'chip' };
  highlight: { rule: 'current' | 'keyword' | 'number' | 'none'; treat: 'colour' | 'scale' | 'box' | 'underline' | 'weight'; role?: Role };
  entry: 'pop' | 'stamp' | 'slide-up' | 'fade' | 'blur-in' | 'typewriter' | 'kinetic' | 'none';
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

  /** The framing at output time t: the shot's base framing, then its zoom keys eased in (output-timed). */
  function framingAt(e: PlayerEdl, t: number): { scale: number; cx: number; cy: number } {
    const g = e.shots[shotAt(e, t)]!, base = g.framing ?? { scale: 1, cx: 0.5, cy: 0.42 };
    let cur = { ...base };
    for (const z of g.zoom ?? []) {
      if (t < z.t) break;
      const d = z.ease === 'cut' ? 0 : (z.dur ?? 0.25), a = d ? (z.ease === 'inout' ? easeInOut : z.ease === 'linear' ? clamp : easeOut)((t - z.t) / d) : 1;
      cur = { scale: cur.scale + (z.scale - cur.scale) * a, cx: cur.cx + (z.cx - cur.cx) * a, cy: cur.cy + (z.cy - cur.cy) * a };
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
    // no lone short chunk: it joins its neighbour (same sentence first, then across a full stop), inside maxWords and maxChars + 8
    const minW = st.chunk.minWords ?? 1;
    if (minW > 1) {
      const maxW = Math.max(minW, st.chunk.maxWords ?? Math.max(per === 99 ? 4 : per, minW)), maxCh = maxC + 8;
      const len = (c: Chunk) => c.words.reduce((n, i) => n + ws[i]!.text.length + 1, 0);
      const ends = (c: Chunk) => /[.!?]$/.test(ws[c.words[c.words.length - 1]!]!.text);
      for (const across of [false, true]) {
        for (let k = 0; k < chunks.length; k++) {
          const c = chunks[k]!; if (c.words.length >= minW) continue;
          const prev = chunks[k - 1], next = chunks[k + 1];
          const gN = next ? next.t0 - c.t1 : 9, gP = prev ? c.t0 - prev.t1 : 9;
          const okN = !!next && next.words.length + c.words.length <= maxW && len(next) + len(c) <= maxCh && gN <= 1 && (across || !ends(c));
          const okP = !!prev && prev.words.length + c.words.length <= maxW && len(prev) + len(c) <= maxCh && gP <= 1 && (across || !ends(prev));
          if (okN && (!okP || gN <= gP)) { next!.words = [...c.words, ...next!.words]; next!.t0 = c.t0; chunks.splice(k, 1); k--; }
          else if (okP) { prev!.words.push(...c.words); prev!.t1 = c.t1; chunks.splice(k, 1); k--; }
        }
      }
      chunks.forEach((c, j) => { for (const i of c.words) words[i]!.chunk = j; });
    }
    // a chunk stays up until the next one starts when the gap is short (no flicker between chunks)
    for (let i = 0; i + 1 < chunks.length; i++) if (chunks[i + 1]!.t0 - chunks[i]!.t1 < 0.5) chunks[i]!.t1 = chunks[i + 1]!.t0;
    return { words, chunks };
  }

  /** What the caption layer shows at output time t: the chunk on screen and, per word, whether it has entered and its entry progress. */
  function captionAt(words: OutWord[], chunks: Chunk[], st: CaptionStyle, t: number): { chunk: number; words: WordState[] } | null {
    let k = -1;
    for (let i = 0; i < chunks.length; i++) { if (chunks[i]!.t0 - 0.04 <= t && t < chunks[i]!.t1 + 0.12) { k = i; } if (chunks[i]!.t0 > t) break; }
    if (k < 0) return null;
    const entryDur = st.entry === 'stamp' ? 0.14 : st.entry === 'pop' ? 0.2 : st.entry === 'kinetic' ? 0.24 : st.entry === 'none' ? 0 : 0.18;
    const all = st.chunk.mode === 'line' || st.entry === 'none' || !!st.chunk.together;
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
      // kinetic (clip-moment v3, after the library's effect:word-slam): each word springs up from below, out of a blur
      case 'kinetic': return [0.62 + 0.38 * back(p), 34 * (1 - easeOut(p)), clamp(p * 3), 9 * (1 - easeOut(p))];
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
  /** an acronym keeps its capitals in a lower or title cased caption ("AI", not "ai"): a known one, or one the transcript wrote in capitals */
  const ACRONYMS = /^(ai|api|ui|ux|ceo|cto|cfo|gpu|cpu|usa|uk|eu|tv|pc|ios|sdk|llm|nba|nfl|ipl|url|faq|diy|nasa|ev|ipo|seo|pdf|vr)$/;
  const isAcronym = (w: string) => { const b = w.replace(/[^\p{L}]/gu, ''); return b.length >= 2 && (ACRONYMS.test(b.toLowerCase()) || (b.length <= 5 && b === b.toUpperCase() && b !== b.toLowerCase())); };
  const keepAcronyms = (s: string, f: (p: string) => string) => s.split(/(\s+)/).map(p => isAcronym(p) ? p.toUpperCase() : f(p)).join('');
  /** `proper`: a named thing (role 'title': Ishaan, Moovi) keeps its capital in a lower cased caption or card */
  const caseOf = (s: string, c: string, proper = false) => c === 'upper' ? s.toUpperCase() : c === 'lower' ? keepAcronyms(s, p => proper ? p.charAt(0).toUpperCase() + p.slice(1).toLowerCase() : p.toLowerCase()) : c === 'title' ? keepAcronyms(s, p => p.replace(/\b\p{L}/gu, m => m.toUpperCase())) : s;

  /** The words the caption layer draws: the edit's words less those a style card already shows (style_laws.caption_hide). */
  function captionWords(e: PlayerEdl): Omit<OutWord, 'chunk'>[] {
    const hide = new Set(e.style_laws?.caption_hide ?? []);
    return outWords(e).filter((_, i) => !hide.has(i));
  }

  /** The face centre at source second `src` (linear between samples), or null when the EDL has no faces. */
  function faceAt(e: PlayerEdl, src: number): { x: number; y: number } | null {
    const f = e.faces; if (!f || !f.length) return null;
    let k = 0; while (k + 1 < f.length && f[k + 1]!.src_t <= src) k++;
    const a = f[k]!, b = f[k + 1], c = (q: typeof a) => ({ x: q.x + q.w / 2, y: q.y + q.h / 2 });
    if (!b || src <= a.src_t) return c(a);
    const u = clamp((src - a.src_t) / Math.max(1e-6, b.src_t - a.src_t)), A = c(a), B = c(b);
    return { x: A.x + (B.x - A.x) * u, y: A.y + (B.y - A.y) * u };
  }

  /** The face box at source second `src` (linear between samples, source fractions), or null when the EDL has no faces. */
  function faceBoxAt(e: PlayerEdl, src: number): { x: number; y: number; w: number; h: number } | null {
    const f = e.faces; if (!f || !f.length) return null;
    let k = 0; while (k + 1 < f.length && f[k + 1]!.src_t <= src) k++;
    const a = f[k]!, b = f[k + 1];
    if (!b || src <= a.src_t) return { x: a.x, y: a.y, w: a.w, h: a.h };
    const u = clamp((src - a.src_t) / Math.max(1e-6, b.src_t - a.src_t)), m = (p: number, q: number) => p + (q - p) * u;
    return { x: m(a.x, b.x), y: m(a.y, b.y), w: m(a.w, b.w), h: m(a.h, b.h) };
  }

  /**
   * Where the face sits in the OUTPUT frame over the whole shot at output time t (fractions): the source face box
   * through the shot's crop (object-fit cover on cropAt) and its framing scale about the framing centre, sampled at
   * five points of the shot and joined, so the caption decision holds for the shot. Null for a 'fit' shot or no faces.
   */
  function faceOutAt(e: PlayerEdl, t: number): { y0: number; y1: number; x0: number; x1: number } | null {
    const g = e.shots[shotAt(e, t)]!;
    if (!e.faces || !e.faces.length || g.layout === 'fit') return null;
    const sa = e.source.w / e.source.h, oa = e.output.w / e.output.h, vw = sa > oa ? oa / sa : 1, vh = sa > oa ? 1 : sa / oa;
    let box: { y0: number; y1: number; x0: number; x1: number } | null = null;
    for (let i = 0; i < 5; i++) {
      const tt = g.t_in + (g.t_out - g.t_in) * (i / 4) * 0.999, f = faceBoxAt(e, srcAt(e, tt)); if (!f) continue;
      const c = cropAt(e, tt), fr = framingAt(e, tt), offX = (1 - vw) * c.px / 100, offY = (1 - vh) * c.py / 100;
      const ox = (x: number) => fr.cx + ((x - offX) / vw - fr.cx) * fr.scale, oy = (y: number) => fr.cy + ((y - offY) / vh - fr.cy) * fr.scale;
      const b = { x0: ox(f.x), x1: ox(f.x + f.w), y0: oy(f.y), y1: oy(f.y + f.h) };
      box = box ? { x0: Math.min(box.x0, b.x0), x1: Math.max(box.x1, b.x1), y0: Math.min(box.y0, b.y0), y1: Math.max(box.y1, b.y1) } : b;
    }
    return box && box.x1 > 0 && box.x0 < 1 && box.y1 > 0 && box.y0 < 1 ? box : null;
  }

  /**
   * The caption block's centre (fraction of frame height) at output time t, kept off the face: the style's own
   * `base` when the block (half height `half`) clears the face in this shot, else just below or above the face,
   * whichever is nearer `base` and stays out of the platform zones (top 8%, bottom 15%); with neither free, the one
   * that covers the least face. R9 asks for captions off the face in 98% of frames.
   */
  function capYAt(e: PlayerEdl, t: number, base: number, half: number): number {
    const f = faceOutAt(e, t), pad = 0.012; if (!f) return base;
    const lo = 0.08 + half + pad, hi = 0.85 - half - pad;
    const cover = (y: number) => Math.max(0, Math.min(y + half, f.y1) - Math.max(y - half, f.y0));
    if (cover(base) <= 0) return base;
    const opts = [f.y1 + half + pad, f.y0 - half - pad].filter(y => y >= lo && y <= hi).sort((a, b) => Math.abs(a - base) - Math.abs(b - base));
    if (opts.length) return opts[0]!;
    const clamped = [lo, hi, base].sort((a, b) => cover(a) - cover(b) || Math.abs(a - base) - Math.abs(b - base));
    return clamped[0]!;
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

  /**
   * The transition on screen at output time t, centred on its cut: `dx`/`dy` move the picture (fractions of the frame,
   * out one way before the cut and in from the other side after it), `zoom` multiplies the framing, `blur` is the
   * motion blur in output pixels at 1080 wide, `flash` the white over the frame (0..1). All 0 (zoom 1) between cuts.
   */
  function transitionAt(e: PlayerEdl, t: number): { dx: number; dy: number; zoom: number; blur: number; flash: number } {
    const none = { dx: 0, dy: 0, zoom: 1, blur: 0, flash: 0 };
    for (const c of e.cuts ?? []) {
      const d = c.dur ?? 0.24, h = d / 2;
      if (c.type === 'hard' || c.type === 'jump' || c.type === 'punch' || t < c.t - h || t >= c.t + h) continue;
      const before = t < c.t, u = before ? clamp((t - (c.t - h)) / h) : clamp(((c.t + h) - t) / h); // 0 at the edges, 1 at the cut
      const k = u * u;
      if (c.type === 'whip') return { ...none, dx: (before ? -1 : 1) * 0.42 * k, blur: 60 * k };
      if (c.type === 'slide') return { ...none, dy: (before ? -1 : 1) * 0.3 * k, blur: 30 * k };
      if (c.type === 'zoom_through') return { ...none, zoom: 1 + (before ? 0.45 : 0.3) * k, blur: 24 * k };
      if (c.type === 'blur_zoom') return { ...none, zoom: 1 + 0.16 * k, blur: 18 * k };
      if (c.type === 'flash') return { ...none, flash: Math.min(1, 1.2 * k) };
    }
    return none;
  }

  /**
   * The captionseasy look's own props (the EDL's caption_look.style, Ishaan's captionseasy npm) as the player draws
   * them over the nearest of the 11 player styles: font (mapped to the fonts the player ships), weight, italic, case,
   * fill, the active word's treatment, stroke and the line's height on the frame. Sizes stay the player style's.
   */
  function lookProps(s: any, w: number): { family: string; weight: number; italic: boolean; casing: string; fill: string | null; hi: { treat: 'box' | 'colour' | 'scale'; color: string | null; bg: string | null }; stroke: { px: number; color: string } | null; shadow: boolean; y: number | null } | null {
    if (!s || typeof s !== 'object') return null;
    const f = String(s.fontId || s.fontFamily || '');
    const family = /anton|bebas|oswald|league|impact|condensed/i.test(f) ? 'Anton' : /mono|code|courier/i.test(f) ? 'JetBrains Mono'
      : /serif|playfair|garamond|lora|merriweather|georgia|instrument/i.test(f) && !/sans/i.test(f) ? 'Instrument Serif'
      : /archivo/i.test(f) ? 'Archivo' : /geist/i.test(f) ? 'Geist' : /tight/i.test(f) ? 'Inter Tight' : 'Inter';
    const a = s.active || {}, eff = String(a.effect || '');
    const hi: { treat: 'box' | 'colour' | 'scale'; color: string | null; bg: string | null } = eff === 'box' || eff === 'pill' || eff === 'highlight'
      ? { treat: 'box', color: a.color || null, bg: a.boxColor || a.background || null }
      : eff === 'scale' || eff === 'pop' ? { treat: 'scale', color: a.color || null, bg: null } : { treat: 'colour', color: a.color || null, bg: null };
    const st = s.stroke && s.stroke.enabled && s.stroke.width > 0 ? { px: Math.max(1, Math.round(s.stroke.width * w / 1080 * 10) / 10), color: String(s.stroke.color || '#000') } : null;
    const y = s.position && typeof s.position.y === 'number' ? clamp(s.position.y, 0.12, 0.9) : null;
    return { family, weight: family === 'Anton' || family === 'Instrument Serif' ? 400 : Math.round(clamp(Number(s.fontWeight) || 800, 100, 900) / 100) * 100,
      italic: s.fontStyle === 'italic' || family === 'Instrument Serif', casing: s.casing === 'upper' || s.casing === 'lower' ? s.casing : 'none',
      fill: s.fill && s.fill.type === 'solid' && s.fill.color ? String(s.fill.color) : null, hi, stroke: st, shadow: Array.isArray(s.shadows) && s.shadows.length > 0, y };
  }

  return { lookProps, transitionAt, faceAt, faceBoxAt, faceOutAt, capYAt, cropAt, clamp, easeOut, easeInOut, back, timeline, shotAt, srcAt, outOf, framingAt, outWords, captionWords, chunk, captionAt, entryOf, sizePx, posY, caseOf, isAcronym };
}

export const EDIT = editLib();
export type EditLib = ReturnType<typeof editLib>;
/** The same functions as source, for the player page (esbuild's __name helper is shimmed, as in anatomy/iso.ts). */
export const EDIT_SRC = `var __name = function (f) { return f; };\nvar EDIT = (${editLib.toString()})();`;
