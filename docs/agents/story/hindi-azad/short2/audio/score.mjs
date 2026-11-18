// score.mjs: the Azad Short's music and sfx, made in code (no tone-generator melodies: plucked strings are Karplus-Strong
// with a jawari buzz and a wooden body; tabla is modal membranes), keyed to the words in ../timing.js.
// Writes stems/score.wav and stems/sfx.wav (48 kHz stereo float). Run: node docs/agents/story/hindi-azad/short/audio/score.mjs
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const HERE = dirname(fileURLToPath(import.meta.url)), OUT = join(HERE, 'stems'), SR = 48000;
const KIT = 'C:/Ishaan GPT/hackthons/moovi/packages/engine/assets/sfx/';
mkdirSync(OUT, { recursive: true });
globalThis.window = {}; new Function('window', readFileSync(join(HERE, '..', 'timing.js'), 'utf8'))(globalThis.window);
const T = globalThis.window.TIMING, DUR = T.duration + 1.4, N = Math.ceil(DUR * SR);
const clean = (w) => w.replace(/[,?.:!]/g, '').toLowerCase();
const wt = (word, line, nth = 0) => { const hits = T.lines[line].filter((w) => clean(w.word) === word.toLowerCase()); if (!hits[nth]) throw new Error('no word ' + word + ' in line ' + line); return hits[nth].t; };
const lt = (i) => T.lines[i][0].t;
// deterministic noise
let seed = 1234567; const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
const noise = () => rnd() * 2 - 1;

// stereo buses
const bus = () => [new Float32Array(N), new Float32Array(N)];
const MUS = bus(), SFX = bus();
const add = (B, x, t, g = 1, pan = 0) => { const s0 = Math.round(t * SR), gl = g * Math.cos((pan + 1) * Math.PI / 4), gr = g * Math.sin((pan + 1) * Math.PI / 4);
  for (let i = 0; i < x.length; i++) { const k = s0 + i; if (k < 0 || k >= N) continue; B[0][k] += x[i] * gl; B[1][k] += x[i] * gr; } };
const db = (d) => Math.pow(10, d / 20);
const decode = (f, rate = 1) => { const b = execFileSync('ffmpeg', ['-v', 'error', '-i', f, '-ac', '1', '-af', `asetrate=${Math.round(SR * rate)},aresample=${SR}`, '-ar', String(SR), '-f', 'f32le', '-'], { maxBuffer: 1 << 28 });
  return new Float32Array(b.buffer, b.byteOffset, b.byteLength / 4); };
// one-pole filters
const lp = (x, fc) => { const a = Math.exp(-2 * Math.PI * fc / SR); let y = 0; return x.map((v) => (y = (1 - a) * v + a * y)); };
const hp = (x, fc) => { const l = lp(Float32Array.from(x), fc); return x.map((v, i) => v - l[i]); };
// biquad band-pass (RBJ)
function bp(x, f, q) { const w = 2 * Math.PI * f / SR, al = Math.sin(w) / (2 * q), a0 = 1 + al, b0 = al / a0, b2 = -al / a0, a1 = -2 * Math.cos(w) / a0, a2 = (1 - al) / a0;
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0; return x.map((v) => { const y = b0 * v + b2 * x2 - a1 * y1 - a2 * y2; x2 = x1; x1 = v; y2 = y1; y1 = y; return y; }); }

