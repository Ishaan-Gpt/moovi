/**
 * The CHECK runner (NORTH-STAR step 1): code checks first (lint, collision map, contrast on real pixels), then at most
 * one review of at most 3 frames and at most one repair (move the caption, add a backing plate, or drop a duplicate
 * card), and the better of the two versions ships. It never blocks and never throws: any failure inside it is written
 * down and the render or edit goes on as it was.
 */
import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { PlayerEdl, Role } from '../edit/lib';
import { collideEdl } from './collide';
import { reviewConfig, type ReviewConfig, type ReviewOverride } from './config';
import { cssRgb, ratio, luminance, regionContrast, sampleBox, saveFrame } from './contrast';
import { capBase, captionBoxes, lookOf, styleOf, type CapBox, type MeasuredCap } from './geometry';
import { lintEdl } from './lint';
import { visionFrames, visionReview, type VisionFn } from './vision';
import { scoreOf, SEVERITY_COST, type Issue, type Review } from './types';

export interface RepairResult { edl: PlayerEdl; did: string; action: 'move' | 'plate' | 'drop'; /** the vision review asked for it */ vision?: boolean }

const clone = <T>(x: T): T => JSON.parse(JSON.stringify(x)) as T;
const laws = (e: PlayerEdl) => (e.style_laws ?? {}) as Record<string, unknown>;

/** The code checks on the EDL alone (no pixels): lint plus the collision map. */
export function checkEdl(e: PlayerEdl, cfg: ReviewConfig = reviewConfig(e), W = e.output?.w || 720, H = e.output?.h || 1280, measured?: MeasuredCap[] | null): Review {
  const caps = captionBoxes(e, W, H, undefined, measured);
  const issues = [...lintEdl(e, cfg, caps), ...collideEdl(e, cfg, caps)];
  return { issues, score: scoreOf(issues), frames: [] };
}

const MOVE: Issue['kind'][] = ['face', 'safe_zone', 'collision', 'burned_text'];
const cost = (xs: Issue[]) => xs.reduce((s, i) => s + SEVERITY_COST[i.severity], 0);
const capPlaceIssues = (e: PlayerEdl, cfg: ReviewConfig, measured?: MeasuredCap[] | null) => collideEdl(e, cfg, captionBoxes(e, e.output?.w || 720, e.output?.h || 1280, undefined, measured)).filter(i => MOVE.includes(i.kind) && i.chunk !== undefined);
/** a vision finding asks for this repair */
const asks = (i: Issue, f: NonNullable<Issue['fix']>) => i.kind === 'vision' && i.fix === f;

