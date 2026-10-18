/**
 * The effects film: a talking-head clip + an effects timeline (./plan.ts) -> a 1080x1920 H.264 MP4 with AAC 48 kHz
 * stereo at about -14 LUFS. Frames are drawn by ./runtime.ts in headless Chrome (CSS 3D), one capture per frame, piped
 * to ffmpeg. The speaker is cut out with a person mask (U2-Net-p, the same small model the footage edit uses, through a
 * python with onnxruntime and opencv) so `behind` effects pass behind the head. Audio: the clip's own voice or a voice
 * file, a music bed set about 9 LU under the voice and ducked on words, a sound on each effect, then loudness to -14.
 */
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { config } from '../../config';
import { FX, type FxId } from './catalog';
import { captionChunks, captionHidden, captionY, duckExpr, giantWordSize, resolveFxParams, sourceTime, statCardTop, type FxEvent, type FxWord } from './plan';
import { effectsRuntime, type FxRuntimeData } from './runtime';
import { fxPagePrelude } from './face-safe';

export const FX_W = 1080, FX_H = 1920;
/** the sound each effect lands with: files in the engine's sfx folder (CC0, see its CREDITS) */
export const FX_SFX: Record<string, string> = {
  whoosh: 'fs.whoosh.swosh-whoosh-air-cut.wav', swoosh: 'fs-147285.wav', pop: 'fs.ui.pop-9.wav', tick: 'kenney.click.wav',
  type: 'fs.foley.very-fast-typing-short.wav', riser: 'riser-short.wav', click: 'fs.ui.mouse-2-button-fast-click.wav',
};

function run(cmd: string, args: string[], ms = 600_000, input?: Buffer): Promise<string> {
  return new Promise((res, rej) => {
    const p = spawn(cmd, args, { stdio: ['pipe', 'pipe', 'pipe'] });
    let out = '', err = '';
    const timer = setTimeout(() => { p.kill('SIGKILL'); rej(new Error(`${cmd} timed out`)); }, ms);
    p.stdout.on('data', d => { out += d; }); p.stderr.on('data', d => { err += d; if (err.length > 20000) err = err.slice(-10000); });
    p.on('error', e => { clearTimeout(timer); rej(e); });
    p.on('close', c => { clearTimeout(timer); c === 0 ? res(out) : rej(new Error(`${cmd} exit ${c}: ${err.slice(-600)}`)); });
    if (input) p.stdin.end(input); else p.stdin.end();
  });
}

export async function probe(file: string): Promise<{ w: number; h: number; dur: number; audio: boolean }> {
  const j = JSON.parse(await run(config.ffprobe, ['-v', 'error', '-show_entries', 'stream=codec_type,width,height:format=duration', '-of', 'json', file], 30_000)) as { streams: { codec_type: string; width?: number; height?: number }[]; format: { duration: string } };
  const v = j.streams.find(s => s.codec_type === 'video');
  return { w: v?.width ?? 0, h: v?.height ?? 0, dur: parseFloat(j.format.duration) || 0, audio: j.streams.some(s => s.codec_type === 'audio') };
}

/* ── where the picture sits ── */
/**
 * A portrait clip fills the frame. A landscape clip is scaled so the speaker is big (the picture 72% of the frame
 * height, centred on the face, sitting on the bottom edge) and the space above is the blurred picture: on a plain wall
 * it reads as more wall. Face and box are in design px.
 */
export function fxFraming(w: number, h: number, face: { x: number; y: number; w: number; h: number } | null): { box: { x: number; y: number; w: number; h: number }; face: { cx: number; cy: number; r: number }; faceBox: { y0: number; y1: number }; feather: boolean } {
  // fill the frame (crop around the face) when the picture is tall already, or sharp enough that the crop needs at most
  // 1.8x: a 1080p landscape take reads as a real vertical reel; a small 480p one keeps the big-speaker layout instead
  const portrait = h / w >= 1.5 || FX_H / h <= 1.8;
  const s = portrait ? Math.max(FX_W / w, FX_H / h) : (FX_H * 0.72) / h;
  const bw = w * s, bh = h * s;
  const fx = face ? face.x + face.w / 2 : w / 2, fy = face ? face.y + face.h / 2 : h * 0.4;
  let x = FX_W / 2 - fx * s; x = Math.min(0, Math.max(FX_W - bw, x));
  const y = portrait ? (FX_H - bh) / 2 : FX_H - bh;
  const r = face ? Math.max(face.w, face.h) * s * 0.62 : 170;
  const fy0 = face ? y + face.y * s : y + fy * s - r, fy1 = face ? y + (face.y + face.h) * s : y + fy * s + r;
  return { box: { x: Math.round(x), y: Math.round(y), w: Math.round(bw), h: Math.round(bh) }, face: { cx: Math.round(x + fx * s), cy: Math.round(y + fy * s), r: Math.round(r) }, faceBox: { y0: Math.round(fy0), y1: Math.round(fy1) }, feather: !portrait };
}

