/**
 * D2.8, edit by words on a planned edit folder (the one planEdit wrote: edl.json and the source):
 *
 *   pnpm --filter @moovi/engine exec tsx scripts/reedit.ts <edit dir> "tighter, less zoom, swap the card at 0:12"
 *
 * Prints what each clause did, what it could not read, and how long it took; writes edl.json (old one kept as
 * edl.prev.json, so "undo" works) when the result is valid. The preview player replays the new edl.json as it is.
 */
import { reEditDir } from '../src/edit/reedit';

const [dir, ...rest] = process.argv.slice(2);
if (!dir || !rest.length) { console.error('usage: reedit.ts <edit dir> "<instruction>"'); process.exit(2); }
const r = await reEditDir(dir, rest.join(' '));
for (const s of r.steps) console.log(`- "${s.said}": ${s.did}`);
for (const u of r.unknown) console.log(`- "${u}": not understood, nothing changed for it`);
for (const p of r.problems) console.log(`! ${p}`);
console.log(`${r.written ? 'written' : 'not written'} in ${r.ms} ms, ${r.duration.before} s -> ${r.duration.after} s`);
process.exit(r.problems.length ? 1 : 0);