/** The one repair worth most: the group of fixable issues that costs most picks the action. Null when none applies. */
export function repairEdl(e: PlayerEdl, issues: Issue[], cfg: ReviewConfig = reviewConfig(e), measured?: MeasuredCap[] | null): RepairResult | null {
  const opts: { gain: number; run: () => RepairResult | null }[] = [];
  const moveIs = issues.filter(i => (MOVE.includes(i.kind) || asks(i, 'move')) && i.chunk !== undefined);
  const seen = moveIs.filter(i => i.kind === 'vision');
  if (cfg.repairs.move && moveIs.length) opts.push({ gain: cost(moveIs), run: () => {
    // what the eye saw counts as a cost the move takes away, so a move it asked for goes at least 10% of the frame
    const base = capBase(e), now = cost(capPlaceIssues(e, cfg, measured)) + cost(seen);
    let best: { y: number; c: number } | null = null;
    for (let y = 0.14; y <= 0.8 + 1e-9; y += 0.02) {
      if (seen.length && Math.abs(y - base) < 0.1) continue;
      const t = clone(e); t.style_laws = { ...laws(t), caption_y: +y.toFixed(2) };
      const c = cost(capPlaceIssues(t, cfg, measured));
      if (!best || c < best.c || (c === best.c && Math.abs(y - base) < Math.abs(best.y - base))) best = { y: +y.toFixed(2), c };
    }
    if (!best || best.c >= now) return null;
    const out = clone(e); out.style_laws = { ...laws(out), caption_y: best.y };
    return { edl: out, action: 'move', did: `moved the captions from ${Math.round(base * 100)}% to ${Math.round(best.y * 100)}% of the frame height${seen.length ? ' (the vision review asked for it)' : ''}`, ...(seen.length ? { vision: true } : {}) };
  } });
  const lowC = issues.filter(i => i.kind === 'contrast' || asks(i, 'plate'));
  if (cfg.repairs.plate && lowC.length && !styleOf(e).look.box && !laws(e).caption_plate) opts.push({ gain: cost(lowC), run: () => {
    const out = clone(e); out.style_laws = { ...laws(out), caption_plate: true };
    const px = lowC.filter(i => i.kind === 'contrast');
    return { edl: out, action: 'plate', did: `put a backing plate behind the captions (${px.length ? `contrast ${Math.min(...px.map(i => i.value ?? 0)).toFixed(2)}:1 was under ${cfg.minContrast}:1` : 'the vision review found them hard to read'})`, ...(lowC.some(i => i.kind === 'vision') ? { vision: true } : {}) };
  } });
  const dup = issues.filter(i => (i.kind === 'repeat' || i.kind === 'overlays' || asks(i, 'drop')) && i.insert !== undefined);
  if (cfg.repairs.dropDuplicate && dup.length && e.inserts?.length) opts.push({ gain: cost(dup), run: () => {
    const drop = new Set(dup.map(i => i.insert!)), out = clone(e);
    const gone = (e.inserts ?? []).filter((_, i) => drop.has(i));
    out.inserts = (e.inserts ?? []).filter((_, i) => !drop.has(i));
    return { edl: out, action: 'drop', did: `dropped ${gone.length} duplicate or stacked card${gone.length > 1 ? 's' : ''} (${gone.map(x => `${x.kind} at ${x.t0.toFixed(1)} s`).join(', ')})${dup.some(i => i.kind === 'vision') ? ', the vision review asked for it' : ''}`, ...(dup.some(i => i.kind === 'vision') ? { vision: true } : {}) };
  } });
  opts.sort((a, b) => b.gain - a.gain);
  for (const o of opts) { const r = o.run(); if (r) return r; }
  return null;
}

export interface CheckResult<E> { edl: E; before: Review; after: Review | null; repaired: string | null; kept: 'original' | 'repaired'; error?: string }

/** For edits (no pixels): check, at most one repair, keep whichever scores better. Never throws. */
export function checkAndRepair<E extends object>(e: E, o: { config?: ReviewOverride } = {}): CheckResult<E> {
  const empty: Review = { issues: [], score: 100, frames: [] };
  try {
    const pe = e as unknown as PlayerEdl, cfg = reviewConfig(pe, o.config);
    const before = checkEdl(pe, cfg), fix = before.issues.length ? repairEdl(pe, before.issues, cfg) : null;
    if (!fix) return { edl: e, before, after: null, repaired: null, kept: 'original' };
    const after = checkEdl(fix.edl, cfg);
    return after.score > before.score ? { edl: fix.edl as unknown as E, before, after, repaired: fix.did, kept: 'repaired' } : { edl: e, before, after, repaired: fix.did, kept: 'original' };
  } catch (err) { return { edl: e, before: empty, after: null, repaired: null, kept: 'original', error: String((err as Error)?.message ?? err) }; }
}

/** The colour a palette role (or a literal colour) names */
function colourOf(e: PlayerEdl, role: string | undefined | null): [number, number, number] | null {
  if (!role) return null;
  return cssRgb(role) ?? cssRgb(String((e.palette as Record<string, string> | undefined)?.[role as Role] ?? ''));
}

/**
 * The caption's fill and stroke as this run draws them: the run's caption look (caption_look, page.ts LK) wins over
 * the player style it sits on, the way the page paints it; otherwise the style's palette roles.
 */
