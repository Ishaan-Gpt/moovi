#!/usr/bin/env node
// render.mjs: the film's MP4, rendered the render-easy way (.claude/skills/render-easy):
//   layer 4  code straight to MP4: each frame goes from the page's canvas into a WebCodecs H.264 encoder and an MP4
//            muxer inside the page (vendor/mp4-muxer.js). No screenshots, no PNG/JPEG files, no disk round trip.
//   layer 5  split: the film is cut into chunks that render in parallel worker processes (each its own headless
//            browser), every chunk starting on a key frame after a short unwritten pre-roll, then joined with an
//            ffmpeg stream copy (no re-encode) and muxed with audio/mix.wav.
//   Layers 1-3 (cached light, exact motion vectors, reprojection) are not built in render-easy yet (see its
//   progress.md) and this film's camera moves in every frame, so every frame is a full redraw (the skill's rule:
//   never slower than the baseline).
// node tools/render.mjs [out=out/buddha-hi-720.mp4] [from=0] [to=<end>] [fps=30] [workers=3] [chunk=4] [q=cap=en] [audio=audio/mix.wav] [port=4390]
import { open } from './pw.mjs';
import { spawn, execFileSync } from 'node:child_process';
import { writeFileSync, mkdirSync, readFileSync, rmSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const HERE = dirname(fileURLToPath(import.meta.url)), FILM = resolve(HERE, '..');
const kv = Object.fromEntries(process.argv.slice(2).filter(a => a.includes('=')).map(a => a.split(/=(.*)/s).slice(0, 2)));
const FPS = +(kv.fps || 30), URL_ = `http://localhost:${kv.port || 4390}/hindi-buddha-gta/hi/short.html?embed=1${kv.q ? '&' + kv.q : ''}`;
if (kv.worker) {   // ---- one chunk: frames [f0, f1) ----
  const [f0, f1] = kv.worker.split('-').map(Number), { b, p } = await open(URL_);
  await p.addScriptTag({ path: join(FILM, 'vendor', 'mp4-muxer.js') });
  const res = await p.evaluate(async ({ f0, f1, FPS, PRE, BR }) => {
    const cv = window.frameTo(0), W = cv.width, H = cv.height, t0 = performance.now(); let tR = 0, tE = 0;
    const muxer = new Mp4Muxer.Muxer({ target: new Mp4Muxer.ArrayBufferTarget(), video: { codec: 'avc', width: W, height: H, frameRate: FPS }, fastStart: 'in-memory' });
    let err = null; const enc = new VideoEncoder({ output: (c, m) => muxer.addVideoChunk(c, m), error: e => { err = String(e); } });
    enc.configure({ codec: 'avc1.640028', width: W, height: H, bitrate: +BR, framerate: FPS, latencyMode: 'quality' });
    for (let f = Math.max(0, f0 - PRE); f < f0; f++) window.seek(f / FPS);   // pre-roll: the cloth and any state settle, unwritten
    for (let f = f0; f < f1; f++) { const a = performance.now(); const c = window.frameTo(f / FPS); const m = performance.now();
      const vf = new VideoFrame(c, { timestamp: Math.round((f - f0) * 1e6 / FPS), duration: Math.round(1e6 / FPS) }); enc.encode(vf, { keyFrame: (f - f0) % (FPS * 2) === 0 }); vf.close();
      while (enc.encodeQueueSize > 3) await new Promise(r => setTimeout(r, 2)); tR += m - a; tE += performance.now() - m; if (err) throw new Error(err); }
    await enc.flush(); muxer.finalize(); const u8 = new Uint8Array(muxer.target.buffer); let s = ''; for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000));
    return { b64: btoa(s), frames: f1 - f0, renderMs: Math.round(tR), encodeMs: Math.round(tE), totalMs: Math.round(performance.now() - t0) };
  }, { f0, f1, FPS, PRE: +(kv.preroll || 8), BR: +(kv.bitrate || 6e6) });
  writeFileSync(kv.file, Buffer.from(res.b64, 'base64')); delete res.b64; console.log('CHUNK ' + JSON.stringify(Object.assign({ f0, f1 }, res))); await b.close(); process.exit(0);
}
// ---- the parent: plan chunks, run workers, join ----
const T0 = Date.now(), OUT = resolve(FILM, kv.out || 'out/buddha-hi-720.mp4'), TMP = join(dirname(OUT), '.chunks-' + (kv.q || 'hi').replace(/\W/g, '')); if (!kv.resume) rmSync(TMP, { recursive: true, force: true }); mkdirSync(TMP, { recursive: true });   // resume=1 keeps the chunks already rendered
let dur = +kv.to || 0; if (!dur) { const { b, p } = await open(URL_); dur = await p.evaluate(() => window.DUR); await b.close(); }
const F0 = Math.round(+(kv.from || 0) * FPS), F1 = Math.round(dur * FPS), CH = Math.round(+(kv.chunk || 4) * FPS), jobs = [];
for (let f = F0; f < F1; f += CH) jobs.push({ f0: f, f1: Math.min(F1, f + CH), file: join(TMP, `c${String(jobs.length).padStart(3, '0')}.mp4`) });
const NW = +(kv.workers || 3), stats = []; let next = 0;
await Promise.all(Array.from({ length: NW }, async () => { while (next < jobs.length) { const j = jobs[next++]; if (kv.resume && existsSync(j.file + '.json')) { stats.push(JSON.parse(readFileSync(j.file + '.json', 'utf8'))); continue; }
  await new Promise((ok, bad) => { const c = spawn(process.execPath, [fileURLToPath(import.meta.url), `worker=${j.f0}-${j.f1}`, `file=${j.file}`, ...process.argv.slice(2).filter(a => /^(q|fps|port|preroll|bitrate)=/.test(a))], { stdio: ['ignore', 'pipe', 'pipe'] }); let o = '';
    c.stdout.on('data', d => { o += d; }); c.stderr.on('data', d => { o += d; }); c.on('exit', code => { const m = /CHUNK (\{.*\})/.exec(o); if (code === 0 && m) { stats.push(JSON.parse(m[1])); writeFileSync(j.file + '.json', m[1]); console.log(`[${((Date.now() - T0) / 1000).toFixed(0)} s] chunk ${j.f0}-${j.f1} done (${stats.length}/${jobs.length})`); ok(); } else bad(new Error('chunk failed ' + j.f0 + '\n' + o.slice(-1500))); }); }); } }));
