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
import type { Word } from './tts';

const API = { groq: { url: 'https://api.groq.com/openai/v1/audio/transcriptions', model: 'whisper-large-v3-turbo' }, openai: { url: 'https://api.openai.com/v1/audio/transcriptions', model: 'whisper-1' } } as const;

/** Which speech-to-text this job can use, or null (the user's provider has none and no key is configured). */
export function sttAvailable(): { provider: 'groq' | 'openai'; key: string } | null {
  const s = modelScope()?.audio; if (s) return s;
  if (process.env.GROQ_API_KEY) return { provider: 'groq', key: process.env.GROQ_API_KEY };
  if (process.env.OPENAI_API_KEY) return { provider: 'openai', key: process.env.OPENAI_API_KEY };
  return null;
}

/** Every word of an audio/video file, timed (seconds). Throws a plain message when no speech-to-text is available. */
export async function transcribeWords(file: string, workDir: string, o: { maxSeconds?: number; signal?: AbortSignal } = {}): Promise<Word[]> {
  const s = sttAvailable();
  if (!s) throw new Error('Transcribing speech needs a Groq or OpenAI key (Settings → Your model, or GROQ_API_KEY / OPENAI_API_KEY on the server).');
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
