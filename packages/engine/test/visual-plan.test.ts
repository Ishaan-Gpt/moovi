import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ARTIFACTS, GLYPHS, KINDS, byId } from '../src/visual/artifacts';
import { LAYOUTS, LAYOUT_IDS, bands, slotsOf, FORMATS, type FormatId } from '../src/visual/layouts';
import { isNeed } from '../src/styles/kit/needs';
import { itemsOf, numbersOf, planFilm, titleOf, typeLines } from '../src/visual/plan';
import type { BeatIn } from '../src/visual/types';

const SCRIPT = [
  'Most small teams lose hours every week to messy spreadsheets.',
  'Meet Bluetoki: one place for orders, stock and customers.',
  'We grew 40% in 6 months, with 1,200 happy customers.',
  'It connects your shop, your phone and your team, everywhere.',
  'Set it up in minutes, track every order, and never miss a sale.',
  'Try Bluetoki free today.',
];
const beats = (): BeatIn[] => SCRIPT.map((text, i) => ({ text, start: i * 4, end: i * 4 + 4 }));

test('the artifact library is complete and every tag is a real need', () => {
  assert.equal(new Set(ARTIFACTS.map(a => a.id)).size, ARTIFACTS.length, 'ids are unique');
  for (const k of KINDS) assert.ok(ARTIFACTS.some(a => a.kind === k), `no artifact of kind ${k}`);
  assert.ok(ARTIFACTS.length >= 50, `${ARTIFACTS.length} artifacts`);
  for (const a of ARTIFACTS) for (const n of a.needs) assert.ok(isNeed(n), `${a.id}: "${n}" is not a need`);
  for (const g of GLYPHS) assert.ok(byId(`icon:${g}`), `no icon for ${g}`);
  assert.equal(ARTIFACTS.filter(a => a.kind === 'icon').length, GLYPHS.length);
});

test('layouts: slots stay out of the caption band in every format', () => {
  for (const f of Object.keys(FORMATS) as FormatId[]) {
    const { caption, area } = bands(f), { W, H } = FORMATS[f];
    assert.ok(area.y + area.h <= caption.y + 1e-6 || f === 'landscape' && area.y + area.h <= caption.y + 1e-6, `${f}: the area ends above the band`);
    assert.ok(area.x >= 0 && area.x + area.w <= W && caption.y + caption.h <= H);
    for (const l of LAYOUT_IDS) {
      const slots = slotsOf(l, f);
      assert.equal(slots.length, LAYOUTS.find(x => x.id === l)!.slots, `${l} slot count`);
      for (const s of slots) {
        assert.ok(s.rect.y >= area.y - 1 && s.rect.y + s.rect.h <= area.y + area.h + 1, `${f}/${l}/${s.id} leaves the visual area`);
        assert.ok(s.rect.x >= area.x - 1 && s.rect.x + s.rect.w <= area.x + area.w + 1, `${f}/${l}/${s.id} leaves the width`);
      }
    }
  }
});

test('planning is deterministic and every scene is well formed', () => {
  const a = planFilm(beats(), { format: 'vertical', seed: 3, image: '/data/site.png', brand: 'Bluetoki' });
  const b = planFilm(beats(), { format: 'vertical', seed: 3, image: '/data/site.png', brand: 'Bluetoki' });
  assert.deepEqual(a, b);
  assert.notDeepEqual(a, planFilm(beats(), { format: 'vertical', seed: 4, image: '/data/site.png', brand: 'Bluetoki' }));
  assert.equal(a.scenes.length, SCRIPT.length);
  assert.equal(a.seconds, 24);
  for (const s of a.scenes) {
    assert.equal(s.elements.length, slotsOf(s.layout, 'vertical').length, `scene ${s.i}: one element per slot`);
    assert.equal(new Set(s.elements.map(e => e.art)).size, s.elements.length, `scene ${s.i}: no artifact twice`);
    assert.ok(s.elements.every(e => byId(e.art)), 'every pick is in the library');
    assert.ok(s.ambient.some(id => byId(id)!.kind === 'bg'), `scene ${s.i}: a backdrop`);
    assert.ok(s.type.length > 0 && s.type.every(l => l.at.length === l.text.split(' ').length), 'a time per word');
    assert.equal(s.end, a.scenes[s.i + 1]?.start ?? a.seconds, 'scenes tile the timeline');
  }
  assert.equal(a.scenes[0]!.transition, null);
  for (let i = 1; i < a.scenes.length; i++) {
    assert.ok(a.scenes[i]!.transition);
    assert.notEqual(a.scenes[i]!.transition, a.scenes[i - 1]!.transition, 'no transition twice running');
    assert.notEqual(a.scenes[i]!.camera, a.scenes[i - 1]!.camera, 'no camera move twice running');
  }
  const layouts = a.scenes.map(s => s.layout);
  assert.ok(new Set(layouts).size >= 3, `layouts vary: ${layouts}`);
  for (let i = 2; i < layouts.length; i++) assert.ok(!(layouts[i] === layouts[i - 1] && layouts[i] === layouts[i - 2]), 'no layout three times running');
});

