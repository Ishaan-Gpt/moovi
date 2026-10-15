import { z } from 'zod';
import { config } from '../config';
import { coerce, describeShape, extractJson } from './coerce';
import { keyOf, pickModel, PRESETS, type JsonMode, type Provider, type Wire } from './providers';
import { callTool, jsonSchema, resultText, type Tool, type ToolResult } from './tool';
import type { AgentRequest, AgentResult, CompleteRequest, Runtime } from './types';

/**
 * Our own tool-calling loop over plain HTTP, for ANY model API (./providers.ts): Anthropic, OpenAI and every
 * OpenAI-compatible endpoint (Groq, OpenRouter, DeepSeek, Mistral, Together, xAI, Cerebras…), Gemini, and a local
 * Ollama. One internal transcript; one small adapter per wire. Same tools, budgets and done-checks as the Claude
 * Code runtime, and built for models far weaker than Claude:
 *  - tools are native where the model has them and EMULATED (a JSON reply naming the tool) where it does not, or
 *    where the API rejects them; a model that answers with the submit JSON directly is understood too;
 *  - `complete()` asks for one JSON answer with the strongest constraint the API has (a JSON Schema the decoder must
 *    follow, else JSON mode, else the prompt), downgrading by itself when an API refuses a mode;
 *  - malformed tool calls (Groq's tool_use_failed, `<function=x>{…}</function>` in the text) are parsed, not lost;
 *  - every API is paced (calls in flight per provider) and 429s wait for the time the API asks for.
 */
export type { Provider } from './providers';

type Part =
  | { type: 'text'; text: string }
  | { type: 'call'; id: string; name: string; args: unknown }
  | { type: 'result'; id: string; name: string; result: ToolResult };
interface Msg { role: 'user' | 'assistant'; parts: Part[] }
interface Reply { text: string; calls: { id: string; name: string; args: unknown }[] }
interface SendOpts { tools?: Tool[]; json?: { mode: JsonMode; schema?: Record<string, unknown> }; signal: AbortSignal }
interface Adapter { send(model: string, system: string, msgs: Msg[], o: SendOpts): Promise<Reply> }

/** An HTTP error with its status and body (adapters read Groq's failed_generation from it). */
class ApiError extends Error { constructor(public status: number, public body: string, public retryAfter: number | null) { super(`HTTP ${status}${status === 401 || status === 403 ? ' (the API key was refused)' : status === 404 ? ' (unknown model or endpoint)' : ''}: ${body.slice(0, 300)}`); } }

/** What we learned a model can do (a 400 on tools or a JSON mode downgrades it for the rest of the process). */
const caps = new Map<string, { tools: 'native' | 'emulated'; json: JsonMode }>();

/**
 * A provider's live chat-capable models. Also the cheapest proof that a key works (a refused key is a 401/403 here),
 * which is how a user's own key is checked before it is saved (../keys.ts).
 */