/* ── frames, masks, face ── */
const SEG_URL = 'https://github.com/danielgatis/rembg/releases/download/v0.0.0/u2netp.onnx';
const YUNET = join(homedir(), '.cache', 'moovi', 'face_yunet.onnx');
async function segModel(): Promise<string> {
  const dir = join(homedir(), '.cache', 'moovi'), f = join(dir, 'u2netp.onnx');
  if (existsSync(f) && statSync(f).size > 4e6) return f;
  mkdirSync(dir, { recursive: true });
  const r = await fetch(SEG_URL, { signal: AbortSignal.timeout(60_000) });
  if (!r.ok) throw new Error(`person mask model: HTTP ${r.status}`);
  writeFileSync(f, Buffer.from(await r.arrayBuffer()));
  return f;
}
const VISION_PY = `
import sys, os, json, numpy as np, cv2, onnxruntime as ort
seg, frames, masks, yunet, want = sys.argv[1], sys.argv[2], sys.argv[3], sys.argv[4], sys.argv[5] == '1'
files = sorted(f for f in os.listdir(frames) if f.endswith('.jpg'))
faces = []
det = None
if os.path.exists(yunet):
    try: det = cv2.FaceDetectorYN.create(yunet, '', (320, 320), 0.6)
    except Exception: det = None
for i, f in enumerate(files[::max(1, len(files) // 24)]):
    im = cv2.imread(os.path.join(frames, f))
    if det is None: break
    h, w = im.shape[:2]; det.setInputSize((w, h)); _, r = det.detect(im)
    if r is not None and len(r): faces.append(max(r, key=lambda x: x[2] * x[3])[:4].tolist())
face = np.median(np.array(faces), axis=0).tolist() if faces else None
if want:
    o = ort.SessionOptions(); o.intra_op_num_threads = 3
    s = ort.InferenceSession(seg, o, providers=['CPUExecutionProvider']); name = s.get_inputs()[0].name
    prev = None
    for f in files:
        im = cv2.imread(os.path.join(frames, f)); h, w = im.shape[:2]
        x = cv2.resize(cv2.cvtColor(im, cv2.COLOR_BGR2RGB), (320, 320)).astype(np.float32) / 255.
        x = (x - [0.485, 0.456, 0.406]) / [0.229, 0.224, 0.225]
        y = s.run(None, {name: x.transpose(2, 0, 1)[None].astype(np.float32)})[0][0, 0]
        y = np.clip((y - y.min()) / (y.max() - y.min() + 1e-6) * 1.5 - 0.25, 0, 1)
        if prev is not None: y = 0.65 * y + 0.35 * prev
        prev = y
        mw, mh = w // 2, h // 2
        m = cv2.GaussianBlur(cv2.resize((y * 255).astype(np.uint8), (mw, mh), interpolation=cv2.INTER_CUBIC), (5, 5), 0)
        rgba = np.dstack([np.full((mh, mw, 3), 255, np.uint8), m])
        cv2.imwrite(os.path.join(masks, 'm' + f[1:-4] + '.png'), rgba)
print(json.dumps({'face': face, 'n': len(files)}))
`;

export interface FxPrep { frames: string; masks: string | null; count: number; srcW: number; srcH: number; face: { x: number; y: number; w: number; h: number } | null; bg: string; dur: number; audio: boolean; /** why the cutout or the python face was skipped, when it was */ note?: string }

/** The python for the optional vision pass: only MOOVI_VISION_PY (Node is the default, nothing to install). Pure. */
export function visionPythons(env: string | undefined = process.env.MOOVI_VISION_PY): string[] {
  return env && env.trim() ? [env.trim()] : [];
}

