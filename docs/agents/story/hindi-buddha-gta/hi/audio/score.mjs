// score.mjs: the music and sfx of "GTA 6 Mein Buddha", made in code (no samples, no library), keyed to the words in
// ../timing.js. Night-city synth (sub bass, a detuned pad, a plucked arp, kick / clap / hats) that drives lines 0-5,
// drops to a drone and singing bowls when he sits, and lifts to major when the guns come down.
// Writes stems/score.wav and stems/sfx.wav (48 kHz stereo float). Run: node audio/score.mjs
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync, unlinkSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const HERE = dirname(fileURLToPath(import.meta.url)), OUT = join(HERE, 'stems'), SR = 48000;
mkdirSync(OUT, { recursive: true });
const DUB = process.env.DUB === 'en', SUF = DUB ? '-en' : '';   // DUB=en scores the English dub (timing-en.js)
globalThis.window = {}; new Function('window', readFileSync(join(HERE, '..', DUB ? 'timing-en.js' : 'timing.js'), 'utf8'))(globalThis.window);
const T = globalThis.window.TIMING, DUR = T.duration + 1.0, N = Math.ceil(DUR * SR);
const clean = (w) => w.replace(/[^a-z0-9]/gi, '').toLowerCase();
const W = (word, line, nth = 0) => { const hits = T.lines[line].filter((w) => clean(w.word) === clean(word)); if (!hits[nth]) throw new Error('no word ' + word + ' in line ' + line); return hits[nth].t; };
const LS = (i) => T.lines[i][0].t, LE = (i) => T.lines[i].at(-1).end;
let seed = 20261119; const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296), noise = () => rnd() * 2 - 1;
const bus = () => [new Float32Array(N), new Float32Array(N)], MUS = bus(), SFX = bus();
const add = (B, x, t, g = 1, pan = 0) => { const s0 = Math.round(t * SR), gl = g * Math.cos((pan + 1) * Math.PI / 4), gr = g * Math.sin((pan + 1) * Math.PI / 4);
  for (let i = 0; i < x.length; i++) { const k = s0 + i; if (k < 0 || k >= N) continue; B[0][k] += x[i] * gl; B[1][k] += x[i] * gr; } };
const buf = (d) => new Float32Array(Math.round(d * SR)), TAU = Math.PI * 2, cl = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);
// state-variable low-pass with a moving cutoff
function svf(x, fcFn, q = 0.7, mode = 'lp') { let lo = 0, bd = 0; const o = new Float32Array(x.length); for (let i = 0; i < x.length; i++) { const f = 2 * Math.sin(Math.PI * Math.min(0.24, fcFn(i / SR) / SR)); const hi = x[i] - lo - bd / q; bd += f * hi; lo += f * bd; o[i] = mode === 'lp' ? lo : mode === 'bp' ? bd : hi; } return o; }
const env = (t, a, d) => t < 0 ? 0 : t < a ? t / a : Math.exp(-(t - a) / d);
const saw = (ph) => 2 * (ph - Math.floor(ph + 0.5));
// ---- instruments ----
function kick(g = 1) { const x = buf(0.42); let ph = 0; for (let i = 0; i < x.length; i++) { const t = i / SR, f = 46 + 130 * Math.exp(-t / 0.035); ph += f / SR; x[i] = Math.tanh(2.2 * Math.sin(TAU * ph) * Math.exp(-t / 0.16)) * g + noise() * 0.25 * Math.exp(-t / 0.004); } return x; }
function clap() { const x = buf(0.3); for (let i = 0; i < x.length; i++) { const t = i / SR, e = Math.exp(-t / 0.07) * (0.6 + 0.4 * (Math.sin(t * 900) > 0 && t < 0.03 ? 1 : 0.6)); x[i] = noise() * e; } return svf(x, () => 1700, 0.9, 'bp'); }
function hat(open = 0) { const x = buf(open ? 0.22 : 0.06); for (let i = 0; i < x.length; i++) x[i] = noise() * Math.exp(-(i / SR) / (open ? 0.07 : 0.014)); return svf(x, () => 8200, 0.8, 'hp'); }
function sub(m, d, drive = 1.6) { const x = buf(d), f = mtof(m); for (let i = 0; i < x.length; i++) { const t = i / SR; x[i] = Math.tanh(drive * (Math.sin(TAU * f * t) + 0.25 * Math.sin(TAU * 2 * f * t))) * Math.min(1, t / 0.008) * Math.exp(-t / (d * 0.7)) * Math.min(1, (d - t) / 0.02); } return x; }
function pad(notes, d, bright = 900, g = 1) { const x = buf(d); notes.forEach((m, k) => { [-0.07, 0.06, 0.0].forEach((det, j) => { const f = mtof(m + det), p0 = rnd(); for (let i = 0; i < x.length; i++) x[i] += saw(p0 + f * i / SR) * 0.16; }); });
  const y = svf(x, (t) => bright * (0.7 + 0.5 * Math.sin(t * 0.9 + 1)), 0.8); for (let i = 0; i < y.length; i++) { const t = i / SR; y[i] *= g * Math.min(1, t / 0.5) * Math.min(1, (d - t) / 0.6); } return y; }