// ---- instruments ----
/** Karplus-Strong string; buzz = jawari (sitar/tanpura bridge), bend = semitone glide at the onset (meend) */
function pluck(freq, dur, { decay = 0.996, bright = 0.5, buzz = 0, bend = 0, bendT = 0.12, body = true } = {}) {
  const n = Math.round(dur * SR), out = new Float32Array(n), maxL = Math.ceil(SR / (freq * 0.7)) + 2, buf = new Float32Array(maxL);
  let L0 = SR / freq; for (let i = 0; i < maxL; i++) buf[i] = noise() * (0.6 + 0.4 * bright);
  let w = 0, prev = 0;
  for (let i = 0; i < n; i++) {
    const t = i / SR, f = freq * Math.pow(2, (bend * Math.max(0, 1 - t / bendT)) / 12), L = SR / f;
    const rp = w - L; const r0 = Math.floor(rp), fr = rp - r0;
    const a = buf[((r0 % maxL) + maxL) % maxL], b = buf[(((r0 + 1) % maxL) + maxL) % maxL];
    let s = a + (b - a) * fr;
    const avg = (s * (0.5 + bright * 0.45) + prev * (0.5 - bright * 0.45)) * decay; prev = s;
    let o = avg; if (buzz) o = avg + buzz * (Math.abs(avg) - 0.15) * Math.sign(avg) * 0.5;
    buf[w % maxL] = avg; w++; out[i] = o;
  }
  void L0;
  if (!body) return fade(out);
  const b1 = bp(out, 280, 1.2), b2 = bp(out, 1100, 1.5), b3 = bp(out, 2600, 2);
  return fade(out.map((v, i) => v * 0.55 + b1[i] * 0.9 + b2[i] * 0.5 + b3[i] * 0.25));
}
const fade = (x, ms = 30) => { const k = Math.min(x.length, Math.round(ms * SR / 1000)); for (let i = 0; i < k; i++) x[x.length - 1 - i] *= i / k; return x; };
/** a modal hit: partials [ratio, amp, decay s], fundamental f0, optional pitch glide (tabla bayan) */
function modal(f0, parts, dur, { glide = 0, glideT = 0.15, click = 0.3, clickF = 3000 } = {}) {
  const n = Math.round(dur * SR), out = new Float32Array(n), ph = parts.map(() => rnd() * 6.28);
  for (let i = 0; i < n; i++) { const t = i / SR, f = f0 * (1 + glide * Math.min(1, t / glideT)); let s = 0;
    parts.forEach(([r, a, d], k) => { ph[k] += 2 * Math.PI * f * r / SR; s += a * Math.sin(ph[k]) * Math.exp(-t / d); });
    out[i] = s; }
  if (click) { const c = lp(Float32Array.from({ length: Math.round(0.012 * SR) }, (_, i) => noise() * (1 - i / (0.012 * SR))), clickF); for (let i = 0; i < c.length; i++) out[i] += c[i] * click; }
  return fade(out, 10);
}
const tabla = {
  na: () => modal(520, [[1, 1, 0.22], [2, 0.5, 0.15], [3, 0.35, 0.1], [4, 0.2, 0.07]], 0.5, { click: 0.4 }),
  tin: () => modal(520, [[1, 0.6, 0.12], [2, 0.4, 0.08], [3, 0.2, 0.05]], 0.3, { click: 0.25 }),
  ti: () => modal(780, [[1, 0.3, 0.04], [2.3, 0.2, 0.03]], 0.12, { click: 0.5, clickF: 5000 }),
  ge: () => modal(85, [[1, 1, 0.45], [1.5, 0.2, 0.2]], 0.9, { glide: 0.35, glideT: 0.2, click: 0.2, clickF: 800 }),
  ka: () => lp(Float32Array.from({ length: Math.round(0.07 * SR) }, (_, i) => noise() * Math.exp(-i / (0.012 * SR))), 1800),
};
tabla.dha = () => { const a = tabla.na(), b = tabla.ge(); return b.map((v, i) => v + (a[i] || 0)); };
tabla.dhi = () => { const a = tabla.tin(), b = tabla.ge(); return b.map((v, i) => v * 0.8 + (a[i] || 0)); };
const bell = (f0) => modal(f0, [[1, 1, 2.2], [2.76, 0.5, 1.2], [5.4, 0.25, 0.6], [8.93, 0.12, 0.3], [0.5, 0.3, 2.8]], 3.2, { click: 0.1 });
const ceramic = () => modal(2200, [[1, 1, 0.18], [1.71, 0.6, 0.12], [2.9, 0.3, 0.06]], 0.4, { click: 0.6 });
const coin = () => { const a = modal(3100, [[1, 1, 0.5], [1.48, 0.7, 0.4], [2.3, 0.4, 0.25], [3.7, 0.2, 0.15]], 0.9, { click: 0.6, clickF: 6000 });
  const b = modal(2800, [[1, 0.8, 0.35], [1.6, 0.5, 0.2]], 0.6, { click: 0.3 }); return a.map((v, i) => v + (i > 0.09 * SR ? (b[i - Math.round(0.09 * SR)] || 0) * 0.6 : 0)); };
