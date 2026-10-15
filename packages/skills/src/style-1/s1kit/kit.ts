/**
 * Exact TypeScript port of MotionEasy `styles/tools/s1kit.py` (the `Kit` class, every element helper and preset, `finish`).
 * Same inputs -> the same timeline JSON and events JSON as the Python, number for number, key order included.
 *
 * Call convention mirrors Python: positional params in the Python order, then ONE optional options object for keyword
 * arguments (any named positional may also be given in it): `k.lines('hook', [...], { at: 'seo', top: 430, visuals })`.
 * Instead of reading files from a ROOT the kit takes its inputs explicitly (brand JSON, words); `finish()` returns
 * `{ timeline, spec, events }` instead of writing files.
 */
import { get, has, isNone, isPlain, matchingBlocks, or, pop, pyLen, pyRound, pyRoundN, pySplit, pyStrip, truthy, type Obj } from './py';

export type { Obj };

export interface Word { word: string; t: number; end: number; [k: string]: any }
export interface BrandJson { ink?: string; accent?: string; stage?: string; font?: string; glows?: any; grid?: string; burst?: string; accent_deep?: string; [k: string]: any }
export interface KitInit {
  /** video id, e.g. "ce-11-hormozi-style" (Python: Path(V).name) */
  video: string;
  /** video dir, e.g. "styles/style-1/videos/ce-11-hormozi-style/" (Python: V) */
  videoDir?: string;
  brand: BrandJson;
  words: Word[];
  alias?: Record<string, string>;
  logo?: string | null;
}
export interface FinishResult {
  timeline: Obj;
  spec: Obj;
  events: Obj[];
  info: { scenes: [number, number][]; frames: number; events: number; matched: number; tokens: number };
}
/** sfx tuple: [scene name, when, event, sound?] */
export type SfxItem = any[];

export const RAYS: number[][] = [[12, .98, .2], [48, .85, .14], [81, .9, .19], [122, .88, .15], [145, .92, .16], [174, .94, .15],
  [190, .9, .22], [225, .95, .12], [254, .95, .16], [276, .9, .14], [309, .94, .11], [342, .94, .17]];

export const norm = (w: string): string => w.toLowerCase().replace(/[^a-z0-9]/g, '');

/** Explicit keyword-argument wrapper (used by the plan runner so kwargs that name positionals bind correctly). */
export class KW { constructor(public v: Obj) {} }

interface Sig { names: string[]; req: number; kw: boolean }
const sig = (req: number, kw: boolean, ...names: string[]): Sig => ({ names, req, kw });
/** Python parameter lists (positional-or-keyword params in order, `req` = how many have no default). */
export const SIG: Record<string, Sig> = {
  F: sig(1, false, 'word', 'after'),
  ln: sig(3, true, 'text', 'top', 'width', 'weight'),
  accent: sig(3, true, 'text', 'top', 'width'),
  serif: sig(3, true, 'text', 'top', 'width', 'gradient'),
  card: sig(5, true, 'src', 'cx', 'cy', 'w', 'h', 'at'),
  look: sig(3, true, 'src', 'cx', 'cy', 'w', 'at'),
  phone: sig(3, true, 'src', 'cx', 'cy', 'w', 'at'),
  icon: sig(3, true, 'src', 'cx', 'cy', 'at', 'w'),
  mark: sig(3, true, 'cx', 'cy', 'w', 'at', 'src'),
  burst: sig(3, false, 'cx', 'cy', 'd', 'at', 'color', 'spin'),
  win: sig(3, false, 'x', 'y', 'w'),
  at_px: sig(3, false, 'W', 'X', 'Y', 'cw'),
  browser: sig(2, true, 'src', 'W', 'at'),
  mark_hl: sig(5, false, 'x', 'y', 'w', 'h', 'at', 'color'),
  lines: sig(2, false, 'name', 'lines', 'visuals', 'at', 'top', 'gap', 'enter', 'push'),
  list_left: sig(2, false, 'name', 'lines', 'visuals', 'at', 'top', 'gap', 'x', 'enter'),
  stack_slam: sig(2, false, 'name', 'lines', 'slam_last', 'visuals', 'at', 'top', 'gap'),
  logo_land: sig(2, false, 'name', 'word', 'title', 'wordmark', 'at', 'size'),
  icon_ring: sig(4, false, 'name', 'icons', 'words', 'title', 'footer', 'at', 'center_mark'),
  logo_grid: sig(2, false, 'src_list', 'word', 'top'),
  trio: sig(3, false, 'name', 'clips', 'words', 'title', 'at'),
  grid4: sig(4, false, 'name', 'clips', 'title', 'at'),
  export_proof: sig(4, false, 'name', 'clip', 'w_export', 'w_proof', 'title', 'at'),
  reveal: sig(8, false, 'name', 'clip', 'capture', 'rect_px', 'title_lines', 'reveal_line', 'pull_word', 'reveal_word'),
  cta_comment: sig(3, false, 'name', 'keyword', 'bubble', 'title', 'at', 'phone_clip'),
  cta_pill: sig(4, false, 'name', 'lines', 'pill', 'pill_word', 'at', 'wordmark'),
  finish: sig(0, false, 'corners', 'glows', 'sparkles', 'key_words'),
};

