import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

process.env.MOOVI_DATA_DIR = mkdtempSync(join(tmpdir(), 'ce-voice-'));
delete process.env.MOOVI_VOICE_ENGINE;
delete process.env.ELEVENLABS_API_KEY;
const { VOICES, DEFAULT_VOICE, voiceById } = await import('../src/audio/voices');
const { readWish, rankVoices, rateFor, reasonFor } = await import('../src/audio/cast');
const { lineKey, speakLines } = await import('../src/audio/lines');
const { alignmentToWords, elevenSynthesize } = await import('../src/audio/eleven');
const { config } = await import('../src/config');
const { voice: VQ } = await import('@moovi/graph');

const dir = process.env.MOOVI_DATA_DIR!;
const best = (brief: string, memory: Parameters<typeof rankVoices>[1] = [], chat: string | null = null) => rankVoices(readWish({ brief }), memory, chat)[0]!.voice;

test('library: 40+ voices, unique ids, every one tagged, Indian English and Hindi in it', () => {
  assert.ok(VOICES.length >= 40, `${VOICES.length} voices`);
  assert.equal(new Set(VOICES.map(v => v.id)).size, VOICES.length);
  for (const v of VOICES) {
    assert.match(v.id, /^[a-z]{2}-[A-Z]{2}-[A-Za-z]+Neural$/);
    assert.ok(v.name && v.accent && v.tone.length && v.use.length, v.id);
    assert.ok(v.energy >= 1 && v.energy <= 5, v.id);
  }
  assert.ok(VOICES.filter(v => v.accent === 'Indian').length >= 3);
  assert.ok(VOICES.filter(v => v.lang === 'hi').length >= 2);
  assert.ok(new Set(VOICES.map(v => v.accent)).size >= 15, 'many accents');
  assert.ok(voiceById(DEFAULT_VOICE));
});

test('picker: a plain English brief keeps the house voice', () => {
  assert.equal(best('Make a 30 second explainer about how UPI works').id, DEFAULT_VOICE);
});

test('picker: language, accent, gender, age and energy are heard', () => {
  assert.equal(best('मेरे गाँव की कहानी पर एक छोटी वीडियो').lang, 'hi');
  assert.equal(best('An explainer about FalkorDB in Tamil').lang, 'ta');
  const desi = best('Ad for a Bangalore coffee startup for college students');
  assert.equal(desi.accent, 'Indian');
  const f = best('Indian accent, female voice, a tutorial on UPI');
  assert.equal(f.accent, 'Indian'); assert.equal(f.gender, 'female');
  const doc = best('A calm documentary short about the history of Hampi, British narrator');
  assert.equal(doc.accent, 'British'); assert.ok(doc.energy <= 2);
  assert.equal(best('Kids cartoon video about brushing teeth').age, 'child');
  const hype = best('Hype promo for our gaming headset sale, female voice');
  assert.equal(hype.gender, 'female'); assert.ok(hype.energy >= 4);
  assert.equal(readWish({ brief: 'x', language: 'hinglish' }).accent, 'Indian');
});

test('picker: a voice named in the brief wins', () => {
  assert.equal(best('Use Ryan for this one: a story about the Titanic').id, 'en-GB-RyanNeural');
  assert.equal(best('voice: en-AU-NatashaNeural, a promo').id, 'en-AU-NatashaNeural');
});

test('picker: the graph memory keeps a brand voice and never recasts a turned-down one', () => {
  const kept = best('Make a 30 second explainer about our app', [{ voice: 'en-GB-SoniaNeural', chat: 'c1', rejected: false, at: 2 }]);
  assert.equal(kept.id, 'en-GB-SoniaNeural');
  const fresh = best('Same video but a different voice', [{ voice: 'en-GB-SoniaNeural', chat: 'c1', rejected: false, at: 2 }]);
  assert.notEqual(fresh.id, 'en-GB-SoniaNeural');
  const rejected = best('Make a 30 second explainer about our app', [{ voice: DEFAULT_VOICE, chat: 'c1', rejected: true, at: 2 }], 'c1');
  assert.notEqual(rejected.id, DEFAULT_VOICE);
});

test('picker: rate follows energy, and the reason names what was heard', () => {
  const w = readWish({ brief: 'Hype launch promo' }), x = voiceById('en-US-GuyNeural')!;
  assert.equal(rateFor(w, x), '+14%');
  assert.equal(rateFor(readWish({ brief: 'calm meditation guide' }), x), '+0%');
  const r = rankVoices(readWish({ brief: 'British narrator for a calm documentary' }))[0]!;
  const why = reasonFor(readWish({ brief: 'British narrator for a calm documentary' }), r);
  assert.match(why, /British accent asked for/); assert.match(why, new RegExp(r.voice.name));
});

