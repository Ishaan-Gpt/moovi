import type { Signature } from '../types';
import { SIGNATURE as S1 } from '../style-1';
import { UNIQUE } from '../unique';

/**
 * Deterministic first: a brief (and any upload) is read with rules, not a model, then scored against every
 * style's signature. A known style that the engine can make on its own and that clears its threshold wins;
 * otherwise the video gets a unique style, told which known style it is nearest to. A model is asked only for
 * the intent, and only when the brief names none (`needsIntent`).
 */

/** The known styles the engine can't make on its own yet: known for matching and as inspiration for a unique card. */
export const KNOWN: Signature[] = [
  S1,
  { style: 's2', formats: ['landscape'], min: 18, max: 30, languages: ['hinglish', 'hindi'], footage: 'none', intents: ['promo', 'kinetic', 'hinglish', 'type', 'comment'], avoid: ['cinematic', 'footage'], threshold: 0.6, autonomous: false },
  { style: 's3', formats: ['landscape', 'vertical'], min: 20, max: 45, languages: ['en'], footage: 'none', intents: ['cinematic', 'launch', 'film', '3d', 'feeling', 'premium', 'apple', 'trailer', 'teaser'], avoid: ['explain', 'tutorial', 'tips'], threshold: 0.6, autonomous: false },
  { style: 's4', formats: ['vertical'], min: 30, max: 60, languages: ['en'], footage: 'none', intents: ['essay', 'metaphor', 'thesis', 'thought', 'story', 'opinion', 'why'], avoid: ['promo', 'launch'], threshold: 0.6, autonomous: false },
  { style: 'e1', formats: ['vertical'], min: 15, max: 90, languages: ['any'], footage: 'edit', intents: ['edit', 'captions', 'reel', 'podcast', 'talking', 'clip', 'cut'], avoid: [], threshold: 0.5, autonomous: false },
];
export const SIGNATURES: Signature[] = [...KNOWN, UNIQUE.signature];

export interface UploadProbe {
  id: string; name: string; mime: string;
  duration?: number; width?: number; height?: number; hasAudio?: boolean;
  /** words a second the voice says (faster-whisper), 0 when there is no speech */
  speechRate?: number;
  /** share of sampled frames with a face (0..1) */
  faceRatio?: number;
  /** scene cuts a second (ffmpeg scene detection) */
  cutRate?: number;
}

export type Footage = 'none' | 'edit' | 'reference' | 'unclear';
export interface Features {
  text: string;
  format: 'vertical' | 'landscape' | 'square' | null;
  seconds: number | null;
  language: 'en' | 'hinglish' | 'hindi' | 'other';
  footage: Footage;
  footageWhy: string[];
  /** the video upload the footage decision is about */
  clip: string | null;
  voiceover: string | null;
  images: string[];
  urls: string[];
  intents: string[];
  words: string[];
}

const RX = {
  // an edit is asked for with a verb: naming the upload ("the clip", "this video") is not asking to edit it
  edit: /\b(edit|edits|editing|caption|captions|subtitle|subtitles|trim|cut (this|it|my|the|down|out)|clip (this|it)|turn (this|it) into|add (captions|subtitles|b-?roll)|make (this|it) (a |into a )?reel|punch[- ]?ins?|my (raw )?(footage|recording|podcast))\b/i,
  reference: /\b(like this|in this style|same style|this style|similar (to|style)|reference|inspired by|copy (the|this) (style|look)|recreate|in the style of|make (one|it|mine) like|look like this|same (pacing|feel|vibe|look|energy|rhythm|format)|(pacing|feel|look|vibe) (of|like|as) (this|the))\b/i,
  vertical: /\b(9\s*[:x/]\s*16|vertical|portrait|reels?|shorts|tiktok|story|stories)\b/i,
  landscape: /\b(16\s*[:x/]\s*9|landscape|horizontal|widescreen|youtube video|for youtube)\b/i,
  square: /\b(1\s*[:x/]\s*1|square)\b/i,
  url: /\bhttps?:\/\/[^\s)]+|\b(?:[a-z0-9-]+\.)+(?:com|io|ai|app|dev|co|in|org|net|so|xyz|me|tv|gg|ly|us|uk|de|fr|eu|store|shop|site|online|tech|studio|design|cafe|club|life|today|world|health|fit|money|finance|games|page|link|art|blog|news|cloud|email|work|example)\b(?:\/[^\s)]*)?/gi,
  hinglish: /\b(hai|hain|nahi|nahin|kya|aur|bhi|kaise|yaar|bas|toh|mera|meri|apna|apni|karo|chahiye|wala|wali|ke liye|matlab|ekdum|bilkul)\b/gi,
};

