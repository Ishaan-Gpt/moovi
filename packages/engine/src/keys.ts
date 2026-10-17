/**
 * Bring your own model. Every user thinks on their OWN model API key (Gemini, Groq, OpenAI, Anthropic, OpenRouter, …,
 * or a local Ollama): they enter it once in the studio, it is checked against the provider's live model list, the
 * three tiers are chosen from the models that key can actually use, and every job of theirs runs inside that model's
 * scope (runtime/index.ts withModel). The key is stored encrypted (AES-256-GCM) under data/users/<id>/, with a server
 * secret (MOOVI_SECRET, else a random one created once in data/.secret, never committed). It never leaves the server:
 * the studio only ever sees the provider and the key's last four characters.
 *
 * MOOVI_BYOK=required (default): a user without a key is asked for one before the crew starts.
 * MOOVI_BYOK=optional: such a user runs on this machine's configured model (MOOVI_RUNTIME) instead.
 */
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { config } from './config';
import { httpRuntime, listModels } from './runtime/http';
import { PRESETS, PROVIDERS, pickModel, type Provider } from './runtime/providers';
import type { ModelScope, Tier } from './runtime/index';
import type { CompleteRequest, Runtime } from './runtime/types';

export interface ModelChoice { provider: Provider; key: string; baseUrl?: string; models: Record<Tier, string>; checkedAt: number }
export interface ModelInfo { provider: Provider; label: string; last4: string; models: Record<Tier, string>; checkedAt: number }

/** What the studio's form offers, in order, with where to get a key. */
export const PROVIDER_CHOICES: { id: Provider; label: string; keyUrl?: string; hint: string; needsKey: boolean; needsBase?: boolean }[] = [
  { id: 'gemini', label: 'Google Gemini', keyUrl: 'https://aistudio.google.com/apikey', hint: 'Free key from Google AI Studio.', needsKey: true },
  { id: 'groq', label: 'Groq', keyUrl: 'https://console.groq.com/keys', hint: 'Free key; very fast.', needsKey: true },
  { id: 'openai', label: 'OpenAI', keyUrl: 'https://platform.openai.com/api-keys', hint: 'Paid key.', needsKey: true },
  { id: 'anthropic', label: 'Anthropic (Claude)', keyUrl: 'https://console.anthropic.com/settings/keys', hint: 'Paid key; draws the best pictures.', needsKey: true },
  { id: 'openrouter', label: 'OpenRouter', keyUrl: 'https://openrouter.ai/keys', hint: 'One key, hundreds of models.', needsKey: true },
  { id: 'deepseek', label: 'DeepSeek', keyUrl: 'https://platform.deepseek.com/api_keys', hint: '', needsKey: true },
  { id: 'mistral', label: 'Mistral', keyUrl: 'https://console.mistral.ai/api-keys', hint: '', needsKey: true },
  { id: 'together', label: 'Together AI', keyUrl: 'https://api.together.ai/settings/api-keys', hint: '', needsKey: true },
  { id: 'xai', label: 'xAI (Grok)', keyUrl: 'https://console.x.ai', hint: '', needsKey: true },
  { id: 'cerebras', label: 'Cerebras', keyUrl: 'https://cloud.cerebras.ai', hint: '', needsKey: true },
  { id: 'ollama', label: 'Ollama (a model on this server)', hint: 'No key; the server runs the model.', needsKey: false },
  { id: 'compatible', label: 'Any OpenAI-compatible API', hint: 'Its base URL and key.', needsKey: true, needsBase: true },
];
/** The choices this server offers: Ollama only where an Ollama server is configured (OLLAMA_HOST or MOOVI_PROVIDER=ollama). */
export const providerChoices = () => PROVIDER_CHOICES.filter(c => c.id !== 'ollama' || !!process.env.OLLAMA_HOST?.trim() || config.provider === 'ollama');
const labelOf = (p: Provider) => PROVIDER_CHOICES.find(c => c.id === p)?.label ?? p;

export const byokMode = (): 'required' | 'optional' => (process.env.MOOVI_BYOK?.trim().toLowerCase() === 'optional' ? 'optional' : 'required');

/* ───────── the server secret and the sealed file ───────── */

