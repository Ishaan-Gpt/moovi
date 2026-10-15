import { test } from 'node:test';
import assert from 'node:assert/strict';
import { z } from 'zod';
import { httpRuntime, tool, type Tool } from '../src/runtime';

/**
 * Contract: the same scripted conversation through each provider adapter. The "model" asks for `add` with a bad
 * input, gets the validation error back, fixes it, then calls `finish`; the loop must end on finish.
 */
function tools(log: string[]): Tool[] {
  return [
    tool({ name: 'add', description: 'Add two numbers.', input: { a: z.number(), b: z.number() }, async run({ a, b }) { log.push(`add ${a}+${b}`); return { json: { sum: a + b } }; } }),
    tool({ name: 'finish', description: 'Finish.', input: { sum: z.number() }, ends: true, async run({ sum }) { log.push(`finish ${sum}`); return sum === 5 ? { text: 'ok' } : { error: 'wrong sum' }; } }),
  ];
}
const SCRIPT = [
  { name: 'add', args: { a: 2, b: 'three' } },
  { name: 'add', args: { a: 2, b: 3 } },
  { name: 'finish', args: { sum: 5 } },
];

function mockFetch(shape: 'anthropic' | 'openai' | 'gemini', seen: unknown[]): typeof fetch {
  let turn = 0;
  return (async (_url: string, init: { body: string }) => {
    const body = JSON.parse(init.body);
    seen.push(body);
    const step = SCRIPT[turn++]!;
    const id = `call_${turn}`;
    const json = shape === 'anthropic'
      ? { content: [{ type: 'text', text: `step ${turn}` }, { type: 'tool_use', id, name: step.name, input: step.args }], stop_reason: 'tool_use' }
      : shape === 'openai'
        ? { choices: [{ message: { content: `step ${turn}`, tool_calls: [{ id, type: 'function', function: { name: step.name, arguments: JSON.stringify(step.args) } }] } }] }
        : { candidates: [{ content: { parts: [{ text: `step ${turn}` }, { functionCall: { name: step.name, args: step.args } }] } }] };
    return new Response(JSON.stringify(json), { status: 200 });
  }) as unknown as typeof fetch;
}

for (const p of ['anthropic', 'openai', 'gemini'] as const) {
  test(`${p}: validation errors go back to the model, the loop ends on finish`, async () => {
    const log: string[] = [], seen: unknown[] = [];
    const rt = httpRuntime({ provider: p, key: 'test', baseUrl: 'http://mock', fetch: mockFetch(p, seen) });
    const r = await rt.run({ agent: 'test', system: 'sys', prompt: 'add 2 and 3', tools: tools(log), model: 'm', maxTurns: 10, deadlineMs: 5000 });
    assert.equal(r.stopped, 'finished');
    assert.equal(r.turns, 3);
    assert.deepEqual(log, ['add 2+3', 'finish 5']);
    // the second request carried the validation error back to the model
    assert.match(JSON.stringify(seen[1]), /Invalid input for add/);
  });
}

test('a budget of turns stops the loop', async () => {
  const log: string[] = [];
  const rt = httpRuntime({ provider: 'openai', key: 'x', baseUrl: 'http://mock', fetch: mockFetch('openai', []) });
  const r = await rt.run({ agent: 'test', system: 's', prompt: 'p', tools: tools(log), model: 'm', maxTurns: 2, deadlineMs: 5000 });
  assert.equal(r.stopped, 'turns');
});
