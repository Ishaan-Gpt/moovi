import assert from 'node:assert/strict';
import { test } from 'node:test';
import { fitRate, retakeRate } from '../src/audio/cast';

test('the voice is quickened only as much as the asked length needs, never past +35%', () => {
  assert.equal(fitRate('+10%', 60, 30), '+10%'); // 60 words fit 30 s at the voice's own pace
  assert.equal(fitRate('+10%', 72, 30), '+20%'); // 72 words in 30 s need 2.4 words a second
  assert.equal(fitRate('+0%', 98, 30), '+35%'); // far too long a script: capped, the script stage keeps it near length
  assert.equal(fitRate('+14%', 40, undefined), '+14%'); // no target length: the voice's own pace
  assert.equal(fitRate('+40%', 30, 30), '+40%'); // a faster own pace is never slowed down
});

test('a take that still runs long gets one faster retake aimed a second inside the ask', () => {
  assert.equal(retakeRate('+27%', 32.6, 30), '+43%'); // the FalkorDB take: 32.6 s at +27% for a 30 s ask
  assert.equal(retakeRate('+10%', 28.6, 30), null); // fits
  assert.equal(retakeRate('+10%', 40, undefined), null); // no asked length
  assert.equal(retakeRate('+45%', 40, 30), null); // already at the ceiling
  assert.equal(retakeRate('+0%', 60, 30), '+45%'); // capped
});

test('a take more than 3 s short gets one slower retake, never below -12%', () => {
  assert.equal(retakeRate('+10%', 26.0, 30), '+0%'); // the GPS take: 26.0 s for a 30 s ask, aimed at 28.5 s
  assert.equal(retakeRate('+0%', 27.5, 30), null); // within 3 s: the tail keeps the film inside the bar
  assert.equal(retakeRate('+0%', 20, 30), '-12%'); // floored, the voice stays natural
  assert.equal(retakeRate('-12%', 20, 30), null); // already at the floor
});
