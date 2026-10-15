// pnpm s1:make <dir> [--n 4] [--chunks 4] [--quality high|balanced] [--keep] [--no-verify]
// Style 1 back half, script-done to final MP4, every stage timed:
//   dir holds <id>.json (the spec), events.json, vo.wav  →  writes <dir>/<id>.mp4 + make-report.json.
//   RENDER  chunked over N parallel Chrome pages (WebCodecs, every frame a keyframe), joined without re-encoding
//   AUDIO   (in parallel with the render) sfx stem + music bed in one cached Python process, voice/bed/sfx amix
//           (same LUFS math as tl_make.py), master to −14 LUFS ±0.3 with a −1 dBTP ceiling, measured in the same pass
//   MUX     chunk join + AAC 256k in a single ffmpeg call
// <dir> must be inside the data dir (the render host only writes there). Media paths in the spec are MotionEasy-root
// relative (styles/…); they are rewritten to the host's /me/ mount.
import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync, renameSync, statSync, writeFileSync, rmSync, mkdirSync } from 'node:fs';
import { basename, join, resolve, sep } from 'node:path';

const args = process.argv.slice(2);
const flag = (k: string) => args.includes(`--${k}`);
const opt = (k: string, d?: string) => { const i = args.indexOf(`--${k}`); return i >= 0 ? args[i + 1] : d; };
const dirArg = args.find((a, i) => !a.startsWith('--') && !['--n', '--chunks', '--quality', '--bed-lu'].includes(args[i - 1] ?? ''));
if (!dirArg) { console.error('usage: s1make <dir> [--n 4] [--chunks N] [--quality high|balanced] [--no-verify]'); process.exit(1); }
const N = Number(opt('n', '4')), CHUNKS = Number(opt('chunks', String(N))), QUALITY = (opt('quality', 'high') as 'high' | 'balanced');
const DRAFT = flag('draft'), INTRA = !flag('no-intra'), FPS = DRAFT ? 15 : Number(opt('fps', '0')), SCALE = DRAFT ? 0.5 : Number(opt('scale', '1'));
process.env.CE_SLOTS_RENDER = String(N); process.env.CE_SLOTS_CHROME = String(N); // the pool must hold N pages

const { config } = await import('../src/config');
const { sh, loudness, ensureDir, probe } = await import('../src/bench');
const { chunk, closeRender } = await import('../src/render/host');

const dir = resolve(process.env.INIT_CWD ?? process.cwd(), dirArg); // pnpm runs scripts in the package dir; INIT_CWD is where you typed it
if (!(dir + sep).startsWith(resolve(config.data) + sep)) throw new Error(`${dir} is outside the data dir (${config.data}); the render host only writes there`);
const ME = config.motioneasy, PY = config.python;
// the spec is <dir name>.json; otherwise the one JSON that isn't a known side file (the fast planner also writes board/plan/scenes)
const specFile = existsSync(join(dir, `${basename(dir)}.json`)) ? `${basename(dir)}.json` : readdirSync(dir).find(f => f.endsWith('.json') && !['events.json', 'words.json', 'make-report.json', 'timeline.json', 'vo-report.json', 'board.json', 'plan.json', 'scenes.json', 'fast-report.json'].includes(f));
if (!specFile) throw new Error(`No <id>.json spec in ${dir}`);
const id = basename(specFile, '.json');
for (const f of ['events.json', 'vo.wav']) if (!existsSync(join(dir, f))) throw new Error(`${dir} has no ${f}`);

const t0 = performance.now();
const T: Record<string, number> = {};
const clock = async <R>(name: string, fn: () => Promise<R>): Promise<R> => { const t = performance.now(); try { return await fn(); } finally { T[name] = +((performance.now() - t) / 1000).toFixed(2); } };
// the spec, with media paths pointed at the host's /me/ mount. Video clips are first re-muxed all-intra and LOSSLESS (x264 -qp 0
// -g 1, cached in data/cache/s1clips): the engine's decoder restarts from the previous keyframe whenever the clip time moves
// backwards (motion-blur sub-frames, loops), so long-GOP clips cost 100-600 ms a frame; intra clips seek for free and decode to
// the same pixels.
const MEDIA = /\.(png|jpe?g|webp|svg|mp4|webm|mov|woff2?|ttf|otf)$/i;
const spec = JSON.parse(readFileSync(join(dir, specFile), 'utf8')) as { fps?: number; props: { timeline: { frames: number; fps: number } } };
const clipUrl = new Map<string, string>();
const refs = new Set<string>();
(function scan(o: unknown) { if (Array.isArray(o)) o.forEach(scan); else if (o && typeof o === 'object') Object.values(o).forEach(scan); else if (typeof o === 'string' && /\.(mp4|mov|webm)$/i.test(o) && !/^(\/|https?:|data:|blob:)/.test(o) && existsSync(join(ME, o))) refs.add(o); })(spec);
if (INTRA && refs.size) await clock('prep.intra_clips', async () => {
  const cdir = ensureDir(join(config.data, 'cache', 's1clips'));
  await Promise.all([...refs].map(async ref => {
    const src = join(ME, ref), st = statSync(src), name = `${createHash('sha1').update(`${ref}|${st.size}|${st.mtimeMs | 0}`).digest('hex').slice(0, 16)}.mp4`;
    if (!existsSync(join(cdir, name))) {
      await sh(config.ffmpeg, ['-v', 'error', '-y', '-i', src, '-an', '-c:v', 'libx264', '-qp', '0', '-g', '1', '-preset', 'veryfast', '-pix_fmt', 'yuv420p', join(cdir, name + '.tmp.mp4')]);
      renameSync(join(cdir, name + '.tmp.mp4'), join(cdir, name));
    }
    clipUrl.set(ref, `/data/cache/s1clips/${name}`);
  }));
});
const fix = (o: unknown): unknown => Array.isArray(o) ? o.map(fix)
  : o && typeof o === 'object' ? Object.fromEntries(Object.entries(o).map(([k, v]) => [k, fix(v)]))
  : typeof o === 'string' && MEDIA.test(o) && !/^(\/|https?:|data:|blob:)/.test(o) && existsSync(join(ME, o)) ? (clipUrl.get(o) ?? `/me/${o}`) : o;