export function captionInk(e: PlayerEdl, W = e.output?.w || 720): { fill: [number, number, number] | null; stroke: [number, number, number] | null; strokePx: number; from: 'look' | 'style' } {
  const st = styleOf(e), lk = lookOf(e, W);
  const fill = (lk?.fill ? cssRgb(lk.fill) : null) ?? colourOf(e, st.look.fill);
  const s = lk?.stroke ? { c: cssRgb(lk.stroke.color), px: lk.stroke.px } : st.look.stroke ? { c: colourOf(e, st.look.stroke.role), px: st.look.stroke.px } : null;
  return { fill, stroke: s?.c ?? null, strokePx: s?.c ? s.px : 0, from: lk && (lk.fill || lk.stroke) ? 'look' : 'style' };
}

/** Pick at most n caption chunks to look at: the ones already flagged first, then spread over the film. */
export function pickFrames(caps: CapBox[], issues: Issue[], n: number): CapBox[] {
  if (n <= 0 || !caps.length) return [];
  const flagged = new Set(issues.filter(i => i.chunk !== undefined).map(i => i.chunk!));
  const out: CapBox[] = caps.filter(c => flagged.has(c.chunk)).slice(0, n);
  for (let k = 0; out.length < n && k < n; k++) {
    const c = caps[Math.min(caps.length - 1, Math.floor((k + 0.5) * caps.length / n))]!;
    if (!out.includes(c)) out.push(c);
  }
  return out.slice(0, n).sort((a, b) => a.t - b.t);
}

/** The pixel pass: contrast under up to 3 caption boxes of a rendered file, with proof frames saved when asked. */
export async function contrastIssues(e: PlayerEdl, file: string, caps: CapBox[], cfg: ReviewConfig, W: number, H: number, proof?: string): Promise<{ issues: Issue[]; frames: Review['frames'] }> {
  const { fill, stroke, strokePx } = captionInk(e, W);
  const strong = !!(stroke && fill && strokePx >= 3 && ratio(luminance(...fill), luminance(...stroke)) >= 4.5);
  const issues: Issue[] = [], frames: Review['frames'] = [];
  for (const [k, c] of caps.entries()) {
    const fr: Review['frames'][number] = { t: +c.t.toFixed(3) };
    if (proof) { const f = join(proof, `frame-${k}.jpg`); if (await saveFrame(file, c.t, f)) fr.file = f; }
    if (fill) {
      const px = await sampleBox(file, c.t, c, W, H);
      if (px) {
        const m = regionContrast(px, fill, stroke ? { stroke } : {}); fr.contrast = m.ratio;
        if (m.ratio < cfg.minContrast && !strong) issues.push({ kind: 'contrast', severity: 'error', t: c.t, chunk: c.chunk, value: m.ratio, msg: `caption "${c.text}" reads at ${m.ratio}:1 against the frame (needs ${cfg.minContrast}:1)` });
      }
    }
    frames.push(fr);
  }
  return { issues, frames };
}

export interface RenderReviewOpts { dir: string; out: string; w: number; h: number; config?: ReviewOverride; repair?: boolean; proof?: boolean;
  /** each caption chunk's box as the render's player page drew it (render.ts measureCaps); the estimate when absent */
  measured?: MeasuredCap[] | null;
  /** the vision review's eye; the engine's own model when absent (review/vision.ts) */
  see?: VisionFn }
export interface RenderReview { before: Review; after: Review | null; repaired: string | null; kept: 'original' | 'repaired'; ms: number; error?: string;
  /** the one vision review: what it found, how long it took, or why it was skipped */
  vision?: { ms: number; asked: number; issues: string[]; frames: string[]; skipped?: string; error?: string };
  /** how many caption boxes came from the browser rather than the estimate */
  measured?: number }

/** the render callback may hand back the repaired render's own measured boxes */
const measuredOf = (r: unknown): MeasuredCap[] | null => { const m = (r as { capRects?: unknown } | null | undefined)?.capRects; return Array.isArray(m) && m.length ? m as MeasuredCap[] : null; };

/**
 * After a render: review the MP4 (code checks, contrast under up to 3 caption boxes, then one vision review of those
 * same frames), and when one repair applies, write the repaired edl.json, render it once more beside the first, review
 * that with the code checks and the pixels (the vision review is spent) and keep whichever scores better against the
 * first version's code score; a repair the vision review asked for ships when the code checks hold. The loser's MP4 and
 * EDL are put back or removed. Writes review.json in the run folder. Never throws.
 */
