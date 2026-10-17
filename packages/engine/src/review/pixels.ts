/**
 * A pixel check for an edit (reEdit has no render): the source picture under each sampled caption box, placed the way
 * the render places it (render.ts placeAt, the same numbers the player draws), read back with ffmpeg and measured
 * against the caption's ink (the run's caption look first). One frame per sampled chunk, at most 3, no MP4 written.
 * What it does not see: the style's grade and the cards drawn over the picture (the render's own check covers those).
 */
import { execFile } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { config } from '../config';
import { EDIT, type PlayerEdl } from '../edit/lib';
import { placeAt } from '../edit/render';
import { reviewConfig, type ReviewConfig } from './config';
import { luminance, ratio, regionContrast } from './contrast';
import { captionBoxes, styleOf } from './geometry';
import { captionInk, checkEdl, pickFrames } from './runner';
import type { Box, Issue } from './types';

/** The source frame under a box at output second t, as RGB24 at the output size, or null when it cannot be read. */
export function sourceBox(e: PlayerEdl, dir: string, t: number, box: Box, W: number, H: number): Promise<Uint8Array | null> {
  const src = join(dir, e.source.file);
  if (!existsSync(src)) return Promise.resolve(null);
  const p = placeAt(e, t, W, H), at = EDIT.srcAt(e, t);
  const x = Math.max(0, Math.floor(box.x0 * W)), y = Math.max(0, Math.floor(box.y0 * H));
  const w = Math.max(2, Math.min(W - x, Math.ceil((box.x1 - box.x0) * W))), h = Math.max(2, Math.min(H - y, Math.ceil((box.y1 - box.y0) * H)));
  const graph = `color=c=black:s=${W}x${H}[bg];[0:v]setpts=PTS-STARTPTS,scale=${p.sw}:${p.sh}[fg];[bg][fg]overlay=${p.x}:${p.y}:shortest=1:eof_action=endall,crop=${w}:${h}:${x}:${y},format=rgb24[v]`;
  const args = ['-v', 'error', '-ss', at.toFixed(3), '-i', src, '-filter_complex', graph, '-map', '[v]', '-frames:v', '1', '-f', 'rawvideo', 'pipe:1'];
  return new Promise(res => {
    execFile(config.ffmpeg, args, { encoding: 'buffer', maxBuffer: 64 << 20, timeout: 30_000, killSignal: 'SIGKILL' }, (err, out) => res(err || !out || out.length < w * h * 3 ? null : new Uint8Array(out.subarray(0, w * h * 3))));
  });
}

export interface PixelCheck { issues: Issue[]; frames: { t: number; contrast?: number }[]; ms: number; skipped?: string; error?: string }

/** Contrast on the source pixels under up to 3 caption boxes of an EDL in its run folder. Never throws. */
export async function pixelCheckEdl(e: PlayerEdl, dir: string, o: { cfg?: ReviewConfig; w?: number; h?: number } = {}): Promise<PixelCheck> {
  const t0 = Date.now(), done = (x: Partial<PixelCheck>): PixelCheck => ({ issues: [], frames: [], ...x, ms: Date.now() - t0 });
  try {
    const cfg = o.cfg ?? reviewConfig(e), W = o.w ?? (e.output?.w || 720), H = o.h ?? (e.output?.h || 1280);
    if (!existsSync(join(dir, e.source.file))) return done({ skipped: 'no source file in the run folder' });
    const plated = !!styleOf(e).look.box || !!(e.style_laws as { caption_plate?: unknown } | undefined)?.caption_plate;
    if (plated) return done({ skipped: 'captions sit on a plate' });
    const { fill, stroke, strokePx } = captionInk(e, W);
    if (!fill) return done({ skipped: 'no caption fill colour' });
    const strong = !!(stroke && strokePx >= 3 && ratio(luminance(...fill), luminance(...stroke)) >= 4.5);
    const caps = captionBoxes(e, W, H), pick = pickFrames(caps, checkEdl(e, cfg, W, H).issues, cfg.frames);
    const issues: Issue[] = [], frames: PixelCheck['frames'] = [];
    for (const c of pick) {
      const px = await sourceBox(e, dir, c.t, c, W, H);
      const fr: PixelCheck['frames'][number] = { t: +c.t.toFixed(3) };
      if (px) {
        const m = regionContrast(px, fill, stroke ? { stroke } : {}); fr.contrast = m.ratio;
        if (m.ratio < cfg.minContrast && !strong) issues.push({ kind: 'contrast', severity: 'error', t: c.t, chunk: c.chunk, value: m.ratio, msg: `caption "${c.text}" would read at ${m.ratio}:1 on the footage (needs ${cfg.minContrast}:1)` });
      }
      frames.push(fr);
    }
    return done({ issues, frames });
  } catch (err) { return done({ error: String((err as Error)?.message ?? err).slice(0, 200) }); }
}
