/**
 * A human voice for the effects films: OpenAI gpt-4o-mini-tts with a delivery brief written for a real person talking
 * to a friend (emotion, depth, breaths, pauses, varied pace), the script split into spoken phrases, each line spoken in
 * one call (so its melody stays whole) and the lines joined with breath-sized gaps that follow the punctuation.
 * Word times come back from ../../audio/openai-tts.ts (a transcription aligned onto the written words).
 */
import { openaiSynthesize } from '../../audio/openai-tts';
import type { FxWord } from './plan';

export type FxMood = 'excited' | 'warm' | 'story' | 'hype';

/** The voices tried for this (2026-10-16): ash, ballad, coral, sage. ballad had the widest pitch movement (3.4
 * semitones sd) and loudness range (5.3 LU) with natural 0.5 to 0.8 s phrase pauses, so it is the default. */
export const FX_VOICE = 'ballad';

const BASE = 'Voice: a real person in their twenties talking to a close friend, not an announcer, not a narrator. ' +
  'Delivery: natural and loose, like a voice note. Vary the pace: quicker through the throwaway bits, slower and leaning in on the words that matter. ' +
  'Pauses: small natural pauses between phrases, a soft breath before an important line; let commas and "..." be real pauses. ' +
  'Emotion: real and with depth, a smile in the voice where it fits; never flat, never robotic, never salesy, no radio voice. Contractions and casual rhythm.';
const MOOD: Record<FxMood, string> = {
  excited: 'Tone: genuinely excited and a little amazed, like you just found something cool and cannot wait to show it.',
  warm: 'Tone: warm, calm and sure, like explaining something you love to a friend.',
  story: 'Tone: intimate storyteller, drawing the friend in, building a little suspense before the reveal.',
  hype: 'Tone: high energy and confident, punchy on the key words, but still a real person, not a trailer voice.',
};
export function fxInstructions(mood: FxMood = 'excited', extra = ''): string { return [BASE, MOOD[mood], extra].filter(Boolean).join(' '); }

const SPLIT_BEFORE = new Set(['and', 'but', 'so', 'because', 'which', 'then', 'or', 'while', 'when']);
/**
 * Phrase a line for speech: a comma before a joining word once the phrase has 5 or more words, and a break after
 * 9 words at most, so the voice breathes where a person would. Existing punctuation is kept.
 */
export function phraseLine(line: string): string {
  const ws = line.trim().split(/\s+/).filter(Boolean);
  const out: string[] = []; let run = 0;
  for (let i = 0; i < ws.length; i++) {
    const w = ws[i]!, bare = w.toLowerCase().replace(/[^a-z']/g, '');
    if (run >= 5 && SPLIT_BEFORE.has(bare) && out.length && !/[,.!?;:…]$/.test(out[out.length - 1]!)) { out[out.length - 1] += ','; run = 0; }
    out.push(w); run++;
    if (/[,.!?;:…]$/.test(w)) run = 0;
    if (run >= 9 && i < ws.length - 1) { out[out.length - 1] += ','; run = 0; }
  }
  return out.join(' ');
}

/** the gap after a line, seconds: longer after a full stop or a question, short after a comma (deterministic) */
export function gapAfter(line: string, i: number): number {
  const s = line.trim();
  const base = /[?]$/.test(s) ? 0.5 : /[.!]$/.test(s) ? 0.42 : /…|\.\.\.$/.test(s) ? 0.55 : 0.26;
  return Math.round((base + ((i * 37) % 7) * 0.012) * 1000) / 1000;
}

/** one spoken line: its mp3, where it starts on the film clock, and the part of the mp3 that is speech (`cut`, s) */
export interface FxVoiceLine { text: string; mp3: Buffer; words: FxWord[]; start: number; dur: number; cut: [number, number] }

/**
 * The speech inside a line's mp3: from just before its first word to just after its last (the model often leaves a
 * second or two of air at the end, which read as dead gaps between lines). Falls back to the whole file.
 */
export function speechCut(words: FxWord[], dur: number, lead = 0.08, tail = 0.16): [number, number] {
  if (!words.length) return [0, dur];
  const a = Math.max(0, words[0]!.t - lead), b = Math.min(dur, Math.max(words[words.length - 1]!.end + tail, a + 0.2));
  return [Math.round(a * 1000) / 1000, Math.round(b * 1000) / 1000];
}

/**
 * Speak the lines: one call per line, in parallel, then laid end to end with gapAfter() between them. Returns each
 * line with its start and its speech cut (lay mp3[cut] at start), and every word on the film clock. `probe` gives an mp3's length in seconds.
 */
export async function speakHuman(lines: string[], o: { key: string; base?: string; voice?: string; mood?: FxMood; extra?: string; probe: (mp3: Buffer) => Promise<number>; fetchImpl?: typeof fetch }): Promise<{ lines: FxVoiceLine[]; words: FxWord[]; total: number }> {
  const instructions = fxInstructions(o.mood ?? 'excited', o.extra);
  const said = await Promise.all(lines.map(l => openaiSynthesize(phraseLine(l), { key: o.key, ...(o.base ? { base: o.base } : {}), voice: o.voice ?? FX_VOICE, instructions, ...(o.fetchImpl ? { fetchImpl: o.fetchImpl } : {}) })));
  const out: FxVoiceLine[] = []; let at = 0.25; const words: FxWord[] = [];
  for (let i = 0; i < said.length; i++) {
    const s = said[i]!, dur = await o.probe(s.mp3), cut = speechCut(s.words, dur), len = cut[1] - cut[0];
    const ws = s.words.map(w => ({ word: w.word, t: Math.round((w.t - cut[0] + at) * 1000) / 1000, end: Math.round((w.end - cut[0] + at) * 1000) / 1000 }));
    out.push({ text: lines[i]!, mp3: s.mp3, words: ws, start: at, dur: len, cut }); words.push(...ws);
    at += len + gapAfter(lines[i]!, i);
  }
  return { lines: out, words, total: at };
}
