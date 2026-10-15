import { test } from 'node:test';
import assert from 'node:assert/strict';
import { z } from 'zod';
import { ask, coerce, extractJson, httpRuntime, setRuntime, tool, type Tool } from '../src/runtime';

/**
 * What weak models (Groq Llama 8B, Gemini Flash-Lite, a local 1B) actually send, and what the crew must still
 * make of it. Each mock plays one bad habit; the engine must end up with the right answer anyway.
 */

test('coerce: almost-right values become right ones', () => {
  const S = z.object({ n: z.number().int(), kind: z.enum(['hero', 'pills', 'before-after']), tags: z.array(z.string()), script: z.string(), ok: z.boolean(), items: z.array(z.object({ start: z.number().int(), label: z.string() })) });
  const v = coerce(S, { answer: { N: '3.6', Kind: 'Before_After', tags: 'a, b, c', script: ['Line one.', 'Line two.'], ok: 'yes', items: { start: '2', label: 7 } } });
  assert.deepEqual(S.parse(v), { n: 4, kind: 'before-after', tags: ['a', 'b', 'c'], script: 'Line one.\nLine two.', ok: true, items: [{ start: 2, label: '7' }] });
  // a value that cannot be read stays wrong (the schema reports it; nothing is invented)
  assert.equal(S.safeParse(coerce(S, { n: 'three', kind: 'zebra', tags: [], script: '', ok: true, items: [] })).success, false);
});

test('extractJson: fences, prose, trailing commas, single quotes, truncation', () => {
  assert.deepEqual(extractJson('Sure! Here it is:\n```json\n{"a": 1,}\n```\nHope that helps.'), { a: 1 });
  assert.deepEqual(extractJson("{name: 'Acme', tags: ['x', 'y']}"), { name: 'Acme', tags: ['x', 'y'] });
  assert.deepEqual(extractJson('{"lines": ["one", "two"'), { lines: ['one', 'two'] });
  assert.deepEqual(extractJson('The answer is {"x": true} and that is all'), { x: true });
});

/** An OpenAI-compatible API that answers with a scripted list of replies (text or tool calls or HTTP errors). */
function api(replies: ({ text?: string; calls?: { name: string; args: unknown }[] } | { status: number; body: string; headers?: Record<string, string> })[], seen: unknown[] = []): typeof fetch {
  let i = 0;
  return (async (_u: string, init: { body: string }) => {
    seen.push(JSON.parse(init.body));
    const r = replies[Math.min(i++, replies.length - 1)]!;
    if ('status' in r) return new Response(r.body, { status: r.status, headers: r.headers });
    const msg = { content: r.text ?? null, tool_calls: r.calls?.map((c, k) => ({ id: `c${i}${k}`, type: 'function', function: { name: c.name, arguments: JSON.stringify(c.args) } })) };
    return new Response(JSON.stringify({ choices: [{ message: msg }] }), { status: 200 });
  }) as unknown as typeof fetch;
}
const sumTools = (log: string[]): Tool[] => [
  tool({ name: 'add', description: 'Add two numbers.', input: { a: z.number(), b: z.number() }, async run({ a, b }) { log.push(`add ${a}+${b}`); return { json: { sum: a + b } }; } }),
  tool({ name: 'finish', description: 'Finish with the sum.', input: { sum: z.number() }, ends: true, async run({ sum }) { log.push(`finish ${sum}`); return { text: 'ok' }; } }),
];
const req = (tools: Tool[]) => ({ agent: 't', system: 's', prompt: 'add 2 and 3', tools, model: 'm', maxTurns: 6, deadlineMs: 5000 });

test('a model with no tool calling: tools are emulated after the API rejects them', async () => {
  const log: string[] = [], seen: unknown[] = [];
  const rt = httpRuntime({ provider: 'compatible', key: 'k', baseUrl: 'http://mock', fetch: api([
    { status: 400, body: '{"error":{"message":"this model does not support tools"}}' },
    { text: 'I will add them.\n{"tool": "add", "args": {"a": "2", "b": 3}}' },
    { text: '```json\n{"tool":"finish","arguments":{"sum":5}}\n```' },
  ], seen) });
  const r = await rt.run(req(sumTools(log)));
  assert.equal(r.stopped, 'finished');
  assert.deepEqual(log, ['add 2+3', 'finish 5']);
  assert.ok(!('tools' in (seen[1] as object)), 'the retry carries no native tools');
});

test('Groq tool_use_failed: the broken call in failed_generation is read, not lost', async () => {
  const log: string[] = [];
  const rt = httpRuntime({ provider: 'groq', key: 'k', baseUrl: 'http://mock', fetch: api([
    { status: 400, body: JSON.stringify({ error: { code: 'tool_use_failed', message: 'Failed to call a function', failed_generation: '<function=add>{"a": 2, "b": 3}</function>' } }) },
    { calls: [{ name: 'finish', args: { sum: 5 } }] },
  ]) });
  const r = await rt.run(req(sumTools(log)));
  assert.equal(r.stopped, 'finished');
  assert.deepEqual(log, ['add 2+3', 'finish 5']);
});

