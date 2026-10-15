import { execFile } from 'node:child_process';
import { config } from '../config';
import { probe } from '../bench';

/**
 * The footage judge's eyes before any model looks: a few small frames of the clip, read as pixels, and the faults
 * stock footage really has. Each check names what it saw so a rejected clip carries its reason into the graph.
 *  - bars: letterbox or pillarbox (black bands on two opposite sides while the middle has picture)
 *  - pale: washed out (bright and nearly colourless), like a white slide or an over-exposed plate
 *  - flat: almost no contrast at all (a fade, a blank card, fog)
 *  - banding: so few distinct tones that gradients turn into steps (heavy compression, 8-bit sky)
 *  - green screen: a keying plate (most of the frame one saturated green)
 *  - static: nothing moves between the first and last sample (a still dressed as video)
 *  - small / short: below 480 px on the short side, or under 2 s
 */

export interface Frame { w: number; h: number; rgb: Uint8Array }
export interface Verdict { ok: boolean; why: string[]; stats: { luma: number; sat: number; contrast: number; tones: number; motion: number; bars: boolean; green: number } }

const SAMPLE_W = 96, SAMPLE_H = 96;

function frameStats(f: Frame) {
  const n = f.w * f.h;
  let sum = 0, sum2 = 0, sat = 0, green = 0;
  const tones = new Set<number>();
  for (let i = 0; i < n; i++) {
    const r = f.rgb[i * 3]!, g = f.rgb[i * 3 + 1]!, b = f.rgb[i * 3 + 2]!;
    const y = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
    const s = mx === 0 ? 0 : (mx - mn) / mx;
    sum += y; sum2 += y * y; sat += s;
    tones.add(Math.round(y * 255) >> 2); // 64 bins
    if (g > 90 && g > r * 1.4 && g > b * 1.4 && s > 0.45) green++;
  }
  const mean = sum / n;
  return { luma: mean, contrast: Math.sqrt(Math.max(0, sum2 / n - mean * mean)), sat: sat / n, tones: tones.size, green: green / n };
}

/** Mean luma of a band of rows or columns (0..1). */
function band(f: Frame, axis: 'rows' | 'cols', from: number, to: number) {
  let s = 0, k = 0;
  const [a0, a1] = [Math.floor(from), Math.ceil(to)];
  for (let a = a0; a < a1; a++) {
    const len = axis === 'rows' ? f.w : f.h;
    for (let b = 0; b < len; b++) {
      const i = axis === 'rows' ? a * f.w + b : b * f.w + a;
      s += (0.2126 * f.rgb[i * 3]! + 0.7152 * f.rgb[i * 3 + 1]! + 0.0722 * f.rgb[i * 3 + 2]!) / 255; k++;
    }
  }
  return k ? s / k : 0;
}
export function hasBars(f: Frame): boolean {
  const mid = band(f, 'rows', f.h * 0.35, f.h * 0.65);
  if (mid < 0.08) return false; // a dark shot, not bars
  const top = band(f, 'rows', 0, f.h * 0.08), bottom = band(f, 'rows', f.h * 0.92, f.h);
  const left = band(f, 'cols', 0, f.w * 0.08), right = band(f, 'cols', f.w * 0.92, f.w);
  return (top < 0.035 && bottom < 0.035) || (left < 0.035 && right < 0.035);
}
function motion(a: Frame, b: Frame) {
  let d = 0;
  for (let i = 0; i < a.rgb.length; i++) d += Math.abs(a.rgb[i]! - b.rgb[i]!);
  return d / a.rgb.length / 255;
}

/** The verdict on sampled frames (pure: tests feed it synthetic frames). */
export function judgeFrames(frames: Frame[], meta: { width?: number; height?: number; duration?: number } = {}): Verdict {
  const st = frames.map(frameStats);
  const avg = (k: keyof (typeof st)[0]) => st.reduce((s, x) => s + x[k], 0) / Math.max(1, st.length);
  const stats = {
    luma: +avg('luma').toFixed(3), sat: +avg('sat').toFixed(3), contrast: +avg('contrast').toFixed(3), tones: Math.round(avg('tones')),
    motion: frames.length > 1 ? +motion(frames[0]!, frames[frames.length - 1]!).toFixed(4) : 1,
    bars: frames.filter(hasBars).length * 2 > frames.length, green: +avg('green').toFixed(3),
  };
  const why: string[] = [];
  if (Math.min(meta.width ?? 9999, meta.height ?? 9999) < 480) why.push(`small (${meta.width}×${meta.height})`);
  if (meta.duration !== undefined && meta.duration < 2) why.push(`short (${meta.duration.toFixed(1)} s)`);
  if (stats.bars) why.push('black bars');
  if (stats.luma > 0.72 && stats.sat < 0.1) why.push('pale, washed out');
  if (stats.contrast < 0.045) why.push('flat, no contrast');
  else if (stats.tones < 14) why.push(`banding (${stats.tones} tones)`);
  if (stats.green > 0.4) why.push('green screen plate');
  if (stats.motion < 0.004) why.push('static, nothing moves');
  return { ok: why.length === 0, why, stats };
}

/** One frame at `t` seconds, scaled to the sample size, as raw RGB (ffmpeg). */
export function grab(file: string, t: number): Promise<Frame> {
  return new Promise((res, rej) => {
    execFile(config.ffmpeg, ['-v', 'error', '-ss', t.toFixed(2), '-i', file, '-frames:v', '1', '-vf', `scale=${SAMPLE_W}:${SAMPLE_H}`, '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'],
      { encoding: 'buffer', timeout: 60_000, maxBuffer: 8 * 1024 * 1024 }, (err, out) => {
        if (err) return rej(new Error(`ffmpeg could not read a frame at ${t.toFixed(1)} s: ${String(err.message).slice(0, 200)}`));
        if (out.length < SAMPLE_W * SAMPLE_H * 3) return rej(new Error(`no frame at ${t.toFixed(1)} s`));
        res({ w: SAMPLE_W, h: SAMPLE_H, rgb: new Uint8Array(out.subarray(0, SAMPLE_W * SAMPLE_H * 3)) });
      });
  });
}

/** Probe the file, sample frames at 20 / 50 / 80 % and judge them. */
export async function checkClip(file: string): Promise<Verdict & { duration: number; width: number; height: number }> {
  const p = await probe(file);
  if (!p.hasVideo) return { ok: false, why: ['no video stream'], stats: { luma: 0, sat: 0, contrast: 0, tones: 0, motion: 0, bars: false, green: 0 }, duration: p.duration, width: 0, height: 0 };
  const frames: Frame[] = [];
  for (const k of [0.2, 0.5, 0.8]) frames.push(await grab(file, p.duration * k));
  const v = judgeFrames(frames, { width: p.width, height: p.height, duration: p.duration });
  return { ...v, duration: p.duration, width: p.width ?? 0, height: p.height ?? 0 };
}
