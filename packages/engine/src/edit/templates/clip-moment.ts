import { toEdlZoom } from '@moovi/library/camera';
import { EDL_VERSION, metricsOf, type Edl } from '../edl';
import { EDIT } from '../lib';
import { pickLook, type CaptionLook } from '../looks';

/**
 * Clip Moment: the Buckology Short look as a deterministic, Mixkit driven edit template for any topic. Real footage is
 * the main picture, full bleed and sharp (topic mode: one Mixkit clip per script line, picked from what the line says;
 * video mode: the user's own clip with Mixkit cut-ins); it darkens a little while a card is up. Over it: a kicker chip,
 * a credit line, flip-digit counters, a frosted headline with one gold italic serif word, a tilted source card with a
 * highlighted line, a glowing logo card, a big counted stat with a bar, stacked list tiles, a filmstrip of tilted
 * stills, pixel dust and an end card with a question. Something moves every second, and every component has its sound
 * (a whoosh when a chip lands, a tick per flipped digit, a pop when a stat lands).
 *
 * It is this EDL preset + footage, sfx and 3D cast from the library graph (clip-moment-run.ts) + a captionseasy caption look
 * (CM_LOOK, mapped onto the player's nearest style) + scene components drawn by the edit player (./clip-moment-runtime.ts, loaded by page.ts when
 * the EDL names the template). The EDL is the same v0 schema the edit route plays: components are `inserts[]` with
 * `asset_ref: 'clip-moment:<component>'` and their `params`, the brand is the `header_strip` overlay, sounds are
 * `sfx[]`, the camera is each shot's `zoom[]` (a push-in with punches, `pushPunch`), cuts are zoomcut or glitch.
 *
 * Same script + same words + same seed = the same EDL (no clock, no Math.random). The brand is a parameter: nothing
 * here names a channel.
 */
export const CM_ID = 'clip-moment';
export const CM_VERSION = '2';
/** captions come from captionseasy by default: look 79 yellow_jump_box (caps, the spoken word boxed in yellow; Tab3's
 * b41 captions: 1 to 3 word caps groups, the lit word yellow). `CmOptions.look` swaps it. */
export const CM_LOOK = 79;

export const CM_COMPONENTS = ['kicker', 'flip', 'headline', 'source', 'logo', 'stat', 'compare', 'list', 'filmstrip', 'callout', 'obj3d', 'end', 'broll'] as const;
export type CmComponent = typeof CM_COMPONENTS[number];

/** Colour themes picked from the content (never navy). accent = the gold accent word, accent2 = the theme glow. */
export const CM_THEMES = {
  gaming: { ink: '#050605', paper: '#ffffff', accent: '#ffd84a', accent2: '#7cff4f', deep: '#07100a', pop: '#3ddc84' },
  tech: { ink: '#050606', paper: '#ffffff', accent: '#ffd84a', accent2: '#38e8cf', deep: '#061010', pop: '#7af0e0' },
  money: { ink: '#060504', paper: '#ffffff', accent: '#ffd84a', accent2: '#ffae3b', deep: '#110c05', pop: '#ffe08a' },
  space: { ink: '#050407', paper: '#ffffff', accent: '#ffd84a', accent2: '#b46bff', deep: '#0d0812', pop: '#d6b0ff' },
  crimson: { ink: '#060404', paper: '#ffffff', accent: '#ffd84a', accent2: '#ff4b4b', deep: '#120606', pop: '#ff9a7a' },
} as const;
export type CmTheme = keyof typeof CM_THEMES;

export type CmIcon = 'film' | 'box' | 'deal' | 'chart' | 'coin' | 'globe' | 'play' | 'cart' | 'star' | 'chip' | 'phone' | 'people';
export const CM_ICONS: CmIcon[] = ['film', 'box', 'deal', 'chart', 'coin', 'globe', 'play', 'cart', 'star', 'chip', 'phone', 'people'];

/** What a beat shows. Text marked *like this* is the accent word (gold italic serif on screen). */
export type CmShow =
  | { kind: 'flip'; from: number; to: number; label?: string }
  /** compact: the per-beat card over full-bleed footage (1 to 3 words and a sub line, upper third, captions stay) */
  | { kind: 'headline'; text: string; compact?: boolean; sub?: string }
  | { kind: 'source'; site: string; date?: string; title: string; lines?: string[]; highlight?: number; image?: string; box?: [number, number, number, number] }
  | { kind: 'logo'; text: string; sub?: string; image?: string }
  | { kind: 'stat'; value: number; decimals?: number; prefix?: string; suffix?: string; label?: string; bar?: number; foot?: string }
  | { kind: 'compare'; a: { label: string; value: number; display?: string }; b: { label: string; value: number; display?: string } }
  | { kind: 'list'; items: { icon: CmIcon; text: string }[] }
  | { kind: 'filmstrip'; images?: string[]; label?: string }
  /** labelled diagram callouts: dots on the footage with leader lines to a label each (parts and mechanisms) */
  | { kind: 'callout'; labels: string[]; title?: string }
  /** a 3D object from the craft library (`3d:obj-*`, visual runtime), drawn turning in CSS-style 3D with a label */
  | { kind: 'obj3d'; obj: string; label?: string; sub?: string }
  | { kind: 'none' };

