/**
 * Every model API the crew can think on, as data. A preset says where the API is, which key it reads, which models
 * play the three tiers when none are set, how it speaks (wire), and how far it can be trusted: native tool calls or
 * emulated ones, schema-constrained JSON or plain JSON mode, how many calls at once before it rate-limits.
 * Setting one key is enough: `CE_RUNTIME=http CE_PROVIDER=groq GROQ_API_KEY=…` (or leave CE_PROVIDER unset and the
 * first provider with a key is used).
 */
export type Provider = 'anthropic' | 'openai' | 'gemini' | 'groq' | 'openrouter' | 'ollama' | 'deepseek' | 'mistral' | 'together' | 'xai' | 'cerebras' | 'compatible';
export type Wire = 'anthropic' | 'openai' | 'gemini' | 'ollama';
/** schema = the API constrains decoding to our JSON Schema; object = JSON mode (valid JSON, any shape); none = prompt only */
export type JsonMode = 'schema' | 'object' | 'none';

export interface Preset {
  keys: string[];
  base: string;
  wire: Wire;
  models: { director: string; crew: string; fast: string };
  tools: 'native' | 'emulated';
  json: JsonMode;
  /** calls in flight at once (free tiers rate-limit hard; a local model runs one at a time) */
  concurrency: number;
}

export const PRESETS: Record<Provider, Preset> = {
  anthropic: { keys: ['ANTHROPIC_API_KEY'], base: 'https://api.anthropic.com/v1', wire: 'anthropic', models: { director: 'claude-opus-5-5', crew: 'claude-sonnet-5-5', fast: 'claude-haiku-5-5' }, tools: 'native', json: 'none', concurrency: 8 },
  openai: { keys: ['OPENAI_API_KEY'], base: 'https://api.openai.com/v1', wire: 'openai', models: { director: 'gpt-5', crew: 'gpt-5-mini', fast: 'gpt-5-nano' }, tools: 'native', json: 'schema', concurrency: 8 },
  gemini: { keys: ['GEMINI_API_KEY', 'GOOGLE_API_KEY'], base: 'https://generativelanguage.googleapis.com/v1beta', wire: 'gemini', models: { director: 'gemini-2.5-pro', crew: 'gemini-2.5-flash', fast: 'gemini-2.5-flash-lite' }, tools: 'native', json: 'schema', concurrency: 4 },
  groq: { keys: ['GROQ_API_KEY'], base: 'https://api.groq.com/openai/v1', wire: 'openai', models: { director: 'openai/gpt-oss-120b', crew: 'openai/gpt-oss-120b', fast: 'openai/gpt-oss-20b' }, tools: 'native', json: 'schema', concurrency: 3 },
  openrouter: { keys: ['OPENROUTER_API_KEY'], base: 'https://openrouter.ai/api/v1', wire: 'openai', models: { director: 'google/gemini-2.5-pro', crew: 'google/gemini-2.5-flash', fast: 'google/gemini-2.5-flash-lite' }, tools: 'native', json: 'object', concurrency: 6 },
  ollama: { keys: [], base: 'http://127.0.0.1:11434', wire: 'ollama', models: { director: 'auto', crew: 'auto', fast: 'auto' }, tools: 'emulated', json: 'schema', concurrency: 1 },
  deepseek: { keys: ['DEEPSEEK_API_KEY'], base: 'https://api.deepseek.com/v1', wire: 'openai', models: { director: 'deepseek-chat', crew: 'deepseek-chat', fast: 'deepseek-chat' }, tools: 'native', json: 'object', concurrency: 6 },
  mistral: { keys: ['MISTRAL_API_KEY'], base: 'https://api.mistral.ai/v1', wire: 'openai', models: { director: 'mistral-large-latest', crew: 'mistral-medium-latest', fast: 'mistral-small-latest' }, tools: 'native', json: 'object', concurrency: 4 },
  together: { keys: ['TOGETHER_API_KEY'], base: 'https://api.together.xyz/v1', wire: 'openai', models: { director: 'meta-llama/Llama-3.3-70B-Instruct-Turbo', crew: 'meta-llama/Llama-3.3-70B-Instruct-Turbo', fast: 'meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo' }, tools: 'native', json: 'object', concurrency: 4 },
  xai: { keys: ['XAI_API_KEY'], base: 'https://api.x.ai/v1', wire: 'openai', models: { director: 'grok-4', crew: 'grok-4', fast: 'grok-3-mini' }, tools: 'native', json: 'schema', concurrency: 4 },
  cerebras: { keys: ['CEREBRAS_API_KEY'], base: 'https://api.cerebras.ai/v1', wire: 'openai', models: { director: 'llama-3.3-70b', crew: 'llama-3.3-70b', fast: 'llama3.1-8b' }, tools: 'native', json: 'object', concurrency: 3 },
  compatible: { keys: ['CE_API_KEY'], base: '', wire: 'openai', models: { director: 'default', crew: 'default', fast: 'default' }, tools: 'native', json: 'object', concurrency: 4 },
};
export const PROVIDERS = Object.keys(PRESETS) as Provider[];

