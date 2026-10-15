import { test } from 'node:test';
import assert from 'node:assert/strict';
import { joinTokens } from '../src/tasks/film';

test('Whisper pieces join into the word they belong to', () => {
  const w = (word: string, t: number, end: number) => ({ word, t, end });
  const out = joinTokens([w('a', 0, 0.1), w('to', 0.2, 0.4), w('-do', 0.4, 0.55), w('list.', 0.6, 0.9), w('Visit', 1, 1.2), w('aurora', 1.25, 1.6), w('.example', 1.6, 2), w('don', 2.1, 2.3), w("'t", 2.3, 2.4)]);
  assert.deepEqual(out.map(x => x.word), ['a', 'to-do', 'list.', 'Visit', 'aurora.example', "don't"]);
  assert.equal(out[1]!.end, 0.55);
  // a pause is a new word, whatever it starts with
  assert.equal(joinTokens([w('well', 0, 0.3), w('-ish', 0.9, 1.1)]).length, 2);
});
