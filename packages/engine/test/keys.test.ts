import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// an isolated data dir and secret: never the real ones
process.env.MOOVI_DATA_DIR = mkdtempSync(join(tmpdir(), 'ce-keys-'));
process.env.MOOVI_SECRET = 'test-secret';
const { setModel, loadModel, modelInfo, scopeFor, clearModel } = await import('../src/keys');
const { model, runtime, withModel } = await import('../src/runtime');

const groqModels = (async (u: string, init?: { headers?: Record<string, string> }) => {
  if (!u.endsWith('/models')) return new Response('{}', { status: 404 });
  if (init?.headers?.authorization !== 'Bearer gsk_good_key_1234') return new Response('{"error":{"message":"Invalid API Key"}}', { status: 401 });
  return new Response(JSON.stringify({ data: [{ id: 'openai/gpt-oss-120b', context_window: 131072 }, { id: 'openai/gpt-oss-20b', context_window: 131072 }, { id: 'whisper-large-v3', context_window: 448 }] }), { status: 200 });
}) as unknown as typeof fetch;

test('a refused key is not saved, with a plain message', async () => {
  const r = await setModel('u_alice', { provider: 'groq', key: 'gsk_bad_key_0000' }, groqModels);
  assert.equal(r.ok, false);
  assert.match((r as { error: string }).error, /refused that key/);
  assert.equal(loadModel('u_alice'), null);
});

test('a good key is checked, sealed at rest, and its tiers come from the live list', async () => {
  const r = await setModel('u_alice', { provider: 'groq', key: 'gsk_good_key_1234' }, groqModels);
  assert.equal(r.ok, true);
  const disk = readFileSync(join(process.env.MOOVI_DATA_DIR!, 'users', 'u_alice', 'model.json'), 'utf8');
  assert.ok(!disk.includes('gsk_good_key_1234'), 'the key is never stored in plain text');
  assert.equal(loadModel('u_alice')!.key, 'gsk_good_key_1234');
  assert.deepEqual(modelInfo('u_alice'), { provider: 'groq', label: 'Groq', last4: '1234', models: { director: 'openai/gpt-oss-120b', crew: 'openai/gpt-oss-120b', fast: 'openai/gpt-oss-20b' }, checkedAt: modelInfo('u_alice')!.checkedAt });
});

test('two users\' jobs at once never share a model: each runs in its own scope', async () => {
  await setModel('u_bob', { provider: 'groq', key: 'gsk_good_key_1234' }, groqModels);
  const a = scopeFor('u_alice')!, b = { ...scopeFor('u_bob')!, models: { director: 'x', crew: 'bob-crew', fast: 'y' } };
  const seen: string[] = [];
  await Promise.all([
    withModel(a, async () => { await new Promise(r => setTimeout(r, 20)); seen.push(`alice:${model('crew')}:${runtime() === a.runtime}`); }),
    withModel(b, async () => { await new Promise(r => setTimeout(r, 5)); seen.push(`bob:${model('crew')}:${runtime() === b.runtime}`); }),
  ]);
  assert.deepEqual(seen.sort(), ['alice:openai/gpt-oss-120b:true', 'bob:bob-crew:true']);
  assert.equal(scopeFor('nobody'), null);
  clearModel('u_bob');
  assert.equal(loadModel('u_bob'), null);
});