writeFileSync(join(TMP, 'list.txt'), jobs.map(j => `file '${j.file}'`).join('\n'));
const AUDIO = resolve(FILM, kv.audio || (existsSync(join(FILM, 'audio/mix.wav')) ? 'audio/mix.wav' : 'audio/mix.mp3')), hasA = existsSync(AUDIO) && !kv.from;
execFileSync('ffmpeg', ['-v', 'error', '-y', '-f', 'concat', '-safe', '0', '-i', join(TMP, 'list.txt'), ...(hasA ? ['-i', AUDIO, '-c:a', 'aac', '-b:a', '192k', '-shortest'] : []), '-c:v', 'copy', '-movflags', '+faststart', OUT]);
const frames = stats.reduce((a, s) => a + s.frames, 0), rMs = stats.reduce((a, s) => a + s.renderMs, 0), eMs = stats.reduce((a, s) => a + s.encodeMs, 0), wall = (Date.now() - T0) / 1000;
const rep = { out: OUT, frames, fps: FPS, seconds: +(frames / FPS).toFixed(2), workers: NW, chunks: jobs.length, wallSeconds: +wall.toFixed(1), renderMsPerFrame: +(rMs / frames).toFixed(1), encodeMsPerFrame: +(eMs / frames).toFixed(1), wallSecondsPerFilmSecond: +(wall / (frames / FPS)).toFixed(2) };
writeFileSync(OUT.replace(/\.mp4$/, '.render.json'), JSON.stringify(rep, null, 1)); console.log(JSON.stringify(rep)); rmSync(TMP, { recursive: true, force: true });
