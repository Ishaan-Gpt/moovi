import assert from 'node:assert/strict';
import test from 'node:test';
import { agreement, align, pickText, textModels, wordKey } from '../src/edit/hear';

const W = (word: string, t: number, end: number) => ({ word, t, end });

test('hear: Devanagari words key with their vowel signs, the two-way spellings folded', () => {
  // `bare` dropped every vowel sign: these three were one key
  assert.notEqual(wordKey('है'), wordKey('हूँ'));
  assert.notEqual(wordKey('है'), wordKey('हैं'));
  // spelled two ways, said one way
  assert.equal(wordKey('हूँ'), wordKey('हूं'));
  assert.equal(wordKey('हिन्दी'), wordKey('हिंदी'));
  assert.equal(wordKey('ज़िला'), wordKey('जिला'));
  assert.equal(wordKey('यहाँ,'), wordKey('यहां'));
  // Latin keys as before
  assert.equal(wordKey('Moovi,'), 'moovi');
  assert.equal(wordKey("don't!"), "don't");
});

test('hear: Hindi text anchors on the right words', () => {
  // whisper-1 timed words (spellings differ), the accurate text: every accurate word lands on its own timed word
  const timed = [W('मैं', 0, 0.2), W('यहां', 0.2, 0.5), W('हूं', 0.5, 0.7), W('और', 0.9, 1.0), W('वो', 1.0, 1.2), W('है', 1.2, 1.4)];
  const out = align(timed, 'मैं यहाँ हूँ और वो है।');
  assert.deepEqual(out.map(w => w.word), ['मैं', 'यहाँ', 'हूँ', 'और', 'वो', 'है।']);
  assert.deepEqual(out.map(w => w.t), [0, 0.2, 0.5, 0.9, 1.0, 1.2]);
  assert.equal(agreement('मैं यहाँ हूँ और वो है।', timed), 6);
  // with the marks dropped, "हूं" and "है" were the same key and the text agreed with words it did not say
  assert.equal(agreement('है है है', [W('हूं', 0, 1), W('हैं', 1, 2), W('हो', 2, 3)]), 0);
});

test('hear: strict align keeps only the text (a subtitle truth), the default keeps a long timed-only run', () => {
  const timed = [W('a', 0, 0.1), W('b', 0.1, 0.2), W('x', 0.3, 0.4), W('y', 0.4, 0.5), W('z', 0.5, 0.6), W('c', 0.7, 0.8), W('d', 0.8, 0.9)];
  assert.deepEqual(align(timed, 'a b c d').map(w => w.word), ['a', 'b', 'x', 'y', 'z', 'c', 'd']);
  assert.deepEqual(align(timed, 'a b c d', { strict: true }).map(w => w.word), ['a', 'b', 'c', 'd']);
  // strict never answers with the timed words, even when the two hardly agree
  assert.deepEqual(align(timed, 'p q', { strict: true }).map(w => w.word), ['p', 'q']);
});

test('hear: ordered pick keeps the first good candidate, never a drifting one', () => {
  const timed = ['one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'].map((w, i) => W(w, i, i + 0.5));
  const first = 'one two three four five six seven eight nine tenth'; // agrees with 9
  const second = 'one two three four five six seven eight nine ten'; // agrees with 10
  const drift = 'uno dos tres one two'; // agrees with 2
  assert.equal(pickText([first, second], timed), second);
  assert.equal(pickText([first, second], timed, { ordered: true }), first);
  assert.equal(pickText([drift, second], timed, { ordered: true }), second);
  assert.equal(pickText([drift], timed, { ordered: true }), null);
});

test('hear: the accurate-text models per language', () => {
  const pin = process.env.MOOVI_TEXT_MODEL;
  delete process.env.MOOVI_TEXT_MODEL;
  try {
    assert.deepEqual(textModels('en'), ['gpt-4o-transcribe']);
    assert.deepEqual(textModels('hi'), ['gpt-4o-mini-transcribe', 'gpt-4o-transcribe']);
    process.env.MOOVI_TEXT_MODEL = 'gpt-4o-transcribe';
    assert.deepEqual(textModels('hi'), ['gpt-4o-transcribe']);
  } finally { if (pin === undefined) delete process.env.MOOVI_TEXT_MODEL; else process.env.MOOVI_TEXT_MODEL = pin; }
});
