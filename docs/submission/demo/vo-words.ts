// Transcribe the demo film's voiceover to timed words (to line the beats up). Usage (from packages/engine):
// pnpm exec tsx --env-file-if-exists=../../.env.local ../../docs/submission/demo/vo-words.ts <audio> <out.json>
import { writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { transcribeWords } from '../../../packages/engine/src/audio/stt';
const [file, out] = process.argv.slice(2);
const words = await transcribeWords(file!, dirname(out!), { maxSeconds: 400 });
writeFileSync(out!, JSON.stringify(words));
let line = '', t0 = 0; for (const w of words as { w?: string; word?: string; text?: string; s?: number; start?: number }[]) { const s = w.s ?? w.start ?? 0; if (!line) t0 = s; line += (w.w ?? w.word ?? w.text) + ' '; if (/[.?!]$/.test(line.trim())) { console.log(t0.toFixed(2), line.trim()); line = ''; } }
if (line) console.log(t0.toFixed(2), line.trim());
