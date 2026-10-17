import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { lintPlan, readPlan } from '../src/review/plan';

/** A film folder with this film.json (and script.txt when given). */
const film = (json: object, script?: string) => {
  const dir = mkdtempSync(join(tmpdir(), 'moovi-review-'));
  writeFileSync(join(dir, 'film.json'), JSON.stringify(json));
  if (script !== undefined) writeFileSync(join(dir, 'script.txt'), script);
  return dir;
};
const toks = (s: string, t0: number) => s.split(' ').map((text, i) => ({ text, t: t0 + i * 0.3 }));
const codes = (dir: string, captions = true) => lintPlan(readPlan(dir), { captions }).map(i => i.code).sort();

test('reads every style\'s beat list: beats, shots, and Anatomy\'s secs', () => {
  assert.equal(readPlan(film({ duration: 6, beats: [{ setup: 'hero', t0: 0, t1: 2 }, { setup: 'pile', t0: 2, t1: 6 }] })).beats.length, 2);
  assert.equal(readPlan(film({ duration: 6, shots: [{ setup: 'curtain', t0: 0, t1: 3 }, { setup: 'map', t0: 3, t1: 6 }] })).beats[1]!.setup, 'map');
  // Anatomy: the set-ups are in secs, the word timings in beats
  const an = readPlan(film({ duration: 6, secs: [{ setup: 'hub', t0: 0, t1: 3 }, { setup: 'rack', t0: 3, t1: 6 }], beats: [{ t0: 0, t1: 6, toks: toks('a graph that learns', 0.2) }] }));
  assert.deepEqual(an.beats.map(b => b.setup), ['hub', 'rack']);
  assert.deepEqual(an.beats[0]!.words, ['a', 'graph', 'that', 'learns']);
});

test('a clean beat map has nothing to say', () => {
  const dir = film({ duration: 12, beats: [{ setup: 'hero', t0: 0, t1: 2.4 }, { setup: 'pile', t0: 2.4, t1: 6 }, { setup: 'stamp', t0: 6, t1: 10 }], end: { t0: 10 } });
  assert.deepEqual(codes(dir), []);
});

test('a dead beat, a late hook and a repeated set-up are found; the end card may hold', () => {
  const dir = film({ duration: 30, beats: [{ setup: 'hero', t0: 0, t1: 5 }, { setup: 'hero', t0: 5, t1: 12 }, { setup: 'end', t0: 22, t1: 30 }], end: { t0: 22 } });
  assert.deepEqual(codes(dir), ['dead-beat', 'late-hook', 'repeat-setup']);
});

test('an end card outside 8-30 % of the film is a lead', () => {
  const dir = film({ duration: 10, beats: [{ setup: 'a', t0: 0, t1: 2 }, { setup: 'b', t0: 2, t1: 5 }], end: { t0: 5 } });
  assert.deepEqual(codes(dir), ['end-card']);
});

test('captions must carry the script only for word-captioned styles', () => {
  const dir = film({ duration: 6, beats: [{ setup: 'a', t0: 0, t1: 3, toks: toks('Stop wasting time', 0) }, { setup: 'b', t0: 3, t1: 6, toks: toks('ship it', 3) }] },
    'Stop wasting time switching apps.\nShip it today with one shortcut.');
  assert.deepEqual(codes(dir), ['caption-gap']);
  assert.deepEqual(codes(dir, false), []);
  const ok = film({ duration: 6, beats: [{ setup: 'a', t0: 0, t1: 3, toks: toks('Stop wasting time switching apps', 0) }, { setup: 'b', t0: 3, t1: 6, toks: toks('Ship it today with one shortcut', 3) }] },
    'Stop wasting time switching apps.\nShip it today with one shortcut.');
  assert.deepEqual(codes(ok), []);
});