const rspec = fix(spec) as typeof spec;
if (FPS) rspec.fps = FPS; // output frame rate (the MotionEasy CLI's --fps): the timeline itself keeps its own
const tl = rspec.props.timeline, dur = tl.frames / tl.fps, outFps = FPS || tl.fps, frames = Math.round(dur * outFps), fps = outFps;

const work = join(dir, 'work'); rmSync(work, { recursive: true, force: true }); ensureDir(work);

/* ─────────────── render: CHUNKS ranges over N pages ─────────────── */
const chunkFiles: string[] = [];
const chunkSecs: number[] = [];
async function renderVideo() {
  const per = Math.ceil(frames / CHUNKS), jobs: [number, number, string][] = [];
  for (let a = 0, i = 0; a < frames; a += per, i++) { const f = join(work, `c${String(i).padStart(2, '0')}.mp4`); jobs.push([a, Math.min(frames, a + per), f]); chunkFiles.push(f); }
  const queue = [...jobs.keys()];
  await Promise.all(Array.from({ length: Math.min(N, jobs.length) }, async () => {
    for (let i = queue.shift(); i !== undefined; i = queue.shift()) {
      const [a, b, f] = jobs[i]!, t = performance.now();
      await chunk(rspec, a, b, f, QUALITY, SCALE);
      chunkSecs[i] = +((performance.now() - t) / 1000).toFixed(1);
    }
  }));
}

/* ─────────────── audio: stems → amix → master (−14 ±0.3 LUFS, ≤ −1 dBTP) ─────────────── */
const SFX_DB = 6, BED_LU = Number(opt('bed-lu', '3')), VOICE_LUFS = -18; // tl_make.py defaults (owner 2026-10-09 / 10-11)
let audioInfo: Record<string, unknown> = {};
async function renderAudio() {
  const voice = join(dir, 'vo.wav');
  const [stems, vl] = await Promise.all([
    clock('audio.stems(sfx+bed)', () => sh(PY, ['-W', 'ignore', join(import.meta.dirname, '..', 'py', 's1audio.py'), join(dir, 'events.json'), dir, '--me', ME, '--cache', join(config.data, 'cache', 's1audio'), '--seconds', dur.toFixed(3)], { timeout: 600_000 })),
    clock('audio.voice_lufs', async () => (await loudness(voice)).lufs),
  ]);
  void stems;
  const ml = await clock('audio.bed_lufs', async () => (await loudness(join(dir, 'music.wav'))).lufs);
  const gv = VOICE_LUFS - vl, gm = (VOICE_LUFS - BED_LU) - ml;
  // amix with the measurement of the mix taken in the same ffmpeg call (asplit → ebur128 → null)
  const mixWav = join(dir, 'mix.wav'), master = join(dir, 'master.wav');
  const mixLufs = await clock('audio.mix(+measure)', async () => {
    const { stderr } = await sh(config.ffmpeg, ['-hide_banner', '-nostats', '-y', '-i', voice, '-i', join(dir, 'music.wav'), '-i', join(dir, 'sfx.wav'), '-filter_complex',
      `[0]aresample=44100,pan=stereo|c0=c0|c1=c0,volume=${gv.toFixed(2)}dB[v];[1]volume=${gm.toFixed(2)}dB[m];[2]aresample=44100,pan=stereo|c0=c0|c1=c0,volume=${SFX_DB.toFixed(1)}dB[s];` +
      `[v][m][s]amix=inputs=3:normalize=0:duration=longest,atrim=0:${dur.toFixed(3)},asplit=2[x][y];[y]ebur128=peak=true:framelog=quiet[z]`,
      '-map', '[x]', '-c:a', 'pcm_f32le', mixWav, '-map', '[z]', '-f', 'null', '-'], { timeout: 300_000 });
    return Number(stderr.match(/I:\s+(-?[\d.]+) LUFS/g)!.at(-1)!.match(/-?[\d.]+/)![0]);
  });
  // master: gain to −14 then tl_make's limiter (limit 0.7, 0.5 ms / 40 ms); loudness and peak measured on the output
  // in the same pass; a second pass only if it missed (the limiter eats a little loudness on peaky mixes)
  let gain = -14 - mixLufs, out = { lufs: 0, peak: 0 }, passes = 0;
  await clock('audio.master(+verify)', async () => {
    for (let k = 0; k < 4; k++) {
      passes++;
      const { stderr } = await sh(config.ffmpeg, ['-hide_banner', '-nostats', '-y', '-i', mixWav, '-filter_complex',
        `[0]volume=${gain.toFixed(2)}dB,alimiter=limit=0.7:attack=0.5:release=40:level=false,asplit=2[x][y];[y]ebur128=peak=true:framelog=quiet[z]`,
        '-map', '[x]', '-c:a', 'pcm_f32le', master, '-map', '[z]', '-f', 'null', '-'], { timeout: 300_000 });
      out = { lufs: Number(stderr.match(/I:\s+(-?[\d.]+) LUFS/g)!.at(-1)!.match(/-?[\d.]+/)![0]), peak: Number(stderr.match(/Peak:\s+(-?[\d.]+) dBFS/g)!.at(-1)!.match(/-?[\d.]+/)![0]) };
      if (Math.abs(out.lufs + 14) <= 0.3 && out.peak <= -1.2) break;
      if (Math.abs(out.lufs + 14) > 0.3) gain += -14 - out.lufs; else gain -= out.peak + 1.3;
    }
  });
  audioInfo = { voice_gain_db: +gv.toFixed(2), bed_gain_db: +gm.toFixed(2), mix_lufs: mixLufs, master_lufs: out.lufs, master_peak_db: out.peak, master_passes: passes };
}

