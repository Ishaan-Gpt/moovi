
/** A minimal ONNX reader: enough protobuf to load a small model's graph and weights (no dependency). */
export interface OnnxTensor { name: string; dims: number[]; type: number; data: Float32Array | BigInt64Array | Int32Array }
export interface OnnxAttr { name: string; f?: number; i?: number; s?: string; ints?: number[]; floats?: number[]; t?: OnnxTensor }
export interface OnnxNode { op: string; name: string; inputs: string[]; outputs: string[]; attrs: Record<string, OnnxAttr> }
export interface OnnxGraph { nodes: OnnxNode[]; inits: Map<string, OnnxTensor>; inputs: string[]; outputs: string[] }

class R {
  p = 0;
  constructor(readonly b: Uint8Array, readonly end = b.length) {}
  varint(): number { let r = 0, s = 1, c: number; do { c = this.b[this.p++]!; r += (c & 0x7f) * s; s *= 128; } while (c & 0x80); return r; }
  big(): bigint { let r = 0n, s = 0n, c: number; do { c = this.b[this.p++]!; r |= BigInt(c & 0x7f) << s; s += 7n; } while (c & 0x80); return BigInt.asIntN(64, r); }
  bytes(): Uint8Array { const n = this.varint(); const v = this.b.subarray(this.p, this.p + n); this.p += n; return v; }
  str(): string { return new TextDecoder().decode(this.bytes()); }
  f32(): number { const v = new DataView(this.b.buffer, this.b.byteOffset + this.p, 4).getFloat32(0, true); this.p += 4; return v; }
  skip(w: number) { if (w === 0) this.varint(); else if (w === 1) this.p += 8; else if (w === 2) this.bytes(); else if (w === 5) this.p += 4; else throw new Error('onnx: wire ' + w); }
  *fields(): Generator<[number, number]> { while (this.p < this.end) { const k = this.varint(); yield [k >>> 3, k & 7]; } }
}
const sub = (b: Uint8Array) => new R(b);
function ints(r: R, w: number, out: number[]) { if (w === 2) { const s = sub(r.bytes()); while (s.p < s.end) out.push(Number(s.big())); } else out.push(Number(r.big())); }

/** an aligned copy (a Node Buffer's slice() is a view, not a copy) */
const copy = (u: Uint8Array) => { const c = new Uint8Array(u.length); c.set(u); return c.buffer; };

function tensor(b: Uint8Array): OnnxTensor {
  const r = sub(b); const dims: number[] = []; let type = 1, name = '', raw: Uint8Array | null = null; const fl: number[] = []; const i64: number[] = []; const i32: number[] = [];
  for (const [f, w] of r.fields()) {
    if (f === 1) ints(r, w, dims); else if (f === 2) type = r.varint(); else if (f === 8) name = r.str(); else if (f === 9) raw = r.bytes();
    else if (f === 4) { if (w === 2) { const s = sub(r.bytes()); while (s.p < s.end) fl.push(s.f32()); } else fl.push(r.f32()); }
    else if (f === 7) ints(r, w, i64); else if (f === 5) ints(r, w, i32); else r.skip(w);
  }
  const n = dims.reduce((a, d) => a * d, 1);
  let data: OnnxTensor['data'];
  if (type === 1) data = raw ? new Float32Array(copy(raw), 0, n) : Float32Array.from(fl);
  else if (type === 7) data = raw ? new BigInt64Array(copy(raw), 0, n) : BigInt64Array.from(i64.map(BigInt));
  else if (type === 6) data = raw ? new Int32Array(copy(raw), 0, n) : Int32Array.from(i32);
  else throw new Error(`onnx: tensor ${name} type ${type}`);
  return { name, dims, type, data };
}

function attr(b: Uint8Array): OnnxAttr {
  const r = sub(b); const a: OnnxAttr = { name: '' };
  for (const [f, w] of r.fields()) {
    if (f === 1) a.name = r.str(); else if (f === 2) a.f = r.f32(); else if (f === 3) a.i = Number(r.big()); else if (f === 4) a.s = r.str();
    else if (f === 5) a.t = tensor(r.bytes()); else if (f === 8) { a.ints ??= []; ints(r, w, a.ints); }
    else if (f === 7) { a.floats ??= []; if (w === 2) { const s = sub(r.bytes()); while (s.p < s.end) a.floats.push(s.f32()); } else a.floats.push(r.f32()); }
    else r.skip(w);
  }
  return a;
}

function node(b: Uint8Array): OnnxNode {
  const r = sub(b); const n: OnnxNode = { op: '', name: '', inputs: [], outputs: [], attrs: {} };
  for (const [f, w] of r.fields()) {
    if (f === 1) n.inputs.push(r.str()); else if (f === 2) n.outputs.push(r.str()); else if (f === 3) n.name = r.str(); else if (f === 4) n.op = r.str();
    else if (f === 5) { const a = attr(r.bytes()); n.attrs[a.name] = a; } else r.skip(w);
  }
  return n;
}

const vname = (b: Uint8Array) => { const r = sub(b); for (const [f, w] of r.fields()) { if (f === 1) return r.str(); r.skip(w); } return ''; };

/** Parse an .onnx file's bytes into its graph. */
export function readOnnx(buf: Uint8Array): OnnxGraph {
  const r = sub(buf); let g: Uint8Array | null = null;
  for (const [f, w] of r.fields()) { if (f === 7) g = r.bytes(); else r.skip(w); }
  if (!g) throw new Error('onnx: no graph');
  const gr = sub(g); const out: OnnxGraph = { nodes: [], inits: new Map(), inputs: [], outputs: [] };
  for (const [f, w] of gr.fields()) {
    if (f === 1) out.nodes.push(node(gr.bytes())); else if (f === 5) { const t = tensor(gr.bytes()); out.inits.set(t.name, t); }
    else if (f === 11) out.inputs.push(vname(gr.bytes())); else if (f === 12) out.outputs.push(vname(gr.bytes())); else gr.skip(w);
  }
  out.inputs = out.inputs.filter(i => !out.inits.has(i));
  return out;
}
