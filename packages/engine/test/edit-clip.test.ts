import assert from 'node:assert/strict';
import test from 'node:test';
import { joinGraph, runsOf } from '../src/edit/xfade';

test('audio joins: a crossfade at each real cut only, borrowed from past the cut so the length is unchanged', () => {
  assert.deepEqual(runsOf([{ a: 0, b: 1 }, { a: 1, b: 2 }, { a: 3, b: 4 }]), [{ a: 0, b: 2 }, { a: 3, b: 4 }]);
  const g = joinGraph([{ a: 0, b: 1 }, { a: 1, b: 2 }, { a: 3, b: 4 }], { d: 0.016 });
  assert.equal((g.match(/acrossfade/g) ?? []).length, 1); // the split at 1 s is no join
  assert.match(g, /atrim=start=0\.0000:end=2\.0080/);
  assert.match(g, /atrim=start=2\.9920:end=4\.0000/);
  // length: (2.008 - 0) + (4 - 2.992) - 0.016 = 3.000, the kept total
});
