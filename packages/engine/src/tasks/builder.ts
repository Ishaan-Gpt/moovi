import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { CRAFT, craft as C, project as P, run as runQ } from '@moovi/graph';
import { kit, kitDocs, type Kit, type SceneProgram, type TLine, type Timeline } from '@moovi/skills';
import { z } from 'zod';
import { readJson, writeJson } from '../bench';
import type { Handler, TaskCtx } from '../ctx';
import { boxes, still } from '../render/host';
import { describe, geometry, layerOf, platformZone, type Issue } from '../render/qa';
import { tool, type Tool } from '../runtime';
import { agentRun, knowledge, systemFor } from './agent';
import { filmKit, type AssetOut, type Board } from './film';
import type { Beat, Script } from './script';

/**
 * The Shot Builder builds ONE scene: it writes a scene program on the full kit (presets, every layer kind, every
 * drawn prop, camera keys, sounds), looks at real rendered stills of its own scene, runs the scene's QA (the
 * renderer's own boxes: no empty frame, no clipped or overlapping text) and the laws it owns, and fixes until clean.
 * Every scene has its own Shot Builder, and they all work at once. The engine runs the checks itself before it
 * accepts "done". Out of budget, the scene falls back to a deterministic preset program, so the film still ships.
 */
export interface SceneCheck { ok: boolean; blocking: string[]; notes: string[]; qa: Issue[] }

type LawRow = { n: number; checks: { kind: string; params: string; blocking: boolean }[] };
export async function checkParams(style: string) {
  const laws = await runQ<LawRow>(CRAFT, C.lawsAndChecks, { style });
  const by = new Map<string, { p: Record<string, number | string | boolean>; blocking: boolean }>();
  for (const l of laws) for (const c of l.checks) by.set(c.kind, { p: JSON.parse(c.params || '{}'), blocking: c.blocking });
  return by;
}