export interface CmBeat {
  /** the voice line; *word* marks the accent word (spoken plainly, drawn gold) */
  say: string;
  show?: CmShow;
  /** the chip top left ("2014", "NEW RECORD", "YOUR TAKE") */
  kicker?: string;
  /** a second component for the beat's second half (a long line gets two, so a card is up every 2 to 3 s) */
  show2?: CmShow;
  /** an optional tiny credit line top left (off unless given: the Mixkit free licence needs no on-screen credit) */
  credit?: string;
  /** stock search words for this beat's footage (topic mode), most specific first: a ladder the picker walks before it
   *  ever reuses a clip. How many clips the beat cuts between is `clips` (default 1). */
  broll?: string | string[];
  /** clips this beat cuts between (each part at least 1.4 s) */
  clips?: number;
  /** library camera moves (`camera:<id>`) for the beat's shots, in order (3D moves on the footage, CSS 3D) */
  camera?: string[];
  /** library camera move for the beat's component entrance (`camera:orbit` turns the card in 3D as it lands) */
  enter?: string;
  /** soft (default): the footage stays the picture and dims and blurs only while a card is up; dim: always blurred
   *  and dark behind the cards (the reference's look); clear: never dimmed */
  look?: 'soft' | 'dim' | 'clear';
}

export interface CmScript {
  /** the user's brand: the pill on every frame and the end card's name. Optional: none = no pill, never a default */
  brand?: string;
  theme?: CmTheme;
  credit?: string;
  beats: CmBeat[];
  /** the end card: a question, a call to comment, and optionally a QR image (a file beside the EDL) to the channel */
  end?: { question: string; cta?: string; qr?: string };
}

export interface TimedWord { word: string; t: number; end: number }
export interface CmSource { file: string; duration: number; w: number; h: number; fps: number }

const r3 = (x: number) => Math.round(x * 1000) / 1000;
const r4 = (x: number) => Math.round(x * 10000) / 10000;
const norm = (w: string) => w.toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
/** The words of a line with the accent marks, e.g. "too *much*." -> [{text:'too'},{text:'much.',accent:true}] */
export function markedWords(line: string): { text: string; accent: boolean }[] {
  return line.trim().split(/\s+/).filter(Boolean).map(w => ({ text: w.replace(/\*/g, ''), accent: /\*/.test(w) }));
}
/** The line as spoken (marks removed). */
export const spoken = (line: string) => line.replace(/\*/g, '').replace(/\s+/g, ' ').trim();
/** Every line the voice speaks, in order: one per beat, then the end question and call. */
export function cmLines(s: CmScript): string[] {
  const lines = s.beats.map(b => spoken(b.say));
  if (s.end) lines.push(spoken([s.end.question, s.end.cta].filter(Boolean).join(' ')));
  return lines;
}

/**
 * Which voice words belong to which line. The voice joins lines with a breath, so each boundary is the widest gap near
 * where the token counts say it should be (a long pause inside a line cannot steal a boundary far from its place).
 */
export function splitByLines(words: TimedWord[], lines: string[]): [number, number][] {
  const counts = lines.map(l => l.split(/\s+/).filter(Boolean).length), total = counts.reduce((a, b) => a + b, 0);
  const scale = words.length / Math.max(1, total);
  const cuts: number[] = [];
  let acc = 0, prev = 0;
  for (let i = 0; i < lines.length - 1; i++) {
    acc += counts[i]!;
    const want = Math.round(acc * scale);
    let best = -1, gap = -1;
    for (let k = Math.max(prev + 1, want - 3); k <= Math.min(words.length - 1, want + 3); k++) {
      const g = words[k]!.t - words[k - 1]!.end;
      if (g > gap + 1e-9) { gap = g; best = k; }
    }
    if (best < 0) best = Math.min(words.length - 1, Math.max(prev + 1, want));
    cuts.push(best); prev = best;
  }
  const out: [number, number][] = [];
  let a = 0;
  for (const c of [...cuts, words.length]) { out.push([a, c]); a = c; }
  return out;
}

/** Steps of a flip counter: at most 7 values from `from` to `to`, same width, each a tick. */
export function flipSteps(from: number, to: number, max = 7): string[] {
  const n = Math.max(1, Math.min(max - 1, Math.abs(to - from))), w = String(Math.max(Math.abs(from), Math.abs(to))).length;
  const vals: string[] = [];
  for (let i = 0; i <= n; i++) vals.push(String(Math.round(from + (to - from) * i / n)).padStart(w, '0'));
  return [...new Set(vals)];
}

