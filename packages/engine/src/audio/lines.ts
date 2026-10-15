/**
 * The voice, line by line: each beat is spoken on its own, in parallel, and kept in a cache by the hash of exactly
 * what was asked (engine, voice, rate, pitch, text). A re-run, an edit that changes one beat, or a second film with
 * the same closing line only pays for the lines that are new. The lines are joined into the same two files the rest
 * of the engine reads: vo.wav (44.1 kHz mono) and words.json ([{word, t, end}], times in the joined track).
 */
import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { config } from '../config';
import { elevenSynthesize, elevenVoiceFor, type Timed } from './eleven';
import { synthesize as edgeSynthesize } from './tts';
import { voiceById } from './voices';
import { writeWav } from './wav';

export type Engine = 'edge' | 'elevenlabs';
export interface LineOpts {
  voice: string; rate?: string; pitch?: string;
  /** the engine asked for; ElevenLabs only runs with its key, else Edge speaks (and the stats say so) */
  engine?: Engine;
  signal?: AbortSignal;
  /** the breath between beats, after each line is trimmed to its speech (seconds; default 0.4) */
  gap?: number;
  concurrency?: number;
  cacheDir?: string;
  /** tests: a stand-in for the network */
  synth?: (text: string, o: { engine: Engine; voice: string; rate: string; pitch: string; signal?: AbortSignal }) => Promise<{ mp3: Buffer; words: Timed[] }>;
}
export interface LineStats {
  lines: number; cached: number; spoken: number;
  /** which engine spoke how many lines (cache hits count for the engine that made them) */
  spokenBy: Partial<Record<Engine, number>>;
  /** wall time of the synthesis of the uncached lines, per line (parallel, so less than one line's latency × n) */
  msPerLine: number; synthMs: number; joinMs: number; wallMs: number;
  /** why ElevenLabs did not speak, when it was asked for */
  fallback?: string;
}

export const SR = 44_100;
const SALT = 'moovi-voice-v1';

/** The cache key of one line: everything that changes the sound, nothing else. */
export function lineKey(o: { engine: Engine; voice: string; rate: string; pitch: string; text: string }) {
  return createHash('sha256').update(JSON.stringify([SALT, o.engine, o.voice, o.rate, o.pitch, o.text.trim()])).digest('hex');
}

export const cacheDirDefault = () => config.voice.cache;

function decode(mp3File: string): Promise<Float32Array> {
  return new Promise((res, rej) => {
    execFile(config.ffmpeg, ['-v', 'error', '-i', mp3File, '-f', 'f32le', '-ac', '1', '-ar', String(SR), '-'], { encoding: 'buffer', maxBuffer: 256 * 1024 * 1024, timeout: 120_000 }, (err, out) => {
      if (err) rej(new Error(`ffmpeg could not decode a voice line: ${String(err.message).slice(0, 200)}`));
      else res(new Float32Array(out.buffer.slice(out.byteOffset, out.byteOffset + out.byteLength)));
    });
  });
}

async function pool<T>(items: T[], n: number, fn: (x: T, i: number) => Promise<void>) {
  let next = 0;
  await Promise.all(Array.from({ length: Math.max(1, Math.min(n, items.length)) }, async () => { while (next < items.length) { const i = next++; await fn(items[i]!, i); } }));
}

const atomic = (file: string, data: string | Buffer) => { mkdirSync(dirname(file), { recursive: true }); const tmp = `${file}.${process.pid}.tmp`; writeFileSync(tmp, data); renameSync(tmp, file); };

