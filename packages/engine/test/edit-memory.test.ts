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

test('the Designer\'s library cast: the craft graph ranks menu devices per sentence, and the menu step shows it as a hint', async () => {
  const { libraryRanks, loadMenu, menuStep, sentencesOfWords } = await import('../src/edit/mastery-menu');
  const said = 'Revenue grew from 2 crore to 10 crore. Compare the old way and the new way. My name is Ravi.'.split(' ');
  const ss = sentencesOfWords(said.map((word, k) => ({ word, t: k * 0.4, end: k * 0.4 + 0.35 })));
  const menu = loadMenu(), ranks = await libraryRanks(ss, menu), ids = new Set(menu.devices.map(d => d.id));
  assert.ok(ranks.size > 0, 'some sentence is ranked');
  for (const r of ranks.values()) { assert.ok(r.length <= 3); for (const id of r) assert.ok(ids.has(id) && id !== 'speaker', id); }
  const step = menuStep(ss, menu, '', ranks);
  assert.match(step.prompt, /\(library: [a-z-]+/);
  const plain = menuStep(ss, menu, '').tokens;
  assert.ok(step.tokens - plain <= 60 + 12 * ss.length, `the ranks add ${step.tokens - plain} tokens`);
});
