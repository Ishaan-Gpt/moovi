import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cast, libraryErrors, detectNeeds, listItems, spokenNumber, sketch, type BeatIn } from '../src/styles/kit';
import { FIGURES, SETUPS, VOCAB } from '../src/anatomy/library';
import { LAYOUTS, composed, type FigIn, type PartIn } from '../src/anatomy/figures';
import { KINDS, part } from '../src/anatomy/parts';
import { PRIMS, composePart, partErrors, sketchPart, tidyPart } from '../src/anatomy/improv';
import { castFigures, numberPhrase, resolveKind, sectionize } from '../src/anatomy/plan';

test('anatomy library: no errors, ≥ 20 figures with a renderer each, ≥ 40 set-ups, ≥ 60 parts', () => {
  assert.deepEqual(libraryErrors(SETUPS), []);
  const figs = FIGURES.filter(f => f !== 'composed');
  assert.ok(figs.length >= 20, `figures ${figs.length}`);
  for (const f of figs) assert.equal(typeof LAYOUTS[f], 'function', `no renderer for ${f}`);
  for (const s of SETUPS) assert.ok(s.figure === 'composed' || LAYOUTS[s.figure as Exclude<typeof s.figure, 'composed'>], `set-up ${s.id} has no renderer`);
  assert.ok(SETUPS.length >= 40, `set-ups ${SETUPS.length}`);
  assert.ok(KINDS.length >= 60, `parts ${KINDS.length}`);
  assert.equal(new Set(KINDS).size, KINDS.length);
});

test('every part kind builds inside its footprint', () => {
  for (const k of KINDS) {
    const p = part(k, 'Brand');
    assert.ok(p.prims.length >= 2, `${k}: too few solids`);
    assert.ok(p.fp.w <= 172 && p.fp.d <= 172, `${k}: footprint ${p.fp.w}x${p.fp.d}`);
    assert.ok(p.hero >= 0 && p.hero < p.prims.length, `${k}: hero index`);
  }
});

const pin = (kind: string, i: number, t: number): PartIn => ({ id: `p${i}`, kind, name: `Part ${i}`, note: '', tIn: t, tEx: t + 1.5, tLabel: t + 0.4, g: part(kind, 'B'), key: true });
const fig = (n: number, variant: string): FigIn => ({ t0: 0, t1: 8, parts: ['server', 'database', 'phone', 'chip', 'globe', 'battery'].slice(0, n).map((k, i) => pin(k, i, 0.1 + i * 0.6)), variant, brand: 'Brand', text: 'Three parts, 40 regions, one flow.', seed: 7, number: '40 regions', all: [pin('laptop', 9, 0)], partFor: k => part(k, 'B') });

test('every set-up lays out a figure with finite geometry', () => {
  for (const s of SETUPS) {
    if (s.figure === 'composed') continue;
    const out = LAYOUTS[s.figure](fig(Math.max(1, s.parts[1] > 4 ? 4 : s.parts[1]), s.variant));
    assert.ok(out.asms.length || out.props.length, `${s.id}: empty`);
    for (const a of out.asms) assert.ok([a.x, a.y, a.z, a.tIn].every(Number.isFinite), `${s.id}: bad asm`);
    for (const l of out.links) assert.ok(out.asms[l.a] && out.asms[l.b], `${s.id}: link to a missing asm`);
  }
});

test('cast never puts one family back to back, and a recent film pushes its set-ups away', () => {
  const lines = ['Your code goes out the moment you push it.', 'The build server compiles it, runs the tests, and packs every asset.', 'Then the edge network copies it to every region at once.', 'Requests land on the nearest node, and data stays in one database.', 'A dashboard shows 40 regions answering in milliseconds.', 'Every change gets its own preview link.', 'That is the whole machine.'];
  const beats: BeatIn[] = lines.map((t, i) => ({ index: i, text: t, words: t.split(' ').length, seconds: 3, needs: detectNeeds(t, { index: i, count: lines.length }), items: listItems(t).length, number: spokenNumber(t), role: i === 0 ? 'open' : i === lines.length - 1 ? 'close' : 'middle' }));
  for (const seed of ['a', 'b', 'c', 'd', 'e']) {
    const c = castFigures(beats, { seed, recent: [] });
    for (let i = 1; i < c.length; i++) if (c[i]!.setup && c[i - 1]!.setup) assert.notEqual(c[i]!.setup!.family, c[i - 1]!.setup!.family, `seed ${seed} beat ${i}`);
    const again = castFigures(beats, { seed, recent: c.map(x => x.setup?.id ?? '') });
    const same = again.filter((x, i) => x.setup && x.setup.id === c[i]!.setup?.id).length;
    assert.ok(same <= Math.ceil(beats.length / 3), `seed ${seed}: ${same} set-ups repeat after remember`);
  }
});

test('improvised parts: any name composes a valid part from primitives; unknown kinds resolve', () => {
  for (const name of ['espresso machine', 'billboard', 'traffic light', 'hose', 'yoga mat', 'mystery', 'planet', 'funnel']) {
    const g = composePart(sketchPart(name));
    assert.deepEqual(partErrors(g), [], name);
  }
  for (const body of PRIMS) assert.deepEqual(partErrors(composePart(tidyPart({ body, top: 'sphere', shape: 'tall' }, body))), [], body);
  assert.equal(resolveKind('servers', 'Servers').kind, 'server');
  assert.ok(resolveKind('other', 'Espresso machine', 'box').g.prims.length >= 2);
});

test('improvised figures: a sketched spec composes into a figure', () => {
  const words = 'Old tools versus new ones, side by side.'.split(' ').map((word, i) => ({ word, t: i * 0.3, end: i * 0.3 + 0.2 }));
  const spec = sketch({ text: words.map(w => w.word).join(' '), words, needs: detectNeeds('Old tools versus new ones') }, VOCAB);
  const out = composed(fig(2, 'composed'), spec);
  assert.ok(out.asms.length >= 1);
});

test('sections + number phrases', () => {
  const s = sectionize(['Meet Acme.', 'First, you upload.', 'Then it sorts.', 'Finally it ships.', 'Acme. At acme.com.'], [['brand'], ['steps'], ['steps'], ['steps'], ['cta']]);
  assert.ok(s.length >= 2 && s.length <= 4, `sections ${s.length}`);
  assert.equal(numberPhrase('A dashboard shows 40 regions answering'), '40 regions');
  assert.equal(numberPhrase('It is 99.9% uptime'), '99.9% uptime');
});