/**
 * The face, and the person masks when `masks`: in Node by default (the Node face model, edit/look.ts, and U2-Net-p on
 * onnxruntime-node, ./cutout.ts), so a fresh Windows, Mac or Linux laptop renders effects with no Python and no
 * setup; MOOVI_VISION_PY names an optional python with opencv and onnxruntime instead. Without masks the effects
 * that pass behind the head draw in front of it, so the render never fails on the cutout. Returns why when a part is missing.
 */
async function visionPass(o: { frames: string; masks: string | null; fw: number; fh: number; video: string; dur: number; count: number; fps: number; py?: string }): Promise<{ face: { x: number; y: number; w: number; h: number } | null; masks: boolean; note?: string }> {
  const errs: string[] = [];
  let seg = '-';
  if (o.masks) { try { seg = await segModel(); } catch (e) { errs.push(String((e as Error).message ?? e).slice(0, 160)); } }
  const wantMasks = !!o.masks && seg !== '-';
  for (const py of o.py ? [o.py] : visionPythons()) {
    try {
      const out = await run(py, ['-c', VISION_PY, seg, o.frames, o.masks ?? '-', YUNET, wantMasks ? '1' : '0'], 1_200_000);
      const j = JSON.parse(out.trim().split('\n').at(-1)!) as { face: number[] | null };
      const face = j.face ? { x: j.face[0]!, y: j.face[1]!, w: j.face[2]!, h: j.face[3]! } : null;
      return { face: face ?? await nodeFace(o), masks: wantMasks, ...(errs.length ? { note: `no person cutout (${errs.join('; ')})` } : {}) };
    } catch (e) { errs.push(`${py}: ${String((e as Error).message ?? e).split('\n').filter(Boolean).slice(-1)[0]?.slice(0, 160) ?? 'failed'}, so the Node pass instead`); }
  }
  const face = await nodeFace(o);
  let masks = false;
  if (wantMasks) {
    try { const { nodeMasks } = await import('./cutout'); await nodeMasks({ frames: o.frames, masks: o.masks!, count: o.count, fw: o.fw, fh: o.fh, seg, fps: o.fps }); masks = true; }
    catch (e) { errs.push(`person cutout: ${String((e as Error).message ?? e).slice(0, 200)}`); }
  }
  return { face, masks, ...(errs.length ? { note: errs.join('; ').slice(0, 400) } : {}) };
}

/** The speaker's face in frame pixels from the Node face model (edit/look.ts), the median box; null when none is seen. */
async function nodeFace(o: { video: string; dur: number; fw: number; fh: number }): Promise<{ x: number; y: number; w: number; h: number } | null> {
  try {
    const { detectFaces } = await import('../look');
    const raw = await detectFaces(o.video, o.dur, { step: Math.max(0.5, o.dur / 24) });
    if (!raw.length) return null;
    const med = (k: number) => { const xs = raw.map(r => r[k]!).sort((a, b) => a - b); return xs[xs.length >> 1]!; };
    return { x: med(1) * o.fw, y: med(2) * o.fh, w: med(3) * o.fw, h: med(4) * o.fh };
  } catch (e) { console.warn(`[fx] node face: ${String((e as Error).message ?? e).slice(0, 160)}`); return null; }
}

