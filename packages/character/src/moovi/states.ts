/**
 * Moovi's states. The same names drive the landing page (scroll/hover) and the studio (crew events),
 * see docs/ARCHITECTURE.md. Each state is a set of targets for a few blend weights; the renderer
 * eases toward them, so any state can follow any other.
 */
export const MOOVI_STATES = [
  'idle',      // breathing bounce, resting "hi" arm
  'greet',     // waves
  'listen',    // leans in, eyes wide
  'think',     // halo spins and bridges to his head
  'direct',    // reaches out to point at a crew member
  'frame',     // director's frame in front of his eyes
  'review',    // squints, leans in
  'celebrate', // both arms up, big bounces
  'play',      // morphs into a play button
] as const;

export type MooviState = (typeof MOOVI_STATES)[number];

export interface Blend {
  wave: number; frame: number; think: number; morph: number;
  direct: number; celebrate: number; squint: number; lean: number;
}

export const ZERO: Blend = { wave: 0, frame: 0, think: 0, morph: 0, direct: 0, celebrate: 0, squint: 0, lean: 0 };

export const STATE_BLEND: Record<MooviState, Partial<Blend>> = {
  idle: {},
  greet: { wave: 1 },
  listen: { lean: 1 },
  think: { think: 1 },
  direct: { direct: 1 },
  frame: { frame: 1 },
  review: { squint: 1, lean: .6 },
  celebrate: { celebrate: 1 },
  play: { morph: 1 },
};
