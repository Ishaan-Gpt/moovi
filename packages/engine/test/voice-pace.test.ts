import assert from 'node:assert/strict';
import { test } from 'node:test';
import { fitRate } from '../src/audio/cast';

test('the voice is quickened only as much as the asked length needs, never past +35%', () => {
  assert.equal(fitRate('+10%', 60, 30), '+10%'); // 60 words fit 30 s at the voice's own pace
  assert.equal(fitRate('+10%', 72, 30), '+20%'); // 72 words in 30 s need 2.4 words a second
  assert.equal(fitRate('+0%', 98, 30), '+35%'); // far too long a script: capped, the script stage keeps it near length
  assert.equal(fitRate('+14%', 40, undefined), '+14%'); // no target length: the voice's own pace
  assert.equal(fitRate('+40%', 30, 30), '+40%'); // a faster own pace is never slowed down
});
