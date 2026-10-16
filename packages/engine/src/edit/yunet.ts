import type { OnnxGraph, OnnxNode } from './onnx';

/**
 * YuNet (OpenCV's face detector, face_detection_yunet_2023mar.onnx) run in plain TypeScript: the model is 53
 * convolutions, ReLU, 2x2 max pools, two nearest 2x upsamples and two adds, so a small interpreter over the ONNX graph
 * (edit/onnx.ts) runs it with no native dependency and no Python (the root CLAUDE.md rule; the server image has no
 * python3). Deterministic: the same frame gives the same boxes on the same machine. About 60k input pixels per frame.
 */
interface T { c: number; h: number; w: number; d: Float32Array }

function conv(x: T, n: OnnxNode, wt: { dims: number[]; data: Float32Array }, bias: Float32Array | null): T {
  const [co, ci_g, kh, kw] = wt.dims as [number, number, number, number];
  const a = n.attrs, s = a.strides?.ints ?? [1, 1], p = a.pads?.ints ?? [0, 0, 0, 0], g = a.group?.i ?? 1;
  const sh = s[0]!, sw = s[1]!, pt = p[0]!, pl = p[1]!, pb = p[2]!, pr = p[3]!;
  const oh = Math.floor((x.h + pt + pb - kh) / sh) + 1, ow = Math.floor((x.w + pl + pr - kw) / sw) + 1;
  const out = new Float32Array(co * oh * ow), W = wt.data, X = x.d, HW = x.h * x.w, OHW = oh * ow;
  const cog = co / g;
  if (kh === 1 && kw === 1 && sh === 1 && sw === 1 && g === 1 && pt === 0 && pl === 0) {
    // pointwise: out[o] = sum_i W[o,i] * X[i]
    for (let o = 0; o < co; o++) {
      const oo = o * OHW, b = bias ? bias[o]! : 0;
      out.fill(b, oo, oo + OHW);
      for (let i = 0; i < ci_g; i++) {
        const k = W[o * ci_g + i]!; if (k === 0) continue;
        const xi = i * HW;
        for (let j = 0; j < OHW; j++) out[oo + j]! += k * X[xi + j]!;
      }
    }
    return { c: co, h: oh, w: ow, d: out };
  }
  for (let o = 0; o < co; o++) {
    const grp = Math.floor(o / cog), oo = o * OHW, b = bias ? bias[o]! : 0;
    out.fill(b, oo, oo + OHW);
    for (let i = 0; i < ci_g; i++) {
      const xi = (grp * ci_g + i) * HW, wb = (o * ci_g + i) * kh * kw;
      for (let ky = 0; ky < kh; ky++) for (let kx = 0; kx < kw; kx++) {
        const k = W[wb + ky * kw + kx]!; if (k === 0) continue;
        for (let oy = 0; oy < oh; oy++) {
          const iy = oy * sh - pt + ky; if (iy < 0 || iy >= x.h) continue;
          const row = xi + iy * x.w, orow = oo + oy * ow;
          let ox0 = 0; while (ox0 < ow && ox0 * sw - pl + kx < 0) ox0++;
          for (let ox = ox0; ox < ow; ox++) {
            const ix = ox * sw - pl + kx; if (ix >= x.w) break;
            out[orow + ox]! += k * X[row + ix]!;
          }
        }
      }
    }
  }
  return { c: co, h: oh, w: ow, d: out };
}

function maxpool(x: T, n: OnnxNode): T {
  const k = n.attrs.kernel_shape?.ints ?? [2, 2], s = n.attrs.strides?.ints ?? k;
  const oh = Math.floor((x.h - k[0]!) / s[0]!) + 1, ow = Math.floor((x.w - k[1]!) / s[1]!) + 1;
  const out = new Float32Array(x.c * oh * ow);
  for (let c = 0; c < x.c; c++) for (let y = 0; y < oh; y++) for (let xx = 0; xx < ow; xx++) {
    let m = -Infinity;
    for (let i = 0; i < k[0]!; i++) for (let j = 0; j < k[1]!; j++) { const v = x.d[c * x.h * x.w + (y * s[0]! + i) * x.w + xx * s[1]! + j]!; if (v > m) m = v; }
    out[c * oh * ow + y * ow + xx] = m;
  }
  return { c: x.c, h: oh, w: ow, d: out };
}

/** nearest, asymmetric, floor: the only Resize YuNet has (2x up); the size comes from the tensor it is added to */
function upTo(x: T, h: number, w: number): T {
  const out = new Float32Array(x.c * h * w), fy = x.h / h, fx = x.w / w;
  for (let c = 0; c < x.c; c++) for (let y = 0; y < h; y++) {
    const sy = Math.min(x.h - 1, Math.floor(y * fy));
    for (let xx = 0; xx < w; xx++) out[c * h * w + y * w + xx] = x.d[c * x.h * x.w + sy * x.w + Math.min(x.w - 1, Math.floor(xx * fx))]!;
  }
  return { c: x.c, h, w, d: out };
}

export interface FaceBox { x: number; y: number; w: number; h: number; score: number }

