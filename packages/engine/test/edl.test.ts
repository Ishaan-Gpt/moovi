import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import { asPlayerEdl, checkMetrics, edlJsonSchema, keepOf, metricsOf, validateEdl, type Edl } from '../src/edit/edl';
import { EDIT } from '../src/edit/lib';
import { roughEdl } from '../src/edit/rough';

const dir = join(import.meta.dirname, '../src/edit');
const example = JSON.parse(readFileSync(join(dir, 'edl.example.json'), 'utf8')) as unknown;

test('EDL v0: the example validates and the player reads it as it is', () => {
  const { edl, problems } = validateEdl(example);
  assert.deepEqual(problems, []);
  const p = asPlayerEdl(edl!);
  assert.deepEqual(EDIT.timeline(p).problems, []);
  assert.equal(EDIT.timeline(p).duration, 5.99);
  // a word inside a cut is not captioned; the kept ones map to output time
  const out = EDIT.outWords(p).map(w => w.text);
  assert.ok(!out.includes('um,'));
  assert.equal(out[0], 'Moovi');
});

test('EDL v0: the committed JSON schema matches the zod schema (run scripts/edl-schema.ts after a change)', () => {
  const file = JSON.parse(readFileSync(join(dir, 'edl.schema.json'), 'utf8'));
  assert.deepEqual(file, JSON.parse(JSON.stringify(edlJsonSchema())));
});

test('EDL v0: keep ranges derive from shots, and removed plus kept cover the clip', () => {
  const { edl } = validateEdl(example);
  const keep = keepOf(edl!);
  assert.deepEqual(keep, [{ src_in: 1.11, src_out: 4.04 }, { src_in: 5.01, src_out: 6.39 }, { src_in: 7.51, src_out: 9.19 }]);
  const covered = keep.reduce((a, k) => a + k.src_out - k.src_in, 0) + edl!.removed!.reduce((a, r) => a + r.src_out - r.src_in, 0);
  assert.ok(Math.abs(covered - edl!.source.duration) < 1e-6);
});

test('EDL v0: the validator catches a removed range over a kept shot, events past the end and bad asset ids', () => {
  const bad = structuredClone(example) as Edl;
  bad.removed!.push({ src_in: 2, src_out: 2.5, reason: 'filler', rule_id: 'law.filler' });
  bad.sfx!.push({ t: 9, asset_ref: 'sfx:pop', event: 'cut', rule_id: 'x' });
  const r1 = validateEdl(bad);
  assert.ok(r1.problems.some(p => p.startsWith('removed.4')), r1.problems.join('; '));
  assert.ok(r1.problems.some(p => p.startsWith('sfx.2')), r1.problems.join('; '));
  const bad2 = structuredClone(example) as Edl;
  bad2.sfx![0]!.asset_ref = 'whoosh';
  assert.ok(validateEdl(bad2).problems.some(p => p.includes('<category>:<slug>')));
  const bad3 = structuredClone(example) as Edl;
  bad3.shots[2]!.t_in = 3;
  assert.ok(validateEdl(bad3).problems.some(p => p.includes('shot 2')));
});

test('EDL v0: metrics are measured from the edit and a style band fails loudly', () => {
  const { edl } = validateEdl(example);
  const m = metricsOf(edl!);
  assert.equal(m.duration, 5.99);
  assert.equal(m.cuts_on_word_pct, 100);
  assert.equal(m.sfx_on_cut_pct, 50);
  assert.ok(m.max_hold <= 1.7 && m.max_gap < 0.6, JSON.stringify(m));
  assert.deepEqual(checkMetrics(m, { median_shot: [0.5, 2.5], max_gap: [0, 0.5] }), []);
  assert.equal(checkMetrics(m, { median_shot: [0, 1] }).length, 1);
});

test('EDL v0: the stand-in rough plan is a valid EDL too', () => {
  const words = [{ word: 'Hello', t: 0.5, end: 0.9 }, { word: 'world.', t: 0.95, end: 1.4 }, { word: 'Again', t: 3, end: 3.4 }];
  const e = roughEdl({ file: 'src.mp4', duration: 4, w: 1080, h: 1920, fps: 30 }, words, { palette: { ink: '#000', paper: '#fff', accent: '#f00', accent2: '#0f0', deep: '#000', pop: '#fff' } });
  assert.deepEqual(validateEdl(e).problems.filter(p => !p.startsWith('version')), []);
});

test('EDL v0: the player fields Claude 1 added (fit over a blurred fill, grid, linear zoom) validate', () => {
  const words = [{ word: 'Hello', t: 0.5, end: 0.9 }, { word: 'world.', t: 0.95, end: 1.4 }];
  // a landscape clip into a vertical film: the stand-in plan emits layout 'fit' with bg 'blur'
  const e = roughEdl({ file: 'src.mp4', duration: 2, w: 1920, h: 1080, fps: 30 }, words, { palette: { ink: '#000', paper: '#fff', accent: '#f00', accent2: '#0f0', deep: '#000', pop: '#fff' } });
  assert.equal(e.shots[0]!.layout, 'fit');
  assert.equal(e.shots[0]!.bg?.mode, 'blur');
  e.shots[0]!.zoom = [{ t: e.shots[0]!.t_in, scale: 1.1, cx: 0.5, cy: 0.5, ease: 'linear', dur: 0.5 }];
  assert.deepEqual(validateEdl(e).problems.filter(p => !p.startsWith('version')), []);
  const g = structuredClone(e); g.shots[0]!.layout = 'grid';
  assert.deepEqual(validateEdl(g).problems.filter(p => !p.startsWith('version')), []);
  const bad = structuredClone(e) as unknown as { shots: { layout: string }[] }; bad.shots[0]!.layout = 'mosaic';
  assert.ok(validateEdl(bad).problems.length > 0);
});