/** Bind (positional..., kwargs) to the Python signature. Returns positional slots (undefined = default) + remaining **kw. */
function bind(name: string, a: any[]): { p: any[]; kw: Obj } {
  const s = SIG[name]!;
  let args = a;
  let kw: Obj = {};
  const last = a[a.length - 1];
  if (last instanceof KW) { kw = { ...last.v }; args = a.slice(0, -1); }
  else if (a.length > s.req && isPlain(last)) { kw = { ...last }; args = a.slice(0, -1); }
  if (args.length > s.names.length) throw new TypeError(`${name}() takes ${s.names.length} positional arguments but ${args.length} were given`);
  const p: any[] = s.names.map((n, i) => {
    if (i < args.length) return args[i];
    if (Object.prototype.hasOwnProperty.call(kw, n)) return pop(kw, n);
    return undefined;
  });
  for (let i = 0; i < s.req; i++) if (p[i] === undefined) throw new TypeError(`${name}() missing required argument '${s.names[i]}'`);
  if (!s.kw && Object.keys(kw).length) throw new TypeError(`${name}() got an unexpected keyword argument '${Object.keys(kw)[0]}'`);
  return { p, kw };
}
const dflt = <T>(v: T | undefined, d: T): T => (v === undefined ? d : v);

export class Kit {
  V: string;
  B: BrandJson;
  INK: string; ACC: string; BG: string; FONT: string; LOGO: string | null;
  alias: Record<string, string>;
  vw: Word[];
  spoken: [string, number][];
  S: Obj[] = [];
  sfx: SfxItem[] = [];
  dims: Obj[][] = [];
  _cursor = 0;
  video: string;

  constructor(init: KitInit) {
    this.video = init.video;
    this.V = (init.videoDir ?? `styles/style-1/videos/${init.video}/`).replace(/\/+$/, '') + '/';
    this.B = init.brand;
    for (const k of ['ink', 'accent', 'stage']) if (!(k in this.B)) throw new Error(`KeyError: '${k}' (brand JSON)`);
    this.INK = this.B.ink!; this.ACC = this.B.accent!; this.BG = this.B.stage!;
    this.FONT = this.B.font ?? 'inter-std'; this.LOGO = init.logo ?? null;
    this.alias = init.alias ?? {};
    this.vw = init.words;
    this.spoken = this.vw.map((w) => [norm(w.word), pyRound(w.t * 30)]);
  }

  private _al(k: string): string { return Object.prototype.hasOwnProperty.call(this.alias, k) ? this.alias[k]! : k; }

  /** Generic dispatch by Python method name with explicit kwargs (plan runner). */
  call(name: string, args: any[] = [], kw: Obj = {}): any {
    if (!(name in SIG)) throw new Error(`unknown kit method: ${name}`);
    return (this as any)[name](...args, new KW(kw));
  }

  // ── time ─────────────────────────────────────────────────────────────────────────────────────────────────
  F(...a: any[]): number {
    const { p } = bind('F', a);
    const word = p[0] as string;
    const k = this._al(norm(word));
    const after: number = isNone(p[1]) ? this._cursor : p[1];
    for (const [n, f] of this.spoken) if (n === k && f >= after) return f;
    throw new Error(`KeyError: '${word}' not spoken after frame ${after}`);
  }

