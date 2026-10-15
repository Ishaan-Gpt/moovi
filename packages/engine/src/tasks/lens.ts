import { readFileSync } from 'node:fs';
import { visualOn, visualReview } from '../visual/crew';
import { join } from 'node:path';
import { CRAFT, craft as C, project as P, run as runQ } from '@moovi/graph';
import { kit, type EngineSpec, type Ev, type TLine, type Timeline } from '@moovi/skills';
import { z } from 'zod';
import { artifacts, loudness, readJson, writeJson } from '../bench';
import type { Handler, TaskCtx } from '../ctx';
import { newId } from '../ids';
import { sheet } from '../render/sheet';
import type { Issue, PlatformZone } from '../render/qa';
import { tool, type Tool } from '../runtime';
import { agentRun, knowledge, systemFor } from './agent';
import { filmKit } from './film';

/**
 * Lens reviews the finished film. The engine runs every machine check the style's laws name (thresholds from the
 * craft graph) over the real outputs; Lens adds its eyes on a 16-frame contact sheet and raises what the checks
 * can't see. Blocking problems in a scene go back to that scene's Shot Builder only (its scene, the chunks that show
 * it, the mix): at most two rounds, then the film ships with notes.
 */
export interface CheckResult { kind: string; law: number; ok: boolean; blocking: boolean; owner: string; text: string; scenes: number[] }

