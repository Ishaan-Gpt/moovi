/**
 * Speech to text with no key: Whisper running inside Node (transformers.js, ONNX on the CPU), word timings included.
 * It is the fallback when the job has no Groq or OpenAI key, or when that provider refuses (billing, a bad key, an
 * outage). The model (onnx-community/whisper-large-v3-turbo_timestamped, 4 bit, about 760 MB) downloads once to
 * data/models (MOOVI_MODEL_CACHE moves it) on first use; nothing to install beyond `pnpm install`.
 * MOOVI_STT=local forces it even with a key, MOOVI_STT=off turns it off (then an edit of a talking clip stops and
 * asks for a key), MOOVI_STT_LOCAL_MODEL picks another transformers.js Whisper (onnx-community/whisper-small_timestamped,
 * 250 MB and about 3x faster, or whisper-base_timestamped, 77 MB, for a slow machine).
 * Measured 2026-10-18 on the 4 CPU dev box, Vignesh's accented selfie in street noise (29.7 s), against a reference
 * transcript: base wrote "automatically edit that's also made up of it"; small wrote "we are editing the first Moovi
 * which is Moovi ... extremely labor-gassing ... after it's time ... social media business" (8.8 s); turbo wrote "we are
 * building the world's first ... video editor ... extremely flabbergasting ... after effects ... your entire social media
 * with it" (26 s, load 4 s from cache). A word prompt did not change either model's output, so none is sent.
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
export const localModel = () => process.env.MOOVI_STT_LOCAL_MODEL?.trim() || 'onnx-community/whisper-large-v3-turbo_timestamped';
/** the weights' precision per model: the turbo at 4 bit (760 MB; at 8 bit it is 1.1 GB for the same words), the rest at 8 bit */
export const localDtype = (model = localModel()): string | Record<string, string> => /large-v3-turbo/.test(model) ? { encoder_model: 'q4', decoder_model_merged: 'q4' } : 'q8';
export const modelCache = () => process.env.MOOVI_MODEL_CACHE?.trim() || join(config.data, 'models');
const localMb = (m: string) => /large-v3-turbo/.test(m) ? 760 : /small/.test(m) ? 250 : /base/.test(m) ? 77 : /tiny/.test(m) ? 40 : 500;

interface Chunk { text: string; timestamp: [number, number | null] }
/** transformers.js word chunks to Moovi's timed words (seconds, 3 decimals; an open end takes the next start). Pure. */
export function chunksToWords(chunks: Chunk[], offset = 0): Word[] {
  const out: Word[] = [];
  chunks.forEach((c, i) => {
    const word = c.text.trim(); if (!word) return;
    const t = c.timestamp[0] ?? 0, end = c.timestamp[1] ?? chunks[i + 1]?.timestamp[0] ?? t + 0.3;
    // a piece with no leading space continues the word before it (Whisper split "labor-gassing" as " labor" + "-gassing")
    const prev = out[out.length - 1];
    if (prev && !/^\s/.test(c.text)) { prev.word += word; prev.end = +(Math.max(end, t) + offset).toFixed(3); return; }
    out.push({ word, t: +(t + offset).toFixed(3), end: +(Math.max(end, t) + offset).toFixed(3) });
  });
  return out;
}

