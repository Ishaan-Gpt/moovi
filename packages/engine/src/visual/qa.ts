import { byId } from './artifacts';
import { FORMATS, bandOf, slotsOf, type Rect } from './layouts';
import type { Session } from './capture';
import type { VPlan } from './types';

/**
 * The clean-output checks. Two kinds:
 *  - checkPlan: pure, on the plan alone (length within 2 s of the ask, scenes tile the timeline, every scene has motion,
 *    type and ambient depth, nothing but ambient layers is allowed to sit in the caption band);
 *  - auditFilm: on rendered frames (sampled, cheap): nothing static for more than a second, no empty frame, no element
 *    covering the caption band once it has arrived.
 */
export interface Issue { kind: 'length' | 'timeline' | 'scene' | 'caption-band' | 'static' | 'empty-frame' | 'caption-cover' | 'out-of-frame'; scene?: number; t?: number; detail: string }

/** How far the film may be from the length asked for (the brief's "within 2 s"). */
export const LENGTH_TOLERANCE_S = 2;
const overlap = (a: Rect, b: Rect) => Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x)) * Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));

export function checkPlan(plan: VPlan, askedSeconds?: number): Issue[] {
  const out: Issue[] = [], { W, H } = FORMATS[plan.format];
  if (askedSeconds !== undefined && Math.abs(plan.seconds - askedSeconds) > LENGTH_TOLERANCE_S) out.push({ kind: 'length', detail: `the film is ${plan.seconds.toFixed(1)} s, ${askedSeconds} s was asked (±${LENGTH_TOLERANCE_S} s)` });
  let t = 0;
  for (const s of plan.scenes) {
    if (Math.abs(s.start - t) > 1e-6) out.push({ kind: 'timeline', scene: s.i, detail: `scene ${s.i} starts at ${s.start.toFixed(2)} s but the last one ended at ${t.toFixed(2)} s` });
    if (s.end <= s.start) out.push({ kind: 'timeline', scene: s.i, detail: `scene ${s.i} has no length` });
    t = s.end;
    if (!s.elements.length) out.push({ kind: 'scene', scene: s.i, detail: `scene ${s.i} has no elements` });
    if (!s.ambient.length) out.push({ kind: 'scene', scene: s.i, detail: `scene ${s.i} has no ambient depth` });
    if (!s.type.length) out.push({ kind: 'scene', scene: s.i, detail: `scene ${s.i} has no words` });
    if (s.i > 0 && !s.transition) out.push({ kind: 'scene', scene: s.i, detail: `scene ${s.i} arrives with no transition` });
    // a scene's elements settle in their slots: none of the slots may cross the caption band (ambient layers may, they sit behind it)
    const caption = bandOf(s.layout, plan.format);
    for (const slot of slotsOf(s.layout, plan.format)) {
      const el = s.elements.find(e => e.slot === slot.id), art = el && byId(el.art);
      if (art && !['particles', 'glow', 'bg'].includes(art.kind) && overlap(slot.rect, caption) > 0) out.push({ kind: 'caption-band', scene: s.i, detail: `scene ${s.i}: ${el!.art} in slot ${slot.id} reaches into the caption band` });
      if (slot.rect.x < 0 || slot.rect.y < 0 || slot.rect.x + slot.rect.w > W || slot.rect.y + slot.rect.h > H) out.push({ kind: 'out-of-frame', scene: s.i, detail: `scene ${s.i}: slot ${slot.id} leaves the frame` });
    }
  }
  if (Math.abs(t - plan.seconds) > 1e-6) out.push({ kind: 'timeline', detail: `the plan says ${plan.seconds} s but its scenes end at ${t} s` });
  return out;
}

/* ───────── audits on rendered frames ───────── */

export interface Thumb { w: number; h: number; px: number[] }
const mad = (a: Thumb, b: Thumb) => { let s = 0; for (let i = 0; i < a.px.length; i++) s += Math.abs(a.px[i]! - b.px[i]!); return s / a.px.length; };
const spread = (a: Thumb) => { const m = a.px.reduce((x, y) => x + y, 0) / a.px.length; return Math.sqrt(a.px.reduce((x, y) => x + (y - m) ** 2, 0) / a.px.length); };

