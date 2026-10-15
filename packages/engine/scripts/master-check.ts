// tsx scripts/master-check.ts <mix.wav> <picture.mp4>: master a mix, mux it, and measure the WAV and the delivered AAC.
import { join, dirname } from 'node:path';
import { loudness, masterize, mux } from '../src/bench';

const [mix, pic] = process.argv.slice(2);
const t = Date.now();
const m = await masterize(mix!, join(dirname(mix!), 'master-check.wav'));
console.log(`master: ${m.lufs.toFixed(2)} LUFS, true peak ${m.peak.toFixed(2)} dBTP (${Date.now() - t} ms)`);
if (pic) { const out = join(dirname(mix!), 'master-check.mp4'); await mux(pic, join(dirname(mix!), 'master-check.wav'), out); const a = await loudness(out); console.log(`delivered AAC: ${a.lufs.toFixed(2)} LUFS, true peak ${a.peak.toFixed(2)} dBTP`); }
