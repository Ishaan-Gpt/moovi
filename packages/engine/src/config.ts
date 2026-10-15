import { existsSync } from 'node:fs';
import { totalmem, cpus } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { modelFor, pickProvider } from './runtime/providers';

/**
 * The engine's settings, from the environment (root .env.local). Nothing secret has a default; keys are only ever
 * read from the environment and never written anywhere.
 */
const here = dirname(fileURLToPath(import.meta.url));
export const REPO = resolve(here, '../../..');

const env = (k: string) => process.env[k]?.trim() || undefined;
const num = (k: string, d: number) => { const v = Number(env(k)); return Number.isFinite(v) && v > 0 ? v : d; };

const falkor = env('FALKORDB_URL') ?? 'falkor://localhost:6380';
// MotionEasy sits next to the ContentEasy checkout; walk up so a worktree (.claude/worktrees/<name>) finds it too.
const findMotionEasy = () => {
  for (let d = REPO; dirname(d) !== d; d = dirname(d)) if (existsSync(join(d, '..', 'MotionEasy', 'styles'))) return join(d, '..', 'MotionEasy');
  return join(REPO, '..', 'MotionEasy');
};
const MOTIONEASY = resolve(env('MOTIONEASY_DIR') ?? findMotionEasy());
const gb = totalmem() / 2 ** 30;
const RUNTIME = (env('CE_RUNTIME') ?? 'claude-code') as 'claude-code' | 'http';
const PROVIDER = pickProvider();

export const config = {
  falkor,
  /** the same server speaks plain Redis: streams for events and commands, lists for the ready queues */
  redis: falkor.replace(/^falkors?:/, m => (m === 'falkors:' ? 'rediss:' : 'redis:')),
  data: resolve(env('CE_DATA_DIR') ?? join(REPO, 'data')),
  motioneasy: MOTIONEASY,
  python: env('BENCH_PYTHON') ?? join(MOTIONEASY, '.venv-audio', 'Scripts', 'python.exe'),
  ffmpeg: env('FFMPEG') ?? 'ffmpeg',
  ffprobe: env('FFPROBE') ?? 'ffprobe',
  /** the browser the render pool drives (system Chrome by default, like MotionEasy's CLI) */
  chrome: { channel: env('CE_CHROME_CHANNEL') ?? 'chrome', path: env('CE_CHROME_PATH') },
  runtime: RUNTIME,
  /** any model API (runtime/providers.ts): CE_PROVIDER, else the first provider whose key is set */
  provider: PROVIDER,
  baseUrl: env('CE_BASE_URL'),
  /** every model deadline × this: a local model on a CPU needs minutes where an API needs seconds */
  deadlineScale: num('CE_DEADLINE_SCALE', RUNTIME === 'http' && PROVIDER === 'ollama' ? 4 : 1),
  /** the three tiers: CE_MODEL_* when they suit the provider, else its preset (a Claude id is ignored on Groq, Gemini…) */
  models: RUNTIME === 'http'
    ? { director: modelFor(PROVIDER, 'director'), crew: modelFor(PROVIDER, 'crew'), fast: modelFor(PROVIDER, 'fast') }
    : { director: env('CE_MODEL_DIRECTOR') ?? 'claude-opus-5-5', crew: env('CE_MODEL_CREW') ?? 'claude-sonnet-5-5', fast: env('CE_MODEL_FAST') ?? 'claude-haiku-5-5' },
  /** how many tasks of each kind run at once (render chunks are sized to memory: ~1.5 GB a Chrome page) */
  slots: {
    llm: num('CE_SLOTS_LLM', 4),
    cpu: num('CE_SLOTS_CPU', Math.max(2, Math.min(6, cpus().length - 2))),
    render: num('CE_SLOTS_RENDER', Math.max(1, Math.min(4, Math.floor((gb - 6) / 1.5)))),
    chrome: num('CE_SLOTS_CHROME', 3),
    voice: 1,
    audio: num('CE_SLOTS_AUDIO', 1),
  },
  /** a task's lease: a worker that stops heartbeating loses it after this long */
  leaseMs: num('CE_LEASE_MS', 90_000),
  searchKeys: { tavily: env('TAVILY_API_KEY'), serper: env('SERPER_API_KEY'), pexels: env('PEXELS_API_KEY') },
};

export type Resource = keyof typeof config.slots;
