import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { s1kit } from '@moovi/skills';
import { config } from '../config';
import { boxes } from '../render/host';
import { describe, geometry, layerOf } from '../render/qa';
import { critique } from './critic';
import { meUrls } from './preview';
import { assetsDir, sceneOps, storyboard, stripV, type Op, type Storyboard, type Word } from './planner';

/**
 * Plan → spec for a Style 1 video, fast: storyboard, every scene at once (each dry-run through the exact s1kit copy
 * before it's accepted), assemble, finish + polish, then the owner's geometry QA; a scene with QA issues is rewritten
 * once with the issues in hand. Writes <dir>/<id>.json, timeline.json, events.json, plan.json.
 */

type Obj = Record<string, any>;
const ms = (t0: number) => Math.round(Date.now() - t0);

export function brandJson(brand: string) {
  // a brand made from a website (s1url) lives in data/brands; the owner's own brands in MotionEasy
  const own = join(config.data, 'brands', `${brand}.json`);
  return JSON.parse(readFileSync(existsSync(own) ? own : join(config.data, 'brands', `${brand}.json`), 'utf8'));
}

/** The brand's own pieces a plan carries: its logo (the kit's `mark`, logo-land and CTA lockup) and the backdrop corners. */
export interface KitExtra { logo?: string | null; corners?: Obj[]; keyWords?: string[] }

export function planOf(id: string, brand: string, sceneOpsList: Op[][], attrs: Obj = {}, extra: KitExtra = {}): s1kit.Plan {
  const kw: Obj = {};
  if (extra.corners?.length) kw.corners = extra.corners;
  if (extra.keyWords?.length) kw.key_words = extra.keyWords;
  return {
    video: id, kit: { brand, alias: {}, logo: extra.logo ?? null, attrs },
    ops: [...sceneOpsList.flat(), { call: 'finish', kw }, { call: 'polish', kw: {} }],
  };
}

const errText = (e: unknown) => (e instanceof Error ? e.message : String(e)).slice(0, 600);

