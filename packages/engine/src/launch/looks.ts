/**
 * The Launch looks: twelve learned looks (packages/library/src/kits/launch/looks/<ref>.json, one per reference film,
 * each a (:Kit) the reference TAUGHT). A look is a palette with roles (paper, ink, text…), a type system (display,
 * accent, micro, ui, wordmark, numeral faces), its world rhythm, its background layers and its preferred moves. A film
 * wears one look with the brand's own colour folded in as the accent, so the look re-skins to any brand.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { KIT_DIR } from './player';

export type World = 'paper' | 'ink' | 'flood' | 'haze' | 'deep';
export interface LookFile {
  id: string; name: string; about: string; from: string[]; styles: string[];
  palette: Record<string, string>; type: Record<string, unknown>; worlds: World[]; bg: Partial<Record<World, string[]>>;
  post: { grain?: number; vignette?: number }; prefer: { type: string[]; transitions: string[]; cams: string[] };
}
export interface Look extends LookFile { ref: string; accent: string }

const DIR = join(KIT_DIR, 'looks');
/** every learned look, by reference id (l01 … l12) */
export function looks(): Record<string, LookFile> {
  return Object.fromEntries(readdirSync(DIR).filter(f => f.endsWith('.json')).sort().map(f => [f.replace(/\.json$/, ''), JSON.parse(readFileSync(join(DIR, f), 'utf8')) as LookFile]));
}
export const LOOK_IDS = () => Object.keys(looks());

const rgb = (h: string) => { const n = parseInt(h.replace('#', '').slice(0, 6), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255] as const; };
/** how colourful a hex is (max - min channel): a near-grey brand colour can't carry an accent */
export const chroma = (h: string) => { const [r, g, b] = rgb(h); return Math.max(r, g, b) - Math.min(r, g, b); };

/** a look worn by a brand: the brand's colour becomes the accent (unless it is grey, then the look keeps its own) */
export function lookFor(ref: string, brandColor?: string): Look {
  const all = looks(), L = all[ref] ?? all.l02!;
  const ok = !!brandColor && /^#[0-9a-f]{6}$/i.test(brandColor) && chroma(brandColor) > 48;
  return { ...L, ref: L.id.replace(/^launch-/, ''), accent: ok ? brandColor!.toUpperCase() : (L.palette.accent ?? '#F26B21') };
}
