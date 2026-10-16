import { buildCaptions, describeLook, listLooks, type LookRef, type LookSummary } from 'captionseasy';
import { CAPTION_STYLES } from './captions';

/**
 * Caption looks from captionseasy (Ishaan's package, MIT, zero runtime deps): 99 numbered designed looks. The builder
 * picks one per edit and stores its number, id and validated props (`buildCaptions`: the full style and the pacing
 * settings) in the EDL's `caption_look` block, so a renderer that draws captionseasy looks (its Remotion components, or
 * a future plain-web draw path) has everything it needs. The preview player does not draw captionseasy looks (they
 * are Remotion components), so each look is also mapped onto the nearest of the player's 11 styles
 * (`player_style`), which is what `caption_style_id` carries. No Remotion is imported here.
 */

/** The look each edit style starts from (its number is permanent); 'base' is the default edit. */
export const STYLE_LOOKS: Record<string, number> = {
  base: 12, // hormozi_box, caps with a jumping box on the spoken word: the closest to the player's default punch-duo
  atlas: 16, // explainer: readable, underline
  'night-desk': 74, // italic serif, glow on the spoken word
  handmade: 28, // sand word tiles
  'crimson-cutout': 22, // cream strips, red word
  'brand-promo': 31, // fat bar pop, caps
  'studio-minimal': 70, // plain lowercase
};

/** The player style nearest a look, by its layout and tags (the player has 11: captions.ts). */
export function playerStyleFor(l: Pick<LookSummary, 'layout' | 'tags' | 'wordsPerCard'>): string {
  const lay = l.layout.toLowerCase(), tags = l.tags.join(' ').toLowerCase();
  const pick = (id: string) => CAPTION_STYLES.some(s => s.id === id) ? id : 'punch-duo';
  if (/karaoke/.test(lay) || /dim until spoken/.test(tags)) return pick('kara-block');
  if (/highlighter|select-highlight/.test(lay) || /marker|highlight\b/.test(tags) && !/box highlight/.test(tags)) return pick('kara-sweep');
  if (/typewriter|smooth-fusion/.test(lay) || /mono|typewriter/.test(tags)) return pick('kin-type');
  if (/glitch|rgb|gamer|tech|chrome/.test(lay) || /glitch|rgb split/.test(tags)) return pick('tech-chip');
  if (/bubble|notification|label|boxed|plate|tiles|strips|bar$/.test(lay) || /\bbox\b|labels|word plates|tiles|strips/.test(tags) && !/box highlight/.test(tags)) return pick('box-label');
  if (/^word$|slam|punch|impact|fat-bar|stamp/.test(lay) || l.wordsPerCard === 1) return pick('punch-slam');
  if (/plain-line|solo|clean|explainer/.test(lay) || /minimal|readable|lowercase/.test(tags)) return pick('clean-keyword');
  if (/serif|script|story|glow|stack3|creator|master|discipline|light-bold|track-in|light-slit/.test(lay) || /serif|script|italic/.test(tags)) return pick('ed-mixed');
  if (/sentence|focus-box/.test(lay) || /box highlight|caps/.test(tags)) return pick('punch-duo');
  return 'punch-duo';
}

export interface CaptionLook {
  number: number; id: string; name: string; player_style: string;
  /** the full CaptionStyle and ProjectSettings captionseasy validated for these words */
  style: Record<string, unknown>; settings: Record<string, unknown>;
  overrides?: Record<string, unknown>; warnings?: string[]; rule_id: string;
}

/**
 * Pick and validate a look for an edit: `look` (a number or id) when given, else the style's own, else base. Words
 * are output-time seconds (what is shown); captionseasy wants milliseconds. Throws on an unknown look.
 */
export function pickLook(words: { text: string; t0: number; t1: number }[], o: { style?: string; look?: LookRef; overrides?: Record<string, unknown>; language?: string } = {}): CaptionLook {
  const ref: LookRef = o.look ?? STYLE_LOOKS[o.style ?? 'base'] ?? STYLE_LOOKS.base!;
  const d = describeLook(ref);
  const ws = words.filter(w => w.text.trim()).map(w => ({ text: w.text, startMs: Math.round(w.t0 * 1000), endMs: Math.max(Math.round(w.t0 * 1000) + 1, Math.round(w.t1 * 1000)) }));
  const props = buildCaptions({ words: ws.length ? ws : [{ text: ' ', startMs: 0, endMs: 1 }], look: ref, ...(o.overrides ? { overrides: o.overrides } : {}), ...(o.language ? { language: o.language } : {}) });
  return {
    number: props.look.number, id: props.look.id, name: props.look.name, player_style: playerStyleFor(d),
    style: props.style, settings: props.settings, ...(o.overrides ? { overrides: o.overrides } : {}),
    ...(props.warnings.length ? { warnings: props.warnings } : {}),
    rule_id: o.look !== undefined ? 'look.requested' : `look.style.${o.style ?? 'base'}`,
  };
}

/** Every look with the player style it maps to (for the style picker and the docs). */
export const lookMap = () => listLooks().map(l => ({ number: l.number, id: l.id, layout: l.layout, player_style: playerStyleFor(l) }));
