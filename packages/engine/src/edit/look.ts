import { execFile } from 'node:child_process';
import { existsSync, mkdirSync, statSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import type { Face } from './build';

/**
 * The look step (D1.3): where the speaker's face is, in SOURCE time, as fractions of the source frame, so the player
 * crops on it (Claude 1's EDIT.cropAt, 2cf18a6) and the builder centres its punch-ins on it. OpenCV's YuNet face
 * detector (a 230 KB model fetched once into ~/.cache/moovi, the same one footage-edit's face label uses), run by the
 * vision python (MOOVI_VISION_PY, else `python3` when it imports cv2) on one frame every `step` seconds. Optional: no
 * python, no cv2 or no face found returns [] and the edit is framed without faces.
 */
const FACE_URL = 'https://github.com/opencv/opencv_zoo/raw/main/models/face_detection_yunet/face_detection_yunet_2023mar.onnx';
const LOOK_PY = `
import sys, json, cv2
cap = cv2.VideoCapture(sys.argv[2]); step = float(sys.argv[3]); dur = float(sys.argv[4])
fps = cap.get(cv2.CAP_PROP_FPS) or 30.0; every = max(1, int(round(step * fps)))
out, det, i = [], None, 0
while True:
    ok = cap.grab()
    if not ok: break
    if i % every == 0:
        ok, f = cap.retrieve()
        if ok:
            H, W = f.shape[:2]
            if det is None: det = cv2.FaceDetectorYN.create(sys.argv[1], "", (W, H), 0.6)
            _, fs = det.detect(f)
            if fs is not None and len(fs):
                x, y, w, h = [float(v) for v in max(fs, key=lambda r: r[2] * r[3])[:4]]
                c = float(max(fs, key=lambda r: r[2] * r[3])[14])
                out.append([i / fps, x / W, y / H, w / W, h / H, c])
    i += 1
    if i / fps > dur: break
print(json.dumps(out))
`;

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

let pyChecked: string | null | undefined;
async function visionPy(): Promise<string | null> {
  if (pyChecked !== undefined) return pyChecked;
  const cands = [process.env.MOOVI_VISION_PY, 'python3'].filter((p): p is string => !!p);
  for (const p of cands) { try { await run(p, ['-c', 'import cv2'], 15_000); return (pyChecked = p); } catch { /* next */ } }
  return (pyChecked = null);
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

/** Face keys for a clip ([] when the look step is unavailable or sees no face in at least a third of the samples). */
export async function lookFaces(video: string, duration: number, o: { step?: number; timeoutMs?: number } = {}): Promise<{ faces: Face[]; seconds: number; why?: string }> {
  const t0 = Date.now(), secs = () => +((Date.now() - t0) / 1000).toFixed(2);
  const step = o.step ?? (duration > 60 ? 1 : 0.5);
  try {
    const py = await visionPy(); if (!py) return { faces: [], seconds: secs(), why: 'no vision python with cv2' };
    const out = await run(py, ['-c', LOOK_PY, await faceModel(), video, String(step), String(duration)], o.timeoutMs ?? 30_000);
    const raw = JSON.parse(out.trim().split('\n').at(-1) ?? '[]') as number[][];
    const samples = Math.max(1, Math.floor(duration / step));
    if (raw.length < samples / 3) return { faces: [], seconds: secs(), why: `a face in only ${raw.length} of ${samples} samples` };
    return { faces: smoothFaces(raw), seconds: secs() };
  } catch (e) { return { faces: [], seconds: secs(), why: String((e as Error).message ?? e).slice(0, 160) }; }
}
