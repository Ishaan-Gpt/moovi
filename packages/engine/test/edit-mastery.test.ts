import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { masteryFile, PLAYER_DIR, PLAYER_PAGE, premiumModule, skeletonSpec, writeSpec } from '../src/edit/mastery';
import { previewFile } from '../src/styles/serve';

const body = (r: ReturnType<typeof masteryFile>) => ('body' in r ? r.body : '');

test('the Edit type serves Edit mastery\'s player unchanged, with its relative paths inside one base', () => {
  const dir = mkdtempSync(join(tmpdir(), 'moovi-mastery-'));
  try {
    writeFileSync(join(dir, 'words.json'), '[]');
    const player = masteryFile(dir, 'a/b/c/player.html');
    assert.equal(body(player), readFileSync(join(PLAYER_DIR, 'player.html'), 'utf8'), 'byte for byte the file on main');
    assert.match(body(masteryFile(dir, '')), new RegExp(PLAYER_PAGE.replace(/[?.]/g, '\\$&')));
    assert.equal(masteryFile(dir, 'v/words.json').status, 200);
    assert.equal(masteryFile(dir, 'v/../../etc/passwd').status, 404, 'never outside the edit folder');
    assert.equal(masteryFile(dir, 'a/world/cut/laptop.png').status, 200, 'the desk world');
    assert.equal(masteryFile(dir, 'packages/engine/assets/sfx/ui.pop.wav').status, 200, 'the engine assets');
    // the studio's preview route hands the same folder to the same resolver
    assert.equal(body(previewFile({ player: 'edit-mastery', dir, id: 'x' }, 'a/b/c/player.html', '/studio/x')), body(player));
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('the caption painter module exports what the player imports (Captions 1-4 included)', () => {
  const js = premiumModule(), ex = js.slice(js.lastIndexOf('export {'));
  for (const name of ['premiumCaption1', 'cards', 'drawCaption', 'ticks', 'accentFromPixels']) assert.match(ex, new RegExp(`\\b${name}\\b`));
});

test('no model: the skeleton spec only (Premium Caption 1, start on the first kept word, no devices)', () => {
  const dir = mkdtempSync(join(tmpdir(), 'moovi-mastery-'));
  try {
    writeFileSync(join(dir, 'words.json'), JSON.stringify([{ word: 'Um,', t: 0.1, end: 0.4 }, { word: 'Hello', t: 1.2, end: 1.5 }, { word: 'world.', t: 1.6, end: 2 }]));
    writeFileSync(join(dir, 'edl.json'), JSON.stringify({ removed: [{ src_in: 0, src_out: 1.1 }] }));
    const s = skeletonSpec(dir) as { caption: { variant: string }; start: { w: string }; beats: { layers: { t: string }[] }[] };
    assert.equal(s.caption.variant, '1.1');
    assert.equal(s.start.w, 'hello');
    assert.deepEqual(s.beats.flatMap(b => b.layers.map(l => l.t)), ['cam'], 'no device of ours');
    writeSpec(dir, s);
    assert.equal(JSON.parse(readFileSync(join(dir, 'spec.json'), 'utf8')).clip, '../../../v/');
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('a model-written spec plays only when the player can draw it as written (else the skeleton)', async () => {
  const { checkMasterySpec, masteryText } = await import('../src/edit/mastery-direct');
  const { devices, recipe, format } = masteryText();
  assert.ok(devices.includes('cam') && devices.includes('desk'), 'the devices come from the player itself');
  assert.match(recipe, /## 12\./); assert.match(format, /beat spec/i);
  const words = [{ word: 'Hello' }, { word: 'guys,' }, { word: 'Moovi' }, { word: 'edits.' }], files = new Set(['laptop']);
  const good = { beats: [{ from: { w: 'hello', after: 0 }, layers: [{ t: 'cam', z: 1.04 }] }, { from: { w: 'moovi', after: 1 }, layers: [{ t: 'cam', form: 'split' }, { t: 'tag', name: 'Moovi', at: { w: 'moovi' }, x: 60, y: 1180 }] }] };
  assert.deepEqual(checkMasterySpec(good, { words, devices, files }), []);
  const bad = { beats: [{ from: { w: 'welcome' }, layers: [{ t: 'cam', form: 'window', z: 0 }, { t: 'sparkles' }, { t: 'pill', avatar: 'me.png', y: 0.8 }] }] };
  const p = checkMasterySpec(bad, { words, devices, files }).join(' | ');
  for (const why of ['not said', 'not a device', 'window form', 'cam z 0', 'design px', 'not a file']) assert.ok(p.includes(why), `${why}: ${p}`);
});
