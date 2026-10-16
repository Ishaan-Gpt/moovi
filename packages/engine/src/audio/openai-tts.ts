/**
 * OpenAI speech (gpt-4o-mini-tts) with a delivery brief (`instructions`: "intense gym coach, building energy"), and the
 * word times read back by a transcription with word timestamps. The times are put on the script's own words (the
 * transcript can hear "Gym Easy" as "Jim Easy"), so captions always show what was written.
 * Key and base: OPENAI_API_KEY and OPENAI_BASE_URL (default https://api.openai.com).
 */
import type { Timed } from './eleven';

export const OPENAI_TTS_MODEL = 'gpt-4o-mini-tts';
export const OPENAI_TTS_VOICES = ['alloy', 'ash', 'ballad', 'coral', 'echo', 'fable', 'nova', 'onyx', 'sage', 'shimmer', 'verse'];

const words = (s: string) => s.replace(/\s+/g, ' ').trim().split(' ').filter(w => /[\p{L}\p{N}]/u.test(w));

/**
 * The script's words on the heard times: heard words are matched in order to the written ones by their letters; a
 * written word with no heard partner takes the gap between its neighbours (evenly), so every word gets a time.
 */
export function alignWords(text: string, heard: { word: string; start: number; end: number }[], total?: number): Timed[] {
  const said = words(text), key = (w: string) => w.toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
  const out: (Timed | null)[] = said.map(() => null);
  let h = 0;
  for (let i = 0; i < said.length && h < heard.length; i++) {
    // look ahead a few heard words for this written word; a miss leaves it for the gap filler
    let hit = -1;
    for (let j = h; j < Math.min(heard.length, h + 3); j++) if (key(heard[j]!.word) === key(said[i]!)) { hit = j; break; }
    if (hit < 0 && said.length - i <= heard.length - h) hit = h; // same count left: take the next heard word as this one
    if (hit >= 0) { out[i] = { word: said[i]!, t: heard[hit]!.start, end: heard[hit]!.end }; h = hit + 1; }
  }
  const end = total ?? (heard.at(-1)?.end ?? said.length * 0.3);
  for (let i = 0; i < out.length; i++) if (!out[i]) {
    let a = i; while (a < out.length && !out[a]) a++;
    const t0 = i > 0 ? out[i - 1]!.end : 0, t1 = a < out.length ? out[a]!.t : end, step = Math.max(0.05, (t1 - t0) / (a - i));
    for (let k = i; k < a; k++) out[k] = { word: said[k]!, t: t0 + (k - i) * step, end: t0 + (k - i + 1) * step };
  }
  return out as Timed[];
}

export async function openaiSynthesize(text: string, o: { key: string; base?: string; voice: string; instructions?: string; model?: string; signal?: AbortSignal; timeoutMs?: number; fetchImpl?: typeof fetch }): Promise<{ mp3: Buffer; words: Timed[] }> {
  const f = o.fetchImpl ?? fetch, base = (o.base ?? 'https://api.openai.com').replace(/\/+$/, ''), auth = { authorization: `Bearer ${o.key}` };
  const ctl = new AbortController(), timer = setTimeout(() => ctl.abort(), o.timeoutMs ?? 90_000), onAbort = () => ctl.abort();
  o.signal?.addEventListener('abort', onAbort);
  try {
    const r = await f(`${base}/v1/audio/speech`, { method: 'POST', signal: ctl.signal, headers: { ...auth, 'content-type': 'application/json' },
      body: JSON.stringify({ model: o.model ?? OPENAI_TTS_MODEL, voice: o.voice, input: text, response_format: 'mp3', ...(o.instructions ? { instructions: o.instructions } : {}) }) });
    if (!r.ok) throw new Error(`OpenAI speech ${r.status}: ${(await r.text()).slice(0, 200)}`);
    const mp3 = Buffer.from(await r.arrayBuffer());
    const fd = new FormData();
    fd.append('file', new Blob([mp3], { type: 'audio/mpeg' }), 'line.mp3');
    fd.append('model', 'whisper-1'); fd.append('response_format', 'verbose_json'); fd.append('timestamp_granularities[]', 'word');
    const t = await f(`${base}/v1/audio/transcriptions`, { method: 'POST', signal: ctl.signal, headers: auth, body: fd });
    if (!t.ok) throw new Error(`OpenAI transcription ${t.status}: ${(await t.text()).slice(0, 200)}`);
    const j = await t.json() as { words?: { word: string; start: number; end: number }[]; duration?: number };
    return { mp3, words: alignWords(text, j.words ?? [], j.duration) };
  } finally { clearTimeout(timer); o.signal?.removeEventListener('abort', onAbort); }
}
