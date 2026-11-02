// score.mjs: the stickman short's sound (from the Stickman Games ep1 engine, game3/score.mjs: same instruments, reverb and mix), cues from
// this film's word times and drop times. node score.mjs [MUSG FXG STEMS=1] -> mix.wav (-14 LUFS, TP -1.2)
import { execFileSync, spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const HERE = dirname(fileURLToPath(import.meta.url)), SR = 48000;
const ASSETS = 'C:/Ishaan GPT/hackthons/moovi/packages/engine/assets';
global.window = {}; eval(readFileSync(join(HERE, 'timing.js'), 'utf8'));
const CW = window.SHORT, DUR = CW.dur, N = Math.ceil((DUR + 0.05) * SR);
let seed = 7; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647) * 2 - 1;
const mtof = m => 440 * Math.pow(2, (m - 69) / 12), db = d => Math.pow(10, d / 20);
// ---------- buses ----------
const bus = () => ({ L: new Float32Array(N), R: new Float32Array(N) });
const MUS = bus(), MUSWET = bus(), FX = bus(), FXWET = bus();
function add(b, x, t, g = 1, pan = 0, wet = null, send = 0) {   // mono x into a stereo bus at t seconds
  const i0 = Math.round(t * SR), gl = g * Math.cos((pan + 1) * Math.PI / 4), gr = g * Math.sin((pan + 1) * Math.PI / 4);
  for (let i = 0; i < x.length; i++) { const j = i0 + i; if (j < 0 || j >= N) continue; b.L[j] += x[i] * gl; b.R[j] += x[i] * gr; if (wet) { wet.L[j] += x[i] * gl * send; wet.R[j] += x[i] * gr * send; } }
}
function addSt(b, L, R, t, g = 1, wet = null, send = 0) { const i0 = Math.round(t * SR); for (let i = 0; i < L.length; i++) { const j = i0 + i; if (j < 0 || j >= N) continue; b.L[j] += L[i] * g; b.R[j] += R[i] * g; if (wet) { wet.L[j] += L[i] * g * send; wet.R[j] += R[i] * g * send; } } }

// ---------- filters ----------
function biquad(type, f, q = 0.707, gainDb = 0) {
  const w = 2 * Math.PI * Math.min(f, SR * 0.45) / SR, c = Math.cos(w), s = Math.sin(w), a = s / (2 * q), A = Math.pow(10, gainDb / 40);
  let b0, b1, b2, a0, a1, a2;
  if (type === 'lp') { b0 = (1 - c) / 2; b1 = 1 - c; b2 = b0; a0 = 1 + a; a1 = -2 * c; a2 = 1 - a; }
  else if (type === 'hp') { b0 = (1 + c) / 2; b1 = -(1 + c); b2 = b0; a0 = 1 + a; a1 = -2 * c; a2 = 1 - a; }
  else if (type === 'bp') { b0 = a; b1 = 0; b2 = -a; a0 = 1 + a; a1 = -2 * c; a2 = 1 - a; }
  else { b0 = 1 + a * A; b1 = -2 * c; b2 = 1 - a * A; a0 = 1 + a / A; a1 = -2 * c; a2 = 1 - a / A; }   // peak
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0; const B0 = b0 / a0, B1 = b1 / a0, B2 = b2 / a0, A1 = a1 / a0, A2 = a2 / a0;
  return v => { const y = B0 * v + B1 * x1 + B2 * x2 - A1 * y1 - A2 * y2; x2 = x1; x1 = v; y2 = y1; y1 = y; return y; };
}
const run = (x, ...fs) => { for (let i = 0; i < x.length; i++) { let v = x[i]; for (const f of fs) v = f(v); x[i] = v; } return x; };
function sweepLP(x, fOf, q = 0.8) {   // a lowpass whose cutoff moves (coefficients every 32 samples)
  let f = biquad('lp', fOf(0), q); for (let i = 0; i < x.length; i++) { if (i % 32 === 0) { const nf = biquad('lp', fOf(i / SR), q); f = (st => nf)(f); } x[i] = f(x[i]); } return x;
}
// the moving filter above re-creates state each block; a smoother one keeps state:
function svfLP(x, fOf, q = 0.7) { let ic1 = 0, ic2 = 0; for (let i = 0; i < x.length; i++) { const g = Math.tan(Math.PI * Math.min(fOf(i / SR), SR * 0.45) / SR), k = 1 / q, a1 = 1 / (1 + g * (g + k)), a2 = g * a1, a3 = g * a2;
  const v3 = x[i] - ic2, v1 = a1 * ic1 + a2 * v3, v2 = ic2 + a2 * ic1 + a3 * v3; ic1 = 2 * v1 - ic1; ic2 = 2 * v2 - ic2; x[i] = v2; } return x; }
