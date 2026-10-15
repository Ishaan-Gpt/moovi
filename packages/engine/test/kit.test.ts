import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cast, fit, type BeatIn, type Setup } from '../src/styles/kit/library';
import { ARCS, chooseArc, signals } from '../src/styles/kit/arcs';
import { cleanLine, doctor } from '../src/styles/kit/script';
import { sketch, tidy, type Vocab } from '../src/styles/kit/compose';
import { detectNeeds, listItems } from '../src/styles/kit/needs';

const lib: Setup[] = [
  { id: 'dial', name: 'dial', about: 'a clock', needs: ['time', 'speed'], family: 'gauge' },
  { id: 'meter', name: 'meter', about: 'a gauge', needs: ['speed', 'time'], family: 'gauge' },
  { id: 'pills', name: 'pills', about: 'tags', needs: ['list', 'benefit'], family: 'list', items: [2, 5] },
  { id: 'counter', name: 'counter', about: 'ring', needs: ['number', 'growth'], family: 'number', number: 'required' },
  { id: 'words', name: 'words', about: 'type', needs: ['claim'], family: 'type', typeOnly: true },
];
const beat = (i: number, text: string, extra: Partial<BeatIn> = {}): BeatIn => ({ index: i, text, words: text.split(' ').length, seconds: 2.4, needs: detectNeeds(text), items: listItems(text).length, number: null, role: 'middle', ...extra });

test('needs: detector finds lists, time and numbers', () => {
  assert.ok(detectNeeds('Fast, private, and free.').includes('list'));
  assert.ok(detectNeeds('Ship in seconds').includes('time'));
  assert.deepEqual(listItems('Fast, private, and free.'), ['Fast', 'private', 'free']);
});

test('cast: serves needs, never repeats a family back to back, improvises below the floor', () => {
  const b = [beat(0, 'Every second counts'), beat(1, 'Every minute too'), beat(2, 'Fast, private, and free.'), beat(3, 'Zebra quantum lantern')];
  const c = cast(b, lib, { seed: 'x' });
  assert.equal(c[0]!.setup?.family, 'gauge');
  assert.notEqual(c[1]!.setup?.family, 'gauge');
  assert.equal(c[2]!.setup?.id, 'pills');
  assert.equal(c[3]!.setup, null);
  assert.ok(fit(lib[3]!, beat(0, 'no number')).score < 0);
});

test('cast: recent films push the same set-ups away', () => {
  const b = [beat(0, 'Every second counts')];
  assert.equal(cast(b, lib, { seed: 's', recent: ['dial'] })[0]!.setup?.id, 'meter');
});

test('arcs: a number-heavy site picks a number story; the last arc gives way', () => {
  const sig = signals('We serve 12,000 customers in 40 countries. 99.9% uptime. 3x faster. 10 million requests a day. 24 hours.');
  const all = ARCS.map(a => a.id);
  const a = chooseArc(all, sig, [], 'seed1');
  const b = chooseArc(all, sig, [a.id], 'seed1');
  assert.notEqual(a.id, b.id);
});

test('doctor: strips labels, hype, invented numbers; fills from facts; adds the brand', async () => {
  const arc = ARCS.find(a => a.id === 'pain-turn')!;
  assert.equal(cleanLine('1. HOOK: **Revolutionize your inbox!**', 'Acme'), 'Change your inbox.');
  // a number that opens a line is a fact, not numbering
  assert.equal(cleanLine('11.2 million voters showed up.', 'Acme'), '11.2 million voters showed up.');
  assert.equal(cleanLine('3) 40% less waste', 'Acme'), '40% less waste.');
  assert.equal(cleanLine('99.8% crash-free.', 'Acme'), '99.8% crash-free.');
  const { inventedNumbers } = await import('../src/styles/kit/script');
  assert.deepEqual(inventedNumbers('8% crash-free', 'A 99.8% crash-free rate'), ['8']);
  assert.deepEqual(inventedNumbers('99.8% crash-free, 12,000 teams', 'A 99.8% crash-free rate for 12,000 teams'), []);
  const d = doctor(['HOOK: Your inbox is a mess!', 'We save 95% of your time.', 'Seamless sync.'], { arc, name: 'Acme', host: 'acme.com', siteText: 'Acme sorts mail. It is fast.', facts: ['Acme sorts your mail by sender', 'It works with Gmail'] });
  assert.ok(!d.lines.some(l => l.includes('95')));
  assert.ok(d.lines.some(l => /Acme/.test(l)));
  assert.ok(d.lines.some(l => l.includes('acme.com')));
});

const V: Vocab = { layouts: ['hero', 'stack', 'split', 'path'], kinds: ['word', 'label', 'icon', 'number', 'arrow'], shapes: ['circle', 'hex'], motions: ['pop', 'rise', 'draw', 'count'], tones: ['accent', 'ink', 'muted'], icons: ['people', 'clock', 'bolt', 'check', 'chart'] };
const bw = (text: string) => ({ text, words: text.split(' ').map((word, i) => ({ word, t: i * 0.3, end: i * 0.3 + 0.25 })), needs: detectNeeds(text) });

test('compose: sketch makes a picture set-up for any line; tidy fixes enums and unspoken words', () => {
  for (const t of ['Fast, private, and free.', 'Ship in 30 seconds.', 'Old tools versus new ones.', 'Hello there.']) {
    const s = sketch(bw(t), V);
    assert.ok(s.elements.some(e => !['word', 'label'].includes(e.kind)), t);
  }
  const t = tidy({ layout: 'STACKED', elements: [{ kind: 'Icons', icon: 'clocks', word: 99, size: 'xl', tone: 'accent', motion: 'pop' } as never, { kind: 'word', text: 'second banana', word: 1, size: 'l', tone: 'ink', motion: 'rise' } as never] }, bw('Every second counts'), V);
  assert.equal(t?.layout, 'stack');
  assert.equal(t?.elements[0]!.icon, 'clock');
  assert.equal(t?.elements[0]!.word, 2);
});

test('mergeNeeds: a model that tags at random is ignored; a sensible one adds its tags', async () => {
  const { mergeNeeds } = await import('../src/styles/kit/needs');
  const lines = ['Every second counts.', 'Fast, private, and free.', 'Meet Acme.'];
  const junk = Array.from({ length: 50 }, (_, i) => ({ line: i, needs: ['nature'] }));
  assert.equal(mergeNeeds(lines, junk).trusted, false);
  const good = mergeNeeds(lines, [{ line: 0, needs: ['time', 'stakes'] }, { line: 1, needs: ['list', 'benefit'] }, { line: 2, needs: ['brand'] }]);
  assert.equal(good.trusted, true);
  assert.ok(good.needs[0]!.includes('stakes'));
});

test('doctor: a fact brought in for a number slot never repeats a line already said', async () => {
  const { doctor } = await import('../src/styles/kit/script');
  const { arcOf } = await import('../src/styles/kit/arcs');
  const d = doctor(['Raycast has a 99.8% crash-free rate.', 'Because Raycast is built for speed.', 'It means fewer restarts.', 'Raycast keeps you working.', 'Thousands of extensions.', 'Built to last.'],
    { arc: arcOf('one-number')!, name: 'Raycast', host: 'raycast.com', siteText: 'A 99.8% crash‑free rate. 37k Slack members. Thousands of extensions.', facts: ['Raycast has a 99.8% crash\u2011free rate.', 'The community includes 37k Slack members.'] });
  assert.equal(d.lines.filter(l => l.includes('99.8')).length, 1);
});