const env = (k: string) => process.env[k]?.trim() || undefined;
export const keyOf = (p: Provider) => PRESETS[p].keys.map(env).find(Boolean);

/** Not chat models (speech, guards, embeddings, images): never picked to think. */
const NOT_CHAT = /whisper|tts|orpheus|guard|safeguard|embed|moderation|image|dall-e|vision-preview|audio|transcribe|rerank|playai/i;
/** A model's size in billions of parameters, from its id ("gpt-oss-120b" → 120, "qwen3.8-27b" → 27), else null. */
const sizeOf = (id: string) => { const m = /(\d+(?:\.\d+)?)b\b/i.exec(id.replace(/[-_](\d+)x(\d+)b/i, (_, a, b) => `-${Number(a) * Number(b)}b`)); return m ? Number(m[1]) : null; };
/**
 * Which of a provider's live models plays a tier when the configured one is gone (APIs retire model ids; a stale id
 * must never quietly drop a film to the fallback). Chat models only, a real context window; the largest for the
 * director and crew, the smallest that is still ≥ 7B for fast. Prefers the configured family when one survives.
 */
export function pickModel(models: { id: string; context?: number }[], tier: 'director' | 'crew' | 'fast', was = ''): string | null {
  const ok = models.filter(m => !NOT_CHAT.test(m.id) && (m.context ?? 32_000) >= 16_000);
  if (!ok.length) return null;
  const fam = was.split(/[/:-]/).find(p => p.length > 3 && !/^\d/.test(p))?.toLowerCase();
  const pool = fam && ok.some(m => m.id.toLowerCase().includes(fam)) ? ok.filter(m => m.id.toLowerCase().includes(fam)) : ok;
  const s = (m: { id: string }) => sizeOf(m.id) ?? 30;
  const sorted = [...pool].sort((a, b) => s(b) - s(a));
  return tier === 'fast' ? ([...sorted].reverse().find(m => s(m) >= 7) ?? sorted.at(-1)!).id : sorted[0]!.id;
}

/** The provider to use: CE_PROVIDER, else the first one with a key set (ollama last: it needs no key). */
export function pickProvider(): Provider {
  const asked = env('CE_PROVIDER')?.toLowerCase();
  if (asked && (PROVIDERS as string[]).includes(asked)) return asked as Provider;
  return PROVIDERS.find(p => p !== 'ollama' && p !== 'compatible' && keyOf(p)) ?? (env('CE_BASE_URL') ? 'compatible' : 'ollama');
}

/**
 * The model for a tier: CE_MODEL_<TIER> when it suits this provider, else the preset's. A Claude model id left in
 * the env from the Claude Code days is ignored on a provider that cannot serve it, so switching provider is one line.
 */
export function modelFor(p: Provider, tier: 'director' | 'crew' | 'fast'): string {
  const set = env(`CE_MODEL_${tier.toUpperCase()}`);
  const foreign = set && /^claude-/i.test(set) && p !== 'anthropic';
  return set && !foreign ? set : PRESETS[p].models[tier];
}