const sparkle = (n = 7, base = 2400) => { const out = new Float32Array(Math.round(1.6 * SR));
  for (let k = 0; k < n; k++) { const h = modal(base * Math.pow(2, (k * 3 + Math.floor(rnd() * 3)) / 12), [[1, 1, 0.35], [2.01, 0.3, 0.2]], 0.8, { click: 0.05 });
    const o = Math.round((k * 0.055 + rnd() * 0.02) * SR); for (let i = 0; i < h.length && o + i < out.length; i++) out[o + i] += h[i] * (1 - k / (n + 2)); } return out; };
const step = (soft = 1) => { const n = Math.round(0.14 * SR), x = Float32Array.from({ length: n }, (_, i) => noise() * Math.exp(-i / (0.03 * SR)) * (0.6 + 0.4 * rnd()));
  return bp(lp(x, 2200), 700 + rnd() * 300, 0.8).map((v) => v * soft); };
const stick = () => modal(900, [[1, 1, 0.05], [2.4, 0.5, 0.03], [4.1, 0.2, 0.02]], 0.15, { click: 0.6, clickF: 4000 });
const jingle = () => { const out = new Float32Array(Math.round(0.6 * SR)); for (let k = 0; k < 14; k++) { const h = modal(5200 + rnd() * 2600, [[1, 1, 0.08], [1.37, 0.5, 0.05]], 0.25, { click: 0.2, clickF: 8000 });
  const o = Math.round(rnd() * 0.18 * SR); for (let i = 0; i < h.length && o + i < out.length; i++) out[o + i] += h[i] * 0.3; } return out; };
const chirp = () => { const n = Math.round((0.05 + rnd() * 0.06) * SR), f0 = 3200 + rnd() * 1800, f1 = f0 * (1.2 + rnd() * 0.4), out = new Float32Array(n); let ph = 0;
  for (let i = 0; i < n; i++) { const u = i / n; ph += 2 * Math.PI * (f0 + (f1 - f0) * Math.sin(u * Math.PI)) / SR; out[i] = Math.sin(ph) * Math.sin(u * Math.PI) ** 2; } return out; };

const S_ = (f, rate = 1) => decode(KIT + f, rate);
// ---- foley made here: watch tick, paper, pen, broom, bucket, charkha creak, thread snap, goat, crickets, shh ----
const tick = (hi = 1) => modal(hi ? 4200 : 3300, [[1, 1, 0.012], [1.9, 0.6, 0.008], [3.1, 0.3, 0.005]], 0.05, { click: 0.8, clickF: 7000 });
const paper = (len = 0.18) => { const n = Math.round(len * SR); const x = Float32Array.from({ length: n }, (_, i) => noise() * Math.sin(Math.PI * i / n) ** 0.6 * (0.5 + 0.5 * rnd())); return bp(hp(x, 1500), 3500, 0.7); };
const scratch = (len = 0.6) => { const n = Math.round(len * SR); let g = 0; const x = Float32Array.from({ length: n }, (_, i) => { if (i % Math.round(0.045 * SR) === 0) g = 0.4 + 0.6 * rnd(); g *= 0.9993; return noise() * g; }); return bp(x, 5200, 1.2); };
const swish = (len = 0.32) => { const n = Math.round(len * SR); const x = Float32Array.from({ length: n }, (_, i) => noise() * Math.sin(Math.PI * i / n) ** 2); return bp(x, 2600 + rnd() * 600, 0.6); };
const clank = () => modal(610, [[1, 1, 0.5], [2.35, 0.6, 0.3], [3.9, 0.4, 0.2], [5.6, 0.2, 0.12]], 0.9, { click: 0.6, clickF: 4000 });
const creak = () => { const n = Math.round(0.22 * SR), out = new Float32Array(n); let ph = 0; for (let i = 0; i < n; i++) { const u = i / n, f = 180 + 60 * Math.sin(u * Math.PI); ph += 2 * Math.PI * f / SR; out[i] = (Math.sin(ph) + 0.5 * Math.sin(ph * 2.7)) * Math.sin(Math.PI * u) * (0.6 + 0.4 * (rnd() > 0.7 ? 1 : 0)); } return lp(out, 1600); };
const snapS = () => { const a = pluck(880, 0.6, { decay: 0.99, bright: 1, body: false, bend: 5, bendT: 0.05 }); const c = lp(Float32Array.from({ length: Math.round(0.02 * SR) }, () => noise()), 6000); for (let i = 0; i < c.length; i++) a[i] += c[i] * 0.8; return a; };
const bleat = (len = 0.9) => { const n = Math.round(len * SR), out = new Float32Array(n); let ph = 0; for (let i = 0; i < n; i++) { const t = i / SR, u = i / n, vib = 1 + 0.06 * Math.sin(t * 2 * Math.PI * 9) * Math.sin(Math.PI * u), f = (420 + 140 * Math.sin(Math.PI * Math.min(1, u * 1.6))) * vib;
  ph += 2 * Math.PI * f / SR; let s = 0; for (let h = 1; h < 9; h++) s += Math.sin(ph * h) / h * (h === 3 || h === 4 ? 1.6 : 1); out[i] = s * Math.sin(Math.PI * u) ** 0.5 * (0.7 + 0.3 * Math.sin(t * 2 * Math.PI * 23)); }
  const a = bp(out, 1300, 0.9), b = bp(out, 2600, 1.2); return a.map((v, i) => v + b[i] * 0.5); };
