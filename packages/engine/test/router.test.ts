import assert from 'node:assert/strict';
import { test } from 'node:test';
import { assFile, phrases, type TimedWord } from '../src/router/captions';
import { DEFAULT_FAMILIES, FAMILIES } from '../src/router/palette';
import { footageShareOf, route, type Beat } from '../src/router/route';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { shows } from '../src/router/film';
import { chunks, drawPlan } from '../src/router/captions-kit';
import { cleanS1Props } from '../src/router/s1props';
import { phRank, type PhAsset } from '../src/footage/polyhaven';
import { styleOf, type StyleId } from '../src/styles';
import { COMBINED_KIND, combinedIsDefault, combinedReel } from '../src/router/job';
import { HANDLERS } from '../src/tasks';

const coffee: Beat[] = [
  { say: 'Your morning coffee travels further than most people ever will.', kind: 'hook', footage: 'coffee cup steam morning' },
  { say: 'It starts on hillside farms in Ethiopia and Colombia, then crosses the ocean to your city.', kind: 'place', footage: 'coffee farm hills', places: ['Ethiopia', 'Colombia', 'Bengaluru'] },
  { say: 'We pick only the reddest cherries, one by one, by hand.', kind: 'quote', footage: 'hands picking coffee cherries', voice: 'second' },
  { say: 'The beans dry in the sun for two weeks.', kind: 'scene', footage: 'coffee beans drying sun' },
  { say: 'At the roastery a drum turns them at two hundred degrees until they crack and turn brown.', kind: 'process', footage: 'coffee roasting machine' },
  { say: 'Two billion cups a day.', kind: 'stat', footage: 'cafe crowd coffee' },
  { say: 'Then a barista pulls your shot.', kind: 'cta', footage: 'barista espresso pour' },
];

test('router: each beat goes to the family that serves it, and the quote gets the second voice', () => {
  const segs = route(coffee, { footageShare: 0.3 });
  const fam = segs.map(s => s.family);
  assert.equal(fam[0], 'footage', 'the hook is real footage');
  assert.equal(segs.find(s => s.places.length)?.family, 'map');
  const q = segs.find(s => s.text.startsWith('We pick'))!;
  assert.equal(q.family, 'darkvox'); assert.equal(q.voice, 'second');
  assert.equal(segs.find(s => s.text.startsWith('At the roastery'))!.family, 'anatomy');
  assert.equal(segs.find(s => s.text.startsWith('Two billion'))!.family, 's1');
  assert.ok(fam.every(f => DEFAULT_FAMILIES.includes(f)));
});

test('router: real footage keeps its share, the least specific styled beats give way first', () => {
  const segs = route(coffee, { footageShare: 0.6 });
  const share = footageShareOf(segs);
  assert.ok(share >= 0.55, `share ${share}`);
  // the quote and the map are never given away for the share
  assert.equal(segs.find(s => s.text.startsWith('We pick'))!.family, 'darkvox');
  assert.equal(segs.find(s => s.places.length)!.family, 'map');
});

test('router: no places means no map, and a style runs once per film', () => {
  const beats: Beat[] = [
    { say: 'A hook line that sets the scene for us.', kind: 'hook', footage: 'city' },
    { say: 'First the machine heats the water to ninety degrees inside.', kind: 'process', footage: 'kettle' },
    { say: 'This is a short scene line in between them both.', kind: 'scene', footage: 'street' },
    { say: 'Then the pump pushes it through the puck at nine bars.', kind: 'process', footage: 'espresso' },
    { say: 'Somewhere far away people drink it too.', kind: 'place', footage: 'cafe' },
  ];
  const segs = route(beats, { footageShare: 0 });
  assert.ok(!segs.some(s => s.family === 'map'), 'a place beat with no places is not a map');
  assert.equal(segs.filter(s => s.family === 'anatomy').length, 1);
  assert.equal(segs[3]!.family, 'footage');
});

test('router: neighbouring beats of one style are one segment; families outside the allowed list are never used', () => {
  const beats: Beat[] = [
    { say: 'Hook line with enough words in it here.', kind: 'hook', footage: 'a' },
    { say: 'Heat goes in at the bottom of the drum first.', kind: 'process', footage: 'b' },
    { say: 'Then the beans crack and turn a deep brown colour.', kind: 'process', footage: 'c' },
  ];
  const segs = route(beats, { footageShare: 0 });
  assert.equal(segs.length, 2); assert.deepEqual(segs[1]!.beats, [1, 2]);
  const only = route(beats, { families: ['footage'], footageShare: 0 });
  assert.ok(only.every(s => s.family === 'footage'));
  assert.ok(Object.values(FAMILIES).every(f => f.minSeconds > 0 && f.msPerFrame > 0));
});

const timed = (s: string, gapAt: number[] = []): TimedWord[] => { let t = 0; return s.split(' ').map((w, i) => { if (gapAt.includes(i)) t += 0.5; const x = { word: w, t, end: t + 0.3 }; t += 0.36; return x; }); };

