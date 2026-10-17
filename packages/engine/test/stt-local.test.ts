import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createServer } from 'node:http';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { chunksToWords, cleanWords, localWords, sttMode } from '../src/audio/local-stt';
import { isProviderRefusal, NEEDS_SPEECH_KEY, plainSpeechError, speechAvailable } from '../src/audio/stt';
import { config } from '../src/config';
import { hear } from '../src/edit/hear';
import { planEdit } from '../src/edit/job';
import { NO_WORDS } from '../src/router/edit';

const FIXTURE = join(import.meta.dirname, 'fixtures', 'speech-en.wav'); // espeak-ng: "Hello, this is Moovi. I edit your clip and caption every word." (5.1 s)
const KEYS = ['GROQ_API_KEY', 'OPENAI_API_KEY', 'MOOVI_STT', 'MOOVI_GROQ_BASE'] as const;
/** run with these env values (undefined = unset), restored after */
async function withEnv<T>(v: Partial<Record<(typeof KEYS)[number], string | undefined>>, fn: () => Promise<T> | T): Promise<T> {
  const was = Object.fromEntries(KEYS.map(k => [k, process.env[k]]));
  for (const k of KEYS) { const x = k in v ? v[k] : undefined; if (x === undefined) delete process.env[k]; else process.env[k] = x; }
  try { return await fn(); } finally { for (const k of KEYS) { if (was[k] === undefined) delete process.env[k]; else process.env[k] = was[k]; } }
}

test('stt: MOOVI_STT reads auto, local or off', () => {
  assert.equal(sttMode(undefined), 'auto');
  assert.equal(sttMode(' LOCAL '), 'local');
  assert.equal(sttMode('off'), 'off');
  assert.equal(sttMode('groq'), 'auto');
});

test('stt: no key hears locally; MOOVI_STT=off with no key hears nothing; a key wins unless local is forced', () => withEnv({}, async () => {
  assert.equal(speechAvailable(), 'local');
  process.env.MOOVI_STT = 'off'; assert.equal(speechAvailable(), null);
  process.env.GROQ_API_KEY = 'gsk_test'; assert.equal(speechAvailable(), 'groq');
  process.env.MOOVI_STT = 'local'; assert.equal(speechAvailable(), 'local');
}));

test('stt: transformers.js word chunks become timed words (open end takes the next start)', () => {
  const ws = chunksToWords([{ text: ' Hello,', timestamp: [0.38, 0.68] }, { text: ' ', timestamp: [0.7, 0.7] }, { text: ' this', timestamp: [0.9, null] }, { text: ' is', timestamp: [1.06, 1.42] }], 10);
  assert.deepEqual(ws, [{ word: 'Hello,', t: 10.38, end: 10.68 }, { word: 'this', t: 10.9, end: 11.06 }, { word: 'is', t: 11.06, end: 11.42 }]);
  // a piece with no leading space is the rest of the word before it
  assert.deepEqual(chunksToWords([{ text: ' labor', timestamp: [1, 1.3] }, { text: '-gassing', timestamp: [1.3, 1.7] }, { text: ' and', timestamp: [1.8, 1.9] }]).map(w => [w.word, w.end]), [['labor-gassing', 1.7], ['and', 1.9]]);
});

test('stt: a Whisper loop on a slate is cut to at most two, in time order, inside the clip, never zero length', () => {
  const loop = Array.from({ length: 110 }, (_, i) => ({ word: 'Start!', t: 7.2 + i * 0.2, end: 7.2 + i * 0.2 }));
  const ws = cleanWords([{ word: 'Take', t: 1, end: 1.3 }, { word: 'one.', t: 1.3, end: 1.6 }, ...loop, { word: 'Start!', t: 7.3, end: 7.3 }, { word: 'Hello', t: 30.1, end: 30.4 }, { word: 'late', t: 40, end: 40.2 }], 31);
  assert.deepEqual(ws.map(w => w.word), ['Take', 'one.', 'Start!', 'Start!', 'Hello']);
  assert.ok(ws.every(w => (w.end ?? 0) - w.t >= 0.04));
  assert.deepEqual(cleanWords([{ word: 'very', t: 1, end: 1.2 }, { word: 'very', t: 1.2, end: 1.4 }, { word: 'good', t: 1.4, end: 1.6 }]).length, 3);
  assert.deepEqual(cleanWords([{ word: 'go', t: 1, end: 1.2 }, { word: 'go', t: 1.01, end: 1.2 }]).length, 1);
  assert.deepEqual(cleanWords([{ word: 'Start!', t: 7.18, end: 7.22 }, { word: 'Start!', t: 7.24, end: 7.28 }, { word: 'Hello', t: 8.6, end: 8.8 }]).map(w => w.word), ['Start!', 'Hello']);
});

