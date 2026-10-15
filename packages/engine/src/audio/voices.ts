/**
 * The voice library: every Microsoft Edge online voice the crew may cast, tagged so a brief can be matched to one.
 * Tags are Moovi's own judgement of how each voice sounds (gender and locale are Microsoft's; age feel, energy and
 * the jobs it suits are ours), so the Voice Director can pick on words like "warm", "Indian", "hype" or "news".
 *
 * Every id here is checked against Microsoft's live voice list by `pnpm --filter @moovi/engine voices --check`.
 * The same ids work offline in tests: nothing here calls the network.
 */

export type Gender = 'female' | 'male';
/** how old the voice feels on screen (not the actor's age) */
export type AgeFeel = 'child' | 'young' | 'adult' | 'mature';
/** 1 = calm and low, 3 = friendly middle, 5 = bright and punchy */
export type Energy = 1 | 2 | 3 | 4 | 5;
/** what the voice does best */
export type Use = 'explainer' | 'promo' | 'news' | 'story' | 'conversation' | 'kids' | 'documentary' | 'tutorial';

export interface VoiceInfo {
  /** Microsoft's ShortName, e.g. en-IN-NeerjaNeural */
  id: string;
  /** the first name people know it by */
  name: string;
  locale: string;
  /** ISO language of the words it speaks best */
  lang: 'en' | 'hi' | 'ta' | 'te' | 'kn' | 'ml' | 'mr' | 'gu' | 'bn';
  /** how the English sounds (for English voices), or the language's region */
  accent: string;
  gender: Gender;
  age: AgeFeel;
  energy: Energy;
  /** a few words on its colour, for the picker's reason and the model's shortlist */
  tone: string[];
  use: Use[];
  /** can read other languages too (Hinglish lines, a French product name) without breaking */
  multilingual?: boolean;
}

const v = (id: string, accent: string, gender: Gender, age: AgeFeel, energy: Energy, tone: string[], use: Use[], multilingual = false): VoiceInfo => {
  const [lang, region] = id.split('-') as [VoiceInfo['lang'], string];
  const name = id.split('-')[2]!.replace(/(Multilingual|Expressive)?Neural$/, '');
  return { id, name, locale: `${lang}-${region}`, lang, accent, gender, age, energy, tone, use, ...(multilingual ? { multilingual } : {}) };
};

