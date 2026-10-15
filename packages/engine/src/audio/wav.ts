/**
 * WAV in and out, in plain TypeScript (no Python, no native modules): PCM 8/16/24/32-bit and 32/64-bit float, any
 * channel count. Audio is held as one Float32Array per channel at its own sample rate.
 */
import { readFileSync, writeFileSync } from 'node:fs';

export interface Pcm { sr: number; ch: Float32Array[] }

export function readWav(file: string): Pcm {
  const b = readFileSync(file);
  if (b.toString('ascii', 0, 4) !== 'RIFF' || b.toString('ascii', 8, 12) !== 'WAVE') throw new Error(`${file} is not a WAV file`);
  let o = 12, fmt = 1, nch = 1, sr = 44100, bits = 16, data: Buffer | null = null;
  while (o + 8 <= b.length) {
    const id = b.toString('ascii', o, o + 4), size = b.readUInt32LE(o + 4), body = o + 8;
    if (id === 'fmt ') {
      fmt = b.readUInt16LE(body); nch = b.readUInt16LE(body + 2); sr = b.readUInt32LE(body + 4); bits = b.readUInt16LE(body + 14);
      if (fmt === 0xfffe && size >= 26) fmt = b.readUInt16LE(body + 24); // WAVE_FORMAT_EXTENSIBLE: the sub-format's first two bytes
    } else if (id === 'data') { data = b.subarray(body, Math.min(b.length, body + size)); break; }
    o = body + size + (size % 2);
  }
  if (!data) throw new Error(`${file} has no audio data`);
  const bytes = bits / 8, frames = Math.floor(data.length / (bytes * nch));
  const ch = Array.from({ length: nch }, () => new Float32Array(frames));
  for (let i = 0; i < frames; i++) for (let c = 0; c < nch; c++) {
    const p = (i * nch + c) * bytes;
    ch[c]![i] = fmt === 3 ? (bits === 64 ? data.readDoubleLE(p) : data.readFloatLE(p))
      : bits === 16 ? data.readInt16LE(p) / 32768
      : bits === 24 ? ((data[p]! | (data[p + 1]! << 8) | (data[p + 2]! << 16)) << 8 >> 8) / 8388608
      : bits === 32 ? data.readInt32LE(p) / 2147483648
      : (data[p]! - 128) / 128;
  }
  return { sr, ch };
}

/** 16-bit PCM WAV, clipped to ±1. */
export function writeWav(file: string, pcm: Pcm) {
  const nch = pcm.ch.length, frames = pcm.ch[0]?.length ?? 0, data = Buffer.alloc(frames * nch * 2);
  for (let i = 0; i < frames; i++) for (let c = 0; c < nch; c++) data.writeInt16LE(Math.round(Math.max(-1, Math.min(1, pcm.ch[c]![i]!)) * 32767), (i * nch + c) * 2);
  const h = Buffer.alloc(44);
  h.write('RIFF', 0); h.writeUInt32LE(36 + data.length, 4); h.write('WAVE', 8); h.write('fmt ', 12); h.writeUInt32LE(16, 16);
  h.writeUInt16LE(1, 20); h.writeUInt16LE(nch, 22); h.writeUInt32LE(pcm.sr, 24); h.writeUInt32LE(pcm.sr * nch * 2, 28); h.writeUInt16LE(nch * 2, 32); h.writeUInt16LE(16, 34);
  h.write('data', 36); h.writeUInt32LE(data.length, 40);
  writeFileSync(file, Buffer.concat([h, data]));
}

/** Mono at `sr` (channels averaged; linear-interpolation resample when the rate differs). */
export function mono(p: Pcm, sr: number): Float32Array {
  const n = p.ch[0]!.length, m = new Float32Array(n);
  for (const c of p.ch) for (let i = 0; i < n; i++) m[i]! += c[i]! / p.ch.length;
  return resample(m, p.sr, sr);
}
export function resample(x: Float32Array, from: number, to: number): Float32Array {
  if (from === to) return x;
  const n = Math.floor(x.length * to / from), y = new Float32Array(n), r = from / to;
  for (let i = 0; i < n; i++) { const s = i * r, a = Math.floor(s), f = s - a; y[i] = (x[a] ?? 0) * (1 - f) + (x[a + 1] ?? x[a] ?? 0) * f; }
  return y;
}