const shh = (len = 0.9) => { const n = Math.round(len * SR); const x = Float32Array.from({ length: n }, (_, i) => noise() * Math.min(1, i / (0.08 * SR)) * Math.min(1, (n - i) / (0.3 * SR))); return bp(hp(x, 2000), 3800, 0.8); };
const cricket = (dur) => { const n = Math.round(dur * SR), out = new Float32Array(n); let ph = 0; for (let i = 0; i < n; i++) { const t = i / SR; ph += 2 * Math.PI * 4600 / SR; const on = (t % 0.9) < 0.32 ? Math.max(0, Math.sin(t * 2 * Math.PI * 30)) : 0; out[i] = Math.sin(ph) * on; } return out; };
const thud = () => lp(Float32Array.from({ length: Math.round(0.3 * SR) }, (_, i) => noise() * Math.exp(-i / (0.04 * SR))), 400);

// ---- notes: Sa = D, Asavari (komal ga, dha, ni): grave and warm, never horror; a bansuri for the tender beats ----
const SA = 146.83, note = (deg, oct = 0) => { const st = [0, 2, 3, 5, 7, 8, 10][((deg % 7) + 7) % 7] + 12 * (Math.floor(deg / 7) + oct); return SA * Math.pow(2, st / 12); };
const sitar = (deg, oct, t, g = 1, o = {}) => add(MUS, pluck(note(deg, oct), 2.6, { decay: 0.9985, bright: 0.7, buzz: 0.55, bend: o.bend ?? 0, ...o }), t, g * 0.5, o.pan ?? 0.15);
const santoor = (deg, oct, t, g = 1, pan = 0) => add(MUS, pluck(note(deg, oct), 1.8, { decay: 0.997, bright: 0.85, buzz: 0, body: true }), t, g * 0.32, pan);
const flute = (deg, oct, t, len, g = 1, pan = -0.1) => { const f = note(deg, oct + 1), n = Math.round(len * SR), out = new Float32Array(n); let ph = 0;
  for (let i = 0; i < n; i++) { const tt = i / SR, vib = 1 + 0.008 * Math.sin(2 * Math.PI * 5.2 * tt) * Math.min(1, tt / 0.4); ph += 2 * Math.PI * f * vib / SR;
    out[i] = (Math.sin(ph) + 0.18 * Math.sin(2 * ph) + 0.06 * Math.sin(3 * ph) + 0.08 * noise()) * Math.min(1, tt / 0.12) * Math.min(1, (n - i) / (0.25 * SR)); }
  add(MUS, lp(out, 3200), t, g * 0.16, pan); };
const LE = (i) => T.lines[i].at(-1).end;

