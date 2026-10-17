import assert from 'node:assert/strict';
import test from 'node:test';
import { buildEdl } from '../src/edit/build';
import { validateEdl, type Edl } from '../src/edit/edl';
import { cleanupLevel } from '../src/edit/job';
import { EDIT, type PlayerEdl } from '../src/edit/lib';
import { moveIn, parseEdit, reEdit } from '../src/edit/reedit';
import { reviewConfig } from '../src/review/config';
import { lintEdl } from '../src/review/lint';

const W = (word: string, t: number, end: number) => ({ word, t, end });
const palette = { ink: '#000', paper: '#fff', accent: '#f00', accent2: '#0f0', deep: '#000', pop: '#fff' };
const source = { file: 'src.mp4', duration: 10, w: 1080, h: 1920, fps: 30 };
const take = [W('Moovi', 0.3, 0.7), W('edits', 0.75, 1.1), W('every', 1.45, 1.7), W('clip.', 1.75, 2.2),
  W('It', 3.0, 3.1), W('cuts', 3.15, 3.5), W('the', 3.55, 3.7), W('pauses.', 3.75, 4.3),
  W('Then', 5.0, 5.3), W('it', 5.35, 5.45), W('adds', 5.5, 5.8), W('captions.', 5.85, 6.5),
  W('Try', 7.2, 7.5), W('it', 7.55, 7.7), W('now.', 7.75, 8.3)];
const pauses: [number, number][] = [[2.2, 3.0], [4.3, 5.0], [6.5, 7.2]];
function live(): Edl {
  const e = buildEdl({ source, words: take, pauses, palette, style: { id: 'base' } }) as Edl;
  const at = (i: number) => EDIT.outWords(e as unknown as PlayerEdl)[i]!;
  const beat = (a: number, b: number, tag: NonNullable<Edl['beats']>[number]['tag']) => ({ t0: at(a).t0, t1: at(b).t1, word_idx: Array.from({ length: b - a + 1 }, (_, k) => a + k), tag });
  e.beats = [beat(0, 3, 'hook'), beat(4, 7, 'claim'), beat(8, 11, 'claim'), beat(12, 14, 'cta')];
  return e;
}

test('edit by words reads a named move at a time, and leaves what it cannot make unread', () => {
  assert.equal(moveIn('add a papercut on the 4th second'), '13');
  assert.equal(moveIn('put a glass card here'), '17');
  const p = parseEdit('add a paper cut at 0:04 and add a 3d slider at 6s');
  assert.deepEqual(p.ops.map(o => o.op), [{ op: 'move', n: '13', t: 4 }]);
  assert.deepEqual(p.unknown, ['add a 3d slider at 6s']);
});

test('edit by words places the paper cut at that moment, and the edit stays valid', async () => {
  const e = live();
  const r = await reEdit(e, 'add a paper cut at 0:03', { review: false });
  assert.equal(r.steps.length, 1);
  assert.match(r.steps[0]!.did, /paper cut/);
  assert.deepEqual(r.problems.filter(p => !p.startsWith('version')), []);
  assert.deepEqual(validateEdl(r.edl).problems.filter(p => !p.startsWith('version')), []);
  assert.notEqual(JSON.stringify(r.edl), JSON.stringify(e));
});

test('cleanup levels: the brief picks light or tight; plain words change nothing', () => {
  assert.equal(cleanupLevel('make it tight, no pauses')?.level, 'tight');
  assert.equal(cleanupLevel('keep it natural, let it breathe')?.level, 'light');
  assert.equal(cleanupLevel('edit my talking head video'), null);
  const tight = buildEdl({ source, words: take, pauses, palette, style: { id: 'base' }, laws: cleanupLevel('tight')!.laws });
  const base = buildEdl({ source, words: take, pauses, palette, style: { id: 'base' } });
  assert.ok(EDIT.timeline(tight as never).duration <= EDIT.timeline(base as never).duration);
});

test('the floor rule: a caption too short to read is flagged, a readable one is not', () => {
  const e = live() as unknown as PlayerEdl, cfg = reviewConfig(e);
  const box = (t0: number, t1: number) => ({ chunk: 0, t0, t1, t: (t0 + t1) / 2, text: 'quick', words: 1, x0: 0.3, x1: 0.7, y0: 0.5, y1: 0.55 });
  assert.ok(lintEdl(e, cfg, [box(1, 1.2)]).some(i => i.kind === 'caption_time'));
  assert.ok(!lintEdl(e, cfg, [box(1, 1.8)]).some(i => i.kind === 'caption_time'));
});
