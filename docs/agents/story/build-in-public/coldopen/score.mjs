// score.mjs: the cold open's sound, synthesised (no samples): a warm pad on a slow four-chord loop, a soft bell tick on every counter
// change (keyed to the word times), a swell into the title, a little café air. Writes bed.wav, then mixes it under vo/vo.wav into
// mix.wav and mix.mp3 (-14 LUFS, true peak -1.2 dB, the bed about 8 LU under the voice).
import { writeFileSync, readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const HERE = dirname(fileURLToPath(import.meta.url)), SR = 48000;
global.window = {}; eval(readFileSync(join(HERE, 'timing.js'), 'utf8'));
const C = window.COLD, WD = C.words, DUR = C.dur + 1.2, N = Math.ceil(DUR * SR);
const L = new Float32Array(N), R = new Float32Array(N);
let seed = 3; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647) * 2 - 1;
const mtof = m => 440 * Math.pow(2, (m - 69) / 12);
const put = (i, l, r) => { if (i >= 0 && i < N) { L[i] += l; R[i] += r; } };

// pad: Dmaj7 - Bm9 - Gmaj7 - Aadd9, 4 s per chord, detuned saws through a soft one-pole lowpass, slow in and out
const CH = [[50, 57, 61, 66, 69], [47, 54, 61, 62, 66], [43, 50, 54, 59, 62], [45, 52, 57, 59, 64]];
{ const lp = [0, 0]; for (let i = 0; i < N; i++) { const t = i / SR, c = CH[Math.floor(t / 4) % 4], cn = CH[(Math.floor(t / 4) + 1) % 4], x = (t % 4) / 4, xf = Math.max(0, (x - .85) / .15);
    let s = 0; for (let k = 0; k < 5; k++) { const f = mtof(c[k] * (1 - xf) + cn[k] * xf); for (const d of [-.08, .08]) { const ph = (t * f * Math.pow(2, d / 12)) % 1; s += (2 * ph - 1) * .05; } }
    const env = Math.min(1, t / 3) * Math.min(1, (DUR - t) / 1.5) * (t > 35.8 && t < 39.6 ? 1.35 : 1);
    const a = 0.018 + 0.006 * Math.sin(t * .7); lp[0] += a * (s - lp[0]); lp[1] += a * (lp[0] - lp[1]);
    put(i, lp[1] * env * .9, lp[1] * env * .82); } }

// a soft bell tick: two sines with an inharmonic partial, quick decay
function bell(t, m, g = .22, pan = 0) { const i0 = Math.round(t * SR), f = mtof(m); for (let i = 0; i < SR * 1.6; i++) { const u = i / SR, e = Math.exp(-u * 5.5) * Math.min(1, u * 400);
  const s = (Math.sin(2 * Math.PI * f * u) + .35 * Math.sin(2 * Math.PI * f * 2.76 * u) * Math.exp(-u * 9)) * e * g; put(i0 + i, s * (1 - pan) , s * (1 + pan)); } }
const said = WD.find(w => w.who === 'Y');           // "Always." -> 41 to 40
bell(said.e, 81, .3); bell(said.e + .02, 88, .12);
const thousand = WD[108]; bell(thousand.t + .05, 74, .28); bell(thousand.t + .1, 81, .18);   // the 1,000 appears
const j0 = WD[184].t, j1 = WD[195].t; for (let k = 0; k < 11; k++) bell(j0 + (j1 - j0) * k / 10, 84 - (k % 3), .12, (k % 2 ? .2 : -.2));   // eleven words on the dog joke
// the title: a rising air swell into a low bloom
{ const t0 = WD[119].t - 1.4, i0 = Math.round(t0 * SR); let lp = 0; for (let i = 0; i < SR * 4; i++) { const u = i / SR, e = u < 1.4 ? Math.pow(u / 1.4, 2) : Math.exp(-(u - 1.4) * 1.3);
  lp += (.02 + .2 * Math.min(1, u / 1.4)) * (rnd() - lp); put(i0 + i, lp * e * .18, lp * e * .18); }
  bell(WD[119].t, 50, .35); bell(WD[119].t + .01, 62, .2); }
// café air: very quiet filtered noise with a cup clink, in the café scenes only (0-36 s)
{ let lp = 0; for (let i = 0; i < Math.round(36 * SR); i++) { lp += .03 * (rnd() - lp); const e = Math.min(1, i / SR / 2) * Math.min(1, (36 - i / SR) / 2); put(i, lp * .05 * e, lp * .05 * e); } }
bell(4.2, 96, .06, .5); bell(13.1, 98, .05, -.5); bell(24.0, 97, .05, .4);

// write a 16-bit stereo wav
function wav(path) { const b = Buffer.alloc(44 + N * 4); b.write('RIFF', 0); b.writeUInt32LE(36 + N * 4, 4); b.write('WAVEfmt ', 8); b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(2, 22);
  b.writeUInt32LE(SR, 24); b.writeUInt32LE(SR * 4, 28); b.writeUInt16LE(4, 32); b.writeUInt16LE(16, 34); b.write('data', 36); b.writeUInt32LE(N * 4, 40);
  let pk = 0; for (let i = 0; i < N; i++) pk = Math.max(pk, Math.abs(L[i]), Math.abs(R[i])); const g = .7 / pk;
  for (let i = 0; i < N; i++) { b.writeInt16LE(Math.round(L[i] * g * 32767), 44 + i * 4); b.writeInt16LE(Math.round(R[i] * g * 32767), 46 + i * 4); } writeFileSync(path, b); }
wav(join(HERE, 'bed.wav'));
// mix: voice normalised to -16 LUFS, bed to -24 (8 LU under), then the master to -14 LUFS, true peak -1.2
const ff = a => execFileSync('ffmpeg', ['-v', 'error', '-y', ...a]);
ff(['-i', join(HERE, 'vo/vo.wav'), '-i', join(HERE, 'bed.wav'), '-filter_complex',
  '[0:a]aresample=48000,pan=stereo|c0=c0|c1=c0,loudnorm=I=-16:TP=-2:LRA=11[v];[1:a]loudnorm=I=-24:TP=-6:LRA=11[b];[v][b]amix=inputs=2:normalize=0:duration=longest,loudnorm=I=-14:TP=-1.2:LRA=11,aresample=48000[o]',
  '-map', '[o]', join(HERE, 'mix.wav')]);
ff(['-i', join(HERE, 'mix.wav'), '-b:a', '192k', join(HERE, 'vo/mix.mp3')]);
console.log('bed.wav, mix.wav, vo/mix.mp3 written,', DUR.toFixed(1), 's');