export async function makePlan(o: { dir: string; id: string; brand: string; words: Word[]; brief?: string; qa?: boolean; critic?: boolean; resume?: boolean; log?: (s: string) => void }) {
  const log = o.log ?? console.log, B = brandJson(o.brand), t0 = Date.now(), times: Record<string, number> = {};
  const run = (plan: s1kit.Plan) => { const r = s1kit.runPlan(plan, { brand: B, words: o.words as s1kit.Word[] }); fitToFrame(r.timeline as Obj); if ((r.spec as Obj).props) (r.spec as Obj).props.timeline = r.timeline; return r; };
  // A scene alone must run through the kit (words exist, args bind, presets accept them).
  const check = (name: string) => (ops: Op[]) => {
    if (o.brand !== 'captionseasy' && /styles\/(assets\/(looks|premium-captions)|style-1\/videos)\//.test(JSON.stringify(ops))) return "Those clips belong to another brand (CaptionsEasy). Use only this brand's media listed in the brief, or drawn props.";
    const empty = emptyProps(ops); if (empty) { log(`  empty props in ${name}`); return empty; }
    try { run(planOf(o.id, o.brand, [stripV(ops) as Op[]])); return null; }
    catch (e) { log(`  kit rejected ${name}: ${errText(e).slice(0, 200)}`); return `The kit rejected these ops: ${errText(e)}. Fix them.`; }
  };
  // Never let one scene sink the video: a scene the model can't get past the kit becomes a plain two-line title.
  const safe = (i: number, p: Promise<Op[]>) => p.catch(e => { log(`scene ${board.scenes[i]!.name} fell back to a plain title: ${errText(e).slice(0, 160)}`); return plainScene(board, i, o.words); });

  const saved = o.resume && existsSync(join(o.dir, 'scenes.json')) ? JSON.parse(readFileSync(join(o.dir, 'scenes.json'), 'utf8')) as { board: Storyboard; scenes: Op[][] } : null;
  const board: Storyboard = saved?.board ?? await storyboard({ words: o.words, brand: o.brand, brief: o.brief });
  times.storyboard = ms(t0); log(`storyboard ${times.storyboard} ms: ${board.scenes.map(s => s.name).join(' · ')}`);

  const scenes = saved?.scenes ?? await Promise.all(board.scenes.map((s, i) => safe(i, sceneOps({ board, i, words: o.words, check: check(s.name) }))));
  times.scenes = ms(t0); log(`scenes ${times.scenes} ms`);

  // saved before QA: a crash later never costs the planning, and --resume starts from here
  writeFileSync(join(o.dir, 'scenes.json'), JSON.stringify({ board, scenes }, null, 1));
  let out = run(planOf(o.id, o.brand, scenes));
  // the art director looks at a still of every scene next to the owner's films; weak scenes are rewritten with its notes
  if (o.critic !== false) {
    const tc = Date.now();
    try {
      const notes = (await critique({ spec: out.spec, timeline: out.timeline as Obj, dir: o.dir, board, log })).filter(n => n.verdict === 'fix').slice(0, 3); // the 3 worst only: each rewrite is a model round
      log(`critic: ${notes.length} scene(s) to fix${notes.length ? '\n' + notes.map(n => `- ${board.scenes[n.scene]!.name}: ${n.note}`).join('\n') : ''}`);
      await Promise.all(notes.map(async n => {
        try { scenes[n.scene] = await sceneOps({ board, i: n.scene, words: o.words, check: check(board.scenes[n.scene]!.name), fix: { ops: scenes[n.scene]!, issues: `Art director (judging a still of this scene against the owner's finished films): ${n.note}` } }); }
        catch (e) { log(`critic rewrite ${board.scenes[n.scene]!.name} failed, kept: ${errText(e).slice(0, 120)}`); }
      }));
      out = run(planOf(o.id, o.brand, scenes));
    } catch (e) { log(`critic skipped: ${errText(e).slice(0, 200)}`); }
    times.critic = ms(tc);
  }
  if (o.qa !== false) {
    const tq = Date.now();
    // QA until clean: up to 2 rewrite rounds by the model, then any scene still failing becomes the plain title
    // (the kit's own safe layout), so no clipped or overlapping text ever reaches the preview.
    for (let round = 0; round < 3; round++) {
      const issues = (await qa(out).catch(e => { log(`qa could not run, skipped: ${errText(e).slice(0, 200)}`); return []; }))
        .filter(is => !(is.type === 'empty' && is.to - is.from < 0.2)); // a single sampled cut frame, not dead air
      log(`qa round ${round + 1}: ${issues.length} issues${issues.length ? `\n${describe(issues)}` : ''}`);
      if (!issues.length) break;
      const byScene = new Map<number, typeof issues>();
      for (const is of issues) for (const i of scenesOf(is, out.timeline as Obj, scenes.length)) byScene.set(i, [...(byScene.get(i) ?? []), is]);
      if (round === 2) { for (const i of byScene.keys()) { log(`scene ${board.scenes[i]!.name} → plain title (still failing QA)`); scenes[i] = plainScene(board, i, o.words); } }
      else await Promise.all([...byScene].map(async ([i, mine]) => {
        try { scenes[i] = await sceneOps({ board, i, words: o.words, check: check(board.scenes[i]!.name), fix: { ops: scenes[i]!, issues: describe(mine) } }); }
        catch (e) { log(`rewrite ${board.scenes[i]!.name} failed → plain title: ${errText(e).slice(0, 120)}`); scenes[i] = plainScene(board, i, o.words); }
      }));
      out = run(planOf(o.id, o.brand, scenes));
    }
    times.qaTotal = ms(tq);
  }
  writeOut(o, board, scenes, out, log);
  return { board, plan: planOf(o.id, o.brand, scenes), out, times };
}

/** plan.json, board.json, timeline.json, <id>.json and the mixer-safe events.json for a finished set of scenes. */
export function writeOut(o: { dir: string; id: string; brand: string; extra?: KitExtra }, board: Storyboard, scenes: Op[][], out: s1kit.PlanResult, log: (s: string) => void = console.log) {
  const plan = planOf(o.id, o.brand, scenes, {}, o.extra);
  writeFileSync(join(o.dir, 'plan.json'), JSON.stringify(plan, null, 1));
  writeFileSync(join(o.dir, 'board.json'), JSON.stringify(board, null, 1));
  writeFileSync(join(o.dir, 'timeline.json'), JSON.stringify(out.timeline, null, 1));
  writeFileSync(join(o.dir, `${o.id}.json`), JSON.stringify(out.spec));
  const timed = out.events.filter(e => typeof e.t === 'number');
  if (timed.length < out.events.length) log(`dropped ${out.events.length - timed.length} sound cue(s) with no time`);
  // a sound name the owner's map doesn't have falls back to the event's own sound (never a crash in the mixer)
  const map = JSON.parse(readFileSync(join(assetsDir(), 'sfx', 'map.json'), 'utf8')), known = new Set(Object.keys(map.sounds)), evs = new Set(Object.keys(map.events));
  for (const e of timed) {
    // an event name the map doesn't have: a sound name used as the event plays that sound on a pop; anything else is a pop
    if (!evs.has(e.event)) { log(`unknown event "${e.event}" → pop`); if (known.has(e.event) && !e.sound) e.sound = e.event; e.event = 'pop'; }
    if (typeof e.sound === 'string' && !known.has(e.sound)) { log(`unknown sound "${e.sound}" → the ${e.event} default`); delete e.sound; }
  }
  writeFileSync(join(o.dir, 'events.json'), JSON.stringify(timed, null, 1));
}

/** A scene's words as the kit's plain title: one ink line, then the gold serif line (owner rule: never two ink lines). */
export function plainScene(board: Storyboard, i: number, words: Word[]): Op[] {
  const s = board.scenes[i]!, ws = words.slice(s.from, s.to + 1).map(w => w.word), half = Math.ceil(ws.length / 2);
  const a = ws.slice(0, half).join(' '), b = ws.slice(half).join(' ');
  const lines: Op[] = [{ $el: 'ln', args: [a, 440, 600], kw: {} }];
  if (b) lines.push({ $el: 'serif', args: [b, 545, 620], kw: {} });
  // never a bare stage: a burst + the scene's key word on a pill under the title (the owner's coin/pill beat)
  const clean = ws.map(w => w.replace(/[^\p{L}\p{N}%₹$]/gu, ''));
  const key = [...clean].filter(Boolean).sort((x, y) => y.length - x.length)[0] ?? '';
  const chip = key.toUpperCase().slice(0, 14);
  const visuals: Op[] = chip ? [
    // both land on the scene's first word: a key word said late would leave the stage bare until then
    { $el: 'burst', args: [540, 1180, 760, ws[0]], kw: {} },
    { kind: 'image', draw: 'pill', cx: 540, cy: 1180, w: Math.min(860, 140 + chip.length * 40), h: 150, enter: 'glide', p: { text: chip, fill: 'rgba(20,18,23,0.92)' }, rot: -3, _at: ws[0], _off: 4 },
  ] : [];
  return [{ call: 'lines', args: [s.name, lines], kw: { at: ws[0], ...(visuals.length ? { visuals } : {}) } }];
}

/** Which plan scenes an issue belongs to: the layer ids name the kit scene ("s2.3" → scene 2), else the time overlap. */
function scenesOf(is: { ids: string[]; from: number; to: number }, T: Obj, n: number): number[] {
  const fromIds = [...new Set(is.ids.map(id => Number(/^s(\d+)\./.exec(id)?.[1])).filter(i => Number.isInteger(i) && i < n))];
  if (fromIds.length) return fromIds;
  return (T.scenes as Obj[]).map((sc, i) => (is.from * 30 < sc.f1 && is.to * 30 >= sc.f0 ? i : -1)).filter(i => i >= 0 && i < n);
}

/** The owner's s1qa: every 3rd frame's drawn boxes → empty / clipped / overlap / covered, split across 3 pages at once. */
export async function qa(out: s1kit.PlanResult, every = 3, pages = 3) {
  const T = out.timeline as Obj, frames = Array.from({ length: Math.ceil(T.frames / every) }, (_, n) => n * every);
  const spec = meUrls(out.spec), size = Math.ceil(frames.length / pages);
  const parts = await Promise.all(Array.from({ length: pages }, (_, p) => frames.slice(p * size, (p + 1) * size)).filter(c => c.length).map(c => boxes(spec, c, T.fps ?? 30)));
  const bx = parts.flat().sort((a, b) => a.f - b.f);
  return geometry(bx, { fps: T.fps ?? 30, every, format: 'vertical' as never, entering: f => T.scenes.some((sc: Obj) => sc.enter && f >= sc.f0 && f < sc.f0 + 24), platform: null, layer: layerOf(T as never) });
}

/**
 * Nothing can leave the frame: for every camera key a scene has, a layer's on-screen edges are (x − cx)·s + 540, so each
 * title's width and each prop's size is shrunk (and its centre pulled in) until it sits ≥ 60 px inside the 1080 frame at
 * the scene's tightest key. Pure geometry, run on the kit's output, so it holds whatever the planner wrote.
 */
export function fitToFrame(T: Obj, M = 60) {
  let fixed = 0;
  for (const sc of T.scenes as Obj[]) {
    const keys: number[][] = Array.isArray(sc.keys) && sc.keys.length ? sc.keys : [[0, 1, 540, 960]];
    for (const k of keys) if (k[1]! > 1.1) { k[1] = 1.1; fixed++; } // the owner's push is subtle: never past 1.1
    // the half-width a layer centred at x may have so that, at every key, both edges stay inside [M, 1080 − M]
    const room = (x: number) => Math.min(...keys.map(([, s = 1, cx = 540]) => Math.min((x - cx) + (540 - M) / s, (cx - x) + (540 - M) / s)));
    for (const l of sc.layers as Obj[]) {
      if (l.kind === 'line' && typeof l.width === 'number') {
        const x = typeof l.cx === 'number' ? l.cx : 540;
        const half = room(x);
        if (half < 150) { l.cx = 540; } // centred is always safest when the room collapses
        const h2 = room(typeof l.cx === 'number' ? l.cx : 540);
        if (l.width / 2 > h2) { l.width = Math.floor(h2 * 2); fixed++; }
      } else if (l.kind === 'image' && typeof l.cx === 'number' && typeof l.w === 'number' && !l.bleed) {
        let half = room(l.cx);
        if (l.w / 2 > half) {
          if (half < l.w / 2 * 0.75) { l.cx = 540 + Math.sign(l.cx - 540) * Math.max(0, Math.abs(l.cx - 540) - (l.w / 2 - half)); half = room(l.cx); }
          if (l.w / 2 > half) { const r = (half * 2) / l.w; l.w = Math.floor(l.w * r); if (typeof l.h === 'number') l.h = Math.floor(l.h * r); }
          fixed++;
        }
      }
    }
  }
  return fixed;
}

/** Container props must carry real content (no empty panel/receipt/chat box): returns a message, or null. */
const CONTAINERS = new Set(['panel', 'receipt', 'chat', 'laptop', 'lockphone', 'reelui', 'nle', 'file', 'dropzone', 'row', 'dict', 'sticker', 'voice', 'wave', 'capt']);
const STYLE = new Set(['color', 'fill', 'rot', 'scale', 'glow', 'shadow', 'tilt', 'accent', 'bg', 'dark', 'float']);
export function emptyProps(ops: unknown): string | null {
  const bad: string[] = [];
  const walk = (v: unknown) => {
    if (Array.isArray(v)) return v.forEach(walk);
    if (!v || typeof v !== 'object') return;
    const o = v as Obj;
    if (o.kind === 'image' && typeof o.draw === 'string') {
      const content = Object.keys(o.p ?? {}).filter(k => !STYLE.has(k));
      if ((CONTAINERS.has(o.draw) && content.length < 2) || (!CONTAINERS.has(o.draw) && !['loupe', 'zzz', 'shield', 'ring', 'marker', 'brackets', 'sky', 'asterisk'].includes(o.draw) && content.length < 1)) bad.push(`${o.draw} (p: ${JSON.stringify(o.p ?? {})})`);
    }
    Object.values(o).forEach(walk);
  };
  walk(ops);
  return bad.length ? `These props are empty boxes: ${bad.join('; ')}. Fill each with its real content (the prop's params from the list: rows/items/lines/text/msgs…), at least 2 content fields for a panel, receipt, chat or screen.` : null;
}