  // ── elements ─────────────────────────────────────────────────────────────────────────────────────────────
  ln(...a: any[]): Obj {
    const { p, kw } = bind('ln', a);
    const [text, top, width] = p as [string, number, number];
    const weight = dflt(p[3], 800);
    const tracking = pop(kw, 'tracking', -0.02);
    return { kind: 'line', top, width, weight, color: this.INK, font: this.FONT, reveal: 6, hold: 6,
      slide: 60, tracking, words: pySplit(text).map((w) => ({ w, f: 0 })), cx: 540, ...kw };
  }
  accent(...a: any[]): Obj { // brand accent line (colour, slam)
    const { p, kw } = bind('accent', a);
    const motion = pop(kw, 'motion', 'slam');
    return this.ln(p[0], p[1], p[2], 900, { color: this.ACC, motion, instant: true, ...kw });
  }
  serif(...a: any[]): Obj {
    const { p, kw } = bind('serif', a);
    const gradient = dflt(p[3], ['#2B2118', '#B97A2C', '#7E9F45']);
    return this.ln(p[0], p[1], p[2], 400, { font: 'instrument', italic: true, gradient: [...gradient], instant: true, tracking: -0.01, ...kw });
  }
  card(...a: any[]): Obj {
    const { p, kw } = bind('card', a);
    const [src, cx, cy, w, h, at] = p;
    const radius = pop(kw, 'radius', 28);
    const d: Obj = { kind: 'image', src, cx, cy, w, h, card: true, radius, ...kw };
    if (!isNone(at)) d._at = at;
    return d;
  }
  look(...a: any[]): Obj { // look preview clip (blank at both ends -> loop window)
    const { p, kw } = bind('look', a);
    const w = dflt(p[3], 600);
    const enter = pop(kw, 'enter', 'rise');
    return this.card(p[0], p[1], p[2], w, w * 0.375, p[4] ?? null, { vt: 0.4, loop: [0.35, 1.8], enter, ...kw });
  }
  phone(...a: any[]): Obj {
    const { p, kw } = bind('phone', a);
    const [src, cx, cy] = p;
    const w = dflt(p[3], 300);
    const d: Obj = { kind: 'image', draw: 'phone', screen: src, cx, cy, w, h: w * 2.03, focus: [0.5, 0.5], shadow: [0, 30, 50, 0.28], ...kw };
    if (!isNone(p[4])) d._at = p[4];
    return d;
  }
  icon(...a: any[]): Obj {
    const { p, kw } = bind('icon', a);
    const w = dflt(p[4], 190);
    return this.card(p[0], p[1], p[2], w, w, p[3] ?? null, { fit: 'contain', radius: 40, enter: 'pop', ...kw });
  }
  mark(...a: any[]): Obj {
    const { p, kw } = bind('mark', a);
    const [cx, cy, w, at, src] = p;
    const d: Obj = { kind: 'image', src: or(src, () => this.LOGO), cx, cy, w, h: w, enter: 'pop', shadow: [0, 18, 30, 0.18], ...kw };
    if (!isNone(at)) d._at = at;
    return d;
  }
  burst(...a: any[]): Obj {
    const { p } = bind('burst', a);
    const [cx, cy, d, at, color] = p;
    const spin = dflt(p[5], 22);
    const b: Obj = { kind: 'image', draw: 'asterisk', color: or(color, () => get(this.B, 'burst') ?? '#E9CCFF'),
      rays: RAYS.map(([ang, l, w]) => [ang, .5 * d * l!, .5 * d * w!]),
      core: d * 0.14, cx, cy, w: d, h: d, spin, enter: 'pop' };
    if (!isNone(at)) b._at = at;
    return b;
  }
  win(...a: any[]): Obj {
    const { p } = bind('win', a);
    const [x, y, w] = p;
    const bar = Math.max(46, w * 0.075);
    return { x, y, w, h: bar + w / 1.6, bar };
  }
  at_px(...a: any[]): [number, number] {
    const { p } = bind('at_px', a);
    const [W, X, Y] = p;
    const cw = dflt(p[3], 2880);
    const k = W.w / cw;
    return [W.x + X * k, W.y + W.bar + Y * k];
  }
  browser(...a: any[]): Obj {
    const { p, kw } = bind('browser', a);
    const [src, W, at] = p;
    const d: Obj = { kind: 'image', src, browser: '', cx: W.x + W.w / 2, cy: W.y + W.h / 2, w: W.w, h: W.h, enter: 'rise', tilt: 4, ...kw };
    if (!isNone(at)) d._at = at;
    return d;
  }
  mark_hl(...a: any[]): Obj {
    const { p } = bind('mark_hl', a);
    const [x, y, w, h, at] = p;
    return { kind: 'mark', x, y, w, h, _at: at, frames: 9, color: dflt(p[5], '#E4C2FF') };
  }

