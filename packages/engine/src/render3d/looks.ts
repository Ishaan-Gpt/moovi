import { color } from '@moovi/brand';

/**
 * The five 3D looks the art director can give a scene. The drawing code lives in page/looks.js (it runs in the
 * headless Chrome page); this file is what the rest of the engine knows about them: ids, what each is for, and how
 * to choose when the model gave no choice.
 */
export const LOOK_IDS = ['particles', 'turntable', 'tower', 'city', 'orbit'] as const;
export type LookId = (typeof LOOK_IDS)[number];

export interface LookInfo { id: LookId; name: string; about: string; /** what the scene must have for it to make sense */ needs: 'nothing' | 'screenshot' | 'numbers' | 'logo' }

export const LOOKS: readonly LookInfo[] = [
  { id: 'particles', name: 'Particle field', about: 'a slow swirl of thousands of points: ideas, data, community, anything abstract or atmospheric', needs: 'nothing' },
  { id: 'turntable', name: 'Product turntable', about: 'the product (the site screenshot) on a slab that turns on a stand: show a real interface or page', needs: 'screenshot' },
  { id: 'tower', name: 'Data tower chart', about: 'bars that rise out of a grid: growth, comparisons, any claim with real numbers', needs: 'numbers' },
  { id: 'city', name: 'Wireframe city', about: 'a flight over glowing wire buildings: scale, infrastructure, platforms, cities, networks', needs: 'nothing' },
  { id: 'orbit', name: 'Logo orbit', about: 'the camera circles the brand mark with rings and dust: intros, outros, the call to action', needs: 'logo' },
] as const;

export const isLook = (s: unknown): s is LookId => typeof s === 'string' && (LOOK_IDS as readonly string[]).includes(s);

/** The brand's own colours for a look (the page never invents any): a light stage by default, a dark one for the night looks. */
export function paletteFor(id: LookId, dark = id === 'particles' || id === 'city') {
  return dark
    ? { bg: color.ink, accent: color.ice, accent2: color.deepIce }
    : { bg: id === 'tower' ? color.iceWhite : color.iceSoft, accent: id === 'orbit' ? color.iceWhite : color.ice, accent2: id === 'turntable' ? color.ink : color.deepIce };
}

/**
 * A look for a scene when the art director named none (or named one the scene cannot feed): by what the scene has, away
 * from the look just used and from the ones already used most in this film. Pure: the same input gives the same look.
 */
export function suggestLook(s: { text: string; hasScreenshot: boolean; hasNumbers: boolean; hasLogo: boolean; previous: LookId | null; used: Partial<Record<LookId, number>> }): LookId {
  const t = s.text.toLowerCase();
  const score = (id: LookId): number => {
    let v = 0;
    const need = LOOKS.find(l => l.id === id)!.needs;
    if (need === 'screenshot' && !s.hasScreenshot) return -99;
    if (need === 'numbers' && !s.hasNumbers) return -99;
    if (need === 'logo' && !s.hasLogo) return -99;
    if (id === 'turntable' && /\b(app|dashboard|interface|screen|page|site|product|feature)\b/.test(t)) v += 3;
    if (id === 'tower' && /\b(grow|growth|up|more|faster|percent|%|double|triple|revenue|users)\b/.test(t)) v += 3;
    if (id === 'city' && /\b(city|scale|platform|network|everywhere|world|infrastructure|build)\b/.test(t)) v += 3;
    if (id === 'orbit' && /\b(try|join|start|today|free|get|brand|meet)\b/.test(t)) v += 2;
    if (id === 'particles') v += 1;
    if (id === s.previous) v -= 5;
    return v - (s.used[id] ?? 0) * 0.5;
  };
  return [...LOOK_IDS].sort((a, b) => score(b) - score(a) || LOOK_IDS.indexOf(a) - LOOK_IDS.indexOf(b))[0]!;
}