// ---- jail foley made here: the thali scraping on stone, iron clank with a long corridor tail, boots, a tin cup, a slosh, pages ----
const scrape = (len = 0.9) => { const n = Math.round(len * SR); let g = 0; const x = Float32Array.from({ length: n }, (_, i) => { if (i % Math.round(0.02 * SR) === 0) g = 0.3 + 0.7 * rnd(); return noise() * g * Math.min(1, i / (0.05 * SR), (n - i) / (0.15 * SR)); });
  const r = modal(1900, [[1, 0.25, 0.4], [2.7, 0.15, 0.25]], len, { click: 0 }); return bp(x, 2200, 0.9).map((v, i) => v + r[i] * 0.3 * Math.min(1, (n - i) / (0.2 * SR))); };
const ironClank = () => { const a = modal(320, [[1, 1, 1.2], [2.31, 0.7, 0.8], [3.7, 0.45, 0.5], [5.2, 0.3, 0.3], [7.9, 0.15, 0.2]], 2.6, { click: 0.7, clickF: 3000 });
  const out = new Float32Array(a.length + Math.round(0.5 * SR)); for (let i = 0; i < a.length; i++) { out[i] += a[i]; out[i + Math.round(0.19 * SR)] += a[i] * 0.3; out[i + Math.round(0.41 * SR)] += a[i] * 0.12; } return lp(out, 5000); };
const boot = (soft = 1) => { const n = Math.round(0.18 * SR), x = Float32Array.from({ length: n }, (_, i) => noise() * Math.exp(-i / (0.025 * SR))); const lo = modal(95, [[1, 1, 0.08]], 0.18, { click: 0.4, clickF: 1200 });
  return lp(x, 1600).map((v, i) => (v * 0.7 + lo[i] * 0.8) * soft); };
const tinCup = () => modal(1750, [[1, 1, 0.35], [2.2, 0.5, 0.2], [3.9, 0.25, 0.12]], 0.7, { click: 0.6, clickF: 6000 });
const slosh = (len = 0.7) => { const n = Math.round(len * SR); const x = Float32Array.from({ length: n }, (_, i) => noise() * (0.5 + 0.5 * Math.sin(i / SR * 2 * Math.PI * 7)) * Math.sin(Math.PI * i / n)); return bp(lp(x, 1400), 500, 0.7); };
const page = () => paper(0.28);
const heart = (t, g) => { add(MUS, tabla.ge(), t, g); add(MUS, tabla.ge(), t + 0.24, g * 0.6); };
const birdsTo = (t0, t1, lvl = -30) => { for (let t = t0; t < t1; t += 0.5 + rnd() * 1.3) { const c = rnd() < 0.5 ? 2 : 1; for (let j = 0; j < c; j++) add(SFX, chirp(), t + j * 0.09, db(lvl + rnd() * 4), rnd() * 1.6 - 0.8); } };

// ---- Azad's own foley: gunshots (crack, thump, a park-wide tail), a pistol click, a car engine, brakes, a door, running feet, wings ----
const gunshot = (far = 0) => { const n = Math.round(1.6 * SR), out = new Float32Array(n);
  for (let i = 0; i < n; i++) { const t = i / SR; out[i] = noise() * Math.exp(-t / 0.012) * 1.0 + noise() * Math.exp(-t / 0.18) * 0.18 + Math.sin(2 * Math.PI * 70 * t) * Math.exp(-t / 0.06) * 0.6; }
  const tail = lp(out, far ? 1200 : 5200); const y = new Float32Array(n); for (let i = 0; i < n; i++) { y[i] += tail[i]; const d1 = i - Math.round(0.11 * SR), d2 = i - Math.round(0.27 * SR), d3 = i - Math.round(0.52 * SR);
    if (d1 > 0) y[i] += tail[d1] * 0.32; if (d2 > 0) y[i] += tail[d2] * 0.16; if (d3 > 0) y[i] += tail[d3] * 0.08; } return y; };
