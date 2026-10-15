import { z } from 'zod';
import { FONTS } from '../timeline';
import { GOLD, mix, type Stage } from '../style-1/kit/stage';

/**
 * The style card: when no known style fits a brief, the Art Director designs a new one and writes it here. It is
 * the whole look in one place, and it drives the same kit and renderer as Style 1 (stage, type, motion, camera,
 * sound). A reference video's measurements, the user's own look and the nearest known style feed it.
 */
const Hex = z.string().regex(/^#[0-9a-fA-F]{6}$/, 'a #rrggbb colour');

export const StyleCard = z.object({
  name: z.string().min(2).max(40).describe('a name for this style (not "Style 1")'),
  idea: z.string().min(10).max(240).describe('the one-sentence idea of the look and why it fits this video'),
  format: z.enum(['vertical', 'landscape']),
  world: z.enum(['light', 'dark', 'two-worlds']).describe('two-worlds alternates light and dark scenes to signal topic changes'),
  palette: z.object({
    paper: Hex.describe('the stage colour'), ink: Hex.describe('the type colour (strong contrast with paper)'),
    accent: Hex.describe('the one accent'), accentDeep: Hex.describe('a deep accent that carries light text'),
    glows: z.array(z.object({ x: z.number().min(0).max(1), y: z.number().min(0).max(1), r: z.number().min(200).max(1400), color: Hex, alpha: z.number().min(0).max(1) })).max(4)
      .describe('soft colour blooms on the stage (x, y as fractions of the frame); dark worlds get exactly one'),
    grid: z.boolean().describe('a faint dot grid fading to the edges'),
    grain: z.number().min(0).max(0.12),
  }).strict(),
  type: z.object({
    font: z.enum(FONTS).describe('the display + body family'),
    weight: z.number().int().min(400).max(900),
    accentFont: z.enum(FONTS).describe('the hero-word accent face (a serif italic reads premium: instrument / fraunces)'),
    accentGradient: z.tuple([Hex, Hex, Hex]).nullable().describe('a 3-stop gradient for the accent line, or null for the solid accent'),
    upper: z.boolean().describe('headline lines in capitals'),
    motion: z.enum(['rise', 'elastic', 'slam', 'slide']).describe('how words enter'),
    tracking: z.number().min(-0.06).max(0.1),
  }).strict(),
  camera: z.enum(['push', 'drift', 'dive', 'one-take']).describe('push = slow push per scene; drift = lateral drift; dive = scale dives on hero words; one-take = continuous pans between areas of one big canvas'),
  transitions: z.array(z.enum(['up', 'down', 'left', 'right', 'none'])).min(1).max(4).describe('scene entries, cycled (never the same 3 times running)'),
  signatureMove: z.string().min(5).max(160).describe('the one move this video is remembered for'),
  sound: z.object({ bedMood: z.enum(['soft', 'uplifting', 'groove', 'driving']), bpm: z.number().min(70).max(180), typing: z.boolean(), density: z.enum(['sparse', 'dense']) }).strict(),
  footage: z.object({
    mode: z.enum(['none', 'full', 'framed']).describe('full = the clip fills the frame; framed = it plays inside a phone/card'),
    captions: z.enum(['chest', 'bottom', 'none']).describe('word captions on the clip (chest = 62–70% of the height)'),
    punch: z.number().min(0).max(0.15).describe('punch-in scale step (0.05–0.08 every phrase or two)'),
    insertEvery: z.number().min(0).max(12).describe('seconds between full-screen motion inserts (0 = none)'),
  }).strict(),
  nearest: z.string().nullable().describe('the known style this card borrows from (s1 … e1), or null'),
}).strict();
export type StyleCard = z.infer<typeof StyleCard>;

/** The stage the kit draws for a style card. */
export function stageFromCard(card: StyleCard, extra: Partial<Stage> = {}): Stage {
  const { W, H } = card.format === 'vertical' ? { W: 1080, H: 1920 } : { W: 1920, H: 1080 };
  const p = card.palette;
  // glow coordinates are stored as 1080×1920 reference pixels (the kit scales them to the format)
  const glows = p.glows.map(g => [g.x * 1080, g.y * 1920, g.r, g.color, g.alpha] as [number, number, number, string, number]);
  void W; void H;
  return {
    ink: p.ink, accent: p.accent, accentDeep: p.accentDeep, stage: p.paper, font: card.type.font,
    serif: { font: card.type.accentFont, gradient: card.type.accentGradient ?? [p.accent, p.accent, p.accent] },
    glows, grid: p.grid ? { step: 90, color: mix(p.ink, p.paper, 0.75), dot: 2.3, line: 'rgba(120,120,120,0.05)' } : null,
    burst: mix(p.accent, p.paper, 0.6), grain: p.grain, vignette: card.world === 'dark' ? 0.18 : 0.08, corners: [], ...extra,
  };
}

/** A sensible card when the Art Director can't produce one (the deterministic fallback: the run still ships). */
export function fallbackCard(format: 'vertical' | 'landscape', footage: boolean): StyleCard {
  return {
    name: 'Ice Editorial', idea: 'A calm editorial look: icy paper, ink type, one deep-blue accent and a serif hero word, so the message carries itself.',
    format, world: 'light',
    palette: { paper: '#F7FAFD', ink: '#0E1A2B', accent: '#2B67C6', accentDeep: '#0E1A2B', glows: [{ x: 0.15, y: 0.15, r: 820, color: '#CFE6F7', alpha: 0.6 }, { x: 0.9, y: 0.55, r: 760, color: '#E3DEFF', alpha: 0.45 }, { x: 0.2, y: 0.92, r: 700, color: '#D2F5EC', alpha: 0.45 }], grid: true, grain: 0.04 },
    type: { font: 'jakarta', weight: 800, accentFont: 'instrument', accentGradient: GOLD, upper: false, motion: 'rise', tracking: -0.025 },
    camera: 'push', transitions: ['up', 'left', 'up', 'right'], signatureMove: 'Each scene’s hero word slams in the accent while the camera dives toward it.',
    sound: { bedMood: 'uplifting', bpm: 120, typing: true, density: 'dense' },
    footage: footage ? { mode: 'full', captions: 'chest', punch: 0.06, insertEvery: 4 } : { mode: 'none', captions: 'none', punch: 0, insertEvery: 0 },
    nearest: footage ? 'e1' : 's1',
  };
}
