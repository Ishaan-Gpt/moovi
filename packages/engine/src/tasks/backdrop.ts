import type { SceneProgram } from '@moovi/skills';

/**
 * Real moving video always reaches the frame. The Art Director boards stock footage and the site's scroll capture; the
 * Shot Builder (a model) designs each scene and sometimes leaves that video out. Before the film is assembled, a
 * scene whose boarded video was found but never used gets it as a full-bleed backdrop: the clip under the scene's
 * own layers, with a scrim in the stage's paper colour so every word on top stays readable.
 */
export interface VideoAsset { id: string; kind: string }

/** which boarded video a scene shows when the builder used none: real footage first, then the site's scroll */
const RANK: Record<string, number> = { footage: 0, scroll: 1 };

/** "#F7FAFD" (or "#fff") with an alpha, as rgba(); anything that is not a hex colour stays white */
export function rgba(hex: string, alpha: number): string {
  const h = /^#([0-9a-f]{6}|[0-9a-f]{3})$/i.exec(hex)?.[1] ?? 'fff';
  const full = h.length === 3 ? [...h].map(c => c + c).join('') : h;
  const [r, g, b] = [0, 2, 4].map(i => parseInt(full.slice(i, i + 2), 16));
  return `rgba(${r},${g},${b},${alpha})`;
}

export function withVideoBackdrop(program: SceneProgram, videos: VideoAsset[], o: { W: number; H: number; paper: string }): { program: SceneProgram; used: string | null } {
  if (!videos.length) return { program, used: null };
  const text = JSON.stringify(program);
  if (videos.some(v => text.includes(`asset:${v.id}`))) return { program, used: null };
  const pick = [...videos].sort((a, b) => (RANK[a.kind] ?? 9) - (RANK[b.kind] ?? 9))[0]!;
  const backdrop = [
    { kind: 'image' as const, src: `asset:${pick.id}`, cx: o.W / 2, cy: o.H / 2, w: o.W, h: o.H, fit: 'cover' as const, vt: 0 },
    // a scrim strongest behind the words (top and middle bands) and light at the foot: the clip stays clearly visible
    // and moving, the scene's own text keeps its contrast
    { kind: 'rect' as const, x: 0, y: 0, w: o.W, h: o.H, stops: [[0, rgba(o.paper, 0.55)], [0.6, rgba(o.paper, 0.42)], [1, rgba(o.paper, 0.2)]] as [number, string][] },
  ];
  return { program: { ...program, layers: [...backdrop, ...(program.layers ?? [])] }, used: pick.id };
}
