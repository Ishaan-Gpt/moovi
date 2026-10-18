import assert from 'node:assert/strict';
import { test } from 'node:test';
import { PRESETS } from '../src/commands';
import { PRESET_KIND, presetProblem } from '../src/router/presets';
import { LAUNCH_NEEDS_LINK, NEED_VIDEO, NO_PRESET, SHOWREEL_NEEDS_TEXT } from '../src/router/pipeline-words';
import { HANDLERS } from '../src/tasks';

/** Decision 19: three presets, no generic prompt; the router refuses a brief with none. */
const clip = { id: 'f1', name: 'take.mp4', path: '/x/take.mp4', mime: 'video/mp4' };
const logo = { id: 'f2', name: 'logo.png', path: '/x/logo.png', mime: 'image/png' };

test('presets: exactly Edit, Launch video, Showreel; the preset job is registered', () => {
  assert.deepEqual([...PRESETS], ['edit', 'launch', 'showreel']);
  assert.equal(typeof HANDLERS[PRESET_KIND], 'function');
});

test('presets: a brief with no preset is refused, whatever it says or carries', () => {
  assert.equal(presetProblem(undefined, 'make a launch video for cal.com', []), NO_PRESET);
  assert.equal(presetProblem(undefined, '', [clip]), NO_PRESET);
  assert.equal(presetProblem('auto' as never, 'anything', []), NO_PRESET);
});

test('presets: each one asks only for what its path needs', () => {
  assert.equal(presetProblem('edit', 'make it punchy', []), NEED_VIDEO);
  assert.equal(presetProblem('edit', '', [logo]), NEED_VIDEO, 'an image is not a clip to edit');
  assert.equal(presetProblem('edit', '', [clip]), null);
  assert.equal(presetProblem('launch', 'a launch for our app', []), LAUNCH_NEEDS_LINK, 'the skill path reads the live site');
  assert.equal(presetProblem('launch', 'cal.com', []), null);
  assert.equal(presetProblem('launch', 'launch https://linear.app/ now', []), null);
  assert.equal(presetProblem('showreel', '  ', []), SHOWREEL_NEEDS_TEXT);
  assert.equal(presetProblem('showreel', 'coffee, farm to cup', []), null);
});