function secret(): Buffer {
  const env = process.env.MOOVI_SECRET?.trim();
  if (env) return createHash('sha256').update(env).digest();
  const f = join(config.data, '.secret');
  if (!existsSync(f)) { mkdirSync(dirname(f), { recursive: true }); writeFileSync(f, randomBytes(32).toString('base64'), { mode: 0o600 }); }
  return createHash('sha256').update(readFileSync(f, 'utf8').trim()).digest();
}
const seal = (plain: string) => { const iv = randomBytes(12), c = createCipheriv('aes-256-gcm', secret(), iv); const ct = Buffer.concat([c.update(plain, 'utf8'), c.final()]); return Buffer.concat([iv, c.getAuthTag(), ct]).toString('base64'); };
const open = (sealed: string) => { const b = Buffer.from(sealed, 'base64'), d = createDecipheriv('aes-256-gcm', secret(), b.subarray(0, 12)); d.setAuthTag(b.subarray(12, 28)); return Buffer.concat([d.update(b.subarray(28)), d.final()]).toString('utf8'); };
const fileOf = (user: string) => { if (!/^[\w-]{1,64}$/.test(user)) throw new Error('bad user id'); return join(config.data, 'users', user, 'model.json'); };

/** The user's model, decrypted (engine-side only; never sent to a browser). */
export function loadModel(user: string): ModelChoice | null {
  try {
    const f = fileOf(user); if (!existsSync(f)) return null;
    const j = JSON.parse(readFileSync(f, 'utf8')) as Omit<ModelChoice, 'key'> & { key: string };
    return { ...j, key: j.key ? open(j.key) : '' };
  } catch (e) { console.warn(`[engine] the model settings of ${user} could not be read (${String(e).slice(0, 80)})`); return null; }
}
/** What the studio may show: provider, the key's last four characters, the tier models, when it was checked. */
export function modelInfo(user: string): ModelInfo | null {
  const m = loadModel(user); if (!m) return null;
  return { provider: m.provider, label: labelOf(m.provider), last4: m.key ? m.key.slice(-4) : '', models: m.models, checkedAt: m.checkedAt };
}
export function clearModel(user: string) { rmSync(fileOf(user), { force: true }); cache.delete(user); }

/**
 * Check a key against the provider (its live model list: a refused key fails here), choose the three tiers from the
 * models it can use (the preset's when available, else the best live match), and save it sealed. Returns what the
 * studio shows, or a plain error.
 */
export async function setModel(user: string, o: { provider: string; key?: string; baseUrl?: string }, f: typeof fetch = fetch): Promise<{ ok: true; info: ModelInfo } | { ok: false; error: string }> {
  const provider = o.provider as Provider;
  if (!PROVIDERS.includes(provider) || !providerChoices().some(c => c.id === provider)) return { ok: false, error: 'Pick a provider from the list.' };
  const choice = PROVIDER_CHOICES.find(c => c.id === provider)!;
  const key = (o.key ?? '').trim();
  if (choice.needsKey && key.length < 8) return { ok: false, error: `Paste your ${choice.label} API key.` };
  if (/\s/.test(key)) return { ok: false, error: 'That key has spaces in it; paste just the key.' };
  const baseUrl = (o.baseUrl ?? '').trim() || undefined;
  if (choice.needsBase && !/^https?:\/\/\S+$/.test(baseUrl ?? '')) return { ok: false, error: 'Add the API’s base URL (https://…/v1).' };
  let live: { id: string; context?: number }[];
  try { live = await listModels({ provider, key, baseUrl, fetch: f }); }
  catch (e) {
    const cause = e instanceof Error && e.cause ? ` (${String((e.cause as Error).message ?? e.cause).slice(0, 120)})` : '';
    const m = String(e instanceof Error ? e.message : e) + cause;
    console.warn(`[engine] model key check for ${user} on ${provider} failed: ${m.slice(0, 200)}`);
    return { ok: false, error: /\b(401|403)\b|refused|invalid|unauthor/i.test(m) ? `${choice.label} refused that key. Check it and paste it again.` : /ECONNREFUSED|fetch failed|ENOTFOUND|timeout/i.test(m) ? `Could not reach ${choice.label} from the server${cause}. Try again in a moment.` : `${choice.label} answered: ${m.slice(0, 160)}` };
  }
  const ids = new Set(live.map(m => m.id));
  const tier = (t: Tier) => { const want = PRESETS[provider].models[t]; return want !== 'auto' && want !== 'default' && ids.has(want) ? want : pickModel(live, t, want); };
  const models = { director: tier('director'), crew: tier('crew'), fast: tier('fast') };
  if (!models.director || !models.crew || !models.fast) return { ok: false, error: `${choice.label} accepted the key but offers no chat model it can use.` };
  const record = { provider, baseUrl, models, checkedAt: Date.now(), key: key ? seal(key) : '' };
  mkdirSync(dirname(fileOf(user)), { recursive: true });
  writeFileSync(fileOf(user), JSON.stringify(record, null, 1), { mode: 0o600 });
  cache.delete(user);
  return { ok: true, info: modelInfo(user)! };
}

/* ───────── the scope a job runs in ───────── */

const cache = new Map<string, { sig: string; scope: ModelScope }>();
/**
 * The model scope for a user's job: their own key's runtime (one per user, kept, so its pacing is per user), or null
 * when they have none (the caller asks for a key, or under MOOVI_BYOK=optional uses the machine's runtime).
 */