const key = (w: string) => w.toLowerCase().replace(/[^\p{L}\p{N}']/gu, '');
/**
 * Whisper's known failure on a slate or room tone is a loop: the same word over and over (measured 2026-10-18 on
 * Vignesh's raw clip: "Start!" 110 times from 7.2 s to 30 s, which broke the EDL builder with zero-length shots).
 * Kept: words in time order, at most two of the same word in a row, never the same word twice inside 150 ms (nobody
 * says a word twice that fast; Whisper's doubled "Start! Start!" 60 ms apart kept a slate word on screen), inside the clip,
 * each at least 40 ms long. Pure.
 */
export function cleanWords(ws: Word[], duration = Infinity): Word[] {
  const out: Word[] = [];
  for (const w of ws) {
    const prev = out[out.length - 1], k = key(w.word);
    if (!k || w.t > duration + 0.05) continue;
    if (prev && w.t < prev.t - 0.05) continue;
    if (prev && key(prev.word) === k && (w.t - prev.t < 0.15 || (out.length > 1 && key(out[out.length - 2]!.word) === k))) continue;
    out.push({ ...w, end: +Math.max(w.end ?? w.t, w.t + 0.04).toFixed(3) });
  }
  return out;
}

type Asr = (audio: Float32Array, o: Record<string, unknown>) => Promise<{ text: string; chunks?: Chunk[] }>;
let asrP: Promise<Asr> | null = null, queue: Promise<unknown> = Promise.resolve(), idle: ReturnType<typeof setTimeout> | null = null;

/**
 * How long the speech model stays loaded after its last clip (ms, MOOVI_STT_KEEP_MS; default 0: freed as soon as the clip is heard,
 * the next job loads it again in about 4 s from the disk cache).
 * Held, the turbo costs about 2 GB of memory for the whole job: measured 2026-10-18 on the 8 GB dev box, an effects
 * render with the model still loaded was killed by the kernel (out of memory, the render process at about 2.9 GB), three
 * times, once with a 15 s keep window (the render starts within seconds of the hearing).
 * On a 2 GB server the render needs that memory back.
 */
export const sttKeepMs = () => { const v = Number(process.env.MOOVI_STT_KEEP_MS); return Number.isFinite(v) && v >= 0 ? v : 0; };

/** free the model now (the next clip loads it again, about 4 s from the disk cache) */
export async function releaseLocalStt(): Promise<boolean> {
  if (idle) { clearTimeout(idle); idle = null; }
  const p = asrP; asrP = null;
  if (!p) return false;
  const asr = await p.catch(() => null) as (Asr & { dispose?: () => Promise<unknown> }) | null;
  await asr?.dispose?.().catch(() => undefined);
  return !!asr;
}

function load(onNote?: (text: string) => unknown): Promise<Asr> {
  if (idle) { clearTimeout(idle); idle = null; }
  if (asrP) return asrP;
  asrP = (async () => {
    // kept out of the studio's Next bundle (it transpiles the engine; the jobs run in the worker under tsx, never there)
    const tf = await import(/* webpackIgnore: true */ /* turbopackIgnore: true */ '@huggingface/transformers');
    const model = localModel(), cache = modelCache();
    tf.env.cacheDir = cache;
    if (!existsSync(join(cache, ...model.split('/')))) {
      const line = `downloading the speech model once, about ${localMb(model)} MB (${model})`;
      console.log(`[stt] ${line}`); await onNote?.(line);
    }
    return await tf.pipeline('automatic-speech-recognition', model, { dtype: localDtype(model) as never }) as unknown as Asr;
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
    // 20 s windows: with one 30 s window the turbo stopped at "your entire social" and lost the clip's last 4 s
    // (measured 2026-10-18 on the 29.7 s selfie; padding the audio did not help, 20 s windows with a 4 s stride did)
    const r = await asr(audio, { return_timestamps: 'word', chunk_length_s: 20, stride_length_s: 4, ...(english ? {} : { task: 'transcribe', ...(o.lang ? { language: o.lang } : {}) }) });
    const words = cleanWords(chunksToWords(r.chunks ?? []), audio.length / 16000);
    return { text: words.map(w => w.word).join(' '), words, language: english ? 'en' : o.lang ?? '' };
  });
  queue = run.catch(() => undefined).then(() => {
    // nothing else queued behind this clip: let the model go after the keep window
    if (idle) clearTimeout(idle);
    idle = setTimeout(() => { void releaseLocalStt(); }, sttKeepMs());
    idle.unref?.();
  });
  return run;
}
