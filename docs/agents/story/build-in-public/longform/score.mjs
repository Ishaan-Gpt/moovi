// score.mjs: the long form's sound, synthesised (no samples): a soft pulse-and-pad bed in the cold open's key, a low swell into each
// section, and a soft bell on the big reveals (4.6M, 15, the judge's scores, 5.5, the bar of 8). Writes bed.wav, then mixes it under
// vo/vo.wav into mix.wav and vo/mix.mp3 (-14 LUFS, true peak -1.2 dB, the bed about 10 LU under the voice: an explainer keeps it low).
import { writeFileSync, readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const HERE = dirname(fileURLToPath(import.meta.url)), SR = 48000;
global.window = {}; eval(readFileSync(join(HERE, 'timing.js'), 'utf8'));
const LF = window.LF, DUR = LF.dur + 1.5, N = Math.ceil(DUR * SR);
const L = new Float32Array(N), R = new Float32Array(N);
let seed = 5; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647) * 2 - 1;
const mtof = m => 440 * Math.pow(2, (m - 69) / 12), put = (i, l, r) => { if (i >= 0 && i < N) { L[i] += l; R[i] += r; } };
const norm = s => s.toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
function at(sec, phrase) { const si = LF.secs.findIndex(s => s.n === sec), S = LF.secs[si], toks = phrase.split(/\s+/).map(norm), end = si + 1 < LF.secs.length ? LF.secs[si + 1].i0 : LF.words.length; if (!S) return 0;
  for (let i = S.i0; i < end; i++) { let ok = true; for (let k = 0; k < toks.length; k++) if (!LF.words[i + k] || norm(LF.words[i + k].w) !== toks[k]) { ok = false; break; } if (ok) return LF.words[i].t; } return S.t; }

// pad: D major family, 8 s a chord, darker in the fall (section 7) and brighter in the climb (8)
const CH = [[50, 57, 61, 66], [47, 54, 59, 62], [43, 50, 55, 59], [45, 52, 57, 61]], FALL = [[47, 54, 57, 62], [43, 50, 53, 58]];
{ const lp = [0, 0]; const s7 = LF.secs.find(s => s.n === 27) || { t: 1e9 }, s8 = LF.secs.find(s => s.n === 28) || { t: 1e9 }, inCo = t => (LF.cos || []).some(c => t >= c.t - .2 && t < c.e + .2);
  for (let i = 0; i < N; i++) { const t = i / SR, inFall = t >= s7.t && t < s8.t, set = inFall ? FALL : CH, c = set[Math.floor(t / 8) % set.length];
    let s = 0; for (let k = 0; k < 4; k++) { const f = mtof(c[k]); for (const d of [-.07, .07]) { const ph = (t * f * Math.pow(2, d / 12)) % 1; s += (2 * ph - 1) * .05; } }
    const a = .012 + .004 * Math.sin(t * .5); lp[0] += a * (s - lp[0]); lp[1] += a * (lp[0] - lp[1]);
    // a soft pulse on the beat (100 bpm), muted in the fall
    const beat = (t * 100 / 60) % 1, pulse = inFall ? 0 : Math.exp(-beat * 18) * Math.sin(2 * Math.PI * 55 * t) * .25;
    const env = Math.min(1, t / 2) * Math.min(1, (DUR - t) / 2) * (inCo(t) ? 0 : 1);
    put(i, (lp[1] + pulse * .3) * env, (lp[1] * .9 + pulse * .3) * env); } }
function bell(t, m, g = .2) { const i0 = Math.round(t * SR), f = mtof(m); for (let i = 0; i < SR * 1.6; i++) { const u = i / SR, e = Math.exp(-u * 5) * Math.min(1, u * 400); const s = (Math.sin(2 * Math.PI * f * u) + .3 * Math.sin(2 * Math.PI * f * 2.76 * u) * Math.exp(-u * 9)) * e * g; put(i0 + i, s, s); } }
function swell(t, g = .14) { const i0 = Math.round((t - 1) * SR); let lp = 0; for (let i = 0; i < SR * 1.6; i++) { const u = i / SR, e = u < 1 ? u * u : Math.exp(-(u - 1) * 4); lp += (.02 + .15 * Math.min(1, u)) * (rnd() - lp); put(i0 + i, lp * e * g, lp * e * g); } }
LF.secs.forEach(s => swell(s.t));
[[20, 'four point six million', 81], [21, 'that column is the trick', 78], [22, 'mine came back with four rules', 78], [23, 'had nobody in the genre', 83], [25, 'from forty-one to forty', 81], [27, 'mine came last', 62], [27, 'and it scored five', 79], [28, 'the shortcut is a skill', 81]]
  .forEach(([s, p, m]) => { const t = at(s, p); bell(t, m, .2); bell(t + .02, m + 7, .08); });

function wav(path) { const b = Buffer.alloc(44 + N * 4); b.write('RIFF', 0); b.writeUInt32LE(36 + N * 4, 4); b.write('WAVEfmt ', 8); b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(2, 22);
  b.writeUInt32LE(SR, 24); b.writeUInt32LE(SR * 4, 28); b.writeUInt16LE(4, 32); b.writeUInt16LE(16, 34); b.write('data', 36); b.writeUInt32LE(N * 4, 40);
  let pk = 0; for (let i = 0; i < N; i++) pk = Math.max(pk, Math.abs(L[i]), Math.abs(R[i])); const g = .7 / pk;
  for (let i = 0; i < N; i++) { b.writeInt16LE(Math.round(L[i] * g * 32767), 44 + i * 4); b.writeInt16LE(Math.round(R[i] * g * 32767), 46 + i * 4); } writeFileSync(path, b); }
wav(join(HERE, 'bed.wav'));
const ff = a => execFileSync('ffmpeg', ['-v', 'error', '-y', ...a]);
ff(['-i', join(HERE, 'vo/vo.wav'), '-i', join(HERE, 'bed.wav'), '-filter_complex',
  '[0:a]aresample=48000,pan=stereo|c0=c0|c1=c0,loudnorm=I=-16:TP=-2:LRA=11[v];[1:a]loudnorm=I=-26:TP=-6:LRA=11[b];[v][b]amix=inputs=2:normalize=0:duration=longest,loudnorm=I=-14:TP=-1.2:LRA=11,aresample=48000[o]',
  '-map', '[o]', join(HERE, 'mix.wav')]);
ff(['-i', join(HERE, 'mix.wav'), '-b:a', '160k', join(HERE, 'vo/mix.mp3')]);
console.log('bed.wav, mix.wav, vo/mix.mp3 written,', DUR.toFixed(1), 's');