export async function reviewRender(o: RenderReviewOpts, render: (out: string) => Promise<unknown>): Promise<RenderReview> {
  const t0 = Date.now(), edlFile = join(o.dir, 'edl.json'), empty: Review = { issues: [], score: 100, frames: [] };
  let res: RenderReview = { before: empty, after: null, repaired: null, kept: 'original', ms: 0 };
  let original: string | null = null, out2: string | null = null;
  try {
    original = readFileSync(edlFile, 'utf8');
    const e = JSON.parse(original) as PlayerEdl, cfg = reviewConfig(e, o.config), W = o.w, H = o.h;
    const dir = join(o.dir, 'review'), keep = o.proof !== false || cfg.vision;
    rmSync(dir, { recursive: true, force: true }); if (keep) mkdirSync(join(dir, 'before'), { recursive: true });
    const look = async (x: PlayerEdl, file: string, sub: string, m: MeasuredCap[] | null | undefined, caps0?: CapBox[]): Promise<Review> => {
      const st = checkEdl(x, cfg, W, H, m), caps = captionBoxes(x, W, H, undefined, m);
      // the same chunks before and after, so the two reviews compare like with like
      const pick = caps0 ? caps.filter(c => caps0.some(p => p.chunk === c.chunk)) : pickFrames(caps, st.issues, cfg.frames);
      if (keep) mkdirSync(join(dir, sub), { recursive: true });
      const px = await contrastIssues(x, file, pick, cfg, W, H, keep ? join(dir, sub) : undefined);
      const issues = [...st.issues, ...px.issues];
      return { issues, score: scoreOf(issues), frames: px.frames };
    };
    const m1 = o.measured ?? null;
    res.measured = m1 ? captionBoxes(e, W, H, undefined, m1).filter(c => c.measured).length : 0;
    const code = await look(e, o.out, 'before', m1);
    // the one vision review, on the frames the pixel pass saved
    const vr = await visionReview(e, visionFrames(code.frames, captionBoxes(e, W, H, undefined, m1)), cfg, o.see);
    res.vision = { ms: vr.ms, asked: vr.asked, issues: vr.issues.map(i => i.msg), frames: code.frames.map(f => f.file).filter((f): f is string => !!f), ...(vr.skipped ? { skipped: vr.skipped } : {}), ...(vr.error ? { error: vr.error } : {}) };
    const before: Review = { ...code, issues: [...code.issues, ...vr.issues], score: scoreOf([...code.issues, ...vr.issues]) };
    res = { ...res, before };
    const fix = o.repair === false ? null : repairEdl(e, before.issues, cfg, m1);
    if (fix) {
      const caps0 = captionBoxes(e, W, H, undefined, m1).filter(c => before.frames.some(f => Math.abs(f.t - c.t) < 1e-3));
      out2 = o.out.replace(/(\.mp4)?$/i, '.repair.mp4');
      writeFileSync(edlFile, JSON.stringify(fix.edl, null, 2));
      const r2 = await render(out2);
      const after = await look(fix.edl, out2, 'after', measuredOf(r2) ?? m1, caps0);
      res = { ...res, after, repaired: fix.did };
      // the vision review runs once, so the repaired version is weighed against the first one's code score
      const forVision = !!fix.vision;
      if (after.score > code.score || (forVision && after.score >= code.score)) {
        renameSync(out2, o.out); out2 = null;
        writeFileSync(join(o.dir, 'edl.prereview.json'), original);
        res.kept = 'repaired';
      } else { writeFileSync(edlFile, original); }
    }
  } catch (err) {
    res.error = String((err as Error)?.message ?? err);
    if (original !== null && res.kept !== 'repaired') try { writeFileSync(edlFile, original); } catch { /* the edl stays as it was */ }
  } finally {
    if (out2 && existsSync(out2)) rmSync(out2, { force: true });
  }
  res.ms = Date.now() - t0;
  try { writeFileSync(join(o.dir, 'review.json'), JSON.stringify(res, null, 2)); } catch { /* a read-only folder still renders */ }
  return res;
}
