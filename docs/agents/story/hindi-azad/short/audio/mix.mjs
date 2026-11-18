// mix.mjs: voice -18 LUFS, the score through a room, ridden per spoken line to sit ~7.5 LU under the voice, sfx on top,
// master -14 LUFS / TP -1.2. Writes mix.wav and mix.json. Run: node docs/agents/story/hindi-azad/short/audio/mix.mjs
import { execFileSync, spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const HERE = dirname(fileURLToPath(import.meta.url)), ST = join(HERE, 'stems'), SR = 48000;
globalThis.window = {}; new Function('window', readFileSync(join(HERE, '..', 'timing.js'), 'utf8'))(globalThis.window);
const T = globalThis.window.TIMING;
const UNDER = +(process.env.UNDER ?? 7.5), SFXDB = +(process.env.SFXDB ?? 0);
const dec = (f) => { const b = execFileSync('ffmpeg', ['-v', 'error', '-i', f, '-ac', '2', '-ar', String(SR), '-f', 'f32le', '-'], { maxBuffer: 1 << 30 }); return new Float32Array(b.buffer, b.byteOffset, b.byteLength / 4); };
const enc = (x, f) => { const raw = f + '.f32'; writeFileSync(raw, Buffer.from(x.buffer, x.byteOffset, x.byteLength)); execFileSync('ffmpeg', ['-v', 'error', '-y', '-f', 'f32le', '-ar', String(SR), '-ac', '2', '-i', raw, '-c:a', 'pcm_f32le', f]); execFileSync('cmd', ['/c', 'del', raw.replace(/\//g, '\\')]); };
const lufs = (f, a, b) => { const args = ['-hide_banner', '-nostats']; if (a != null) args.push('-ss', String(a), '-t', String(b - a)); args.push('-i', f, '-af', 'ebur128=peak=true', '-f', 'null', '-');
  const s = spawnSync('ffmpeg', args, { encoding: 'utf8', maxBuffer: 1 << 28 }).stderr; const S = s.slice(s.lastIndexOf('Summary:'));
  return { I: parseFloat(/I:\s+(-?[\d.]+) LUFS/.exec(S)?.[1] ?? '-70'), TP: parseFloat(/Peak:\s+(-?[\d.inf]+) dBFS/.exec(S)?.[1] ?? '-70') }; };

// a room: 1.8 s stereo noise tail, darkening as it decays
{ const n = Math.round(1.8 * SR), ir = new Float32Array(n * 2); let s = 99, l = 0, r = 0; const rn = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296) * 2 - 1;
  for (let i = 0; i < n; i++) { const t = i / SR, a = Math.exp(-t / 0.42), c = 0.15 + 0.8 * Math.exp(-t / 0.5); l = l * (1 - c) + rn() * c; r = r * (1 - c) + rn() * c; ir[2 * i] = l * a; ir[2 * i + 1] = r * a; }
  ir[0] = 0; enc(ir, join(ST, 'ir.wav')); }
execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', join(ST, 'score.wav'), '-i', join(ST, 'ir.wav'), '-filter_complex', '[0][1]afir=dry=8:wet=3:length=1[o]', '-map', '[o]', '-c:a', 'pcm_f32le', join(ST, 'score-room.wav')]);
// voice at -18 LUFS
const vI = lufs(join(HERE, 'voice.mp3')).I;
execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', join(HERE, 'voice.mp3'), '-af', `volume=${(-18 - vI).toFixed(2)}dB`, '-ar', String(SR), '-ac', '2', '-c:a', 'pcm_f32le', join(ST, 'voice.wav')]);
// ride the score per line
const score = dec(join(ST, 'score-room.wav')), N = score.length / 2, gain = new Float32Array(N).fill(1), rows = [];
const lines = T.lines.map((l) => [l[0].t, l.at(-1).end]);
const g0 = lufs(join(ST, 'score-room.wav')).I, baseDb = -18 - UNDER - 2 - g0; // first guess: whole score
const lineDb = lines.map(([a, b]) => { const v = lufs(join(ST, 'voice.wav'), a, b).I, m = lufs(join(ST, 'score-room.wav'), a, b).I; const want = v - UNDER, d = Math.max(-8, Math.min(14, want - m)); rows.push({ a, b, voice: v, score: m, gainDb: +d.toFixed(2) }); return d; });
const gapDb = baseDb; // between lines: the bed carries at its whole-film level
const keys = []; lines.forEach(([a, b], i) => { keys.push([a - 0.2, lineDb[i]], [b + 0.05, lineDb[i]]); });
const dbAt = (t) => { if (t <= keys[0][0]) return lineDb[0]; for (let i = 1; i < keys.length; i++) if (t <= keys[i][0]) { const [ta, da] = keys[i - 1], [tb, dbb] = keys[i]; const u = Math.min(1, Math.max(0, (t - ta) / Math.max(0.4, tb - ta))); return da + (dbb - da) * u; } return keys.at(-1)[1] + 1.5; };
void gapDb;
for (let i = 0; i < N; i++) gain[i] = Math.pow(10, dbAt(i / SR) / 20);
for (let i = 0; i < N; i++) { score[2 * i] *= gain[i]; score[2 * i + 1] *= gain[i]; }
enc(score, join(ST, 'score-ridden.wav'));
// sum and master
execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', join(ST, 'voice.wav'), '-i', join(ST, 'score-ridden.wav'), '-i', join(ST, 'sfx.wav'), '-filter_complex',
  `[2]volume=${SFXDB}dB[s];[0][1][s]amix=inputs=3:normalize=0:duration=longest,loudnorm=I=-14:TP=-1.2:LRA=11:linear=true,alimiter=limit=0.85:level=false[o]`,
  '-map', '[o]', '-ar', String(SR), '-c:a', 'pcm_s16le', join(HERE, 'mix.wav')]);
const M = lufs(join(HERE, 'mix.wav'));
// check: bed (ridden score + sfx) vs voice per line
const check = lines.map(([a, b], i) => ({ line: i, voice: rows[i].voice, bed: lufs(join(ST, 'score-ridden.wav'), a, b).I }));
writeFileSync(join(HERE, 'mix.json'), JSON.stringify({ master: M, rows, check }, null, 1));
console.log('master', M, '\n' + check.map((c) => `line ${c.line}: voice ${c.voice} bed ${c.bed} (under ${(c.voice - c.bed).toFixed(1)})`).join('\n'));
