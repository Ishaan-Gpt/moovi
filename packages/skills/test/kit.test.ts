import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Kit, kit, type SceneProgram } from '../src';

const beats = [
  { say: 'Your to-do list lies to you every morning.' },
  { say: 'Voice notes pile up, ideas get lost, nothing gets done.' },
  { say: 'Notely listens and writes the list for you.' },
  { say: 'Comment notely and I will send you the link.' },
];
const words = kit.readingPace(beats);
const stage = kit.stageFrom({ accent: '#E8735A' }, { corners: [{ src: '/a.png', w: 370 }, { src: '/b.png', w: 350 }] });
const assets = (ref: string) => `/data/${ref.replace(':', '/')}`;

test('scenes come from the voice: one per beat, 4 frames before the first word', () => {
  const k = new Kit({ beats, words, stage, format: 'vertical', assets });
  assert.equal(k.scenes.length, 4);
  assert.equal(k.scenes[0]!.f0, 0);
  for (const s of k.scenes.slice(1)) assert.equal(s.f0, s.words[0]!.f - 4);
  assert.equal(k.scenes.at(-1)!.f1, k.frames);
});

test('a program with presets and props compiles and assembles', () => {
  const k = new Kit({ beats, words, stage, format: 'vertical', assets });
  const progs: SceneProgram[] = [
    { name: 'hook', preset: { id: 'stack_slam', lines: ['Your to-do list', '*LIES*'] } },
    { name: 'pile', preset: { id: 'notif', lines: ['Ideas get', '~lost'], cards: [{ app: 'Notes', title: 'Voice note 14', body: 'remember the thing' }, { app: 'Notes', title: 'Voice note 15', body: 'the other thing' }] },
      layers: [{ kind: 'image', draw: 'lockphone', cx: 540, cy: 1300, w: 380, h: 771, at: { w: 'nothing' }, p: { time: '9:41', notif: 'Nothing done', notifAt: { w: 'done' } } }] },
    { name: 'answer', preset: { id: 'logo_land', word: 'Notely' }, camera: [{ at: 0, scale: 1.2, cx: 540, cy: 840 }, { at: { w: 'list' }, scale: 1, cx: 540, cy: 960 }] },
    { name: 'cta', preset: { id: 'cta_comment', keyword: 'notely', bubble: 'Sent! Check your DMs' } },
  ];
  const compiled = progs.map((p, i) => k.compile(i, p));
  const a = k.assemble(compiled);
  const T = a.timeline;
  assert.equal(T.scenes.length, 4);
  // every shown word is timed, inside its scene, in order
  for (const sc of T.scenes) for (const L of sc.layers) if (L.kind === 'line') {
    L.words.forEach((w, j) => { assert.ok(w.f >= sc.f0 - 4 && w.f < sc.f1, `word ${w.w} at ${w.f} outside [${sc.f0}, ${sc.f1})`); if (j) assert.ok(w.f >= L.words[j - 1]!.f + 2); });
  }
  assert.ok(a.report.matched / a.report.tokens > 0.9, `matched ${a.report.matched}/${a.report.tokens}`);
  // anchors resolved into absolute frames, prop params included
  const lock = T.scenes[1]!.layers.find(l => l.kind === 'image' && l.draw === 'lockphone') as unknown as { f: number; p: { notifAt: number } };
  assert.equal(lock.f, k.scenes[1]!.words.find(w => w.n === 'nothing')!.f);
  assert.equal(lock.p.notifAt, k.scenes[1]!.words.find(w => w.n === 'done')!.f);
  // enters and exits, camera keys, corners, motion blur, events
  assert.ok(T.scenes[1]!.enter && T.scenes[0]!.exit);
  assert.equal(T.scenes[2]!.keys![0]![1], 1.2);
  assert.equal(T.backdrop!.corners!.length, 2);
  assert.ok(T.mblur!.win.length > 4);
  assert.ok(a.events.filter(e => e.event === 'word').length === a.report.tokens);
  assert.ok(a.events.some(e => e.event === 'build'));
  assert.ok(a.events.some(e => e.event === 'cta'));
  // the serif accent line uses the owner's gold
  const serif = T.scenes[1]!.layers.find(l => l.kind === 'line' && l.italic) as unknown as { gradient: string[] };
  assert.deepEqual(serif.gradient, kit.GOLD);
});