function pluck(m, d = 0.3, bright = 2600) { const x = buf(d), f = mtof(m); for (let i = 0; i < x.length; i++) { const t = i / SR; x[i] = (saw(f * t) * 0.6 + Math.sign(Math.sin(TAU * f * 2 * t)) * 0.12) * Math.exp(-t / 0.09); } return svf(x, (t) => 300 + bright * Math.exp(-t / 0.05), 1.4); }
// a singing bowl: a few inharmonic partials that beat against each other
function bowl(m, d = 5, g = 1) { const x = buf(d), f = mtof(m); [[1, 1, 3.4], [2.71, 0.5, 2.2], [5.04, 0.24, 1.3], [1.004, 0.8, 3.4], [2.725, 0.3, 2.0]].forEach(([r, a, dec]) => { for (let i = 0; i < x.length; i++) { const t = i / SR; x[i] += a * Math.sin(TAU * f * r * t) * Math.exp(-t / dec) * Math.min(1, t / 0.004); } }); for (let i = 0; i < x.length; i++) x[i] *= 0.4 * g; return x; }
function bell(m, d = 0.9, g = 1) { const x = buf(d), f = mtof(m); for (let i = 0; i < x.length; i++) { const t = i / SR; x[i] = g * 0.5 * (Math.sin(TAU * f * t) + 0.5 * Math.sin(TAU * f * 2.76 * t) * Math.exp(-t / 0.12) + 0.3 * Math.sin(TAU * f * 4.1 * t) * Math.exp(-t / 0.06)) * Math.exp(-t / (d * 0.28)) * Math.min(1, t / 0.002); } return x; }
function sweep(d, f0, f1, q = 1.2, g = 1, shape = (u) => Math.sin(Math.PI * u)) { const x = buf(d); for (let i = 0; i < x.length; i++) x[i] = noise(); const y = svf(x, (t) => f0 * Math.pow(f1 / f0, t / d), q, 'bp'); for (let i = 0; i < y.length; i++) y[i] *= g * shape(i / y.length); return y; }
const whoosh = (d = 0.3, g = 1) => sweep(d, 300, 5200, 1.0, g * 1.6);
function boom(g = 1) { const x = buf(1.6); let ph = 0; for (let i = 0; i < x.length; i++) { const t = i / SR, f = 32 + 90 * Math.exp(-t / 0.08); ph += f / SR; x[i] = g * (Math.tanh(3 * Math.sin(TAU * ph)) * Math.exp(-t / 0.5) + noise() * 0.5 * Math.exp(-t / 0.05)); } return x; }
function click(f = 2400, g = 1, d = 0.07) { const x = buf(d); for (let i = 0; i < x.length; i++) { const t = i / SR; x[i] = g * (noise() * Math.exp(-t / 0.003) + 0.6 * Math.sin(TAU * f * t) * Math.exp(-t / 0.018) + 0.3 * Math.sin(TAU * f * 1.51 * t) * Math.exp(-t / 0.03)); } return x; }
function blip(m, g = 1, d = 0.09) { const x = buf(d), f = mtof(m); for (let i = 0; i < x.length; i++) { const t = i / SR; x[i] = g * 0.5 * Math.sign(Math.sin(TAU * f * t)) * Math.exp(-t / 0.03) * Math.min(1, t / 0.001); } return svf(x, () => 3800, 0.8); }
function siren(d) { const x = buf(d); let ph = 0; for (let i = 0; i < x.length; i++) { const t = i / SR, f = 760 + 380 * Math.sin(TAU * 1.5 * t) - 120 * t / d; ph += f / SR; x[i] = 0.3 * (saw(ph) * 0.6 + Math.sin(TAU * ph)) * Math.sin(Math.PI * t / d) ** 0.6; } return svf(x, () => 2400, 0.9); }
function carPass(d = 0.9, g = 1) { const x = buf(d); let ph = 0; for (let i = 0; i < x.length; i++) { const t = i / SR, u = t / d, f = 150 * (u < 0.45 ? 1.12 : 1.12 - 0.3 * cl((u - 0.45) / 0.15)); ph += f / SR; const a = Math.exp(-Math.pow((u - 0.45) / 0.16, 2)); x[i] = g * a * (saw(ph) * 0.5 + saw(ph * 2.01) * 0.3 + noise() * 0.5); } return svf(x, (t) => 500 + 3200 * Math.exp(-Math.pow((t / d - 0.45) / 0.2, 2)), 0.8); }
function screech(d = 0.55, g = 1) { const x = buf(d); let ph = 0; for (let i = 0; i < x.length; i++) { const t = i / SR, f = 1500 - 500 * t / d + 60 * Math.sin(t * 90); ph += f / SR; x[i] = g * 0.25 * (saw(ph) + 0.6 * noise()) * Math.sin(Math.PI * t / d) ** 0.5; } return svf(x, () => 2100, 2.5, 'bp'); }
function thump(g = 1, f = 62) { const x = buf(0.3); for (let i = 0; i < x.length; i++) { const t = i / SR; x[i] = g * Math.sin(TAU * (f + 40 * Math.exp(-t / 0.02)) * t) * Math.exp(-t / 0.07); } return x; }
function horn(d, m, g = 1) { const x = buf(d); for (let i = 0; i < x.length; i++) { const t = i / SR; x[i] = g * 0.2 * (Math.sign(Math.sin(TAU * mtof(m) * t)) + Math.sign(Math.sin(TAU * mtof(m + 4) * t))) * Math.min(1, t / 0.01) * Math.min(1, (d - t) / 0.03); } return svf(x, () => 1800, 0.8); }
function shout(d = 0.35, g = 1) { const x = buf(d); let ph = 0; const f0 = 140 + 120 * rnd(); for (let i = 0; i < x.length; i++) { const t = i / SR; ph += (f0 * (1 + 0.3 * Math.sin(t * 17))) / SR; x[i] = g * saw(ph) * Math.sin(Math.PI * t / d); } const a = svf(x, () => 750, 4, 'bp'), b = svf(x, () => 1250, 4, 'bp'); return a.map((v, i) => 0.5 * (v + b[i])); }

