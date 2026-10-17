/**
 * Token budget for the Claude Code bridge (docs/agents/claude-code-bridge item 5; plan section 23.3). The user's own
 * Claude Code is the brain for only 1 to 3 calls per video, and each call must stay small because it is the user's plan
 * and the user is waiting. The server enforces the caps BEFORE a step is sent: an estimator (no tokenizer download, a
 * deliberately high estimate), a trimmer that shortens the transcript until the step fits, and a per-video ledger.
 * Pure: no model, no I/O.
 */

export type BrainCall = 'edit' | 'film' | 'look';
export interface Cap { in: number; out: number }

/** per call (plan 23.3) */
export const BRAIN_CAPS: Record<BrainCall, Cap> = {
  edit: { in: 6000, out: 1200 },
  film: { in: 5000, out: 1500 },
  look: { in: 2000, out: 300 },
};
/** per video, all calls together */
export const VIDEO_CAP: Cap = { in: 10_000, out: 2500 };
/** the fixed cost of one /mcp__moovi__run (the prompt and the tool descriptions), counted once per video */
export const RUN_OVERHEAD = 1000;

/**
 * Tokens in a text, estimated high on purpose: 1 token per 2.8 characters for ASCII and 1 per 1.3 for everything
 * else (Devanagari, emoji, CJK tokenize much denser). Over-estimating only trims a little more; under-estimating
 * would break the user's budget. Item 27 (2026-10-17, the provider's count_tokens): the old 3.6 / 1.5 ran 11 to 22
 * percent LOW on what a step really carries (the edit step 2,348 estimated vs 2,624 counted; its JSON schema 667 vs
 * 770; Hinglish 32 vs 41). 2.8 / 1.3 is at or above the count on every measured sample (2 to 28 percent high on the
 * step's parts); `ESTIMATE_SAMPLES` in test/budget.test.ts keeps those counts.
 */
export function estimateTokens(text: string): number {
  if (!text) return 0;
  let ascii = 0, other = 0;
  for (const ch of text) (ch.charCodeAt(0) < 128 ? ascii++ : other++);
  return Math.ceil(ascii / 2.8 + other / 1.3);
}

/** An image's tokens as Claude counts them (width x height / 750), after its own resize to at most 1568 px on the long side. */
export function imageTokens(w: number, h: number): number {
  const s = Math.min(1, 1568 / Math.max(w, h, 1));
  return Math.ceil((Math.round(w * s) * Math.round(h * s)) / 750);
}

export interface Sentence { i: number; t0: number; text: string }

const words = (s: string) => s.trim().split(/\s+/).filter(Boolean);
const cut = (s: string, n: number) => { const w = words(s); return w.length <= n ? w.join(' ') : `${w.slice(0, n).join(' ')} ...`; };

/** One line per sentence, the way the step shows it: "3 [12.4s] the sentence". */
export function sentenceLines(ss: Sentence[]): string { return ss.map(s => `${s.i} [${s.t0.toFixed(1)}s] ${s.text}`).join('\n'); }

/**
 * The transcript as the edit step sends it, within `cap` tokens once `fixed` (everything else in the step) is added.
 * Every sentence keeps its number (the answer tags every sentence), only its words shrink: each to 30 words and the whole
 * to 1,500 words first (plan 23.2), then every sentence to its first 12, 6, then 3 words. `fits` false = even 3 words a
 * sentence is over the cap; the bridge then uses the rules for this clip instead of sending it.
 */
export function trimTranscript(ss: Sentence[], cap: number, fixed = 0): { lines: string; tokens: number; perSentence: number | null; fits: boolean } {
  const tok = (lines: string) => estimateTokens(lines) + fixed;
  let per: number | null = null;
  let out = ss.map(s => ({ ...s, text: cut(s.text, 30) }));
  const total = out.reduce((n, s) => n + words(s.text).length, 0);
  if (total > 1500) { per = 12; out = ss.map(s => ({ ...s, text: cut(s.text, 12) })); }
  let lines = sentenceLines(out);
  for (const n of [12, 6, 3]) {
    if (tok(lines) <= cap) break;
    if (per !== null && per <= n) continue;
    per = n; out = ss.map(s => ({ ...s, text: cut(s.text, n) })); lines = sentenceLines(out);
  }
  const tokens = tok(lines);
  return { lines, tokens, perSentence: per, fits: tokens <= cap };
}

/** Lines (a shot list, findings) kept in order until the next one would pass `cap` tokens. */
export function fitLines(lines: string[], cap: number): { kept: string[]; dropped: number; tokens: number } {
  const kept: string[] = []; let tokens = 0;
  for (const l of lines) { const t = estimateTokens(l) + 1; if (tokens + t > cap) break; kept.push(l); tokens += t; }
  return { kept, dropped: lines.length - kept.length, tokens };
}

/**
 * One video's ledger: every brain call asks it before the step is sent and reports what came back. A call that would
 * pass its own cap or the video's is refused with the reason (the optional final look is simply skipped; a required
 * call trims harder or falls back to the rules).
 */
export class VideoBudget {
  usedIn = RUN_OVERHEAD; usedOut = 0;
  readonly calls: { call: BrainCall; in: number; out: number }[] = [];
  /** May a step of `tokens` input go out now? */
  allow(call: BrainCall, tokens: number): { ok: true; maxOut: number } | { ok: false; why: string } {
    const cap = BRAIN_CAPS[call];
    if (tokens > cap.in) return { ok: false, why: `${call} step is ${tokens} tokens; its cap is ${cap.in}` };
    if (this.usedIn + tokens > VIDEO_CAP.in) return { ok: false, why: `video would use ${this.usedIn + tokens} input tokens; the cap is ${VIDEO_CAP.in}` };
    const left = VIDEO_CAP.out - this.usedOut;
    if (left <= 0) return { ok: false, why: `video output cap ${VIDEO_CAP.out} reached` };
    return { ok: true, maxOut: Math.min(cap.out, left) };
  }
  /** Record a sent step and its answer (input estimated by us, output estimated from the answer's text). */
  spend(call: BrainCall, tokensIn: number, answer: string): { out: number; overOut: boolean } {
    const out = estimateTokens(answer);
    this.usedIn += tokensIn; this.usedOut += out;
    this.calls.push({ call, in: tokensIn, out });
    return { out, overOut: out > BRAIN_CAPS[call].out };
  }
  get left(): Cap { return { in: Math.max(0, VIDEO_CAP.in - this.usedIn), out: Math.max(0, VIDEO_CAP.out - this.usedOut) }; }
}
