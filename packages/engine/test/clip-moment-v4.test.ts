import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cmClipFits } from '../src/edit/templates/clip-moment-plan';
import { CM_FINISH_CHAIN, CM_GRADE } from '../src/edit/templates/clip-moment-grade';

// clip-moment v4: root's review of bus v3 (too dark; a bicycle cassette for the gearbox; a shoe for the doors)
test('clip-moment v4 subject guards: a gearbox line never takes bicycle gears, a doors line never a shoe or a train', () => {
  const gear = 'An automatic *gearbox* turns that spin into torque for the rear wheels.';
  assert.equal(cmClipFits(gear, 'wheel of a rotating bicycle in a close and detailed'), false);
  assert.equal(cmClipFits(gear, 'bicycle gear shift close up'), false);
  assert.equal(cmClipFits(gear, 'industrial machine working'), false);
  assert.equal(cmClipFits(gear, 'driver shifting gears in a car'), true);
  const doors = 'That same air opens and closes the doors at every stop.';
  assert.equal(cmClipFits(doors, 'people getting into the subway train'), false);
  assert.equal(cmClipFits(doors, 'woman shoes stepping through bus doors'), false);
  assert.equal(cmClipFits(doors, 'bus doors opening at a stop'), true);
  // lines no guard names are untouched
  assert.equal(cmClipFits('At the back sits a big diesel engine.', 'mechanic repairing a car engine'), true);
});

test('clip-moment v4 grade: brighter target and a lighter vignette than v3', () => {
  assert.ok(CM_GRADE.luma >= 110, `target luma ${CM_GRADE.luma} (v3 was 100)`);
  const m = /vignette=angle=PI\/(\d+)/.exec(CM_FINISH_CHAIN);
  assert.ok(m && Number(m[1]) >= 8, `vignette ${CM_FINISH_CHAIN} (v3 was PI/5)`);
});
