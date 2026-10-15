import { DEFAULT_VOICE, VOICES, describeVoice, voiceById, type AgeFeel, type Gender, type Use, type VoiceInfo } from './voices';

/**
 * The Voice Director's ear, in plain code: what a brief asks of a voice (language, accent, gender, age feel,
 * energy, the job) read from its words, then every voice in the library scored against that. The film's own graph
 * adds memory: a voice this project already uses is kept (a brand keeps its voice) unless the brief asks for a new
 * one, and a voice the user turned down is never cast again in that chat. The top few go to a model to choose from
 * (src/tasks/casting.ts); this ranking is also the answer whenever no model is there.
 */

export interface VoiceWish {
  lang: VoiceInfo['lang'];
  /** an accent named in the brief ("Indian", "British"…) */
  accent: string | null;
  gender: Gender | null;
  age: AgeFeel | null;
  /** 1..5, or null when the brief says nothing about pace or feeling */
  energy: number | null;
  use: Use | null;
  /** a voice named outright ("use Neerja", "voice: en-GB-RyanNeural") */
  named: string | null;
  /** the brief asks for a different voice than last time */
  fresh: boolean;
  /** why each part was read that way, for the reason line */
  heard: string[];
}

export interface VoiceMemory { voice: string; chat?: string | null; rejected?: boolean | null; at?: number | null }

export interface Ranked { voice: VoiceInfo; score: number; why: string[] }

const has = (text: string, rx: RegExp) => rx.test(text);

const SCRIPTS: [RegExp, VoiceInfo['lang'], string][] = [
  [/[\u0B80-\u0BFF]/, 'ta', 'Tamil script'], [/[\u0C00-\u0C7F]/, 'te', 'Telugu script'], [/[\u0C80-\u0CFF]/, 'kn', 'Kannada script'],
  [/[\u0D00-\u0D7F]/, 'ml', 'Malayalam script'], [/[\u0A80-\u0AFF]/, 'gu', 'Gujarati script'], [/[\u0980-\u09FF]/, 'bn', 'Bengali script'],
];
const LANG_WORDS: [RegExp, VoiceInfo['lang']][] = [
  [/\bin tamil\b|\btamil (voice|narration|video)\b/i, 'ta'], [/\bin telugu\b|\btelugu (voice|narration|video)\b/i, 'te'],
  [/\bin kannada\b|\bkannada (voice|narration|video)\b/i, 'kn'], [/\bin malayalam\b|\bmalayalam (voice|narration|video)\b/i, 'ml'],
  [/\bin marathi\b|\bmarathi (voice|narration|video)\b/i, 'mr'], [/\bin gujarati\b|\bgujarati (voice|narration|video)\b/i, 'gu'],
  [/\bin bengali\b|\bin bangla\b|\bbengali (voice|narration|video)\b/i, 'bn'], [/\bin hindi\b|\bhindi (voice|narration|video|voiceover)\b/i, 'hi'],
];
const ACCENTS: [RegExp, string][] = [
  [/\b(indian|desi|hinglish|india|bharat|bangalore|bengaluru|mumbai|delhi)\b/i, 'Indian'],
  [/\b(british|uk|english accent|london|posh|bbc)\b/i, 'British'],
  [/\b(australian|aussie|sydney|melbourne)\b/i, 'Australian'],
  [/\b(irish|ireland|dublin)\b/i, 'Irish'],
  [/\b(canadian|canada|toronto)\b/i, 'Canadian'],
  [/\b(new zealand|kiwi|auckland)\b/i, 'New Zealand'],
  [/\b(south african|johannesburg|cape town)\b/i, 'South African'],
  [/\b(nigerian|nigeria|lagos)\b/i, 'Nigerian'],
  [/\b(kenyan|kenya|nairobi)\b/i, 'Kenyan'],
  [/\b(tanzanian|tanzania)\b/i, 'Tanzanian'],
  [/\b(singapore|singaporean)\b/i, 'Singaporean'],
  [/\b(filipino|philippines|manila)\b/i, 'Filipino'],
  [/\b(hong kong)\b/i, 'Hong Kong'],
  [/\b(american|us accent|usa)\b/i, 'American'],
];
const ENERGY: [RegExp, number, string][] = [
  [/\b(hype|hyped|energetic|high energy|exciting|explosive|punchy|loud|bold|fast[- ]paced|sale|drop|gaming|sports|launch)\b/i, 5, 'high energy'],
  [/\b(promo|ad|advert|advertisement|announce|announcement|upbeat|fun|viral|reel|tiktok)\b/i, 4, 'upbeat'],
  [/\b(calm|soothing|soft|gentle|meditation|sleep|relax|relaxing|slow|serious|sad|tribute|memorial|mindful)\b/i, 1, 'calm'],
  [/\b(documentary|history|essay|story|storytelling|deep dive|thoughtful|news|report)\b/i, 2, 'measured'],
];
const USES: [RegExp, Use][] = [
  [/\b(kids|children|child|cartoon|nursery|toddler)\b/i, 'kids'],
  [/\b(news|headline|breaking|report|finance|market|stocks|earnings)\b/i, 'news'],
  [/\b(documentary|history|nature|wildlife|space)\b/i, 'documentary'],
  [/\b(story|tale|storytelling|once upon)\b/i, 'story'],
  [/\b(tutorial|how to|how-to|step by step|guide|walkthrough)\b/i, 'tutorial'],
  [/\b(promo|ad|advert|launch|sale|offer|product)\b/i, 'promo'],
  [/\b(podcast|chat|casual|conversation|vlog)\b/i, 'conversation'],
  [/\b(explain|explainer|why|what is|how does)\b/i, 'explainer'],
];
const MOOD_ENERGY: Record<string, number> = { soft: 2, uplifting: 3, groove: 4, driving: 5 };