// ---- the music ----
const BEAT = 60 / 100, BAR = BEAT * 4;   // 100 bpm
const tSit = W('paalthi', 6) - 0.2, tGang = LS(4) - 0.1, tDown = LS(8), tEnd = DUR;
const prog = [[38, [62, 65, 69, 72]], [34, [58, 62, 65, 69]], [41, [60, 65, 69, 72]], [36, [60, 64, 67, 70]]];   // Dm9, Bb, F, C7
const start = 0.6;   // the down-beat is the landing
for (let b = 0, t = start; t < tSit + 0.01; b++, t += BAR) { const [root, ch] = prog[b % 4], hot = t >= tGang;
  add(MUS, pad(ch.map((n) => n - 12), BAR + 0.5, hot ? 1400 : 950, 0.55), t - 0.05, 0.7);
  for (let k = 0; k < 8; k++) { const tt = t + k * BEAT / 2; if (tt > tSit) break; const acc = k % 2 === 0;
    add(MUS, sub(root + (k === 6 ? 7 : 0) - (0), BEAT * 0.46), tt, acc ? 0.8 : 0.5);
    if (t > LS(1) - 0.3 || hot) add(MUS, hat(k === 7), tt + (k % 2 ? 0.012 : 0), acc ? 0.11 : 0.2, 0.3);
    if (k % 4 === 0) add(MUS, kick(), tt, 0.85); if (k === 3 && hot) add(MUS, kick(0.8), tt + BEAT / 4, 0.6);
    if (k % 4 === 2 && t > W('aur', 0)) add(MUS, clap(), tt, 0.55, -0.1); }
  if (t > LS(1) - 0.3) for (let k = 0; k < 16; k++) { const tt = t + k * BEAT / 4; if (tt > tSit) break; const n = ch[[0, 2, 1, 3, 2, 1, 3, 2][k % 8]] + (k % 8 > 5 ? 12 : 0); add(MUS, pluck(n, 0.28, hot ? 3600 : 2400), tt, 0.16, k % 2 ? 0.55 : -0.55); add(MUS, pluck(n, 0.2, 1400), tt + BEAT * 0.75, 0.06, k % 2 ? -0.6 : 0.6); } }
