import { execFile } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import type { Face } from './build';
import { readOnnx, type OnnxGraph } from './onnx';
import { yunet } from './yunet';

/**
 * The look step (D1.3): where the speaker's face is, in SOURCE time, as fractions of the source frame, so the player
 * crops on it (Claude 1's EDIT.cropAt, 2cf18a6), the builder centres its punch-ins on it and the library's camera moves
 * frame it. OpenCV's YuNet face detector (a 230 KB model fetched once into ~/.cache/moovi, the same one footage-edit's
 * face label uses), run in Node by edit/yunet.ts (no native dependency, no Python: the root CLAUDE.md rule, and the
 * server image has no python3). One ffmpeg call decodes the sampled frames (long side 256 px, bgr24); at most about
 * 28 samples per clip. Optional: no model or no face found returns [] and the edit is framed without faces.
 */
const FACE_URL = 'https://github.com/opencv/opencv_zoo/raw/main/models/face_detection_yunet/face_detection_yunet_2023mar.onnx';

const run = (cmd: string, args: string[], ms: number) => new Promise<string>((res, rej) =>
  execFile(cmd, args, { timeout: ms, killSignal: 'SIGKILL', maxBuffer: 8 << 20 }, (e, out) => e ? rej(e) : res(String(out))));

async function faceModel(): Promise<string> {
  const dir = join(homedir(), '.cache', 'moovi'), f = join(dir, 'face_yunet.onnx');
  if (existsSync(f) && statSync(f).size > 1e5) return f;
  mkdirSync(dir, { recursive: true });
  const r = await fetch(FACE_URL, { signal: AbortSignal.timeout(30_000) });
  if (!r.ok) throw new Error(`face model: HTTP ${r.status}`);
  writeFileSync(f, Buffer.from(await r.arrayBuffer()));
  return f;
}

/**
 * Smooth raw detections into face keys: a median over 3 neighbours on every coordinate, outliers (a box jumping more
 * than half a face width from its neighbours' median) dropped. Pure, so it is unit tested.
 */
export function smoothFaces(raw: number[][]): Face[] {
  const med = (xs: number[]) => [...xs].sort((a, b) => a - b)[xs.length >> 1]!;
  const r4 = (x: number) => Math.round(x * 1e4) / 1e4;
  const keep = raw.filter((f, j, a) => {
    const nb = a.slice(Math.max(0, j - 2), j + 3).filter((_, k) => k !== Math.min(2, j));
    if (nb.length < 2) return true;
    const mx = med(nb.map(z => z[1]! + z[3]! / 2)), w = med(nb.map(z => z[3]!));
    return Math.abs(f[1]! + f[3]! / 2 - mx) < 0.5 * w + 0.02;
  });
  return keep.map((f, j, a) => {
    const nb = a.slice(Math.max(0, j - 1), j + 2);
    return { src_t: r4(f[0]!), x: r4(med(nb.map(z => z[1]!))), y: r4(med(nb.map(z => z[2]!))), w: r4(med(nb.map(z => z[3]!))), h: r4(med(nb.map(z => z[4]!))), ...(f[5] !== undefined ? { conf: r4(Math.min(1, Math.max(0, f[5]!))) } : {}) };
  });
}

let graph: OnnxGraph | null = null;
async function faceGraph(): Promise<OnnxGraph> { return graph ??= readOnnx(readFileSync(await faceModel())); }

/** The sample step for a clip: every 0.5 s on short clips, spread to about 28 samples on long ones. */
export const lookStep = (duration: number) => Math.max(0.5, Math.round((duration / 28) * 4) / 4);

/** Decode frames every `step` seconds at w x h (bgr24) with one ffmpeg call. */
async function frames(video: string, step: number, w: number, h: number, ms: number): Promise<Buffer> {
  return new Promise((res, rej) => execFile('ffmpeg', ['-v', 'error', '-i', video, '-an', '-vf', `fps=1/${step}:start_time=0:round=down,scale=${w}:${h}`, '-f', 'rawvideo', '-pix_fmt', 'bgr24', 'pipe:1'],
    { timeout: ms, killSignal: 'SIGKILL', maxBuffer: 256 << 20, encoding: 'buffer' }, (e, out) => e ? rej(e) : res(out as Buffer)));
}

/**
 * Raw detections for a clip: [src_t, x, y, w, h, conf] per sample with a face (the largest one), fractions of the
 * source frame. Yields to the event loop between frames, so the hearing beside it keeps its sockets serviced.
 */
export async function detectFaces(video: string, duration: number, o: { step?: number; width?: number; height?: number; timeoutMs?: number } = {}): Promise<number[][]> {
  const step = o.step ?? lookStep(duration);
  let W = o.width, H = o.height;
  if (!W || !H) {
    const p = await run('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height:stream_side_data=rotation', '-of', 'json', video], 15_000);
    const st = (JSON.parse(p).streams?.[0] ?? {}) as { width?: number; height?: number; side_data_list?: { rotation?: number }[] };
    W = st.width ?? 0; H = st.height ?? 0;
    if (Math.abs(st.side_data_list?.[0]?.rotation ?? 0) === 90) [W, H] = [H, W];
  }
  if (!W || !H) return [];
  const k = 256 / Math.max(W, H), w = Math.max(2, Math.round(W * k / 2) * 2), h = Math.max(2, Math.round(H * k / 2) * 2);
  const [g, buf] = await Promise.all([faceGraph(), frames(video, step, w, h, o.timeoutMs ?? 30_000)]);
  const n = Math.floor(buf.length / (w * h * 3)), out: number[][] = [];
  for (let i = 0; i < n; i++) {
    const t = +(i * step).toFixed(3); if (t > duration) break;
    const fs = yunet(g, buf.subarray(i * w * h * 3, (i + 1) * w * h * 3), w, h);
    if (fs.length) { const f = fs.reduce((a, b) => (b.w * b.h > a.w * a.h ? b : a)); out.push([t, f.x / w, f.y / h, f.w / w, f.h / h, f.score]); }
    await new Promise(r => setImmediate(r));
  }
  return out;
}

/** Face keys for a clip ([] when the look step is unavailable or sees no face in at least a third of the samples). */
export async function lookFaces(video: string, duration: number, o: { step?: number; timeoutMs?: number } = {}): Promise<{ faces: Face[]; seconds: number; why?: string }> {
  const t0 = Date.now(), secs = () => +((Date.now() - t0) / 1000).toFixed(2);
  const step = o.step ?? lookStep(duration);
  try {
    const raw = await detectFaces(video, duration, { step, ...(o.timeoutMs ? { timeoutMs: o.timeoutMs } : {}) });
    const samples = Math.max(1, Math.floor(duration / step));
    if (raw.length < samples / 3) return { faces: [], seconds: secs(), why: `a face in only ${raw.length} of ${samples} samples` };
    return { faces: smoothFaces(raw), seconds: secs() };
  } catch (e) { return { faces: [], seconds: secs(), why: String((e as Error).message ?? e).slice(0, 160) }; }
}
