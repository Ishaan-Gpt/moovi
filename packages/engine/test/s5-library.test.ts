import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { cast, detectNeeds, isNeed, libraryErrors, listItems, spokenNumber, sketch, tidy, type BeatIn } from '../src/styles/kit';
import { ARCS } from '../src/styles/kit/arcs';
import { S5_ARCS, S5_LIBRARY, S5_VOCAB } from '../src/s5/library';
import { ICON_NAMES } from '../src/s5/icons';
import { beatData, castFilm, rebind, splitBeats, type Word } from '../src/s5/plan';

const client = readFileSync(join(import.meta.dirname, '..', 'src', 's5', 'client.js'), 'utf8');

test('s5 library: clean, large, every set-up has a renderer', () => {
  assert.deepEqual(libraryErrors(S5_LIBRARY), []);
  assert.ok(S5_LIBRARY.length >= 45, `only ${S5_LIBRARY.length} set-ups`);
  for (const s of S5_LIBRARY) {
    assert.ok(new RegExp(`\\bP\\.${s.id.replace(/-/g, '\\-')}\\s*=`).test(client) || new RegExp(`P\\['${s.id}'\\]\\s*=`).test(client), `no renderer for ${s.id}`);
    for (const n of s.needs) assert.ok(isNeed(n), `${s.id}: unknown need ${n}`);
  }
  assert.ok(/P\.compose\s*=/.test(client), 'no composer');
  assert.ok(new Set(S5_LIBRARY.map(s => s.family)).size >= 15, 'too few families');
});

test('s5 arcs and vocabulary are real', () => {
  assert.ok(S5_ARCS.length >= 8);
  for (const a of S5_ARCS) assert.ok(ARCS.some(x => x.id === a), `unknown arc ${a}`);
  for (const ic of S5_VOCAB.icons) assert.ok(ICON_NAMES.includes(ic as never));
  for (const l of S5_VOCAB.layouts) assert.ok(client.includes(`case '${l}'`) || l === 'row', `composer lacks layout ${l}`);
});

const SCRIPT = [
  'Scheduling is the quiet tax on every team.', 'Every week, hours vanish into email threads.', 'Meet Cal.', 'Share one link.',
  'Your clients pick a time, add details, and confirm.', 'It syncs with Google, Outlook, and Zoom.', 'Over 12,000 teams use it.',
  'Your data stays private and secure.', 'Less back and forth. More time.',
];
const beatsOf = (lines: string[]): BeatIn[] => lines.map((text, i) => ({
  index: i, text, words: text.split(/\s+/).length, seconds: 2.4, needs: detectNeeds(text, { index: i, count: lines.length }),
  items: listItems(text).length, number: spokenNumber(text), role: i === 0 ? 'open' : i === lines.length - 1 ? 'close' : 'middle',
}));

test('s5 cast: never the same family back to back; opens and closes with the right set-ups; seeds differ', () => {
  const b = beatsOf(SCRIPT);
  const seen = new Set<string>();
  for (const seed of ['a', 'b', 'c', 'd']) {
    const c = castFilm(b, S5_LIBRARY, { seed });
    for (let i = 1; i < c.length; i++) if (c[i]!.setup && c[i - 1]!.setup) assert.notEqual(c[i]!.setup!.family, c[i - 1]!.setup!.family, `seed ${seed} beat ${i}`);
    assert.ok(['circle', 'underline', 'stamp'].includes(c.at(-1)!.setup?.id ?? ''), `close: ${c.at(-1)!.setup?.id}`);
    const ids = c.map(x => x.setup?.id ?? 'improvise');
    assert.equal(new Set(ids.filter(i => i !== 'improvise')).size, ids.filter(i => i !== 'improvise').length, 'a set-up twice in one film');
    seen.add(ids.join(','));
  }
  assert.ok(seen.size >= 2, 'four seeds cast one film');
  // the recent films' set-ups give way
  const first = cast(b, S5_LIBRARY, { seed: 'a', floor: 3 }).map(x => x.setup?.id).filter(Boolean) as string[];
  const next = cast(b, S5_LIBRARY, { seed: 'a', floor: 3, recent: first }).map(x => x.setup?.id);
  assert.ok(next.filter((id, i) => id === first[i]).length < first.length / 2, 'recent set-ups did not give way');
});

const words = (text: string, t0 = 0): Word[] => text.split(/\s+/).map((w, i) => ({ word: w, t: t0 + i * 0.32, end: t0 + i * 0.32 + 0.28 }));

test('s5 beats: phrase splits keep a spoken list whole; items land on their words', () => {
  const ws = words(SCRIPT.join(' '));
  const st = splitBeats(ws);
  assert.equal(st[0], 0);
  for (let i = 1; i < st.length; i++) assert.ok(st[i]! > st[i - 1]!);
  const list = ws.findIndex(w => w.word === 'pick');
  assert.ok(!st.some(s => s > list && s < list + 6), 'a list was cut');
  const d = beatData(words('Fast, private, and free.'));
  assert.deepEqual(d.items.map(i => i.text), ['Fast', 'private', 'free']);
  assert.ok(d.toks.filter(t => t.accent).length === 1);
});

test('s5 improvise: sketches and rebinds stay inside the vocabulary', () => {
  for (const t of ['Three tools become one.', 'Teams ship 3x faster.', 'Old way versus new way.']) {
    const ws = words(t), s = sketch({ text: t, words: ws, needs: detectNeeds(t) }, S5_VOCAB);
    assert.ok(S5_VOCAB.layouts.includes(s.layout));
    const r = rebind(s, words('Your data stays private and secure.'), 'Your data stays private and secure.');
    for (const e of r.elements) { assert.ok(S5_VOCAB.kinds.includes(e.kind)); if (e.icon) assert.ok(ICON_NAMES.includes(e.icon as never)); if (e.kind === 'number') assert.fail('a number on a line with no number'); }
    assert.ok(tidy(r, { text: 'x', words: words('Your data stays private and secure.'), needs: [] }, S5_VOCAB));
  }
});