// the stillness: a D drone, bowls on his breath; the pulse is only a far heartbeat while the gun is on him
{ const d = tDown - tSit + 1.2, x = buf(d); [38, 45, 50, 57].forEach((m, k) => { const f = mtof(m), p = rnd(); for (let i = 0; i < x.length; i++) { const t = i / SR; x[i] += (Math.sin(TAU * (f * t + p)) + 0.4 * Math.sin(TAU * (2.002 * f * t + p)) + 0.15 * saw(f * 1.001 * t)) * 0.12 * (1 + 0.25 * Math.sin(t * (0.5 + k * 0.23))); } });
  const y = svf(x, (t) => 500 + 300 * Math.sin(t * 0.4), 0.7); for (let i = 0; i < y.length; i++) { const t = i / SR; y[i] *= Math.min(1, t / 1.2) * Math.min(1, (d - t) / 1.0); } add(MUS, y, tSit, 0.9);
  add(MUS, bowl(62, 5, 1), W('baith', 6), 0.8, -0.2); add(MUS, bowl(69, 5, 0.8), W('band', 6), 0.7, 0.25); add(MUS, bowl(57, 5, 0.9), W('saans', 6), 0.7, 0);
  // the dolly zoom: tension swells under the calm, then cuts
  const a0 = W('aur', 6) - 0.1, a1 = LS(7) - 0.1, z = buf(a1 - a0); for (let i = 0; i < z.length; i++) { const t = i / SR, u = t / (a1 - a0); z[i] = (saw(mtof(39 + 0.3 * u) * t) + saw(mtof(45 + 0.5 * u) * t) + saw(mtof(51) * t)) * 0.13 * u * u; } add(MUS, svf(z, (t) => 300 + 2600 * (t / (a1 - a0)) ** 2, 1.2), a0, 0.9);
  for (let t = W('aur', 7); t < W('dabata.', 7) + 0.3; t += 0.74) { add(MUS, thump(1, 52), t, 0.9); add(MUS, thump(0.7, 48), t + 0.2, 0.9); }
  add(MUS, bowl(62, 4, 1), W('nahi', 7), 0.8); }
