import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { directEditJsonSchema, EXAMPLE_DIRECTION, liveMenus, MAX_PICKS, readDirection, type Direction } from '../src/edit/direct.schema';
import { directEditStep, sentencesOf } from '../src/edit/direct';
import { specOfDirection } from '../src/edit/direct-spec';
import { registryCaster, readSentences } from '../src/edit/beatspec';
import { menuEntries, assetIdOf, editRegistry } from '../src/edit/registry';

// C1, 2026-10-18 05:08 IST: direct:edit may fill reads or picks (by registry id); beatSpecOf writes the beat spec.
const say = 'Hello guys, I am Vignesh. Most people waste three hours a day on their phone. Type one line and Moovi edits it. Comment MOOVI and I will send it.';
const words = (() => { let t = 0.3; return say.split(' ').map(w => { const o = { word: w, t: +t.toFixed(2), end: +(t + 0.3).toFixed(2) }; t += /[.!?]$/.test(w) ? 0.8 : 0.34; return o; }); })();
const menus = liveMenus();
const texts: string[] = []; for (const s of sentencesOf(words)) texts[s.i] = s.text;
const ctx = { sentences: texts.length, menus, texts };
const built = menuEntries(editRegistry()).map(assetIdOf);
const base: Direction = { ...EXAMPLE_DIRECTION, beats: [0, 1, 2, 3].map(i => ({ i, tag: EXAMPLE_DIRECTION.beats[i]!.tag })), moves: [], cards: [] };

test('direct:edit spec: the menu is the registry the player draws, by id; the step offers it', () => {
  assert.equal(texts.length, 4);
  assert.deepEqual(menus.edit!.map(e => e.id), built);
  const step = directEditStep({ words, menus });
  assert.match(step.prompt, /EDIT REGISTRY/);
  // the ids ride once (in the menu), not again as a schema enum: the step stays small
  const lean = directEditStep({ words, menus: { ...menus, edit: [] } });
  assert.ok(step.tokens - lean.tokens < 1500, `the registry costs ${step.tokens - lean.tokens} tokens`);
  assert.match(step.system, /spec\.picks/);
  assert.ok(JSON.stringify(directEditJsonSchema(menus)).includes('"spec"'));
  // a menu without the registry (an old caller) has no spec part at all
  assert.ok(!JSON.stringify(directEditJsonSchema({ ...menus, edit: [] })).includes('"spec"'));
});

test('direct:edit spec: a good spec passes; unknown ids, a hero not said, a second pick on a sentence are refused plainly', () => {
  const pick = built.find(id => id.includes('comment')) ?? built[0]!;
  const good = { ...base, spec: { reads: [{ i: 1, fn: 'number', verbs: ['waste'], hero: 'three' }], picks: [{ i: 3, id: pick }] } };
  const r = readDirection(good, ctx);
  assert.ok(r.ok, JSON.stringify(r));
  assert.equal(readDirection(base, ctx).ok, true, 'the spec stays optional');
  const unknown = readDirection({ ...base, spec: { picks: [{ i: 1, id: 'effect:made-up' }] } }, ctx);
  assert.ok(!unknown.ok && unknown.problems.some(p => /"effect:made-up" is not in the EDIT REGISTRY/.test(p)), JSON.stringify(unknown));
  const hero = readDirection({ ...base, spec: { reads: [{ i: 1, fn: 'number', verbs: [], hero: 'million' }] } }, ctx);
  assert.ok(!hero.ok && hero.problems.some(p => /hero "million" is not a word of sentence 1/.test(p)), JSON.stringify(hero));
  const twice = readDirection({ ...base, spec: { picks: [{ i: 2, id: built[0]! }, { i: 2, id: built[1]! }] } }, ctx);
  assert.ok(!twice.ok && twice.problems.some(p => /sentence 2 has two picks/.test(p)));
  const many = readDirection({ ...base, spec: { picks: Array.from({ length: MAX_PICKS + 1 }, (_, k) => ({ i: k % 4, id: built[0]! })) } }, ctx);
  assert.equal(many.ok, false);
  const url = readDirection({ ...base, spec: { picks: [{ i: 0, id: 'https://example.com/a.mp4' }] } }, ctx);
  assert.equal(url.ok, false, 'never a URL');
});

test('direct:edit spec: picks land on their sentence, reads change the reading, same answer same spec', async () => {
  const caster = registryCaster();
  const pick = built.find(id => id.includes('comment')) ?? built[0]!;
  const d = { spec: { reads: [{ i: 2, fn: 'how' as const, verbs: ['type', 'fly'], hero: 'line' }], picks: [{ i: 3, id: pick }] } };
  const a = await specOfDirection(d, words, { caster });
  const b = await specOfDirection(d, words, { caster });
  assert.deepEqual(a.spec, b.spec, 'pure: same in, same out');
  assert.equal(a.spec.version, 1);
  assert.equal(a.spec.beats.length, 4);
  const p3 = a.spec.picks.find(p => p.i === 3);
  assert.ok(p3 && p3.id === pick && /asked/.test(p3.why), JSON.stringify(a.spec.picks));
  const b2 = a.spec.beats.find(x => x.i === 2)!;
  assert.equal(b2.fn, 'how');
  assert.equal(b2.hero, 'line');
  assert.deepEqual(a.used, { reads: 1, picks: 1, verbsDropped: ['fly'] });
  // the rules alone read sentence 2 their own way
  assert.notEqual(readSentences(words)[2]!.hero, 'line');
  // a pick of an asset the player cannot draw yet is refused with a reason, never swapped
  const unbuilt = editRegistry().find(e => !e.built);
  if (unbuilt) {
    const c = await specOfDirection({ spec: { picks: [{ i: 1, id: assetIdOf(unbuilt) }] } }, words, { caster });
    assert.ok(c.missed.some(m => m.i === 1 && /not drawn/.test(m.why)), JSON.stringify(c.missed));
    assert.ok(!c.spec.picks.some(p => p.id === assetIdOf(unbuilt)));
  }
});

test('direct:edit spec: the edit job writes beatspec.json beside direction.json and never stops on it', () => {
  const job = readFileSync(join(import.meta.dirname, '../src/edit/job.ts'), 'utf8');
  assert.match(job, /if \(direction\?\.spec\) \{\s*try \{ const b = await specOfDirection\(direction, words\); writeFileSync\(join\(dir, 'beatspec\.json'\)/);
});