/** Frames of the clip at `fps` (upscaled 2x with lanczos and a light sharpen when small), the person masks when wanted, the face, and a blurred still for the background. */
export async function prepClip(video: string, work: string, o: { fps: number; masks: boolean; py?: string }): Promise<FxPrep> {
  const info = await probe(video);
  const frames = join(work, 'frames'); rmSync(frames, { recursive: true, force: true }); mkdirSync(frames, { recursive: true });
  const up = info.h < 900 ? 2 : 1, fw = Math.round(info.w * up / 2) * 2, fh = Math.round(info.h * up / 2) * 2;
  await run(config.ffmpeg, ['-nostdin', '-v', 'error', '-y', '-i', video, '-vf', `fps=${o.fps},scale=${fw}:${fh}:flags=lanczos,unsharp=5:5:0.6`, '-q:v', '3', join(frames, 'f%05d.jpg')], 600_000);
  const count = readdirSync(frames).filter(f => f.endsWith('.jpg')).length;
  let masks: string | null = null;
  if (o.masks) { masks = join(work, 'masks'); rmSync(masks, { recursive: true, force: true }); mkdirSync(masks, { recursive: true }); }
  // the person cutout and the face through a python with opencv and onnxruntime when this machine has one; without it
  // (a fresh Windows laptop has no python3, Vignesh's PC Oct 18) the face comes from the Node face model and the film
  // renders without the cutout: effects that pass behind the head sit in front of it instead of failing the render
  const vis = await visionPass({ frames, masks, fw, fh, video, dur: info.dur, count, fps: o.fps, ...(o.py ? { py: o.py } : {}) });
  if (!vis.masks && masks) { rmSync(masks, { recursive: true, force: true }); masks = null; }
  const face = vis.face;
  if (vis.note) console.warn(`[fx] ${vis.note}`);
  const bg = join(work, 'bg.jpg');
  // landscape: the clip's top edge (6%, wall above the head) stretched into the space above the picture; portrait: the frame blurred
  const strip = fh / fw < 1.5;
  await run(config.ffmpeg, ['-nostdin', '-v', 'error', '-y', '-i', join(frames, 'f00001.jpg'), '-vf', strip ? `crop=iw:ih*0.06:0:0,scale=${fw}:400,boxblur=24:2` : `scale=${FX_W}:${FX_H}:force_original_aspect_ratio=increase,crop=${FX_W}:${FX_H},boxblur=40:3,eq=brightness=-0.03`, '-q:v', '3', bg], 60_000);
  return { frames, masks, count, srcW: fw, srcH: fh, face, bg, dur: info.dur, audio: info.audio, ...(vis.note ? { note: vis.note } : {}) };
}

export function fxFontCss(): string {
  const dir = join(config.assets, 'renderer', 'fonts'), u = (f: string) => `url(data:font/woff2;base64,${readFileSync(join(dir, f)).toString('base64')})`;
  return `@font-face{font-family:I;src:${u('inter-latin-wght-normal.woff2')};font-weight:100 900}@font-face{font-family:M;src:${u('jetbrains-mono-latin-wght-normal.woff2')};font-weight:100 800}`;
}

export interface FxFilm {
  video: string; out: string; work: string;
  events: FxEvent[];
  /** the words the captions show (the clip's own speech or the voice-over), on the output clock */
  words: FxWord[];
  /** output length (default: the clip's length) */
  duration?: number;
  /** output time -> clip time, before freezes (default: the same; a demo loops or jumps through the clip) */
  clipTime?: (t: number) => number;
  titles?: { text: string; t0: number; t1: number }[];
  /** the voice: 'clip' (the clip's own audio), a file laid at `voiceAt`, or none */
  voice: 'clip' | { file: string; at?: number } | null;
  /** the bed: `under` LU under the voice (default 6), ducked `duck` dB on speech only (default 3), from `from` s into the track */
  music?: { file: string; under?: number; duck?: number; from?: number } | null;
  sfx?: boolean;
  fps?: number;
  onFrame?: (i: number, n: number) => void;
}

/** sfx cues for a timeline: each effect's sound on its start, checklist ticks on each item, a pop per headline card */
export function fxSfxCues(events: FxEvent[]): { t: number; file: string; gain: number }[] {
  const out: { t: number; file: string; gain: number }[] = [];
  for (const e of events) {
    const s = FX[e.fx as FxId]; if (!s || s.sfx === 'none') continue;
    const f = FX_SFX[s.sfx]; if (!f) continue;
    out.push({ t: e.t0, file: f, gain: s.sfx === 'riser' ? -10 : -6 });
  }
  return out.sort((a, b) => a.t - b.t);
}

/** The browsers to try for the frames, in order: MOOVI_CHROME_PATH, else the configured channel, then Edge (on every Windows PC), then Playwright's own Chromium. Pure. */
export function fxBrowserTries(c: { path?: string | undefined; channel: string }, platform: string = process.platform): ({ executablePath: string } | { channel: string } | Record<string, never>)[] {
  if (c.path) return [{ executablePath: c.path }];
  const ch = [c.channel, ...(platform === 'win32' || platform === 'darwin' ? ['msedge'] : []), 'chrome'].filter((x, i, a) => x && a.indexOf(x) === i);
  return [...ch.map(channel => ({ channel })), {}];
}

