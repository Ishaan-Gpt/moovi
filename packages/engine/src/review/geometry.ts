/**
 * Where things sit on the frame, from the EDL alone, the way the player draws them (edit/lib.ts and edit/page.ts):
 * each caption chunk's box, each insert's box, the face in output fractions. Widths are estimated from the text when
 * no browser is at hand; a render measures each chunk in the player page itself (render.ts measureCaps) and those
 * measured widths and heights replace the estimate (CHECK part 2).
 */
import { CAPTION_STYLES } from '../edit/captions';
import { EDIT, type CaptionStyle, type PlayerEdl } from '../edit/lib';
import type { Box } from './types';

/** the player's insert frames (page.ts FRAME): x, y, w, h as fractions */
export const INSERT_FRAME: Record<string, [number, number, number, number]> = { full: [0, 0, 1, 1], top_half: [0.04, 0.03, 0.92, 0.44], card_box: [0.12, 0.12, 0.76, 0.34], beside_head: [0.54, 0.16, 0.42, 0.26], top_band: [0.05, 0.035, 0.9, 0.13] };

export const styleOf = (e: PlayerEdl): CaptionStyle => CAPTION_STYLES.find(s => s.id === String(e.caption_style_id).replace(/^caption:/, '')) || CAPTION_STYLES[0]!;

/** the per-run caption look (the EDL's caption_look, a captionseasy style) when the player draws it, the way page.ts reads it */
export function lookOf(e: PlayerEdl, W = e.output?.w || 720) {
  const cl = (e as { caption_look?: { player_style?: unknown; style?: unknown } }).caption_look;
  if (!cl || cl.player_style !== String(e.caption_style_id).replace(/^caption:/, '')) return null;
  return EDIT.lookProps(cl.style, W);
}

/** the caption's base height as the player places it: a repair's caption_y, else the run's caption look, else the style's place */
export function capBase(e: PlayerEdl): number {
  const y = (e.style_laws as { caption_y?: unknown } | undefined)?.caption_y;
  if (typeof y === 'number' && y > 0 && y < 1) return y;
  const lk = lookOf(e);
  return lk && lk.y !== null ? lk.y : EDIT.posY(styleOf(e).position);
}

/** One caption chunk as the player page drew it: its box in output fractions at output second t (render.ts measureCaps). */
export interface MeasuredCap { chunk: number; t: number; x0: number; y0: number; x1: number; y1: number }

export interface CapBox extends Box { chunk: number; t0: number; t1: number; t: number; text: string; words: number; /** width and height from the browser, not the estimate */ measured?: boolean }

/**
 * One box per caption chunk, at the chunk's middle moment, placed off the face the way the player places it. With
 * `measured` (the render's own boxes) a chunk takes its real width and height; its height on the frame is still worked
 * out here, so a repair that moves the captions is checked with the real sizes at the new place.
 */
export function captionBoxes(e: PlayerEdl, W = 720, H = 1280, base = capBase(e), measured?: MeasuredCap[] | null): CapBox[] {
  const st = styleOf(e), ws = EDIT.captionWords(e);
  if (!ws.length) return [];
  const { words, chunks } = EDIT.chunk(ws, st);
  const px = EDIT.sizePx(st.size, W), plate = !!(e.style_laws as { caption_plate?: unknown } | undefined)?.caption_plate;
  const charW = st.font.case === 'upper' ? 0.66 : 0.56, maxW = W - 180;
  return chunks.map((c, k) => {
    const text = c.words.map(i => words[i]!.text).join(' ');
    const raw = text.length * px * charW + (st.look.box || plate ? 52 : 0);
    const lines = Math.max(1, Math.ceil(raw / maxW)), w = Math.min(raw, maxW), h = lines * px * 1.2 + (st.look.box || plate ? 36 : 0);
    const t = (c.t0 + c.t1) / 2, m = measured?.find(x => x.chunk === k && x.x1 > x.x0 && x.y1 > x.y0);
    if (m) {
      const half = Math.max(0.01, (m.y1 - m.y0) / 2), cy = EDIT.capYAt(e, t, base, half);
      return { chunk: k, t0: c.t0, t1: c.t1, t, text, words: c.words.length, x0: m.x0, x1: m.x1, y0: cy - half, y1: cy + half, measured: true };
    }
    const half = Math.max(0.03, h / H / 2);
    const cy = EDIT.capYAt(e, t, base, half);
    return { chunk: k, t0: c.t0, t1: c.t1, t, text, words: c.words.length, x0: 0.5 - w / W / 2, x1: 0.5 + w / W / 2, y0: cy - half, y1: cy + half };
  });
}

export function insertBox(frame: string): Box {
  const f = INSERT_FRAME[frame] ?? INSERT_FRAME.card_box!;
  return { x0: f[0], y0: f[1], x1: f[0] + f[2], y1: f[1] + f[3] };
}

/** the face in output fractions at output second t, or null */
export function faceBox(e: PlayerEdl, t: number): Box | null {
  const f = EDIT.faceOutAt(e, t);
  return f ? { x0: f.x0, y0: f.y0, x1: f.x1, y1: f.y1 } : null;
}

export const area = (b: Box) => Math.max(0, b.x1 - b.x0) * Math.max(0, b.y1 - b.y0);
export function overlap(a: Box, b: Box): number {
  return Math.max(0, Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0)) * Math.max(0, Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0));
}
/** share of a covered by b */
export const coverOf = (a: Box, b: Box) => area(a) > 0 ? overlap(a, b) / area(a) : 0;