  // ── scene plumbing ───────────────────────────────────────────────────────────────────────────────────────
  _scene(name: string, at: string, layers: Obj[], enter: any = ['y', 300], keys: any = null, push = 1.05, sfx: SfxItem[] = []): Obj {
    const f0 = this.S.length ? Math.max(0, this.F(at) - 4) : 0;
    this._cursor = f0;
    const sc: Obj = { name, f0, layers, _push: push, _keys: keys };
    if (this.S.length && truthy(enter)) sc.enter = enter;
    this.S.push(sc);
    for (const s of sfx) this.sfx.push([name, ...s]);
    return sc;
  }

  lines(...a: any[]): Obj {
    const { p } = bind('lines', a);
    const [name, lines] = p as [string, any[]];
    const visuals = dflt(p[2], []); const at = p[3] ?? null; const top = dflt(p[4], 420); const gap = dflt(p[5], 110);
    const enter = dflt(p[6], ['y', 300]); const push = dflt(p[7], 1.05);
    const L = lines.map((t: any, i: number) => (typeof t === 'string' ? this.ln(t, top + i * gap, Math.min(900, 70 * pyLen(t) + 120)) : t));
    return this._scene(name, or(at, () => L[0].words[0].w), [...visuals, ...L], enter, null, push);
  }

  list_left(...a: any[]): Obj {
    const { p } = bind('list_left', a);
    const [name, lines] = p as [string, string[]];
    const visuals = dflt(p[2], []); const at = p[3] ?? null; const top = dflt(p[4], 270); const gap = dflt(p[5], 110);
    const x = dflt(p[6], 90); const enter = dflt(p[7], ['x', 500]);
    const L = lines.map((t, i) => this.ln(t, top + i * gap, Math.min(860, 46 * pyLen(t) + 60), { align: 'left', x }));
    this.dims.push(L);
    return this._scene(name, or(at, () => L[0]!.words[0].w), [...L, ...visuals], enter, null, 1.04);
  }

  stack_slam(...a: any[]): Obj {
    const { p } = bind('stack_slam', a);
    const [name, lines] = p as [string, string[]];
    const slam_last = dflt(p[2], true); const visuals = dflt(p[3], []); const at = p[4] ?? null; const top = dflt(p[5], 420); const gap = dflt(p[6], 140);
    const L = lines.slice(0, -1).map((t, i) => this.ln(t, top + i * gap, Math.min(820, 54 * pyLen(t) + 60), 900));
    const lastT = lines[lines.length - 1]!;
    const last = slam_last
      ? this.accent(lastT, top + (lines.length - 1) * gap + 15, Math.min(900, 66 * pyLen(lastT) + 80))
      : this.ln(lastT, top + (lines.length - 1) * gap, 800, 900);
    this.dims.push([...L, last]);
    return this._scene(name, or(at, () => L[0]!.words[0].w), [...visuals, ...L, last], ['x', -500], null, 1.05, [['@last', 'key-word']]);
  }

  logo_land(...a: any[]): Obj {
    const { p } = bind('logo_land', a);
    const [name, word] = p as [string, string];
    const title = p[2] ?? null; const wordmark = p[3] ?? null; const at = p[4] ?? null; const size = dflt(p[5], 340);
    const lay: Obj[] = [this.burst(540, 840, size * 1.9, word), this.mark(540, 840, size, word)];
    if (truthy(title)) lay.push(this.ln(title, 520, 60 * pyLen(title) + 60, 700));
    if (truthy(wordmark)) lay.push(this.ln(wordmark, 1120, Math.min(900, 95 * pyLen(wordmark)), 900, { motion: 'slam', instant: true }));
    return this._scene(name, or(at, () => (truthy(title) ? pySplit(title)[0] : word)), lay, ['y', 300], null, 1.1, [[word, 'build'], [word, 'key-word']]);
  }

