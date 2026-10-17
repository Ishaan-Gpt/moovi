import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BRAIN_CAPS, estimateTokens, fitLines, imageTokens, RUN_OVERHEAD, trimTranscript, VIDEO_CAP, VideoBudget, type Sentence } from '../src/runtime/budget';

const sentence = (i: number, n: number, word = 'transistor'): Sentence => ({ i, t0: i * 2.5, text: Array.from({ length: n }, (_, k) => `${word}${k}`).join(' ') });

test('budget 5: estimates run high, never low', () => {
  assert.equal(estimateTokens(''), 0);
  const en = 'The chip in your pocket has nineteen billion transistors, and each one switches billions of times a second.';
  assert.ok(estimateTokens(en) >= Math.ceil(en.length / 4), 'at least chars/4 for English');
  const hi = 'यह चिप आपकी जेब में है और इसमें उन्नीस अरब ट्रांजिस्टर हैं';
  assert.ok(estimateTokens(hi) > estimateTokens(hi.replace(/[^\x00-\x7f]/g, 'a')), 'non-Latin counts denser');
  assert.equal(imageTokens(256, 455), Math.ceil((256 * 455) / 750));
  assert.equal(imageTokens(4000, 4000), imageTokens(1568, 1568), 'resized like Claude does');
});

test('budget 5: a short transcript goes out whole', () => {
  const ss = [sentence(0, 8), sentence(1, 12), sentence(2, 5)];
  const r = trimTranscript(ss, BRAIN_CAPS.edit.in, 800);
  assert.ok(r.fits); assert.equal(r.perSentence, null);
  assert.equal(r.lines.split('\n').length, 3);
  assert.ok(r.lines.startsWith('0 [0.0s] transistor0'));
});

test('budget 5: a long transcript is trimmed under the cap and keeps every sentence number', () => {
  const ss = Array.from({ length: 220 }, (_, i) => sentence(i, 40));
  const fixed = 1500;
  const r = trimTranscript(ss, BRAIN_CAPS.edit.in, fixed);
  assert.ok(r.fits, `tokens ${r.tokens}`);
  assert.ok(r.tokens <= BRAIN_CAPS.edit.in);
  assert.ok(r.perSentence !== null && r.perSentence <= 12);
  const nums = r.lines.split('\n').map(l => +l.split(' ')[0]!);
  assert.deepEqual(nums, ss.map(s => s.i), 'every sentence still numbered, in order');
  // the 30-word rule alone: no line carries more than 30 words before trimming harder
  const mid = trimTranscript(Array.from({ length: 10 }, (_, i) => sentence(i, 50)), BRAIN_CAPS.edit.in);
  assert.ok(mid.lines.split('\n').every(l => l.split(' ').length <= 2 + 30 + 1));
});

test('budget 5: a transcript that cannot fit says so instead of going out raw', () => {
  const ss = Array.from({ length: 3000 }, (_, i) => sentence(i, 20));
  const r = trimTranscript(ss, BRAIN_CAPS.edit.in, 1000);
  assert.equal(r.fits, false); assert.equal(r.perSentence, 3);
});

test('budget 5: lines are kept in order until the cap', () => {
  const r = fitLines(Array.from({ length: 100 }, (_, i) => `${i}: shot at ${i}s, one face, medium`), 200);
  assert.ok(r.tokens <= 200 && r.kept.length > 0 && r.dropped > 0);
  assert.ok(r.kept[0]!.startsWith('0:'));
});

test('budget 5: the video ledger refuses a step over its own cap or the video cap', () => {
  const b = new VideoBudget();
  assert.equal(b.usedIn, RUN_OVERHEAD);
  assert.equal(b.allow('edit', BRAIN_CAPS.edit.in + 1).ok, false);
  const a = b.allow('edit', 5500); assert.ok(a.ok && a.maxOut === BRAIN_CAPS.edit.out);
  b.spend('edit', 5500, 'x'.repeat(1800));
  const look = b.allow('look', 2000); assert.ok(look.ok);
  b.spend('look', 2000, '{"ship":true,"fixes":[]}');
  const film = b.allow('film', 2000);
  assert.ok(!film.ok && film.why.includes(`cap is ${VIDEO_CAP.in}`), JSON.stringify(film));
  assert.ok(b.left.in < 2000);
  const big = new VideoBudget(); const s = big.spend('look', 100, 'y'.repeat(2000));
  assert.equal(s.overOut, true, 'an answer over its output cap is flagged');
});

// Item 27: texts the provider's count_tokens counted on 2026-10-17 (message wrapper removed). The estimate must never
// come in under them; the old 3.6 / 1.5 did on every one of these.
const ESTIMATE_SAMPLES: { name: string; text: string; counted: number }[] = [
  { name: 'a direct:edit answer (JSON)', counted: 119, text: '{"style":"atlas","why":"a creator intro with two numbers: static looks and number cards carry it","cleanup":"balanced","hook":1,"beats":[{"i":0,"tag":"aside"},{"i":1,"tag":"hook"},{"i":2,"tag":"number"},{"i":3,"tag":"cta"}],"moves":[{"i":1,"id":"05"}],"cards":[{"i":2,"kind":"stat","words":"19 billion transistors"}],"title":"The chip in your pocket","model":"example"}' },
  { name: 'a direct:edit answer schema (JSON Schema, first 600 chars)', counted: 186, text: '{"$schema": "https://json-schema.org/draft/2020-12/schema", "type": "object", "properties": {"style": {"type": "string", "enum": ["base", "atlas", "handmade", "studio-minimal", "studio-cut"], "description": "the edit look, from the looks menu"}, "why": {"type": "string", "minLength": 1, "maxLength": 160, "description": "one short line: why this look fits this clip"}, "cleanup": {"type": "string", "enum": ["light", "balanced", "tight"], "description": "how hard pauses are cut: light keeps breathing room, tight is snappy"}, "hook": {"type": "integer", "minimum": 0, "maximum": 9007199254740991, "' },
  { name: 'numbered sentence lines (the transcript a step carries)', counted: 195, text: '0 [0.0s] Most people think a phone camera is just a tiny lens.\n1 [3.9s] It is not.\n2 [5.3s] Inside there are three cameras, a chip that takes nine photos before you even press the button, and software that picks the best parts of each one.\n3 [14.3s] That is why night mode works.\n4 [16.6s] The phone is guessing what the dark should look like, and it guesses really well.\n5 [21.8s] Apple says the chip does about thirty five trillion operations every second.\n6 [26.1s] So next time you take a photo, remember you are not taking one photo.\n7 [31.0s] You are taking nine.\n8 [32.6s] Follow for more tech explained in thirty seconds.' },
  { name: 'Hinglish', counted: 41, text: 'Main aaj aapko bataunga ki yeh phone itna tez kyun hai. Isme ek naya chip hai jo har second laakhon kaam karta hai.' },
  { name: 'Hindi', counted: 66, text: 'मैं आज आपको बताऊंगा कि यह फोन इतना तेज़ क्यों है। इसमें एक नया चिप है जो हर सेकंड लाखों काम करता है।' },
];
test('budget 27: the estimate is at or above the provider\'s own count on measured samples', () => {
  for (const s of ESTIMATE_SAMPLES) assert.ok(estimateTokens(s.text) >= s.counted, `${s.name}: estimated ${estimateTokens(s.text)}, counted ${s.counted}`);
});
