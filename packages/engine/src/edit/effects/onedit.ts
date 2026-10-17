/**
 * The effects on the edit itself (Vignesh, Oct 18: "connect to the effects lib"): the reel effects the plan picked
 * (./auto.ts, on the source clock) drawn over the CUT, so the one video an edit job delivers carries them, instead of
 * a second film over the raw clip. The cut is the plan's shots laid end to end (video and voice, frame exact), the
 * effects and the caption words move to the edit clock, and ./render.ts draws the film over that cut.
 */
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { config } from '../../config';
import { FX } from './catalog';
import type { FxEvent, FxWord } from './plan';

export interface CutShot { t_in: number; t_out: number; src_in: number; src_out: number }

/** The edit time of source time `s`, or null when the edit cut that moment out. Pure. */
export function srcToEdit(shots: CutShot[], s: number): number | null {
  for (const g of shots) if (s >= g.src_in - 1e-3 && s <= g.src_out + 1e-3) return +(g.t_in + Math.min(Math.max(s - g.src_in, 0), g.src_out - g.src_in)).toFixed(3);
  return null;
}

/** The words the edit keeps, on the edit clock (a word whose start was cut is gone with it). Pure. */
export function wordsOnEdit(words: FxWord[], shots: CutShot[]): FxWord[] {
  const out: FxWord[] = [];
  for (const w of words) {
    const t = srcToEdit(shots, w.t); if (t === null) continue;
    const e = srcToEdit(shots, w.end) ?? t + Math.min(0.6, Math.max(0.12, w.end - w.t));
    out.push({ word: w.word, t, end: +Math.max(t + 0.04, e).toFixed(3) });
  }
  return out;
}

/**
 * The planned effects on the edit clock: each starts where its source start landed in the cut and keeps its length
 * (held inside the effect's own min and max, and inside the film); an effect whose start the edit cut is dropped, and
 * so is one that would start under the one before it (one overlay at a time survives the move). Pure.
 */
export function eventsOnEdit(events: FxEvent[], shots: CutShot[], total: number): FxEvent[] {
  const out: FxEvent[] = [];
  for (const e of [...events].sort((a, b) => a.t0 - b.t0)) {
    const t0 = srcToEdit(shots, e.t0); if (t0 === null || t0 > total - 0.3) continue;
    const s = FX[e.fx], len = Math.min(s.max, Math.max(s.min, e.t1 - e.t0)), t1 = +Math.min(total, t0 + len).toFixed(3);
    if (t1 - t0 < Math.min(s.min, 0.3)) continue;
    const prev = [...out].reverse().find(p => FX[p.fx].kind !== 'transition');
    if (s.kind !== 'transition' && prev && t0 < prev.t1) continue;
    // a transition is a move between two moments: never in the first second, never under an effect that is up
    if (s.kind === 'transition' && (t0 < 1 || events.some(p => FX[p.fx].kind !== 'transition' && p !== e && (() => { const a = srcToEdit(shots, p.t0); return a !== null && t0 > a - 0.05 && t0 < a + (p.t1 - p.t0); })()))) continue;
    out.push({ ...e, t0, t1 });
  }
  return out;
}

/** ffmpeg filter that lays the shots end to end, picture and (when `audio`) sound, as [v] and [a]. Pure. */
export function cutFilter(shots: CutShot[], audio: boolean): string {
  const parts: string[] = [], ins: string[] = [];
  shots.forEach((g, i) => {
    const a = g.src_in.toFixed(3), b = (g.src_in + (g.t_out - g.t_in)).toFixed(3);
    parts.push(`[0:v]trim=start=${a}:end=${b},setpts=PTS-STARTPTS[v${i}]`); ins.push(`[v${i}]`);
    if (audio) { parts.push(`[0:a]atrim=start=${a}:end=${b},asetpts=PTS-STARTPTS,afade=t=in:d=0.012,afade=t=out:st=${Math.max(0, +b - +a - 0.012).toFixed(3)}:d=0.012[a${i}]`); ins.push(`[a${i}]`); }
  });
  return `${parts.join(';')};${ins.join('')}concat=n=${shots.length}:v=1:a=${audio ? 1 : 0}${audio ? '[v][a]' : '[v]'}`;
}

/** The cut itself: `src` laid out by the shots into `out` (H.264 + AAC), on the edit clock. */
export async function cutToEdit(src: string, shots: CutShot[], out: string, o: { audio: boolean; fps?: number }): Promise<string> {
  const args = ['-nostdin', '-v', 'error', '-y', '-i', src, '-filter_complex', cutFilter(shots, o.audio), '-map', '[v]', ...(o.audio ? ['-map', '[a]', '-c:a', 'aac', '-b:a', '192k', '-ar', '48000'] : []),
    '-r', String(o.fps ?? 30), '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '17', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', out];
  await new Promise<void>((res, rej) => {
    const p = spawn(config.ffmpeg, args, { stdio: ['ignore', 'ignore', 'pipe'] });
    let err = ''; p.stderr.on('data', d => { err += d; if (err.length > 8000) err = err.slice(-4000); });
    const timer = setTimeout(() => p.kill('SIGKILL'), 600_000);
    p.on('error', e => { clearTimeout(timer); rej(e); });
    p.on('close', c => { clearTimeout(timer); c === 0 ? res() : rej(new Error(`cut: ffmpeg exit ${c}: ${err.slice(-300)}`)); });
  });
  return out;
}

/**
 * The finished edit with its effects: cut `video` (the restored clip when there is one, else the source) by the plan's
 * shots, then draw the effects and the captions over the cut. One video, the edit's own length. `voice` is the plan's
 * cleaned voice (edit/voice.ts, already on the edit clock); without it the cut's own sound plays.
 */
export async function renderEditFx(o: { video: string; shots: CutShot[]; events: FxEvent[]; words: FxWord[]; out: string; work: string; audio: boolean; voice?: string | null; music?: { file: string } | null; fps?: number; onFrame?: (i: number, n: number) => void }): Promise<{ out: string; seconds: number; events: FxEvent[]; renderS: number }> {
  mkdirSync(o.work, { recursive: true });
  const total = +(o.shots.at(-1)?.t_out ?? 0).toFixed(3);
  const cut = await cutToEdit(o.video, o.shots, join(o.work, 'cut.mp4'), { audio: o.audio, fps: o.fps ?? 30 });
  const events = eventsOnEdit(o.events, o.shots, total), words = wordsOnEdit(o.words, o.shots);
  const { renderFxFilm } = await import('./render');
  const r = await renderFxFilm({ video: cut, out: o.out, work: join(o.work, 'fx'), events, words, duration: total, voice: o.voice && existsSync(o.voice) ? { file: o.voice } : o.audio ? 'clip' : null, music: o.music ?? null, ...(o.fps ? { fps: o.fps } : {}), ...(o.onFrame ? { onFrame: o.onFrame } : {}) });
  if (!existsSync(o.out)) throw new Error('the effects edit wrote no file');
  return { out: r.out, seconds: r.seconds, events, renderS: r.renderS };
}