  icon_ring(...a: any[]): Obj {
    const { p } = bind('icon_ring', a);
    const [name, icons, words, title] = p as [string, string[], string[], string];
    const footer = p[4] ?? null; const at = p[5] ?? null; const center_mark = dflt(p[6], true);
    const lay: Obj[] = [this.ln(title, 420, Math.min(840, 34 * pyLen(title) + 60), 800)];
    if (center_mark) lay.push(this.mark(540, 990, 210, null, { spin: 10 }));
    icons.forEach((src, i) => {
      const ang = (-90 + 360 / icons.length * i) * (Math.PI / 180);
      lay.push(this.icon(src, 540 + 280 * Math.cos(ang), 990 + 270 * Math.sin(ang), words[Math.min(i, words.length - 1)], { w: 170, float: [6, 2.6 + .3 * i, i] }));
    });
    (footer || []).forEach((t: string, j: number) => {
      lay.push(j === 0 ? this.ln(t, 1395 + 105 * j, Math.min(800, 48 * pyLen(t) + 60), 800) : this.accent(t, 1395 + 105 * j, Math.min(700, 52 * pyLen(t) + 60), { motion: 'rise' }));
    });
    return this._scene(name, or(at, () => pySplit(title)[0]), lay, ['y', 300], null, 1.04);
  }

  logo_grid(...a: any[]): Obj[] {
    const { p } = bind('logo_grid', a);
    const [src_list, word] = p as [string[], string];
    const top = dflt(p[2], 1040);
    const rots = [-4, 3, -2, 4, -3, 2];
    return src_list.map((s, i) => this.card(s, 230 + 310 * (i % 3), top + 300 * Math.floor(i / 3), 250, 250, word,
      { radius: 36, enter: 'pop', rot: rots[i % 6], float: [6, 2.8 + .2 * i, i], _stagger: 2 * i }));
  }

  trio(...a: any[]): Obj {
    const { p } = bind('trio', a);
    const [name, clips, words] = p as [string, string[], string[]];
    const title = p[3] ?? null; const at = p[4] ?? null;
    const xs = [215, 540, 865];
    const en = [{ enter: 'slam', rot: -4 }, { enter: 'pop', glow: '#E6C6FF' }, { enter: 'pop', rot: 4 }];
    const lay: Obj[] = [this.burst(540, 1080, 620, words[1])];
    clips.forEach((c, i) => lay.push(this.phone(c, xs[i], 1090 - 40 * (i === 1 ? 1 : 0), 300, words[i], { vt: 1.2, float: [7, 3 + .3 * i, i], ...en[i] })));
    if (truthy(title)) lay.push(this.ln(title, 290, 900, 800));
    return this._scene(name, or(at, () => words[0]), lay, ['y', 300], null, 1.05,
      [[words[0], 'hard-hit', 'punch'], [words[1], 'stat'], [words[2], 'pop', 'bubble']]);
  }

  grid4(...a: any[]): Obj {
    const { p } = bind('grid4', a);
    const [name, clips, title, at] = p as [string, string[], string, string];
    const lay: Obj[] = [this.serif(title, 175, 420)];
    clips.forEach((c, i) => lay.push(this.phone(c, [350, 730][i % 2], [760, 1390][Math.floor(i / 2)], 290, null,
      { enter: 'pop', vt: 4.0 + (1 + 2 * i) / 30, rot: [-2, 2, 2, -2][i], float: [5, 3 + .3 * i, i], _stagger: 1 + 2 * i })));
    return this._scene(name, at, lay, ['x', -500], null, 1.1, [['@f0', 'cascade']]);
  }

  export_proof(...a: any[]): Obj {
    const { p } = bind('export_proof', a);
    const [name, clip, w_export, w_proof] = p as [string, string, string, string];
    const title = dflt(p[4], 'No watermark.'); const at = p[5] ?? null;
    const ph = this.phone(clip, 540, 1150, 360, null, { enter: 'rise', vt: 4.0, float: [6, 3.2, .4] });
    const b = 360 * 0.035;
    const sx1 = 540 + 180 - b; const sy1 = 1150 + ph.h / 2 - b;
    const lay: Obj[] = [{ kind: 'progress', x: 260, y: 230, w: 560, h: 118, _at: w_export, _off: -3, _until: w_proof, label: 'Exporting', done: 'Exported' },
      this.ln(title, 420, 720, 800), ph, this.mark_hl(sx1 - 170, sy1 - 120, 160, 110, w_proof)];
    return this._scene(name, or(at, () => w_export), lay, ['y', 300], null, 1.05, [[w_export, 'click-ui'], [w_proof, 'notify']]);
  }

