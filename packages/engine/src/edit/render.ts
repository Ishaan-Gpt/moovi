import { execFile } from 'node:child_process';
import { existsSync, linkSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { chromium } from 'playwright-core';
import { config } from '../config';
import { servePlayer } from '../s4/player';
import { keepOf } from './edl';
import { EDIT, type PlayerEdl } from './lib';
import { PAGE } from './page';
import { cleanVoice } from './voice';

/**
 * D1.8: the MP4 from the EDL. Deterministic, the same geometry the preview player draws (edit/page.ts `draw(t)`):
 *
 * 1. Picture, per shot, by ffmpeg: for every output frame the source is scaled and placed exactly as the player's
 *    <video> is (object-fit cover or contain, object-position from EDIT.cropAt, the CSS scale(s) about framingAt's
 *    centre), computed here from the same EDIT functions and sent to ffmpeg as per-frame commands (sendcmd on a
 *    scale and an overlay). A 'fit' shot sits on the same blurred, darkened copy of itself the player paints.
 *    Shots render in parallel (one ffmpeg each, at most `jobs` at a time).
 * 2. Captions and inserts, by the player page itself (?layer=over, no video): each output frame's caption and insert
 *    state is drawn by the page's own drawCaptions/drawInserts, frames whose drawn markup is identical share one PNG,
 *    and only the distinct ones are screenshotted (transparent).
 * 3. One pass: the shots joined, the overlay on top, the cleaned voice (voice.m4a, made now if missing), H.264.
 *
 * Writes `out`; returns the stage seconds and counts.
 */
export interface RenderOpts { dir: string; out: string; w?: number; h?: number; fps?: number; /** shots rendered at once */ jobs?: number; /** player pages drawing the overlay at once */ pages?: number; crf?: number; keepTemp?: boolean }
export interface RenderResult { out: string; seconds: number; stages: Record<string, number>; frames: number; shots: number; overlays: number; size: number }

/** Where one output frame's picture sits: the source scaled to sw x sh, its top-left at (x, y) of the w x h frame. */
export interface Place { sw: number; sh: number; x: number; y: number; fit: boolean }

/** The player's geometry for output time t at w x h (pure; the player's draw(t) in numbers). */
export function placeAt(e: PlayerEdl, t: number, w: number, h: number): Place {
  const g = e.shots[EDIT.shotAt(e, t)]!, fit = g.layout === 'fit';
  const srcW = e.source.w, srcH = e.source.h;
  const k = fit ? Math.min(w / srcW, h / srcH) : Math.max(w / srcW, h / srcH), dw = srcW * k, dh = srcH * k;
  const c = fit ? { px: 50, py: 50 } : EDIT.cropAt(e, t);
  const offx = (w - dw) * c.px / 100, offy = (h - dh) * c.py / 100;
  const f = EDIT.framingAt(e, t), ox = f.cx * w, oy = f.cy * h, s = f.scale;
  // CSS: transform-origin (ox, oy), scale(s): a point p lands at o + (p - o) * s
  const sw = Math.max(2, Math.round(dw * s)), sh = Math.max(2, Math.round(dh * s));
  return { sw, sh, x: Math.round(ox + (offx - ox) * s), y: Math.round(oy + (offy - oy) * s), fit };
}

/** The frame ranges of each shot on the output clock: shot i covers frames [a, b). */
export function shotFrames(e: PlayerEdl, fps: number): { a: number; b: number; src: number }[] {
  return e.shots.map(s => ({ a: Math.round(s.t_in * fps), b: Math.round(s.t_out * fps), src: s.src_in })).filter(r => r.b > r.a);
}

/** The sendcmd script for one shot: a scale size and an overlay position per output frame, on the shot's own clock. */
export function shotCommands(e: PlayerEdl, r: { a: number; b: number }, fps: number, w: number, h: number): string {
  const lines: string[] = []; let last = '';
  for (let j = r.a; j < r.b; j++) {
    const p = placeAt(e, (j + 0.5) / fps, w, h), key = `${p.sw} ${p.sh} ${p.x} ${p.y}`;
    if (key === last) continue; last = key;
    lines.push(`${((j - r.a) / fps).toFixed(4)} [enter] scale@z w ${p.sw}, scale@z h ${p.sh}, overlay@o x ${p.x}, overlay@o y ${p.y};`);
  }
  return lines.join('\n') + '\n';
}

const run = (cmd: string, args: string[], ms = 600_000) => new Promise<string>((res, rej) =>
  execFile(cmd, args, { timeout: ms, killSignal: 'SIGKILL', maxBuffer: 32 << 20 }, (err, out, se) => err ? rej(new Error(`${cmd} ${args.slice(-1)}: ${String(se).slice(-600) || err.message}`)) : res(String(out))));

async function pool<T>(items: T[], n: number, fn: (x: T, i: number) => Promise<void>) {
  let i = 0; await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => { while (i < items.length) { const k = i++; await fn(items[k]!, k); } }));
}