/** A second is "static" when no two frames 0.2 s apart in it differ by more than this (mean absolute difference of 0-255 greys). */
export const STATIC_BELOW = 0.35;
/** A frame is "empty" when its greys barely vary. */
export const EMPTY_BELOW = 3;

/** Pure: motion per second from sampled pairs, and the empty frames, given the thumbs. */
export function motionReport(pairs: { t: number; a: Thumb; b: Thumb }[], singles: { t: number; thumb: Thumb }[] = []): { perSecond: { second: number; energy: number }[]; issues: Issue[] } {
  const bySec = new Map<number, number[]>();
  for (const p of pairs) { const s = Math.floor(p.t); (bySec.get(s) ?? bySec.set(s, []).get(s)!).push(mad(p.a, p.b)); }
  const perSecond = [...bySec].sort((x, y) => x[0] - y[0]).map(([second, v]) => ({ second, energy: +Math.max(...v).toFixed(3) }));
  const issues: Issue[] = perSecond.filter(s => s.energy < STATIC_BELOW).map(s => ({ kind: 'static' as const, t: s.second, detail: `second ${s.second} is static (motion energy ${s.energy} < ${STATIC_BELOW})` }));
  for (const s of singles) if (spread(s.thumb) < EMPTY_BELOW) issues.push({ kind: 'empty-frame', t: s.t, detail: `the frame at ${s.t.toFixed(2)} s is empty` });
  return { perSecond, issues };
}

/**
 * After an element has arrived (its enter animation is over) it must not cover the caption band: the check is on its real
 * projected box (camera, parallax and tilt included). Frames inside a transition are skipped (scenes are sliding).
 */
export function coverIssues(boxes: { art: string; job: string; x0: number; y0: number; x1: number; y1: number }[], plan: VPlan, t: number, sceneI: number): Issue[] {
  const s = plan.scenes[sceneI]!, caption = bandOf(s.layout, plan.format), out: Issue[] = [];
  for (const b of boxes) {
    const el = s.elements.find(e => e.art === b.art); if (!el || t - s.start < el.at + 0.8) continue;
    const r: Rect = { x: b.x0, y: b.y0, w: b.x1 - b.x0, h: b.y1 - b.y0 }, ov = overlap(r, caption) / (caption.w * caption.h);
    if (ov > 0.04) out.push({ kind: 'caption-cover', scene: sceneI, t, detail: `${b.art} covers ${(ov * 100).toFixed(0)}% of the caption band at ${t.toFixed(1)} s` });
  }
  return out;
}

export interface Audit { issues: Issue[]; perSecond: { second: number; energy: number }[]; framesRendered: number }

/** Sample the film: one motion pair per second, an empty-frame look at each pair, a cover check at each pair and at each scene's middle. */
export async function auditFilm(sess: Pick<Session, 'thumb' | 'boxes'>, plan: VPlan): Promise<Audit> {
  const fps = plan.fps, pairs: { t: number; a: Thumb; b: Thumb }[] = [], singles: { t: number; thumb: Thumb }[] = [], issues: Issue[] = [];
  let frames = 0;
  const sceneAt = (t: number) => { let c = 0; plan.scenes.forEach((s, i) => { if (t >= s.start - 1e-6) c = i; }); return c; };
  for (let s = 0; s < Math.floor(plan.seconds); s++) {
    const t0 = s + 0.35, t1 = t0 + 0.2;
    if (t1 >= plan.seconds) break;
    const a = await sess.thumb(Math.round(t0 * fps)), b = await sess.thumb(Math.round(t1 * fps)); frames += 2;
    pairs.push({ t: t0, a, b }); singles.push({ t: t0, thumb: a });
    const i = sceneAt(t0), sc = plan.scenes[i]!;
    if (!(sc.transition && t0 - sc.start < 0.6)) issues.push(...coverIssues(await sess.boxes(Math.round(t0 * fps)), plan, t0, i));
  }
  const m = motionReport(pairs, singles);
  return { issues: [...issues, ...m.issues], perSecond: m.perSecond, framesRendered: frames };
}
