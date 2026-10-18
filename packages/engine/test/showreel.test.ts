import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkArc, checkPicks, inventedName, readSkill, type ShowreelPicks } from '../src/showreel';

test('the skill gives the Showreel themes and the hook -> problem -> solution -> climax -> cta arc', () => {
  const { themes, arc } = readSkill();
  assert.deepEqual(arc.map(s => s.id), ['hook', 'problem', 'solution', 'climax', 'cta']);
  assert.ok(themes.length >= 4 && themes.every(t => t.renderer && t.voice));
});

test('beats must follow the arc in order and within each slot count', () => {
  const { arc } = readSkill(), b = (slot: string) => ({ slot, line: 'a b c' });
  assert.deepEqual(checkArc(['hook', 'problem', 'solution', 'solution', 'climax', 'cta'].map(b), arc), []);
  assert.ok(checkArc(['problem', 'hook', 'solution', 'solution', 'climax', 'cta'].map(b), arc).length);
  assert.ok(checkArc(['hook', 'problem', 'solution', 'climax'].map(b), arc).some(p => p.includes('cta')));
});

test('a cta never names an invented site or studio', () => {
  for (const l of ['Check the lighthouse schedule at lighthouse.org.', 'Explore the inner beat at WatchLab.', 'Visit Kyoto Indigo Studio, learn the craft.']) assert.ok(inventedName(l), l);
  for (const l of ['Follow for the next one.', 'Walk Sassoon Dock before sunrise.']) assert.ok(!inventedName(l, "a morning at Mumbai's Sassoon dock"), l);
});

test('a showreel is a brand film: the solution and the cta name the brand', () => {
  const { themes, arc } = readSkill();
  const base = (beats: [string, string][]): ShowreelPicks => ({ theme: 'night-stage', brand: 'Bluebird Bakery', idea: 'x', title: '', lines: [], colour: '#8A5A2B', colourFrom: 'crust', coined: '', why: '', beats: beats.map(([slot, line]) => ({ slot, line })) });
  const good: [string, string][] = [['hook', 'Your mornings deserve better bread than this.'], ['problem', 'Supermarket loaves go stale by noon.'], ['solution', 'Meet Bluebird Bakery, baking before the sun is up.'], ['solution', 'Sourdough rests for two whole days.'], ['climax', 'Bread that still tastes like morning at night.'], ['cta', 'Order from Bluebird Bakery tonight.']];
  assert.equal(checkPicks(base(good), themes, arc, undefined, 'Bluebird Bakery sourdough in Pune'), null);
  const noName = good.map(([s, l]) => [s, l.replace('Bluebird Bakery', 'us')] as [string, string]);
  assert.match(checkPicks(base(noName), themes, arc, undefined, 'Bluebird Bakery sourdough') ?? '', /names the brand/);
});
