/**
 * Optional: ElevenLabs as the voice engine (off by default). It runs only when MOOVI_VOICE_ENGINE=elevenlabs AND
 * ELEVENLABS_API_KEY is set; anything else, or any failure, falls back to Microsoft Edge's free voices, and the run
 * records which engine actually spoke each line. Word timings come from ElevenLabs' character alignment.
 */
import type { Gender } from './voices';

export interface Timed { word: string; t: number; end: number }

/** ElevenLabs premade voices by gender (override with ELEVENLABS_VOICE_ID). */
const PREMADE: Record<Gender, string> = { female: '21m00Tcm4TlvDq8ikWAM', male: 'pNInz6obpgDQGcFmaJgB' };
export const elevenVoiceFor = (gender: Gender, override?: string | null) => override?.trim() || PREMADE[gender];

/** ElevenLabs' per-character alignment → word timings (a word ends at its last character's end). */
export function alignmentToWords(a: { characters: string[]; character_start_times_seconds: number[]; character_end_times_seconds: number[] }): Timed[] {
  const out: Timed[] = [];
  let cur: { word: string; t: number; end: number } | null = null;
  a.characters.forEach((ch, i) => {
    if (/\s/.test(ch)) { if (cur) { out.push(cur); cur = null; } return; }
    const t = a.character_start_times_seconds[i] ?? 0, end = a.character_end_times_seconds[i] ?? t;
    if (!cur) cur = { word: ch, t, end }; else { cur.word += ch; cur.end = end; }
  });
  if (cur) out.push(cur);
  return out.filter(w => /[\p{L}\p{N}]/u.test(w.word)).map(w => ({ word: w.word, t: +w.t.toFixed(3), end: +w.end.toFixed(3) }));
}

export async function elevenSynthesize(text: string, o: { key: string; voiceId: string; model?: string; signal?: AbortSignal; timeoutMs?: number; fetchImpl?: typeof fetch }): Promise<{ mp3: Buffer; words: Timed[] }> {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), o.timeoutMs ?? 60_000);
  const onAbort = () => ctl.abort();
  o.signal?.addEventListener('abort', onAbort, { once: true });
  try {
    const res = await (o.fetchImpl ?? fetch)(`https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(o.voiceId)}/with-timestamps?output_format=mp3_44100_128`, {
      method: 'POST', signal: ctl.signal,
      headers: { 'xi-api-key': o.key, 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify({ text, model_id: o.model ?? 'eleven_multilingual_v2' }),
    });
    if (!res.ok) throw new Error(`ElevenLabs answered ${res.status}: ${(await res.text()).slice(0, 200)}`);
    const j = await res.json() as { audio_base64?: string; alignment?: Parameters<typeof alignmentToWords>[0] | null };
    if (!j.audio_base64 || !j.alignment) throw new Error('ElevenLabs sent no audio or no timings');
    return { mp3: Buffer.from(j.audio_base64, 'base64'), words: alignmentToWords(j.alignment) };
  } finally { clearTimeout(timer); o.signal?.removeEventListener('abort', onAbort); }
}
