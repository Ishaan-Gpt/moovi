import assert from 'node:assert/strict';
import { test } from 'node:test';
import { renderSlots } from '../src/config';

test('render slots follow memory and cores, one at least and four at most', () => {
  assert.equal(renderSlots(4, 7.8), 3); // the 8 GB / 4 core box: three chunks at once
  assert.equal(renderSlots(2, 7.8), 1); // one core is kept for the worker
  assert.equal(renderSlots(16, 64), 4);
  assert.equal(renderSlots(4, 2), 1);
  assert.equal(renderSlots(1, 1), 1);
});