/** The library sfx asset (R7 id) each engine sfx map event this template uses sounds as (its first sound). */
export const CM_SFX = {
  'card-in': 'sfx:fs-whoosh-swosh-whoosh-air-cut', scene: 'sfx:fs-whoosh-swosh-whoosh-air-cut', 'slide-out': 'sfx:fs-147285',
  'click-ui': 'sfx:fs-ui-mouse-2-button-fast-click', 'key-word': 'sfx:fs-ui-mouse-2-button-fast-click', 'page-turn': 'sfx:fs-147282',
  'ui-reveal': 'sfx:ui-riser', 'hard-hit': 'sfx:fs-impact-punch2', build: 'sfx:riser', pop: 'sfx:ui-pop', 'list-item': 'sfx:fs-ui-pop-4',
  'paper-pop': 'sfx:fs-ui-pop-9', cta: 'sfx:fs-foley-water-drop-splash',
} as const;
export type CmSfxEvent = keyof typeof CM_SFX;
export interface CmSfx { t: number; asset_ref: string; event: CmSfxEvent; gain_db?: number; rule_id: string }

export interface CmOptions {
  script: CmScript;
  /** voice words on the OUTPUT clock (topic mode: the voice track; video mode: the builder's words mapped to output) */
  words: TimedWord[];
  /** the plate (topic mode) or the user's clip (video mode) */
  source: CmSource;
  output?: { w: number; h: number; fps: number };
  seed?: number;
  /** images the filmstrip may use (files beside the EDL), one list per beat index */
  stills?: Record<number, string[]>;
  /** tail after the last word, seconds (the end card holds) */
  tail?: number;
  /** a captionseasy look (number or id) instead of CM_LOOK */
  look?: number | string;
}

type Ins = NonNullable<Edl['inserts']>[number] & { params?: Record<string, unknown> };
export type CmEdl = Edl & { template: { id: string; version: string; brand: string; theme: CmTheme; credit?: string }; inserts: Ins[] };

const KIND: Record<CmComponent, Ins['kind']> = { kicker: 'title', flip: 'number', headline: 'title', source: 'card', logo: 'card', stat: 'number', compare: 'number', list: 'checklist', filmstrip: 'photo', callout: 'card', obj3d: 'card', end: 'title', broll: 'broll' };

/** The clip-moment EDL for a script whose voice is already timed (topic mode: the plate runs on the output clock). */

/** Footage motion (Tab3's Foot48 numbers): an eased push from 1.00 to 1.14 across the shot; a shot over 2.2 s punches
 * to a new framing about every 1.8 s (scale x1.12 to x1.3, offset), so no framing holds still for more than ~2 s. */
export const CM_PUNCH = { push: 0.14, every: 1.8, after: 2.2, step: 0.45 };
export function pushPunch(t0: number, t1: number, seed = 0): NonNullable<Edl['shots'][number]['zoom']> {
  const len = t1 - t0, out: NonNullable<Edl['shots'][number]['zoom']> = [];
  const punchAt = (t: number) => len > CM_PUNCH.after ? Math.floor((t - t0) / CM_PUNCH.every) : 0;
  const frame = (k: number) => k === 0 ? { m: 1, cx: 0.5, cy: 0.5 } : { m: 1.12 + 0.06 * ((k + seed) % 3), cx: 0.5 + ((k + seed) % 2 ? 0.035 : -0.035), cy: 0.5 + ((k + seed) % 3 === 0 ? -0.025 : 0.02) };
  const n = Math.max(1, Math.ceil(len / CM_PUNCH.step));
  let lastK = 0;
  for (let i = 0; i <= n; i++) {
    const t = Math.min(t1, t0 + i * len / n), k = punchAt(Math.min(t, t1 - 1e-3));
    if (k !== lastK) {
      // the punch itself: a cut to the new framing at its exact time
      const tp = r3(t0 + k * CM_PUNCH.every), f = frame(k), x = (tp - t0) / len, base = 1 + CM_PUNCH.push * (0.5 - 0.5 * Math.cos(Math.PI * x));
      out.push({ t: tp, scale: r4(Math.min(1.3, f.m + (base - 1) * 0.4)), cx: r4(f.cx), cy: r4(f.cy), ease: 'cut', rule_id: 'cm.camera.punch' });
      lastK = k;
    }
    const f = frame(k), x = (t - t0) / len, base = 1 + CM_PUNCH.push * (0.5 - 0.5 * Math.cos(Math.PI * x));
    out.push({ t: r3(t), scale: r4(k === 0 ? base : Math.min(1.3, f.m + (base - 1) * 0.4)), cx: r4(f.cx), cy: r4(f.cy), ease: 'linear', dur: r3(len / n), rule_id: 'cm.camera.push' });
  }
  return out.sort((a, b) => a.t - b.t);
}