  reveal(...a: any[]): Obj {
    const { p } = bind('reveal', a);
    const [name, clip, capture, rect_px, title_lines, reveal_line, pull_word, reveal_word] = p as [string, string, string, number[], string[], string, string, string];
    const W = this.win(40, 560, 1000);
    const p0 = this.at_px(W, rect_px[0], rect_px[1]); const p1 = this.at_px(W, rect_px[2], rect_px[3]);
    const pw = p1[0] - p0[0]; const ph = p1[1] - p0[1];
    const pcx = p0[0] + pw / 2; const pcy = p0[1] + ph / 2;
    const fill = Math.max(1080 / pw, 1920 / ph) * 1.01;
    const fp = this.F(pull_word); const fr = this.F(reveal_word);
    const lay: Obj[] = [this.browser(capture, W, null, { enter: null, tilt: 0 }),
      this.card(clip, pcx, pcy, pw, ph, null, { radius: 10, focus: [.5, .5], vt: 0.0 }),
      { kind: 'rect', x: 0, y: 0, w: 1080, h: 640, stops: [[0, 'rgba(0,0,0,0.62)'], [1, 'rgba(0,0,0,0)']], out: fp - 4, fixed: true }];
    title_lines.forEach((t, i) => lay.push(this.ln(t, 170 + 80 * i, [520, 860][Math.min(i, 1)], [600, 800][Math.min(i, 1)], { color: '#FFFFFF', grey: '#FFFFFF', out: fp - 4, fixed: true })));
    lay.push(this.ln(reveal_line, 300, 620, 800, { motion: 'slam', instant: true }));
    return this._scene(name, pySplit(title_lines[0]!)[0]!, lay, null, [[0, fill, pcx, pcy], [fp - 3, fill * 1.035, pcx, pcy], [fr + 24, 1.0, 540, 900]], 1.05,
      [[`@f:${fp - 3}`, 'scene', 'air-cut'], [`@f:${fr + 22}`, 'hard-hit', 'soft-hit']]);
  }

  cta_comment(...a: any[]): Obj {
    const { p } = bind('cta_comment', a);
    const [name, keyword, bubble] = p as [string, string, string];
    const title = dflt(p[3], ['Comment', null]); const at: string = dflt(p[4], 'comment'); const phone_clip = p[5] ?? null;
    const send = this.F('and', this.F(at)) + 4;
    const lay: Obj[] = [this.ln(title[0], 300, 440, 600), this.ln(`“${keyword.toUpperCase()}”`, 400, 900, 900, { motion: 'slam', instant: true }),
      { kind: 'comment', x: 90, y: 760, w: 900, h: 140, _at: null, text: keyword.toLowerCase(), start: this.F(keyword, this.F(at)), perChar: 1.6, send },
      { kind: 'cursor', _at: at, _off: 2, keys: [[0, 820, 1180], [send - 2, 920, 835, 1]], size: 110 },
      { kind: 'typebox', x: 300, y: 1010, w: 680, h: 124, r: 62, fill: get(this.B, 'accent_deep') ?? '#034F46', color: this.BG, text: bubble, cursor: send + 6, start: send + 8, perChar: 1.0 }];
    if (truthy(phone_clip)) lay.push(this.phone(phone_clip, 540, 1500, 260, null, { enter: 'rise', rot: -3, vt: 5.0 }));
    return this._scene(name, at, lay, ['y', 300], null, 1.05, [[`@f:${send - 2}`, 'click-ui'], [`@f:${send + 8}`, 'notify'], [`@f:${send + 14}`, 'cta']]);
  }

  cta_pill(...a: any[]): Obj {
    const { p } = bind('cta_pill', a);
    const [name, lines, pill, pill_word] = p as [string, string[], string, string];
    const at = p[4] ?? null; const wordmark = p[5] ?? null;
    const fc = this.F(pill_word, this.F(or(at, () => pySplit(lines[0]!)[0])));
    const lay: Obj[] = [this.ln(lines[0]!, 470, Math.min(860, 55 * pyLen(lines[0]!) + 60), 800)];
    if (lines.length > 1) lay.push(this.accent(lines[1]!, 580, Math.min(900, 66 * pyLen(lines[1]!)), { motion: 'rise' }));
    lay.push({ kind: 'typebox', x: 240, y: 830, w: 600, h: 130, r: 65, fill: this.ACC, color: '#FFFFFF', text: pill, cursor: fc - 3, start: fc - 1, perChar: 1.2 },
      { kind: 'cursor', f: fc + 6, keys: [[fc + 6, 820, 1220], [fc + 20, 640, 910, 1]], size: 110 });
    if (truthy(wordmark) && truthy(this.LOGO)) {
      const ws = pySplit(lines[0]!);
      lay.push(this.mark(420, 1300, 150, ws[ws.length - 1]), this.ln(wordmark, 1260, 300, 900, { align: 'left', x: 510 }));
    }
    return this._scene(name, or(at, () => pySplit(lines[0]!)[0]), lay, ['y', 300], null, 1.05,
      [[`@f:${fc - 1}`, 'code'], [`@f:${fc + 20}`, 'click-ui'], [`@f:${fc + 24}`, 'cta']]);
  }

