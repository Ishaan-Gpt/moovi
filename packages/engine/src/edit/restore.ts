import { execFile } from 'node:child_process';
import { existsSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { config } from '../config';

/**
 * The picture restore for weak uploads (WhatsApp forwards, screen grabs, old phones): ffmpeg alone, on the server, beside
 * the preview like the voice clean-up. A clip is weak when its short side is under 900 px or its bitrate is starved
 * (under 0.06 bits per pixel per frame). The chain, in this order because each step feeds the next:
 *   deblock      the 8 px macroblock edges a heavy H.264 squeeze leaves (they get louder when anything is enlarged)
 *   hqdn3d       a light spatial + temporal denoise for the mosquito noise round edges (kept low: no plastic skin)
 *   scale        lanczos to a 1080 px short side (the browser's own bilinear stretch is what made it look smeared)
 *   gradfun      debanding on flat walls and skies (compression turns gradients into steps)
 *   cas          contrast-adaptive sharpening tuned for upscales (restores edge contrast without halos)
 * Measured on the 848x478 WhatsApp test clip (19 s): 34 s on 2 threads, 13 MB at crf 18. It cannot invent detail that
 * was never filmed (only a super-resolution model can, and none fits the 2 GB server), so the camera keeps its own cap
 * too: castMaxZoom (job.ts) never pushes a 478 px source past about 1.2x.
 */
export interface Restored { file: string; seconds: number; from: { w: number; h: number; bpp: number }; to: { w: number; h: number }; chain: string; restored: boolean; graded: string | null }

/**
 * A grade baked into the file: the colour part as a 3D LUT exported from the grade shader itself (scripts/grade-lut.ts, so
 * the MP4 and the preview match what the owner graded), the spatial part (sharpen, vignette, grain, the grader's own
 * 0..100 sliders) by ffmpeg filters. Baking it means the preview draws the video straight, with no per-frame WebGL pass.
 */
export interface BakedGrade { id: string; lut: string; sharpen?: number; vignette?: number; grain?: number }
/** a path inside an ffmpeg filter graph: forward slashes, quoted, the drive colon escaped (Windows broke arnndn too) */
const ffPath = (p: string) => `'${p.replace(/\\/g, '/').replace(/'/g, '').replace(/:/g, '\\:')}'`;
export function gradeChain(g: BakedGrade): string[] {
  return [
    `lut3d=file=${ffPath(g.lut)}:interp=tetrahedral`,
    ...(g.vignette ? [`vignette=angle=${(Math.PI / (7 - g.vignette / 25)).toFixed(3)}`] : []),
    ...(g.grain ? [`noise=alls=${Math.max(1, Math.round(g.grain * 0.55))}:allf=t`] : []),
  ];
}

const KITS = join(import.meta.dirname, '..', '..', '..', 'library', 'src', 'kits', 'motion');
/** An owner grade (kits/motion/grade-presets.json) with its LUT (kits/motion/luts/<id>.cube); null when either is missing. */
export function ownerGrade(id = 'natural-punch'): BakedGrade | null {
  const lut = join(KITS, 'luts', `${id}.cube`);
  if (!existsSync(lut)) return null;
  try {
    const s = (JSON.parse(readFileSync(join(KITS, 'grade-presets.json'), 'utf8')) as Record<string, { settings: Record<string, number> }>)[id]?.settings;
    return s ? { id, lut, sharpen: s.sharpen ?? 0, vignette: s.vignette ?? 0, grain: s.grain ?? 0 } : null;
  } catch { return null; }
}

/** Bits per pixel per frame: how starved the encode is (a clean 1080p phone clip sits around 0.1-0.2). */
export const bitsPerPixel = (bytes: number, duration: number, w: number, h: number, fps: number) => duration > 0 && w > 0 && h > 0 && fps > 0 ? (bytes * 8 / duration) / (w * h * fps) : 1;

export function needsRestore(s: { w: number; h: number; bpp: number }): boolean {
  return Math.min(s.w, s.h) < 900 || s.bpp < 0.06;
}

/** The filter chain for a source: a weak clip is cleaned and (under 1080) upscaled; a grade, when given, is baked in. */
export function restoreChain(s: { w: number; h: number; bpp: number }, short = 1080, grade?: BakedGrade): string {
  const landscape = s.w >= s.h, up = Math.min(s.w, s.h) < short, weak = needsRestore(s);
  const starved = s.bpp < 0.06, sharpen = Math.min(0.9, (weak ? (up ? 0.5 : 0.35) : 0.15) + (grade?.sharpen ?? 0) / 200);
  return [
    ...(weak ? ['deblock=filter=strong:block=8', `hqdn3d=${starved ? '2:1.5:5:4' : '1.5:1.5:4:3'}`] : []),
    ...(weak && up ? [landscape ? `scale=-2:${short}:flags=lanczos` : `scale=${short}:-2:flags=lanczos`] : []),
    ...(weak ? ['gradfun=strength=1.2:radius=16'] : []),
    ...(grade ? gradeChain(grade).slice(0, 1) : []),
    `cas=strength=${sharpen.toFixed(2)}`,
    ...(grade ? gradeChain(grade).slice(1) : []),
  ].join(',');
}

const ff = (args: string[], ms: number) => new Promise<void>((res, rej) =>
  execFile(config.ffmpeg, ['-nostdin', '-hide_banner', '-v', 'error', ...args], { timeout: ms, killSignal: 'SIGKILL', maxBuffer: 8 << 20 }, (e, _o, err) => e ? rej(new Error(String(err).slice(-300) || String(e))) : res()));

/**
 * Restore `src` into `out` when it is weak, and bake `grade` in when given; resolves null when there is nothing to do. The audio is
 * copied untouched (the voice has its own clean-up). Threads default to 2 so the worker keeps a core for the preview.
 */
export async function restoreVideo(src: string, out: string, p: { w: number; h: number; fps: number; duration: number }, o: { threads?: number; force?: boolean; grade?: BakedGrade } = {}): Promise<Restored | null> {
  const bpp = bitsPerPixel(statSync(src).size, p.duration, p.w, p.h, p.fps), from = { w: p.w, h: p.h, bpp: +bpp.toFixed(3) }, weak = needsRestore(from);
  if (!o.force && !weak && !o.grade) return null;
  const chain = restoreChain(from, 1080, o.grade), t0 = Date.now();
  await ff(['-y', '-threads', String(o.threads ?? 2), '-i', src, '-vf', chain, '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '18', '-pix_fmt', 'yuv420p', '-c:a', 'copy', '-movflags', '+faststart', out],
    Math.max(120_000, p.duration * 20_000));
  const up = weak && Math.min(p.w, p.h) < 1080, k = up ? 1080 / Math.min(p.w, p.h) : 1;
  const to = { w: Math.round(p.w * k / 2) * 2, h: Math.round(p.h * k / 2) * 2 };
  return { file: out, seconds: +((Date.now() - t0) / 1000).toFixed(1), from, to, chain, restored: weak, graded: o.grade?.id ?? null };
}

/**
 * Point the edit at the restored file: edl.json's source becomes it (same aspect, same timing; faces and framing are
 * fractions of the frame, so nothing else moves). The next load of the preview and every MP4 render use it.
 */
export function useRestored(dir: string, r: Restored, name = 'hd.mp4'): void {
  const f = join(dir, 'edl.json'), e = JSON.parse(readFileSync(f, 'utf8')) as { source: { file: string; w: number; h: number } };
  e.source.file = name; e.source.w = r.to.w; e.source.h = r.to.h;
  writeFileSync(f, JSON.stringify(e, null, 1));
}