test('an artifact that needs an image is never cast without one; the spoken numbers reach the charts', () => {
  const none = planFilm(beats(), { format: 'vertical', seed: 5 });
  for (const s of none.scenes) for (const e of s.elements) assert.notEqual(byId(e.art)!.wants, 'image', `${e.art} needs an image`);
  const withImg = planFilm(beats(), { format: 'landscape', seed: 5, image: '/data/site.png', brand: 'Bluetoki' });
  const num = withImg.scenes[2]!;
  const numeric = num.elements.filter(e => e.content.numbers);
  assert.ok(numeric.length > 0, 'the numbers scene shows its numbers');
  assert.deepEqual(numeric[0]!.content.numbers, [40, 6, 1200]);
  assert.deepEqual(numbersOf('We grew 40% in 6 months, with 1,200 happy customers.'), [40, 6, 1200]);
  assert.deepEqual(numbersOf('no figures'), []);
});

test('the art director’s own picks are honoured, and the project’s habits are avoided', () => {
  const picked = planFilm(beats(), { format: 'vertical', seed: 1, picks: [{ layout: 'split-side', artifacts: ['chart:versus', 'card:stat'] }] });
  assert.equal(picked.scenes[0]!.layout, 'split-side');
  assert.deepEqual(picked.scenes[0]!.elements.map(e => e.art), ['chart:versus', 'card:stat']);
  const base = planFilm(beats(), { format: 'vertical', seed: 9 });
  const heavy: Record<string, number> = {};
  for (const e of base.scenes.flatMap(s => s.elements)) heavy[e.art] = 6;
  const varied = planFilm(beats(), { format: 'vertical', seed: 9, used: heavy });
  const overlap = (x: typeof base, y: typeof base) => x.scenes.flatMap(s => s.elements.map(e => e.art)).filter(id => y.scenes.flatMap(s => s.elements.map(e => e.art)).includes(id)).length;
  assert.ok(overlap(varied, base) < base.scenes.flatMap(s => s.elements).length, 'the film changes when the library is used up');
});

test('kinetic type: words land on the voice, pages of at most three lines, an accent per line', () => {
  const lines = typeLines({ text: 'We grew 40% in 6 months with 1,200 happy customers', start: 10, end: 14, words: 'We grew 40% in 6 months with 1,200 happy customers'.split(' ').map((w, k) => ({ w, start: 10 + k * 0.3, end: 10.25 + k * 0.3 })) }, 1, 0);
  assert.ok(lines.length >= 3);
  const all = lines.flatMap(l => l.at);
  for (let k = 1; k < all.length; k++) assert.ok(all[k]! >= all[k - 1]!, 'times never go back');
  assert.equal(all[0], 0);
  assert.ok(Math.abs(all[2]! - 0.6) < 0.01, 'the third word is on the voice');
  for (const l of lines) { assert.ok(l.text.length <= 20); if (l.em !== null) assert.ok(l.em < l.text.split(' ').length); }
  for (let p = 0; p <= lines.at(-1)!.page; p++) assert.ok(lines.filter(l => l.page === p).length <= 3);
  assert.deepEqual(titleOf('The quick brown fox jumps over', 3), 'quick brown fox');
  assert.ok(itemsOf('speed, safety and style').length >= 2);
});

test('the graph prior and the planner’s own count rank identically (the graph is the source, the code a fallback)', async () => {
  const { detectNeeds } = await import('../src/styles/kit/needs');
  const bs = beats();
  // what the SERVES edges give for each beat: artifacts by how many of the beat's needs they share
  const prior = bs.map((b, i) => { const needs = new Set(detectNeeds(b.text, { index: i, count: bs.length })); return Object.fromEntries(ARTIFACTS.map(a => [a.id, a.needs.filter(n => needs.has(n)).length]).filter(([, n]) => (n as number) > 0)); });
  const a = planFilm(bs, { format: 'vertical', seed: 3, image: '/data/site.png' }), b = planFilm(bs, { format: 'vertical', seed: 3, image: '/data/site.png', prior });
  assert.deepEqual(b, a);
  // and a prior that says something else changes the film
  const flipped = prior.map(() => ({ 'card:stat': 9, 'chart:line': 9 }));
  assert.notDeepEqual(planFilm(bs, { format: 'vertical', seed: 3, image: '/data/site.png', prior: flipped }), a);
});