void sweepLP;

// ---------- instruments ----------
const len = s => new Float32Array(Math.max(1, Math.round(s * SR)));
function env(x, a, d, s, r, hold) { const A = a * SR, D = d * SR, H = hold * SR, Rr = r * SR; for (let i = 0; i < x.length; i++) { let e;
  if (i < A) e = i / A; else if (i < A + D) e = 1 - (1 - s) * (i - A) / D; else if (i < H) e = s; else e = s * Math.max(0, 1 - (i - H) / Rr); x[i] *= e; } return x; }
function pluck(m, dur, { bright = 0.5, damp = 0.996, mute = 0 } = {}) {   // Karplus-Strong string with a wooden body
  const f = mtof(m), n = Math.round(SR / f), buf = new Float32Array(n), x = len(dur);
  for (let i = 0; i < n; i++) buf[i] = rnd() * (0.6 + 0.4 * bright);
  const lp0 = biquad('lp', 1200 + 5000 * bright); for (let i = 0; i < n; i++) buf[i] = lp0(buf[i]);
  let p = 0, prev = 0; const dd = mute ? 0.93 : damp;
  for (let i = 0; i < x.length; i++) { const cur = buf[p], nxt = buf[(p + 1) % n]; const v = dd * (0.5 * (cur + nxt)); buf[p] = v; x[i] = cur; p = (p + 1) % n; prev = cur; }
  void prev;
  const b1 = biquad('peak', 105, 2.2, 6), b2 = biquad('peak', 230, 2, 4), hp = biquad('hp', 70), lp = biquad('lp', mute ? 900 : 6500);
  run(x, b1, b2, hp, lp); const fade = Math.round(0.03 * SR); for (let i = 0; i < fade; i++) x[x.length - 1 - i] *= i / fade; return x;
}
function saw(f, i, ph) { const t = (i * f / SR + ph) % 1; return 2 * t - 1; }
function pad(notes, dur, { cut0 = 300, cut1 = 1400, att = 1.5, rel = 1.5, det = 0.11 } = {}) {   // detuned saws, slow filter
  const L = len(dur), R = len(dur);
  notes.forEach((m, k) => { const f = mtof(m); for (let v = 0; v < 3; v++) { const cents = (v - 1) * det * 12, fv = f * Math.pow(2, cents / 1200), ph = (k * 0.37 + v * 0.21) % 1, pan = (v - 1) * 0.6;
    for (let i = 0; i < L.length; i++) { const s = saw(fv, i, ph) / (notes.length * 3); L[i] += s * (1 - pan) * 0.5; R[i] += s * (1 + pan) * 0.5; } } });
  const fo = t => cut0 + (cut1 - cut0) * Math.min(1, t / dur); svfLP(L, fo, 0.9); svfLP(R, fo, 0.9);
  for (const x of [L, R]) env(x, att, 0.1, 1, rel, dur - rel);
  return { L, R };
}
function sine(f, dur, { a = 0.005, d = 0.3, pitchTo = null, phase = 0 } = {}) { const x = len(dur); let ph = phase;
  for (let i = 0; i < x.length; i++) { const u = i / x.length, fi = pitchTo ? f * Math.pow(pitchTo / f, u) : f; ph += 2 * Math.PI * fi / SR; x[i] = Math.sin(ph) * Math.min(1, i / (a * SR)) * Math.exp(-i / SR / d); } return x; }
function noise(dur, { hp = 0, lp = 0, bp = 0, q = 1, d = 0.1 } = {}) { const x = len(dur); for (let i = 0; i < x.length; i++) x[i] = rnd() * Math.exp(-i / SR / d);
  const fs = []; if (hp) fs.push(biquad('hp', hp)); if (lp) fs.push(biquad('lp', lp)); if (bp) fs.push(biquad('bp', bp, q)); return run(x, ...fs); }