/** The captionseasy look for an EDL's words (shown on the output clock), mapped onto the player style it draws as. */
export function cmCaption(e: Pick<Edl, 'words' | 'shots'>, look: number | string = CM_LOOK): { caption_style_id: string; caption_look?: CaptionLook } {
  try {
    const l = pickLook(EDIT.outWords(e as Edl), { look });
    return { caption_style_id: l.player_style, caption_look: l };
  } catch { return { caption_style_id: 'punch-duo' }; }
}

export function clipMomentEdl(o: CmOptions): CmEdl {
  const s = o.script, theme: CmTheme = s.theme ?? 'gaming', pal = CM_THEMES[theme];
  const brand = s.brand?.trim() ?? '';
  if (!s.beats.length) throw new Error('clip-moment needs at least one beat');
  const lines = cmLines(s), words = o.words;
  if (!words.length) throw new Error('clip-moment needs timed voice words');
  const spans = splitByLines(words, lines);
  const D = r3(Math.min(o.source.duration, (words.at(-1)!.end) + (o.tail ?? 1.6)));
  // beat i runs from just before its first word to just before the next beat's first word
  const bt = spans.map(([a], i) => i === 0 ? 0 : r3(Math.max(0, words[a]!.t - 0.18)));
  const starts = bt, ends = bt.map((_, i) => i + 1 < bt.length ? bt[i + 1]! : D);

  // words: accent marks from the script by position inside each line, numbers as numbers
  const edlWords: Edl['words'] = [];
  spans.forEach(([a, b], li) => {
    const raw = li < s.beats.length ? s.beats[li]!.say : [s.end!.question, s.end!.cta].filter(Boolean).join(' ');
    const marks = markedWords(raw), used = new Set<number>();
    for (let k = a; k < b; k++) {
      const w = words[k]!;
      const m = marks.findIndex((x, j) => !used.has(j) && norm(x.text) === norm(w.word));
      if (m >= 0) used.add(m);
      const accent = m >= 0 && marks[m]!.accent, num = /\d/.test(w.word);
      edlWords.push({ src_t0: r3(w.t), src_t1: r3(Math.max(w.t, w.end)), text: w.word, line_id: li, ...(accent ? { role: 'key' as const } : num ? { role: 'number' as const } : {}) });
    }
  });

  const shots: Edl['shots'] = [], inserts: Ins[] = [], sfx: CmSfx[] = [], beats: NonNullable<Edl['beats']> = [];
  const nBeats = s.beats.length + (s.end ? 1 : 0);
  for (let i = 0; i < nBeats; i++) {
    const t0 = starts[i]!, t1 = ends[i]!, len = t1 - t0, isEnd = i >= s.beats.length;
    const b: CmBeat = isEnd ? { say: s.end!.question, show: { kind: 'none' } } : s.beats[i]!;
    const show = b.show ?? { kind: 'none' as const };
    const look = isEnd ? 'dim' : b.look ?? 'soft';
    // the footage is the picture: one shot (one Mixkit clip on the plate) per query, a long beat split evenly
    const qs = isEnd ? [] : Array.isArray(b.broll) ? b.broll.filter(Boolean) : b.broll ? [b.broll] : [];
    // one Mixkit clip per line by default (Tab3's b48/b49 rule); `clips` asks for more, each part at least 1.4 s
    const parts = isEnd ? 1 : Math.max(1, Math.min(b.clips ?? 1, Math.floor(len / 1.4) || 1));
    for (let p = 0; p < parts; p++) {
      const a = r3(t0 + len * p / parts), z1 = r3(p + 1 === parts ? t1 : t0 + len * (p + 1) / parts);
      const zoom = pushPunch(a, z1, shots.length);
      shots.push({ t_in: a, t_out: z1, src_in: a, src_out: z1, layout: 'full', framing: { scale: 1, cx: 0.5, cy: 0.5 }, zoom, grade_id: `cm-${look}`, camera: { asset_ref: b.camera?.[p] ?? (z1 - a > CM_PUNCH.after ? 'camera:reframe' : 'camera:dolly-in'), rule_id: b.camera?.[p] ? 'cm.camera.library' : 'cm.camera.push_punch' }, rule_id: `cm.beat.${look}` });
      if (qs.length) inserts.push({ t0: a, t1: z1, kind: 'broll', frame: 'full', query: qs[p % qs.length]!, rule_id: 'cm.broll.plate', params: { baked: true } });
      if (p > 0) sfx.push({ t: r3(Math.max(0, a - 0.1)), asset_ref: CM_SFX['slide-out'], event: 'slide-out', gain_db: -3, rule_id: 'cm.sfx.clip_change' });
    }
    if (i > 0) sfx.push({ t: r3(Math.max(0, t0 - 0.12)), asset_ref: CM_SFX['scene'], event: 'scene', rule_id: 'cm.sfx.beat_change' });
    const [wa, wb] = spans[i] ?? [0, 0];
    beats.push({ t0: r3(t0), t1: r3(t1), word_idx: Array.from({ length: Math.max(0, wb - wa) }, (_, k) => wa + k), tag: isEnd ? 'cta' : i === 0 ? 'hook' : show.kind === 'stat' || show.kind === 'flip' ? 'number' : show.kind === 'list' ? 'list' : show.kind === 'source' ? 'quote' : 'claim' });
    const credit = b.credit ?? s.credit;
    if (!isEnd && b.kicker) {
      const k0 = r3(t0 + 0.12);
      inserts.push({ t0: k0, t1: r3(t1 - 0.04), kind: KIND.kicker, frame: 'card_box', label: b.kicker.toUpperCase(), asset_ref: `${CM_ID}:kicker`, rule_id: 'cm.kicker', params: { text: b.kicker.toUpperCase(), credit: credit?.toUpperCase() } });
      sfx.push({ t: r3(k0 + 0.04), asset_ref: CM_SFX['card-in'], event: 'card-in', gain_db: -2, rule_id: 'cm.sfx.chip_in' });
    }
    const lineWords = edlWords.slice(wa, wb), beatLen = len;
    // a long beat with a second component splits its time (first card, then the second), so a card is up every 2 to 3 s
    const split = !isEnd && b.show2 && b.show2.kind !== 'none' && beatLen >= 3.2 ? r3(t0 + beatLen * 0.5) : null;
    const windows: { show: CmShow; c0: number; c1: number; enter?: string }[] = [];
    if (show.kind !== 'none') windows.push({ show, c0: r3(t0 + 0.22), c1: split ? r3(split - 0.06) : r3(Math.max(t0 + 0.72, t1 - 0.06)), ...(b.enter ? { enter: b.enter } : {}) });
    if (split && b.show2) windows.push({ show: b.show2, c0: r3(split + 0.04), c1: r3(Math.max(split + 0.6, t1 - 0.06)), enter: b.enter ? (b.enter === 'camera:orbit' ? 'camera:tilt' : 'camera:orbit') : 'camera:tilt' });
    for (const { show, c0, c1, enter } of windows) {
    const len = Math.max(0.8, c1 - c0 + 0.28), ref = `${CM_ID}:${show.kind}`, before = inserts.length;
    if (show.kind === 'flip') {
      const values = flipSteps(show.from, show.to), dur = Math.min(1.4, Math.max(0.6, len * 0.4));
      const ticks = values.slice(1).map((_, k) => r3(c0 + 0.3 + dur * (k + 1) / Math.max(1, values.length - 1)));
      inserts.push({ t0: c0, t1: c1, kind: KIND.flip, frame: 'card_box', label: String(show.to), asset_ref: ref, rule_id: 'cm.flip', params: { values, ticks, label: show.label?.toUpperCase() } });
      ticks.forEach(t => sfx.push({ t, asset_ref: CM_SFX['click-ui'], event: 'click-ui', rule_id: 'cm.sfx.flip_tick' }));
    } else if (show.kind === 'headline') {
      // each headline word lands when it is spoken (or staggered when the voice does not say it)
      const hw = markedWords(show.text), used = new Set<number>();
      const placed = hw.map((x, j) => {
        const k = lineWords.findIndex((w, q) => !used.has(q) && norm(w.text) === norm(x.text));
        if (k >= 0) used.add(k);
        // never an empty panel: the first word lands with the panel, the rest on their spoken time or sooner
        const soon = c0 + 0.18 + j * 0.3;
        return { text: x.text, accent: x.accent, at: r3(k >= 0 ? Math.min(soon, Math.max(c0 + 0.1, lineWords[k]!.src_t0 - 0.04)) : soon) };
      });
      inserts.push({ t0: c0, t1: c1, kind: KIND.headline, frame: 'card_box', label: show.text.replace(/\*/g, ''), asset_ref: ref, rule_id: show.compact ? 'cm.headline.compact' : 'cm.headline', params: { words: placed, ...(show.compact ? { compact: true } : { hide_captions: true }), ...(show.sub ? { sub: show.sub } : {}) } });
      placed.filter(p => p.accent).forEach(p => sfx.push({ t: p.at, asset_ref: CM_SFX['key-word'], event: 'key-word', rule_id: 'cm.sfx.accent_word' }));
    } else if (show.kind === 'source') {
      inserts.push({ t0: c0, t1: c1, kind: KIND.source, frame: 'card_box', label: show.site, asset_ref: ref, rule_id: 'cm.source', params: { site: show.site.toUpperCase(), date: show.date?.toUpperCase(), title: show.title, lines: show.lines ?? [], highlight: show.highlight ?? 0, hi_at: r3(c0 + Math.min(1.1, len * 0.35)), image: show.image, box: show.box, tag: 'SOURCE' } });
      sfx.push({ t: r3(c0 + 0.02), asset_ref: CM_SFX['page-turn'], event: 'page-turn', rule_id: 'cm.sfx.card_in' });
      sfx.push({ t: r3(c0 + Math.min(1.1, len * 0.35)), asset_ref: CM_SFX['ui-reveal'], event: 'ui-reveal', gain_db: -2, rule_id: 'cm.sfx.highlight' });
    } else if (show.kind === 'logo') {
      inserts.push({ t0: c0, t1: c1, kind: KIND.logo, frame: 'card_box', label: show.text, asset_ref: ref, rule_id: 'cm.logo', params: { text: show.text, sub: show.sub?.toUpperCase(), image: show.image } });
      sfx.push({ t: r3(c0 + 0.05), asset_ref: CM_SFX['hard-hit'], event: 'hard-hit', gain_db: -4, rule_id: 'cm.sfx.logo_in' });
    } else if (show.kind === 'stat') {
      const cd = r3(Math.min(1.2, Math.max(0.6, len * 0.4)));
      inserts.push({ t0: c0, t1: c1, kind: KIND.stat, frame: 'card_box', label: `${show.prefix ?? ''}${show.value}${show.suffix ?? ''}`, asset_ref: ref, rule_id: 'cm.stat', params: { value: show.value, decimals: show.decimals ?? 0, prefix: show.prefix ?? '', suffix: show.suffix ?? '', label: show.label?.toUpperCase(), bar: Math.max(0, Math.min(1, show.bar ?? 0.86)), foot: show.foot, count_at: r3(c0 + 0.25), count_dur: cd } });
      sfx.push({ t: r3(c0 + 0.25), asset_ref: CM_SFX['build'], event: 'build', gain_db: -4, rule_id: 'cm.sfx.count' });
      sfx.push({ t: r3(c0 + 0.25 + cd), asset_ref: CM_SFX['pop'], event: 'pop', rule_id: 'cm.sfx.stat_pop' });
      // the camera answers the number: a pulse when the count lands
      const sh = [...shots].reverse().find(x => x.t_in <= c0 + 0.25 + cd)!;
      // the camera's pulse (library move `pulse`) on top of the push: a quick 8% kick and back, the push keeps going
      const tl = r3(c0 + 0.25 + cd - 0.05), keys = sh.zoom ?? [], prev = [...keys].reverse().find(z => z.t <= tl) ?? { scale: 1, cx: 0.5, cy: 0.5 };
      if (tl + 0.2 < t1) sh.zoom = [...keys, { t: tl, scale: r4(prev.scale * 1.08), cx: prev.cx, cy: prev.cy, ease: 'out' as const, dur: 0.1, rule_id: 'cm.camera.pulse' }, { t: r3(tl + 0.12), scale: prev.scale, cx: prev.cx, cy: prev.cy, ease: 'out' as const, dur: 0.3, rule_id: 'cm.camera.pulse' }]
        .filter((z, k, a) => !(z.rule_id !== 'cm.camera.pulse' && z.t > tl - 0.01 && z.t < tl + 0.13)).sort((a, b) => a.t - b.t);
    } else if (show.kind === 'compare') {
      const at = [r3(c0 + 0.2), r3(c0 + 0.2 + Math.min(0.9, len * 0.3))];
      inserts.push({ t0: c0, t1: c1, kind: KIND.compare, frame: 'card_box', label: `${show.a.label} vs ${show.b.label}`, asset_ref: ref, rule_id: 'cm.compare', params: { a: show.a, b: show.b, at } });
      at.forEach(t => sfx.push({ t, asset_ref: CM_SFX['card-in'], event: 'card-in', rule_id: 'cm.sfx.compare_in' }));
      sfx.push({ t: r3(at[1]! + 0.1), asset_ref: CM_SFX['hard-hit'], event: 'hard-hit', gain_db: -5, rule_id: 'cm.sfx.vs' });
    } else if (show.kind === 'list') {
      const at = show.items.map((_, k) => r3(c0 + 0.15 + k * Math.min(0.55, (len * 0.6) / Math.max(1, show.items.length))));
      inserts.push({ t0: c0, t1: c1, kind: KIND.list, frame: 'card_box', label: show.items.map(x => x.text).join(' / '), asset_ref: ref, rule_id: 'cm.list', params: { items: show.items.map(x => ({ icon: CM_ICONS.includes(x.icon) ? x.icon : 'star', text: x.text })), at } });
      at.forEach(t => sfx.push({ t, asset_ref: CM_SFX['list-item'], event: 'list-item', rule_id: 'cm.sfx.list_item' }));
    } else if (show.kind === 'filmstrip') {
      const imgs = (show.images ?? o.stills?.[i] ?? []).slice(0, 3);
      const at = [0, 1, 2].map(k => r3(c0 + 0.1 + k * 0.28));
      inserts.push({ t0: c0, t1: c1, kind: KIND.filmstrip, frame: 'card_box', label: show.label ?? 'filmstrip', asset_ref: ref, rule_id: 'cm.filmstrip', params: { images: imgs, at, label: show.label?.toUpperCase() } });
      at.forEach(t => sfx.push({ t, asset_ref: CM_SFX['paper-pop'], event: 'paper-pop', rule_id: 'cm.sfx.still_in' }));
    } else if (show.kind === 'callout') {
      const labels = show.labels.slice(0, 3), at = labels.map((_, k) => r3(c0 + 0.2 + k * Math.min(0.5, len * 0.22)));
      inserts.push({ t0: c0, t1: c1, kind: KIND.callout, frame: 'full', label: labels.join(' / '), asset_ref: ref, rule_id: 'cm.callout', params: { labels: labels.map(l => l.toUpperCase()), at, ...(show.title ? { title: show.title.toUpperCase() } : {}) } });
      at.forEach(t => sfx.push({ t, asset_ref: CM_SFX['list-item'], event: 'list-item', gain_db: -2, rule_id: 'cm.sfx.callout' }));
    } else if (show.kind === 'obj3d') {
      inserts.push({ t0: c0, t1: c1, kind: KIND.obj3d, frame: 'card_box', label: show.label ?? show.obj, asset_ref: ref, rule_id: 'cm.obj3d', params: { obj: show.obj, label: show.label?.toUpperCase(), sub: show.sub?.toUpperCase() } });
      sfx.push({ t: r3(c0 + 0.05), asset_ref: CM_SFX['ui-reveal'], event: 'ui-reveal', gain_db: -3, rule_id: 'cm.sfx.obj_in' });
    }
    // the entrance's library camera move (3D: the card turns in as it lands), on the component this window placed
    const placedIns = inserts[before];
    if (enter && placedIns) placedIns.params = { ...(placedIns.params ?? {}), enter };
    }
  }
  if (s.end) {
    const i = nBeats - 1, t0 = starts[i]!, e0 = r3(t0 + 0.1);
    const [wa, wb] = spans[i]!;
    const qWords = markedWords(s.end.question), lw = edlWords.slice(wa, wb), used = new Set<number>();
    const placed = qWords.map((x, j) => { const k = lw.findIndex((w, q) => !used.has(q) && norm(w.text) === norm(x.text)); if (k >= 0) used.add(k); return { text: x.text, accent: x.accent, at: r3(k >= 0 ? Math.max(e0 + 0.1, lw[k]!.src_t0 - 0.04) : e0 + 0.15 + j * 0.2) }; });
    const lastQ = placed.at(-1)?.at ?? e0;
    inserts.push({ t0: e0, t1: D, kind: KIND.end, frame: 'full', label: spoken(s.end.question), asset_ref: `${CM_ID}:end`, rule_id: 'cm.end', params: { words: placed, cta: s.end.cta, ...(brand ? { brand } : {}), brand_at: r3(lastQ + 0.45), ...(s.end.qr ? { qr: s.end.qr } : {}), hide_captions: true } });
    sfx.push({ t: r3(lastQ + 0.45), asset_ref: CM_SFX['hard-hit'], event: 'hard-hit', gain_db: -3, rule_id: 'cm.sfx.end_hit' });
    sfx.push({ t: r3(lastQ + 0.9), asset_ref: CM_SFX['cta'], event: 'cta', rule_id: 'cm.sfx.cta' });
  }
  sfx.sort((a, b) => a.t - b.t);
  // two sounds closer than 90 ms blur into one: keep the earlier
  const sfxOut = sfx.filter((x, k) => x.t <= D && (k === 0 || x.t - sfx[k - 1]!.t >= 0.09));
  const edl: CmEdl = {
    version: EDL_VERSION, style_id: CM_ID, style_variant: theme, seed: o.seed ?? 1, rules_version: `${CM_ID}@${CM_VERSION}`,
    source: { file: o.source.file, duration: o.source.duration, w: o.source.w, h: o.source.h, fps: o.source.fps },
    output: { ...(o.output ?? { w: 1080, h: 1920, fps: 30 }), aspect: '9:16' },
    palette: { ...pal }, caption_style_id: 'punch-duo',
    template: { id: CM_ID, version: CM_VERSION, brand, theme, ...(s.credit ? { credit: s.credit.toUpperCase() } : {}) },
    words: edlWords, shots, inserts, beats,
    overlays: [
      // the brand pill only when the user gave a brand (no default, never a hard-coded name)
      ...(brand ? [{ t0: 0, t1: D, kind: 'header_strip' as const, text: brand.toUpperCase(), rule_id: 'cm.brand', params: { place: 'top-center' } }] : []),
      { t0: 0, t1: D, kind: 'grain', rule_id: 'cm.dust', params: { particles: 54, shape: theme === 'gaming' ? 'square' : 'dot' } },
      { t0: 0, t1: D, kind: 'vignette', rule_id: 'cm.vignette', params: { strength: 0.6 } },
    ],
    sfx: sfxOut,
    music: { asset_ref: 'music:bed', gain_db: -26, duck: { db: -8, attack_ms: 80, release_ms: 400 }, end: 'fade', fade: 1.2, rule_id: 'cm.music' },
    voice: { clean: 'none', target_lufs: -14, true_peak: -1.5 },
    ...(s.end ? { end: { kind: 'cta_comment' as const, t0: r3(starts[nBeats - 1]! + 0.1), title: spoken(s.end.question), line: s.end.cta, rule_id: 'cm.end' } } : {}),
  };
  Object.assign(edl, cmCaption(edl, o.look));
  edl.metrics = metricsOf(edl);
  return edl;
}