const WORD_NUM: Record<string, number> = { a: 1, one: 1, two: 2, three: 3, half: 0.5, ten: 10, fifteen: 15, twenty: 20, thirty: 30, forty: 40, 'forty-five': 45, fifty: 50, sixty: 60, ninety: 90 };

export function seconds(text: string): number | null {
  const t = text.toLowerCase();
  if (/\bhalf a minute\b/.test(t)) return 30;
  let m = t.match(/\b(\d+(?:\.\d+)?)\s*(?:-|to)?\s*(?:\d+\s*)?(s|sec|secs|second|seconds)\b/);
  if (m) return Number(m[1]);
  m = t.match(/\b(\d+(?:\.\d+)?)\s*(m|min|mins|minute|minutes)\b/);
  if (m) return Number(m[1]) * 60;
  m = t.match(/\b(a|one|two|three|half)\s+(minute|minutes)\b/);
  if (m) return (WORD_NUM[m[1]!] ?? 1) * 60;
  m = t.match(/\b(ten|fifteen|twenty|thirty|forty|forty-five|fifty|sixty|ninety)[- ](second|sec)s?\b/);
  if (m) return WORD_NUM[m[1]!] ?? null;
  return null;
}

/** Read a brief and its uploads with rules (no model). */
export function features(text: string, uploads: UploadProbe[], ratio?: 'auto' | '9:16' | '16:9' | '1:1' | '4:5'): Features {
  const words = text.toLowerCase().replace(/[^\p{L}\p{N}\s:-]/gu, ' ').split(/\s+/).filter(Boolean);
  const video = uploads.find(u => u.mime.startsWith('video/'));
  const audio = uploads.find(u => u.mime.startsWith('audio/'));
  const images = uploads.filter(u => u.mime.startsWith('image/')).map(u => u.id);

  let format: Features['format'] = ratio === '9:16' || ratio === '4:5' ? 'vertical' : ratio === '16:9' ? 'landscape' : ratio === '1:1' ? 'square' : null;
  if (!format) format = RX.vertical.test(text) ? 'vertical' : RX.landscape.test(text) ? 'landscape' : RX.square.test(text) ? 'square' : null;

  const language: Features['language'] = /[ऀ-ॿ]/.test(text) ? 'hindi' : (text.match(RX.hinglish)?.length ?? 0) >= 2 ? 'hinglish' : /[^\x00-\x7F‐-‧₹]/.test(text.replace(/[\u{1F300}-\u{1FAFF}]/gu, '')) && !/[a-z]{3}/i.test(text) ? 'other' : 'en';

  // footage: what is the uploaded video for?
  let footage: Footage = 'none';
  const why: string[] = [];
  if (video) {
    let edit = 0, ref = 0;
    if (RX.edit.test(text)) { edit += 2; why.push('the brief asks for an edit'); }
    if (RX.reference.test(text)) { ref += 2; why.push('the brief asks for "like this"'); }
    const sr = video.speechRate ?? 0, face = video.faceRatio ?? 0, cut = video.cutRate ?? 0;
    if (sr >= 1.2 && face >= 0.4 && cut < 0.35) { edit += 1.5; why.push(`a talking head (${sr.toFixed(1)} words/s, a face in ${Math.round(face * 100)}% of frames, ${cut.toFixed(2)} cuts/s)`); }
    if (cut >= 0.6) { ref += 1; why.push(`edited already (${cut.toFixed(2)} cuts/s)`); }
    if (video.hasAudio && sr < 0.8 && cut >= 0.3) { ref += 0.5; why.push('music-led, little speech'); }
    if ((video.duration ?? 0) > 90) { edit += 0.5; why.push(`long raw footage (${Math.round(video.duration!)} s)`); }
    if (!text.trim()) { edit += 0.5; why.push('a video with no brief'); }
    footage = edit - ref >= 1 ? 'edit' : ref - edit >= 1 ? 'reference' : 'unclear';
    if (!format && footage === 'edit' && video.width && video.height) format = video.height >= video.width ? 'vertical' : 'landscape';
  }

  const urls = [...new Set((text.match(RX.url) ?? []).map(u => u.replace(/[.,;:!?]+$/, '')))];
  const intents = [...new Set(SIGNATURES.flatMap(s => s.intents).filter(k => hasIntent(words, text, k)))];
  return { text, format, seconds: seconds(text) ?? (footage === 'edit' && video?.duration ? Math.round(video.duration) : null), language, footage, footageWhy: why, clip: video?.id ?? null, voiceover: audio?.id ?? null, images, urls, intents, words };
}