const mix = (...xs) => { const n = Math.max(...xs.map(x => x.length)), y = new Float32Array(n); xs.forEach(x => { for (let i = 0; i < x.length; i++) y[i] += x[i]; }); return y; };
const gain = (x, g) => { for (let i = 0; i < x.length; i++) x[i] *= g; return x; };
function tick(hi) { return mix(gain(sine(hi ? 1850 : 1320, 0.09, { a: 0.0005, d: 0.018 }), 0.7), gain(sine(hi ? 3300 : 2500, 0.05, { a: 0.0003, d: 0.008 }), 0.25), gain(noise(0.03, { hp: 2500, d: 0.004 }), 0.35)); }
function braam(t0) {   // the title hit: low saws through a closing filter, soft-clipped, with a boom and a crash
  const dur = 3.4, L = len(dur), R = len(dur); const ns = [26, 38, 45, 50];
  ns.forEach((m, k) => { const f = mtof(m); for (let v = 0; v < 2; v++) { const fv = f * (v ? 1.004 : 0.997);
    for (let i = 0; i < L.length; i++) { const s = (saw(fv, i, k * 0.3 + v * 0.5) + 0.5 * Math.sign(Math.sin(2 * Math.PI * fv * i / SR))) / 8; if (v) R[i] += s; else L[i] += s; } } });
  const fo = t => 180 + 2600 * Math.exp(-t * 2.2) * Math.min(1, t / 0.04); svfLP(L, fo, 1.2); svfLP(R, fo, 1.2);
  for (const x of [L, R]) { env(x, 0.01, 0.4, 0.55, 2.2, 0.8); for (let i = 0; i < x.length; i++) x[i] = Math.tanh(x[i] * 2.6) * 0.55; }
  addSt(MUS, L, R, t0, 0.9, MUSWET, 0.45);
  add(MUS, gain(sine(110, 2.2, { a: 0.002, d: 0.6, pitchTo: 30 }), 0.9), t0, 1, 0);
  add(FX, noise(2.2, { hp: 3500, d: 0.7 }), t0, 0.13, 0, FXWET, 0.5);
}
function riser(t0, t1) { const dur = t1 - t0, x = len(dur); let ph = 0; const bpf = []; let st = biquad('bp', 400, 3);
  for (let i = 0; i < x.length; i++) { const u = i / x.length; if (i % 64 === 0) st = biquad('bp', 300 * Math.pow(30, u), 2.5); ph += 2 * Math.PI * (60 * Math.pow(8, u)) / SR;
    x[i] = (st(rnd()) * 1.4 + Math.sin(ph) * 0.35) * Math.pow(u, 2.2); }
  void bpf; add(MUS, x, t0, 0.7, 0, MUSWET, 0.5); }
function decode(file, mono = true) { const b = execFileSync('ffmpeg', ['-v', 'error', '-i', file, '-ac', mono ? '1' : '2', '-ar', String(SR), '-f', 'f32le', '-'], { maxBuffer: 1 << 28 }); return new Float32Array(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength)); }
const SFX = n => decode(`${ASSETS}/${n}`); void SFX;


function bell(f, dur) { const x = len(dur); [[1, 1, .9], [2.76, .5, .35], [5.4, .3, .18], [8.9, .15, .1]].forEach(([r, g, d]) => { for (let i = 0; i < x.length; i++) x[i] += Math.sin(2 * Math.PI * f * r * i / SR) * g * Math.exp(-i / SR / d) * Math.min(1, i / 60); }); return x; }
function braamSmall(t0) { const dur = 2, L = len(dur), R = len(dur); [38, 45, 50].forEach((m, k) => { const f = mtof(m); for (let i = 0; i < L.length; i++) { const s = saw(f * (k ? 1.003 : 1), i, k * .3) / 6; L[i] += s; R[i] += s * .9; } });
  const fo = t => 200 + 1800 * Math.exp(-t * 3); svfLP(L, fo, 1); svfLP(R, fo, 1); for (const x of [L, R]) { env(x, .01, .3, .5, 1.4, .4); for (let i = 0; i < x.length; i++) x[i] = Math.tanh(x[i] * 2.2) * .5; }
  addSt(MUS, L, R, t0, .7, MUSWET, .4); add(MUS, gain(sine(100, 1.4, { a: .002, d: .5, pitchTo: 35 }), 1), t0, .6, 0); }