test('a model that writes the call as text despite native tools, then forgets to finish, gets one reminder', async () => {
  const log: string[] = [];
  const rt = httpRuntime({ provider: 'openai', key: 'k', baseUrl: 'http://mock', fetch: api([
    { text: '<function=add>{"a": 2, "b": 3}</function>' },
    { text: 'The sum is 5.' },
    { calls: [{ name: 'finish', args: { sum: '5' } }] },
  ]) });
  const r = await rt.run(req(sumTools(log)));
  assert.equal(r.stopped, 'finished');
  assert.deepEqual(log, ['add 2+3', 'finish 5']);
});

test('429 waits for the time the API asks, then succeeds', async () => {
  const log: string[] = [];
  const t0 = Date.now();
  const rt = httpRuntime({ provider: 'groq', key: 'k', baseUrl: 'http://mock', fetch: api([
    { status: 429, body: '{"error":{"message":"rate limit"}}', headers: { 'retry-after': '0.3' } },
    { calls: [{ name: 'finish', args: { sum: 5 } }] },
  ]) });
  const r = await rt.run(req(sumTools(log)));
  assert.equal(r.stopped, 'finished');
  assert.ok(Date.now() - t0 >= 300);
});

test('ask() on any API: JSON mode downgrades on 400, a bad answer is repaired, the doctor-free value is right', async () => {
  const seen: Record<string, unknown>[] = [];
  setRuntime(httpRuntime({ provider: 'openai', key: 'k', baseUrl: 'http://mock', fetch: api([
    { status: 400, body: '{"error":{"message":"response_format json_schema is not supported"}}' },
    { text: 'Here you go: {"name": "Acme", "beats": [{"device": "Hero", "start": "0"}, {"device": "zebra", "start": 4}]}' },
    { text: '{"name": "Acme", "beats": [{"device": "hero", "start": 0}, {"device": "pills", "start": 4}]}' },
  ], seen as unknown[]) }));
  try {
    const out = await ask({ agent: 'plan', system: 'Plan beats.', prompt: 'Script…', model: 'm-json', schema: { name: z.string(), beats: z.array(z.object({ device: z.enum(['hero', 'pills', 'dial']), start: z.number().int() })).min(1) } });
    assert.deepEqual(out, { name: 'Acme', beats: [{ device: 'hero', start: 0 }, { device: 'pills', start: 4 }] });
    assert.equal((seen[0]!.response_format as { type: string }).type, 'json_schema');
    assert.equal((seen[1]!.response_format as { type: string }).type, 'json_object');
    // the repair turn quoted the exact problem
    assert.match(JSON.stringify(seen[2]), /beats\.1\.device/);
  } finally { setRuntime(null); }
});

test('ask() on a local model (Ollama wire): the schema goes to the decoder as `format`', async () => {
  const seen: Record<string, unknown>[] = [];
  const f = (async (u: string, init: { body: string }) => {
    seen.push(JSON.parse(init.body));
    return new Response(JSON.stringify({ message: { content: '{"ok": "true", "words": "alpha\\nbeta"}' } }), { status: 200 });
  }) as unknown as typeof fetch;
  setRuntime(httpRuntime({ provider: 'ollama', baseUrl: 'http://mock', fetch: f }));
  try {
    const out = await ask({ agent: 't', system: 's', prompt: 'p', model: 'gemma3:1b', schema: { ok: z.boolean(), words: z.array(z.string()) } });
    assert.deepEqual(out, { ok: true, words: ['alpha', 'beta'] });
    assert.equal((seen[0]!.format as { type: string }).type, 'object');
  } finally { setRuntime(null); }
});

test('a retired model id is replaced by the provider\'s live model for its tier, never a silent fallback', async () => {
  const { pickModel } = await import('../src/runtime/providers');
  const live = [{ id: 'whisper-large-v3', context: 448 }, { id: 'allam-2-7b', context: 4096 }, { id: 'openai/gpt-oss-120b', context: 131072 }, { id: 'openai/gpt-oss-20b', context: 131072 }, { id: 'qwen/qwen3.8-27b', context: 131072 }];
  assert.equal(pickModel(live, 'crew', 'llama-3.3-70b-versatile'), 'openai/gpt-oss-120b');
  assert.equal(pickModel(live, 'fast', 'llama-3.1-8b-instant'), 'openai/gpt-oss-20b');
  const seen: string[] = [];
  const f = (async (u: string, init?: { body?: string }) => {
    if (u.endsWith('/models')) return new Response(JSON.stringify({ data: live }), { status: 200 });
    const b = JSON.parse(init!.body!); seen.push(b.model);
    if (b.model === 'llama-3.3-70b-versatile') return new Response('{"error":{"message":"The model `llama-3.3-70b-versatile` does not exist or you do not have access to it.","code":"model_not_found"}}', { status: 404 });
    return new Response(JSON.stringify({ choices: [{ message: { content: '{"ok": true}' } }] }), { status: 200 });
  }) as unknown as typeof fetch;
  setRuntime(httpRuntime({ provider: 'groq', key: 'k', baseUrl: 'http://mock', fetch: f }));
  try {
    assert.deepEqual(await ask({ agent: 't', system: 's', prompt: 'p', model: 'llama-3.3-70b-versatile', schema: { ok: z.boolean() } }), { ok: true });
    assert.deepEqual(seen, ['llama-3.3-70b-versatile', 'openai/gpt-oss-120b']);
  } finally { setRuntime(null); }
});