export async function listModels(o: { provider: Provider; key?: string; baseUrl?: string; fetch?: typeof fetch }): Promise<{ id: string; context?: number }[]> {
  const preset = PRESETS[o.provider], f = o.fetch ?? fetch, key = o.key ?? '';
  const base = (o.baseUrl || preset.base).replace(/\/$/, '');
  const get = async (u: string, h: Record<string, string> = {}) => { const r = await f(u, { headers: h, signal: AbortSignal.timeout(15_000) }); if (!r.ok) throw new ApiError(r.status, await r.text(), null); return r.json() as Promise<Record<string, unknown>>; };
  if (preset.wire === 'gemini') return ((await get(`${base}/models?key=${encodeURIComponent(key)}&pageSize=200`)).models as { name: string; inputTokenLimit?: number; supportedGenerationMethods?: string[] }[] ?? []).filter(m => m.supportedGenerationMethods?.includes('generateContent')).map(m => ({ id: m.name.replace(/^models\//, ''), context: m.inputTokenLimit }));
  if (preset.wire === 'ollama') return ((await get(`${base}/api/tags`)).models as { name: string }[] ?? []).map(m => ({ id: m.name }));
  const h: Record<string, string> = preset.wire === 'anthropic' ? { 'x-api-key': key, 'anthropic-version': '2023-06-01' } : key ? { authorization: `Bearer ${key}` } : {};
  return ((await get(`${base}/models`, h)).data as { id: string; context_window?: number; active?: boolean }[] ?? []).filter(m => m.active !== false).map(m => ({ id: m.id, context: m.context_window }));
}

export function httpRuntime(opts: { provider?: Provider; key?: string; baseUrl?: string; fetch?: typeof fetch; models?: { director: string; crew: string; fast: string } } = {}): Runtime {
  const provider = opts.provider ?? config.provider;
  const preset = PRESETS[provider];
  const key = opts.key ?? keyOf(provider);
  const base = (opts.baseUrl ?? config.baseUrl ?? preset.base).replace(/\/$/, '');
  const f = opts.fetch ?? fetch;
  if (!key && preset.keys.length && provider !== 'compatible' && !opts.fetch) throw new Error(`No API key for ${provider}: set ${preset.keys.join(' or ')} (or CE_RUNTIME=claude-code to use this machine's Claude Code login).`);
  if (!base) throw new Error('CE_BASE_URL is needed for a compatible endpoint.');
  const wire: Wire = preset.wire;
  const adapter: Adapter = wire === 'anthropic' ? anthropic(f, base, key ?? '') : wire === 'gemini' ? gemini(f, base, key ?? '') : wire === 'ollama' ? ollama(f, base) : openai(f, base, key ?? '', provider);
  const gate = semaphore(Number(process.env.CE_MAX_CONCURRENCY) || preset.concurrency);
  const capOf = (model: string) => { const k = `${provider}:${model}`; if (!caps.has(k)) caps.set(k, { tools: preset.tools, json: preset.json }); return caps.get(k)!; };
  let autoModel: Promise<string> | null = null;
  const resolveModel = async (m: string) => {
    if (wire !== 'ollama' || (m && m !== 'auto')) return m;
    autoModel ??= f(`${base}/api/tags`).then(r => r.json() as Promise<{ models?: { name: string; size: number }[] }>).then(j => { const ms = (j.models ?? []).sort((a, b) => b.size - a.size); if (!ms.length) throw new Error('Ollama has no models: run `ollama pull llama3.2` (or any model) first.'); return ms[0]!.name; });
    return autoModel;
  };

  /** The provider's live chat models (asked once), for replacing a retired model id. */
  let live: Promise<{ id: string; context?: number }[]> | null = null;
  const liveModels = () => live ??= listModels({ provider, key, baseUrl: base, fetch: f }).catch(e => { live = null; throw e; });
  /** retired id → the live model that plays its tier (kept for the whole process) */
  const alias = new Map<string, string>();
  const tiers = opts.models ?? config.models;
  const tierOf = (m: string): 'director' | 'crew' | 'fast' => (m === tiers.fast ? 'fast' : m === tiers.director ? 'director' : 'crew');

  /** One model turn, paced and retried, with automatic downgrades (tools → emulated, schema → object → none). */
  async function turn(model0: string, system: string, msgs: Msg[], tools: Tool[], json: JsonMode | null, schema: Record<string, unknown> | undefined, signal: AbortSignal): Promise<Reply> {
    let model = alias.get(model0) ?? model0;
    let cap = capOf(model);
    for (let guard = 0; guard < 5; guard++) {
      const emulate = tools.length > 0 && cap.tools === 'emulated';
      const mode: JsonMode | null = json ? lower(json, cap.json) : emulate ? lower('object', cap.json) : null;
      const sys = emulate ? `${system}\n\n${toolProtocol(tools)}` : system;
      const m = emulate || wire === 'ollama' && tools.length ? flatten(msgs) : msgs;
      try {
        const r = await gate(() => retry(() => adapter.send(model, sys, m, { tools: emulate ? undefined : tools.length ? tools : undefined, json: mode && mode !== 'none' ? { mode, schema } : undefined, signal }), signal));
        return emulate ? readEmulated(r, tools) : salvage(r, tools);
      } catch (e) {
        // a retired / unknown model id: the provider's live list names its replacement (once per id)
        if (e instanceof ApiError && (e.status === 404 || e.status === 400) && /model[^.]{0,80}(not[ _]found|does not exist|decommission|deprecat|not supported|unknown|invalid)|model_not_found|model_decommissioned/i.test(e.body) && !alias.has(model0)) {
          const next = pickModel(await liveModels(), tierOf(model0), model0);
          if (next && next !== model) { console.warn(`[engine] ${provider}: model "${model}" is gone; using "${next}" for the ${tierOf(model0)} tier`); alias.set(model0, next); model = next; cap = capOf(model); continue; }
        }
        if (!(e instanceof ApiError) || e.status !== 400) throw e;
        const b = e.body.toLowerCase();
        if (tools.length && cap.tools === 'native' && /tool_use_failed/.test(b)) { const rep = failedGeneration(e.body, tools); if (rep) return rep; }
        if (tools.length && cap.tools === 'native' && /tool|function/.test(b)) { cap.tools = 'emulated'; continue; }
        if (mode === 'schema' && /schema|response_format|json|mime/.test(b)) { cap.json = 'object'; continue; }
        if (mode === 'object' && /response_format|json|mime/.test(b)) { cap.json = 'none'; continue; }
        throw e;
      }
    }
    throw new Error('the API refused every request shape');
  }

  return {
    name: `http:${provider}`,
    vision: true,
    async run(req: AgentRequest): Promise<AgentResult> {
      const t0 = Date.now();
      const abort = new AbortController();
      const onAbort = () => abort.abort();
      req.signal?.addEventListener('abort', onAbort);
      const timer = setTimeout(() => abort.abort(), req.deadlineMs);
      const msgs: Msg[] = [{ role: 'user', parts: [{ type: 'text', text: req.prompt }] }];
      let turns = 0, calls = 0, text = '', nudged = false;
      let stopped: AgentResult['stopped'] = 'end';
      try {
        const model = await resolveModel(req.model);
        while (true) {
          if (turns >= req.maxTurns) { stopped = 'turns'; break; }
          const reply = await turn(model, req.system, msgs, req.tools, null, undefined, abort.signal);
          turns++;
          if (reply.text.trim()) { text = reply.text.trim(); req.onText?.(text); }
          msgs.push({ role: 'assistant', parts: [...(reply.text ? [{ type: 'text' as const, text: reply.text }] : []), ...reply.calls.map(c => ({ type: 'call' as const, ...c }))] });
          if (!reply.calls.length) {
            // a model that stopped without calling the tool that ends its task gets one plain reminder
            const ender = req.tools.find(t => t.ends);
            if (ender && !nudged && turns < req.maxTurns) { nudged = true; msgs.push({ role: 'user', parts: [{ type: 'text', text: `You have not called ${ender.name} yet. Call it now with your answer.` }] }); continue; }
            break;
          }
          const results: Part[] = [];
          let ended = false;
          for (const c of reply.calls) {
            const t = req.tools.find(x => x.name === c.name);
            const s = Date.now();
            const r: ToolResult = t ? await callTool(t, c.args, { signal: abort.signal, note: n => req.onNote?.(n) }) : { error: `There is no tool named ${c.name}. Tools: ${req.tools.map(x => x.name).join(', ')}` };
            calls++;
            req.onTool?.(c.name, c.args, r, Date.now() - s);
            results.push({ type: 'result', id: c.id, name: c.name, result: r });
            if (t?.ends && !r.error) ended = true;
          }
          msgs.push({ role: 'user', parts: results });
          if (ended) { stopped = 'finished'; break; }
        }
      } catch (e) {
        if (abort.signal.aborted) stopped = req.signal?.aborted ? 'aborted' : 'deadline';
        else throw new Error(`${req.agent} (${provider}, ${req.model}): ${e instanceof Error ? e.message : String(e)}`);
      } finally {
        clearTimeout(timer);
        req.signal?.removeEventListener('abort', onAbort);
      }
      return { text, turns, calls, stopped, ms: Date.now() - t0 };
    },

    /** One JSON answer under the strongest constraint the API offers; repair turns carry the exact problems back. */
    async complete(req: CompleteRequest) {
      const abort = new AbortController();
      const onAbort = () => abort.abort();
      req.signal?.addEventListener('abort', onAbort);
      const timer = setTimeout(() => abort.abort(), req.deadlineMs);
      try {
        const model = await resolveModel(req.model);
        const schema = req.schema ? jsonSchema({ name: 'answer', description: '', input: req.schema, run: async () => ({}) }) : undefined;
        const msgs: Msg[] = [{ role: 'user', parts: [{ type: 'text', text: req.prompt }] }, ...(req.history ?? []).map(h => ({ role: h.role, parts: [{ type: 'text' as const, text: h.text }] }))];
        const r = await turn(model, req.system, msgs, [], req.schema ? 'schema' : null, schema, abort.signal);
        return r.text;
      } catch (e) {
        if (abort.signal.aborted) throw new Error(`${req.agent}: ${req.signal?.aborted ? 'cancelled' : `deadline ${req.deadlineMs / 1000} s`}`);
        throw new Error(`${req.agent} (${provider}, ${req.model}): ${e instanceof Error ? e.message : String(e)}`);
      } finally { clearTimeout(timer); req.signal?.removeEventListener('abort', onAbort); }
    },
  };
}

const order: JsonMode[] = ['schema', 'object', 'none'];
const lower = (a: JsonMode, b: JsonMode): JsonMode => order[Math.max(order.indexOf(a), order.indexOf(b))]!;

/** At most `n` calls in flight (a free tier or a local model would otherwise 429 or thrash). */
function semaphore(n: number) {
  let busy = 0; const q: (() => void)[] = [];
  return async <T>(fn: () => Promise<T>): Promise<T> => {
    if (busy >= n) await new Promise<void>(r => q.push(r));
    busy++;
    try { return await fn(); } finally { busy--; q.shift()?.(); }
  };
}

/** 429 / 5xx / network hiccups: wait (the API's own retry-after when it gives one) and try again, up to 6 times. */
async function retry<T>(fn: () => Promise<T>, signal: AbortSignal): Promise<T> {
  let last: unknown;
  for (let i = 0; i < 6; i++) {
    try { return await fn(); } catch (e) {
      last = e;
      const m = String(e instanceof Error ? e.message : e);
      // a daily quota is not a wait: say so at once (retrying for minutes would only hold the film up)
      if (/per day|TPD|RPD|daily (limit|quota)|insufficient_quota|exceeded your current quota/i.test(m)) throw new Error(`the API key's daily limit is used up for this model (${m.slice(0, 160)}): it resets tomorrow, or use another key / provider`);
      const transient = e instanceof ApiError ? e.status === 429 || e.status >= 500 : /\b(429|5\d\d)\b|ECONNRESET|ETIMEDOUT|ECONNREFUSED|fetch failed|overloaded|socket/i.test(m);
      if (signal.aborted || !transient) throw e;
      const wait = Math.min(60_000, e instanceof ApiError && e.retryAfter != null ? e.retryAfter + 250 : 1500 * 2 ** i);
      if (process.env.CE_DEBUG_HTTP) console.warn(`[http] retry ${i + 1} in ${(wait / 1000).toFixed(1)} s after: ${m.slice(0, 200)}`);
      await new Promise<void>((res, rej) => { const t = setTimeout(res, wait); signal.addEventListener('abort', () => { clearTimeout(t); rej(new Error('aborted')); }, { once: true }); });
    }
  }
  throw last;
}

/** Seconds/ms the API asks us to wait: retry-after, Groq's x-ratelimit-reset-*, Gemini's retryDelay in the body. */
function retryAfterOf(h: Headers, body: string): number | null {
  const ra = h.get('retry-after'); if (ra && Number.isFinite(Number(ra))) return Number(ra) * 1000;
  const dur = (s: string | null) => { if (!s) return null; let ms = 0; for (const [, n, u] of s.matchAll(/([\d.]+)\s*(ms|s|m|h)/g)) ms += Number(n) * (u === 'ms' ? 1 : u === 's' ? 1000 : u === 'm' ? 60_000 : 3_600_000); return ms || null; };
  const g = /"retryDelay"\s*:\s*"([\d.]+)s"/.exec(body); if (g) return Number(g[1]) * 1000;
  return dur(h.get('x-ratelimit-reset-tokens')) ?? dur(h.get('x-ratelimit-reset-requests'));
}

async function post(f: typeof fetch, url: string, headers: Record<string, string>, body: unknown, signal: AbortSignal) {
  const r = await f(url, { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: JSON.stringify(body), signal });
  const txt = await r.text();
  if (!r.ok) throw new ApiError(r.status, txt, r.headers ? retryAfterOf(r.headers, txt) : null);
  return JSON.parse(txt) as Record<string, unknown>;
}

/* ───────── tools for models without (reliable) tool calling ───────── */

/** The tools as words: a model calls one by replying with a JSON object. */
function toolProtocol(tools: Tool[]): string {
  const ender = tools.find(t => t.ends);
  return `TOOLS. To use a tool, reply with ONLY one JSON object, no other text: {"tool": "<tool name>", "args": { ...its arguments... }}\nOne tool per reply; you will get its result back.${ender ? ` When you have the answer, call "${ender.name}".` : ''}\n${tools.map(t => `\nTool "${t.name}": ${t.description}\nargs: ${describeShape(t.input)}`).join('\n')}`;
}

/** The transcript as plain text turns (for emulated tools and APIs that only take text). */
function flatten(msgs: Msg[]): Msg[] {
  return msgs.map(m => ({
    role: m.role,
    parts: m.parts.flatMap((p): Part[] => p.type === 'text' ? [p]
      : p.type === 'call' ? (m.parts.some(q => q.type === 'text') ? [] : [{ type: 'text', text: JSON.stringify({ tool: p.name, args: p.args }) }])
      : [{ type: 'text', text: `Result of ${p.name}: ${resultText(p.result)}` }, ...(p.result.images?.length ? [p] : [])]),
  }));
}

const NAME_KEYS = ['tool', 'name', 'function', 'tool_name', 'action'];
const ARG_KEYS = ['args', 'arguments', 'parameters', 'input', 'params'];
/** A reply in the emulated protocol → tool calls. The answer JSON on its own counts as a call to the ending tool. */
function readEmulated(r: Reply, tools: Tool[]): Reply {
  if (r.calls.length) return r;
  const j = extractJson(r.text);
  const objs = Array.isArray(j) ? j : j && typeof j === 'object' ? [j] : [];
  const calls: Reply['calls'] = [];
  for (const o of objs as Record<string, unknown>[]) {
    if (!o || typeof o !== 'object') continue;
    const nk = NAME_KEYS.find(k => typeof o[k] === 'string' && tools.some(t => t.name.toLowerCase() === String(o[k]).toLowerCase()));
    if (nk) {
      const t = tools.find(x => x.name.toLowerCase() === String(o[nk]).toLowerCase())!;
      const ak = ARG_KEYS.find(k => o[k] !== undefined);
      let args = ak ? o[ak] : Object.fromEntries(Object.entries(o).filter(([k]) => k !== nk));
      if (typeof args === 'string') args = extractJson(args) ?? args;
      calls.push({ id: `e${Date.now()}${calls.length}`, name: t.name, args });
      continue;
    }
    // no tool named: the answer itself, for the tool that ends the task (when its keys are there)
    const ender = tools.find(t => t.ends);
    if (ender) { const keys = Object.keys(ender.input).map(k => k.toLowerCase()); if (Object.keys(o).some(k => keys.includes(k.toLowerCase())) || keys.length === 1) calls.push({ id: `e${Date.now()}`, name: ender.name, args: o }); }
  }
  return { text: r.text, calls };
}

/** Native tool APIs where the model wrote the call as text anyway (Llama's `<function=x>{…}</function>`, a bare JSON). */
function salvage(r: Reply, tools: Tool[]): Reply {
  if (r.calls.length || !tools.length || !r.text) return r;
  const fn = /<function[=\s]*["']?(\w+)["']?\s*>?\s*(\{[\s\S]*?\})\s*(?:<\/function>|$)/i.exec(r.text);
  if (fn && tools.some(t => t.name === fn[1])) { const args = extractJson(fn[2]!); if (args) return { text: r.text.replace(fn[0], '').trim(), calls: [{ id: `s${Date.now()}`, name: fn[1]!, args }] }; }
  const em = readEmulated({ text: r.text, calls: [] }, tools);
  return em.calls.length ? em : r;
}

/** Groq answers 400 tool_use_failed with the model's broken call in failed_generation: read it instead of failing. */
function failedGeneration(body: string, tools: Tool[]): Reply | null {
  try {
    const g = (JSON.parse(body) as { error?: { failed_generation?: string } }).error?.failed_generation;
    if (!g) return null;
    const r = salvage({ text: g, calls: [] }, tools);
    return r.calls.length ? r : null;
  } catch { return null; }
}

/* ───────── Anthropic ───────── */
function anthropic(f: typeof fetch, base: string, key: string): Adapter {
  return {
    async send(model, system, msgs, o) {
      const messages = msgs.map(m => ({
        role: m.role,
        content: m.parts.map(p => p.type === 'text' ? { type: 'text', text: p.text }
          : p.type === 'call' ? { type: 'tool_use', id: p.id, name: p.name, input: p.args ?? {} }
          : { type: 'tool_result', tool_use_id: p.id, is_error: !!p.result.error, content: [{ type: 'text', text: resultText(p.result) }, ...(p.result.images ?? []).map(i => ({ type: 'image', source: { type: 'base64', media_type: i.mime, data: i.data } }))] }),
      }));
      const sys = o.json ? `${system}\n\nReply with the JSON object only.` : system;
      const j = await post(f, `${base}/messages`, { 'x-api-key': key, 'anthropic-version': '2023-06-01' }, { model, max_tokens: 8000, system: sys, messages, ...(o.tools ? { tools: o.tools.map(t => ({ name: t.name, description: t.description, input_schema: jsonSchema(t) })) } : {}) }, o.signal);
      const content = (j.content as { type: string; text?: string; id?: string; name?: string; input?: unknown }[]) ?? [];
      return { text: content.filter(c => c.type === 'text').map(c => c.text ?? '').join('\n'), calls: content.filter(c => c.type === 'tool_use').map(c => ({ id: c.id!, name: c.name!, args: c.input })) };
    },
  };
}

/* ───────── OpenAI and every compatible API ───────── */
function openaiMessages(system: string, msgs: Msg[]) {
  const messages: Record<string, unknown>[] = [{ role: 'system', content: system }];
  for (const m of msgs) {
    if (m.role === 'assistant') {
      const calls = m.parts.filter(p => p.type === 'call') as Extract<Part, { type: 'call' }>[];
      messages.push({ role: 'assistant', content: m.parts.filter(p => p.type === 'text').map(p => (p as { text: string }).text).join('\n') || (calls.length ? null : ''), ...(calls.length ? { tool_calls: calls.map(c => ({ id: c.id, type: 'function', function: { name: c.name, arguments: JSON.stringify(c.args ?? {}) } })) } : {}) });
      continue;
    }
    const results = m.parts.filter(p => p.type === 'result') as Extract<Part, { type: 'result' }>[];
    const native = results.filter(r => !m.parts.some(p => p.type === 'text' && p.text.startsWith(`Result of ${r.name}:`)));
    for (const r of native) messages.push({ role: 'tool', tool_call_id: r.id, content: resultText(r.result) });
    const images = results.flatMap(r => r.result.images ?? []);
    const texts = m.parts.filter(p => p.type === 'text') as Extract<Part, { type: 'text' }>[];
    if (texts.length || images.length) messages.push({ role: 'user', content: images.length ? [...texts.map(t => ({ type: 'text', text: t.text })), { type: 'text', text: 'The images the tools returned:' }, ...images.map(i => ({ type: 'image_url', image_url: { url: `data:${i.mime};base64,${i.data}` } }))] : texts.map(t => t.text).join('\n\n') });
  }
  return messages;
}
function openai(f: typeof fetch, base: string, key: string, provider: Provider): Adapter {
  return {
    async send(model, system, msgs, o) {
      const headers: Record<string, string> = key ? { authorization: `Bearer ${key}` } : {};
      if (provider === 'openrouter') Object.assign(headers, { 'x-title': 'ContentEasy' });
      const rf = o.json?.mode === 'schema' && o.json.schema ? { response_format: { type: 'json_schema', json_schema: { name: 'answer', schema: o.json.schema, strict: false } } } : o.json ? { response_format: { type: 'json_object' } } : {};
      const sys = o.json ? `${system}\n\nReply with a JSON object only.` : system; // JSON mode wants the word "JSON" in the prompt
      const j = await post(f, `${base}/chat/completions`, headers, { model, messages: openaiMessages(sys, msgs), ...(o.tools ? { tools: o.tools.map(t => ({ type: 'function', function: { name: t.name, description: t.description, parameters: jsonSchema(t) } })), tool_choice: 'auto' } : {}), ...rf, ...(/gpt-oss/i.test(model) ? { reasoning_effort: 'low' } : {}) }, o.signal);
      const msg = ((j.choices as { message: { content?: string | null; reasoning?: string | null; tool_calls?: { id: string; function: { name: string; arguments: string } }[] } }[])?.[0]?.message) ?? {};
      const calls = (msg.tool_calls ?? []).map(c => { let args: unknown = {}; try { args = JSON.parse(c.function.arguments || '{}'); } catch { args = extractJson(c.function.arguments) ?? { __unparsed: c.function.arguments }; } return { id: c.id, name: c.function.name, args }; });
      // a reasoning model (gpt-oss) can leave the answer empty and put its JSON in the reasoning: read it from there
      return { text: msg.content || (o.json && !calls.length ? msg.reasoning ?? '' : ''), calls };
    },
  };
}

/* ───────── Gemini ───────── */
/** Gemini takes an OpenAPI subset: no $schema / additionalProperties / defaults / patterns / refs, string enums only. */
const geminiSchema = (s: unknown): unknown => {
  if (Array.isArray(s)) return s.map(geminiSchema);
  if (!s || typeof s !== 'object') return s;
  const o: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(s)) if (!['$schema', 'additionalProperties', 'default', 'exclusiveMinimum', 'exclusiveMaximum', 'pattern', '$ref', 'definitions', 'const', 'examples'].includes(k)) o[k] = geminiSchema(v);
  if (Array.isArray(o.type)) o.type = (o.type as string[]).find(t => t !== 'null') ?? 'string';
  return o;
};
function gemini(f: typeof fetch, base: string, key: string): Adapter {
  return {
    async send(model, system, msgs, o) {
      const contents = msgs.map(m => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: m.parts.flatMap((p): Record<string, unknown>[] => p.type === 'text' ? [{ text: p.text }]
          : p.type === 'call' ? [{ functionCall: { name: p.name, args: p.args ?? {} } }]
          : [{ functionResponse: { name: p.name, response: { result: resultText(p.result) } } }, ...(p.result.images ?? []).map(i => ({ inlineData: { mimeType: i.mime, data: i.data } }))]),
      }));
      const gc = o.json ? { generationConfig: { responseMimeType: 'application/json', ...(o.json.mode === 'schema' && o.json.schema ? { responseSchema: geminiSchema(o.json.schema) } : {}) } } : {};
      const j = await post(f, `${base}/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(key)}`, {}, { systemInstruction: { parts: [{ text: system }] }, contents, ...(o.tools ? { tools: [{ functionDeclarations: o.tools.map(t => ({ name: t.name, description: t.description, parameters: geminiSchema(jsonSchema(t)) })) }] } : {}), ...gc }, o.signal);
      const cand = (j.candidates as { content?: { parts?: { text?: string; functionCall?: { name: string; args: unknown } }[] }; finishReason?: string }[])?.[0];
      if (!cand?.content && cand?.finishReason && cand.finishReason !== 'STOP') throw new Error(`Gemini stopped: ${cand.finishReason} (content filter)`);
      const parts = cand?.content?.parts ?? [];
      const calls = parts.filter(p => p.functionCall).map((p, i) => ({ id: `g${Date.now()}${i}`, name: p.functionCall!.name, args: p.functionCall!.args }));
      return { text: parts.filter(p => p.text).map(p => p.text).join('\n'), calls };
    },
  };
}

/* ───────── Ollama (a local model; no key) ───────── */
function ollama(f: typeof fetch, base: string): Adapter {
  return {
    async send(model, system, msgs, o) {
      const messages: Record<string, unknown>[] = [{ role: 'system', content: system }];
      for (const m of msgs) {
        const text = m.parts.map(p => p.type === 'text' ? p.text : p.type === 'call' ? JSON.stringify({ tool: p.name, args: p.args }) : `Result of ${p.name}: ${resultText(p.result)}`).join('\n\n');
        const images = m.parts.flatMap(p => (p.type === 'result' ? p.result.images ?? [] : [])).map(i => i.data);
        messages.push({ role: m.role, content: text, ...(images.length ? { images } : {}) });
      }
      const format = o.json?.mode === 'schema' && o.json.schema ? o.json.schema : o.json ? 'json' : undefined;
      const j = await post(f, `${base}/api/chat`, {}, { model, messages, stream: false, ...(format ? { format } : {}), options: { num_ctx: Number(process.env.CE_OLLAMA_CTX) || 16384, temperature: 0.4, num_predict: 4096 } }, o.signal);
      const msg = (j.message as { content?: string }) ?? {};
      return { text: msg.content ?? '', calls: [] };
    },
  };
}

/** Parse + coerce + check one JSON answer against a zod shape (ask()'s JSON path and its tests use this). */
export function readAnswer<S extends z.ZodRawShape>(text: string, shape: S): { ok: true; value: z.output<z.ZodObject<S>> } | { ok: false; error: string } {
  const raw = extractJson(text);
  if (raw === undefined) return { ok: false, error: 'There was no JSON object in your reply.' };
  const obj = z.object(shape);
  const parsed = obj.safeParse(coerce(obj, raw));
  if (parsed.success) return { ok: true, value: parsed.data };
  return { ok: false, error: parsed.error.issues.slice(0, 8).map(i => `${i.path.join('.') || '(answer)'}: ${i.message}`).join('; ') };
}
