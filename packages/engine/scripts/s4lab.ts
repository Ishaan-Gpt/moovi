// The Editorial composition lab: plays ANY set-ups of the library (or all of them) over an existing film's voice and
// pictures, with no model call, and writes a contact sheet labelled by set-up. For looking at the library.
//   tsx scripts/s4lab.ts --from <data/s4/<film>> [--setups hero-stack,diptych,...|all|layouts|specs --specs <file.json>] [--offset 0] [--keep]
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';
import { config } from '../src/config';
import { compose, pieces, type Cast, type Word } from '../src/s4/compose';
import { LIBRARY, entrances, setupOf } from '../src/s4/library';
import type { Picture } from '../src/s4/picture';
import { servePlayer } from '../src/s4/player';
import { contactSheet } from '../src/s4/sheet';
import { sketch, detectNeeds } from '../src/styles/kit';
import { VOCAB } from '../src/s4/library';

const args = process.argv.slice(2), opt = (k: string) => { const i = args.indexOf(`--${k}`); return i >= 0 ? args[i + 1] : undefined; };
const src = resolve(opt('from') ?? join(config.data, 's4', 'patagonia-com-e301eb'));
const LAYOUTS = VOCAB.layouts.map(l => `__spec:${l}`);
// --specs <file.json>: an array of improvised specs, each played as one beat through the composer
const SPECS: unknown[] = opt('specs') ? JSON.parse(readFileSync(opt('specs')!, 'utf8')) : [];
const want = (opt('setups') ?? 'all') === 'all' ? [...LIBRARY.map(s => s.id), '__spec'] : opt('setups') === 'layouts' ? LAYOUTS : opt('setups') === 'specs' ? SPECS.map((_, i) => `__json:${i}`) : opt('setups')!.split(',');
const offset = Number(opt('offset') ?? 0);
const old = JSON.parse(readFileSync(join(src, 'film.json'), 'utf8'));
const words: Word[] = JSON.parse(readFileSync(join(src, 'words.json'), 'utf8'));
const id = `lab-${basename(src)}`, dir = join(config.data, 's4', id); mkdirSync(dir, { recursive: true });
for (const f of ['master.wav', 'vo.wav']) if (existsSync(join(src, f))) cpSync(join(src, f), join(dir, f));
// the source's prints, as pictures
const pf = readdirSync(join(src, 'pics')).filter(f => /^p\d+\.png$/.test(f)).sort((a, b) => parseInt(a.slice(1)) - parseInt(b.slice(1)));
const rep = existsSync(join(src, 's4-report.json')) ? JSON.parse(readFileSync(join(src, 's4-report.json'), 'utf8')) : {};
const pics: Picture[] = pf.map(f => { const i = parseInt(f.slice(1)); const parts = readdirSync(join(src, 'pics')).filter(x => new RegExp(`^p${i}-\\d+\\.png$`).test(x)).sort().map((png, k) => ({ id: String(k), move: k ? 'lift' : 'still', png }));
  return { full: f, parts, labelAt: null, keys: [], kind: 'literal', idea: '', coined: '', antagonist: false, orbit: false, layers: [], svg: '', stats: { bbox: rep.pictures?.[i]?.stats?.bbox } as never, model: 'lab', cached: true, seconds: 0 } as unknown as Picture; });
const ps = pieces(words);
// repeat the voice's beats until every wanted set-up got one
const n = Math.max(ps.length, want.length);
const allPs = Array.from({ length: n }, (_, i) => { const p = ps[i % ps.length]!, lap = Math.floor(i / ps.length) * (words.at(-1)!.end + 0.5); return { text: p.text, words: p.words.map(w => ({ ...w, t: w.t + lap, end: w.end + lap })) }; });
const setups = allPs.map((_, i) => setupOf(LIBRARY, want[(i + offset) % want.length]!) ?? null);
const ent = entrances(setups, id);
const cast: Cast[] = allPs.map((p, i) => {
  const s = setups[i], sid = want[(i + offset) % want.length]!, k = s?.pics ?? 1;
  const ws = p.words.map(w => ({ ...w, t: w.t - p.words[0]!.t }));
  const lay = sid.startsWith('__spec:') ? sid.slice(7) : '';
  // __spec = the no-model sketch; __spec:<layout> = a hand-made spec in that layout (two prints, a card, a device, a label)
  const spec = sid.startsWith('__json:') ? SPECS[Number(sid.slice(7))] as never : sid === '__spec' ? sketch({ text: p.text, words: ws, needs: detectNeeds(p.text) }, VOCAB)
    : lay ? { layout: lay, about: `lab ${lay}`, needs: ['idea' as const], elements: [
      { kind: 'picture', icon: 'main', word: 0, size: 'l' as const, tone: 'ink', motion: 'push' },
      { kind: 'word', text: ws[1]?.word ?? '', word: 1, size: 'l' as const, tone: 'ink', motion: 'type' },
      { kind: 'picture', icon: 'echo', word: 2, size: 'm' as const, tone: 'ink', motion: 'drop' },
      { kind: 'label', text: ws[2]?.word ?? 'here', word: 2, size: 's' as const, tone: 'ink', motion: 'type' },
      { kind: 'shape', shape: 'card', word: 3, size: 'm' as const, tone: 'paper', motion: 'drop' },
      { kind: 'device', shape: ['circle', 'arrow', 'orbit', 'beam', 'ruler', 'stamp', 'underline', 'tape', 'bracket', 'circle'][lay.length % 10], word: 4, size: 'm' as const, tone: 'ink', motion: 'draw' },
    ] } : undefined;
  return { setup: sid, family: s?.family ?? 'improv', why: 'lab', pics: Array.from({ length: k }, (_, j) => pics[(i + j) % pics.length]!), spec, enter: ent[i]! };
});
const duration = allPs.at(-1)!.words.at(-1)!.end + 0.6;
const { film, events } = compose({ id, world: old.world, words, pieces: allPs, cast, coined: rep.coined ?? 'crop rotation', duration, audio: '/v/master.wav', picUrl: f => `/data/s4/${basename(src)}/pics/${f}` });
writeFileSync(join(dir, 'film.json'), JSON.stringify(film, null, 1)); writeFileSync(join(dir, 'events.json'), JSON.stringify(events, null, 1));
const { url, close } = await servePlayer(dir, Number(opt('port') ?? 0));
console.log(`PREVIEW ${url}`);
const sheet = await contactSheet({ pv: url, dir, out: join(config.data, 's4', `${id}-sheet.png`), title: `${id} · Editorial lab · ${film.beats.length} beats`, duration, perBeat: true });
console.log(`sheet ${sheet.path}${sheet.empty.length ? `  EMPTY at ${sheet.empty.join(', ')}` : ''}`);
if (!args.includes('--keep')) close();