/** The checks one scene owns: geometry from the renderer, then the laws a Shot Builder answers for. */
export async function checkScene(k: Kit, i: number, compiled: ReturnType<Kit['compile']>, style: string, every = 2): Promise<SceneCheck> {
  const params = await checkParams(style);
  const prev = k.preview(i, compiled);
  const sc = prev.timeline.scenes[0]!;
  const [f0, f1] = prev.range;
  const frames = Array.from({ length: Math.ceil((f1 - f0) / every) }, (_, n) => f0 + n * every).filter(f => f < f1);
  const bx = await boxes(prev.spec, frames, prev.timeline.fps);
  const qa = geometry(bx, { fps: prev.timeline.fps, every, format: k.o.format, entering: f => !!sc.enter && f < f0 + 24, platform: platformZone(params.get('safeZone')?.p), layer: layerOf(prev.timeline) });
  const blocking: string[] = [], notes: string[] = [];
  const push = (kind: string, msg: string) => ((params.get(kind)?.blocking ?? true) ? blocking : notes).push(msg);
  const geo = qa.filter(q => q.type !== 'covered'), covered = qa.filter(q => q.type === 'covered');
  if (geo.length) push('geometry', `QA:\n${describe(geo)}`);
  // the same zone Lens judges the film by: Instagram, TikTok and Shorts draw their own UI over these parts of a reel
  if (covered.length) push('safeZone', `Text under the app's own UI:\n${describe(covered)}`);
  const lines = sc.layers.filter((l): l is TLine & { fixed?: boolean } => l.kind === 'line');
  const ll = params.get('lineLength')?.p ?? { chars: 26, words: 5 };
  for (const L of lines) { const t = L.words.map(w => w.w).join(' '); if (t.length > Number(ll.chars) || L.words.length > Number(ll.words)) push('lineLength', `The line "${t}" is too long for the screen (max ${ll.chars} characters, ${ll.words} words): carry key words only.`); }
  const serif = lines.filter(L => L.italic && L.gradient).length;
  if (params.has('serifPerScene') && serif > Number(params.get('serifPerScene')!.p.max ?? 1)) push('serifPerScene', `${serif} serif accent lines; at most one per scene.`);
  // a visual in every scene, and early: the stage is never bare text for longer than the law allows
  if (params.has('visualPerScene')) {
    const max = Number(params.get('visualPerScene')!.p.max ?? 1.5), fv = kit.firstVisual(sc.layers as never, f0);
    if ((f1 - f0) / 30 > max && fv === null) push('visualPerScene', `A text-only scene longer than ${max} s: give it a visual (a prop, an asset, a UI moment).`);
    else if (fv !== null && (Math.min(fv, f1) - f0) / 30 > max) push('visualPerScene', `The stage is bare text for ${((fv - f0) / 30).toFixed(1)} s before the first visual (max ${max} s): bring one in on an early word (by ${((f0 + max * 30) / 30).toFixed(1)} s).`);
  }
  const keys = sc.keys ?? [];
  const moves = keys.length > 1 && keys.some((kk, j) => j && (kk[1] !== keys[0]![1] || kk[2] !== keys[0]![2] || kk[3] !== keys[0]![3]));
  if (params.has('motion') && !moves) push('motion', 'The camera never moves in this scene.');
  const sw = k.scenes[i]!.words.map(w => w.n), shown = lines.flatMap(L => L.words.map(w => kit.norm(w.w))).filter(Boolean);
  const matched = kit.lcs(shown, sw).length, min = Number(params.get('voiceLocked')?.p.min ?? 0.9);
  if (shown.length && matched / shown.length < min) push('voiceLocked', `Only ${matched} of ${shown.length} shown words are spoken in this scene, in order. Show words the voice says here.`);
  if (!shown.length && k.scenes[i]!.words.length > 3) notes.push('No words on screen in this scene: is that deliberate?');
  // dead air: the longest stretch of this scene (from its cut to the next) where nothing new appears or sounds
  if (params.has('deadAir')) {
    const fps = prev.timeline.fps, max = Number(params.get('deadAir')!.p.max ?? 1.6);
    // the film's last scene ends on its ask: the hold after it is not dead air
    const ts = [f0 / fps, ...prev.events.map(e => e.t).filter(t => t >= f0 / fps && t <= f1 / fps), ...(i < k.scenes.length - 1 ? [f1 / fps] : [])].sort((a, b) => a - b);
    let gap = 0, at = 0;
    for (let j = 1; j < ts.length; j++) if (ts[j]! - ts[j - 1]! > gap) { gap = ts[j]! - ts[j - 1]!; at = ts[j - 1]!; }
    if (gap > max) {
      const said = k.scenes[i]!.words.filter(w => w.f / fps > at && w.f / fps < at + gap).map(w => w.w).join(' ');
      push('deadAir', `Nothing new for ${gap.toFixed(2)} s from ${at.toFixed(2)} s (max ${max} s)${said ? `, while the voice says "${said}"` : ', in a pause of the voice'}. Land something on a word in that stretch: an element entering, a card, a callout, a counter or a camera punch with its sfx.`);
    }
  }
  return { ok: !blocking.length, blocking, notes, qa };
}

