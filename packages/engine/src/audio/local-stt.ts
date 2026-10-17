/**
 * Speech to text with no key: Whisper running inside Node (transformers.js, ONNX on the CPU), word timings included.
 * It is the fallback when the job has no Groq or OpenAI key, or when that provider refuses (billing, a bad key, an
 * outage). The model (onnx-community/whisper-base_timestamped, quantized, about 77 MB) downloads once to
 * data/models (MOOVI_MODEL_CACHE moves it) on first use; nothing to install beyond `pnpm install`.
 * MOOVI_STT=local forces it even with a key, MOOVI_STT=off turns it off (then an edit of a talking clip stops and
 * asks for a key), MOOVI_STT_LOCAL_MODEL picks another transformers.js Whisper (e.g. onnx-community/whisper-tiny.en_timestamped).
 * Measured 2026-10-18 on the 4 CPU dev box: a 20 s clip heard in 4.6 s (model load 1.3 s from cache).
 */
import { execFile } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { config } from '../config';
import type { Word } from './tts';

export type SttMode = 'auto' | 'local' | 'off';
/** MOOVI_STT: auto (a key when there is one, else local), local (always local), off (no local fallback). Pure. */
export function sttMode(env = process.env.MOOVI_STT): SttMode {
  const v = (env ?? '').trim().toLowerCase();
  return v === 'local' || v === 'off' ? v : 'auto';
}
export const localAllowed = () => sttMode() !== 'off';
export const localModel = () => process.env.MOOVI_STT_LOCAL_MODEL?.trim() || 'onnx-community/whisper-base_timestamped';
export const modelCache = () => process.env.MOOVI_MODEL_CACHE?.trim() || join(config.data, 'models');
const LOCAL_MB = 77;

interface Chunk { text: string; timestamp: [number, number | null] }
/** transformers.js word chunks to Moovi's timed words (seconds, 3 decimals; an open end takes the next start). Pure. */
export function chunksToWords(chunks: Chunk[], offset = 0): Word[] {
  const out: Word[] = [];
  chunks.forEach((c, i) => {
    const word = c.text.trim(); if (!word) return;
    const t = c.timestamp[0] ?? 0, end = c.timestamp[1] ?? chunks[i + 1]?.timestamp[0] ?? t + 0.3;
    out.push({ word, t: +(t + offset).toFixed(3), end: +(Math.max(end, t) + offset).toFixed(3) });
  });
  return out;
}

type Asr = (audio: Float32Array, o: Record<string, unknown>) => Promise<{ text: string; chunks?: Chunk[] }>;
let asrP: Promise<Asr> | null = null, queue: Promise<unknown> = Promise.resolve();

function load(onNote?: (text: string) => unknown): Promise<Asr> {
  if (asrP) return asrP;
  asrP = (async () => {
    // kept out of the studio's Next bundle (it transpiles the engine; the jobs run in the worker under tsx, never there)
    const tf = await import(/* webpackIgnore: true */ /* turbopackIgnore: true */ '@huggingface/transformers');
    const model = localModel(), cache = modelCache();
    tf.env.cacheDir = cache;
    if (!existsSync(join(cache, ...model.split('/')))) {
      const line = `downloading the speech model once, about ${LOCAL_MB} MB (${model})`;
      console.log(`[stt] ${line}`); await onNote?.(line);
    }
    return await tf.pipeline('automatic-speech-recognition', model, { dtype: 'q8' }) as unknown as Asr;
  })();
  asrP.catch(() => { asrP = null; });
  return asrP;
}

/** 16 kHz mono float samples of any audio or video file (ffmpeg). */
function pcm(file: string, maxSeconds?: number): Promise<Float32Array> {
  return new Promise((res, rej) => execFile(config.ffmpeg, ['-nostdin', '-v', 'error', ...(maxSeconds ? ['-t', String(maxSeconds)] : []), '-i', file, '-vn', '-ac', '1', '-ar', '16000', '-f', 'f32le', '-'],
    { encoding: 'buffer', maxBuffer: 1024e6, timeout: 120_000 }, (e, out) => e ? rej(e) : res(new Float32Array(out.buffer.slice(out.byteOffset, out.byteOffset + out.length - out.length % 4)))));
}

/** Every word of a file, timed, heard on this machine. `lang` is an ISO 639-1 code (the lock); one clip at a time. */
export async function localWords(file: string, o: { lang?: string; maxSeconds?: number; signal?: AbortSignal; onNote?: (text: string) => unknown } = {}): Promise<{ text: string; words: Word[]; language: string }> {
  const run = queue.then(async () => {
    o.signal?.throwIfAborted();
    const asr = await load(o.onNote), audio = await pcm(file, o.maxSeconds);
    o.signal?.throwIfAborted();
    if (audio.length < 1600) return { text: '', words: [], language: o.lang ?? '' };
    const english = /\.en(_|$)/.test(localModel());
    const r = await asr(audio, { return_timestamps: 'word', chunk_length_s: 30, stride_length_s: 5, ...(english ? {} : { task: 'transcribe', ...(o.lang ? { language: o.lang } : {}) }) });
    return { text: (r.text ?? '').trim(), words: chunksToWords(r.chunks ?? []), language: english ? 'en' : o.lang ?? '' };
  });
  queue = run.catch(() => undefined);
  return run;
}
