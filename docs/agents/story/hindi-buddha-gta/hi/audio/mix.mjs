// mix.mjs: voice at -18 LUFS, the score through a short room and set UNDER LU below the voice, sfx on top, master
// -14 LUFS / TP -1.2. Writes mix.wav and mix.json. Run: node audio/mix.mjs   (after score.mjs)
import { execFileSync, spawnSync } from 'node:child_process';
import { writeFileSync, existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const HERE = dirname(fileURLToPath(import.meta.url)), ST = join(HERE, 'stems');
const DUB = process.env.DUB === 'en', SUF = DUB ? '-en' : '', TAKE = DUB ? 'take-titan.mp3' : TAKE;   // DUB=en mixes the English dub
const UNDER = +(process.env.UNDER ?? 9), SFXUNDER = +(process.env.SFXUNDER ?? 7);
const lufs = (f) => { const s = spawnSync('ffmpeg', ['-hide_banner', '-nostats', '-i', f, '-af', 'ebur128=peak=true', '-f', 'null', '-'], { encoding: 'utf8', maxBuffer: 1 << 28 }).stderr; const S = s.slice(s.lastIndexOf('Summary:'));
  return { I: parseFloat(/I:\s+(-?[\d.]+) LUFS/.exec(S)?.[1] ?? '-70'), TP: parseFloat(/Peak:\s+(-?[\d.inf]+) dBFS/.exec(S)?.[1] ?? '-70') }; };
// the voice: the Viraj take, one continuous read, sped up by timing.js's tempo (atempo keeps the pitch)
if (!existsSync(join(HERE, `voice${SUF}.wav`))) { const tempo = /"tempo":\s*([\d.]+)/.exec(readFileSync(join(HERE, '..', (DUB ? 'timing-en.js' : 'timing.js')), 'utf8'))[1]; execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', join(HERE, '..', '..', 'audio', TAKE), '-af', `atempo=${tempo}`, '-ar', '44100', '-ac', '1', join(HERE, `voice${SUF}.wav`)]); }
const v = lufs(join(HERE, `voice${SUF}.wav`)), m = lufs(join(ST, `score${SUF}.wav`)), s = lufs(join(ST, `sfx${SUF}.wav`));
const gv = -18 - v.I, gm = -18 - UNDER - m.I, gs = -18 - SFXUNDER - s.I;
execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', join(HERE, `voice${SUF}.wav`), '-i', join(ST, `score${SUF}.wav`), '-i', join(ST, `sfx${SUF}.wav`), '-filter_complex',
  `[0]volume=${gv.toFixed(2)}dB,aresample=48000,pan=stereo|c0=c0|c1=c0[v];[1]volume=${gm.toFixed(2)}dB,aecho=0.8:0.5:60|110:0.18|0.12[m];[2]volume=${gs.toFixed(2)}dB,aecho=0.8:0.4:45:0.15[s];[v][m][s]amix=inputs=3:normalize=0:duration=longest,loudnorm=I=-14:TP=-1.2:LRA=11,alimiter=limit=0.85:level=false[o]`,
  '-map', '[o]', '-ar', '48000', '-c:a', 'pcm_s16le', join(HERE, `mix${SUF}.wav`)]);
execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', join(HERE, `mix${SUF}.wav`), '-b:a', '192k', join(HERE, `mix${SUF}.mp3`)]);   // the copy that is committed (wav files stay out of git)
const M = lufs(join(HERE, `mix${SUF}.wav`)); writeFileSync(join(HERE, `mix${SUF}.json`), JSON.stringify({ voice: v, score: m, sfx: s, gainsDb: { voice: +gv.toFixed(2), score: +gm.toFixed(2), sfx: +gs.toFixed(2) }, under: UNDER, sfxUnder: SFXUNDER, master: M }, null, 1));
console.log('master', M, 'gains', gv.toFixed(1), gm.toFixed(1), gs.toFixed(1));
