import { test } from 'node:test';
import assert from 'node:assert/strict';
import { features, match, seconds } from '../src/match';

const m = (text: string, uploads: Parameters<typeof features>[1] = [], ratio?: Parameters<typeof features>[2]) => match(features(text, uploads, ratio));

test('seconds from the brief', () => {
  assert.equal(seconds('a 30 second reel'), 30);
  assert.equal(seconds('make it 45s'), 45);
  assert.equal(seconds('about 2 minutes long'), 120);
  assert.equal(seconds('half a minute'), 30);
  assert.equal(seconds('a thirty-second promo'), 30);
  assert.equal(seconds('no length here'), null);
});

test('a product explainer reel matches Style 1', () => {
  const r = m('Make a 30 second reel explaining our app that turns voice notes into to-do lists');
  assert.equal(r.style, 's1');
  assert.ok(r.score >= 0.55, `score ${r.score}`);
});

test('a short launch promo for a website matches Style 1', () => {
  assert.equal(m('promo for our new feature launch, vertical, 25s, link: notely.app').style, 's1');
});

test('a cinematic 3D launch film is unique, nearest Style 3', () => {
  const r = m('A cinematic 3D launch film about the feeling of calm our headphones give, 16:9');
  assert.equal(r.style, 'unique');
  assert.equal(r.nearest, 's3');
});

test('landscape asks are not Style 1', () => {
  assert.equal(m('a youtube video explaining our product, 16:9, 40 seconds').style, 'unique');
});

test('Hinglish is not Style 1 (it is voiced in English)', () => {
  const r = m('ek reel banao jo batata hai ki ye app kaise kaam karta hai aur kyu chahiye');
  assert.equal(r.features.language, 'hinglish');
  assert.equal(r.style, 'unique');
});

test('a talking head with "add captions" is footage to edit → unique (nearest e1)', () => {
  const r = m('add captions and make this a premium reel', [{ id: 'u1', name: 'me.mp4', mime: 'video/mp4', duration: 48, width: 1080, height: 1920, hasAudio: true, speechRate: 2.6, faceRatio: 0.9, cutRate: 0.05 }]);
  assert.equal(r.features.footage, 'edit');
  assert.equal(r.style, 'unique');
  assert.equal(r.nearest, 'e1');
  assert.equal(r.features.format, 'vertical');
});

test('"make one like this" with an edited clip is a reference', () => {
  const r = m('make one like this for my bakery', [{ id: 'u2', name: 'ref.mp4', mime: 'video/mp4', duration: 22, hasAudio: true, speechRate: 0.3, faceRatio: 0.1, cutRate: 0.9 }]);
  assert.equal(r.features.footage, 'reference');
  assert.equal(r.style, 'unique');
});

test('a clip with no signal either way is asked about', () => {
  const r = m('make something great', [{ id: 'u3', name: 'x.mp4', mime: 'video/mp4', duration: 20, hasAudio: true, speechRate: 1.0, faceRatio: 0.2, cutRate: 0.3 }]);
  assert.equal(r.ask, 'footage-or-reference');
});

test('a brief with no intent asks a model for one', () => {
  const r = m('something for my bakery');
  assert.equal(r.needsIntent, true);
});

test('the UI ratio wins over the words', () => {
  assert.equal(features('a reel', [], '16:9').format, 'landscape');
});

test('naming the upload ("the clip") is not asking for an edit', () => {
  const ref = { id: 'u4', name: 'reel.mp4', mime: 'video/mp4', duration: 40, width: 720, height: 1280, hasAudio: true, speechRate: 2.1, faceRatio: 0.05, cutRate: 0.7 };
  const r = m('Make one like this for Quill: a 20-second reel. Same pacing and feel as the clip.', [ref]);
  assert.equal(r.features.footage, 'reference');
  assert.equal(r.ask, null);
  assert.equal(m('Same feel as this, but for my café', [ref]).features.footage, 'reference');
  // an edit still needs its verb
  assert.equal(m('cut this down to 30 seconds and add captions', [{ ...ref, faceRatio: 0.9, cutRate: 0.05 }]).features.footage, 'edit');
});

test('links in a brief are found, the made-up ones too (they are checked later)', () => {
  assert.deepEqual(features('A promo for Quill (quill.example) and our blog at blog.ember.cafe.', []).urls, ['quill.example', 'blog.ember.cafe']);
  assert.deepEqual(features('see https://notion.so/product, then v1.mp4 and e.g. this', []).urls, ['https://notion.so/product']);
});
