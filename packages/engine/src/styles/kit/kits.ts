/**
 * A brief meets a kit. Kits (craft graph: (:Kit {palette, type, motion})-[:HAS]->(:Asset)) are looks learned from
 * reference reels. Auto asks `kitsServing` which kit's parts serve the brief's needs; a kit that covers at least three
 * of them and at least half goes with the run, and the chosen style dresses its library inserts in the kit's palette
 * ROLES (ink, paper, accent, accent2) instead of its own (./borrow.ts). No kit clears the bar: nothing changes.
 */
import { CRAFT, library as L, run } from '@moovi/graph';
import { detectNeeds, type Need } from './needs';

export interface KitPick { id: string; name: string; covered: number; of: number; hits: number; palette: Record<string, string> }

/** The brief's needs, most frequent first (one detector pass per line). */
export function briefNeeds(lines: string[]): Need[] {
  const n = new Map<Need, number>();
  lines.forEach((l, i) => detectNeeds(l, { index: i, count: lines.length }).forEach(x => n.set(x, (n.get(x) ?? 0) + 1)));
  return [...n].sort((a, b) => b[1] - a[1]).map(([x]) => x);
}

/** The kit for these needs, or null (graph down counts as no kit: Auto never waits on a look). */
export async function matchKit(needs: Need[], o: { min?: number; share?: number } = {}): Promise<KitPick | null> {
  if (!needs.length) return null;
  try {
    const [top] = await run<{ id: string; name: string; covered: number; hits: number }>(CRAFT, L.kitsServing, { needs, n: 3 }, 4000);
    if (!top || top.covered < Math.max(o.min ?? 3, Math.ceil(needs.length * (o.share ?? 0.5)))) return null;
    const [k] = await run<{ palette: string | null }>(CRAFT, L.kitParts, { kit: top.id }, 4000);
    const palette = (() => { try { return JSON.parse(k?.palette ?? '{}') as Record<string, string>; } catch { return {}; } })();
    return { ...top, of: needs.length, palette };
  } catch { return null; }
}

/** A kit's palette roles → the insert palette (./liblayer.ts): its ink on its paper, its accents. */
export const kitInsertPalette = (p: Record<string, string>) => ({
  ink: p.ink ?? '#141414', card: p.paper ?? p.board ?? '#ffffff', accent: p.accent ?? p.pop ?? '#2B67C6', accent2: p.accent2 ?? p.accent ?? '#2B67C6',
  soft: p.accentMid ?? p.accent ?? '#cccccc', onAccent: p.paper ?? '#ffffff',
});