test('an artifact built around one number is never cast when the beat says none; elements in a scene do not repeat the same words', () => {
  const p = planFilm(beats(), { format: 'vertical', seed: 8 });
  for (const s of p.scenes) {
    const nums = numbersOf(SCRIPT[s.i]!);
    for (const e of s.elements) if (['chart:counter', 'card:stat', 'card:price', 'chart:donut', 'chart:ring', 'chart:versus'].includes(e.art)) assert.ok(nums.length > 0, `${e.art} in scene ${s.i} has no number to show`);
    const titles = s.elements.map(e => e.content.title).filter(Boolean);
    assert.equal(new Set(titles).size, titles.length, `scene ${s.i} repeats a title: ${titles}`);
  }
});

test('beats are timed on the voice: each starts where its first word is said, the last runs to the end', async () => {
  const { beatsFromVoice, eventsFor } = await import('../src/visual/film');
  const say = ['Most teams lose hours.', 'Meet Bluetoki today.'];
  const words = 'Most teams lose hours. Meet Bluetoki today.'.split(' ').map((word, i) => ({ word, t: 0.3 + i * 0.4 + (i >= 4 ? 0.6 : 0), end: 0.3 + i * 0.4 + 0.3 + (i >= 4 ? 0.6 : 0) }));
  const b = beatsFromVoice(say.map(s => ({ say: s })), words, 30);
  assert.equal(b.length, 2);
  assert.equal(b[0]!.start, 0);
  assert.ok(Math.abs(b[1]!.start - (words[4]!.t - 4 / 30)) < 0.05, 'the second beat starts just before its first word');
  assert.equal(b[0]!.end, b[1]!.start, 'beats tile');
  assert.ok(b[1]!.end >= words.at(-1)!.t);
  assert.equal(b[0]!.words!.length, 4);
  assert.ok(b[0]!.words!.every((w, i, a) => i === 0 || w.start >= a[i - 1]!.start));
  // the sound the picture asks for
  const plan = planFilm(b, { format: 'vertical', seed: 2 });
  const ev = eventsFor(plan);
  assert.ok(ev.some(e => e.event === 'scene' && Math.abs(e.t - plan.scenes[1]!.start) < 0.01), 'a hit at the cut');
  assert.ok(ev.some(e => e.event === 'key-word'), 'key words are marked');
  assert.deepEqual([...ev].sort((x, y) => x.t - y.t), ev, 'in order');
  assert.ok(ev.every(e => e.t >= 0 && e.t <= plan.seconds));
});

test('pictures the crew already made (a map, a 3D render, a capture) go in poster panels; a map goes to the beat about a place', () => {
  const photos = [{ path: '/data/a/render.png', kind: 'look3d' as const }, { path: '/data/a/map.png', kind: 'map' as const }];
  const bs: BeatIn[] = ['We ship to customers in 40 countries across the world.', 'Meet Bluetoki: orders, stock and customers in one place.', 'It connects your shop, your phone and your team, everywhere.'].map((text, i) => ({ text, start: i * 4, end: (i + 1) * 4 }));
  const none = planFilm(bs, { format: 'vertical', seed: 6 });
  assert.ok(!none.scenes.some(s => s.elements.some(e => e.art === 'img:poster')), 'no pictures, no poster panel');
  const withPhotos = planFilm(bs, { format: 'vertical', seed: 6, photos });
  const posters = withPhotos.scenes.flatMap(s => s.elements.filter(e => e.art === 'img:poster').map(e => ({ scene: s.i, image: e.content.image })));
  assert.ok(posters.length >= 1, 'a poster panel is cast');
  assert.ok(posters.every(p => photos.some(x => x.path === p.image)));
  assert.equal(posters.find(p => p.scene === 0)?.image, '/data/a/map.png', 'the beat about the world gets the map');
});

test('big type is for the hook, the closing line and very short lines, not for every beat', () => {
  const bs: BeatIn[] = ['Most small teams lose hours every week to messy spreadsheets.', 'Meet Bluetoki: one place for your orders, stock and customers.', 'It connects your shop, your phone and your team, every single day.', 'Set it up in minutes, track every order, and never miss a sale.', 'Fast.', 'Try Bluetoki free today.'].map((text, i) => ({ text, start: i * 4, end: (i + 1) * 4 }));
  const p = planFilm(bs, { format: 'vertical', seed: 3 });
  assert.equal(p.scenes[0]!.layout, 'type', 'the hook');
  assert.equal(p.scenes[5]!.layout, 'type', 'the closing line');
  for (const i of [1, 2, 3]) assert.notEqual(p.scenes[i]!.layout, 'type', `beat ${i} is a long line with something to show`);
  assert.ok(p.scenes.filter(s => s.layout === 'type').length <= 3, 'never two in a row, and not most of the film');
  for (let i = 1; i < p.scenes.length; i++) assert.ok(!(p.scenes[i]!.layout === 'type' && p.scenes[i - 1]!.layout === 'type'));
});