export function scopeFor(user: string | null | undefined): ModelScope | null {
  if (!user) return null;
  const own = ownScope(user);
  // the Claude Code bridge goes first when the user's Claude Code is connected (Ishaan, DECISIONS.md 2); it returns
  // null otherwise, and a bridge fault never stops a job that has the user's own key
  if (brainSource) { try { const b = brainSource(user, own); if (b) return b; } catch (e) { console.warn(`[engine] brain scope: ${e instanceof Error ? e.message : e}`); } }
  return own;
}

/**
 * The Claude Code bridge (packages/mcp) registers here: given the user and their own key's scope (or null), it returns
 * a scope whose runtime is the lane switch (runtime/lane.ts laneRuntime: brain calls to Claude Code, detail calls to
 * the key or the server model), or null when this user has no Claude Code connected. One source; null unregisters.
 */
export type BrainScopeSource = (user: string, own: ModelScope | null) => ModelScope | null;
let brainSource: BrainScopeSource | null = null;
export function registerBrainScope(fn: BrainScopeSource | null) { brainSource = fn; }

function ownScope(user: string): ModelScope | null {
  const m = loadModel(user); if (!m) return null;
  const sig = createHash('sha256').update(JSON.stringify([m.provider, m.key, m.baseUrl, m.models])).digest('hex');
  const hit = cache.get(user); if (hit?.sig === sig) return hit.scope;
  const scope: ModelScope = {
    runtime: withServerFallback(httpRuntime({ provider: m.provider, key: m.key || undefined, baseUrl: m.baseUrl, models: m.models }), m.models),
    models: m.models, provider: m.provider,
    deadlineScale: m.provider === 'ollama' ? 4 : 1,
    drawsWell: m.provider === 'anthropic',
    audio: (m.provider === 'groq' || m.provider === 'openai') && m.key ? { provider: m.provider, key: m.key } : undefined,
  };
  cache.set(user, { sig, scope });
  return scope;
}

/**
 * The server's own model as a safety net: when a user's key is refused or out of quota mid-job, that one request runs
 * again on this machine's configured model (MOOVI_RUNTIME=http with its provider's key; MOOVI_FALLBACK=0 turns it
 * off). The same tier is used, so a director call stays a director call.
 */
export const keyFailure = (e: unknown) => /\b(401|403|429)\b|invalid.{0,20}key|key not valid|API_KEY_INVALID|unauthori|permission|quota|daily limit|rate limit|insufficient|billing|exhausted/i.test(e instanceof Error ? e.message : String(e));
let server: Runtime | null | undefined;
const serverRuntime = (): Runtime | null => {
  if (server !== undefined) return server;
  const own = process.env[`${config.provider.toUpperCase()}_API_KEY`]?.trim();
  return (server = process.env.MOOVI_FALLBACK !== '0' && config.runtime === 'http' && (own || config.provider === 'ollama') ? httpRuntime() : null);
};
/** this machine's own model (null when none is configured): the bridge's server lane for detail work */
export const serverModel = (): Runtime | null => serverRuntime();
export function withServerFallback(rt: Runtime, models: Record<Tier, string>): Runtime {
  const tierOf = (id: string) => (Object.keys(models) as Tier[]).find(t => models[t] === id) ?? 'crew';
  const retry = async <T>(what: string, id: string, signal: AbortSignal | undefined, first: () => Promise<T>, again: (s: Runtime, model: string) => Promise<T>) => {
    try { return await first(); }
    catch (e) {
      const s = serverRuntime();
      if (!s || signal?.aborted || !keyFailure(e)) throw e;
      const model = config.models[tierOf(id)];
      console.warn(`[engine] ${what}: the user's model failed (${String(e instanceof Error ? e.message : e).slice(0, 120)}); using the server's ${model}`);
      return again(s, model);
    }
  };
  return {
    name: rt.name, vision: rt.vision,
    run: req => retry(req.agent, req.model ?? '', req.signal, () => rt.run(req), (s, model) => s.run({ ...req, model })),
    ...(rt.complete ? { complete: (req: CompleteRequest) => retry(req.agent, req.model, undefined, () => rt.complete!(req), (s, model) => (s.complete ? s.complete({ ...req, model }) : Promise.reject(new Error('no fallback')))) } : {}),
  };
}

/** Thrown when a user without a model starts work under MOOVI_BYOK=required: the chat shows this and links Settings. */
export class NeedsModelKey extends Error { constructor() { super('Add your model API key first (Settings → Your model). Any of Gemini, Groq, OpenAI, Claude, OpenRouter and more works.'); this.name = 'NeedsModelKey'; } }
