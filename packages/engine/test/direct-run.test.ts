import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildEdl } from '../src/edit/build';
import { cleanupLevel } from '../src/edit/job';
import { directEdit, directEditStep, overridesOf, sentencesOf, shotLines, ISOLATION_LINE, DIRECT_EDIT_AGENT } from '../src/edit/direct';
import { EXAMPLE_DIRECTION, type Direction } from '../src/edit/direct.schema';
import { BRAIN_CAPS, laneRuntime, withModel, type CompleteRequest, type Runtime } from '../src/runtime';

const W = (word: string, t: number, end: number) => ({ word, t, end });
const palette = { ink: '#000', paper: '#fff', accent: '#f00', accent2: '#0f0', deep: '#000', pop: '#fff' };
const source = { file: 'src.mp4', duration: 12, w: 1080, h: 1920, fps: 30 };
const words = [W('This', 0.2, 0.4), W('chip', 0.45, 0.8), W('is', 0.85, 0.95), W('tiny.', 1.0, 1.4), W('It', 2.0, 2.1), W('has', 2.15, 2.3), W('19', 2.35, 2.6), W('billion', 2.65, 3.0), W('transistors.', 3.05, 3.8),
  W('Each', 4.5, 4.7), W('one', 4.75, 4.9), W('switches', 4.95, 5.4), W('fast.', 5.45, 5.9), W('Follow', 6.5, 6.8), W('for', 6.85, 6.95), W('more.', 7.0, 7.5)];
const dir4: Direction = { ...EXAMPLE_DIRECTION, cleanup: 'tight', moves: [{ i: 1, id: '05' }] };

function fakeRt(answers: string[], seen: CompleteRequest[]): Runtime {
  return { name: 'fake', vision: false, run: async () => { throw new Error('no tool loops'); }, complete: async req => { seen.push(req); return answers[seen.length - 1] ?? ''; } };
}
const scope = (rt: Runtime) => ({ runtime: rt, models: { director: 'd', crew: 'c', fast: 'f' }, provider: 'test', deadlineScale: 1, drawsWell: true });

test('direct 11: sentences use the builder\'s own ids; shot lines stay short', () => {
  const ss = sentencesOf(words);
  assert.deepEqual(ss.map(s => s.i), [0, 1, 2, 3]);
  assert.equal(ss[1]!.text, 'It has 19 billion transistors.');
  assert.equal(shotLines([]).length, 1);
  assert.equal(shotLines(Array.from({ length: 100 }, (_, k) => ({ src_t: k, x: 0.4, y: 0.2, w: 0.2, h: 0.2 }))).length, 12);
});

test('direct 11: the step is self-contained and inside the edit cap', () => {
  const s = directEditStep({ words, brief: 'make it snappy' });
  assert.ok(s.system.startsWith(ISOLATION_LINE));
  assert.ok(s.prompt.includes('LOOKS:') && s.prompt.includes('3 [6.5s] Follow for more.') && s.prompt.includes('make it snappy'));
  assert.ok(s.fits && s.tokens <= BRAIN_CAPS.edit.in, `tokens ${s.tokens}`);
  const long = Array.from({ length: 2400 }, (_, k) => W(k % 15 === 14 ? 'end.' : `word${k}`, k * 0.3, k * 0.3 + 0.25));
  const sl = directEditStep({ words: long });
  assert.ok(sl.fits && sl.tokens <= BRAIN_CAPS.edit.in, `long clip trimmed: ${sl.tokens}`);
});

test('direct 11: a direction maps onto the builder\'s own overrides', () => {
  const o = overridesOf(dir4);
  assert.equal(o.style, 'atlas'); assert.equal(o.template, 'none');
  assert.deepEqual(o.laws, cleanupLevel('tight')!.laws, 'tight = job.ts cleanupLevel tight');
  assert.deepEqual(overridesOf({ ...dir4, cleanup: 'light' }).laws, cleanupLevel('keep the pauses')!.laws);
  assert.equal(overridesOf({ ...dir4, cleanup: 'balanced' }).laws, undefined);
  assert.equal(o.tags![1], 'hook'); assert.equal(o.tags![2], 'number');
  assert.deepEqual(o.moves, ['05']);
  assert.equal(overridesOf({ ...dir4, style: 'studio-cut' }).template, 'studio-cut');
  assert.equal(overridesOf({ ...dir4, style: 'base' }).style, undefined);
  assert.equal(overridesOf({ ...dir4, caption_look: '16' }).look, 16);
});

test('direct 11: the same direction gives a byte-identical EDL', () => {
  const o = overridesOf(dir4);
  const make = () => JSON.stringify(buildEdl({ source, words, palette, tags: o.tags, ...(o.laws ? { laws: o.laws } : {}), style: { id: 'base' } }));
  assert.equal(make(), make());
  const e = JSON.parse(make()) as { beats: { tag: string }[] };
  assert.equal(e.beats[1]!.tag, 'hook', 'the direction\'s tags reach the EDL');
});

test('direct 11: one brain call answers the edit; bad twice falls back to the rules', async () => {
  const seen: CompleteRequest[] = [];
  const r = await withModel(scope(fakeRt([JSON.stringify(dir4)], seen)), () => directEdit({ words }));
  assert.equal(r.source, 'brain'); assert.equal(r.value!.style, 'atlas');
  assert.equal(seen.length, 1); assert.equal(seen[0]!.agent, DIRECT_EDIT_AGENT);
  const seen2: CompleteRequest[] = [];
  const r2 = await withModel(scope(fakeRt(['{}', 'nope'], seen2)), () => directEdit({ words }));
  assert.equal(r2.source, 'default'); assert.equal(r2.value, null); assert.equal(seen2.length, 2);
  assert.ok(seen2[1]!.history?.[1]?.text.includes('Send the whole answer again'));
  const none = await directEdit({ words: [] });
  assert.equal(none.value, null); assert.equal(none.tries, 0);
});

test('direct 11: in a bridge job only direct:edit reaches Claude Code', async () => {
  const brainSaw: string[] = [], keySaw: string[] = [];
  const brain: Runtime = { name: 'bridge', vision: true, run: async () => { throw new Error('x'); }, complete: async req => { brainSaw.push(req.agent); return JSON.stringify(dir4); } };
  const key: Runtime = { name: 'key', vision: false, run: async () => { throw new Error('x'); }, complete: async req => { keySaw.push(req.agent); return '{}'; } };
  const lanes = laneRuntime({ facts: () => ({ claudeCode: 'online', hasKey: true, server: false, byok: 'required' }), brain, key });
  await withModel(scope(lanes), async () => {
    await directEdit({ words });
    await lanes.complete!({ agent: 'edit:romanize', system: 's', prompt: 'p', model: 'm', deadlineMs: 10 });
  });
  assert.deepEqual(brainSaw, ['direct:edit']); assert.deepEqual(keySaw, ['edit:romanize']);
});