// the guns come down: D major, wide and warm; bowls ring out to the end
{ const t0 = tDown - 0.05, chords = [[50, 57, 62, 66, 69], [55, 59, 62, 67, 71], [50, 57, 62, 66, 69, 74]], len = [2.3, 2.6, tEnd - (tDown + 4.9) + 0.3]; let t = t0; chords.forEach((c, i) => { add(MUS, pad(c, len[i] + 0.8, 1300 + 300 * i, 0.5), t, 0.85); add(MUS, sub(c[0] - 12, len[i], 1.1), t, 0.5); t += len[i]; });
  downAt().forEach((a, i) => add(MUS, bell(74 - [0, 2, 4, 7, 9][i], 1.4, 0.8), a + 0.3, 0.5, (i - 2) * 0.3));
  add(MUS, bowl(62, 6, 1.1), W('ruk', 8), 0.9); add(MUS, bowl(69, 5, 0.8), W('dekhne', 8), 0.6, 0.3); add(MUS, bowl(74, 4, 0.7), W('toh', 9), 0.55, -0.3); add(MUS, bowl(62, 4, 1), W('Comment', 9), 0.8); }
function downAt() { return [W('Ek', 8) + 0.02, W('karke', 8) + 0.1, W('saari', 8) + 0.14, W('neeche', 8), W('jhuk', 8) + 0.1]; }

