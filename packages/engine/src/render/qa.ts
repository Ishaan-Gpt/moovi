import { kit, type Format } from '@moovi/skills';
import type { Box } from './host';

/**
 * Geometry QA (the owner's cli/s1qa.mjs, ported): from the boxes the renderer reports for every drawn layer, flag
 * what a reviewer would catch on a still sheet:
 * - empty: frames with nothing but the backdrop (cuts included);
 * - clipped: text cut by the frame edge for 0.2 s or more;
 * - overlap: text touching text, or within 8 px of a card/phone/browser/icon (24 px of a corner asset), 0.2 s or more;
 * - covered: on a vertical video, text where the phone app draws its own UI over the reel, 0.2 s or more: the bottom
 *   band (caption, handle, audio row, buttons) or the right-side action rail (like, comment, share) below its top.
 *   Text here is a line, a ui layer that carries type (a pill, a comment or search field, a progress pill, a comment
 *   sheet) or a prop that is words (kit.TYPE_PROPS: a drawn CTA pill, a stamp, a numeral; known from `layer`); corner
 *   assets and other props are decoration and may sit there. Only when the style's laws carry the zone.
 * Boxes are in reference units 1080 wide (the renderer divides by width/1080), so the safe box follows the format.
 */
export interface Issue { type: 'empty' | 'clipped' | 'overlap' | 'covered'; what: string; from: number; to: number; ids: string[] }

/** The app's own UI over a 9:16 reel, in reference units (1080×1920): the bottom band's height, the rail's width and where the rail starts. */
export interface PlatformZone { bottom: number; rail: number; railTop: number }

/** The zone from a safeZone check's params (the craft graph's thresholds); null when the style has no such check. */
export function platformZone(p?: Record<string, unknown> | null): PlatformZone | null {
  if (!p) return null;
  const z = { bottom: Number(p.bottom), rail: Number(p.rail), railTop: Number(p.railTop) };
  return Object.values(z).every(Number.isFinite) ? z : null;
}

type Layer = Record<string, unknown>;
/** The timeline layer behind a box id ("s<scene>.<layer>", the renderer's own naming). */
export const layerOf = (T: { scenes: { layers: unknown[] }[] }) => (id: string): Layer | undefined => {
  const m = id.match(/^s(\d+)\.(\d+)$/);
  return m ? T.scenes[Number(m[1])]?.layers[Number(m[2])] as Layer | undefined : undefined;
};
/** A layer as the agent wrote it (its kind or prop and its words), so a fix names what to move. */
function nameOf(L: Layer | undefined, text: string) {
  if (!L) return text ? `"${text}"` : 'a pill or field';
  const p = (L.p ?? {}) as Layer;
  const t = L.kind === 'line' ? (L.words as { w: string }[]).map(w => w.w).join(' ') : (L.text ?? L.label ?? p.text ?? p.label ?? p.left ?? L.title ?? p.title) as string | undefined;
  return `${L.kind === 'image' && L.draw ? L.draw : L.kind}${t ? ` "${t}"` : ''}`;
}

