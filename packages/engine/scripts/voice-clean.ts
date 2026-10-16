/** D1.2b bench: `tsx scripts/voice-clean.ts <in> <out.m4a> [edl.json]` cleans a take (cut by the EDL when given) and prints the numbers. */
import { cleanVoice, loudness } from '../src/edit/voice';
import { keepOf } from '../src/edit/edl';
import { readFileSync } from 'node:fs';
const [inp, out, edl] = process.argv.slice(2);
const b = await loudness(inp!);
const keep = edl ? keepOf(JSON.parse(readFileSync(edl, 'utf8'))) : undefined;
const r = await cleanVoice(inp!, out!, keep ? { keep } : {});
console.log(JSON.stringify({ src: b, ...r, kept: keep?.length }));