async function launchFxBrowser(chromium: typeof import('playwright-core').chromium) {
  const args = ['--no-sandbox', '--disable-dev-shm-usage', '--allow-file-access-from-files', '--disable-web-security', '--force-color-profile=srgb', '--hide-scrollbars'];
  const errs: string[] = [];
  for (const t of fxBrowserTries(config.chrome)) {
    try { return await chromium.launch({ headless: true, ...t, args }); }
    catch (e) { errs.push(`${'executablePath' in t ? t.executablePath : 'channel' in t ? t.channel : 'bundled chromium'}: ${String((e as Error).message ?? e).split('\n')[0]!.slice(0, 140)}`); }
  }
  throw new Error(`no browser to draw the effects (${errs.join('; ')}); install Google Chrome or set MOOVI_CHROME_PATH`);
}

/** Render the film. Returns the output path and timings. */
export async function renderFxFilm(f: FxFilm): Promise<{ out: string; frames: number; seconds: number; renderS: number }> {
  const fps = f.fps ?? 30;
  mkdirSync(f.work, { recursive: true });
  const t0 = Date.now();
  const needMask = f.events.some(e => FX[e.fx as FxId]?.behind);
  const prep = await prepClip(f.video, f.work, { fps, masks: needMask });
  const dur = f.duration ?? prep.dur;
  const geo = fxFraming(prep.srcW, prep.srcH, prep.face);
  const caps = captionChunks(f.words);
  const faceBand = { y0: geo.faceBox.y0 / FX_H - 0.02, y1: geo.faceBox.y1 / FX_H + 0.01 };
  // a real file URL (file:///C:/Users/... on Windows; 'file://' + path is not a URL there)
  const fileUrl = (p: string) => pathToFileURL(p).href;
  const events = f.events.map(resolveFxParams).map(e => e.fx === 'stat-counter' && !(e.params && 'top' in e.params) ? { ...e, params: { ...(e.params ?? {}), top: statCardTop(geo.faceBox) } } : e).map(e => e.fx === 'giant-word' && !(e.params && 'size' in e.params) ? { ...e, params: { ...(e.params ?? {}), size: giantWordSize(String(e.params?.word ?? 'WOW')) } } : e);
  const data: FxRuntimeData = { frames: fileUrl(prep.frames), masks: prep.masks ? fileUrl(prep.masks) : null, count: prep.count, fps, box: geo.box, face: geo.face, bg: fileUrl(prep.bg), bgMode: geo.feather ? 'strip' : 'cover', faceBox: geo.faceBox, events, captions: caps, titles: f.titles ?? [], fonts: fxFontCss() };
  const html = join(f.work, 'index.html');
  writeFileSync(html, `<!doctype html><html><head><meta charset="utf-8"></head><body></body></html>`);
  const { chromium } = await import('playwright-core');
  const browser = await launchFxBrowser(chromium);
  const vfile = join(f.work, 'video.mp4');
  const n = Math.round(dur * fps);
  try {
    const page = await browser.newPage({ viewport: { width: FX_W, height: FX_H }, deviceScaleFactor: 1 });
    page.setDefaultTimeout(120_000);
    await page.goto(fileUrl(html));
    await page.evaluate(`${fxPagePrelude()}(${effectsRuntime.toString()})(${JSON.stringify(data)}); ${geo.feather ? `document.getElementById('base').style.maskImage='linear-gradient(to bottom, transparent 0, black 160px)';document.getElementById('cut').style.maskImage='linear-gradient(to bottom, transparent 0, black 160px)';` : ''} window.__fx.ready`);
    const ff = spawn(config.ffmpeg, ['-nostdin', '-v', 'error', '-y', '-f', 'image2pipe', '-framerate', String(fps), '-c:v', 'mjpeg', '-i', '-', '-c:v', 'libx264', '-preset', 'medium', '-crf', '19', '-pix_fmt', 'yuv420p', '-r', String(fps), '-movflags', '+faststart', vfile], { stdio: ['pipe', 'ignore', 'pipe'] });
    let ffErr = ''; ff.stderr.on('data', d => { ffErr += d; });
    const done = new Promise<void>((res, rej) => ff.on('close', c => c === 0 ? res() : rej(new Error('ffmpeg encode: ' + ffErr.slice(-400)))));
    for (let i = 0; i < n; i++) {
      const t = i / fps, held = sourceTime(t, f.events), ct = f.clipTime ? f.clipTime(held) : held;
      const src = Math.min(prep.dur - 1 / fps, Math.max(0, ct));
      const hideCap = captionHidden(f.events, t);
      const cy = hideCap ? null : captionY(t, f.events, faceBand, 0.035, 0.76);
      await page.evaluate(`window.__fx.frame(${t}, ${src}, ${cy === null ? 'null' : cy})`);
      // a busy machine (a 2 vCPU server, other jobs) can take far longer than Playwright's 30 s default for one frame:
      // wait longer, and try a frame once more before the whole effects render is given up
      const shot = () => page.screenshot({ type: 'jpeg', quality: 92, timeout: 120_000 });
      const buf = await shot().catch(() => shot());
      if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r));
      f.onFrame?.(i, n);
    }
    ff.stdin.end();
    await done;
  } finally { await browser.close().catch(() => undefined); }
  const renderS = (Date.now() - t0) / 1000;
  await mixAudio(f, prep, dur, join(f.work, 'audio.m4a'));
  await run(config.ffmpeg, ['-nostdin', '-v', 'error', '-y', '-i', vfile, '-i', join(f.work, 'audio.m4a'), '-map', '0:v', '-map', '1:a', '-c:v', 'copy', '-c:a', 'copy', '-shortest', '-movflags', '+faststart', f.out], 120_000);
  return { out: f.out, frames: n, seconds: dur, renderS };
}