export async function renderEdl(o: RenderOpts): Promise<RenderResult> {
  const t0 = Date.now(), stages: Record<string, number> = {}; let tl = t0;
  const lap = (k: string) => { stages[k] = +((Date.now() - tl) / 1000).toFixed(2); tl = Date.now(); };
  const e = JSON.parse(readFileSync(join(o.dir, 'edl.json'), 'utf8')) as PlayerEdl;
  const W = o.w ?? 720, H = o.h ?? 1280, fps = o.fps ?? 30, src = join(o.dir, e.source.file);
  const { duration, problems } = EDIT.timeline(e);
  if (problems.length) throw new Error(`EDL: ${problems.join('; ')}`);
  const N = Math.round(duration * fps), tmp = join(o.dir, 'render'); rmSync(tmp, { recursive: true, force: true }); mkdirSync(join(tmp, 'ov'), { recursive: true });
  const ff = config.ffmpeg;

  // the voice on the film's clock (D1.2b), started now beside the picture
  const voiceFile = join(o.dir, 'voice.m4a');
  const voiceP = existsSync(voiceFile) && statSync(voiceFile).size > 1000 ? Promise.resolve(voiceFile)
    : cleanVoice(src, voiceFile, { dir: o.dir, keep: keepOf(e as never) }).then(() => voiceFile).catch(() => null);

  // 1. picture, per shot
  const ranges = shotFrames(e, fps);
  const pic = pool(ranges, o.jobs ?? 3, async (r, i) => {
    const g = e.shots.find(s => Math.round(s.t_in * fps) === r.a)!, n = r.b - r.a, cmd = join(tmp, `s${i}.cmd`);
    writeFileSync(cmd, shotCommands(e, r, fps, W, H));
    const p0 = placeAt(e, (r.a + 0.5) / fps, W, H);
    const bg = p0.fit
      ? `[0:v]fps=${fps},scale=108:192:force_original_aspect_ratio=increase,crop=108:192,scale=${Math.round(W * 1.12)}:${Math.round(H * 1.12)},gblur=sigma=14,crop=${W}:${H},eq=saturation=1.1,colorchannelmixer=rr=.7:gg=.7:bb=.7,format=yuv420p[bg]`
      : `color=c=black:s=${W}x${H}:r=${fps},format=yuv420p[bg]`;
    const graph = `${bg};[0:v]fps=${fps},sendcmd=f='${cmd.replace(/'/g, "\\'")}',scale@z=w=${p0.sw}:h=${p0.sh}:flags=bicubic,format=yuv420p[fg];[bg][fg]overlay@o=x=${p0.x}:y=${p0.y}:eof_action=pass:shortest=0[v]`;
    await run(ff, ['-v', 'error', '-y', '-ss', g.src_in.toFixed(4), '-i', src, '-filter_complex', graph, '-map', '[v]', '-frames:v', String(n), '-an',
      '-c:v', 'libx264', '-preset', 'ultrafast', '-crf', '12', '-g', String(fps), '-pix_fmt', 'yuv420p', '-threads', '2', join(tmp, `s${i}.mp4`)]);
  });

  // 2. captions and inserts from the player page, distinct frames only (alongside the picture)
  let overlays = 0;
  const over = (async () => {
    const srv = await servePlayer(o.dir, 0, PAGE);
    const b = await chromium.launch({ headless: true, ...(config.chrome.path ? { executablePath: config.chrome.path } : { channel: config.chrome.channel }) });
    try {
      const open = async () => {
        const page = await b.newPage({ viewport: { width: W, height: H } });
        await page.goto(`${srv.url}?t=0&layer=over`); await page.waitForFunction('window.__ready || window.__error', null, { timeout: 60_000 });
        const err = await page.evaluate('window.__error'); if (err) throw new Error(String(err));
        return page;
      };
      const pages = await Promise.all(Array.from({ length: Math.max(1, o.pages ?? 3) }, open));
      const ts = Array.from({ length: N }, (_, j) => +((j + 0.5) / fps).toFixed(4));
      const keys = await pages[0]!.evaluate(`window.__overKeys(${JSON.stringify(ts)})`) as string[];
      // one screenshot per distinct drawn state, spread over the pages
      const first = new Map<string, number>(); keys.forEach((k, j) => { if (!first.has(k)) first.set(k, j); });
      const jobs = [...first.entries()].map(([k, j], n) => ({ k, j, f: k === '' ? join(tmp, 'blank.png') : join(tmp, `o${n}.png`) }));
      let next = 0;
      await Promise.all(pages.map(async page => { while (next < jobs.length) { const x = jobs[next++]!; await page.evaluate(`window.__over(${ts[x.j]})`); await page.screenshot({ path: x.f, omitBackground: true }); } }));
      overlays = jobs.filter(x => x.k !== '').length;
      const fileOf = new Map(jobs.map(x => [x.k, x.f]));
      keys.forEach((k, j) => linkSync(fileOf.get(k)!, join(tmp, 'ov', `${String(j).padStart(6, '0')}.png`)));
    } finally { await b.close(); srv.close(); }
  })();
  const since = () => +((Date.now() - t0) / 1000).toFixed(2);
  // picture, overlay and voice run side by side: each stage's seconds are from the render's start
  const [, , voice] = await Promise.all([pic.then(() => { stages.picture = since(); }), over.then(() => { stages.overlay = since(); }), voiceP.then(v => { stages.voice = since(); return v; })]);
  tl = Date.now();

  // 3. one pass
  writeFileSync(join(tmp, 'shots.txt'), ranges.map((_, i) => `file 's${i}.mp4'`).join('\n') + '\n');
  await run(ff, ['-v', 'error', '-y', '-f', 'concat', '-safe', '0', '-i', join(tmp, 'shots.txt'), '-framerate', String(fps), '-i', join(tmp, 'ov', '%06d.png'),
    ...(voice ? ['-i', voice] : []), '-filter_complex', `[0:v]setpts=N/${fps}/TB[p];[1:v]format=rgba[c];[p][c]overlay=0:0:eof_action=pass,format=yuv420p[v]`,
    '-map', '[v]', ...(voice ? ['-map', '2:a', '-c:a', 'aac', '-b:a', '160k'] : []), '-t', (N / fps).toFixed(4), '-r', String(fps),
    '-c:v', 'libx264', '-preset', 'veryfast', '-crf', String(o.crf ?? 20), '-pix_fmt', 'yuv420p', '-movflags', '+faststart', o.out]);
  lap('encode');
  if (!o.keepTemp) rmSync(tmp, { recursive: true, force: true });
  return { out: o.out, seconds: +((Date.now() - t0) / 1000).toFixed(2), stages, frames: N, shots: ranges.length, overlays, size: statSync(o.out).size };
}