export const VOICES: VoiceInfo[] = [
  // ── American English ──
  v('en-US-AndrewMultilingualNeural', 'American', 'male', 'adult', 3, ['warm', 'confident', 'honest'], ['explainer', 'story', 'promo'], true),
  v('en-US-AndrewNeural', 'American', 'male', 'adult', 3, ['warm', 'confident'], ['explainer', 'conversation']),
  v('en-US-BrianMultilingualNeural', 'American', 'male', 'young', 3, ['casual', 'approachable', 'sincere'], ['conversation', 'tutorial', 'explainer'], true),
  v('en-US-BrianNeural', 'American', 'male', 'young', 3, ['casual', 'approachable'], ['conversation', 'tutorial']),
  v('en-US-ChristopherNeural', 'American', 'male', 'mature', 2, ['authoritative', 'reliable', 'deep'], ['news', 'documentary']),
  v('en-US-EricNeural', 'American', 'male', 'adult', 2, ['rational', 'even', 'clear'], ['news', 'tutorial']),
  v('en-US-GuyNeural', 'American', 'male', 'adult', 4, ['passionate', 'punchy'], ['promo', 'news']),
  v('en-US-RogerNeural', 'American', 'male', 'mature', 4, ['lively', 'big'], ['promo', 'story']),
  v('en-US-SteffanNeural', 'American', 'male', 'adult', 2, ['rational', 'calm', 'measured'], ['documentary', 'tutorial']),
  v('en-US-AvaMultilingualNeural', 'American', 'female', 'young', 4, ['expressive', 'caring', 'pleasant'], ['story', 'promo', 'conversation'], true),
  v('en-US-AvaNeural', 'American', 'female', 'young', 4, ['expressive', 'caring'], ['story', 'conversation']),
  v('en-US-EmmaMultilingualNeural', 'American', 'female', 'young', 4, ['cheerful', 'clear', 'conversational'], ['explainer', 'tutorial', 'promo'], true),
  v('en-US-EmmaNeural', 'American', 'female', 'young', 4, ['cheerful', 'clear'], ['explainer', 'conversation']),
  v('en-US-AriaNeural', 'American', 'female', 'adult', 3, ['confident', 'positive', 'crisp'], ['news', 'explainer', 'promo']),
  v('en-US-JennyNeural', 'American', 'female', 'adult', 2, ['friendly', 'considerate', 'soothing'], ['tutorial', 'conversation', 'documentary']),
  v('en-US-MichelleNeural', 'American', 'female', 'adult', 3, ['friendly', 'pleasant'], ['news', 'explainer']),
  v('en-US-AnaNeural', 'American', 'female', 'child', 5, ['cute', 'playful', 'childlike'], ['kids']),
  // ── British, Irish ──
  v('en-GB-RyanNeural', 'British', 'male', 'adult', 3, ['polished', 'friendly', 'dry'], ['documentary', 'explainer', 'story']),
  v('en-GB-ThomasNeural', 'British', 'male', 'mature', 2, ['calm', 'refined', 'grounded'], ['documentary', 'story', 'news']),
  v('en-GB-SoniaNeural', 'British', 'female', 'adult', 3, ['polished', 'clear', 'premium'], ['explainer', 'news', 'promo']),
  v('en-GB-LibbyNeural', 'British', 'female', 'young', 4, ['bright', 'friendly'], ['promo', 'conversation', 'explainer']),
  v('en-GB-MaisieNeural', 'British', 'female', 'child', 4, ['young', 'curious', 'sweet'], ['kids', 'story']),
  v('en-IE-ConnorNeural', 'Irish', 'male', 'adult', 3, ['warm', 'lilting', 'storyteller'], ['story', 'conversation']),
  v('en-IE-EmilyNeural', 'Irish', 'female', 'adult', 3, ['warm', 'gentle', 'lilting'], ['story', 'conversation']),
  // ── Indian English and Hindi ──
  v('en-IN-PrabhatNeural', 'Indian', 'male', 'adult', 3, ['clear', 'friendly', 'desi'], ['explainer', 'promo', 'tutorial']),
  v('en-IN-NeerjaNeural', 'Indian', 'female', 'adult', 3, ['clear', 'friendly', 'desi'], ['explainer', 'tutorial', 'news']),
  v('en-IN-NeerjaExpressiveNeural', 'Indian', 'female', 'young', 4, ['expressive', 'lively', 'desi'], ['promo', 'story', 'conversation']),
  v('hi-IN-MadhurNeural', 'Hindi (India)', 'male', 'adult', 3, ['warm', 'friendly'], ['explainer', 'promo', 'story']),
  v('hi-IN-SwaraNeural', 'Hindi (India)', 'female', 'adult', 3, ['clear', 'friendly'], ['explainer', 'news', 'story']),
  // ── the rest of the English-speaking world ──
  v('en-AU-WilliamMultilingualNeural', 'Australian', 'male', 'adult', 3, ['laid-back', 'friendly'], ['conversation', 'explainer', 'promo'], true),
  v('en-AU-NatashaNeural', 'Australian', 'female', 'adult', 4, ['bright', 'upbeat'], ['promo', 'explainer']),
  v('en-CA-LiamNeural', 'Canadian', 'male', 'young', 3, ['easy', 'friendly'], ['conversation', 'tutorial']),
  v('en-CA-ClaraNeural', 'Canadian', 'female', 'adult', 3, ['warm', 'clear'], ['explainer', 'tutorial']),
  v('en-NZ-MitchellNeural', 'New Zealand', 'male', 'adult', 3, ['relaxed', 'friendly'], ['conversation', 'story']),
  v('en-NZ-MollyNeural', 'New Zealand', 'female', 'young', 4, ['bright', 'friendly'], ['promo', 'conversation']),
  v('en-ZA-LukeNeural', 'South African', 'male', 'adult', 3, ['grounded', 'warm'], ['documentary', 'story']),
  v('en-ZA-LeahNeural', 'South African', 'female', 'adult', 3, ['warm', 'clear'], ['explainer', 'story']),
  v('en-NG-AbeoNeural', 'Nigerian', 'male', 'adult', 3, ['rich', 'warm'], ['story', 'promo']),
  v('en-NG-EzinneNeural', 'Nigerian', 'female', 'adult', 3, ['warm', 'clear'], ['explainer', 'story']),
  v('en-KE-ChilembaNeural', 'Kenyan', 'male', 'adult', 3, ['steady', 'warm'], ['documentary', 'story']),
  v('en-KE-AsiliaNeural', 'Kenyan', 'female', 'adult', 3, ['soft', 'clear'], ['explainer', 'story']),
  v('en-TZ-ElimuNeural', 'Tanzanian', 'male', 'adult', 3, ['calm', 'steady'], ['documentary', 'story']),
  v('en-TZ-ImaniNeural', 'Tanzanian', 'female', 'adult', 3, ['gentle', 'warm'], ['story', 'explainer']),
  v('en-SG-WayneNeural', 'Singaporean', 'male', 'adult', 3, ['neat', 'friendly'], ['explainer', 'tutorial']),
  v('en-SG-LunaNeural', 'Singaporean', 'female', 'young', 3, ['neat', 'friendly'], ['explainer', 'conversation']),
  v('en-PH-JamesNeural', 'Filipino', 'male', 'young', 3, ['friendly', 'easy'], ['conversation', 'promo']),
  v('en-PH-RosaNeural', 'Filipino', 'female', 'young', 4, ['bright', 'friendly'], ['promo', 'conversation']),
  v('en-HK-SamNeural', 'Hong Kong', 'male', 'adult', 3, ['crisp', 'even'], ['news', 'explainer']),
  v('en-HK-YanNeural', 'Hong Kong', 'female', 'adult', 3, ['crisp', 'friendly'], ['news', 'explainer']),
  // ── Indian languages ──
  v('ta-IN-ValluvarNeural', 'Tamil (India)', 'male', 'adult', 3, ['warm'], ['explainer', 'story']),
  v('ta-IN-PallaviNeural', 'Tamil (India)', 'female', 'adult', 3, ['clear'], ['explainer', 'story']),
  v('te-IN-MohanNeural', 'Telugu (India)', 'male', 'adult', 3, ['warm'], ['explainer', 'story']),
  v('te-IN-ShrutiNeural', 'Telugu (India)', 'female', 'adult', 3, ['clear'], ['explainer', 'story']),
  v('kn-IN-GaganNeural', 'Kannada (India)', 'male', 'adult', 3, ['warm'], ['explainer', 'story']),
  v('kn-IN-SapnaNeural', 'Kannada (India)', 'female', 'adult', 3, ['clear'], ['explainer', 'story']),
  v('ml-IN-MidhunNeural', 'Malayalam (India)', 'male', 'adult', 3, ['warm'], ['explainer', 'story']),
  v('ml-IN-SobhanaNeural', 'Malayalam (India)', 'female', 'adult', 3, ['clear'], ['explainer', 'story']),
  v('mr-IN-ManoharNeural', 'Marathi (India)', 'male', 'adult', 3, ['warm'], ['explainer', 'story']),
  v('mr-IN-AarohiNeural', 'Marathi (India)', 'female', 'adult', 3, ['clear'], ['explainer', 'story']),
  v('gu-IN-NiranjanNeural', 'Gujarati (India)', 'male', 'adult', 3, ['warm'], ['explainer', 'story']),
  v('gu-IN-DhwaniNeural', 'Gujarati (India)', 'female', 'adult', 3, ['clear'], ['explainer', 'story']),
  v('bn-IN-BashkarNeural', 'Bengali (India)', 'male', 'adult', 3, ['warm'], ['explainer', 'story']),
  v('bn-IN-TanishaaNeural', 'Bengali (India)', 'female', 'adult', 3, ['clear'], ['explainer', 'story']),
];

/** the voice a plain English brief gets when nothing in it asks for another (the engine's voice before the library) */
export const DEFAULT_VOICE = 'en-US-AndrewMultilingualNeural';

const BY_ID = new Map(VOICES.map(x => [x.id.toLowerCase(), x]));
export const voiceById = (id: string) => BY_ID.get(id.toLowerCase()) ?? null;

/** one line per voice, for a model's shortlist and the CLI */
export const describeVoice = (x: VoiceInfo) =>
  `${x.id}: ${x.name}, ${x.accent}${x.lang === 'en' ? ' English' : ''}, ${x.gender}, ${x.age} feel, energy ${x.energy}/5, ${x.tone.join(', ')}; good for ${x.use.join(', ')}${x.multilingual ? '; multilingual' : ''}`;
