import { execFile, spawn } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { chromium } from 'playwright-core';
import { config } from '../config';
import { servePlayer } from '../s4/player';
import { cutFilter } from './effects/onedit';
import { FX_MIX } from './effects/render';
import { EDIT, type PlayerEdl } from './lib';
import { PAGE } from './page';
import { rmsOf, sfxMix } from './render';

/**
 * One film (edit wiring, step 3): the delivered MP4 is the preview page itself, captured frame by frame, so what the
 * person previews is what they get, beat devices, camera, captions, inserts and cuts alike. The clip's frames are laid
 * out on the output clock by ffmpeg (the EDL's shots end to end) into <dir>/film/f<n>.jpg; the page (?capture=1)
 * draws each output frame over its picture exactly as playback draws it; the screenshots are piped to ffmpeg with the
 * film's soundtrack: E.mix when the edit has one (the same track the preview plays), else the cleaned voice and E.sfx.
 */

const run = (cmd: string, args: string[], ms = 600_000) => new Promise<string>((res, rej) =>
  execFile(cmd, args, { timeout: ms, killSignal: 'SIGKILL', maxBuffer: 32 << 20 }, (err, out, se) => err ? rej(new Error(`${cmd}: ${String(se).slice(-500) || err.message}`)) : res(String(out))));

/**
 * The finished soundtrack the preview and the film share (mix.m4a, named by E.mix): the voice at -16 LUFS, a bed
 * `FX_MIX.under` LU under it (the edit+fx film's levels), the EDL's sounds at their library levels, mastered to -14 LUFS.
 */
export async function filmMix(dir: string, o: { voice: string; bed?: { file: string; start?: number } | null; out?: string }): Promise<{ file: string }> {
  const e = JSON.parse(readFileSync(join(dir, 'edl.json'), 'utf8')) as PlayerEdl, D = EDIT.timeline(e).duration.toFixed(3);
  const sdir = join(config.assets, 'sfx'), rms: Record<string, number> = {};
  for (const f of new Set((e.sfx ?? []).map(s => s.file).filter((x): x is string => !!x))) { const v = await rmsOf(join(sdir, f)); if (v !== null) rms[f] = v; }
  const first = o.bed ? 2 : 1, sx = sfxMix(e, sdir, first, rms);
  const parts = [`[0:a]aresample=48000,aformat=channel_layouts=stereo,loudnorm=I=${FX_MIX.voice}:TP=-2:LRA=9,apad=whole_dur=${D},atrim=0:${D}[vo]`], ins = ['[vo]'];
  if (o.bed) { parts.push(`[1:a]aresample=48000,aformat=channel_layouts=stereo,loudnorm=I=${FX_MIX.voice - FX_MIX.under}:TP=-4,atrim=0:${D},afade=t=out:st=${Math.max(0, +D - 1.2).toFixed(2)}:d=1.2[bd]`); ins.push('[bd]'); }
  if (sx.count) { parts.push(sx.filter); for (let i = 0; i < sx.count; i++) ins.push(`[x${i}]`); }
  parts.push(`${ins.join('')}amix=inputs=${ins.length}:normalize=0:duration=first,loudnorm=I=${FX_MIX.master}:TP=${FX_MIX.tp}:LRA=11[a]`);
  const out = o.out ?? join(dir, 'mix.m4a');
  await run(config.ffmpeg, ['-v', 'error', '-y', '-i', o.voice, ...(o.bed ? ['-ss', String(o.bed.start ?? 0), '-i', o.bed.file] : []), ...sx.inputs, '-filter_complex', parts.join(';'), '-map', '[a]', '-t', D, '-c:a', 'aac', '-b:a', '192k', '-ar', '48000', out]);
  return { file: out };
}

export interface FilmOpts { dir: string; out: string; fps?: number; /** output size (default the EDL's) */ w?: number; h?: number; crf?: number; keepTemp?: boolean; onFrame?: (i: number, n: number) => void }
export interface FilmResult { out: string; seconds: number; frames: number; size: number; stages: Record<string, number>; audio: 'mix' | 'voice' | 'none' }

