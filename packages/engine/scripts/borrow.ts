// pnpm --filter @moovi/engine borrow <film dir> [--all] [--off]
// Re-asks the library graph for inserts on an existing Style 4 or Dark Vox film (no model, no voice): its beats are
// read back from film.json, their needs detected again; weak = improvised (or every beat with --all, for a look at
// what the library offers). Writes <dir>/library.json and prints the inserts. --off moves library.json aside (the
// "before" of an A/B: the same film, nothing borrowed).
import { existsSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { closeMemory } from '@moovi/graph';
import { borrow, libraryFile, roomOf, type BorrowBeat } from '../src/styles/kit/borrow';
import { detectNeeds } from '../src/styles/kit/needs';

const args = process.argv.slice(2), dir = resolve(process.env.INIT_CWD ?? process.cwd(), args.find(a => !a.startsWith('--'))!);
if (args.includes('--off')) { if (existsSync(libraryFile(dir))) renameSync(libraryFile(dir), libraryFile(dir) + '.off'); console.log('library.json moved aside'); process.exit(0); }
const film = JSON.parse(readFileSync(join(dir, 'film.json'), 'utf8')) as { beats?: S4Beat[]; shots?: DvShot[] };
interface S4Beat { setup: string; t0: number; t1: number; locks?: { pos: string; toks: { text: string }[] }[] }
interface DvShot { setup: string; t0: number; t1: number; words: { word: string }[] }
const style = basename(dirname(dir));
const list = film.beats ?? film.shots ?? [];
const beats: BorrowBeat[] = list.map((b, i) => {
  const text = 'words' in b ? (b as DvShot).words.map(w => w.word).join(' ') : ((b as S4Beat).locks ?? []).flatMap(l => l.toks.map(t => t.text)).join(' ');
  return { index: i, t0: b.t0, t1: b.t1, text, needs: detectNeeds(text, { index: i, count: list.length }), weak: args.includes('--all') || /improv/.test(b.setup), locked: b.setup === 'end-card' || i === list.length - 1, room: roomOf((b as S4Beat).locks) };
});
const r = await borrow(beats, { seed: basename(dir) });
console.log(`${style}/${basename(dir)}: ${r.asked} weak beats asked, ${r.inserts.length} inserts, ${r.ms} ms${r.why ? ` (${r.why})` : ''}`);
for (const x of r.inserts) console.log(`  beat ${x.beat + 1} ${x.at.toFixed(1)}-${x.end.toFixed(1)}s  ${x.asset} → ${x.art} (${x.hits} needs: ${x.needs.join(',')})  ${x.room}/${x.side}  ${JSON.stringify(x.content).slice(0, 80)}`);
writeFileSync(libraryFile(dir), JSON.stringify({ style, inserts: r.inserts, asked: r.asked, ms: r.ms }, null, 1));
await closeMemory();