/** What the brief (and the script, and the plan's mood) asks of the voice. */
export function readWish(o: { brief: string; script?: string; language?: string | null; mood?: string | null }): VoiceWish {
  const t = `${o.brief}`.replace(/\s+/g, ' ');
  const all = `${t} ${o.script ?? ''}`;
  const heard: string[] = [];
  let lang: VoiceInfo['lang'] = 'en';
  if (/[\u0900-\u097F]/.test(all) || o.language === 'hindi') { lang = 'hi'; heard.push('the words are Hindi'); }
  for (const [rx, l, why] of SCRIPTS) if (rx.test(all)) { lang = l; heard.push(`the words are in ${why}`); break; }
  for (const [rx, l] of LANG_WORDS) if (rx.test(t)) { lang = l; heard.push(`the brief asks for ${l === 'hi' ? 'Hindi' : VOICES.find(x => x.lang === l)!.accent.split(' ')[0]}`); break; }

  let accent: string | null = null;
  for (const [rx, a] of ACCENTS) if (rx.test(t)) { accent = a; heard.push(`${a} accent asked for`); break; }
  if (!accent && o.language === 'hinglish') { accent = 'Indian'; heard.push('Hinglish lines want an Indian voice'); }

  let gender: Gender | null = null;
  if (has(t, /\b(female|woman|women's voice|girl|lady|her voice|she narrates|feminine)\b/i)) gender = 'female';
  else if (has(t, /\b(male|man's voice|guy|his voice|he narrates|masculine|deep voice)\b/i)) gender = 'male';
  if (gender) heard.push(`a ${gender} voice asked for`);

  let age: AgeFeel | null = null;
  if (has(t, /\b(kids|children|child|cartoon|nursery|toddler)\b/i)) age = 'child';
  else if (has(t, /\b(gen ?z|teen|teens|young|students?|college|youthful|youth)\b/i)) age = 'young';
  else if (has(t, /\b(senior|elderly|retire|retirement|mature|wise|grandfather|grandmother|luxury|premium|corporate|executive|ceo)\b/i)) age = 'mature';
  if (age) heard.push(`${age} feel`);

  let energy: number | null = null;
  for (const [rx, e, why] of ENERGY) if (rx.test(t)) { energy = e; heard.push(why); break; }
  if (energy === null && o.mood && MOOD_ENERGY[o.mood]) { energy = MOOD_ENERGY[o.mood]!; heard.push(`the plan's ${o.mood} mood`); }

  let use: Use | null = null;
  for (const [rx, u] of USES) if (rx.test(t)) { use = u; break; }

  const named = (() => {
    const full = /\b([a-z]{2}-[A-Z]{2}-[A-Za-z]+Neural)\b/.exec(t)?.[1];
    if (full && voiceById(full)) return voiceById(full)!.id;
    const m = /\b(?:voice(?:d)?(?: by| of|:)?|use|narrated by|with)\s+([A-Za-z]+)\b/i.exec(t)?.[1];
    if (m && /^[A-Z]/.test(m)) { const hit = VOICES.filter(x => x.name.toLowerCase() === m.toLowerCase()); if (hit.length) return (hit.find(x => x.multilingual) ?? hit[0]!).id; }
    return null;
  })();
  if (named) heard.push(`the brief names ${voiceById(named)!.name}`);
  const fresh = has(t, /\b(different|new|another|change the|other) voice\b|\bnot the same voice\b/i);
  if (fresh) heard.push('a new voice asked for');
  return { lang, accent, gender, age, energy, use, named, fresh, heard };
}

/** Every voice of the library scored for the wish (and the project's memory), best first. */
export function rankVoices(w: VoiceWish, memory: VoiceMemory[] = [], chat: string | null = null): Ranked[] {
  const rejected = new Set(memory.filter(m => m.rejected && (!chat || !m.chat || m.chat === chat)).map(m => m.voice));
  const kept = memory.find(m => !m.rejected)?.voice ?? null; // newest first
  const out: Ranked[] = [];
  for (const x of VOICES) {
    const why: string[] = [];
    let s = 0;
    if (x.lang !== w.lang && !(w.lang === 'hi' && x.accent === 'Indian')) continue;
    if (x.lang === w.lang) s += 10; else { s += 4; why.push('Indian English stands in for Hindi'); }
    if (w.named === x.id) { s += 40; why.push('named in the brief'); }
    if (rejected.has(x.id)) { s -= 30; why.push('you turned it down before'); }
    if (w.accent) { if (x.accent === w.accent) { s += 6; why.push(`${x.accent} accent`); } else s -= 2; }
    else if (w.lang === 'en' && x.accent !== 'American' && x.accent !== 'British') s -= 1.5; // a plain brief gets a widely heard accent
    if (w.gender) { if (x.gender === w.gender) { s += 4; why.push(x.gender); } else s -= 4; }
    if (w.age) { if (x.age === w.age) { s += 3; why.push(`${x.age} feel`); } else if (w.age === 'child' || x.age === 'child') s -= 4; else s -= 0.5; }
    else if (x.age === 'child') s -= 5;
    if (w.energy !== null) { const d = Math.abs(x.energy - w.energy); s += 2.5 - d * 1.25; if (d === 0) why.push(`energy ${x.energy}/5`); }
    if (w.use && x.use.includes(w.use)) { s += 2; why.push(`suits ${w.use}`); }
    if (x.multilingual) s += 0.4;
    if (x.id === DEFAULT_VOICE) s += 0.5;
    if (kept && x.id === kept && !w.fresh) { s += 3; why.push('the voice this project already uses'); }
    if (kept && x.id === kept && w.fresh) s -= 6;
    out.push({ voice: x, score: +s.toFixed(2), why });
  }
  return out.sort((a, b) => b.score - a.score || a.voice.id.localeCompare(b.voice.id));
}

/** The pace the voice is spoken at: a hype brief runs quicker, a calm one slower (Edge's prosody rate). */
export function rateFor(w: VoiceWish, x: VoiceInfo): string {
  const e = w.energy ?? 3;
  let pct = e >= 5 ? 14 : e === 4 ? 12 : e === 3 ? 10 : e === 2 ? 5 : 0;
  if (x.lang !== 'en') pct = Math.min(pct, 6);
  if (x.age === 'child') pct = Math.min(pct, 4);
  return `${pct >= 0 ? '+' : ''}${pct}%`;
}

/**
 * Edge's neural voices speak about 2.0 words a second at +0% (measured on this library: 75 words took 39.3 s at +0%,
 * 98 words took 44.5 s at +10%).
 */
export const EDGE_WORDS_PER_SECOND = 2.0;

/**
 * The rate that lands the script inside the length the brief asked for: the voice's own pace (rateFor) unless the
 * script needs faster, capped at +35% because Edge voices sound rushed beyond it. Without a target length the
 * voice's own pace stands.
 */
export function fitRate(rate: string, words: number, seconds: number | undefined, maxPct = 35): string {
  const own = Number(/^([+-]?\d+)%$/.exec(rate)?.[1] ?? 0);
  if (!seconds || seconds <= 0 || words <= 0) return rate;
  const need = Math.ceil((words / (seconds * EDGE_WORDS_PER_SECOND) - 1) * 100);
  const pct = Math.min(Math.max(own, maxPct), Math.max(own, need));
  return `${pct >= 0 ? '+' : ''}${pct}%`;
}

/** One plain sentence on why this voice, from what was heard and what matched. */
export function reasonFor(w: VoiceWish, r: Ranked): string {
  const x = r.voice;
  const heard = w.heard.length ? `The brief: ${w.heard.join(', ')}.` : 'The brief asks nothing special of the voice.';
  const matched = r.why.length ? ` ${x.name} matches on ${r.why.join(', ')}.` : ` ${x.name} is the house voice for a plain brief.`;
  return `${heard}${matched} ${x.name} is ${x.accent}${x.lang === 'en' ? ' English' : ''}, ${x.gender}, ${x.tone.join(' and ')}.`;
}

export { describeVoice };
