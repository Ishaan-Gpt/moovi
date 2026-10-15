import type { Word } from '../../timeline';

/**
 * Words, beats and frames. The script is a list of beats (what the voice says in each scene); the voice gives
 * every spoken word a time. Each scene owns the spoken words of its beat, found by aligning the script to the
 * voice (an LCS over normalised tokens), and starts 4 frames before its first one.
 */

const NUM: Record<string, string> = { zero: '0', one: '1', two: '2', three: '3', four: '4', five: '5', six: '6', seven: '7', eight: '8', nine: '9', ten: '10',
  eleven: '11', twelve: '12', fifteen: '15', twenty: '20', thirty: '30', forty: '40', fifty: '50', hundred: '100' };
/** lowercase letters and digits only; number words become digits, so "two" and "2" match */
export const norm = (w: string) => { const s = w.toLowerCase().normalize('NFKD').replace(/[^\p{L}\p{N}]/gu, ''); return NUM[s] ?? s; };

/** Longest common subsequence of two token lists: pairs [i, j] of matched indexes, in order. */
export function lcs(a: string[], b: string[]): [number, number][] {
  const A = a.length, B = b.length;
  const dp = Array.from({ length: A + 1 }, () => new Int32Array(B + 1));
  for (let i = A - 1; i >= 0; i--) for (let j = B - 1; j >= 0; j--) dp[i]![j] = a[i] && a[i] === b[j] ? dp[i + 1]![j + 1]! + 1 : Math.max(dp[i + 1]![j]!, dp[i]![j + 1]!);
  const out: [number, number][] = [];
  for (let i = 0, j = 0; i < A && j < B;) {
    if (a[i] && a[i] === b[j]) { out.push([i, j]); i++; j++; } else if (dp[i + 1]![j]! >= dp[i]![j + 1]!) i++; else j++;
  }
  return out;
}

/** For each beat, the indexes of the spoken words it owns (unmatched spoken words go to the beat before them). */
export function alignBeats(beats: { say: string }[], words: Word[]): number[][] {
  const script = beats.flatMap((b, i) => b.say.split(/\s+/).filter(Boolean).map(w => ({ n: norm(w), beat: i })));
  const owner = new Array<number>(words.length).fill(-1);
  for (const [i, j] of lcs(script.map(s => s.n), words.map(w => norm(w.word)))) owner[j] = script[i]!.beat;
  let cur = 0;
  for (let j = 0; j < words.length; j++) { if (owner[j]! >= 0) cur = Math.max(cur, owner[j]!); owner[j] = cur; }
  return beats.map((_, i) => owner.map((o, j) => (o === i ? j : -1)).filter(j => j >= 0));
}

export interface SceneWord { w: string; n: string; t: number; f: number; i: number }
export interface SceneFrame { i: number; f0: number; f1: number; words: SceneWord[] }

/**
 * Scene bounds from the voice: scene 0 opens on frame 0, every later scene 4 frames before its first spoken word
 * (and at least 12 frames after the previous cut); the last ends 1.2 s after the last word.
 */
export function sceneFrames(beats: { say: string }[], words: Word[], fps = 30): { scenes: SceneFrame[]; frames: number } {
  const own = alignBeats(beats, words);
  const frames = Math.round(((words.at(-1)?.end ?? 2) + 1.2) * fps);
  const scenes: SceneFrame[] = [];
  own.forEach((idx, i) => {
    const ws = idx.map(j => ({ w: words[j]!.word, n: norm(words[j]!.word), t: words[j]!.t, f: Math.round(words[j]!.t * fps), i: j }));
    const prev = scenes.at(-1);
    let f0 = i === 0 ? 0 : (ws[0] ? ws[0].f - 4 : (prev?.f0 ?? 0) + 60);
    if (prev) f0 = Math.max(f0, prev.f0 + 12);
    scenes.push({ i, f0, f1: frames, words: ws });
  });
  scenes.forEach((s, i) => { s.f1 = scenes[i + 1]?.f0 ?? frames; });
  return { scenes, frames };
}

/** Word times at reading pace when there is no voice yet (2.8 words a second, pauses at punctuation and between beats). */
export function readingPace(beats: { say: string }[]): Word[] {
  const out: Word[] = []; let t = 0.15;
  for (const b of beats) {
    for (const w of b.say.split(/\s+/).filter(Boolean)) {
      const d = 0.16 + 0.038 * w.replace(/[^\p{L}\p{N}]/gu, '').length;
      out.push({ word: w, t: +t.toFixed(3), end: +(t + d).toFixed(3) });
      t += d + (/[.!?]$/.test(w) ? 0.32 : /[,;:]$/.test(w) ? 0.14 : 0.03);
    }
    t += 0.4;
  }
  return out;
}
