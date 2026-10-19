// tsx scripts/spec-timing.ts serve <words.json> <out.jsonl>: a stdio MCP server standing in for the bridge for ONE
// direct:edit-spec step, so a real background Claude Code (`claude -p`, as command 2 starts it) can be timed on it.
// moovi_next hands out the real step (the engine's masterySpecStep, shown by the bridge's own stepView); moovi_answer
// takes the answer, prechecks it like the bridge, checks it against the player (checkMasterySpec) and logs the times.
import { appendFileSync, readFileSync } from 'node:fs';
import { z } from 'zod';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { checkMasterySpec, masterySpecStep, SpecShape } from '../../engine/src/edit/mastery-direct';
import { worldCutouts } from '../../engine/src/edit/mastery';
import { precheck, stepView } from '../src/server';

const [, , , wordsFile, out] = process.argv;
const raw = JSON.parse(readFileSync(wordsFile!, 'utf8'));
const words = (Array.isArray(raw) ? raw : raw.words as unknown[]).map((w: any) => ({ word: String(w.word), t: Number(w.t), end: Number(w.end) }));
const files = worldCutouts();
const step = masterySpecStep({ words, duration: words.at(-1)!.end + 0.5, files, brief: 'a talking-head reel' });
const schema = z.toJSONSchema(z.object(SpecShape), { unrepresentable: 'any' }) as Record<string, unknown>;
const log = (o: Record<string, unknown>) => appendFileSync(out!, JSON.stringify({ at: Date.now(), ...o }) + '\n');
let handed = 0, answered = false;

const mcp = new McpServer({ name: 'moovi', version: 'timing' });
mcp.registerTool('moovi_next', { description: 'Gets the next decision Moovi needs for the user\'s video.', inputSchema: { ticket: z.string().optional(), wait_s: z.number().optional() } }, async () => {
  if (answered) return { content: [{ type: 'text', text: JSON.stringify({ status: 'done', message: 'The video is ready. Tell the user and stop.' }) }] };
  const view = stepView({ id: 'st_timing', job: 'job', user: 'u', agent: 'direct:edit-spec', system: step.system, prompt: step.prompt, schema, state: 'picked', createdAt: Date.now(), fp: 'x' } as never, 'ls_timing');
  handed = Date.now(); log({ ev: 'handed', chars: (view.content[0] as { text: string }).text.length, est_tokens: step.tokens });
  return view;
});
mcp.registerTool('moovi_answer', { description: 'Answers the step moovi_next gave you, as one JSON object matching its answer_schema.', inputSchema: { step: z.string(), answer: z.union([z.record(z.string(), z.unknown()), z.string()]), lease: z.string().optional(), wait_s: z.number().optional() } }, async args => {
  let a: unknown = args.answer; if (typeof a === 'string') try { a = JSON.parse(a); } catch { a = null; }
  const pre = precheck(schema, a), check = a && typeof a === 'object' ? checkMasterySpec(a as Record<string, unknown>, { words, devices: step.devices, files }) : ['not an object'];
  log({ ev: 'answer', s: +((Date.now() - handed) / 1000).toFixed(1), chars: JSON.stringify(a).length, beats: (a as { beats?: unknown[] })?.beats?.length ?? 0, precheck: pre, check });
  if (pre.length) return { content: [{ type: 'text', text: JSON.stringify({ ok: false, problems: pre }) }], isError: true };
  answered = true;
  return { content: [{ type: 'text', text: JSON.stringify({ ok: true, answered: 'st_timing', next: { status: 'done', message: 'The video is ready. Tell the user and stop.' } }) }] };
});
await mcp.connect(new StdioServerTransport());