export async function filmChecks(ctx: TaskCtx, style: string): Promise<CheckResult[]> {
  const laws = await runQ<{ n: number; checks: { kind: string; params: string; blocking: boolean }[] }>(CRAFT, C.lawsAndChecks, { style });
  const A = (await ctx.out<{ spec: string; events: string; qaFile: string }>('assemble'))!;
  const T = readJson<EngineSpec>(A.spec).props.timeline as Timeline;
  const events = readJson<Ev[]>(A.events);
  const Q = readJson<{ issues: Issue[]; platform?: PlatformZone | null }>(A.qaFile);
  const qa = Q.issues.filter(q => q.type !== 'covered'), covered = Q.issues.filter(q => q.type === 'covered');
  const snd = await ctx.out<{ lufs?: number; peak?: number; master: string | null }>('sound');
  const mx = await ctx.out<{ file: string; duration: number }>('mux');
  const claims = await ctx.q<{ status: string; beat: number }>(P.claims, { run: ctx.run.id });
  const F = await filmKit(ctx);
  const sceneAt = (t: number) => Math.max(0, T.scenes.findIndex(s => t * 30 >= s.f0 && t * 30 < s.f1));
  const out: CheckResult[] = [];
  for (const l of laws) for (const c of l.checks) {
    const p = JSON.parse(c.params || '{}') as Record<string, number | string>;
    const owner = String(p.owner ?? 'builder');
    const R = (ok: boolean, text: string, scenes: number[] = []) => out.push({ kind: c.kind, law: l.n, ok, blocking: c.blocking, owner, text, scenes });
    const lines = (sc: Timeline['scenes'][number]) => sc.layers.filter((x): x is TLine => x.kind === 'line');
    switch (c.kind) {
      case 'voiceLocked': {
        const bad: number[] = []; let shown = 0, hit = 0;
        T.scenes.forEach((sc, i) => { const s = lines(sc).flatMap(L => L.words.map(w => kit.norm(w.w))).filter(Boolean); const h = kit.lcs(s, F.kit.scenes[i]!.words.map(w => w.n)).length; shown += s.length; hit += h; if (s.length && h / s.length < Number(p.min ?? 0.9)) bad.push(i); });
        R(!bad.length, `${hit}/${shown} shown words are spoken in their scene`, bad); break;
      }
      case 'hookTime': { const f = Math.min(...T.scenes.flatMap(sc => lines(sc).map(L => L.words[0]!.f)), 1e9) / 30; R(f <= Number(p.max ?? 2), `first word at ${f.toFixed(2)} s`, f > Number(p.max ?? 2) ? [0] : []); break; }
      case 'lineLength': { const bad = T.scenes.map((sc, i) => (lines(sc).some(L => L.words.map(w => w.w).join(' ').length > Number(p.chars ?? 26) || L.words.length > Number(p.words ?? 5)) ? i : -1)).filter(i => i >= 0); R(!bad.length, bad.length ? `long lines in scene ${bad.map(i => i + 1).join(', ')}` : 'every line is short', bad); break; }
      case 'serifPerScene': { const bad = T.scenes.map((sc, i) => (lines(sc).filter(L => L.italic && L.gradient).length > Number(p.max ?? 1) ? i : -1)).filter(i => i >= 0); R(!bad.length, bad.length ? `more than one serif line in scene ${bad.map(i => i + 1).join(', ')}` : 'one serif accent at most per scene', bad); break; }
      case 'corners': { const n = T.backdrop?.corners?.length ?? 0; R(n >= Number(p.n ?? 2), `${n} corner asset${n === 1 ? '' : 's'}`); break; }
      case 'geometry': { const sc = [...new Set(qa.map(q => sceneAt(q.from)))]; R(!qa.length, qa.length ? qa.slice(0, 6).map(q => `${q.type} ${q.from}–${q.to} s: ${q.what}`).join('; ') : 'no empty, clipped or overlapping frames', sc); break; }
      case 'safeZone': {
        // the Shot Builder's own rule, on the assembled film's boxes, with the zone qa.json was measured against
        const z = Q.platform;
        if (F.format !== 'vertical') { R(true, 'not a vertical video'); break; }
        if (!z) { R(true, 'not measured: this film was assembled before the safe-zone rule'); break; }
        R(!covered.length, covered.length ? covered.slice(0, 6).map(q => `${q.from}–${q.to} s: ${q.what}`).join('; ') : `no text under the app's UI (bottom ${z.bottom} px; right ${z.rail} px below y ${z.railTop})`, [...new Set(covered.map(q => sceneAt(q.from)))]);
        break;
      }
      case 'deadAir': {
        const ts = [...new Set(events.map(e => e.t))].sort((a, b) => a - b); let gap = 0, at = 0;
        for (let j = 1; j < ts.length; j++) if (ts[j]! - ts[j - 1]! > gap) { gap = ts[j]! - ts[j - 1]!; at = ts[j - 1]!; }
        R(gap <= Number(p.max ?? 1.6), `longest stretch without a new event: ${gap.toFixed(2)} s at ${at.toFixed(1)} s`, gap > Number(p.max ?? 1.6) ? [sceneAt(at)] : []); break;
      }
      case 'ctaTail': { const lastSc = T.scenes.at(-1)!; const ok = lastSc.layers.some(x => x.kind === 'comment' || x.kind === 'typebox' || x.kind === 'cursor') || lines(lastSc).some(L => /comment|link|follow|try|get|start|join|download|visit/i.test(L.words.map(w => w.w).join(' '))); R(ok, ok ? 'ends on the ask' : 'the last scene is not the ask', ok ? [] : [T.scenes.length - 1]); break; }
      case 'truth': { const bad = claims.filter(x => x.status !== 'ok'); R(!bad.length, `${claims.length - bad.length}/${claims.length} claims passed the truth guard`); break; }
      case 'motion': { const bad = T.scenes.map((sc, i) => { const k = sc.keys ?? []; return k.length > 1 && k.some((x, j) => j && (x[1] !== k[0]![1] || x[2] !== k[0]![2] || x[3] !== k[0]![3])) ? -1 : i; }).filter(i => i >= 0); R(!bad.length, bad.length ? `static camera in scene ${bad.map(i => i + 1).join(', ')}` : 'the camera moves in every scene', bad); break; }
      case 'visualPerScene': {
        // the same rule as the Shot Builder's check: a visual in every scene, arriving within the limit
        const max = Number(p.max ?? 1.5);
        const bad = T.scenes.map((sc, i) => { const fv = kit.firstVisual(sc.layers as never, sc.f0); return ((sc.f1 - sc.f0) / 30 > max && (fv === null || (Math.min(fv, sc.f1) - sc.f0) / 30 > max)) ? i : -1; }).filter(i => i >= 0);
        R(!bad.length, bad.length ? `bare text (no visual within ${max} s) in scene ${bad.map(i => i + 1).join(', ')}` : 'every scene has a visual, early', bad); break;
      }
      case 'loudness': {
        if (snd?.lufs === undefined) { R(true, 'no sound mixed (no bench)'); break; }
        // measured on what the user downloads (after the AAC encode), not on the WAV master
        const L = mx ? await loudness(mx.file) : { lufs: snd.lufs, peak: snd.peak ?? 0 };
        R(Math.abs(L.lufs - Number(p.target ?? -14)) <= Number(p.tol ?? 0.5) && L.peak <= Number(p.peak ?? -1) + 0.05, `delivered ${L.lufs.toFixed(1)} LUFS, true peak ${L.peak.toFixed(1)} dBTP`); break;
      }
      case 'sfxRate': { const r = events.length / (T.frames / 30); R(r >= Number(p.min ?? 2) && r <= Number(p.max ?? 3.5), `${r.toFixed(2)} sound events a second`); break; }
      case 'risers': { const n = events.filter(e => e.event === 'build' || e.event === 'big-build').length; R(n <= Number(p.max ?? 2), `${n} riser${n === 1 ? '' : 's'}`); break; }
      case 'artifacts': {
        if (!mx) { R(true, 'not rendered'); break; }
        const a = await artifacts(mx.file); const black = a.black.filter(([s, e]) => e - s > 0.3), frozen = a.frozen.filter(([s, e]) => e - s > 1.5);
        const lenOk = Math.abs(mx.duration - T.frames / 30) < 0.25;
        R(!black.length && !frozen.length && lenOk, `${black.length} black run(s), ${frozen.length} frozen run(s), length ${mx.duration.toFixed(2)} s of ${(T.frames / 30).toFixed(2)} s`, [...black, ...frozen].map(([s]) => sceneAt(s))); break;
      }
      case 'captions': { R(true, 'checked by eye'); break; }
      case 'vision': break; // Lens's own eyes
    }
  }
  return out;
}

