// pnpm --filter @contenteasy/engine exec tsx scripts/smoke.ts
// One real tool loop on the configured runtime: the model must use `add`, see the result, then `finish`.
import { z } from 'zod';
import { model, runtime, tool } from '../src/runtime';

const log: string[] = [];
const tools = [
  tool({ name: 'add', description: 'Add two integers. Returns their sum.', input: { a: z.number().int(), b: z.number().int() }, async run({ a, b }) { log.push(`add(${a}, ${b})`); return { json: { sum: a + b } }; } }),
  tool({ name: 'finish', description: 'Report the final answer. Only a correct answer is accepted.', input: { answer: z.number() }, ends: true,
    async run({ answer }) { log.push(`finish(${answer})`); return answer === 1234 + 4321 ? { text: 'Correct.' } : { error: 'That is not the sum. Use the add tool.' }; } }),
];
const rt = runtime();
const r = await rt.run({ agent: 'smoke', system: 'You are a careful assistant. Always use your tools; never do arithmetic in your head.', prompt: 'What is 1234 + 4321? Use add, then finish with the result.', tools, model: model('fast'), maxTurns: 8, deadlineMs: 120_000 });
console.log(JSON.stringify({ runtime: rt.name, model: model('fast'), ...r, log }, null, 1));
process.exit(r.stopped === 'finished' ? 0 : 1);
