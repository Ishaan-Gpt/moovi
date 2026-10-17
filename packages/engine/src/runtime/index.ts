import { AsyncLocalStorage } from 'node:async_hooks';
import { z } from 'zod';
import { config } from '../config';
import { claudeCodeRuntime } from './claudeCode';
import { describeShape } from './coerce';
import { httpRuntime, readAnswer } from './http';
import { tool, type Tool } from './tool';
import type { AgentRequest, Runtime } from './types';

export * from './tool';
export * from './types';
export { claudeCodeRuntime } from './claudeCode';
export * from './lane';
export * from './budget';
export * from './checked';
export { httpRuntime, readAnswer, listModels, type Provider } from './http';
export { coerce, extractJson, describeShape, nearestEnum } from './coerce';
export { PRESETS, PROVIDERS, pickProvider, modelFor } from './providers';
/** a short name for logs: the model id of a tier (never a hard-coded "sonnet"/"haiku") */
export const modelName = (tier: Tier) => model(tier);

/**
 * Whose model thinks. A job runs inside the scope of its user's own model (their provider, key and tier models:
 * bring-your-own-key, ../keys.ts), so one worker serves many users at once and no job ever uses another's key.
 * Outside a scope (the terminal, tests) it is the machine's configured runtime.
 */
export interface ModelScope { runtime: Runtime; models: Record<Tier, string>; provider: string; deadlineScale: number; drawsWell: boolean;
  /** speech-to-text on the user's own key (Groq or OpenAI Whisper), for footage and voice-overs; engine-side only */
  audio?: { provider: 'groq' | 'openai'; key: string } }
const scoped = new AsyncLocalStorage<ModelScope>();
export const withModel = <T>(s: ModelScope, fn: () => T): T => scoped.run(s, fn);
export const modelScope = () => scoped.getStore() ?? null;

let current: Runtime | null = null;
/** The runtime for this job: its user's own model, else this machine's (MOOVI_RUNTIME: Claude Code login or any API). */
export function runtime(): Runtime {
  const s = scoped.getStore(); if (s) return s.runtime;
  if (!current) current = config.runtime === 'http' ? httpRuntime() : claudeCodeRuntime();
  return current;
}
/** Tests swap in a scripted model. */
export function setRuntime(r: Runtime | null) { current = r; }

export type Tier = 'director' | 'crew' | 'fast';
export const model = (tier: Tier) => scoped.getStore()?.models[tier] ?? config.models[tier];
/** every model deadline × this (a local model on a CPU needs minutes where an API needs seconds) */
export const deadlineScale = () => scoped.getStore()?.deadlineScale ?? config.deadlineScale;
/** does the thinking model draw pictures well (Claude) or should picture styles go library-first */
export const modelDrawsWell = () => { const s = scoped.getStore(); if (s) return s.drawsWell; return config.runtime === 'claude-code' || config.provider === 'anthropic'; };

/** A model refused or its safeguards stopped the call: the same request goes once to another model. */
export const isRefusal = (e: unknown) => /safeguard|acceptable use|aup|can'?t respond|cannot respond|refus|content (policy|filter)|blocked by/i.test(e instanceof Error ? e.message : String(e));
export const otherTier = (t: Tier): Tier => (t === 'director' ? 'crew' : 'director');
/** Run a request; on a refusal, run it once more on another tier's model. */
export async function runWithFallback(req: AgentRequest, tier: Tier) {
  try { return { ...(await runtime().run({ ...req, model: model(tier) })), tier }; }
  catch (e) {
    if (!isRefusal(e) || req.signal?.aborted) throw e;
    const t2 = otherTier(tier);
    console.warn(`[engine] ${req.agent}: ${model(tier)} refused (${String(e instanceof Error ? e.message : e).slice(0, 120)}); retrying on ${model(t2)}`);
    return { ...(await runtime().run({ ...req, model: model(t2) })), tier: t2 };
  }
}

/**
 * A single structured answer, the same way on every runtime: the model gets one `submit` tool whose input is the
 * schema, and the call ends when it submits a valid one (invalid ones come back as tool errors to fix).
 */