const decodeAF = (file, af) => { const b = execFileSync('ffmpeg', ['-v', 'error', '-i', file, '-ac', '1', '-ar', String(SR), ...(af ? ['-af', af] : []), '-f', 'f32le', '-'], { maxBuffer: 1 << 28 }); return new Float32Array(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength)); };
const EL = n => decodeAF(join(HERE, 'sfx', n + '.mp3'));
const kick = (g = 1) => gain(mix(sine(125, .35, { a: .001, d: .16, pitchTo: 42 }), gain(noise(.02, { lp: 3000, d: .006 }), .4)), g);
const clap = () => gain(mix(noise(.16, { bp: 1400, q: .9, d: .05 }), gain(noise(.03, { hp: 3000, d: .01 }), .5)), .6);
const shaker = () => gain(noise(.07, { hp: 6000, d: .02 }), .25);


// ---------- the cues: the same clock as short.html (word times from timing.js, drops from the page's DROP formula) ----------
const W = i => CW.words[i].t, hash = n => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); }, lerpS = (a, b, k) => a + (b - a) * k;
const W2 = () => decodeAF(`${ASSETS}/sfx-style1/woosh-short.wav`), W1 = () => decodeAF(`${ASSETS}/sfx-style1/woosh-tight.wav`);
const boop = () => mix(gain(bell(1175, .35), .5), (() => { const x = len(.5), y = bell(880, .4); x.set(y.subarray(0, Math.min(y.length, x.length - Math.round(.09 * SR))), Math.round(.09 * SR)); return gain(x, .5); })());
const clunk = (t, g = 1, pan = 0) => add(FX, gain(mix(sine(90, .3, { a: .001, d: .09, pitchTo: 60 }), gain(noise(.12, { bp: 1800, q: 2, d: .03 }), .6)), .9 * g), t, 1, pan, FXWET, .25);
const drop = (t, g = 1, pan = 0) => { clunk(t, g, pan); const x = sine(900 * (1 + .1 * rnd()), 1.3, { a: .03, d: 1.4, pitchTo: 260 }); for (let i = 0; i < x.length; i++) x[i] *= Math.min(1, (x.length - i) / (SR * .5)); add(FX, gain(x, .06 * g), t + .12, 1, pan, FXWET, .5); add(FX, W2(), t + .1, db(-15) * g, pan, FXWET, .4); };
const step = (t, g = 1, pan = 0) => add(FX, gain(mix(noise(.05, { bp: 900, q: 1.2, d: .015 }), gain(sine(140, .06, { a: .001, d: .02 }), .4)), .25 * g), t, 1, pan, FXWET, .15);
const DROP = { 1: W(35), 0: W(103) }, J0 = W(106) - .1, J1 = W(112) - .6, TURBO_REPLAY = W(64);
for (let i = 0; i < 49; i++) if (DROP[i] == null) DROP[i] = lerpS(J0, J1, (i * 37 % 49) / 48) + hash(i) * .12;
// a quiet wind bed for the whole film (the floor is in the sky)
{ const x = noise(DUR + 1, { bp: 420, q: .5, d: 99 }); for (let i = 0; i < x.length; i++) { const t = i / SR; x[i] *= .75 + .25 * Math.sin(t * .7); } add(FX, x, 0, .1, 0); }
// the story clock: one soft tick a second from 7.4 s, louder while it is on screen (shots C and J)
for (let t = 6.3; t < DUR - .3; t += 1) { const seen = (t >= W(19) && t < W(28)) || (t >= W(106) && t < W(112)); add(FX, tick(Math.round(t - 6.3) % 5 === 0), t, seen ? .32 : .12, -.25, FXWET, .2); }
// Turbo, live: running feet he cannot stop, until the floor goes (the rule's proof); then the replay (E-F), the same feet and the same drop
for (let t = W(28) - .4, k = 0; t < DROP[1] + .35; t += .19, k++) step(t, .8, k % 2 ? .25 : .1);
drop(DROP[1], 1.1, .2);
add(FX, W1(), W(41) - .08, db(-12), 0, FXWET, .4);   // the replay whoosh on "That was Turbo"
for (let t = W(41), k = 0; t < TURBO_REPLAY + .35; t += .19, k++) step(t, .7, k % 2 ? .25 : .1);
drop(TURBO_REPLAY, .9, .2);
// Reflex: the fly's buzz, landing; the swat; the drop
{ const a = W(90) - .2, b = W(93), x = len(b - a + .1); let ph = 0; const l = biquad('bp', 900, 1.5); for (let i = 0; i < x.length; i++) { const u = i / x.length; ph += 2 * Math.PI * (195 + 25 * Math.sin(i / SR * 9)) / SR; x[i] = l(2 * (ph / (2 * Math.PI) % 1) - 1) * Math.min(1, u * 6) * (u > .92 ? (1 - u) / .08 : 1); } add(FX, gain(x, .35), a, 1, -.1, FXWET, .15); }
add(FX, W1(), W(98) - .1, db(-8), -.1, FXWET, .3); add(FX, gain(mix(noise(.06, { bp: 1600, q: 1, d: .02 }), gain(sine(220, .05, { a: .001, d: .02 }), .5)), .55), W(98) + .02, 1, -.1, FXWET, .3);
drop(DROP[0], 1, -.1);
// one by one: forty-six clunks across the floor, each a little apart, some falls heard
Object.keys(DROP).map(Number).filter(i => i > 1).forEach((i, k) => { const pan = Math.sin(i * 2.3) * .7; clunk(DROP[i], .28 + .1 * hash(i + 3), pan); if (k % 4 === 0) add(FX, boop(), DROP[i] + .25, .08, pan, FXWET, .3); });
// #50: the slow blink (a soft woody tick) and the smile (two small bells)
add(FX, gain(noise(.03, { bp: 2400, q: 3, d: .01 }), .12), W(131), 1, 0, FXWET, .3);
add(FX, mix(gain(bell(1318, 1.6), .2), gain(bell(1976, 1.2), .1)), W(135) + .05, 1, 0, FXWET, .6);

