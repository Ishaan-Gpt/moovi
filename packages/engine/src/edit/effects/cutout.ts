/**
 * The person cutout in Node (Vignesh, Oct 18: no Python, no manual setup, effects on Windows, Mac and Linux): U2-Net-p
 * (the same small model the Python pass used) run with onnxruntime-node, which the local speech model already
 * installs. ffmpeg decodes the frames to 320x320 RGB and encodes the masks, so there is no image library either.
 * Each mask is white with the person as alpha, half the frame size, `m%05d.png` beside `f%05d.jpg` (./runtime.ts).
 */
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { config } from '../../config';

const S = 320, MEAN = [0.485, 0.456, 0.406], STD = [0.229, 0.224, 0.225];
/** the part of onnxruntime-node used here */
interface OrtTensor { data: unknown }
interface OrtSession { inputNames: readonly string[]; outputNames: readonly string[]; run(feeds: Record<string, OrtTensor>): Promise<Record<string, OrtTensor>>; release?(): Promise<void> }
interface Ort { InferenceSession: { create(path: string, o: Record<string, unknown>): Promise<OrtSession> }; Tensor: new (type: 'float32', data: Float32Array, dims: number[]) => OrtTensor }

/** onnxruntime-node: the engine's own if it has one, else the copy the local speech model (@huggingface/transformers) installs. */
export async function loadOrt(): Promise<Ort> {
  const id: string = 'onnxruntime-node';
  try { const m = await import(id) as { default?: Ort } & Ort; return m.InferenceSession ? m : m.default!; } catch { /* fall through */ }
  const req = createRequire(createRequire(import.meta.url).resolve('@huggingface/transformers'));
  return req(id) as Ort;
}

/** One frame's network input: RGB bytes (S x S x 3) to the normalized CHW float tensor data. Pure. */
export function toInput(rgb: Uint8Array): Float32Array {
  const n = S * S, x = new Float32Array(3 * n);
  for (let i = 0; i < n; i++) for (let c = 0; c < 3; c++) x[c * n + i] = (rgb[i * 3 + c]! / 255 - MEAN[c]!) / STD[c]!;
  return x;
}

/** The network's map to a mask: stretched to 0..1, a little contrast (x 1.5 - 0.25), blended 0.65 / 0.35 with the previous frame's. Pure. */
export function toMask(y: Float32Array, prev: Float32Array | null): Float32Array {
  let lo = Infinity, hi = -Infinity; for (const v of y) { if (v < lo) lo = v; if (v > hi) hi = v; }
  const out = new Float32Array(y.length), k = 1 / (hi - lo + 1e-6);
  for (let i = 0; i < y.length; i++) { const v = Math.min(1, Math.max(0, (y[i]! - lo) * k * 1.5 - 0.25)); out[i] = prev ? 0.65 * v + 0.35 * prev[i]! : v; }
  return out;
}

/** Masks for `count` frames of `frames` (f%05d.jpg, fw x fh) into `masks`, with the model at `seg`. */
export async function nodeMasks(o: { frames: string; masks: string; count: number; fw: number; fh: number; seg: string; fps?: number; threads?: number }): Promise<void> {
  const ort = await loadOrt();
  const sess = await ort.InferenceSession.create(o.seg, { intraOpNumThreads: o.threads ?? 3, executionProviders: ['cpu'] });
  const name = sess.inputNames[0]!, outName = sess.outputNames[0]!;
  const mw = Math.max(2, Math.round(o.fw / 4) * 2), mh = Math.max(2, Math.round(o.fh / 4) * 2), fps = o.fps ?? 30;
  const rd = spawn(config.ffmpeg, ['-nostdin', '-v', 'error', '-framerate', String(fps), '-i', join(o.frames, 'f%05d.jpg'), '-vf', `scale=${S}:${S}:flags=area`, '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'], { stdio: ['ignore', 'pipe', 'pipe'] });
  const wr = spawn(config.ffmpeg, ['-nostdin', '-v', 'error', '-y', '-f', 'rawvideo', '-pix_fmt', 'gray', '-s', `${S}x${S}`, '-framerate', String(fps), '-i', '-',
    '-filter_complex', `color=c=white:s=${mw}x${mh}:r=${fps},format=rgb24[c];[0:v]scale=${mw}:${mh}:flags=bicubic,gblur=sigma=1.2,format=gray[m];[c][m]alphamerge,format=rgba[o]`,
    '-map', '[o]', '-frames:v', String(o.count), join(o.masks, 'm%05d.png')], { stdio: ['pipe', 'ignore', 'pipe'] });
  let err = ''; for (const p of [rd, wr]) p.stderr.on('data', d => { err += d; if (err.length > 4000) err = err.slice(-2000); });
  const closed = (p: import('node:child_process').ChildProcess, what: string) => new Promise<void>((res, rej) => { p.on('error', rej); p.on('close', c => c === 0 ? res() : rej(new Error(`cutout ${what}: ffmpeg exit ${c}: ${err.slice(-300)}`))); });
  const wDone = closed(wr, 'masks'), rDone = closed(rd, 'frames');
  wDone.catch(() => undefined); rDone.catch(() => undefined);
  const size = S * S * 3; let buf: Buffer = Buffer.alloc(0), prev: Float32Array | null = null, n = 0;
  const one = async (rgb: Buffer) => {
    const r = await sess.run({ [name]: new ort.Tensor('float32', toInput(rgb), [1, 3, S, S]) });
    const y = r[outName]!.data as Float32Array, m = toMask(y.subarray(0, S * S), prev); prev = m;
    const g = Buffer.alloc(S * S); for (let i = 0; i < g.length; i++) g[i] = Math.round(m[i]! * 255);
    if (!wr.stdin.write(g)) await new Promise(r2 => wr.stdin.once('drain', r2));
    n++;
  };
  try {
    for await (const chunk of rd.stdout as AsyncIterable<Buffer>) {
      buf = buf.length ? Buffer.concat([buf, chunk]) : Buffer.from(chunk);
      while (buf.length >= size) { const f = Buffer.from(buf.subarray(0, size)); buf = buf.subarray(size); await one(f); }
    }
    await rDone;
  } finally { wr.stdin.end(); }
  await wDone;
  await sess.release?.();
  if (n < o.count) throw new Error(`cutout: ${n} of ${o.count} frames`);
}
