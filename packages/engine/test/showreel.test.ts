import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkArc, readSkill } from '../src/showreel';

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
