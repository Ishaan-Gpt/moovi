import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// The merge of the Voice Director (vignesh/voice-3d-maps) with the graph memory loop (vignesh/graph-memory):
// the cast comes from the brief, the user's feedback memory has the last word.
process.env.MOOVI_DATA_DIR = mkdtempSync(join(tmpdir(), 'ce-voicemem-'));
const { voiceById } = await import('../src/audio/voices');
const { NO_MEMORY } = await import('../src/memory');
const { withFeedback } = await import('../src/tasks/script');
type Cast = Parameters<typeof withFeedback>[0];

const neerja = voiceById('en-IN-NeerjaExpressiveNeural') ?? voiceById('en-IN-NeerjaNeural')!;
const cast: Cast = { voice: neerja, rate: '+0%', reason: 'brief: Indian college ad', by: 'ranking', shortlist: [neerja.id, 'en-US-AndrewMultilingualNeural', 'en-GB-RyanNeural'], engine: 'edge', ms: 1 };

test('no feedback: the Voice Director cast stands', () => {
  assert.deepEqual(withFeedback(cast, NO_MEMORY), cast);
});

test('a voice the user chose before wins over the brief, and says so', () => {
  const out = withFeedback(cast, { ...NO_MEMORY, empty: false, voice: { prefer: 'en-GB-RyanNeural', avoid: [] } });
  assert.equal(out.voice.id, 'en-GB-RyanNeural');
  assert.equal(out.by, 'memory');
  assert.match(out.reason, /feedback memory/);
});

test('a turned down cast falls to the next shortlisted voice the user did not turn down', () => {
  const out = withFeedback(cast, { ...NO_MEMORY, empty: false, voice: { prefer: null, avoid: [neerja.id] } });
  assert.equal(out.voice.id, 'en-US-AndrewMultilingualNeural');
  assert.equal(out.by, 'memory');
});

test('a preferred voice that was also turned down, or is not in the library, is ignored', () => {
  assert.equal(withFeedback(cast, { ...NO_MEMORY, empty: false, voice: { prefer: 'en-GB-RyanNeural', avoid: ['en-GB-RyanNeural'] } }).voice.id, neerja.id);
  assert.equal(withFeedback(cast, { ...NO_MEMORY, empty: false, voice: { prefer: 'xx-Nobody', avoid: [] } }).voice.id, neerja.id);
});
