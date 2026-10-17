/**
 * Speech to text with word timings, on the user's own key: Whisper on Groq (whisper-large-v3-turbo) or OpenAI
 * (whisper-1). Used for uploaded footage and voice-overs (the reel styles never need it: their voice comes with its
 * word timings). The key comes from the job's model scope (bring your own key), else GROQ_API_KEY / OPENAI_API_KEY.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { config } from '../config';
import { modelScope } from '../runtime';
import { localAllowed, localModel, localWords, sttMode } from './local-stt';
import type { Word } from './tts';

const API = { groq: { url: 'https://api.groq.com/openai/v1/audio/transcriptions', model: 'whisper-large-v3-turbo' }, openai: { url: 'https://api.openai.com/v1/audio/transcriptions', model: 'whisper-1' } } as const;

/** Which speech-to-text this job can use, or null (the user's provider has none and no key is configured). */
export function sttAvailable(): { provider: 'groq' | 'openai'; key: string } | null {
  const s = modelScope()?.audio; if (s) return s;
  if (process.env.GROQ_API_KEY) return { provider: 'groq', key: process.env.GROQ_API_KEY };
  if (process.env.OPENAI_API_KEY) return { provider: 'openai', key: process.env.OPENAI_API_KEY };
  return null;
}

/** The plain reason an edit of a talking clip stops when nothing can hear it (no key, and the local model is off). */
export const NEEDS_SPEECH_KEY = 'Moovi needs a speech key to hear your clip. Add a free Groq key (GROQ_API_KEY) or an OpenAI key in Settings or .env.local, then try again.';

/** How this job hears speech: its key's provider, the local model (no key, or MOOVI_STT=local), or null (MOOVI_STT=off and no key). */
export function speechAvailable(): 'groq' | 'openai' | 'local' | null {
  if (sttMode() === 'local') return 'local';
  return sttAvailable()?.provider ?? (localAllowed() ? 'local' : null);
}

/** A speech provider's refusal (an HTTP answer, or no answer at all), as opposed to our own abort or a bad file. Pure. */
export function isProviderRefusal(e: unknown): boolean {
  const m = String((e as Error)?.message ?? e), n = (e as Error)?.name;
  if (n === 'AbortError' && !/timeout/i.test(m)) return false;
  return /speech-to-text answered \d{3}/.test(m) || /fetch failed|ECONNRESET|ENOTFOUND|ETIMEDOUT|timed? ?out/i.test(m);
}

/** One plain sentence for why speech could not be heard (shown in the studio chat and in Claude Code). Pure. */
export function plainSpeechError(e: unknown): string {
  const m = String((e as Error)?.message ?? e);
  const hit = /(groq|openai) speech-to-text answered (\d{3})/i.exec(m);
  if (hit) {
    const who = hit[1]!.toLowerCase() === 'groq' ? 'Groq' : 'OpenAI', code = +hit[2]!;
    const what = code === 401 || code === 403 ? 'refused the key'
      : code === 402 || code === 429 || /billing|quota|credit|limit|insufficient/i.test(m) ? 'refused it (billing or quota on that account)'
      : code >= 500 ? 'is down right now' : `answered ${code}`;
    return `Moovi could not hear your clip: ${who} ${what}. Fix the key in Settings or .env.local, or remove it to use the free local model, then try again.`;
  }
  if (/needs a speech key/.test(m)) return m;
  return `Moovi could not hear your clip: the local speech model failed (${m.replace(/\s+/g, ' ').slice(0, 60)}). Add a free Groq key (GROQ_API_KEY) or an OpenAI key in Settings or .env.local, then try again.`;
}

/**
 * Every word of an audio/video file, timed (seconds): the job's key, else Whisper on this machine (local-stt.ts), which
 * also takes over when the keyed provider refuses. Throws NEEDS_SPEECH_KEY when neither is available.
 */
export async function transcribeWords(file: string, workDir: string, o: { maxSeconds?: number; signal?: AbortSignal } = {}): Promise<Word[]> {
  const s = sttMode() === 'local' ? null : sttAvailable();
  const local = async () => (await localWords(file, { ...(o.maxSeconds ? { maxSeconds: o.maxSeconds } : {}), ...(o.signal ? { signal: o.signal } : {}) })).words;
  if (!s) { if (!localAllowed()) throw new Error(NEEDS_SPEECH_KEY); return local(); }
  try { return await keyed(s, file, workDir, o); } catch (e) {
    if (!isProviderRefusal(e) || !localAllowed()) throw e;
    console.warn(`[stt] ${String((e as Error).message ?? e).slice(0, 160)}; hearing it with the local model (${localModel()}) instead`);
    return local();
  }
}

async function keyed(s: { provider: 'groq' | 'openai'; key: string }, file: string, workDir: string, o: { maxSeconds?: number; signal?: AbortSignal }): Promise<Word[]> {
  // 16 kHz mono mp3: small enough for the 25 MB upload limit on long clips
  const clip = join(workDir, `stt-${Date.now()}.mp3`);
  execFileSync(config.ffmpeg, ['-v', 'error', '-y', ...(o.maxSeconds ? ['-t', String(o.maxSeconds)] : []), '-i', file, '-vn', '-ac', '1', '-ar', '16000', '-b:a', '48k', clip]);
  try {
    const form = new FormData();
    form.append('file', new Blob([new Uint8Array(readFileSync(clip))], { type: 'audio/mpeg' }), 'audio.mp3');
    form.append('model', API[s.provider].model);
    form.append('response_format', 'verbose_json');
    form.append('timestamp_granularities[]', 'word');
    const r = await fetch(API[s.provider].url, { method: 'POST', headers: { authorization: `Bearer ${s.key}` }, body: form, signal: o.signal ?? AbortSignal.timeout(300_000) });
    if (!r.ok) throw new Error(`${s.provider} speech-to-text answered ${r.status}: ${(await r.text()).slice(0, 200)}`);
    const j = await r.json() as { words?: { word: string; start: number; end: number }[] };
    return (j.words ?? []).map(w => ({ word: w.word.trim(), t: +w.start.toFixed(3), end: +w.end.toFixed(3) })).filter(w => w.word);
  } finally { rmSync(clip, { force: true }); }
}
