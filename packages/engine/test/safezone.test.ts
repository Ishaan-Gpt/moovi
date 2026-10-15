import { test } from 'node:test';
import assert from 'node:assert/strict';
import { STYLE1 } from '@contenteasy/skills';
import type { Box } from '../src/render/host';
import { describe, geometry, layerOf, platformZone } from '../src/render/qa';

const zone = platformZone(STYLE1.laws.flatMap(l => l.checks).find(c => c.kind === 'safeZone')?.params)!;
const box = (id: string, kind: string, x0: number, y0: number, x1: number, y1: number, text?: string): Box => ({ id, kind, x0, y0, x1, y1, alpha: 1, ...(text ? { text } : {}) });
const stage = box('s0.0', 'card', 200, 400, 880, 900); // something on stage, so no frame is empty
// boxes held for `n` samples, every 2nd frame at 30 fps (12 samples = 0.8 s)
const frames = (bs: Box[], n = 12) => Array.from({ length: n }, (_, i) => ({ f: i * 2, boxes: [stage, ...bs] }));
const covered = (bs: Box[], o: Partial<Parameters<typeof geometry>[1]> = {}, n = 12) =>
  geometry(frames(bs, n), { fps: 30, every: 2, format: 'vertical', platform: zone, ...o }).filter(q => q.type === 'covered');

test('law 10 carries the zone the QA reads: the bottom 270 px, and 120 px on the right from mid-height down', () => {
  assert.deepEqual(zone, { bottom: 270, rail: 120, railTop: 960 });
  const c = STYLE1.laws.find(l => l.n === 10)!.checks[0]!;
  assert.equal(c.blocking, true);
  assert.equal(c.owner, 'builder');
});

test('a line in the bottom band is covered, and the fix says how far to move it', () => {
  const q = covered([box('s0.3', 'text', 300, 1600, 780, 1700, 'Try it free')]);
  assert.equal(q.length, 1);
  assert.match(q[0]!.what, /"Try it free" \(s0\.3\) reaches y 1700.*move it up at least 50 px so it ends above y 1650/);
  assert.match(describe(q), /^- covered 0–0\.73 s:/);
  assert.equal(covered([box('s0.3', 'text', 300, 1550, 780, 1650, 'Try it free')]).length, 0, 'ending on the line is clear');
});

test('words count wherever they are drawn: a ui pill, a drawn pill prop; a phone and the corner assets are decoration', () => {
  const T = { scenes: [{ layers: [{ kind: 'grid' }, { kind: 'image', draw: 'pill', p: { text: 'quill.app' } }, { kind: 'image', draw: 'phone' }, { kind: 'typebox', text: 'Sent!' }] }] };
  const q = covered([
    box('s0.1', 'image', 160, 1590, 920, 1720),
    box('s0.2', 'phone', 360, 1200, 720, 1900),
    box('corner1', 'corner', 760, 1560, 1060, 1860),
    box('s0.3', 'ui', 300, 1660, 920, 1784),
  ], { layer: layerOf(T) });
  assert.deepEqual(q.map(x => x.ids[0]).sort(), ['s0.1', 's0.3']);
  assert.match(q.find(x => x.ids[0] === 's0.1')!.what, /^pill "quill\.app" \(s0\.1\) reaches y 1720/);
  assert.match(q.find(x => x.ids[0] === 's0.3')!.what, /^typebox "Sent!"/);
  // without the timeline the QA can't tell a drawn pill from a picture, so it leaves the image alone
  assert.deepEqual(covered([box('s0.1', 'image', 160, 1590, 920, 1720)]).map(x => x.ids[0]), []);
});

test('the rail starts at mid-height: a wide headline up top is fine, a wide line beside the buttons is not', () => {
  assert.equal(covered([box('s0.1', 'text', 80, 300, 1000, 400, 'TWO MINUTES BEATS')]).length, 0);
  const q = covered([box('s0.4', 'text', 65, 1293, 1015, 1451, 'TAKE THE TWO MINUTES')]);
  assert.equal(q.length, 1);
  assert.match(q[0]!.what, /reaches x 1015 at y 1293–1451, under the app's like\/comment\/share rail \(right of x 960, below y 960\): pull its right edge in at least 55 px/);
  assert.equal(covered([box('s0.4', 'text', 120, 1293, 960, 1451, 'TAKE THE TWO MINUTES')]).length, 0, 'ending on the rail line is clear');
});

test('not judged: a brush shorter than 0.2 s, a scene sliding in, landscape, a style without the law', () => {
  const low = [box('s0.3', 'text', 300, 1600, 780, 1700, 'Try it free')];
  assert.equal(covered(low, {}, 1).length, 0);
  assert.equal(covered(low, { entering: () => true }).length, 0);
  assert.equal(covered(low, { format: 'landscape' }).length, 0);
  assert.equal(covered(low, { platform: platformZone(undefined) }).length, 0);
  assert.equal(covered(low, { platform: null }).length, 0);
});

test('a covered word is its own issue, never a geometry one, so the builder and Lens can file it under law 10', () => {
  const all = geometry(frames([box('s0.3', 'text', 300, 1600, 780, 1700, 'Try it free')]), { fps: 30, every: 2, format: 'vertical', platform: zone });
  assert.deepEqual(all.map(q => q.type), ['covered']);
});