  // ── finish: timing, dims, guards, backdrop, SFX ──────────────────────────────────────────────────────────
  finish(...a: any[]): FinishResult {
    const { p } = bind('finish', a);
    let corners: Obj[] = dflt(p[0], []); const glows = p[1] ?? null; const sparkles = p[2] ?? null; const key_words: string[] = dflt(p[3], []);
    const S = this.S; const vw = this.vw;
    const toks: Obj[] = [];
    for (const sc of S) for (const L of sc.layers) if (L.kind === 'line') for (const w of L.words) toks.push(w);
    const aN = toks.map((w) => this._al(norm(w.w)));
    const hit = new Map<number, number>();
    for (const blk of matchingBlocks(aN, this.spoken.map(([n]) => n))) for (let k = 0; k < blk.size; k++) hit.set(blk.a + k, vw[blk.b + k]!.t);
    const hitKeys = [...hit.keys()];
    toks.forEach((w, i) => {
      let t: number;
      if (hit.has(i)) t = hit.get(i)!;
      else {
        let pv: number | null = null; let nx: number | null = null;
        for (const k of hitKeys) { if (k < i && (pv === null || k > pv)) pv = k; if (k > i && (nx === null || k < nx)) nx = k; }
        if (pv !== null) t = hit.get(pv)! + 0.12;
        else if (nx !== null) t = hit.get(nx)! - 0.12;
        else throw new Error('finish: no word matched the voice track');
      }
      w.f = Math.max(0, pyRound(t * 30) - 1);
    });
    const D = pyRound((vw[vw.length - 1]!.end + 1.2) * 30);
    S.forEach((sc, i) => {
      sc.f1 = i + 1 < S.length ? S[i + 1]!.f0 : D;
      for (const L of sc.layers) {
        if (L.kind === 'line') {
          if (L.words[0].f < sc.f0) L.words[0].f = sc.f0 + 2;
          L.words.forEach((wd: Obj, j: number) => {
            if (j && !norm(wd.w)) wd.f = L.words[Math.min(j + 1, L.words.length - 1)].f;
            if (j) wd.f = Math.max(wd.f, L.words[j - 1].f + 2);
          });
        }
        if (has(L, '_at')) {
          const at = pop(L, '_at');
          let f = isNone(at) ? sc.f0 + 1 : this.F(at, sc.f0);
          f += pop(L, '_off', 0) + pop(L, '_stagger', 0);
          if (L.kind === 'progress') { const until = pop(L, '_until'); L.f = f; L.f1 = this.F(until, sc.f0) - 2; }
          else if (L.kind === 'comment') L.f = f;
          else if (L.kind === 'cursor') { L.f = f; L.keys[0][0] = f; }
          else L.f = f;
        } else if (has(L, '_stagger')) L.f = sc.f0 + pop(L, '_stagger');
      }
      // guard: a visual on the cut frame (no empty frames)
      const starts: number[] = sc.layers.map((L: Obj) => (L.kind === 'line' ? L.words[0].f : L.kind === 'typebox' ? L.cursor : (L.f !== undefined ? L.f : sc.f0)));
      const mn = Math.min(...starts);
      if (i && mn > sc.f0 + 1) {
        const L = sc.layers[starts.indexOf(mn)];
        if (L.kind === 'line') L.words[0].f = sc.f0 - 4; // already mid-rise on the cut frame
        else L.f = sc.f0 - 3; // already entering on the cut frame
      }
      const keys = pop(sc, '_keys'); const push = pop(sc, '_push');
      sc.keys = truthy(keys) ? keys : [[sc.f0, push, 540, 960], [sc.f1, 1.0, 540, 980]];
      if (has(sc, 'enter')) sc.enter = { axis: sc.enter[0], from: sc.enter[1], tau: 7.5, arrive: sc.f0 + 24 };
      const nx = i + 1 < S.length ? get(S[i + 1]!, 'enter') : null;
      if (truthy(nx)) sc.exit = { axis: nx[0], to: (nx[1] > 0 ? -1 : 1) * 220, frames: 10 };
    });
    for (const group of this.dims) for (let i = 0; i + 1 < group.length; i++) group[i]!.dim = group[i + 1]!.words[0].f;
    const byname: Record<string, Obj> = {};
    for (const sc of S) byname[pop(sc, 'name')] = sc;
    const st = this.BG; const acc = this.ACC;
    corners = corners.map((c) => ({ ...c, beats: has(c, 'beats') ? c.beats : S.slice(1).map((sc) => sc.f0) })); // dip-and-pop on every cut
    const BACK = { corners,
      sparkles: sparkles !== null ? sparkles : [[205, 340, 26, acc, 0], [955, 1630, 30, acc, 3.3], [150, 1490, 20, acc, 2.4], [890, 440, 18, acc, 1.3]],
      glows: or(glows, () => or(get(this.B, 'glows'), () => [[140, 280, 820, '#EBCBFF', .55], [1000, 1000, 760, '#FFD9AE', .5], [180, 1760, 700, '#CDEFDA', .5]])),
      grid: { step: 90, color: get(this.B, 'grid') ?? '#8E7BB0', dot: 2.3, line: 'rgba(120,100,120,0.06)' }, grain: 0.05, vignette: 0.09 };
    const T: Obj = { fps: 30, frames: D, bg: st, backdrop: BACK, scenes: S };
    const spec = { component: 'style1-timeline', format: 'vertical', fps: 30, props: { timeline: T } };
    // SFX: typing on shown words, a whoosh per cut, a pop per image entry, preset events
    const t = (f: number): number => pyRoundN(f / 30, 3);
    const ev: Obj[] = toks.map((w) => ({ t: t(w.f), event: 'word', text: w.w }));
    const KEYSTRIP = '“”.,!?';
    for (const w of toks) if (key_words.includes(pyStrip(w.w, KEYSTRIP))) ev.push({ t: t(w.f) + 0.01, event: 'key-word' });
    S.slice(1).forEach((sc, i) => { if (truthy(get(sc, 'enter'))) ev.push({ t: t(sc.f0), event: 'scene', sound: ['air-cut', 'woosh-tight'][i % 2] }); });
    const pops = ['pop', 'pop-9', 'pop-4', 'bubble']; let k = 0;
    for (const sc of S) for (const L of sc.layers) {
      if (L.kind === 'image' && !isNone(get(L, 'f')) && get(L, 'draw') !== 'asterisk') {
        const big = !isNone(get(L, 'browser')) || (truthy(get(L, 'card')) && L.w > 560);
        if (big) ev.push({ t: t(L.f), event: 'card-in' });
        else { ev.push({ t: t(L.f), event: 'pop', sound: pops[k % 4] }); k++; }
      }
    }
    for (const item of this.sfx) { // (scene name, when, event[, sound]); when = spoken word | "@f:<frame>" | "@f0" | "@last"
      const s0 = byname[item[0]];
      if (!s0) throw new Error(`KeyError: '${item[0]}' (sfx scene)`);
      const when: string = item[1]; const evn: string = item[2];
      let f: number;
      if (when.startsWith('@f:')) f = parseInt(when.slice(3), 10);
      else if (when === '@f0') f = s0.f0 + 1;
      else if (when === '@last') f = Math.max(...s0.layers.filter((L: Obj) => L.kind === 'line').flatMap((L: Obj) => L.words.map((w: Obj) => w.f)));
      else f = this.F(when, s0.f0);
      const e: Obj = { t: t(f), event: evn };
      if (item.length > 3) e.sound = item[3];
      if (evn === 'cascade') { e.count = 4; e.spacing = 0.067; }
      ev.push(e);
    }
    ev.push({ t: 0.03, event: 'hard-hit', sound: 'soft-hit' });
    ev.sort((x, y) => x.t - y.t); let last = -1; // stable
    for (const e of ev) if (e.event === 'word') { if (e.t - last < 0.06) e.t = pyRoundN(last + 0.067, 3); last = e.t; }
    return { timeline: T, spec, events: ev,
      info: { scenes: S.map((s) => [s.f0, s.f1] as [number, number]), frames: D, events: ev.length, matched: hit.size, tokens: toks.length } };
  }
}