test('cache key: same request same key; voice, rate, engine or text change it', () => {
  const k = { engine: 'edge' as const, voice: 'en-IN-NeerjaNeural', rate: '+10%', pitch: '+0Hz', text: 'Hello there.' };
  assert.equal(lineKey(k), lineKey({ ...k, text: ' Hello there. ' }));
  for (const d of [{ voice: 'en-IN-PrabhatNeural' }, { rate: '+12%' }, { engine: 'elevenlabs' as const }, { text: 'Hello.' }]) assert.notEqual(lineKey(k), lineKey({ ...k, ...d }));
});

// a stand-in voice service: a real (silent-ish) mp3 from ffmpeg and one timed word per token
const tone = (() => { const f = join(dir, 'tone.mp3'); execFileSync(config.ffmpeg, ['-v', 'error', '-y', '-f', 'lavfi', '-i', 'sine=frequency=220:duration=1.2', '-ar', '24000', '-ac', '1', f]); return readFileSync(f); })();
const fake = (calls: string[]) => async (text: string, o: { engine: string }) => {
  calls.push(`${o.engine}:${text}`);
  const toks = text.split(/\s+/);
  return { mp3: tone, words: toks.map((w, i) => ({ word: w.replace(/[^\p{L}\p{N}]/gu, ''), t: 0.1 + i * 0.2, end: 0.25 + i * 0.2 })) };
};

test('lines: spoken once, then from the cache; times shift onto the joined track, punctuation comes back', async () => {
  const calls: string[] = [], cache = join(dir, 'cache1');
  const lines = ['Hello there, friend.', 'Second line!', 'Third.'];
  const a = await speakLines(join(dir, 'a'), lines, { voice: 'en-IN-NeerjaNeural', rate: '+10%', cacheDir: cache, synth: fake(calls) });
  assert.equal(calls.length, 3); assert.equal(a.stats.cached, 0); assert.deepEqual(a.stats.spokenBy, { edge: 3 });
  assert.ok(existsSync(join(dir, 'a', 'vo.wav')));
  const words = JSON.parse(readFileSync(join(dir, 'a', 'words.json'), 'utf8')) as { word: string; t: number }[];
  assert.equal(words.length, 6); assert.equal(words[1]!.word, 'there,'); assert.equal(words[4]!.word, 'line!');
  for (let i = 1; i < words.length; i++) assert.ok(words[i]!.t > words[i - 1]!.t, 'monotonic');
  assert.ok(words[3]!.t > 0.5, 'line 2 starts after line 1');
  const b = await speakLines(join(dir, 'b'), lines, { voice: 'en-IN-NeerjaNeural', rate: '+10%', cacheDir: cache, synth: fake(calls) });
  assert.equal(calls.length, 3, 'nothing re-spoken'); assert.equal(b.stats.cached, 3);
  assert.deepEqual(JSON.parse(readFileSync(join(dir, 'b', 'words.json'), 'utf8')), words);
  await speakLines(join(dir, 'c'), [lines[0]!, 'A new second line.', lines[2]!], { voice: 'en-IN-NeerjaNeural', rate: '+10%', cacheDir: cache, synth: fake(calls) });
  assert.equal(calls.length, 4, 'only the edited line is spoken');
});

test('ElevenLabs: off by default, and when asked for without a key Edge speaks and says so', async () => {
  assert.equal(config.voice.engine, 'edge');
  const calls: string[] = [];
  const r = await speakLines(join(dir, 'e'), ['One line.'], { voice: 'en-US-AvaNeural', engine: 'elevenlabs', cacheDir: join(dir, 'cache2'), synth: fake(calls) });
  assert.deepEqual(calls, ['edge:One line.']);
  assert.deepEqual(r.stats.spokenBy, { edge: 1 });
  assert.match(r.stats.fallback ?? '', /ELEVENLABS_API_KEY/);
});