// ---------- the bed: the series' pluck groove from the rule to the wave, a held tense pad over the wave, a warm resolve for #50 ----------
const BEAT = 60 / 112, CH = [[50, 62, 66, 69], [47, 59, 62, 66], [43, 59, 62, 67], [45, 57, 61, 64]], ARP = [0, 2, 1, 3, 2, 1, 3, 2];
for (let t = .1, b = 0; t < J0; t += BEAT / 2, b++) { const ch = CH[Math.floor(b / 8) % 4], beat = b % 8, k = t < W(19) ? .6 : .85 + .3 * (t / J0);
  add(MUS, pluck(ch[1 + ARP[beat] % 3] + 12, .35, { bright: .85, damp: .985, mute: 1 }), t, .13 * k, beat % 2 ? .35 : -.35, MUSWET, .3);
  if (beat % 2 === 0) { add(MUS, pluck(ch[0] - 12, .5, { bright: .35, damp: .995 }), t, .3 * k, 0); if (t > W(19)) add(MUS, kick(.32 * k), t, 1, 0); }
  if (beat % 2 === 1 && t > W(28)) add(MUS, shaker(), t + .01, .4 * k, .4); }
{ const p = pad([41, 48, 53, 56], W(112) - J0 + .4, { cut0: 300, cut1: 900, att: .3, rel: .6 }); addSt(MUS, p.L, p.R, J0, .42, MUSWET, .6); }
riser(J0 - 1.6, J0);
{ const a = W(112) - .2, b = DUR; const p = pad([50, 57, 62, 66, 69], b - a, { cut0: 700, cut1: 1500, att: 1.2, rel: 1.4 }); addSt(MUS, p.L, p.R, a, .36, MUSWET, .6);
  [74, 69, 66, 69, 71].forEach((m, k) => add(MUS, gain(bell(mtof(m), 2), .1), W(126) + k * 1.2, 1, (k % 2) - .5, MUSWET, .6)); }