// ---- sfx, on the picture's cues ----
add(SFX, sweep(0.6, 200, 7000, 1.5, 1.4, (u) => u * u), 0.0, 0.9);                    // the fall
add(SFX, boom(1), 0.6, 1.0); add(SFX, bell(86, 0.8, 1), 0.62, 0.35);                  // the landing, the title
add(SFX, whoosh(0.26), 0.95, 0.6, -0.4);
add(SFX, siren(2.9), 1.1, 0.5, 0.5);
add(SFX, carPass(0.9, 1), 1.38, 1.0, -0.6); add(SFX, carPass(0.9, 1), 1.6, 1.0, 0.6);
add(SFX, whoosh(0.22), W('hinsak', 0) + 0.05, 0.5, 0.4);
for (let i = 0; i < 6; i++) add(SFX, click(1200 + 300 * (i % 3), 0.7, 0.05), W('kisi', 0) - 0.1 + i * 0.13, 0.35, (i % 2) * 0.6 - 0.3);   // the wheel spins
add(SFX, bell(81, 1.2, 1), W('nahi', 0), 0.5); add(SFX, bell(88, 1.0, 0.7), W('nahi', 0) + 0.09, 0.4);
add(SFX, whoosh(0.3), LS(1) - 0.2, 0.6);
add(SFX, blip(84, 1), W('mission', 1) - 0.04, 0.6); add(SFX, blip(88, 1), W('mission', 1) + 0.07, 0.6); add(SFX, thump(1, 70), W('mission', 1) - 0.04, 0.8);
for (let i = 0; i < 9; i++) add(SFX, click(3000, 0.4, 0.03), W('mission', 1) + 0.1 + i * 0.05, 0.25, 0.2);                        // the order types on
add(SFX, whoosh(0.2), W('ye', 1) - 0.14, 0.5, 0.3);
for (let i = 0; i < 4; i++) add(SFX, click(5200 + 700 * i, 0.5, 0.09), W('rakh', 2) - 0.06 + i * 0.045, 0.3, 0.2);                 // the keys
add(SFX, blip(72, 1, 0.14), W('Laal', 3), 0.5); add(SFX, blip(72, 1, 0.14), W('wanted', 3) + 0.05, 0.5);
[0, 4, 7, 12, 16].forEach((n, i) => add(SFX, bell(74 + n, 1.4, 0.9), W('sunehra', 3) + i * 0.06, 0.4, (i - 2) * 0.25));           // the gold star
add(SFX, whoosh(0.24), tGang, 0.7); add(SFX, screech(0.5, 1), tGang + 0.2, 0.6, -0.5); add(SFX, screech(0.45, 0.8), tGang + 0.42, 0.5, 0.5); add(SFX, boom(0.7), tGang + 0.5, 0.7);
[0.0, 0.14, 0.26, 0.38, 0.5].forEach((d, i) => { add(SFX, click(1700 + 150 * i, 1, 0.1), W('sabki', 4) + d + 0.2, 0.55, (i - 2) * 0.35); add(SFX, click(900, 0.7, 0.06), W('sabki', 4) + d + 0.26, 0.4, (i - 2) * 0.35); });
add(SFX, blip(69, 1, 0.12), W('hukum', 4), 0.45); add(SFX, blip(76, 1, 0.12), W('hathiyaar', 4) - 0.03, 0.6); add(SFX, blip(76, 1, 0.12), W('hathiyaar', 4) + 0.12, 0.6); add(SFX, thump(1, 60), W('hathiyaar', 4) - 0.03, 0.8);
{ const a = LS(5), b = W('karte.', 5); for (let t = a, k = 0; t < b; k++) { add(SFX, click(k % 2 ? 2100 : 2600, 0.5, 0.04), t, 0.3, 0); t += 0.36 - 0.22 * cl((t - a) / (b - a)); } }   // the clock runs down
add(SFX, whoosh(0.2), W('jaan', 5) - 0.12, 0.5, -0.4); add(SFX, blip(81, 1), W('bhaago', 5), 0.5, -0.4); add(SFX, whoosh(0.2), W('ya', 5) - 0.1, 0.5, 0.4); add(SFX, blip(77, 1), W('lado,', 5), 0.5, 0.4);
{ const x = buf(0.7); let ph = 0; for (let i = 0; i < x.length; i++) { const t = i / SR; ph += (500 * Math.exp(-t * 3) + 60) / SR; x[i] = 0.4 * saw(ph) * (1 - t / 0.7); } add(SFX, svf(x, () => 1500, 0.8), W('kuch', 5), 0.5); }   // both options power down
add(SFX, sweep(0.5, 900, 200, 0.8, 1, (u) => Math.sin(Math.PI * u)), W('paalthi', 6), 0.4); add(SFX, thump(0.8, 50), W('baith', 6), 0.6);
{ const a0 = W('aur', 6), a1 = LS(7) - 0.15; for (let t = a0; t < a1; t += 0.19 + 0.2 * rnd()) { const u = (t - a0) / (a1 - a0); add(SFX, shout(0.2 + 0.25 * rnd(), 1), t, 0.12 + 0.3 * u, rnd() * 2 - 1); } for (let t = a0 + 0.3; t < a1; t += 0.55) add(SFX, horn(0.3, 62 + Math.floor(rnd() * 3) * 2, 1), t, 0.3 * ((t - a0) / (a1 - a0)), rnd() * 2 - 1); }
for (let i = 0; i < 4; i++) add(SFX, thump(0.7, 80), LS(7) + 0.1 + i * 0.26, 0.45, 0.1);                                           // his steps
add(SFX, click(1500, 1, 0.1), W('taan', 7), 0.6); add(SFX, click(800, 0.8, 0.08), W('taan', 7) + 0.07, 0.5);
downAt().forEach((a, i) => { add(SFX, click(1000 - 80 * i, 0.6, 0.08), a + 0.3, 0.4, (i - 2) * 0.35); });
add(SFX, sweep(1.1, 3000, 180, 0.7, 1, (u) => Math.sin(Math.PI * u) ** 0.7), W('poora', 8), 0.5);                                 // the city winds down
[0, 2, 4, 7, 12].forEach((n, i) => add(SFX, bell(74 + n, 1.2, 0.8), W('dekhne', 8) - 0.25 + i * 0.1, 0.35, (i - 2) * 0.25));     // five gold stars
add(SFX, blip(86, 0.8), W('Comment', 9), 0.4); add(SFX, blip(91, 0.8), W('Comment', 9) + 0.1, 0.4);

function write(B, f) { const x = new Float32Array(N * 2); for (let i = 0; i < N; i++) { x[2 * i] = B[0][i]; x[2 * i + 1] = B[1][i]; } const raw = f + '.f32'; writeFileSync(raw, Buffer.from(x.buffer)); execFileSync('ffmpeg', ['-v', 'error', '-y', '-f', 'f32le', '-ar', String(SR), '-ac', '2', '-i', raw, '-c:a', 'pcm_f32le', f]); unlinkSync(raw); }
write(MUS, join(OUT, `score${SUF}.wav`)); write(SFX, join(OUT, `sfx${SUF}.wav`));
console.log('score + sfx written,', DUR.toFixed(2), 's');