test('ElevenLabs: a failure partway means Edge re-speaks every line, so the film keeps one voice', async () => {
  const saved = config.voice.elevenKey;
  (config.voice as { elevenKey?: string }).elevenKey = 'test-key';
  try {
    const calls: string[] = [], ok = fake(calls);
    const flaky = async (text: string, o: { engine: string }) => {
      if (o.engine === 'elevenlabs' && text.startsWith('Two')) { calls.push(`${o.engine}:fail`); throw new Error('ElevenLabs answered 401: quota'); }
      return ok(text, o);
    };
    const r = await speakLines(join(dir, 'f'), ['One line.', 'Two lines.', 'Three lines.'], { voice: 'en-US-AvaNeural', engine: 'elevenlabs', concurrency: 1, cacheDir: join(dir, 'cache3'), synth: flaky });
    assert.ok(calls.includes('elevenlabs:One line.'), 'ElevenLabs spoke line 1 first');
    assert.deepEqual(r.stats.spokenBy, { edge: 3 }, 'every line in the film is Edge');
    assert.match(r.stats.fallback ?? '', /ElevenLabs failed .*401.*Edge spoke instead/);
  } finally { (config.voice as { elevenKey?: string }).elevenKey = saved; }
});

test('ElevenLabs: character alignment becomes word timings; a refusal is an error (the caller falls back)', async () => {
  const chars = [...'Hi, you there'];
  const w = alignmentToWords({ characters: chars, character_start_times_seconds: chars.map((_, i) => i * 0.1), character_end_times_seconds: chars.map((_, i) => i * 0.1 + 0.08) });
  assert.deepEqual(w.map(x => x.word), ['Hi,', 'you', 'there']);
  assert.equal(w[1]!.t, 0.4); assert.equal(w[2]!.end, 1.28);
  const refusing = (async () => new Response('quota exceeded', { status: 401 })) as unknown as typeof fetch;
  await assert.rejects(elevenSynthesize('x', { key: 'k', voiceId: 'v', fetchImpl: refusing }), /401/);
});

test('graph: the voice queries are named, documented and write the VOICED_BY edge', () => {
  assert.ok(VQ.castVoice.cypher.includes('VOICED_BY') && !VQ.castVoice.ro);
  assert.ok(VQ.voiceHistory.ro && VQ.whyVoice.ro && VQ.voiceMix.ro);
  for (const q of Object.values(VQ)) assert.ok(q.about.length > 20, q.name);
});

// against a real FalkorDB when one is given (MOOVI_TEST_FALKORDB=falkor://127.0.0.1:6390)
test('graph: cast, history, reject and why round-trip in FalkorDB', { skip: !process.env.MOOVI_TEST_FALKORDB }, async () => {
  process.env.FALKORDB_URL = process.env.MOOVI_TEST_FALKORDB;
  const { run, dropGraph, closeMemory } = await import('@moovi/graph');
  const g = `proj_votest${Date.now().toString(36)}`;
  try {
    const cast = (film: string, chat: string, v: string, at: number) => run(g, VQ.castVoice, { voice: v, name: v.split('-')[2], locale: 'en-IN', lang: 'en', accent: 'Indian', gender: 'female', age: 'adult', energy: 3,
      film, chat, video: `v-${chat}`, reason: 'test reason', by: 'ranking', score: 12.5, shortlist: [v, DEFAULT_VOICE], rate: '+10%', engine: 'edge', at });
    await cast('r1', 'c1', 'en-IN-NeerjaNeural', 1);
    await cast('r1', 'c1', 'en-IN-PrabhatNeural', 2); // a re-cast of the same film replaces the edge
    await cast('r2', 'c2', 'en-IN-NeerjaNeural', 3);
    await run(g, VQ.voiceSpoken, { film: 'r2', voice: 'en-IN-NeerjaNeural', spokenBy: 'edge:6', lines: 6, cached: 2, msPerLine: 250, seconds: 21.5, fallback: null });
    const h = await run<{ voice: string; chat: string }>(g, VQ.voiceHistory, { n: 10 });
    assert.deepEqual(h.map(x => x.voice), ['en-IN-NeerjaNeural', 'en-IN-PrabhatNeural']);
    const [why] = await run<{ voice: string; spokenBy: string; cached: number; reason: string }>(g, VQ.whyVoice, { film: 'r2' });
    assert.equal(why!.spokenBy, 'edge:6'); assert.equal(why!.cached, 2); assert.equal(why!.reason, 'test reason');
    const [rej] = await run<{ n: number }>(g, VQ.rejectVoice, { chat: 'c2', voice: 'en-IN-NeerjaNeural', why: 'too bright', at: 4 });
    assert.equal(rej!.n, 1);
    const mix = await run<{ voice: string; films: number }>(g, VQ.voiceMix, {});
    assert.deepEqual(mix.map(x => [x.voice, x.films]), [['en-IN-PrabhatNeural', 1]]);
  } finally { await dropGraph(g).catch(() => undefined); await closeMemory().catch(() => undefined); }
});
