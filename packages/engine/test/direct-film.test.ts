import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  directFilmJsonSchema, directFilmSchema, directableStyles, EXAMPLE_FILM, EXAMPLE_SOURCE, FILM_BRIEFS, filmMenus, launchArcMenu, launchSlotLines, readFilmDirection,
} from '../src/router/direct-film.schema';
import { LAUNCH_ARCS } from '../src/launch/arcs';
import { z } from 'zod';

const ctx = { styles: ['launch' as const], sourceText: EXAMPLE_SOURCE, launchArc: 'launch-pain-turn' };

test('direct-film 4: menus come from the live registries, the server pick first', () => {
  const m = filmMenus(ctx);
  assert.deepEqual(m.styles.map(s => s.id), ['launch']);
  assert.deepEqual(m.arcs!.map(a => a.id).sort(), LAUNCH_ARCS.map(a => a.id).sort());
  assert.equal(launchArcMenu('launch-verdict')[0]!.id, 'launch-verdict');
  assert.equal(launchSlotLines('launch-pain-turn').length, LAUNCH_ARCS.find(a => a.id === 'launch-pain-turn')!.slots.length);
  assert.deepEqual(directableStyles({ styles: ['s1', 'launch', 'darkvox'] }), ['launch'], 'only styles with an entry are offered');
  assert.ok(FILM_BRIEFS.launch);
});

test('direct-film 4: the example answer is valid and passes the checks', () => {
  const r = readFilmDirection(EXAMPLE_FILM, ctx);
  assert.ok(r.ok, JSON.stringify(r));
  assert.ok(readFilmDirection('```json\n' + JSON.stringify(EXAMPLE_FILM) + '\n```', ctx).ok);
});

test('direct-film 4: the shape refuses unknown styles, arcs and extra keys', () => {
  const s = directFilmSchema(ctx);
  assert.equal(s.safeParse({ ...EXAMPLE_FILM, style: 'darkvox' }).success, false);
  assert.equal(s.safeParse({ ...EXAMPLE_FILM, arc: 'launch-nope' }).success, false);
  assert.equal(s.safeParse({ ...EXAMPLE_FILM, color: 'blue' }).success, false);
  assert.equal(s.safeParse({ ...EXAMPLE_FILM, scenes: [] }).success, false, 'no extra keys');
  assert.equal(s.safeParse({ ...EXAMPLE_FILM, model: undefined }).success, false, 'model is required');
});

test('direct-film 4: a bad answer fails with clear problems', () => {
  const bad = { ...EXAMPLE_FILM, lines: ['Still *chasing* tickets?', 'Meet *Linear*, the issue tracker that every fast software team on earth now uses daily.'],
    features: ['A tracker that plans your whole week'], number: '40 hours saved' };
  const r = readFilmDirection(bad, ctx);
  assert.equal(r.ok, false);
  const p = r.ok ? [] : r.problems;
  assert.ok(p.some(x => x.includes('write exactly 8 lines (you wrote 2)')), p.join(' | '));
  assert.ok(p.some(x => x.startsWith('lines 2:')), p.join(' | '));
  assert.ok(p.some(x => x.startsWith('features must be')), p.join(' | '));
  assert.ok(p.some(x => x.includes('the numbers 40 are not in the source')), p.join(' | '));
  assert.equal(readFilmDirection('no', ctx).ok, false);
  assert.equal(readFilmDirection(undefined, ctx).ok, false, 'never throws on junk');
  const none = readFilmDirection(EXAMPLE_FILM, { ...ctx, styles: ['s1'] });
  assert.ok(!none.ok && none.problems[0]!.includes('none of these styles'));
});

test('direct-film 4: JSON Schema with an enum for the arcs, small enough for one step', () => {
  const js = directFilmJsonSchema(ctx) as { properties: Record<string, any>; required: string[]; additionalProperties: boolean };
  assert.equal(js.properties.style.const, 'launch');
  assert.equal(js.properties.arc.enum[0], 'launch-pain-turn');
  assert.ok(js.required.includes('lines') && js.required.includes('model'));
  assert.equal(js.additionalProperties, false);
  assert.ok(JSON.stringify(js).length < 5000, `schema is ${JSON.stringify(js).length} chars`);
});

test('direct-film 4: two directable styles make a union told apart by style', () => {
  FILM_BRIEFS.s5 = { id: 's5', line: 'test entry', menus: () => ({}), shape: () => z.object({ style: z.literal('s5'), why: z.string(), hook: z.string() }).strict(), check: () => [] };
  try {
    const two = { ...ctx, styles: ['launch' as const, 's5' as const] };
    assert.deepEqual(filmMenus(two).styles.map(x => x.id), ['launch', 's5']);
    assert.ok(readFilmDirection(EXAMPLE_FILM, two).ok);
    assert.ok(readFilmDirection({ style: 's5', why: 'w', hook: 'h', model: 'm' }, two).ok);
    assert.equal(readFilmDirection({ style: 's5', why: 'w', model: 'm' }, two).ok, false);
  } finally { delete FILM_BRIEFS.s5; }
});
