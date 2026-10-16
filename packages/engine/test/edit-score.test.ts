import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { config } from '../src/config';
import { buildEdl } from '../src/edit/build';
import { relock } from '../src/edit/hear';
import { cutOnWord, norm, pausesLeft, scriptCheck, slateKept, stable, wer, wordsRight, zones, type Truth } from '../src/edit/score';

const W = (word: string, t: number, end: number) => ({ word, t, end });
const palette = { ink: '#000', paper: '#fff', accent: '#f00', accent2: '#0f0', deep: '#000', pop: '#fff' };
const source = { file: 'src.mp4', duration: 8, w: 1080, h: 1920, fps: 30 };
const take = [W('Take', 0.2, 0.5), W('one', 0.55, 0.8), W('start.', 1.0, 1.4), W('Moovi', 3.0, 3.4), W('edits', 3.45, 3.8), W('your', 3.85, 4.0), W('clip.', 4.05, 4.5),
  W('It', 5.6, 5.7), W('cuts', 5.75, 6.0), W('every', 6.05, 6.3), W('pause.', 6.35, 6.9)];
const truthOf = (ws: typeof take): Truth => ({ id: 'T', lang: 'en', source: 'test', checked_by: 'test', checked_at: '2026-10-16', words: ws.map(w => ({ t0: w.t, t1: w.end, text: w.word })) });

test('score: WER, normalising (Devanagari marks kept), words right against truth', () => {
  assert.equal(wer(['a', 'b', 'c'], ['a', 'b', 'c']), 0);
  assert.equal(wer(['a', 'b', 'c', 'd'], ['a', 'x', 'c']), 0.5);
  assert.equal(norm('Clip.'), 'clip');
  assert.equal(norm('नमस्ते,'), 'नमस्ते');
  const e = buildEdl({ source, words: take, palette });
  assert.equal(wordsRight(e, truthOf(take)), 1);
  assert.ok(wordsRight(e, truthOf([...take.slice(0, 5), W('videos', 4.05, 4.5), ...take.slice(7)])) < 1);
});

test('score: pauses left, the slate, cut on word, script', () => {
  const e = buildEdl({ source, words: take, palette });
  const p = pausesLeft(e, 0.4, truthOf(take));
  assert.equal(p.left, 0, JSON.stringify(p));
  assert.ok(p.max <= 0.45);
  assert.ok((p.trimmed ?? 0) >= 1, 'the 1.1 s pause after "clip." is trimmed');
  assert.equal(slateKept(e, truthOf(take)).kept, 0, 'the slate ("Take one start") is not kept');
  const c = cutOnWord(e, truthOf(take).words);
  assert.equal(c.insideWord, 0); assert.equal(c.pct, 100, JSON.stringify(c));
  assert.deepEqual(scriptCheck(e, 'en'), { pct: 100, arabic: false });
});

test('score: caption zones and determinism helpers', () => {
  const z = zones([{ t: 0, cap: { x: 0.1, y: 0.6, w: 0.8, h: 0.08 }, face: { x: 0.3, y: 0.2, w: 0.3, h: 0.2 } }, { t: 0.2, cap: { x: 0.1, y: 0.3, w: 0.8, h: 0.08 }, face: { x: 0.3, y: 0.2, w: 0.3, h: 0.2 } }, { t: 0.4, cap: { x: 0.1, y: 0.9, w: 0.8, h: 0.06 }, face: null }, { t: 0.6, cap: null, face: null }]);
  assert.deepEqual(z, { capFrames: 3, offFacePct: 66.7, onFace: 1, platform: 1 });
  assert.equal(stable({ b: 1, a: [{ d: 2, c: 1 }] }), stable({ a: [{ c: 1, d: 2 }], b: 1 }));
  assert.equal(stable(buildEdl({ source, words: take, palette })), stable(buildEdl({ source, words: take, palette })));
});

test('hear relock: the default English lock gives way to Hindi heard in Devanagari, never to Urdu', () => {
  const en = [W('my', 0, 0.2), W('name', 0.2, 0.5), W('is', 0.5, 0.6), W('Krishna', 0.6, 1)];
  const hi = [W('मेरा', 0, 0.3), W('नाम', 0.3, 0.6), W('कृष्ण', 0.6, 1)];
  assert.equal(relock('hindi', hi, en), 'hi');
  assert.equal(relock('urdu', [W('میرا', 0, 0.3), W('نام', 0.3, 0.6)], en), null);
  assert.equal(relock('english', en, en), null);
  // unlocked Whisper drifts from Devanagari into Urdu script piece by piece (R9's B4): still Hindi
  assert.equal(relock('hindi', [...hi, W('میرا', 2, 2.3), W('دوست', 2.3, 2.6), W('شکریہ', 2.6, 3)], en), 'hi', 'Hindi drifting into Urdu script');
  assert.equal(relock('hindi', [W('میرا', 0, 0.3), W('نام', 0.3, 0.6)], en), null, 'no Devanagari at all: not relocked to Hindi');
  assert.equal(relock('hindi', [W('my', 0, 0.2), W('name', 0.2, 0.5)], en), null, 'Hindi named but Latin letters');
  assert.equal(relock('hindi', hi.slice(0, 1), [...en, ...en]), null, 'far fewer words than the English pass');
});
