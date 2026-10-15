/**
 * Small shared shapes for the Style 1 visual library (tokens, text, effects, transitions, camera, ui, scenes).
 * Plain data: every default lives in a constant next to the thing it tunes. Layer-shaped outputs use the same keys as
 * the MotionEasy `style1-timeline` layers (and @moovi/skills' LayerP), so they drop into a scene program.
 */

/** CSS cubic-bezier control points (x1, y1, x2, y2). */
export type Bezier = readonly [number, number, number, number];

export interface SpringCfg { damping: number; stiffness: number; mass: number }

/** One tweakable number/string/flag of an effect or component, with its default. */
export interface ParamDef<T = number | string | boolean | readonly number[]> {
  default: T;
  unit?: 'px' | 'frames' | 's' | 'deg' | 'x' | '%' | 'px/s' | 'cycles/s';
  min?: number;
  max?: number;
  note?: string;
}
export type Params = Record<string, ParamDef>;

/** Build a Params record from plain defaults (`p({ amp: [6, 'px'], on: true })`). */
export function params(d: Record<string, number | string | boolean | readonly number[] | readonly [number, ParamDef['unit']] | readonly [number, ParamDef['unit'], string]>): Params {
  const out: Params = {};
  for (const [k, v] of Object.entries(d)) {
    if (Array.isArray(v) && v.length >= 2 && typeof v[0] === 'number' && typeof v[1] === 'string') {
      out[k] = { default: v[0], unit: v[1] as ParamDef['unit'], ...(typeof v[2] === 'string' ? { note: v[2] } : {}) };
    } else out[k] = { default: v as ParamDef['default'] };
  }
  return out;
}

/** Defaults of a Params record as a plain object (what a factory spreads under the caller's overrides). */
export function defaults<P extends Params>(p: P): { [K in keyof P]: P[K]['default'] } {
  return Object.fromEntries(Object.entries(p).map(([k, v]) => [k, v.default])) as { [K in keyof P]: P[K]['default'] };
}

/** A sound reference: the kit's event name (what the mixer maps) and the sfx file id it lands on. */
export interface SfxRef {
  /** sfx file id (filename without extension), e.g. "woosh-tight". null = silent. */
  id: string | null;
  /** MotionEasy events.json event name (word, pop, card-in, scene, hard-hit …). */
  event: string;
  /** Frames the sound sits from the visual event it belongs to (negative = earlier). */
  offset?: number;
}