const click = () => modal(2600, [[1, 1, 0.03], [2.3, 0.6, 0.02]], 0.12, { click: 1, clickF: 8000 });
const engine = (len) => { const n = Math.round(len * SR), out = new Float32Array(n); let ph = 0; for (let i = 0; i < n; i++) { const t = i / SR, u = i / n, f = 28 + 10 * Math.sin(Math.PI * Math.min(1, u * 1.4)); ph += 2 * Math.PI * f / SR;
  out[i] = (Math.sign(Math.sin(ph)) * 0.5 + noise() * 0.5) * Math.min(1, t / 0.4) * Math.min(1, (n - i) / (0.5 * SR)); } return lp(out, 500); };
const squeal = () => { const n = Math.round(0.6 * SR), out = new Float32Array(n); let ph = 0; for (let i = 0; i < n; i++) { const u = i / n; ph += 2 * Math.PI * (1900 - 300 * u) / SR; out[i] = Math.sin(ph) * Math.sin(Math.PI * u) * 0.4 + noise() * 0.05; } return bp(out, 1900, 3); };
const door = () => lp(modal(140, [[1, 1, 0.15], [2.6, 0.5, 0.08]], 0.4, { click: 0.9, clickF: 2500 }), 3000);
const run = (t0, t1, lvl, pan) => { for (let t = t0; t < t1; t += 0.24) add(SFX, boot(0.5), t, db(lvl), pan); };
const wings = (len = 1.6) => { const n = Math.round(len * SR), out = new Float32Array(n); for (let i = 0; i < n; i++) { const t = i / SR, flap = Math.max(0, Math.sin(2 * Math.PI * 9 * t)) ** 2;
  out[i] = noise() * flap * Math.exp(-t / (len * 0.6)); } return bp(out, 900, 0.6); };
const wind = (len) => { const n = Math.round(len * SR), out = new Float32Array(n); for (let i = 0; i < n; i++) { const t = i / SR; out[i] = noise() * (0.5 + 0.5 * Math.sin(t * 0.7) * Math.sin(t * 0.31 + 1)) * Math.min(1, t / 1, (n - i) / SR); } return lp(out, 700); };
const gavel = () => modal(420, [[1, 1, 0.12], [2.1, 0.6, 0.08], [3.3, 0.3, 0.05]], 0.5, { click: 1, clickF: 3000 });
// ---- the tanpura: it holds the morning, and falls silent from the last shot to the park's name ----
const silences = [[wt('dhamaake', 8) - 0.05, wt('aaj', 9) - 0.2]];
const inSilence = (t) => silences.some(([a, b]) => t > a && t < b);
const tanpuraLevel = (t) => { if (inSilence(t)) return 0; const k = [[0, -24], [0.8, -13], [lt(3), -13], [lt(4), -14], [lt(6), -12], [lt(8), -11], [T.duration + 0.4, -12], [DUR, -40]];
  for (let i = 1; i < k.length; i++) if (t <= k[i][0]) { const u = (t - k[i - 1][0]) / (k[i][0] - k[i - 1][0]); return db(k[i - 1][1] + (k[i][1] - k[i - 1][1]) * u); } return 0; };
{ const strings = [note(4, -1), note(0, 0), note(0, 0), note(0, -1)]; let k = 0;
  for (let t = 0; t < DUR - 1; t += 1.4, k++) { const f = strings[k % 4]; add(MUS, pluck(f, 5.5, { decay: 0.9996, bright: 0.3, buzz: 0.8, body: true }).map((v, i) => v * tanpuraLevel(t + i / SR)), t, 0.32, (k % 2 ? -0.35 : 0.35)); } }
