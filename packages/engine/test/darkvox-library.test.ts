import { test } from 'node:test';
import assert from 'node:assert/strict';
import { libraryErrors } from '../src/styles/kit/library';
import { DV_SETUPS, VOCAB } from '../src/darkvox/library';
import { SETUPS, composeSpec, stageSource } from '../src/darkvox/stage';
import { PROP_NAMES, propFor, propNamed } from '../src/darkvox/props';
import { castFilm, fallbackLines, lineOf } from '../src/darkvox/film';
import { sketch } from '../src/styles/kit/compose';
import { detectNeeds } from '../src/styles/kit/needs';
import type { Piece } from '../src/s4/compose';

test('darkvox library: >= 40 set-ups, no library errors, every id has a renderer', () => {
  assert.ok(DV_SETUPS.length >= 40, `only ${DV_SETUPS.length} set-ups`);
  assert.deepEqual(libraryErrors(DV_SETUPS), []);
  for (const s of DV_SETUPS) {
    assert.equal(typeof SETUPS[s.id], 'function', `${s.id} has no renderer`);
    assert.ok(s.sets.length >= 1, `${s.id} has no sets`);
  }
  for (const id of Object.keys(SETUPS)) assert.ok(DV_SETUPS.some(s => s.id === id), `renderer ${id} is not in the library`);
  assert.ok(new Set(DV_SETUPS.map(s => s.family)).size >= 25, 'families too few for variety');
});

test('darkvox vocab: the composer knows every layout; props are code-drawn and named', () => {
  assert.equal(typeof composeSpec, 'function');
  assert.ok(PROP_NAMES.length >= 40);
  assert.deepEqual(VOCAB.icons, PROP_NAMES);
  for (const l of VOCAB.layouts) assert.ok(new RegExp(`["']${l}["']`).test(composeSpec.toString()), `layout ${l} not staged`);
  assert.equal(propNamed('a brass pocket watch'), 'clock');
  assert.ok(PROP_NAMES.includes(propFor('Book a meeting in seconds')));
  assert.ok(!PROP_NAMES.some(p => /bulb|padlock|trophy|rocket|gear|key/.test(p)), 'no stock symbols');
  const src = stageSource();
  assert.ok(src.length > 20_000 && !src.includes('</script>'));
});

const words = (lines: string[]) => { let t = 0.1; return lines.map(l => { const ws = l.split(' ').map(w => { const x = { word: w, t: +t.toFixed(2), end: +(t + 0.3).toFixed(2) }; t += 0.38; return x; }); t += 0.3; return { text: l, words: ws } as Piece; }); };
const SCRIPT = [
  'Once, every meeting began with a long letter.',
  'Days went missing in the back and forth.',
  'Then Cal arrived with one open door.',
  'Calendars, payments, and reminders, in one place.',
  'Over 40,000 teams now book in seconds.',
  'Before, the night was loud. Now it is quiet.',
  'Time comes back to the ones who keep it.',
];

test('darkvox cast: a sample script never puts one family back to back, never repeats a set-up, and differs by seed', () => {
  const ps = words(SCRIPT), end = ps.at(-1)!.words.at(-1)!.end + 0.3;
  const a = castFilm({ ps, lines: SCRIPT, plans: fallbackLines(SCRIPT), lib: DV_SETUPS, seed: 'film-a', recent: [], end });
  const fam = (id: string) => DV_SETUPS.find(s => s.id === id)?.family ?? id;
  for (let i = 1; i < a.plan.length; i++) {
    if (a.plan[i]!.setup === 'improvised' || a.plan[i - 1]!.setup === 'improvised') continue;
    assert.notEqual(fam(a.plan[i]!.setup), fam(a.plan[i - 1]!.setup), `family repeats at ${i}`);
    assert.notEqual(a.plan[i]!.set, a.plan[i - 1]!.set, `set repeats at ${i}`);
  }
  const ids = a.plan.map(p => p.setup).filter(x => x !== 'improvised');
  assert.equal(new Set(ids).size, ids.length, 'a set-up appears twice');
  const props = a.plan.flatMap(p => p.props);
  assert.equal(new Set(props).size, props.length, 'a prop appears twice');
  assert.ok(a.plan.some(p => p.setup === 'number-odometer' || p.setup === 'number-giant' || p.setup === 'coin-stack' || p.setup === 'headline'), 'the number line gets a number set-up');
  // the next film, cast away from this one
  const b = castFilm({ ps, lines: SCRIPT, plans: fallbackLines(SCRIPT), lib: DV_SETUPS, seed: 'film-b', recent: ids, end });
  const same = b.plan.filter((p, i) => p.setup === a.plan[i]!.setup).length;
  assert.ok(same <= 2, `the second film repeats ${same} set-ups in place`);
});

test('darkvox: pieces map to their lines; a sketch can be staged by the composer vocabulary', () => {
  const ps = words(SCRIPT);
  assert.deepEqual(lineOf(ps, SCRIPT), SCRIPT.map((_, i) => i));
  const sp = sketch({ text: SCRIPT[3]!, words: ps[3]!.words, needs: detectNeeds(SCRIPT[3]!) }, VOCAB);
  assert.ok(VOCAB.layouts.includes(sp.layout));
});