test('stt: a provider refusal is told apart from our own abort, and said plainly', () => {
  assert.ok(isProviderRefusal(new Error('groq speech-to-text answered 402: {"error":{"message":"billing"}}')));
  assert.ok(isProviderRefusal(new TypeError('fetch failed')));
  assert.ok(!isProviderRefusal(Object.assign(new Error('This operation was aborted'), { name: 'AbortError' })));
  assert.match(plainSpeechError(new Error('groq speech-to-text answered 400: {"error":{"message":"Organization has billing issues"}}')), /^Moovi could not hear your clip: Groq refused it \(billing or quota/);
  assert.match(plainSpeechError(new Error('openai speech-to-text answered 401: bad key')), /OpenAI refused the key/);
  assert.equal(plainSpeechError(new Error(NEEDS_SPEECH_KEY)), NEEDS_SPEECH_KEY);
  assert.match(plainSpeechError(new Error('Could not locate file')), /local speech model failed .*Groq key/);
  for (const k of ['groq speech-to-text answered 402: x', 'Could not locate file x'.repeat(20)]) assert.ok(plainSpeechError(new Error(k)).length <= 220, 'fits the 220 characters the studio chat and Claude Code show');
  assert.doesNotMatch(NEEDS_SPEECH_KEY + plainSpeechError(new Error('x')), /[\u2013\u2014]/);
});

test('edit: a brief that says there are no words lets the edit go ahead without hearing', () => {
  for (const b of ['music only, cut to the beat', 'no captions please', 'b-roll montage']) assert.ok(NO_WORDS.test(b), b);
  for (const b of ['Edit my clip into a clean short with captions', 'make it punchy']) assert.ok(!NO_WORDS.test(b), b);
});

test('edit: a talking clip with nothing to hear it stops with the plain reason, before any no-words edit', () => withEnv({ MOOVI_STT: 'off' }, async () => {
  const dir = mkdtempSync(join(tmpdir(), 'moovi-stt-'));
  try {
    const clip = join(dir, 'talk.mp4');
    execFileSync(config.ffmpeg, ['-v', 'error', '-y', '-f', 'lavfi', '-i', 'color=c=gray:s=320x568:d=2', '-i', FIXTURE, '-t', '2', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-shortest', clip]);
    await assert.rejects(planEdit({ path: clip, dir: join(dir, 'edit'), requireWords: true, brief: 'Edit my clip into a clean short with captions' }), { message: NEEDS_SPEECH_KEY });
    await assert.rejects(hear(clip, dir), { message: NEEDS_SPEECH_KEY });
  } finally { rmSync(dir, { recursive: true, force: true }); }
}));

// The real model: downloads about 760 MB once into data/models (MOOVI_MODEL_CACHE). Skipped when it cannot download
// (no network in CI) or with MOOVI_STT_LOCAL_TEST=off.
const offline = (e: unknown) => /fetch|network|ENOTFOUND|ECONN|EAI_AGAIN|timed? ?out|Could not locate|Unauthorized|\b40[13]\b|\b5\d\d\b/i.test(String((e as Error)?.message ?? e));
test('stt: the local model hears the fixture with word timings, no key needed', { timeout: 600_000, skip: process.env.MOOVI_STT_LOCAL_TEST === 'off' && 'MOOVI_STT_LOCAL_TEST=off' }, async t => withEnv({}, async () => {
  let r: Awaited<ReturnType<typeof localWords>>;
  try { r = await localWords(FIXTURE, { lang: 'en' }); } catch (e) { if (offline(e)) return t.skip(`the speech model could not download: ${String(e).slice(0, 100)}`); throw e; }
  const keys = r.words.map(w => w.word.toLowerCase().replace(/[^a-z]/g, ''));
  for (const w of ['hello', 'edit', 'clip', 'caption', 'every', 'word']) assert.ok(keys.includes(w), `heard "${w}" in "${r.text}"`);
  for (let i = 0; i < r.words.length; i++) {
    const w = r.words[i]!;
    assert.ok(w.t >= 0 && (w.end ?? w.t) >= w.t && (w.end ?? 0) <= 5.5, `timing of ${w.word}: ${w.t} to ${w.end}`);
    if (i) assert.ok(w.t >= r.words[i - 1]!.t, 'in order');
  }
  // the whole hearing with no key: the vocabulary fixes the name ("movie" is how Whisper spells Moovi)
  const dir = mkdtempSync(join(tmpdir(), 'moovi-hear-'));
  try {
    const h = await hear(FIXTURE, dir, { brief: 'edit my clip' });
    assert.match(h.by, /^local /);
    assert.ok(h.words.some(w => /^Moovi/.test(w.word)), h.words.map(w => w.word).join(' '));
    assert.ok(h.gate.ok, h.gate.reasons.join('; '));
  } finally { rmSync(dir, { recursive: true, force: true }); }
}));

test('stt: when the keyed provider refuses (billing), the local model hears the clip; with MOOVI_STT=off the refusal is said plainly', { timeout: 600_000, skip: process.env.MOOVI_STT_LOCAL_TEST === 'off' && 'MOOVI_STT_LOCAL_TEST=off' }, async t => {
  const srv = createServer((_q, s) => { s.writeHead(400, { 'content-type': 'application/json' }); s.end('{"error":{"message":"Organization has billing issues"}}'); });
  await new Promise<void>(r => srv.listen(0, '127.0.0.1', r));
  const dir = mkdtempSync(join(tmpdir(), 'moovi-refuse-'));
  try {
    const base = `http://127.0.0.1:${(srv.address() as { port: number }).port}`;
    await withEnv({ GROQ_API_KEY: 'gsk_test', MOOVI_GROQ_BASE: base }, async () => {
      let h;
      try { h = await hear(FIXTURE, dir); } catch (e) { if (offline(e) && !/billing/.test(String(e))) return t.skip('the speech model could not download'); throw e; }
      assert.match(h.by, /^local .*groq refused: groq speech-to-text answered 400/);
      assert.ok(h.words.length >= 8, `${h.words.length} words`);
    });
    await withEnv({ GROQ_API_KEY: 'gsk_test', MOOVI_GROQ_BASE: base, MOOVI_STT: 'off' }, async () => {
      const e = await hear(FIXTURE, dir).then(() => null, x => x);
      assert.ok(e, 'the refusal is not swallowed');
      assert.match(plainSpeechError(e), /^Moovi could not hear your clip: Groq refused it \(billing or quota/);
    });
  } finally { srv.close(); rmSync(dir, { recursive: true, force: true }); }
});
