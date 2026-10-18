import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { Q } from '@moovi/graph';
import { briefWithMemory, readEditMemory, rememberEdit, specDevices } from '../src/edit/memory';
import { creditOf } from '../src/synapse';

test('the edit reads the user\'s memory by named queries and Keeper files its choices back', async () => {
  const calls: [string, Record<string, unknown>][] = [];
  const rows: Record<string, unknown[]> = {
    lessonsFor: [{ text: 'never a desk print' }],
    captionNotes: [{ kind: 'caption', why: 'too small', value: 'bigger' }],
    preferences: [{ key: 'pace', value: 'calm' }],
    recentPresets: [{ card: JSON.stringify({ devices: ['speaker', 'punch'] }) }],
  };
  const uq = async <T,>(q: Q, p: Record<string, unknown> = {}) => { calls.push([q.name, p]); return (rows[q.name] ?? []) as T[]; };
  const m = await readEditMemory(uq);
  assert.deepEqual(m.previous, ['speaker', 'punch']);
  assert.deepEqual(m.notes, ['never a desk print', 'caption: too small — bigger', 'pace: calm']);
  assert.match(briefWithMemory('make it punchy', m), /make it punchy\n\nWHAT THIS USER TAUGHT MOOVI[\s\S]*- never a desk print/);
  assert.equal(briefWithMemory('b', { previous: [], notes: [] }), 'b');
  calls.length = 0;
  await rememberEdit(uq, { video: 'v1', project: 'p1', title: 't', devices: ['speaker', 'compare', 'speaker'], caption: '1.1' });
  assert.deepEqual(calls.map(c => c[0]), ['recordVideo', 'recordSequence']);
  assert.equal(calls[0]![1].style, 'edit');
  assert.deepEqual(JSON.parse(String(calls[0]![1].card)).devices, ['speaker', 'compare', 'speaker']);
  // every call is credited to Keeper in the synapse view
  for (const n of ['lessonsFor', 'captionNotes', 'preferences', 'recentPresets', 'recordVideo', 'recordSequence']) assert.equal(creditOf(n, { agent: 'editor' }), 'keeper');
});

test('specDevices: the player layers per beat, the camera left out', () => {
  assert.deepEqual(specDevices({ beats: [{ layers: [{ t: 'cam' }] }, { layers: [{ t: 'cam' }, { t: 'letters' }, { t: 'pill' }] }] }), ['speaker', 'letters+pill']);
  assert.deepEqual(specDevices(null), []);
});