/**
 * Lay spoken lines (speakHuman's output) into one voice track: each line's speech cut placed at its start on the film
 * clock, 48 kHz mono WAV. The words speakHuman returned are already on this clock.
 */
export async function layVoice(lines: { mp3: Buffer; start: number; cut: [number, number] }[], out: string, work: string): Promise<string> {
  mkdirSync(work, { recursive: true });
  const args: string[] = ['-nostdin', '-v', 'error', '-y'], parts: string[] = [];
  lines.forEach((l, i) => {
    const f = join(work, `line${String(i).padStart(2, '0')}.mp3`); writeFileSync(f, l.mp3); args.push('-i', f);
    const ms = Math.round(l.start * 1000);
    parts.push(`[${i}:a]aresample=48000,atrim=${l.cut[0]}:${l.cut[1]},asetpts=PTS-STARTPTS,afade=t=out:st=${Math.max(0, l.cut[1] - l.cut[0] - 0.05).toFixed(3)}:d=0.05,adelay=${ms}|${ms}[l${i}]`);
  });
  parts.push(`${lines.map((_, i) => `[l${i}]`).join('')}amix=inputs=${lines.length}:normalize=0:dropout_transition=0[v]`);
  args.push('-filter_complex', parts.join(';'), '-map', '[v]', '-ac', '1', '-ar', '48000', out);
  await run(config.ffmpeg, args, 120_000);
  lines.forEach((_, i) => rmSync(join(work, `line${String(i).padStart(2, '0')}.mp3`), { force: true }));
  return out;
}

/** Re-mix the sound of a film already rendered (its frames video is kept in `work`), then mux: a level change costs seconds, not a render. */
export async function remixFxFilm(f: FxFilm): Promise<{ out: string; seconds: number }> {
  const vfile = join(f.work, 'video.mp4');
  if (!existsSync(vfile)) throw new Error(`no rendered picture in ${f.work}`);
  const src = await probe(f.video), dur = f.duration ?? (await probe(vfile)).dur;
  await mixAudio(f, { audio: src.audio }, dur, join(f.work, 'audio.m4a'));
  await run(config.ffmpeg, ['-nostdin', '-v', 'error', '-y', '-i', vfile, '-i', join(f.work, 'audio.m4a'), '-map', '0:v', '-map', '1:a', '-c:v', 'copy', '-c:a', 'copy', '-shortest', '-movflags', '+faststart', f.out], 120_000);
  return { out: f.out, seconds: dur };
}