/** Render <dir>/edl.json (with its beat spec) to one MP4 through the preview page. */
export async function renderFilm(o: FilmOpts): Promise<FilmResult> {
  const t0 = Date.now(), stages: Record<string, number> = {}; let tl = t0;
  const lap = (k: string) => { stages[k] = +((Date.now() - tl) / 1000).toFixed(2); tl = Date.now(); };
  const e = JSON.parse(readFileSync(join(o.dir, 'edl.json'), 'utf8')) as PlayerEdl & { mix?: { file: string } };
  const { duration, problems } = EDIT.timeline(e); if (problems.length) throw new Error(`EDL: ${problems.join('; ')}`);
  const fps = o.fps ?? 30, N = Math.round(duration * fps), W = o.w ?? e.output.w, H = o.h ?? e.output.h;
  const fdir = join(o.dir, 'film'); rmSync(fdir, { recursive: true, force: true }); mkdirSync(fdir, { recursive: true });
  // the clip on the output clock, one JPEG per output frame (frame j shows the source at srcAt((j + 0.5) / fps))
  const src = join(o.dir, e.source.file), cap = Math.max(e.source.w, e.source.h) > 1920 ? ',scale=-2:1920' : '';
  await run(config.ffmpeg, ['-v', 'error', '-y', '-i', src, '-filter_complex', `${cutFilter(e.shots, false)};[v]fps=${fps}${cap}[o]`, '-map', '[o]', '-frames:v', String(N), '-q:v', '3', join(fdir, 'f%05d.jpg')]);
  lap('frames');

  const voice = join(o.dir, 'voice.m4a'), mix = e.mix?.file ? join(o.dir, e.mix.file) : null;
  const audio: FilmResult['audio'] = mix && existsSync(mix) ? 'mix' : existsSync(voice) ? 'voice' : 'none';
  const sdir = join(config.assets, 'sfx'), rms: Record<string, number> = {};
  if (audio === 'voice') for (const f of new Set((e.sfx ?? []).map(s => s.file).filter((x): x is string => !!x))) { const v = await rmsOf(join(sdir, f)); if (v !== null) rms[f] = v; }
  const sx = audio === 'voice' ? sfxMix(e, sdir, 2, rms) : { inputs: [], filter: '', count: 0 };
  const aIn = audio === 'mix' ? ['-i', mix!] : audio === 'voice' ? ['-i', voice, ...sx.inputs] : [];
  const aMap = audio === 'none' ? [] : sx.count
    ? ['-filter_complex', `[1:a]aformat=sample_rates=48000:channel_layouts=stereo[vo];${sx.filter};[vo]${Array.from({ length: sx.count }, (_, i) => `[x${i}]`).join('')}amix=inputs=${sx.count + 1}:normalize=0:duration=first[a]`, '-map', '0:v', '-map', '[a]']
    : ['-map', '0:v', '-map', '1:a'];
  const enc = spawn(config.ffmpeg, ['-v', 'error', '-y', '-f', 'image2pipe', '-framerate', String(fps), '-c:v', 'mjpeg', '-i', '-', ...aIn, ...aMap,
    ...(audio !== 'none' ? ['-c:a', 'aac', '-b:a', '192k', '-ar', '48000'] : []), '-t', (N / fps).toFixed(4), '-r', String(fps),
    '-c:v', 'libx264', '-preset', 'veryfast', '-crf', String(o.crf ?? 19), '-pix_fmt', 'yuv420p', '-movflags', '+faststart', o.out], { stdio: ['pipe', 'ignore', 'pipe'] });
  let err = ''; enc.stderr.on('data', d => { err += d; if (err.length > 8000) err = err.slice(-4000); });
  const done = new Promise<void>((res, rej) => { enc.on('error', rej); enc.on('close', c => c === 0 ? res() : rej(new Error(`film encode: ffmpeg exit ${c}: ${err.slice(-400)}`))); });

  const srv = await servePlayer(o.dir, 0, PAGE);
  const b = await chromium.launch({ headless: true, ...(config.chrome.path ? { executablePath: config.chrome.path } : { channel: config.chrome.channel }) });
  try {
    const page = await b.newPage({ viewport: { width: W, height: H } });
    await page.goto(`${srv.url}?t=0&capture=1`); await page.waitForFunction('window.__ready || window.__error', null, { timeout: 60_000 });
    const bad = await page.evaluate('window.__error'); if (bad) throw new Error(String(bad));
    for (let j = 0; j < N; j++) {
      await page.evaluate(`window.__frame(${((j + 0.5) / fps).toFixed(4)}, 'film/f${String(j + 1).padStart(5, '0')}.jpg')`);
      const shot = await page.screenshot({ type: 'jpeg', quality: 92, clip: { x: 0, y: 0, width: W, height: H } });
      if (!enc.stdin.write(shot)) await new Promise(r => enc.stdin.once('drain', r));
      o.onFrame?.(j + 1, N);
    }
    lap('draw');
  } finally { enc.stdin.end(); await b.close(); srv.close(); }
  await done; lap('encode');
  if (!o.keepTemp) rmSync(fdir, { recursive: true, force: true });
  return { out: o.out, seconds: +((Date.now() - t0) / 1000).toFixed(2), frames: N, size: statSync(o.out).size, stages, audio };
}

/** Write E.mix onto the folder's edl.json (the preview then plays the finished soundtrack). */
export function useMix(dir: string, file: string) {
  const f = join(dir, 'edl.json'), e = JSON.parse(readFileSync(f, 'utf8'));
  e.mix = { file: file.replace(/^.*[\\/]/, '') };
  writeFileSync(f, JSON.stringify(e, null, 1));
}
