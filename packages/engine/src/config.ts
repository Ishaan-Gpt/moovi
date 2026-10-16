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
/**
 * The repo root: MOOVI_REPO, else the nearest folder with pnpm-workspace.yaml above this file, else above the working
 * directory. (Bundled into the studio's production build, this file's own path can point inside .next; the
 * working directory, apps/studio, still finds the root.)
 */
const findRoot = (from: string) => { for (let d = resolve(from); ; d = dirname(d)) { if (existsSync(join(d, 'pnpm-workspace.yaml'))) return d; if (dirname(d) === d) return null; } };
export const REPO = resolve(process.env.MOOVI_REPO?.trim() || findRoot(here) || findRoot(process.cwd()) || resolve(here, '../../..'));

const env = (k: string) => process.env[k]?.trim() || undefined;
const num = (k: string, d: number) => { const v = Number(env(k)); return Number.isFinite(v) && v > 0 ? v : d; };

const falkor = env('FALKORDB_URL') ?? 'falkor://localhost:6380';
const gb = totalmem() / 2 ** 30;

/**
 * How many film chunks render at once by default. Each chunk is one Chrome page (about 1.5 GB at 1080x1920); 3 GB stay
 * for the worker and FalkorDB and one core for everything else. 8 GB and 4 cores render 3 chunks at once (the old rule,
 * (gb - 6) / 1.5, gave 1 there); a 2 GB server still renders 1; never more than 4.
 */
export function renderSlots(cores: number, memGb: number): number {
  return Math.max(1, Math.min(4, cores - 1, Math.floor((memGb - 3) / 1.5)));
}
const RUNTIME = (env('MOOVI_RUNTIME') ?? 'claude-code') as 'claude-code' | 'http';
const PROVIDER = pickProvider();

export const config = {
  falkor,
  /** the same server speaks plain Redis: streams for events and commands, lists for the ready queues */
  redis: falkor.replace(/^falkors?:/, m => (m === 'falkors:' ? 'rediss:' : 'redis:')),
  data: resolve(env('MOOVI_DATA_DIR') ?? join(REPO, 'data')),
  /** everything a film needs that is not code: the renderer bundle and fonts, the sound kit, the music bed (all in the repo, openly licensed: assets/CREDITS.md) */
  assets: resolve(env('MOOVI_ASSETS_DIR') ?? join(REPO, 'packages', 'engine', 'assets')),
  ffmpeg: env('FFMPEG') ?? 'ffmpeg',
  ffprobe: env('FFPROBE') ?? 'ffprobe',
  /**
   * The voice (src/audio/lines.ts): Microsoft Edge's free voices by default. MOOVI_VOICE_ENGINE=elevenlabs uses
   * ElevenLabs when ELEVENLABS_API_KEY is set (Edge speaks whenever it can't). Lines are cached by hash in `cache`.
   */
  voice: {
    engine: (({ elevenlabs: 'elevenlabs', openai: 'openai' } as const)[env('MOOVI_VOICE_ENGINE') as 'elevenlabs' | 'openai'] ?? 'edge') as 'edge' | 'elevenlabs' | 'openai',
    /** MOOVI_VOICE_ENGINE=openai: gpt-4o-mini-tts with a delivery brief (src/audio/openai-tts.ts) */
    openaiKey: env('OPENAI_API_KEY'),
    openaiBase: env('OPENAI_BASE_URL'),
    elevenKey: env('ELEVENLABS_API_KEY'),
    elevenVoice: env('ELEVENLABS_VOICE_ID'),
    cache: resolve(env('MOOVI_VOICE_CACHE') ?? join(env('MOOVI_DATA_DIR') ?? join(REPO, 'data'), 'cache', 'voice')),
    concurrency: num('MOOVI_VOICE_CONCURRENCY', 4),
  },
  /** the browser the render pool drives (system Chrome by default, like MotionEasy's CLI) */
  chrome: { channel: env('MOOVI_CHROME_CHANNEL') ?? 'chrome', path: env('MOOVI_CHROME_PATH') },
  runtime: RUNTIME,
  /** any model API (runtime/providers.ts): MOOVI_PROVIDER, else the first provider whose key is set */
  provider: PROVIDER,
  baseUrl: env('MOOVI_BASE_URL'),
  /** every model deadline × this: a local model on a CPU needs minutes where an API needs seconds */
  deadlineScale: num('MOOVI_DEADLINE_SCALE', RUNTIME === 'http' && PROVIDER === 'ollama' ? 4 : 1),
  /** the three tiers: MOOVI_MODEL_* when they suit the provider, else its preset (a Claude id is ignored on Groq, Gemini…) */
  models: RUNTIME === 'http'
    ? { director: modelFor(PROVIDER, 'director'), crew: modelFor(PROVIDER, 'crew'), fast: modelFor(PROVIDER, 'fast') }
    : { director: env('MOOVI_MODEL_DIRECTOR') ?? 'claude-opus-5-5', crew: env('MOOVI_MODEL_CREW') ?? 'claude-sonnet-5-5', fast: env('MOOVI_MODEL_FAST') ?? 'claude-haiku-5-5' },
  /** how many tasks of each kind run at once (render chunks are sized to memory: ~1.5 GB a Chrome page) */
  slots: {
    // model calls wait on the network, not this machine: 8 at once lets every Shot Builder of a 6 to 8 scene film run
    // together while the Asset Hunters finish (4 queued builders behind 13 hunters on the FalkorDB brief)
    llm: num('MOOVI_SLOTS_LLM', 4),
    cpu: num('MOOVI_SLOTS_CPU', Math.max(2, Math.min(6, cpus().length - 2))),
    render: num('MOOVI_SLOTS_RENDER', renderSlots(cpus().length, gb)),
    chrome: num('MOOVI_SLOTS_CHROME', 3),
    voice: 1,
    audio: num('MOOVI_SLOTS_AUDIO', 1),
  },
  /** a task's lease: a worker that stops heartbeating loses it after this long */
  leaseMs: num('MOOVI_LEASE_MS', 90_000),
  searchKeys: { tavily: env('TAVILY_API_KEY'), serper: env('SERPER_API_KEY'), pexels: env('PEXELS_API_KEY'), pixabay: env('PIXABAY_API_KEY') },
  /**
   * Stock footage (src/footage): the free sources asked, in priority order. Keyless ones (Mixkit, Wikimedia Commons,
   * NASA, Internet Archive) always work; Pixabay and Pexels join when their key is set.
   */
  /** research with no links and no search key still runs, on Wikipedia's own search (MOOVI_RESEARCH_KEYLESS=0 turns that off) */
  research: { keyless: env('MOOVI_RESEARCH_KEYLESS') !== '0' },
  footage: {
    sources: (env('MOOVI_CLIP_SOURCES') ?? 'mixkit,commons,pixabay,pexels,nasa,archive').split(',').map(s => s.trim().toLowerCase()).filter(Boolean),
    /** a clip longer than this is cut to it when it is downloaded (a scene never needs more) */
    maxSeconds: num('MOOVI_CLIP_SECONDS', 12),
  },
};

export type Resource = keyof typeof config.slots;