/** integrated loudness (LUFS) of an input over `dur` s from `from` s, read with ffmpeg's loudnorm analysis */
export async function lufsOf(file: string, dur: number, from = 0): Promise<number> {
  const err = await new Promise<string>((res, rej) => {
    const p = spawn(config.ffmpeg, ['-nostdin', '-hide_banner', '-ss', String(from), '-t', dur.toFixed(3), '-i', file, '-vn', '-af', 'loudnorm=print_format=json', '-f', 'null', '-'], { stdio: ['ignore', 'ignore', 'pipe'] });
    let e = ''; p.stderr.on('data', d => { e += d; if (e.length > 40000) e = e.slice(-20000); });
    p.on('error', rej); p.on('close', () => res(e));
  });
  const m = /"input_i"\s*:\s*"(-?[\d.]+|-inf)"/.exec(err);
  if (!m) throw new Error(`loudness of ${file}: no reading (${err.slice(-200)})`);
  return m[1] === '-inf' ? -70 : parseFloat(m[1]!);
}
/** sample peak (dBFS) of a file, or of `dur` s of it from `from` s */
export async function peakOf(file: string, from = 0, dur?: number): Promise<number> {
  const err = await new Promise<string>((res, rej) => {
    const win = [...(from > 0 ? ['-ss', String(from)] : []), ...(dur ? ['-t', dur.toFixed(3)] : [])];
    const p = spawn(config.ffmpeg, ['-nostdin', '-hide_banner', ...win, '-i', file, '-af', 'volumedetect', '-f', 'null', '-'], { stdio: ['ignore', 'ignore', 'pipe'] });
    let e = ''; p.stderr.on('data', d => { e += d; }); p.on('error', rej); p.on('close', () => res(e));
  });
  const m = /max_volume:\s*(-?[\d.]+) dB/.exec(err);
  return m ? parseFloat(m[1]!) : 0;
}

/**
 * The house levels for an effects film (Vignesh, 2026-10-16 22:58 IST: "the effect sounds are greater than the viral
 * music"): voice at -16 LUFS, the bed `under` LU below it (6 by default, clearly audible), ducked only a light 3 dB
 * while someone speaks, and every effect sound set so its PEAK sits just 2 dB over the bed's loudness, which keeps it
 * well under the bed's own peaks: an effect sound is never louder than the music.
 */
export const FX_MIX = { voice: -16, under: 6, duck: 3, sfxOverBed: 2, sfxUnderMusicPeak: 3, outroFade: 0.4, master: -14, tp: -2 } as const;
/** gain (dB) for a sound whose sample peak is `peakDb` so its peak lands `over` dB above a bed at `bedLufs` */
export const sfxGain = (peakDb: number, bedLufs: number, over: number = FX_MIX.sfxOverBed) => Math.round((bedLufs + over - peakDb) * 10) / 10;
/**
 * The hard cap behind "an effect sound is never louder than the music": the sound's peak stays at least
 * `FX_MIX.sfxUnderMusicPeak` dB under the bed's own peak as placed in the mix (`musicPeakDb`, already ducked when
 * the sound can land on speech). sfxGain's level is kept when it is already under the cap.
 */
export const sfxGainCapped = (peakDb: number, bedLufs: number, musicPeakDb: number, under: number = FX_MIX.sfxUnderMusicPeak) =>
  Math.min(sfxGain(peakDb, bedLufs), Math.round((musicPeakDb - under - peakDb) * 10) / 10);

/**
 * The mix: voice at -16 LUFS, the bed set by measured gain (no compression) `under` LU below and ducked by the speech
 * envelope (duckExpr), one sound per effect at sfxGain, summed, measured, and set to -14 LUFS integrated with a
 * -1.5 dBTP limiter, 48 kHz stereo AAC.
 */
