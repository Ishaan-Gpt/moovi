import { execFile } from 'node:child_process';
import { readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { config } from '../config';
import { isProviderRefusal, NEEDS_SPEECH_KEY } from '../audio/stt';
import { localAllowed, localModel, localWords, sttMode } from '../audio/local-stt';
import { modelScope } from '../runtime';
import { bare, envelope, pauses, splitAt, type Word } from './cut';

/**
 * D1.2, hear: every word of the user's clip, timed, in the RIGHT language. From footage-edit (where it was proven on
 * Vignesh's raw clip), now shared by the edit job, the crew's transcribe task and intake:
 *  1. language lock: Whisper is told the language (the brief's script, else English) instead of guessing; unlocked,
 *     whisper-1 and Groq's Whisper heard the 29.7 s English selfie as 6 words of Urdu (R3);
 *  2. pieces: the clip is split at its pauses into pieces of about 10 s, each timed at once (a noisy 30 s take in one
 *     ask often comes back with only its opening);
 *  3. the accurate text: gpt-4o-transcribe (no timings) on the whole clip, the answer that agrees most with the timed
 *     words wins, and its words are laid onto the timings (`align`);
 *  4. confidence gate: words per voiced second, share of words in the locked language's script, and agreement with
 *     the accurate text. A failing locked transcript is tried once unlocked; the better one is kept and the gate's
 *     verdict travels with it, so a caller can refuse to caption words it cannot trust.
 * The keys are the job's own (bring your own key: Groq or OpenAI), else GROQ_API_KEY / OPENAI_API_KEY;
 * MOOVI_OPENAI_BASE and MOOVI_GROQ_BASE point either at a proxy.
 */

/** How many words of `text` agree with the timed words, in order (longest common subsequence on bare words). */
/**
 * The key two transcripts are matched on: `bare` with the combining marks KEPT and the spellings Hindi writes two ways
 * folded together. `bare` drops \p{M}, which for Devanagari is every vowel sign and the virama, so "है", "हैं" and
 * "हूँ" all became "ह" and the alignment anchored on the wrong words (R9's B4: whisper-1 words leaked into the text).
 * Folded: the nukta (ज़/ज), chandrabindu to anusvara (हूँ/हूं), a nasal half letter before a consonant to anusvara
 * (हिन्दी/हिंदी). Latin text keys exactly as `bare` did.
 */
export const wordKey = (w: string) => w.toLowerCase().normalize('NFC').replace(/[^\p{L}\p{M}\p{N}']/gu, '')
  .replace(/\u093c/g, '').replace(/\u0901/g, '\u0902').replace(/[\u0919\u091e\u0923\u0928\u092e]\u094d(?=[\u0915-\u0939])/g, '\u0902');

export function agreement(text: string, timed: Word[]): number {
  const A = text.split(/\s+/).map(wordKey).filter(Boolean), T = timed.map(w => wordKey(w.word));
  let prev = new Int16Array(T.length + 1);
  for (const a of A) { const cur = new Int16Array(T.length + 1); for (let j = 0; j < T.length; j++) cur[j + 1] = a === T[j] ? prev[j]! + 1 : Math.max(prev[j + 1]!, cur[j]!); prev = cur; }
  return prev[T.length]!;
}

/**
 * The accurate text to trust: the answer that agrees with the most timed words (a wrong-language or drifting answer
 * agrees with few), longer on a tie; none when even the best agrees with under a third of what was timed.
 */
export function pickText(cands: string[], timed: Word[], o: { ordered?: boolean } = {}): string | null {
  const scored = cands.map((c, i) => ({ c, i, a: agreement(c, timed) })).sort((x, y) => y.a - x.a || y.c.length - x.c.length);
  const best = scored[0];
  if (!best || best.a < Math.max(3, timed.length / 3)) return null;
  // ordered: the candidates come best model first; the first one within 10% of the best agreement wins. The timed words
  // are whisper-1's, so agreement with them finds a drifting answer but cannot rank two good ones (B4: the weaker
  // Hindi text agreed with 125 timed words, the stronger with 122)
  if (o.ordered) return scored.filter(x => x.a >= 0.9 * best.a).sort((x, y) => x.i - y.i)[0]!.c;
  return best.c;
}

/**
 * The brief's own names (the hint), heard any near way ("Moviez", "Movies", "Moovie" for "Moovi"): a word whose sound
 * key (lower case, doubled letters collapsed, a trailing s, z or e dropped) matches the name's is written as the name.
 */
function lev(a: string, b: string): number {
  const d = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) { let p = d[0]!; d[0] = i; for (let j = 1; j <= b.length; j++) { const t = d[j]!; d[j] = Math.min(d[j]! + 1, d[j - 1]! + 1, p + (a[i - 1] === b[j - 1] ? 0 : 1)); p = t; } }
  return d[b.length]!;
}
export function nameFix(ws: Word[], names: string[]): Word[] {
  const key = (w: string) => bare(w).replace(/(.)\1+/g, '$1').replace(/[sz]$/, '').replace(/e$/, '');
  const ks = names.filter(n => /^[A-Za-z][\w']{2,}$/.test(n)).map(n => ({ n, k: key(n) })).filter(x => x.k.length >= 3);
  // a near miss ("Moovly" for "Moovi", sound keys one or two edits apart, same first two letters) counts only for a
  // capitalised word inside a sentence, where the transcriber itself thought it heard a name ("move" stays "move")
  const near = (a: string, b: string) => a.slice(0, 2) === b.slice(0, 2) && Math.abs(a.length - b.length) <= 1 && a.length >= 4 && lev(a, b) <= 2;
  const out = ws.map((w, i) => {
    const k = key(w.word), named = /^\p{Lu}/u.test(w.word) && i > 0 && !/[.!?]["')\]]*$/.test(ws[i - 1]!.word);
    const hit = ks.find(x => bare(w.word) !== bare(x.n) && (k === x.k || (named && near(k, x.k))));
    return hit ? { ...w, word: hit.n + (w.word.match(/[.,!?;:]+$/)?.[0] ?? '') } : w;
  });
  // a two-word term heard with its first word wrong ("software media" for "social media"): the second word matches, the
  // first starts with the same letter and is about as long
  for (const t of names.map(n => n.split(/\s+/)).filter(t => t.length === 2)) {
    const [a, b] = t.map(bare) as [string, string];
    for (let i = 0; i + 1 < out.length; i++) {
      const x = bare(out[i]!.word), y = bare(out[i + 1]!.word);
      if (y === b && x !== a && x[0] === a[0] && Math.abs(x.length - a.length) <= 3 && !/[.,!?;:]$/.test(out[i]!.word)) out[i] = { ...out[i]!, word: t[0]! };
    }
  }
  return out;
}

/** Apply the brief's corrections ("movies" -> "Moovi", "software media" -> "social media"), keeping each word's punctuation and timing. */
export function fixWords(ws: Word[], fixes: Record<string, string>): Word[] {
  const out = ws.map(w => ({ ...w }));
  for (const [from, to] of Object.entries(fixes)) {
    const f = from.toLowerCase().split(/\s+/).map(bare), t = to.split(/\s+/);
    for (let i = 0; i + f.length <= out.length; i++) {
      if (!f.every((x, k) => bare(out[i + k]!.word) === x)) continue;
      const tail = out[i + f.length - 1]!.word.match(/[.,!?;:]+$/)?.[0] ?? '';
      t.forEach((x, k) => { if (k < f.length) out[i + k]!.word = x + (k === t.length - 1 ? tail : ''); });
      if (t.length < f.length) { out[i + t.length - 1]!.end = out[i + f.length - 1]!.end; out.splice(i + t.length, f.length - t.length); }
    }
  }
  return out;
}

/**
 * Lay the accurate words onto the timed ones: a longest-common-subsequence match on bare words anchors the shared
 * words; each run of accurate words between two anchors takes the time span of the timed words between them (or of the
 * gap), split by length. Timed words with no counterpart are kept (they are said; the accurate model may skip a slate).
 */
export function align(timed: Word[], text: string, o: { strict?: boolean } = {}): Word[] {
  const acc = text.split(/\s+/).filter(Boolean);
  const A = acc.map(wordKey), T = timed.map(w => wordKey(w.word));
  const n = A.length, m = T.length, L = Array.from({ length: n + 1 }, () => new Int16Array(m + 1));
  for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) L[i]![j] = A[i] === T[j] && A[i] ? L[i + 1]![j + 1]! + 1 : Math.max(L[i + 1]![j]!, L[i]![j + 1]!);
  const pairs: [number, number][] = [];
  for (let i = 0, j = 0; i < n && j < m;) { if (A[i] === T[j] && A[i]) { pairs.push([i, j]); i++; j++; } else if (L[i + 1]![j]! >= L[i]![j + 1]!) i++; else j++; }
  if (!o.strict && (pairs.length < Math.max(2, acc.length * 0.3) || acc.length < timed.length * 0.6)) return timed; // too different, or the text stopped early
  const out: Word[] = [];
  const anchors: [number, number][] = [[-1, -1], ...pairs, [n, m]];
  for (let k = 0; k < anchors.length - 1; k++) {
    const [i0, j0] = anchors[k]!, [i1, j1] = anchors[k + 1]!;
    if (i0 >= 0) out.push({ ...timed[j0]!, word: acc[i0]! });
    const accRun = acc.slice(i0 + 1, i1), tRun = timed.slice(j0 + 1, j1);
    if (!accRun.length) {
      // timed-only words the accurate text skipped: a run longer than a stray word is speech, keep it
      // (strict: the text is the truth, e.g. a published subtitle; nothing outside it is added)
      if (!o.strict && (k === 0 || k === anchors.length - 2 || tRun.length > 2)) out.push(...tRun);
      continue;
    }
    const s = tRun.length ? tRun[0]!.t : (j0 >= 0 ? timed[j0]!.end : Math.max(0, (timed[j1]?.t ?? 0) - 0.3 * accRun.length));
    const e = tRun.length ? tRun.at(-1)!.end : (j1 < m ? timed[j1]!.t : s + 0.3 * accRun.length);
    if (!o.strict && k === 0 && tRun.length > accRun.length + 2) { out.push(...tRun); continue; } // a pre-roll the accurate model skipped
    const tot = accRun.reduce((a, w) => a + w.length + 1, 0); let c = s;
    for (const w of accRun) { const d = (e - s) * (w.length + 1) / tot; out.push({ word: w, t: +c.toFixed(3), end: +(c + d).toFixed(3) }); c += d; }
  }
  return out;
}


// ---------- the speech-to-text calls ----------
export type SttProvider = 'groq' | 'openai';

/**
 * The accurate-text models asked for a language (MOOVI_TEXT_MODEL pins one). English: gpt-4o-transcribe. Any other
 * language: gpt-4o-mini-transcribe first, gpt-4o-transcribe beside it, and pickText (ordered) keeps the first answer that
 * agrees with the timed words about as well as the best. Measured 2026-10-16 on R9's B4 (Hindi, 101 s) against the
 * Commons subtitle text: the hearing with the mini model's text 88.3 to 91.2% words right over 4 runs, with
 * gpt-4o-transcribe's 79.0 and 81.3% (it drops and respells words; on 8 s pieces it fell to 42 to 45%).
 */
export function textModels(lang: string): string[] {
  const pin = process.env.MOOVI_TEXT_MODEL?.trim();
  if (pin) return [pin];
  return lang === 'en' ? ['gpt-4o-transcribe'] : ['gpt-4o-mini-transcribe', 'gpt-4o-transcribe'];
}
interface Key { provider: SttProvider; key: string }
const MODEL: Record<SttProvider, string> = { groq: 'whisper-large-v3-turbo', openai: 'whisper-1' };
const base = (p: SttProvider) => p === 'openai' ? `${(process.env.MOOVI_OPENAI_BASE ?? 'https://api.openai.com').replace(/\/$/, '')}/v1/audio/transcriptions` : `${(process.env.MOOVI_GROQ_BASE ?? 'https://api.groq.com').replace(/\/$/, '')}/openai/v1/audio/transcriptions`;

/** The timed-words key: the job's own, else the server's (Groq first: faster and free tier). */
export function timedKey(): Key | null {
  const s = modelScope()?.audio; if (s) return s;
  if (process.env.GROQ_API_KEY) return { provider: 'groq', key: process.env.GROQ_API_KEY };
  if (process.env.OPENAI_API_KEY) return { provider: 'openai', key: process.env.OPENAI_API_KEY };
  return null;
}
/** The accurate-text key: OpenAI only (gpt-4o-transcribe), the job's own when it is OpenAI, else OPENAI_API_KEY. */
export function textKey(): string | null { const s = modelScope()?.audio; return s?.provider === 'openai' ? s.key : process.env.OPENAI_API_KEY ?? null; }

/** One transcription request. `lang` is an ISO 639-1 code (the lock); `timed` asks for word timings. */
export async function whisper(file: string, k: Key, o: { lang?: string; prompt?: string; timed: boolean; model?: string; signal?: AbortSignal }): Promise<{ text: string; words: Word[]; language: string }> {
  const form = new FormData();
  form.append('file', new Blob([new Uint8Array(readFileSync(file))], { type: file.endsWith('.wav') ? 'audio/wav' : 'audio/mpeg' }), file.endsWith('.wav') ? 'audio.wav' : 'audio.mp3');
  form.append('model', o.model ?? MODEL[k.provider]);
  if (o.lang) form.append('language', o.lang);
  if (o.prompt) form.append('prompt', o.prompt);
  form.append('response_format', o.timed ? 'verbose_json' : 'json');
  if (o.timed) form.append('timestamp_granularities[]', 'word');
  const r = await fetch(base(k.provider), { method: 'POST', headers: { authorization: `Bearer ${k.key}` }, body: form, signal: o.signal ?? AbortSignal.timeout(90_000) });
  if (!r.ok) throw new Error(`${k.provider} speech-to-text answered ${r.status}: ${(await r.text()).slice(0, 160)}`);
  const j = await r.json() as { text?: string; language?: string; words?: { word: string; start: number; end: number }[] };
  return { text: (j.text ?? '').trim(), language: j.language ?? o.lang ?? '', words: (j.words ?? []).map(w => ({ word: w.word.trim(), t: +w.start.toFixed(3), end: +w.end.toFixed(3) })).filter(w => w.word) };
}

// ---------- language lock and the gate ----------
const SCRIPT: Record<string, RegExp> = {
  en: /\p{Script=Latin}/u, es: /\p{Script=Latin}/u, fr: /\p{Script=Latin}/u, de: /\p{Script=Latin}/u, pt: /\p{Script=Latin}/u, it: /\p{Script=Latin}/u, id: /\p{Script=Latin}/u,
  hi: /\p{Script=Devanagari}/u, mr: /\p{Script=Devanagari}/u, ne: /\p{Script=Devanagari}/u, ta: /\p{Script=Tamil}/u, te: /\p{Script=Telugu}/u,
  kn: /\p{Script=Kannada}/u, ml: /\p{Script=Malayalam}/u, bn: /\p{Script=Bengali}/u, as: /\p{Script=Bengali}/u, gu: /\p{Script=Gujarati}/u,
  pa: /\p{Script=Gurmukhi}/u, ur: /\p{Script=Arabic}/u, ar: /\p{Script=Arabic}/u, ru: /\p{Script=Cyrillic}/u, ja: /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]/u, zh: /\p{Script=Han}/u,
};
const BY_SCRIPT: [RegExp, string][] = [[/\p{Script=Devanagari}/u, 'hi'], [/\p{Script=Tamil}/u, 'ta'], [/\p{Script=Telugu}/u, 'te'], [/\p{Script=Kannada}/u, 'kn'], [/\p{Script=Malayalam}/u, 'ml'], [/\p{Script=Bengali}/u, 'bn'], [/\p{Script=Gujarati}/u, 'gu'], [/\p{Script=Gurmukhi}/u, 'pa'], [/\p{Script=Arabic}/u, 'ur'], [/\p{Script=Cyrillic}/u, 'ru']];

/** The language to lock: MOOVI_STT_LANG, else the brief's own script (Latin letters, or no brief: English). */
export function lockLanguage(brief = ''): string {
  const env = process.env.MOOVI_STT_LANG?.trim().toLowerCase(); if (env) return env;
  for (const [re, code] of BY_SCRIPT) if (re.test(brief)) return code;
  return 'en';
}

const NAMES: Record<string, string> = { english: 'en', hindi: 'hi', urdu: 'ur', tamil: 'ta', telugu: 'te', kannada: 'kn', malayalam: 'ml', bengali: 'bn', marathi: 'mr', gujarati: 'gu', punjabi: 'pa', spanish: 'es', french: 'fr', german: 'de', portuguese: 'pt', italian: 'it', arabic: 'ar', russian: 'ru', japanese: 'ja', chinese: 'zh', indonesian: 'id', nepali: 'ne', assamese: 'as' };
/** An ISO 639-1 code from what Whisper reported ("english" or "en"), else from the words' script. */
export function langCode(reported: string, ws: Word[]): string | null {
  const r = reported.trim().toLowerCase();
  if (/^[a-z]{2}$/.test(r)) return r;
  if (NAMES[r]) return NAMES[r]!;
  for (const [re, code] of BY_SCRIPT) if (ws.some(w => re.test(w.word))) return code;
  return ws.some(w => /\p{Script=Latin}/u.test(w.word)) ? 'en' : null;
}

export interface Gate { ok: boolean; words_per_s: number; script_pct: number; agreement_pct: number | null; reasons: string[] }
/**
 * Trust in a transcript: words per voiced second (speech runs 1.5 to 4.5; under 0.8 means most speech went unheard),
 * the share of words written in the locked language's script, and how much of it the accurate text agrees with.
 */
export function gate(ws: Word[], voiced: number, lang: string, text: string | null): Gate {
  const wps = voiced > 0.5 ? ws.length / voiced : ws.length ? 2 : 0;
  const re = SCRIPT[lang], letters = ws.filter(w => /\p{L}/u.test(w.word));
  const script = !re || !letters.length ? 100 : Math.round(100 * letters.filter(w => re.test(w.word)).length / letters.length);
  const agree = text && ws.length ? Math.round(100 * agreement(text, ws) / ws.length) : null;
  const reasons: string[] = [];
  if (voiced > 2 && wps < 0.8) reasons.push(`only ${wps.toFixed(2)} words per voiced second`);
  if (script < 85) reasons.push(`${100 - script}% of words are not in the ${lang} script`);
  if (agree !== null && agree < 50) reasons.push(`the accurate text agrees with ${agree}% of the timed words`);
  return { ok: !reasons.length, words_per_s: +wps.toFixed(2), script_pct: script, agreement_pct: agree, reasons };
}

/** Names Moovi always spells right, plus MOOVI_VOCAB (comma separated) on the server. */
export const DEFAULT_VOCAB = ['Moovi', 'Ishaan'];
/** The project's vocabulary: the defaults, the server's list and the project's own names, each once. */
export function vocabulary(names: string[] = []): string[] {
  const env = (process.env.MOOVI_VOCAB ?? '').split(',').map(s => s.trim()).filter(Boolean);
  const all = [...DEFAULT_VOCAB, ...env, ...names].map(s => s.trim()).filter(s => s.length >= 2 && s.length <= 40);
  return all.filter((s, i) => all.findIndex(x => x.toLowerCase() === s.toLowerCase()) === i).slice(0, 40);
}
/** Whisper's prompt: the vocabulary as a short sentence (it biases spelling toward these words; 224 tokens at most). */
export function vocabPrompt(names: string[]): string { return names.length ? `${names.join(', ')}.` : ''; }

export interface HearOpts { /** piece length the clip is split into at pauses (default 8 s) */ piece?: number; lang?: string; brief?: string; prompt?: string; signal?: AbortSignal; fixes?: Record<string, string>; names?: string[] }
export interface Heard { words: Word[]; /** the locked language */ lang: string; /** the language the words are in (the lock, or what the unlocked retry heard) */ language: string; /** the vocabulary prompt Whisper got */ prompt: string; detected: string; by: string; text: string | null; gate: Gate; pieces: number; timings: Record<string, number> }

const ff = (args: string[]) => new Promise<void>((res, rej) => execFile(config.ffmpeg, ['-nostdin', '-v', 'error', '-y', ...args], { timeout: 60_000, killSignal: 'SIGKILL' }, e => e ? rej(e) : res()));

/** Hear a clip: language-locked timed words in pieces, the accurate text laid on, the gate. `audio` is any audio or video file. */
/**
 * Re-lock from the default English to what an unlocked pass heard, or null to keep English. Only when the unlocked
 * pass names a language other than English that is not written in Arabic script (R3: an Indian-accented English take
 * was misread as Urdu; an Urdu speaker names the language in the brief or MOOVI_STT_LANG), most of its letters are in
 * that language's script, and it heard at least a third as many words as the English pass (a translation runs longer). Pure, unit tested.
 */
export function relock(reported: string, heard: Word[], english: Word[]): string | null {
  const code = langCode(reported, heard);
  if (!code || code === 'en' || code === 'ur' || code === 'ar' || !SCRIPT[code]) return null;
  const letters = [...heard.map(w => w.word).join('')].filter(c => /\p{L}/u.test(c));
  // Hindi and Urdu are one spoken language: unlocked Whisper starts a Hindi speaker in Devanagari and drifts into Urdu
  // script piece by piece (R9's B4: 172 Devanagari, 296 Arabic letters, reported "hindi"), so for Hindi both count
  const own = code === 'hi' ? (c: string) => SCRIPT.hi!.test(c) || /\p{Script=Arabic}/u.test(c) : (c: string) => SCRIPT[code]!.test(c);
  if (!letters.length || letters.filter(own).length / letters.length < 0.6) return null;
  if (code === 'hi' && !letters.some(c => SCRIPT.hi!.test(c))) return null;
  return heard.length >= 0.35 * english.length ? code : null;
}

let pieceRun = 0;
/**
 * The keyed hearing below, or, with no key (or MOOVI_STT=local), Whisper on this machine (audio/local-stt.ts); the
 * local model also takes over when the keyed provider refuses (billing, a bad key, an outage). With MOOVI_STT=off and
 * no key it throws NEEDS_SPEECH_KEY, and a refusal throws as it always did.
 */
export async function hear(audio: string, dir: string, o: HearOpts = {}): Promise<Heard> {
  const tk = sttMode() === 'local' ? null : timedKey();
  if (!tk) { if (!localAllowed()) throw new Error(NEEDS_SPEECH_KEY); return hearLocal(audio, o); }
  try { return await hearKeyed(audio, dir, o, tk); } catch (e) {
    if (!isProviderRefusal(e) || !localAllowed()) throw e;
    const why = String((e as Error).message ?? e).replace(/\s+/g, ' ').slice(0, 120);
    console.warn(`[hear] ${why}; hearing it with the local model instead`);
    const h = await hearLocal(audio, o);
    return { ...h, by: `${h.by} (${tk.provider} refused: ${why})` };
  }
}

/**
 * The no-key hearing: one local Whisper pass over the whole clip (its own 30 s windows), locked to the brief's
 * language, the vocabulary laid on by nameFix (Whisper's prompt is not used here), and the same gate. No relock and no
 * accurate-text model: those need a key.
 */
async function hearLocal(audio: string, o: HearOpts): Promise<Heard> {
  const timings: Record<string, number> = {}; let tl = Date.now();
  const lap = (k: string) => { timings[k] = +((Date.now() - tl) / 1000).toFixed(3); tl = Date.now(); };
  const names = vocabulary(o.names), lang = o.lang ?? lockLanguage(o.brief);
  const env = await envelope(audio), ps = pauses(env), duration = env.db.length * env.hop;
  const voiced = Math.max(0, duration - ps.reduce((a, [x, y]) => a + (y - x), 0));
  lap('prepare');
  const r = await localWords(audio, { lang, ...(o.signal ? { signal: o.signal } : {}) });
  lap('timed+text');
  let words = r.words;
  if (o.fixes) words = fixWords(words, o.fixes);
  if (names.length) words = nameFix(words, names);
  return { words, lang, language: lang, detected: r.language || lang, by: `local ${localModel()}, locked to ${lang}`, text: r.text || null, gate: gate(words, voiced, lang, null), pieces: 1, prompt: '', timings };
}

async function hearKeyed(audio: string, dir: string, o: HearOpts, tk: Key): Promise<Heard> {
  const timings: Record<string, number> = {}; let tl = Date.now();
  const lap = (k: string) => { timings[k] = +((Date.now() - tl) / 1000).toFixed(3); tl = Date.now(); };
  const names = vocabulary(o.names), lang = o.lang ?? lockLanguage(o.brief), prompt = o.prompt ?? vocabPrompt(names);
  const mp3 = join(dir, `hear-${process.pid}-${Date.now()}.mp3`);
  await ff(['-i', audio, '-vn', '-ac', '1', '-ar', '16000', '-b:a', '64k', mp3]);
  const env = await envelope(mp3), ps = pauses(env), duration = env.db.length * env.hop;
  const voiced = Math.max(0, duration - ps.reduce((a, [x, y]) => a + (y - x), 0));
  const cuts = splitAt(ps, duration, o.piece ?? 8);
  lap('prepare');
  const files: string[] = [mp3];
  try {
    const timedRun = async (l: string | undefined, pr: string = prompt) => {
      const parts = await Promise.all(cuts.map(async ([a, b], k) => {
        // a name per run: the locked and the unlocked pass (and other clips in one process) cut pieces at once, and a
        // shared name let one ffmpeg truncate a piece another upload was reading (R9 bench: 400 "Invalid file format")
        const f = cuts.length === 1 ? mp3 : join(dir, `hear-piece-${process.pid}-${++pieceRun}-${k}.mp3`);
        if (f !== mp3) { await ff(['-ss', a.toFixed(3), '-t', (b - a).toFixed(3), '-i', mp3, '-c:a', 'libmp3lame', '-b:a', '64k', f]); files.push(f); }
        const r = await whisper(f, tk, { ...(l ? { lang: l } : {}), prompt: pr, timed: true, ...(o.signal ? { signal: o.signal } : {}) });
        // the piece's own text carries the punctuation its timed words lack (Groq's Whisper words have none): laid on
        // per piece, so sentence ends survive even when no accurate-text model is available
        const ws = r.text && /[.!?,]/.test(r.text) ? align(r.words, r.text) : r.words;
        return { ...r, words: ws.map(w => ({ ...w, t: +(w.t + a).toFixed(3), end: +(w.end + a).toFixed(3) })) };
      }));
      return { words: parts.flatMap(p => p.words), language: parts[0]?.language ?? l ?? '' };
    };
    const tx = textKey();
    const textRun = tx ? Promise.all(textModels(lang).flatMap(model => [prompt, ''].filter((p, i, a) => a.indexOf(p) === i).map(p => whisper(mp3, { provider: 'openai', key: tx }, { lang, prompt: p, timed: false, model, ...(o.signal ? { signal: o.signal } : {}) }).then(r => r.text).catch(() => '')))) : Promise.resolve([] as string[]);
    // no language named (no brief script, no MOOVI_STT_LANG): the English lock translates a Hindi speaker into fluent
    // English that passes every gate (R9's B4), so an unlocked pass runs beside it and may re-lock (relock below); it
    // gets no vocabulary prompt (the English names pulled a Hindi piece into a few garbled words)
    let probeErr: string | null = null;
    const byDefault = !o.lang && !process.env.MOOVI_STT_LANG?.trim() && lang === 'en';
    const [locked, texts, probe] = await Promise.all([timedRun(lang), textRun, byDefault ? timedRun(undefined, '').catch(err => { probeErr = String((err as Error)?.message ?? err).slice(0, 200); return null; }) : Promise.resolve(null)]);
    lap('timed+text');
    const pickFor = (ws: Word[]) => pickText(texts.filter(Boolean), ws, { ordered: true });
    let words = locked.words, text = pickFor(words), detected = locked.language, by = `${tk.provider} ${MODEL[tk.provider]}, locked to ${lang}, ${cuts.length} piece${cuts.length > 1 ? 's' : ''}`;
    if (byDefault && !probe) by += `, the unlocked pass failed (${probeErr})`;
    let g = gate(words, voiced, lang, text), relocked: string | null = null;
    const re = probe ? relock(probe.language, probe.words, words) : null;
    if (probe && re) {
      // heard in its own language: the accurate text again in that language (the English one was a translation)
      // (every accurate-text model for that language, at once, beside the timed words again)
      const [t2, again] = await Promise.all([
        tx ? Promise.all(textModels(re).map(model => whisper(mp3, { provider: 'openai', key: tx }, { lang: re, timed: false, model, ...(o.signal ? { signal: o.signal } : {}) }).then(r => r.text).catch(() => ''))) : Promise.resolve([] as string[]),
        // the timed words again, locked to that language: the unlocked pass may drift script between pieces
        timedRun(re, '').catch(() => null)]);
      const ws = again?.words.length ? again.words : probe.words;
      words = ws; text = pickText(t2.filter(Boolean), ws, { ordered: true }); g = gate(words, voiced, re, text); detected = probe.language; relocked = re;
      by = `${tk.provider} ${MODEL[tk.provider]}, no language named, heard as ${re} (the English lock translated it), ${cuts.length} piece${cuts.length > 1 ? 's' : ''}`;
      lap('relock');
    }
    if (!g.ok) {
      // the lock may be wrong (a Hindi speaker with an English brief): one unlocked try, the better gate wins
      const free = await timedRun(undefined).catch(() => null);
      lap('unlocked');
      if (free) {
        const code = Object.keys(SCRIPT).find(c => free.words.some(w => SCRIPT[c]!.test(w.word)) && c !== 'en' && c !== lang) ?? lang;
        const ft = pickFor(free.words), fg = gate(free.words, voiced, /^[a-z]{2}$/.test(free.language) ? free.language : code, ft);
        const score = (x: Gate) => (x.ok ? 1000 : 0) + Math.min(x.words_per_s, 3) * 100 + x.script_pct;
        if (score(fg) > score(g)) { words = free.words; text = ft; g = fg; detected = free.language; by = `${tk.provider} ${MODEL[tk.provider]}, unlocked (${free.language}), ${cuts.length} pieces`; }
      }
    }
    if (text) { words = align(words, text); by += ', accurate text laid on'; }
    if (o.fixes) words = fixWords(words, o.fixes);
    if (names.length) words = nameFix(words, names);
    lap('align');
    const language = relocked ?? (by.includes(', unlocked') ? langCode(detected, words) ?? lang : lang);
    return { words, lang: relocked ?? lang, language, detected, by, text, gate: g, pieces: cuts.length, prompt, timings };
  } finally { for (const f of files) rmSync(f, { force: true }); }
}
