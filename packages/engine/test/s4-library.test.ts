import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cast, chooseArc, libraryErrors, signals, sketch, tidy, ARCS, type BeatIn } from '../src/styles/kit';
import { ARCS_ALLOWED, LIBRARY, VOCAB, adapt, beatsIn, editorialArc, entrances, lineOfPiece } from '../src/s4/library';
import { RENDERERS } from '../src/s4/player';
import { pieces, type Word } from '../src/s4/compose';

const wordsOf = (text: string, t0 = 0): Word[] => text.split(/\s+/).map((w, i) => ({ word: w, t: t0 + i * 0.35, end: t0 + i * 0.35 + 0.3 }));
const SCRIPT = [
  'A torn sleeve hangs over the back of a chair.',
  'Patagonia treats it as a repair, not a verdict.',
  'The site keeps a Worn Wear shelf for jackets with winters left.',
  'A farmer never plants the same field until it tires.',
  'Think of it as crop rotation.',
  'Each jacket gets another season, then another owner.',
  'The company guarantees everything it makes, 100 percent.',
  'Profits go to the planet, like seed returned to soil.',
  'The best coat is the one you never replace.',
];
const film = () => { let t = 0; const ws: Word[] = []; for (const l of SCRIPT) { const w = wordsOf(l, t); ws.push(...w); t = w.at(-1)!.end + 0.2; } return ws; };

test('s4 library: valid, at least 40 set-ups, every id has a renderer in the player', () => {
  assert.deepEqual(libraryErrors(LIBRARY), []);
  assert.ok(LIBRARY.length >= 40, `only ${LIBRARY.length} set-ups`);
  const missing = LIBRARY.filter(s => !RENDERERS.includes(s.id)).map(s => s.id);
  assert.deepEqual(missing, [], `no renderer for ${missing.join(', ')}`);
  assert.ok(new Set(LIBRARY.map(s => s.family)).size >= 30, 'families are too few for variety');
});

test('s4 cast: never the same family back to back, and two films differ', () => {
  const ps = pieces(film());
  const bins = beatsIn(ps, { coined: 'crop rotation' });
  for (const seed of ['a', 'b', 'c', 'd', 'e']) {
    const c = cast(bins, LIBRARY, { seed });
    for (let i = 1; i < c.length; i++) if (c[i]!.setup && c[i - 1]!.setup) assert.notEqual(c[i]!.setup!.family, c[i - 1]!.setup!.family, `seed ${seed} beat ${i}`);
  }
  const one = cast(bins, LIBRARY, { seed: 'film-1' }).map(c => c.setup?.id ?? '-');
  const two = cast(bins, LIBRARY, { seed: 'film-2', recent: one }).map(c => c.setup?.id ?? '-');
  const same = one.filter((x, i) => x === two[i]).length;
  assert.ok(same <= Math.floor(one.length / 3), `film 2 repeats ${same}/${one.length} set-ups of film 1`);
});

test('s4 cast: the coined line goes to a coined set-up, a number line can get the giant number', () => {
  const ps = pieces(film());
  const bins = beatsIn(ps, { coined: 'crop rotation' });
  const c = cast(bins, LIBRARY, { seed: 'x' });
  const k = bins.findIndex(b => b.text.includes('crop rotation'));
  assert.equal(c[k]!.setup?.family, 'coined');
  const n: BeatIn = { index: 0, text: 'It costs 400 dollars a year.', words: 6, seconds: 2.2, needs: ['number', 'money'], items: 0, number: 400, role: 'middle' };
  assert.ok(cast([n], LIBRARY, { seed: 'n' })[0]!.setup?.number, 'a number line should cast a set-up that shows the number');
});

test('s4 arcs: at least 7 allowed, the editorial dialect adds the coined line, the last arc gives way', () => {
  assert.ok(ARCS_ALLOWED.length >= 7);
  for (const id of ARCS_ALLOWED) assert.ok(ARCS.some(a => a.id === id), id);
  const a = editorialArc(ARCS.find(x => x.id === 'myth-truth')!);
  assert.ok(a.slots.some(s => /NAME IT/.test(s.does)));
  const sig = signals('our story began in 1973 when the founders made a jacket');
  const first = chooseArc(ARCS_ALLOWED, sig, [], 'seed');
  assert.notEqual(chooseArc(ARCS_ALLOWED, sig, [first.id], 'seed').id, first.id);
});

test('s4 improvise vocabulary: sketches and tidied specs stay inside it; grown specs re-anchor', () => {
  const ws = wordsOf('Fleece, denim and wool come back to the shelf');
  const sp = sketch({ text: ws.map(w => w.word).join(' '), words: ws, needs: ['list'] }, VOCAB);
  assert.ok(VOCAB.layouts.includes(sp.layout));
  for (const e of sp.elements) { assert.ok(VOCAB.kinds.includes(e.kind), e.kind); if (e.shape) assert.ok(VOCAB.shapes.includes(e.shape)); }
  const t = tidy({ layout: 'orbitz', elements: [{ kind: 'picture', icon: 'main', word: 2, size: 'xl', tone: 'ink', motion: 'drop' }, { kind: 'device', shape: 'circle', word: 4, size: 'm', tone: 'ink', motion: 'draw' }] } as never, { text: 'x', words: ws, needs: [] }, VOCAB);
  assert.ok(t && VOCAB.layouts.includes(t.layout));
  const nb = wordsOf('Every season the coat returns');
  const ad = adapt(sp, { text: nb.map(w => w.word).join(' '), words: nb });
  assert.ok(ad.elements.every(e => e.word < nb.length));
});

test('s4 helpers: lines map to pieces in order; entrances never triple', () => {
  const ps = pieces(film());
  const idx = lineOfPiece(ps, SCRIPT);
  assert.equal(idx[0], 0); assert.equal(idx.at(-1), SCRIPT.length - 1);
  for (let i = 1; i < idx.length; i++) assert.ok(idx[i]! >= idx[i - 1]!);
  const e = entrances(Array(20).fill({ enter: 'drop' }), 's');
  for (let i = 2; i < e.length; i++) assert.ok(!(e[i] === e[i - 1] && e[i] === e[i - 2]));
});