test('a word the voice does not say is a clear error for the agent', () => {
  const k = new Kit({ beats, words, stage, format: 'vertical', assets });
  assert.throws(() => k.compile(0, { name: 'x', layers: [{ kind: 'image', draw: 'seal', cx: 540, cy: 900, w: 400, h: 400, at: { w: 'banana' } }] }), /"banana" is not spoken in scene 1/);
});

test('an invalid program names the field', () => {
  const k = new Kit({ beats, words, stage, format: 'vertical', assets });
  assert.throws(() => k.compile(0, { name: 'x', layers: [{ kind: 'line', top: 400 }] }), /layers\.0\.text/);
});

test('a preview of one scene enters like that scene', () => {
  const k = new Kit({ beats, words, stage, format: 'vertical', assets });
  const c = k.compile(2, { name: 'answer', preset: { id: 'lines', lines: ['Notely writes', '~the list'] } });
  const p = k.preview(2, c);
  assert.equal(p.timeline.scenes.length, 1);
  assert.ok(p.timeline.scenes[0]!.enter);
  assert.deepEqual(p.range, [k.scenes[2]!.f0, k.scenes[2]!.f1]);
});

test('props take the video’s currency and product, never the style owner’s samples', () => {
  assert.equal(kit.currencyOf('Split the $84 bill in one tap'), '$');
  assert.equal(kit.currencyOf('Bas ₹99 mein', 'hinglish'), '₹');
  assert.equal(kit.currencyOf('Only 5 euros a month'), '€');
  assert.equal(kit.currencyOf('No price here', 'hindi'), '₹');
  const k = new Kit({ beats, words, stage, format: 'vertical', assets, currency: '$', product: 'Notely' });
  const c = k.compile(1, { name: 'bill', layers: [
    { kind: 'image', draw: 'receipt', cx: 540, cy: 1200, w: 620, h: 900, at: { w: 'pile' }, p: { print: [[{ w: 'pile' }, 400]], totalY: 300 } },
    { kind: 'image', draw: 'coin', cx: 300, cy: 700, w: 300, h: 300, at: { w: 'ideas' } },
  ] });
  const [receipt, coin] = c.scene.layers.filter(l => l.kind === 'image') as unknown as { p: Record<string, unknown>; f: number }[];
  assert.equal(receipt!.p.title, 'NOTELY');
  assert.equal(receipt!.p.total, '$0');
  assert.equal(receipt!.p.landAt, receipt!.f, 'no ₹ odometer spin in another currency');
  assert.equal(coin!.p.face, '$0');
});

test('a scene preview carries its sound events (for the dead-air check)', () => {
  const k = new Kit({ beats, words, stage, format: 'vertical', assets });
  const c = k.compile(1, { name: 'pile', preset: { id: 'lines', lines: ['Voice notes pile up'] } });
  const p = k.preview(1, c);
  assert.ok(p.events.some(e => e.event === 'word'));
  assert.ok(p.events.every(e => e.t * 30 >= p.range[0] - 12), 'words may lead the cut by a few frames, no more');
});

test('empty-shell props are refused when a scene is written, never when accepted scenes are assembled', () => {
  const k = new Kit({ beats, words, stage, format: 'vertical', assets });
  const prog: SceneProgram = { name: 'pile', layers: [{ kind: 'image', draw: 'phone', cx: 540, cy: 1200, w: 340, h: 690, at: { w: 'pile' } }] };
  assert.throws(() => k.compile(1, prog, { strict: true }), /needs something on its screen/);
  assert.doesNotThrow(() => k.compile(1, prog));
});

test('a prop whose text only names a missing asset is refused when written', () => {
  const k = new Kit({ beats, words, stage, format: 'vertical', assets });
  const prog = (title: string): SceneProgram => ({ name: 'end', layers: [{ kind: 'image', draw: 'panel', cx: 540, cy: 1100, w: 860, h: 520, at: { w: 'listens' }, p: { title } }] });
  assert.throws(() => k.compile(2, prog('Aurora logo'), { strict: true }), /stands in for a missing asset/);
  assert.doesNotThrow(() => k.compile(2, prog('Your list, written for you'), { strict: true }));
  assert.doesNotThrow(() => k.compile(2, prog('Aurora logo')), 'accepted scenes are never re-judged');
});