/** Where each beat's footage goes on the plate (topic mode): output spans and the search words. */
export function plateSpans(e: CmEdl): { t0: number; t1: number; query: string | null }[] {
  return e.shots.map(s => ({ t0: s.t_in, t1: s.t_out, query: (e.inserts.find(x => x.kind === 'broll' && Math.abs(x.t0 - s.t_in) < 0.01)?.query) ?? null }));
}

/**
 * Video mode: dress an edit the builder already made from the user's own clip (its words, shots and timing stay) in
 * the template: brand, dust, the caption style, a kicker on each sentence's first beat, a stat on each spoken number,
 * Mixkit b-roll cut-ins (drawn full bleed over the clip) on the given beats, and the end card.
 */
export function dressEdl(base: Edl, o: { brand?: string; theme?: CmTheme; credit?: string; kickers?: { t: number; text: string }[]; broll?: { t0: number; t1: number; file: string; query?: string }[]; end?: { question: string; cta?: string }; look?: number | string }): CmEdl {
  const brand = o.brand?.trim() ?? '', theme = o.theme ?? 'gaming', pal = CM_THEMES[theme];
  const D = base.shots.at(-1)!.t_out;
  const inserts: Ins[] = [...(base.inserts ?? [])], sfx: CmSfx[] = [];
  for (const k of o.kickers ?? []) {
    const t0 = r3(Math.max(0, Math.min(D - 0.5, k.t))), t1 = r3(Math.min(D, t0 + 2.4));
    inserts.push({ t0, t1, kind: 'title', frame: 'card_box', label: k.text.toUpperCase(), asset_ref: `${CM_ID}:kicker`, rule_id: 'cm.kicker', params: { text: k.text.toUpperCase(), credit: o.credit?.toUpperCase() } });
    sfx.push({ t: r3(t0 + 0.04), asset_ref: CM_SFX['card-in'], event: 'card-in', rule_id: 'cm.sfx.chip_in' });
  }
  for (const b of o.broll ?? []) {
    inserts.push({ t0: r3(b.t0), t1: r3(Math.min(D, b.t1)), kind: 'broll', frame: 'full', query: b.query, rule_id: 'cm.broll.cutin', params: { file: b.file, src_in: 0 } });
    sfx.push({ t: r3(Math.max(0, b.t0 - 0.1)), asset_ref: CM_SFX['scene'], event: 'scene', rule_id: 'cm.sfx.broll_in' });
  }
  if (o.end) {
    const e0 = r3(Math.max(0, D - 2.6));
    const placed = markedWords(o.end.question).map((x, j) => ({ text: x.text, accent: x.accent, at: r3(e0 + 0.15 + j * 0.2) }));
    inserts.push({ t0: e0, t1: D, kind: 'title', frame: 'full', label: spoken(o.end.question), asset_ref: `${CM_ID}:end`, rule_id: 'cm.end', params: { words: placed, cta: o.end.cta, ...(brand ? { brand } : {}), brand_at: r3(e0 + 0.15 + placed.length * 0.2 + 0.3), hide_captions: true } });
    sfx.push({ t: r3(e0 + 0.6), asset_ref: CM_SFX['hard-hit'], event: 'hard-hit', rule_id: 'cm.sfx.end_hit' });
  }
  const out: CmEdl = {
    ...base, style_id: CM_ID, style_variant: theme, palette: { ...pal }, caption_style_id: base.caption_style_id,
    template: { id: CM_ID, version: CM_VERSION, brand, theme, ...(o.credit ? { credit: o.credit.toUpperCase() } : {}) },
    inserts: inserts.sort((a, b) => a.t0 - b.t0),
    overlays: [...(base.overlays ?? []), ...(brand ? [{ t0: 0, t1: D, kind: 'header_strip' as const, text: brand.toUpperCase(), rule_id: 'cm.brand' }] : []), { t0: 0, t1: D, kind: 'grain', rule_id: 'cm.dust', params: { particles: 40, shape: theme === 'gaming' ? 'square' : 'dot' } }],
    sfx: [...(base.sfx ?? []), ...sfx].sort((a, b) => a.t - b.t),
  };
  Object.assign(out, cmCaption(out, o.look));
  out.metrics = metricsOf(out);
  return out;
}