export const review: Handler = async ctx => {
  if (visualOn()) return visualReview(ctx);
  const m = (await ctx.out<{ style: string }>('match'))!;
  const know = await knowledge(ctx, 'lens', m.style);
  const spec = readJson<EngineSpec>((await ctx.out<{ spec: string }>('assemble'))!.spec);
  const T = spec.props.timeline as Timeline;
  const dur = T.frames / 30;
  ctx.note('checking the laws');
  const results = await filmChecks(ctx, m.style);
  const raised: { scene: number; text: string; blocking: boolean; law: number | null }[] = [];
  let looked = false, score: number | null = null, summary = '';
  const close = new Set<number>(); // scenes Lens has looked at up close
  const tools: Tool[] = [
    tool({ name: 'checks', description: 'The machine checks over the finished film (each names its law).', input: {}, async run() { return { text: results.map(r => `${r.ok ? 'PASS' : r.blocking ? 'FAIL' : 'NOTE'} law ${r.law} ${r.kind}: ${r.text}${r.scenes.length ? ` (scene ${r.scenes.map(s => s + 1).join(', ')})` : ''}`).join('\n') }; } }),
    tool({ name: 'sheet', description: 'The contact sheet: 16 stills across the film, in order.', input: {},
      async run() { const times = Array.from({ length: 16 }, (_, j) => +((j + 0.5) * dur / 16).toFixed(2)); const s = await sheet(spec, times, join(ctx.dir, 'review'), { scale: 0.22, cols: 8, name: 'film' }); looked = true; return { text: `Stills at ${times.join(', ')} s; scenes start at ${T.scenes.map(sc => (sc.f0 / 30).toFixed(1)).join(', ')} s.`, images: [{ data: readFileSync(s.sheet).toString('base64'), mime: 'image/png' }] }; } }),
    tool({ name: 'scene', description: 'Four stills of one scene, large enough to judge text, spacing and edges (the contact sheet is not).', input: { scene: z.number().int().min(1).max(T.scenes.length) },
      async run({ scene }) { const sc = T.scenes[scene - 1]!; const len = sc.f1 - sc.f0; const times = [6, len * 0.35, len * 0.65, len - 8].map(f => +((sc.f0 + Math.max(0, f)) / 30).toFixed(2)); const s = await sheet(spec, times, join(ctx.dir, 'review'), { scale: 0.45, cols: 2, name: `scene${scene}` }); close.add(scene - 1); return { text: `Scene ${scene}: ${times.join(', ')} s (left to right, top to bottom)`, images: [{ data: readFileSync(s.sheet).toString('base64'), mime: 'image/png' }] }; } }),
    tool({ name: 'raise_issue', description: 'Raise a problem you can see in one scene. Blocking = it must be fixed before this ships (overlaps, empty or broken frames, unreadable text, off-brief). It goes to that scene’s Shot Builder, who can change only the picture of that scene: the mix, loudness, claims and corners are machine-checked elsewhere, so leave them to the checks.', input: { scene: z.number().int().min(1).max(T.scenes.length), text: z.string().min(8).max(400), blocking: z.boolean(), law: z.number().int().nullable() },
      async run({ scene, text, blocking, law }) {
        // the sheet is too small for type: words and gaps shrink to a few pixels there, so spacing calls need a close look
        if (/\b(touch\w*|collid\w*|no space|spacing|kerning|run together|joined|merged|squash\w*|cramped)\b/i.test(text) && !close.has(scene - 1))
          return { error: `Look at scene ${scene} up close first (the scene tool): on the contact sheet words and their gaps are a few pixels wide, too small to judge spacing.` };
        // a Shot Builder can't fix what isn't in its scene's picture: those stay notes
        const elsewhere = /\b(LUFS|loudness|true peak|limiter|dBTP|the mix|truth guard|claims?)\b/i.test(text);
        raised.push({ scene: scene - 1, text, blocking: blocking && !elsewhere, law });
        return { text: elsewhere ? 'Noted (not a scene problem: it goes in the notes, not to the Shot Builder).' : 'Raised.' };
      } }),
    tool({ name: 'finish', description: 'Your verdict: a score out of 10 against the laws and the brief, and one honest sentence.', input: { score: z.number().min(0).max(10), summary: z.string().min(8).max(300) }, ends: true,
      async run(a) { if (!looked) return { error: 'Look at the contact sheet first.' }; score = a.score; summary = a.summary; return { text: 'ok' }; } }),
  ];
  await agentRun(ctx, { role: 'lens', tier: 'director', tools, maxTurns: 16, deadlineMs: 6 * 60_000,
    system: systemFor('lens', 'Review the finished film like the owner would: never by the rules alone. Read the checks, look at the sheet (and any scene up close), raise real problems per scene, then give your verdict.', know.text),
    prompt: `The film: ${dur.toFixed(1)} s, ${T.scenes.length} scenes. Review it.` }).catch(async e => { await ctx.activity('note', `Lens stopped: ${(e as Error).message.slice(0, 160)}`); });

  // the verdict: blocking failures a Shot Builder owns go back, scoped to their scenes, for at most two rounds
  for (const old of await ctx.q<{ id: string }>(P.openIssues, { run: ctx.run.id })) await ctx.q(P.resolveIssue, { id: old.id, at: Date.now(), how: 're-reviewed' });
  const failing = results.filter(r => !r.ok);
  for (const r of failing) await ctx.q(P.raiseIssue, { run: ctx.run.id, owner: ['builder', 'scribe', 'director', 'hunter', 'lens'].includes(r.owner) ? r.owner : 'lens', id: newId('i'), kind: r.kind, law: r.law, scope: r.scenes.length ? `scene:${r.scenes[0]}` : null, text: r.text, at: Date.now(), blocking: r.blocking });
  for (const x of raised) await ctx.q(P.raiseIssue, { run: ctx.run.id, owner: 'builder', id: newId('i'), kind: 'vision', law: x.law, scope: `scene:${x.scene}`, text: x.text, at: Date.now(), blocking: x.blocking });
  const back = new Map<number, string[]>();
  for (const r of failing.filter(r => r.blocking && r.owner === 'builder')) for (const s of r.scenes) back.set(s, [...(back.get(s) ?? []), `law ${r.law} (${r.kind}): ${r.text}`]);
  for (const x of raised.filter(r => r.blocking)) back.set(x.scene, [...(back.get(x.scene) ?? []), `Lens: ${x.text}`]);
  const round = (ctx.task.reopened ?? 0) + 1;
  const notes = [...failing.filter(r => !r.blocking || r.owner !== 'builder').map(r => `${r.kind}: ${r.text}`), ...raised.filter(r => !r.blocking).map(r => `scene ${r.scene + 1}: ${r.text}`)];
  writeJson(join(ctx.dir, `review-${round}.json`), { results, raised, score, summary });
  if (back.size && round <= 2) {
    const scenes = [...back.keys()].sort((a, b) => a - b);
    const renders = await ctx.q<{ id: string; scope: string }>(P.tasksOf, { run: ctx.run.id, kinds: ['render'] });
    const ranges = scenes.map(s => [T.scenes[s]!.f0, T.scenes[s]!.f1] as const);
    const chunks = renders.filter(r => { const [a, b] = r.scope.replace('frames:', '').split('-').map(Number) as [number, number]; return ranges.some(([f0, f1]) => f0 < b && a < f1); }).map(r => r.id.slice(ctx.run.id.length + 1));
    const keys = [...scenes.map(s => `build:${s}`), 'assemble', ...chunks, 'sound', 'mux', 'review'];
    await ctx.say(`Sending scene${scenes.length > 1 ? 's' : ''} ${scenes.map(s => s + 1).join(', ')} back to the Shot Builder${score !== null ? ` (${score}/10 so far)` : ''}: ${[...back.values()].flat()[0]?.slice(0, 160)}`, 'note');
    // the worker records this review, then re-opens exactly these tasks before anything downstream can start
    return { output: { score, summary, notes, sentBack: scenes, round }, reopen: { keys, feedback: Object.fromEntries(scenes.map(s => [`build:${s}`, back.get(s)!.join('\n')])) }, note: `round ${round}: ${scenes.length} scene${scenes.length > 1 ? 's' : ''} back` };
  }
  if (back.size) notes.unshift(...[...back].map(([s, t]) => `scene ${s + 1} still: ${t[0]}`));
  return { output: { score, summary, notes: notes.slice(0, 6), sentBack: [], round }, note: score !== null ? `${score}/10` : 'reviewed' };
};
