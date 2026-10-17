import { test } from 'node:test';
import assert from 'node:assert/strict';
import { takeWindow } from '../src/edit/cut';
import { VOICE_CHAIN } from '../src/edit/voice';
import { devanagariShare } from '../src/edit/romanize';

// the opening of a finished avatar reel (Hinglish, heard in Devanagari): a full sentence, then a 1 s pause
const W = (word: string, t: number, end: number) => ({ word, t, end });
const words = [W('पहले', 0.38, 0.76), W('ads', 0.76, 1.08), W('mainly', 1.08, 1.46), W('interest', 1.46, 1.88), W('targeting', 1.88, 2.32), W('पे', 2.32, 2.6), W('चलते', 2.6, 2.9), W('थे.', 2.9, 3.2), W('पर', 4.08, 4.24), W('अब', 4.24, 4.52)];

test('take window: a finished sentence before an opening pause is the hook, not set-up talk', () => {
  const tw = takeWindow(words, [[0, 0.44], [3.14, 4.16]], 36.8);
  assert.ok(tw.a < 0.4, `the take must start on the first sentence, got ${tw.a}`);
});

test('take window: short chatter before a long opening pause is still cut', () => {
  const chat = [W('okay', 0.2, 0.5), W('ready', 0.6, 0.9), W('So', 2.4, 2.6), W('today', 2.6, 2.9), W('we', 2.9, 3.0), W('talk', 3.0, 3.3)];
  const tw = takeWindow(chat, [[0.95, 2.35]], 30);
  assert.ok(tw.a > 2.2, `set-up talk should be cut, got ${tw.a}`);
});

test('voice chain: a Windows model path is quoted with forward slashes and an escaped drive colon', () => {
  const c = VOICE_CHAIN('C:\\Users\\me\\.cache\\moovi\\rnn-sh.rnnn');
  assert.ok(c.includes("arnndn=m='C\\:/Users/me/.cache/moovi/rnn-sh.rnnn':mix=1"), c);
});

test('romanize: switches on for Hinglish heard in Devanagari', () => {
  assert.ok(devanagariShare(words) > 0.4);
  assert.equal(devanagariShare([W('hello', 0, 1), W('world', 1, 2)]), 0);
});