test('captions: phrases are whole, short, and never end on a word that leans on the next one', () => {
  const ps = phrases(timed("Your phone's GPS needs four satellites, so the fourth fixes the clock error every second."));
  for (const p of ps) {
    assert.ok(p.text.split(' ').length <= 6, p.text);
    assert.ok(!/\b(the|a|your|so|of|to|and)$/i.test(p.text), `ends on a leaning word: "${p.text}"`);
  }
  assert.ok(ps.some(p => /satellites,$/.test(p.text)), 'cuts after the comma');
  assert.equal(ps.map(p => p.text).join(' '), "Your phone's GPS needs four satellites, so the fourth fixes the clock error every second.");
  for (let i = 1; i < ps.length; i++) assert.ok(ps[i]!.t >= ps[i - 1]!.end - 1e-9, 'no overlap');
});

test('captions: the ASS file has one style in one font, large type, numbers coloured', () => {
  const a = assFile(phrases(timed('Two billion cups a day, 2 billion.')), { accent: '#C8102E', keyWords: ['cups'] });
  assert.equal((a.match(/^Style:/gm) ?? []).length, 1);
  assert.match(a, /Style: Cap,Inter,84,/);
  assert.match(a, /\{\\c&H002E10C8&\}cups/);
  assert.match(a, /\{\\c&H002E10C8&\}2/);
});

test('router: a stat beat keeps Style 1 when the footage share is met by the plain beats', () => {
  const segs = route(coffee);
  assert.ok(segs.some(s => s.family === 's1'), 'Style 1 draws the stat');
  assert.ok(footageShareOf(segs.map(s => ({ family: s.family, seconds: s.seconds }))) >= 0.4 - 1e-9 || segs.filter(s => s.family !== 'footage').length <= 4);
});

test('footage: a clip shows the beat only when its own title or tags name a noun the beat must show', () => {
  assert.equal(shows(['cherries', 'harvest'], { title: 'Hands picking ripe coffee cherries', tags: [] }), true);
  assert.equal(shows(['cherries', 'harvest'], { title: 'Waiter carries a cup of coffee', tags: ['cafe', 'coffee'] }), false);
  assert.equal(shows([], { title: 'anything' }), true);
});

test('captions: the draw plan only draws changed states, and muted ranges draw nothing', () => {
  const ws = [{ word: 'Coffee', start: 0, end: 0.4 }, { word: 'travels', start: 0.45, end: 0.9 }, { word: 'far', start: 1.0, end: 1.3 }];
  const plan = drawPlan(ws, 60);
  assert.equal(plan.length, 60);
  assert.ok(new Set(plan.filter(t => t >= 0)).size < 60, 'fewer draws than frames');
  assert.ok(chunks(ws).every(c => c.words.length <= 2));
});

test('Style 1 props: off-topic props are dropped, neutral ones kept, and every line lands inked', () => {
  const dir = mkdtempSync(join(tmpdir(), 's1p-')), f = join(dir, 'x.json');
  writeFileSync(f, JSON.stringify({ props: { timeline: { scenes: [{ layers: [{ kind: 'image', draw: 'owl' }, { kind: 'image', draw: 'asterisk' }, { kind: 'image', draw: 'phone' }, { kind: 'line', color: '#111', grey: '#aaa' }] }] } } }));
  const removed = cleanS1Props(f, 'how coffee travels from a farm to your cup');
  assert.deepEqual(removed.sort(), ['owl', 'phone']);
  const layers = JSON.parse(readFileSync(f, 'utf8')).props.timeline.scenes[0].layers;
  assert.deepEqual(layers.map((l: { draw?: string; kind: string }) => l.draw ?? l.kind), ['asterisk', 'line']);
  assert.equal(layers[1].grey, '#111');
  assert.deepEqual(cleanS1Props(f, 'a new phone app'), []);
});

test('Poly Haven: assets rank by the words their id, name, tags and categories name', () => {
  const assets: PhAsset[] = [
    { id: 'wicker_basket_01', name: 'Wicker Basket 01', type: 'model', categories: ['containers'], tags: ['basket', 'wicker'] },
    { id: 'tea_set_01', name: 'Tea Set 01', type: 'model', categories: ['dishes'], tags: ['cup', 'tea'] },
    { id: 'comfy_cafe', name: 'Comfy Cafe', type: 'hdri', categories: ['indoor'], tags: ['cafe', 'coffee'] },
  ];
  assert.equal(phRank(assets, 'model', ['basket'])[0]!.a.id, 'wicker_basket_01');
  assert.equal(phRank(assets, 'hdri', ['coffee'])[0]!.a.id, 'comfy_cafe');
  assert.equal(phRank(assets, 'model', ['tractor']).length, 0);
});

test('studio wiring: the combined film is a style the picker lists, and the default for a plain brief', () => {
  const info = styleOf('combined');
  assert.equal(info?.name, 'Auto');
  assert.ok(['s1', 's4', 's5', 'darkvox', 'anatomy'].every(id => styleOf(id as StyleId)), 'Ishaan’s styles stay listed');
  const before = process.env.MOOVI_DEFAULT_STYLE;
  delete process.env.MOOVI_DEFAULT_STYLE; assert.equal(combinedIsDefault(), true);
  process.env.MOOVI_DEFAULT_STYLE = 'crew'; assert.equal(combinedIsDefault(), false);
  if (before === undefined) delete process.env.MOOVI_DEFAULT_STYLE; else process.env.MOOVI_DEFAULT_STYLE = before;
  assert.equal(HANDLERS[COMBINED_KIND], combinedReel);
});
