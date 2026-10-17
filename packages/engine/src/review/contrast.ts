/**
 * Contrast on real pixels: the rendered frame under a caption box, read back with ffmpeg as raw RGB, against the
 * caption's fill colour (WCAG 2 relative luminance and contrast ratio). Text pixels (close to the fill) are left out,
 * so what is measured is the fill against what is really behind it.
 */
import { execFile } from 'node:child_process';
import { config } from '../config';
import type { Box } from './types';

export function hexRgb(c: string): [number, number, number] | null {
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(c.trim()); if (!m) return null;
  const h = m[1]!.length === 3 ? m[1]!.split('').map(x => x + x).join('') : m[1]!;
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}
const lin = (v: number) => { const s = v / 255; return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4); };
export const luminance = (r: number, g: number, b: number) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
export const ratio = (l1: number, l2: number) => (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);

/**
 * The fill's contrast against the background pixels of an RGB24 region: pixels within `near` (0..441) of the fill or
 * of the stroke colour count as text and are skipped; the background is the median luminance of the rest.
 */
export function regionContrast(rgb: Uint8Array, fill: [number, number, number], o: { stroke?: [number, number, number]; near?: number } = {}): { ratio: number; bg: number; text: number } {
  const near = o.near ?? 60, lf = luminance(...fill), ls: number[] = [];
  let text = 0;
  const d = (r: number, g: number, b: number, c: [number, number, number]) => Math.hypot(r - c[0], g - c[1], b - c[2]);
  for (let i = 0; i + 2 < rgb.length; i += 3) {
    const r = rgb[i]!, g = rgb[i + 1]!, b = rgb[i + 2]!;
    if (d(r, g, b, fill) < near || (o.stroke && d(r, g, b, o.stroke) < near)) { text++; continue; }
    ls.push(luminance(r, g, b));
  }
  // almost every pixel matches the fill: the text sits on its own colour
  if (ls.length < (ls.length + text) * 0.1) return { ratio: 1, bg: lf, text };
  ls.sort((a, b) => a - b);
  const bg = ls[Math.floor(ls.length / 2)]!;
  return { ratio: +ratio(lf, bg).toFixed(2), bg, text };
}

/** One frame's region as RGB24 from a video file (ffmpeg seek + crop), or null when ffmpeg cannot read it. */
export function sampleBox(file: string, t: number, box: Box, W: number, H: number): Promise<Uint8Array | null> {
  const x = Math.max(0, Math.floor(box.x0 * W)), y = Math.max(0, Math.floor(box.y0 * H));
  const w = Math.max(2, Math.min(W - x, Math.ceil((box.x1 - box.x0) * W))), h = Math.max(2, Math.min(H - y, Math.ceil((box.y1 - box.y0) * H)));
  const args = ['-v', 'error', '-ss', t.toFixed(3), '-i', file, '-frames:v', '1', '-vf', `scale=${W}:${H},crop=${w}:${h}:${x}:${y}`, '-f', 'rawvideo', '-pix_fmt', 'rgb24', 'pipe:1'];
  return new Promise(res => {
    execFile(config.ffmpeg, args, { encoding: 'buffer', maxBuffer: 64 << 20, timeout: 30_000, killSignal: 'SIGKILL' }, (err, out) => res(err || !out || out.length < w * h * 3 ? null : new Uint8Array(out.subarray(0, w * h * 3))));
  });
}

/** One frame saved as a JPEG (the proof frames of a review), true when written. */
export function saveFrame(file: string, t: number, out: string): Promise<boolean> {
  return new Promise(res => execFile(config.ffmpeg, ['-v', 'error', '-y', '-ss', t.toFixed(3), '-i', file, '-frames:v', '1', '-q:v', '4', out], { timeout: 30_000, killSignal: 'SIGKILL' }, err => res(!err)));
}