// ---- L0 the hook: morning birds in the jamun, a twirl, a meend for the park, the Colt's click, the name lands ----
add(SFX, swish(0.38), 0.02, db(-12), -0.4); add(SFX, gunshot(), 0.38, db(-4), -0.3); add(SFX, modal(260, [[1, 1, 0.08], [2.4, 0.6, 0.05]], 0.3, { click: 1, clickF: 2500 }), 0.41, db(-8), -0.2); add(MUS, tabla.dha(), 0.4, db(-5)); add(SFX, S_('fs.whoosh.swosh-whoosh-air-cut.wav'), wt('allahabad', 0) - 0.35, db(-14), 0.3); add(SFX, S_('fs.whoosh.swosh-whoosh-air-cut.wav'), lt(4) - 0.4, db(-14), -0.3); birdsTo(0.6, lt(3), -30);   // the hook: a shot cracks into the trunk beside him add(SFX, wind(lt(3)), 0, db(-34));
add(SFX, swish(0.3), 0.25, db(-24), -0.2); sitar(2, 0, wt('park', 0) - 0.02, 0.9, { bend: -2, bendT: 0.2 }); flute(4, -1, wt('jaamun', 0), 2.0, 0.7);
add(SFX, swish(0.25), wt('moonchon', 0), db(-22), -0.3); santoor(4, 1, wt('taav', 0), 0.5, 0.3); add(SFX, click(), wt('colt', 0), db(-14), 0.2); add(SFX, click(), wt('colt', 0) + 0.14, db(-18), 0.2);
add(SFX, S_('tonal.chime.wav', 0.75), wt('azad', 0) - 0.04, db(-13)); [0, 2, 4].forEach((d, k) => sitar(d, 1, wt('azad', 0) + k * 0.07, 0.8, { pan: -0.3 + k * 0.3 })); add(MUS, tabla.ge(), wt('azad', 0), db(-3));
// ---- L1 the vow: a low beat; the court in the memory (a gavel), "zinda nahi" a bend, the name again a chord ----
add(MUS, tabla.ge(), wt('kasam', 1), db(-5)); add(SFX, S_('fs.whoosh.swosh-whoosh-air-cut.wav'), wt('pandrah', 1) - 0.3, db(-18));
add(SFX, gavel(), wt('adalat', 1), db(-12)); add(SFX, gavel(), wt('adalat', 1) + 0.3, db(-15)); sitar(0, -1, wt('zinda', 1), 0.8, { bend: -1, bendT: 0.4 });
[0, 2, 4].forEach((d, k) => sitar(d, 0, wt('azad', 1) + k * 0.07, 0.7)); add(MUS, tabla.na(), wt('azad', 1), db(-6));
// ---- L2 the talk, the car at the gate, the informer: the music thins to a pulse ----
santoor(2, 0, wt('saathi', 2), 0.4, -0.2); santoor(4, 0, wt('baat', 2), 0.4, 0.2);
add(SFX, engine(wt('rukti', 2) - wt('tabhi', 2) + 1.2), wt('tabhi', 2) - 0.4, db(-16), -0.5); add(SFX, squeal(), wt('rukti', 2) - 0.1, db(-22), -0.5);
add(SFX, door(), wt('hai', 2) + 0.3, db(-16), -0.4); add(SFX, door(), wt('hai', 2) + 0.75, db(-19), -0.3);
for (let t = wt('kyunki', 2); t < wt('khabar', 2) + 2.6; t += 0.62) heart(t, db(-11)); sitar(1, -1, wt('khabar', 2), 0.8, { bend: -1, bendT: 0.4 });
// ---- L3 "tum kaun ho?" and the answer ----
run(lt(3) - 0.2, wt('poochhta', 3), -24, -0.3); add(SFX, click(), wt('nikaal', 3), db(-12), -0.2);
add(SFX, gunshot(), wt('goli', 3) - 0.05, db(-3), 0.1); add(MUS, tabla.dha(), wt('goli', 3) - 0.05, db(-4));
add(SFX, thud(), wt('haath', 3) + 0.15, db(-14), -0.3); sitar(4, 0, wt('lagti', 3), 0.7, { bend: -2, bendT: 0.3 });
// ---- L4 fire from every side; the thigh; the friend runs ----
[0, 0.35, 0.62, 1.0, 1.28, 1.7, 2.05].forEach((d, k) => add(SFX, gunshot(k % 2), lt(4) + 0.2 + d, db(-8 - (k % 3) * 2), [-0.7, 0.6, -0.2, 0.8, -0.5, 0.3, -0.8][k]));
add(SFX, thud(), wt('jaangh', 4) - 0.05, db(-8)); heart(wt('jaangh', 4) + 0.2, db(-6)); sitar(1, -1, wt('jaangh', 4) + 0.1, 0.8, { bend: -2, bendT: 0.5 });
run(wt('bhaga', 4) - 0.2, lt(5) + 0.4, -22, 0.6); santoor(4, 0, wt('saathi', 4), 0.5, 0.2);
// ---- L5 alone, counting: a shot on each count, the police creeping in ----
add(SFX, gunshot(), wt('lad', 5), db(-6)); [wt('goli', 5), wt('chala', 5)].forEach(t => add(SFX, gunshot(), t + 0.05, db(-7), 0.1));
[wt('ek', 5), wt('ek', 5, 1)].forEach(t => add(MUS, tabla.na(), t, db(-9))); run(wt('police', 5), lt(6) - 0.2, -27, -0.4); add(SFX, gunshot(1), wt('kareeb', 5), db(-14), -0.6);
// ---- L6 one left: the magazine slides out, the music empties to one note ----
add(SFX, click(), wt('kholte', 6), db(-10)); add(SFX, click(), wt('kholte', 6) + 0.2, db(-14));
for (let t = wt('dekhte', 6); t < lt(7) + 1; t += 0.7) heart(t, db(-10)); sitar(0, 0, wt('ek', 6), 0.9); sitar(0, -1, wt('bachi', 6), 0.6, { bend: -1, bendT: 0.6 });
// ---- L7 the choice: a low pulse, police boots close; "kasam" a flute that rises ----
run(wt('dushman', 7), wt('jaoge', 7), -26, 0.4); sitar(3, -1, wt('zinda', 7), 0.6); flute(0, 0, wt('kasam', 7) - 0.1, 2.4, 0.9); santoor(4, 0, wt('nibhaoge', 7), 0.5);
// ---- L8 the last twirl, one far shot, wings, then nothing but leaves and wind ----
[0, 2, 4, 7].forEach((d, k) => sitar(d, 0, wt('rakhte', 8) + k * 0.12, 0.6));
add(SFX, gunshot(1), wt('dhamaake', 8) - 0.05, db(-9)); add(SFX, wings(1.8), wt('dhamaake', 8) + 0.15, db(-10), -0.2); add(SFX, wings(1.4), wt('dhamaake', 8) + 0.35, db(-13), 0.3);
add(SFX, wind(lt(9) + 4 - wt('ke', 8)), wt('ke', 8), db(-26)); for (let t = wt('shaant', 8); t < lt(9) + 3; t += 0.9) add(SFX, paper(0.3), t, db(-30), rnd() - 0.5);
flute(4, -1, wt('azad', 8, 1) - 0.2, 2.6, 0.6);
// ---- L9 nobody dared; the park's name today (birds come back, the music returns), the dare ----
add(SFX, S_('tonal.chime.wav', 0.85), wt('aaj', 9), db(-14)); birdsTo(wt('aaj', 9), DUR - 1, -30);
[0, 2, 4].forEach((d, k) => sitar(d, 1, wt('park', 9, 1) + k * 0.07, 0.8, { pan: -0.3 + k * 0.3 })); add(MUS, tabla.ge(), wt('park', 9, 1), db(-4));
santoor(4, 0, wt('kasam', 9), 0.6, 0.3); add(SFX, S_('ui.pop.wav'), wt('comment', 9), db(-11)); [7, 4, 2, 0].forEach((d, k) => santoor(d, 0, wt('comment', 9) + 0.3 + k * 0.12, 0.6, k % 2 ? -0.4 : 0.4)); add(MUS, tabla.na(), wt('likho', 9), db(-8));

// write stems
const wav = (B, name) => { const raw = join(OUT, name + '.f32'), il = new Float32Array(N * 2); for (let i = 0; i < N; i++) { il[2 * i] = B[0][i]; il[2 * i + 1] = B[1][i]; }
  writeFileSync(raw, Buffer.from(il.buffer)); execFileSync('ffmpeg', ['-v', 'error', '-y', '-f', 'f32le', '-ar', String(SR), '-ac', '2', '-i', raw, '-c:a', 'pcm_f32le', join(OUT, name + '.wav')]); execFileSync('cmd', ['/c', 'del', raw.replace(/\//g, '\\')]); };
wav(MUS, 'score'); wav(SFX, 'sfx');
console.log('stems written', DUR.toFixed(2), 's');