export async function ask<S extends z.ZodRawShape>(o: { agent: string; system: string; prompt: string; schema: S; tier?: Tier; model?: string; maxTurns?: number; deadlineMs?: number; signal?: AbortSignal; tools?: Tool[]; quick?: boolean;
  /** the engine's own done-check: a string sends the submission back to the model as an error to fix */
  validate?: (a: z.output<z.ZodObject<S>>) => Promise<string | null> | string | null; submitDescription?: string } & Pick<AgentRequest, 'onTool' | 'onNote'>): Promise<z.output<z.ZodObject<S>>> {
  let answer: z.output<z.ZodObject<S>> | undefined;
  const submit = tool({
    name: 'submit', description: o.submitDescription ?? 'Submit your answer. Call this exactly once, with every field.', input: o.schema, ends: true,
    async run(args) {
      const err = o.validate ? await o.validate(args as never) : null;
      if (err) return { error: err };
      answer = args as never; return { text: 'Received.' };
    },
  });
  const rt = runtime();
  o = { ...o, deadlineMs: Math.round((o.deadlineMs ?? 180_000) * deadlineScale()) };
  // any model API: no tool loop for a plain answer, one JSON reply under the strongest constraint the API has
  if (rt.complete && !o.tools?.length) {
    const r = await askJson(rt, o, o.model ?? model(o.tier ?? 'crew'));
    if (r.ok) return r.value;
    // the same request once on another tier's model before giving up (a weak model may just not manage it)
    if (!o.model && !o.signal?.aborted) {
      const r2 = await askJson(rt, o, model(otherTier(o.tier ?? 'crew')));
      if (r2.ok) return r2.value;
      throw new Error(`${o.agent} gave no usable answer (${r2.error.slice(0, 200)})`);
    }
    throw new Error(`${o.agent} gave no usable answer (${r.error.slice(0, 200)})`);
  }
  let lastText = '';
  for (let attempt = 0; attempt < 2 && answer === undefined; attempt++) {
    const req: AgentRequest = {
      agent: o.agent, system: o.system, tools: [...(o.tools ?? []), submit], model: o.model ?? model(o.tier ?? 'crew'),
      prompt: attempt ? `${o.prompt}\n\nYou must answer by calling the submit tool.` : o.prompt,
      maxTurns: o.maxTurns ?? 6, deadlineMs: o.deadlineMs ?? 180_000, quick: o.quick, signal: o.signal, onTool: o.onTool, onNote: o.onNote,
    };
    const res = o.model ? await rt.run(req) : await runWithFallback(req, o.tier ?? 'crew');
    lastText = res.text;
    // a model that wrote its answer as text instead of calling submit: read it from the text
    if (answer === undefined && res.text) {
      const r = readAnswer(res.text, o.schema);
      if (r.ok && !(o.validate && await o.validate(r.value))) answer = r.value;
    }
    if (o.signal?.aborted) break;
  }
  if (answer === undefined) throw new Error(`${o.agent} gave no answer (it never called submit${lastText ? `; it said: ${lastText.slice(0, 120)}` : ''}).`);
  return answer;
}

/**
 * One JSON answer through `complete()`: the schema as JSON-with-comments in the system prompt (what small models
 * follow best) and as a decoding constraint where the API has one; the reply parsed, coerced, checked and validated;
 * up to two repair turns that quote the exact problems.
 */
async function askJson<S extends z.ZodRawShape>(rt: Runtime, o: Parameters<typeof ask<S>>[0], modelId: string): Promise<{ ok: true; value: z.output<z.ZodObject<S>> } | { ok: false; error: string }> {
  const system = `${o.system}\n\nAnswer with ONE JSON object and nothing else (no prose, no markdown). Its shape:\n${describeShape(o.schema)}`;
  const history: { role: 'user' | 'assistant'; text: string }[] = [];
  const t0 = Date.now(), budget = o.deadlineMs ?? 180_000;
  let error = 'no reply';
  for (let attempt = 0; attempt < 3; attempt++) {
    const left = budget - (Date.now() - t0);
    if (left < 3000 || o.signal?.aborted) break;
    let text: string;
    try { text = await rt.complete!({ agent: o.agent, system, prompt: o.prompt, model: modelId, deadlineMs: left, schema: o.schema, history, signal: o.signal }); }
    catch (e) { if (o.signal?.aborted || isRefusal(e) || /deadline|cancel/i.test(String(e))) return { ok: false, error: String(e instanceof Error ? e.message : e) }; error = String(e instanceof Error ? e.message : e); continue; }
    const r = readAnswer(text, o.schema);
    if (r.ok) {
      const bad = o.validate ? await o.validate(r.value) : null;
      if (!bad) return r;
      error = bad;
    } else error = r.error;
    if (process.env.MOOVI_DEBUG_HTTP) console.warn(`[ask] ${o.agent} repair turn ${attempt + 1}: ${error.slice(0, 300)}`);
    history.push({ role: 'assistant', text: text.slice(0, 6000) }, { role: 'user', text: `That answer has problems: ${error}\nReply with the corrected JSON object only.` });
  }
  return { ok: false, error };
}