/* ─────────────── run ─────────────── */
const AUDIO_ONLY = flag('audio-only'); // the preview path: mix + master only, no frames rendered
const renderP = AUDIO_ONLY ? Promise.resolve() : clock('render', renderVideo), audioP = flag('no-audio') ? Promise.resolve() : clock('audio', renderAudio); // --no-audio: time the render alone (reuses an earlier master.wav)
await Promise.all([renderP, audioP]);
await closeRender();
if (AUDIO_ONLY) { rmSync(work, { recursive: true, force: true }); console.log(JSON.stringify({ seconds: T, audio: audioInfo })); process.exit(0); }

const final = join(dir, `${id}.mp4`);
await clock('mux(join+aac)', async () => {
  const list = join(work, 'chunks.txt');
  writeFileSync(list, chunkFiles.map(c => `file '${c.replace(/\\/g, '/')}'`).join('\n'), 'utf8');
  await sh(config.ffmpeg, ['-v', 'error', '-y', '-f', 'concat', '-safe', '0', '-i', list, '-i', join(dir, 'master.wav'), '-map', '0:v', '-map', '1:a', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '256k', '-shortest', '-movflags', '+faststart', final], { timeout: 600_000 });
});
T.total = +((performance.now() - t0) / 1000).toFixed(2);

let verify: Record<string, unknown> = {};
if (!flag('no-verify')) {
  const p = await probe(final), a = await loudness(final);
  verify = { duration_s: p.duration, expected_s: +dur.toFixed(3), size: `${p.width}x${p.height}`, codec: p.codec, delivered_lufs: a.lufs, delivered_true_peak_db: a.peak,
    ok: Math.abs(p.duration - dur) < 0.1 && Math.abs(a.lufs + 14) <= 0.3 && a.peak <= -1 };
}
if (!flag('keep')) rmSync(work, { recursive: true, force: true });
const report = { id, frames, fps, duration_s: +dur.toFixed(3), n_pages: N, chunks: CHUNKS, quality: QUALITY, scale: SCALE, out_fps: fps, intra_clips: INTRA, chunk_seconds: chunkSecs, seconds: T, audio: audioInfo, verify, final };
writeFileSync(join(dir, 'make-report.json'), JSON.stringify(report, null, 1));
console.log('\nstage'.padEnd(28) + 'seconds');
for (const [k, v] of Object.entries(T)) console.log(`${k.padEnd(26)}${v.toFixed(2).padStart(7)}${k === 'render' || k === 'audio' ? '   (parallel)' : ''}`);
console.log(`chunks: ${chunkSecs.join(' ')} s | ${JSON.stringify(audioInfo)}\nverify: ${JSON.stringify(verify)}`);
await closeRender();
mkdirSync(work, { recursive: true }); rmSync(work, { recursive: true, force: true });
process.exit(0);