export async function mixAudio(f: FxFilm, prep: { audio: boolean }, dur: number, out: string): Promise<void> {
  const args: string[] = ['-nostdin', '-v', 'error', '-y'];
  const parts: string[] = []; let idx = 0; const mixIn: string[] = [];
  const D = dur.toFixed(3);
  const hasVoice = (f.voice === 'clip' && prep.audio) || (!!f.voice && typeof f.voice === 'object');
  if (f.voice === 'clip' && prep.audio) {
    args.push('-i', f.video); parts.push(`[${idx}:a]aresample=48000,aformat=channel_layouts=stereo,atrim=0:${D},apad=whole_dur=${D},loudnorm=I=${FX_MIX.voice}:TP=-2:LRA=9[vo]`); mixIn.push('[vo]'); idx++;
  } else if (f.voice && typeof f.voice === 'object') {
    const at = Math.round((f.voice.at ?? 0) * 1000);
    args.push('-i', f.voice.file); parts.push(`[${idx}:a]aresample=48000,aformat=channel_layouts=stereo,loudnorm=I=${FX_MIX.voice}:TP=-2:LRA=9,adelay=${at}|${at},apad=whole_dur=${D},atrim=0:${D}[vo]`); mixIn.push('[vo]'); idx++;
  }
  const bed = hasVoice ? FX_MIX.voice - (f.music?.under ?? FX_MIX.under) : FX_MIX.voice;
  let musicGain = 0;
  if (f.music) {
    const from = f.music.from ?? 0;
    const have = await lufsOf(f.music.file, Math.min(dur, 60), from);
    const g = Math.round((bed - have) * 10) / 10; musicGain = g;
    const duck = hasVoice ? duckExpr(f.words, f.music.duck ?? FX_MIX.duck) : '1';
    args.push('-ss', String(from), '-stream_loop', '-1', '-i', f.music.file);
    parts.push(`[${idx}:a]aresample=48000,aformat=channel_layouts=stereo,atrim=0:${D},asetpts=PTS-STARTPTS,volume=${g}dB,volume='${duck}':eval=frame,afade=t=in:d=0.25,afade=t=out:st=${Math.max(0, dur - 1.2).toFixed(3)}:d=1.2[mu]`);
    mixIn.push('[mu]'); idx++;
  }
  if (f.sfx !== false) {
    const sdir = join(config.assets, 'sfx');
    const peaks = new Map<string, number>();
    // the bed's peak where it sits in the mix, taken as ducked (an effect can land on a word)
    const musicPeak = f.music ? (await peakOf(f.music.file, f.music.from ?? 0, dur)) + musicGain - (hasVoice ? (f.music.duck ?? FX_MIX.duck) : 0) : null;
    for (const c of fxSfxCues(f.events)) {
      const file = join(sdir, c.file); if (!existsSync(file) || c.t >= dur) continue;
      if (!peaks.has(file)) peaks.set(file, await peakOf(file));
      const gain = (musicPeak !== null ? sfxGainCapped(peaks.get(file)!, bed, musicPeak) : sfxGain(peaks.get(file)!, FX_MIX.voice - 8)) + Math.min(0, c.gain + 6);
      const ms = Math.round(Math.max(0, c.t - 0.05) * 1000);
      args.push('-i', file); parts.push(`[${idx}:a]aresample=48000,aformat=channel_layouts=stereo,atrim=0:1.2,volume=${gain}dB,adelay=${ms}|${ms}[s${idx}]`); mixIn.push(`[s${idx}]`); idx++;
    }
  }
  if (!mixIn.length) { args.push('-f', 'lavfi', '-i', `anullsrc=r=48000:cl=stereo`); mixIn.push(`[${idx}:a]`); idx++; }
  const raw = out.replace(/\.[a-z0-9]+$/i, '') + '.raw.wav';
  parts.push(`${mixIn.join('')}amix=inputs=${mixIn.length}:normalize=0:dropout_transition=0,atrim=0:${D},apad=whole_dur=${D}[a]`);
  args.push('-filter_complex', parts.join(';'), '-map', '[a]', '-ac', '2', '-ar', '48000', '-c:a', 'pcm_s24le', raw);
  await run(config.ffmpeg, args, 300_000);
  const have = await lufsOf(raw, dur);
  const g = Math.round((FX_MIX.master - have) * 10) / 10;
  const lim = Math.pow(10, FX_MIX.tp / 20).toFixed(3);
  const master = (gain: number) => run(config.ffmpeg, ['-nostdin', '-v', 'error', '-y', '-i', raw, '-af', `volume=${gain}dB,alimiter=limit=${lim}:attack=2:release=60:level=disabled,afade=t=out:st=${Math.max(0, dur - FX_MIX.outroFade).toFixed(3)}:d=${FX_MIX.outroFade},aresample=48000`, '-ac', '2', '-ar', '48000', '-c:a', 'aac', '-b:a', '192k', out], 300_000);
  await master(g);
  // the limiter takes a little off the top: one measured correction lands it on the target
  const got = await lufsOf(out, dur);
  if (Math.abs(FX_MIX.master - got) > 0.3) await master(Math.round((g + FX_MIX.master - got) * 10) / 10);
  rmSync(raw, { force: true });
}
