import { test } from 'node:test';
import assert from 'node:assert/strict';
import { listLooks } from 'captionseasy';
import {
  BEAT_TAGS, CARD_KINDS, checkDirection, directEditJsonSchema, directEditSchema, EXAMPLE_DIRECTION, liveMenus, MAX_CARDS, readDirection,
} from '../src/edit/direct.schema';
import { D22_STYLES, STYLE_LAWS } from '../src/edit/styles';
import { X1_MOVES } from '../src/edit/moves';
import { STYLE_LOOKS } from '../src/edit/looks';

const menus = liveMenus();
const schema = directEditSchema(menus);
const ctx = { sentences: 4, menus };

test('direct-edit 3a: menus come from the live registries', () => {
  assert.deepEqual(menus.looks.map(l => l.id), ['base', ...D22_STYLES, 'studio-cut']);
  for (const id of D22_STYLES) assert.equal(menus.looks.find(l => l.id === id)!.line, STYLE_LAWS[id].about);
  assert.deepEqual(menus.moves.map(m => m.id).sort(), Object.keys(X1_MOVES).sort());
  assert.deepEqual(menus.captionLooks.map(l => +l.id).sort((a, b) => a - b), [...new Set(Object.values(STYLE_LOOKS))].sort((a, b) => a - b));
  assert.equal(liveMenus({ captionLooks: 'all' }).captionLooks.length, listLooks().length);
  assert.equal(liveMenus({ captionLooks: 'none' }).captionLooks.length, 0);
  assert.ok(BEAT_TAGS.includes('hook') && BEAT_TAGS.includes('cta'));
  assert.ok(CARD_KINDS.includes('stat'));
});

test('direct-edit 3: the example answer is valid and passes the checks', () => {
  const r = readDirection(EXAMPLE_DIRECTION, ctx);
  assert.ok(r.ok, JSON.stringify(r));
  assert.ok(readDirection(JSON.stringify(EXAMPLE_DIRECTION), ctx).ok);
  assert.ok(readDirection('```json\n' + JSON.stringify(EXAMPLE_DIRECTION) + '\n```', ctx).ok, 'a fenced answer is read');
  assert.ok(readDirection({ ...EXAMPLE_DIRECTION, caption_look: menus.captionLooks[0]!.id }, ctx).ok);
});

test('direct-edit 3: the shape refuses ids that are not on the menus and extra keys', () => {
  assert.equal(schema.safeParse({ ...EXAMPLE_DIRECTION, style: 'vaporwave' }).success, false);
  assert.equal(schema.safeParse({ ...EXAMPLE_DIRECTION, moves: [{ i: 0, id: '99' }] }).success, false);
  assert.equal(schema.safeParse({ ...EXAMPLE_DIRECTION, beats: [{ i: 0, tag: 'banger' }] }).success, false);
  assert.equal(schema.safeParse({ ...EXAMPLE_DIRECTION, caption_look: '999' }).success, false);
  assert.equal(schema.safeParse({ ...EXAMPLE_DIRECTION, edl: [] }).success, false, 'no extra keys');
  const many = Array.from({ length: MAX_CARDS + 1 }, (_, i) => ({ i, kind: 'title', words: 'x' }));
  assert.equal(schema.safeParse({ ...EXAMPLE_DIRECTION, cards: many }).success, false);
});

test('direct-edit 3: a bad answer fails with clear problems', () => {
  const bad = { ...EXAMPLE_DIRECTION, hook: 9, beats: [{ i: 0, tag: 'hook' as const }, { i: 0, tag: 'claim' as const }],
    cards: [{ i: 2, kind: 'stat' as const, words: 'one two three four five six seven' }] };
  const p = checkDirection(bad, ctx);
  assert.ok(p.some(x => x.startsWith('hook 9 is not a sentence number (0 to 3)')), p.join(' | '));
  assert.ok(p.some(x => x.includes('tagged twice')));
  assert.ok(p.some(x => x.includes('missing 1, 2, 3')));
  assert.ok(p.some(x => x.includes('has 7 words')));
  const r = readDirection({ ...EXAMPLE_DIRECTION, style: 'vaporwave', cleanup: 'medium' }, ctx);
  assert.equal(r.ok, false);
  assert.ok(!r.ok && r.problems.some(x => x.startsWith('style:')) && r.problems.some(x => x.startsWith('cleanup:')), JSON.stringify(r));
  const nj = readDirection('sure! here is the plan', ctx);
  assert.ok(!nj.ok && nj.problems[0]!.includes('not JSON'));
  assert.equal(readDirection(null, ctx).ok, false, 'never throws on junk');
});

test('direct-edit 3: the shape converts to JSON Schema with enums for every menu', () => {
  const js = directEditJsonSchema(menus) as { properties: Record<string, any>; required: string[]; additionalProperties: boolean };
  assert.deepEqual(js.properties.style.enum, menus.looks.map(l => l.id));
  assert.deepEqual(js.properties.cleanup.enum, ['light', 'balanced', 'tight']);
  assert.deepEqual(js.properties.beats.items.properties.tag.enum, [...BEAT_TAGS]);
  assert.deepEqual(js.properties.moves.items.properties.id.enum, menus.moves.map(m => m.id));
  assert.ok(js.required.includes('beats') && !js.required.includes('caption_look'));
  assert.equal(js.additionalProperties, false);
  assert.ok(JSON.stringify(js).length < 6000, 'the schema stays small enough for one step');
});
