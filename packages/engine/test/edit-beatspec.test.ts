import assert from 'node:assert/strict';
import test from 'node:test';
import { beatSpecOf, camKeys, castBeats, directBeats, parseAsks, readSentences, registryCaster } from '../src/edit/beatspec';
import { editRegistry } from '../src/edit/registry';

const W = (word: string, t: number, end: number) => ({ word, t, end });
// who, what, number, list, cta: one sentence each
const take = [
  W('Hi,', 0.2, 0.4), W('I', 0.45, 0.5), W('am', 0.55, 0.7), W('Ishaan', 0.75, 1.2), W('from', 1.25, 1.4), W('Moovi.', 1.45, 2.0),
  W('Moovi', 2.6, 3.0), W('is', 3.05, 3.15), W('an', 3.2, 3.3), W('agentic', 3.35, 3.9), W('video', 3.95, 4.3), W('editor.', 4.35, 4.9),
  W('It', 5.4, 5.5), W('cut', 5.55, 5.8), W('300', 5.85, 6.4), W('pauses', 6.45, 6.9), W('in', 6.95, 7.05), W('one', 7.1, 7.3), W('minute.', 7.35, 7.9),
  W('You', 8.4, 8.5), W('get', 8.55, 8.7), W('captions,', 8.75, 9.3), W('music,', 9.4, 9.9), W('effects', 10.0, 10.5), W('and', 10.55, 10.65), W('sound.', 10.7, 11.3),
  W('Comment', 12.0, 12.4), W('EDIT', 12.45, 12.9), W('to', 12.95, 13.05), W('try', 13.1, 13.3), W('it.', 13.35, 13.7),
];
const R = editRegistry();

test('director reads each sentence: function, verbs, hero word', () => {
  const r = readSentences(take, R);
  assert.deepEqual(r.map(s => s.fn), ['who', 'what', 'number', 'list', 'cta']);
  assert.equal(r[0]!.hero, 'Ishaan');
  assert.equal(r[2]!.hero, '300');
  assert.ok(r[4]!.verbs.includes('comment'));
});

test('director casts from the registry: one device per sentence that needs one, never the same within 3 beats', async () => {
  const reads = readSentences(take, R), { picks } = await castBeats(reads, registryCaster(R), { registry: R });
  const by = Object.fromEntries(picks.map(p => [p.i, p.meta.device]));
  assert.equal(by[0], 'tag');
  assert.equal(by[2], 'stat');
  assert.equal(by[3], 'cascade');
  assert.equal(by[4], 'pill');
  for (let k = 1; k < picks.length; k++) for (let j = Math.max(0, k - 3); j < k; j++) assert.notEqual(picks[k]!.id, picks[j]!.id);
});

test('director writes the beat spec (edit.md format): word anchors, layers per device, sounds on their words; pure', async () => {
  const reads = readSentences(take, R), { picks } = await castBeats(reads, registryCaster(R), { registry: R });
  const a = beatSpecOf(reads, picks), b = beatSpecOf(reads, picks);
  assert.deepEqual(a, b);
  assert.equal(a.beats.length, reads.length);
  for (const bt of a.beats) assert.ok(typeof bt.from.w === 'string' && typeof bt.from.after === 'number');
  const stat = a.beats[2]!.layers.find(l => l.t === 'stat')!;
  assert.equal(stat.to, 300);
  const cascade = a.beats[3]!.layers.find(l => l.t === 'cascade')! as unknown as { items: { title: string }[] };
  assert.ok(cascade.items.length >= 3);
  assert.ok(a.sfx.length >= picks.length && a.sfx.every(s => s.at.w && s.g > 0));
});

test('a chat keyword overrides the pick: "add a crash zoom on \'agentic\'", "orbit on the hook" is refused (not drawn yet)', async () => {
  const asks = parseAsks("add a crash zoom on 'agentic'. orbit on the hook", R);
  assert.deepEqual(asks.map(a => a.entry), ['camera:crash-zoom-in', 'effect:reel-orbit']);
  const r = await directBeats(take, { caster: registryCaster(R), asks, registry: R });
  const p = r.picks.find(x => x.i === 1)!;
  assert.equal(p.id, 'camera:crash-zoom-in');
  assert.ok(p.forced);
  const cam = r.spec.beats[1]!.layers[0]!;
  assert.equal(cam.move, 'crash-zoom-in');
  assert.ok(Array.isArray(cam.keys) && (cam.keys as number[][]).length > 2);
  assert.ok(r.missed.some(m => /orbit|Orbit/.test(m.why)), JSON.stringify(r.missed));
});

test('camera keys follow the camera layer curve and start at rest', () => {
  const k = camKeys('slow-zoom-in', 2);
  assert.equal(k[0]![1], 1);
  assert.ok(k.at(-1)![1]! > 1.02);
  // speed is a curve, never a step: the first step is smaller than the middle one
  const step = (i: number) => k[i + 1]![1]! - k[i]![1]!;
  assert.ok(step(0) < step(Math.floor(k.length / 2)));
  assert.ok(camKeys('roll-right', 1).some(x => Math.abs(x[4]!) > 1), 'roll is kept');
});