function hasIntent(words: string[], text: string, k: string) {
  if (k.includes(' ') || /\d/.test(k)) return text.toLowerCase().includes(k);
  return words.some(w => w === k || (k.length >= 4 && w.startsWith(k)));
}

export interface Match {
  style: string;
  score: number;
  nearest: string;
  autonomous: boolean;
  scores: { style: string; score: number; why: string[] }[];
  /** no style named an intent: ask a model to pick one from INTENTS, then match again */
  needsIntent: boolean;
  /** the upload is ambiguous: ask the user (footage to edit, or a style to copy?) */
  ask: 'footage-or-reference' | null;
  features: Features;
}

export const INTENTS = [...new Set(SIGNATURES.flatMap(s => s.intents))].sort();

export function scoreSig(sig: Signature, f: Features): { score: number; why: string[] } {
  const why: string[] = [];
  // footage is a hard constraint
  if (f.footage === 'edit' && sig.footage !== 'edit' && sig.footage !== 'any') return { score: 0, why: ['it does not edit footage'] };
  if (f.footage === 'reference' && sig.footage !== 'any') return { score: 0, why: ['a reference is learned into a new style'] };
  if (sig.footage === 'edit' && f.footage !== 'edit') return { score: 0, why: ['it needs footage to edit'] };
  let s = 0;
  if (f.format) { if (sig.formats.includes(f.format)) { s += 0.25; why.push(`format ${f.format}`); } else { s -= 0.3; why.push(`not ${f.format}`); } } else s += 0.15;
  if (f.seconds !== null) {
    if (f.seconds >= sig.min && f.seconds <= sig.max) { s += 0.15; why.push(`${f.seconds} s fits`); }
    else { const d = f.seconds < sig.min ? sig.min - f.seconds : f.seconds - sig.max; s += Math.max(-0.2, 0.15 - d / 20); why.push(`${f.seconds} s is outside ${sig.min}–${sig.max}`); }
  } else s += 0.1;
  if (sig.languages.includes('any') || sig.languages.includes(f.language)) { s += 0.15; why.push(`language ${f.language}`); } else { s -= 0.4; why.push(`not in ${f.language}`); }
  const hits = sig.intents.filter(k => f.intents.includes(k)), bad = sig.avoid.filter(k => hasIntent(f.words, f.text, k));
  s += Math.min(0.3, 0.1 * hits.length) - 0.2 * bad.length;
  if (hits.length) why.push(`asks for ${hits.join(', ')}`);
  if (bad.length) why.push(`but ${bad.join(', ')}`);
  return { score: +Math.max(0, s).toFixed(3), why };
}

export function match(f: Features): Match {
  const scores = KNOWN.map(sig => ({ style: sig.style, ...scoreSig(sig, f) })).sort((a, b) => b.score - a.score);
  const best = scores[0]!;
  const pick = KNOWN.filter(s => s.autonomous).map(s => ({ s, sc: scores.find(x => x.style === s.style)! })).find(({ s, sc }) => sc.score >= s.threshold);
  const needsIntent = f.footage !== 'edit' && f.footage !== 'reference' && !f.intents.length && !KNOWN.some(s => s.avoid.some(k => hasIntent(f.words, f.text, k)));
  return {
    style: pick ? pick.s.style : 'unique', score: pick ? pick.sc.score : best.score, nearest: best.style, autonomous: true, scores, needsIntent,
    ask: f.footage === 'unclear' ? 'footage-or-reference' : null, features: f,
  };
}