export function geometry(frames: { f: number; boxes: Box[] }[], o: { fps: number; every: number; format: Format; entering?: (f: number) => boolean; platform?: PlatformZone | null; layer?: (id: string) => Layer | undefined }): Issue[] {
  const H = o.format === 'vertical' ? 1920 : 1080 * 1080 / 1920;
  const SAFE = { x0: 20, y0: 20, x1: 1060, y1: H - 20 };
  const Z = o.format === 'vertical' ? o.platform ?? null : null;
  const UNDER = Z && { y: 1920 - Z.bottom, x: 1080 - Z.rail };
  const isType = (b: Box) => b.kind === 'text' || b.kind === 'ui' || (b.kind === 'image' && kit.TYPE_PROPS.has(String(o.layer?.(b.id)?.draw ?? '')));
  const onScreen = (b: Box) => b.x1 > 0 && b.x0 < 1080 && b.y1 > 0 && b.y0 < H && b.alpha > 0.15;
  const pad = (b: Box, m: number) => ({ x0: b.x0 - m, y0: b.y0 - m, x1: b.x1 + m, y1: b.y1 + m });
  const area = (b: { x0: number; y0: number; x1: number; y1: number }) => Math.max(0, b.x1 - b.x0) * Math.max(0, b.y1 - b.y0);
  const inter = (a: { x0: number; y0: number; x1: number; y1: number }, b: { x0: number; y0: number; x1: number; y1: number }) => Math.max(0, Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0)) * Math.max(0, Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0));
  const solid = new Set(['card', 'phone', 'browser', 'image', 'ui', 'corner']);
  type Rect = { x0: number; y0: number; x1: number; y1: number };
  const runs = new Map<string, { f: number[]; ids: string[]; box?: Rect }>();
  const add = (key: string, f: number, ids: string[], b?: Rect) => {
    const r = runs.get(key) ?? { f: [], ids }; r.f.push(f);
    if (b) r.box = r.box ? { x0: Math.min(r.box.x0, b.x0), y0: Math.min(r.box.y0, b.y0), x1: Math.max(r.box.x1, b.x1), y1: Math.max(r.box.y1, b.y1) } : { x0: b.x0, y0: b.y0, x1: b.x1, y1: b.y1 };
    runs.set(key, r);
  };
  // a covered run's fix: what it is, how far into the app's UI it reaches (on screen), and how far to move it
  const covered = (key: string, b: Rect) => {
    const [, id = '', zone, ...t] = key.split('|'), text = t.join('|');
    const who = nameOf(o.layer?.(id), text);
    const R = (v: number) => Math.ceil(v);
    return zone === 'bottom'
      ? `${who} (${id}) reaches y ${R(b.y1)}, where the app's caption, handle and buttons cover the reel (below y ${UNDER!.y}): move it up at least ${R(b.y1 - UNDER!.y)} px so it ends above y ${UNDER!.y}, or make it smaller`
      : `${who} (${id}) reaches x ${R(b.x1)} at y ${Math.floor(b.y0)}–${R(b.y1)}, under the app's like/comment/share rail (right of x ${UNDER!.x}, below y ${Z!.railTop}): pull its right edge in at least ${R(b.x1 - UNDER!.x)} px (narrower or further left), or lift it so it ends above y ${Z!.railTop}`;
  };

  for (const { f, boxes } of frames) {
    const seen = new Set<string>();
    const vis = boxes.filter(onScreen).filter(b => { const k = `${b.id}|${b.kind}|${b.text ?? ''}|${Math.round(b.x0)}|${Math.round(b.y0)}`; if (seen.has(k)) return false; seen.add(k); return true; });
    if (!vis.some(b => b.kind !== 'decor' && b.kind !== 'corner')) add('empty', f, []);
    for (const b of vis) if (b.kind === 'text' && !o.entering?.(f) && (b.x0 < SAFE.x0 || b.x1 > SAFE.x1 || b.y0 < SAFE.y0 || b.y1 > SAFE.y1)) add(`clipped|${b.id}|${b.text}`, f, [b.id]);
    if (UNDER && !o.entering?.(f)) for (const b of vis) {
      if (!isType(b)) continue;
      if (b.y1 > UNDER.y) add(`covered|${b.id}|bottom|${b.text ?? ''}`, f, [b.id], b);
      else if (b.x1 > UNDER.x && b.y1 > Z!.railTop) add(`covered|${b.id}|rail|${b.text ?? ''}`, f, [b.id], b);
    }
    const texts = vis.filter(b => b.kind === 'text' && !b.chip);
    for (let i = 0; i < texts.length; i++) {
      for (let j = i + 1; j < texts.length; j++) if (inter(texts[i]!, texts[j]!) > 0.02 * Math.min(area(texts[i]!), area(texts[j]!))) add(`overlap|${texts[i]!.id} × ${texts[j]!.id}|"${texts[i]!.text}" / "${texts[j]!.text}"`, f, [texts[i]!.id, texts[j]!.id]);
      for (const x of vis) if (solid.has(x.kind) && x.id !== texts[i]!.id && inter(pad(texts[i]!, x.kind === 'corner' ? 24 : 8), x) > 0.01 * area(texts[i]!)) add(`overlap|${texts[i]!.id} × ${x.id} (${x.kind})|"${texts[i]!.text}"`, f, [texts[i]!.id, x.id]);
    }
  }
  const minRun = Math.max(2, Math.round((0.2 * o.fps) / o.every));
  const issues: Issue[] = [];
  for (const [key, r] of runs) {
    const fs = r.f;
    let start = fs[0]!, prev = fs[0]!, n = 1;
    const type = key.split('|')[0] as Issue['type'];
    const what = type === 'covered' ? covered(key, r.box!) : key.split('|').slice(1).join(' | ') || 'nothing but the backdrop';
    const flush = () => { if (n >= (key === 'empty' ? 1 : minRun)) issues.push({ type, what, from: +(start / o.fps).toFixed(2), to: +(prev / o.fps).toFixed(2), ids: r.ids }); };
    for (const f of fs.slice(1)) { if (f - prev <= o.every) { prev = f; n++; } else { flush(); start = prev = f; n = 1; } }
    flush();
  }
  return issues.sort((a, b) => a.from - b.from);
}

/** A readable list for an agent. */
export const describe = (issues: Issue[]) => issues.length ? issues.map(i => `- ${i.type} ${i.from}–${i.to} s: ${i.what}`).join('\n') : 'No issues.';