// ---------- reverb (Freeverb-style, per bus) ----------
function reverb(b, room = 0.82, dampF = 0.3) {
  const combs = [1557, 1617, 1491, 1422, 1277, 1356, 1188, 1116], aps = [556, 441, 341, 225];
  const out = bus();
  for (const [ch, off] of [['L', 0], ['R', 23]]) {
    const x = b[ch], y = out[ch];
    for (const c of combs) { const n = c + off, buf = new Float32Array(n); let p = 0, f = 0; for (let i = 0; i < N; i++) { const o = buf[p]; f = o * (1 - dampF) + f * dampF; buf[p] = x[i] * 0.015 + f * room; y[i] += o; p = (p + 1) % n; } }
    for (const a of aps) { const n = a + off, buf = new Float32Array(n); let p = 0; for (let i = 0; i < N; i++) { const bo = buf[p], v = y[i]; y[i] = -v + bo; buf[p] = v + bo * 0.5; p = (p + 1) % n; } }
  }
  return out;
}
const mw = reverb(MUSWET, 0.86, 0.35), fw = reverb(FXWET, 0.78, 0.4);

// ---------- the voice: one take, placed as timing.js measured it ----------
const vo = new Float32Array(N);
{ const x = decodeAF(join(HERE, CW.vo)); for (let i = 0; i < x.length && i < N; i++) vo[i] += x[i]; }
const envV = new Float32Array(N); { let e = 0; const a = Math.exp(-1 / (0.01 * SR)), r = Math.exp(-1 / (0.25 * SR)); for (let i = 0; i < N; i++) { const v = Math.abs(vo[i]); e = v > e ? a * e + (1 - a) * v : r * e + (1 - r) * v; envV[i] = e; } }
const OUTL = new Float32Array(N), OUTR = new Float32Array(N);
const voG = 1.25, musG = +(process.env.MUSG || 0.88), fxG = +(process.env.FXG || 1.32), wetG = 1.1;
for (let i = 0; i < N; i++) {
  const duck = 1 - 0.45 * Math.min(1, envV[i] * 12);
  const m = (MUS.L[i] + mw.L[i] * wetG) * musG * duck, mr = (MUS.R[i] + mw.R[i] * wetG) * musG * duck;
  const f = (FX.L[i] + fw.L[i] * wetG) * fxG, fr = (FX.R[i] + fw.R[i] * wetG) * fxG;
  const v = vo[i] * voG; OUTL[i] = v + m + f; OUTR[i] = v + mr + fr;
}
const wav = (L, R, f) => { const z = new Float32Array(N * 2); for (let i = 0; i < N; i++) { z[2 * i] = L(i); z[2 * i + 1] = R(i); } const raw = join(HERE, f + '.f32'); writeFileSync(raw, Buffer.from(z.buffer)); return raw; };
if (process.env.STEMS) for (const [f, L, R] of [['stem-vo', i => vo[i] * voG, i => vo[i] * voG], ['stem-bed', i => OUTL[i] - vo[i] * voG, i => OUTR[i] - vo[i] * voG]]) {
  const raw = wav(L, R, f); execFileSync('ffmpeg', ['-v', 'error', '-y', '-f', 'f32le', '-ar', String(SR), '-ac', '2', '-i', raw, '-c:a', 'pcm_s16le', join(HERE, f + '.wav')]); }
const raw = wav(i => OUTL[i], i => OUTR[i], 'mix-raw');
const meas = spawnSync('ffmpeg', ['-hide_banner', '-f', 'f32le', '-ar', String(SR), '-ac', '2', '-i', raw, '-af', 'loudnorm=I=-14:TP=-1.2:LRA=9:print_format=json', '-f', 'null', '-'], { encoding: 'utf8', maxBuffer: 1 << 26 }).stderr;
const mm = /\{[\s\S]*\}/.exec(meas || ''), M = mm ? JSON.parse(mm[0]) : null;
const af = M ? `loudnorm=I=-14:TP=-1.2:LRA=9:measured_I=${M.input_i}:measured_TP=${M.input_tp}:measured_LRA=${M.input_lra}:measured_thresh=${M.input_thresh}:offset=${M.target_offset}:linear=true` : 'loudnorm=I=-14:TP=-1.2:LRA=9';
execFileSync('ffmpeg', ['-v', 'error', '-y', '-f', 'f32le', '-ar', String(SR), '-ac', '2', '-i', raw, '-af', af + ',aresample=48000', '-t', String(DUR), '-c:a', 'pcm_s24le', join(HERE, 'mix.wav')]);
writeFileSync(join(HERE, 'mix.json'), JSON.stringify({ dur: DUR, measuredFirstPass: M }, null, 1));
console.log('mix.wav', DUR, 's', M ? `in ${M.input_i} LUFS -> -14` : 'single-pass');