export function fallbackProgram(beat: Beat, shot: Board['shots'][number] | undefined, isLast: boolean, keyword: string | null): SceneProgram {
  const words = beat.say.replace(/[“”"]/g, '').split(/\s+/).filter(Boolean);
  const head = words.slice(0, Math.min(4, words.length)).join(' ');
  const tail = words.length > 6 ? words.slice(-3).join(' ').replace(/[.,!?]$/, '') : '';
  if ((beat.role === 'cta' || isLast) && keyword) return { name: 'cta', preset: { id: 'cta_comment', keyword, bubble: 'Sent! Check your DMs' } };
  if (beat.role === 'list' && words.length > 8) {
    const parts = beat.say.split(/[,;]|\band\b/).map(s => s.trim().split(/\s+/).slice(0, 4).join(' ')).filter(Boolean).slice(0, 4);
    if (parts.length >= 2) return { name: 'list', preset: { id: 'list_left', lines: parts } };
  }
  const lines = tail ? [head, `*${tail.toUpperCase()}*`] : [head];
  return { name: shot?.hero?.slice(0, 30) || beat.role, preset: lines.length > 1 ? { id: 'stack_slam', lines } : { id: 'lines', lines, burst: true } };
}

export const build: Handler = async ctx => {
  const { scene: i } = ctx.input<{ scene: number }>();
  const F = await filmKit(ctx);
  const k = F.kit;
  const BD = (await ctx.out<Board>('board'))!;
  const brief = await ctx.out<{ cta: { kind: string; keyword: string | null } }>('plan');
  const shot = BD.shots[i], beat = F.script.beats[i]!;
  const sf = k.scenes[i]!;
  const know = await knowledge(ctx, 'builder', F.style);
  const zone = k.o.format === 'vertical' ? platformZone((await checkParams(F.style)).get('safeZone')?.p) : null;
  const file = join(ctx.dir, 'scenes', `${i}.json`);
  const inp = ctx.input<{ scene: number; previous?: string | null; feedback?: string }>();
  const prevFile = existsSync(file) ? file : inp.previous && existsSync(inp.previous) ? inp.previous : null;
  const previous = prevFile ? readJson<SceneProgram>(prevFile) : null;
  const fs = await import('node:fs');
  type Last = { program: SceneProgram; compiled: ReturnType<Kit['compile']>; check?: SceneCheck };
  const st: { last: Last | null } = { last: null };
  let looked = 0;

  const assetList = [...F.assets.values()].filter(a => !a.id.startsWith('corner')).map((a: AssetOut) => `asset:${a.id} — ${a.kind}, ${a.w}×${a.h}: ${a.about}`);
  const uploadList = [...F.uploads.keys()].map(u => `upload:${u}`);
  const ctxText = () => JSON.stringify({
    scene: i + 1, of: k.scenes.length, role: beat.role, says: beat.say,
    frames: { cut: 0, end: sf.f1 - sf.f0, seconds: +((sf.f1 - sf.f0) / 30).toFixed(2) },
    spoken: sf.words.map((w, n) => ({ i: n, word: w.w, at: w.f - sf.f0 })),
    canvas: { w: k.W, h: k.H, format: k.o.format },
    stage: { font: F.stage.font, ink: F.stage.ink, accent: F.stage.accent, paper: F.stage.stage, serif: F.stage.serif.font, corners: F.stage.corners.length ? 'two corner assets: keep text out of top-left 20–330 × 60–370 and bottom-right 760–1060 × 1560–1860' : 'none',
      appUI: zone ? `Instagram, TikTok and Shorts draw their own UI over the reel: keep every word (lines, pills, fields) above y ${1920 - zone.bottom}, and left of x ${1080 - zone.rail} below y ${zone.railTop}` : 'none' },
    shot, before: BD.shots[i - 1]?.idea ?? null, after: BD.shots[i + 1]?.idea ?? null,
    assets: assetList, uploads: uploadList,
  }, null, 1);

  const write = async (program: unknown) => {
    const compiled = k.compile(i, program, { strict: true });
    st.last = { program: program as SceneProgram, compiled };
    writeJson(file, program);
    await ctx.q(P.saveScene, { run: ctx.run.id, id: `${ctx.run.id}:scene:${i}`, i, program: JSON.stringify(program), agent: 'builder', at: Date.now(), qa: null });
    return compiled;
  };
  const tools: Tool[] = [
    tool({ name: 'write_scene', description: 'Write (or rewrite) this scene’s program. It is compiled at once; errors come back to fix. Every call replaces the last program.', input: { program: z.record(z.string(), z.unknown()).describe('the scene program (see THE KIT)') },
      async run({ program }) {
        const c = await write(program);
        const layers = c.scene.layers.map(l => l.kind === 'line' ? `line "${l.words.map(w => w.w).join(' ')}"` : l.kind === 'image' ? `${l.draw ?? (l.browser !== undefined ? 'browser' : l.card ? 'card' : 'image')}@${l.f}` : l.kind).join(', ');
        return { text: `Compiled: ${c.scene.layers.length} layers (${layers}); frames ${sf.f0}–${sf.f1}. Now look at it.` };
      } }),
    tool({ name: 'look', description: 'Render stills of your scene (frames after the cut; default 4 across the scene). See exactly what the viewer sees.', input: { at: z.array(z.number().min(0)).max(6).optional() },
      async run({ at }) {
        if (!st.last) return { error: 'Write the scene first.' };
        const pv = k.preview(i, st.last.compiled);
        const len = sf.f1 - sf.f0;
        const fr = (at?.length ? at : [6, Math.round(len * 0.35), Math.round(len * 0.65), Math.max(0, len - 8)]).map(x => Math.min(len - 1, Math.round(x)));
        const images = [];
        for (const f of fr) images.push({ data: (await still(pv.spec, (sf.f0 + f + 0.5) / 30, 0.33)).png, mime: 'image/png' as const });
        looked++;
        ctx.note(`looking at scene ${i + 1}`);
        return { text: `Stills at frames ${fr.join(', ')} after the cut (of ${len}).`, images };
      } }),
    tool({ name: 'check', description: 'Run this scene’s QA (renderer boxes: empty / clipped / overlap / under the app’s own UI) and the laws you own. Fix everything blocking.', input: {},
      async run() {
        if (!st.last) return { error: 'Write the scene first.' };
        ctx.note(`checking scene ${i + 1}`);
        const r = await checkScene(k, i, st.last.compiled, F.style);
        st.last.check = r;
        return { text: r.ok ? `Clean.${r.notes.length ? ` Notes: ${r.notes.join(' ')}` : ''}` : `Blocking:\n- ${r.blocking.join('\n- ')}${r.notes.length ? `\nNotes: ${r.notes.join(' ')}` : ''}` };
      } }),
    tool({ name: 'finish', description: 'Done: only after you looked at the stills and check() is clean. The engine re-checks.', input: { note: z.string().max(200) }, ends: true,
      async run() {
        if (!st.last) return { error: 'Write the scene first.' };
        if (!looked) return { error: 'Look at your scene before you finish.' };
        const r = await checkScene(k, i, st.last.compiled, F.style);
        st.last.check = r;
        return r.ok ? { text: 'Accepted.' } : { error: `Not yet:\n- ${r.blocking.join('\n- ')}` };
      } }),
  ];
  const fb = ctx.task.feedback ?? inp.feedback ?? null;
  const feedback = fb ? `\n\n${ctx.task.feedback ? 'LENS SENT THIS SCENE BACK' : 'THE USER ASKED FOR A CHANGE'}: ${fb}\nTHE LAST PROGRAM OF THIS SCENE (start from it):\n${JSON.stringify(previous)}` : '';
  const run = await agentRun(ctx, { role: 'builder', tier: 'crew', escalate: true, tools, maxTurns: 30, deadlineMs: 12 * 60_000,
    system: systemFor('builder', 'Build your one scene so it looks hand-made by a senior motion designer: dense, alive, every element entering on its spoken word, the camera always moving. Write → look → check → fix → finish.', know.text) + `\n\n${kitDocs(k.o.format)}`,
    prompt: `YOUR SCENE:\n${ctxText()}${feedback}` }).catch(async e => { await ctx.activity('note', `builder stopped: ${(e as Error).message.slice(0, 160)}`); return null; });

  let used: 'agent' | 'fallback' = 'agent';
  let final: Last | null = st.last;
  if (!final?.check?.ok) {
    // the engine's own verdict on what the agent left, then the deterministic fallback if that is worse
    let agentCheck: SceneCheck | null = null;
    if (final) agentCheck = final.check ?? await checkScene(k, i, final.compiled, F.style);
    const fbProg = fallbackProgram(beat, shot, i === k.scenes.length - 1, brief?.cta.kind === 'comment' ? brief.cta.keyword : null);
    let fb: { program: SceneProgram; compiled: ReturnType<Kit['compile']>; check: SceneCheck } | null = null;
    try { const c = k.compile(i, fbProg); fb = { program: fbProg, compiled: c, check: await checkScene(k, i, c, F.style) }; } catch { fb = null; }
    if (!final || (fb && (!agentCheck || (fb.check.ok && !agentCheck.ok)))) { final = fb; used = 'fallback'; await write(fbProg); }
    else final.check = agentCheck!;
  }
  if (!final) throw new Error(`Scene ${i + 1} could not be built`);
  const c = final.check!;
  await ctx.q(P.saveScene, { run: ctx.run.id, id: `${ctx.run.id}:scene:${i}`, i, program: JSON.stringify(final.program), agent: used === 'agent' ? 'builder' : 'editor', at: Date.now(), qa: JSON.stringify({ ok: c.ok, blocking: c.blocking, notes: c.notes }) });
  void readFileSync; void fs;
  return { output: { scene: i, program: file, used, ok: c.ok, blocking: c.blocking, turns: run?.turns ?? 0, model: run?.model ?? null, stopped: run?.stopped ?? 'error' }, note: `${used === 'agent' ? (c.ok ? 'clean' : `${c.blocking.length} open`) : 'fallback preset'}${run ? ` · ${run.turns} turns` : ''}` };
};

export type { Timeline };