/**
 * Run YuNet on one frame: `bgr` is h*w*3 bytes (ffmpeg's bgr24), boxes come back in that frame's pixels, score at
 * least `minScore` (OpenCV's default 0.6 in look.ts), after non maximum suppression (0.3).
 */
export function yunet(g: OnnxGraph, bgr: Uint8Array, w: number, h: number, minScore = 0.6): FaceBox[] {
  const PW = Math.ceil(w / 32) * 32, PH = Math.ceil(h / 32) * 32;
  const inp = new Float32Array(3 * PH * PW);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) for (let c = 0; c < 3; c++) inp[c * PH * PW + y * PW + x] = bgr[(y * w + x) * 3 + c]!;
  const env = new Map<string, T>([[g.inputs[0]!, { c: 3, h: PH, w: PW, d: inp }]]);
  // outputs are Sigmoid?(Reshape(Transpose(conv))): keep the conv tensor (NCHW) and decode it ourselves
  const head = new Map<string, { src: string; sig: boolean }>();
  const prod = new Map<string, OnnxNode>(); for (const n of g.nodes) for (const o of n.outputs) prod.set(o, n);
  for (const o of g.outputs) {
    let n = prod.get(o)!, sig = false;
    if (n.op === 'Sigmoid') { sig = true; n = prod.get(n.inputs[0]!)!; }
    if (n.op === 'Reshape') n = prod.get(n.inputs[0]!)!;
    if (n.op === 'Transpose') head.set(o, { src: n.inputs[0]!, sig });
  }
  const f32 = (k: string) => { const t = g.inits.get(k); return t ? t.data as Float32Array : null; };
  for (const n of g.nodes) {
    if (n.op === 'Transpose' || n.op === 'Reshape' || n.op === 'Sigmoid') continue;
    const x = env.get(n.inputs[0]!)!;
    let y: T;
    if (n.op === 'Conv') { const wt = g.inits.get(n.inputs[1]!)!; y = conv(x, n, { dims: wt.dims, data: wt.data as Float32Array }, n.inputs[2] ? f32(n.inputs[2]) : null); }
    else if (n.op === 'Relu') { const d = new Float32Array(x.d.length); for (let i = 0; i < d.length; i++) d[i] = x.d[i]! > 0 ? x.d[i]! : 0; y = { ...x, d }; }
    else if (n.op === 'MaxPool') y = maxpool(x, n);
    else if (n.op === 'Resize') { y = { ...x, h: x.h * 2, w: x.w * 2, d: x.d }; y = upTo(x, x.h * 2, x.w * 2); }
    else if (n.op === 'Add') { const b = env.get(n.inputs[1]!)!; const a2 = a_fit(x, b); const d = new Float32Array(b.d.length); for (let i = 0; i < d.length; i++) d[i] = a2.d[i]! + b.d[i]!; y = { ...b, d }; }
    else throw new Error('yunet: op ' + n.op);
    env.set(n.outputs[0]!, y);
  }
  const get = (name: string) => { const hd = head.get(name)!; return env.get(hd.src)!; };
  const sig = (v: number) => 1 / (1 + Math.exp(-v));
  const cand: FaceBox[] = [];
  for (const s of [8, 16, 32]) {
    const cls = get(`cls_${s}`), obj = get(`obj_${s}`), bb = get(`bbox_${s}`);
    const rows = cls.h, cols = cls.w, n = rows * cols;
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      const i = r * cols + c;
      const cs = Math.min(1, Math.max(0, sig(cls.d[i]!))), os = Math.min(1, Math.max(0, sig(obj.d[i]!)));
      const score = Math.sqrt(cs * os); if (score < minScore) continue;
      const cx = (c + bb.d[i]!) * s, cy = (r + bb.d[n + i]!) * s, bw = Math.exp(bb.d[2 * n + i]!) * s, bh = Math.exp(bb.d[3 * n + i]!) * s;
      cand.push({ x: cx - bw / 2, y: cy - bh / 2, w: bw, h: bh, score });
    }
  }
  cand.sort((a, b) => b.score - a.score);
  const keep: FaceBox[] = [];
  const iou = (a: FaceBox, b: FaceBox) => { const ix = Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x)), iy = Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y)); const I = ix * iy; return I / (a.w * a.h + b.w * b.h - I); };
  for (const c of cand) if (keep.every(k => iou(k, c) < 0.3)) keep.push(c);
  return keep;
}

/** the upsampled tensor cropped to the size it is added to (an odd size rounds down) */
function a_fit(a: T, b: T): T { return a.h === b.h && a.w === b.w ? a : upTo(a.h > b.h || a.w > b.w ? crop(a, b.h, b.w) : a, b.h, b.w); }
function crop(a: T, h: number, w: number): T {
  const d = new Float32Array(a.c * h * w);
  for (let c = 0; c < a.c; c++) for (let y = 0; y < h; y++) d.set(a.d.subarray(c * a.h * a.w + y * a.w, c * a.h * a.w + y * a.w + w), c * h * w + y * w);
  return { c: a.c, h, w, d };
}