/** Speak every line (cached, in parallel) and join them into <dir>/vo.wav + <dir>/words.json. */
export async function speakLines(dir: string, lines: string[], o: LineOpts) {
  const t0 = Date.now();
  mkdirSync(dir, { recursive: true });
  const text = lines.map(l => l.replace(/\s+/g, ' ').trim()).filter(Boolean);
  if (!text.length) throw new Error('nothing to speak');
  writeFileSync(join(dir, 'script.txt'), text.join('\n\n'), 'utf8');
  const rate = o.rate ?? '+0%', pitch = o.pitch ?? '+0Hz', cache = o.cacheDir ?? cacheDirDefault();
  const wantEleven = (o.engine ?? config.voice.engine) === 'elevenlabs';
  const key = config.voice.elevenKey;
  let fallback: string | undefined = wantEleven && !key ? 'ELEVENLABS_API_KEY is not set' : undefined;
  let eleven = wantEleven && !!key;
  const info = voiceById(o.voice);
  // the voice each engine really uses: ElevenLabs speaks with its own voice id, so its lines are cached under that id
  const voiceFor = (engine: Engine) => engine === 'elevenlabs' ? elevenVoiceFor(info?.gender ?? 'male', config.voice.elevenVoice) : o.voice;
  const synth = o.synth ?? (async (t, s) => s.engine === 'elevenlabs'
    ? elevenSynthesize(t, { key: key!, voiceId: s.voice, signal: s.signal })
    : edgeSynthesize(t, { voice: s.voice, rate: s.rate, pitch: s.pitch, signal: s.signal }));

  const files: { mp3: string; words: Timed[]; by: Engine }[] = new Array(text.length);
  let cached = 0, spoken = 0;
  const spokenBy: LineStats['spokenBy'] = {};
  const tS = Date.now();
  await pool(text, o.concurrency ?? config.voice.concurrency, async (line, i) => {
    const tryEngine = async (engine: Engine) => {
      const voice = voiceFor(engine);
      const k = lineKey({ engine, voice, rate, pitch, text: line });
      const mp3 = join(cache, k.slice(0, 2), `${k}.mp3`), meta = join(cache, k.slice(0, 2), `${k}.json`);
      if (existsSync(mp3) && existsSync(meta)) { cached++; files[i] = { mp3, words: JSON.parse(readFileSync(meta, 'utf8')) as Timed[], by: engine }; return; }
      let last: unknown;
      for (let a = 0; a < 3; a++) {
        try {
          const r = await synth(line, { engine, voice, rate, pitch, signal: o.signal });
          if (!r.mp3.length || !r.words.length) throw new Error('the voice service sent no audio');
          atomic(mp3, r.mp3); atomic(meta, JSON.stringify(r.words));
          spoken++; files[i] = { mp3, words: r.words, by: engine }; return;
        } catch (e) { last = e; if (o.signal?.aborted) throw e; await new Promise(r => setTimeout(r, 400 * (a + 1))); }
      }
      throw last instanceof Error ? last : new Error(String(last));
    };
    if (eleven) {
      try { await tryEngine('elevenlabs'); }
      catch (e) { eleven = false; fallback = `ElevenLabs failed (${String(e instanceof Error ? e.message : e).slice(0, 160)}); Edge spoke instead`; await tryEngine('edge'); }
    } else await tryEngine('edge');
  });
  // one film, one voice: if ElevenLabs gave out partway, the lines it already spoke are spoken again by Edge
  if (fallback && files.some(f => f.by === 'elevenlabs')) {
    await pool(text.map((l, i) => [l, i] as const).filter(([, i]) => files[i]!.by === 'elevenlabs'), o.concurrency ?? config.voice.concurrency, async ([line, i]) => {
      const k = lineKey({ engine: 'edge', voice: o.voice, rate, pitch, text: line });
      const mp3 = join(cache, k.slice(0, 2), `${k}.mp3`), meta = join(cache, k.slice(0, 2), `${k}.json`);
      if (existsSync(mp3) && existsSync(meta)) { cached++; files[i] = { mp3, words: JSON.parse(readFileSync(meta, 'utf8')) as Timed[], by: 'edge' }; return; }
      const r = await synth(line, { engine: 'edge', voice: o.voice, rate, pitch, signal: o.signal });
      if (!r.mp3.length || !r.words.length) throw new Error('the voice service sent no audio');
      atomic(mp3, r.mp3); atomic(meta, JSON.stringify(r.words));
      spoken++; files[i] = { mp3, words: r.words, by: 'edge' };
    });
  }
  for (const f of files) spokenBy[f.by] = (spokenBy[f.by] ?? 0) + 1;
  const synthMs = Date.now() - tS;

  // join: decode each line, a short breath between beats, word times shifted onto the joined track
  const tJ = Date.now();
  // each line trimmed to its speech (a little air kept), so every pause between beats is the same chosen breath
  const pcm = (await Promise.all(files.map(f => decode(f.mp3)))).map((p, i) => {
    const w = files[i]!.words;
    const a = Math.max(0, Math.floor((w[0]!.t - 0.06) * SR)), b = Math.min(p.length, Math.ceil((w.at(-1)!.end + 0.35) * SR));
    files[i] = { ...files[i]!, words: w.map(x => ({ ...x, t: +(x.t - a / SR).toFixed(3), end: +(x.end - a / SR).toFixed(3) })) };
    return b > a ? p.subarray(a, b) : p;
  });
  const gap = Math.round((o.gap ?? 0.4) * SR);
  const total = pcm.reduce((a, p) => a + p.length, 0) + gap * (pcm.length - 1);
  const y = new Float32Array(total);
  const words: Timed[] = [];
  let at = 0;
  pcm.forEach((p, i) => {
    y.set(p, at);
    const off = at / SR;
    // the service reports words without punctuation: give it back from the line so on-screen words match the script
    const toks = text[i]!.split(/\s+/), norm = (w: string) => w.toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
    let j = 0;
    for (const w of files[i]!.words) {
      let word = w.word;
      for (let k = j; k < Math.min(j + 4, toks.length); k++) if (norm(toks[k]!) === norm(w.word)) { word = toks[k]!; j = k + 1; break; }
      words.push({ word, t: +(w.t + off).toFixed(3), end: +(w.end + off).toFixed(3) });
    }
    at += p.length + gap;
  });
  writeWav(join(dir, 'vo.wav'), { sr: SR, ch: [y] });
  writeFileSync(join(dir, 'words.json'), JSON.stringify(words, null, 1));
  const joinMs = Date.now() - tJ;
  const stats: LineStats = { lines: text.length, cached, spoken, spokenBy, msPerLine: spoken ? Math.round(synthMs / spoken) : 0, synthMs, joinMs, wallMs: Date.now() - t0, ...(fallback ? { fallback } : {}) };
  writeFileSync(join(dir, 'voice-stats.json'), JSON.stringify({ voice: o.voice, rate, pitch, ...stats }, null, 1));
  return { words, seconds: total / SR, wav: join(dir, 'vo.wav'), stats };
}
