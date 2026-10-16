import assert from 'node:assert/strict';
import test from 'node:test';
import { sizeRuns, placeAt } from '../src/edit/render';
import type { PlayerEdl } from '../src/edit/lib';

test('render: a shot splits into runs of one picture size (a punch-in key mid shot is its own run)', () => {
  const e = {
    version: 1, source: { file: 's.mp4', duration: 4, w: 1080, h: 1920, fps: 30 }, output: { w: 1080, h: 1920, fps: 30 }, caption_style_id: 'caption:sm-two', words: [],
    palette: { ink: '#000', paper: '#fff', accent: '#f00', accent2: '#0f0', deep: '#000', pop: '#fff' },
    shots: [{ t_in: 0, t_out: 4, src_in: 0, src_out: 4, layout: 'full', framing: { scale: 1, cx: 0.5, cy: 0.5 }, zoom: [{ t: 2, scale: 1.35, cx: 0.5, cy: 0.5, ease: 'cut' }] }],
  } as unknown as PlayerEdl;
  const runs = sizeRuns(e, { a: 0, b: 120 }, 30, 1080, 1920);
  assert.equal(runs.length, 2);
  assert.deepEqual(runs.map(r => [r.a, r.b]), [[0, 60], [60, 120]]);
  const p0 = placeAt(e, 0.5 / 30, 1080, 1920), p1 = placeAt(e, 60.5 / 30, 1080, 1920);
  assert.equal(p0.sw, 1080); assert.equal(p1.sw, 1458);
  // inside a run the size is fixed and the picture still covers the frame
  for (const r of runs) for (let j = r.a; j < r.b; j++) { const p = placeAt(e, (j + 0.5) / 30, 1080, 1920); assert.equal(p.sw, placeAt(e, (r.a + 0.5) / 30, 1080, 1920).sw); assert.ok(p.x <= 0 && p.y <= 0 && p.x + p.sw >= 1080 && p.y + p.sh >= 1920); }
});

test('render: every picture run gets its n frames and the overlay frames never rebuild the graph', async () => {
  const { readFileSync } = await import('node:fs');
  const src = readFileSync(new URL('../src/edit/render.ts', import.meta.url), 'utf8');
  assert.match(src, /tpad=stop_mode=clone:stop=\$\{n\}/);
  assert.match(src, /'-reinit_filter', '0', '-i', join\(tmp, 'ov'/);
  assert.match(src, /'-frames:v', String\(N\)/);
});
