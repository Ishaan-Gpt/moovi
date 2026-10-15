import { sttAvailable, transcribeWords } from '../audio/stt';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { project as P } from '@moovi/graph';
import { features, INTENTS, match, PACKAGES, type Features, type Match, type UploadProbe } from '@moovi/skills';
import { z } from 'zod';
import { cutRate, ensureDir, faceRatio, probe, sh } from '../bench';
import { config } from '../config';
import type { Handler, TaskCtx } from '../ctx';
import { publish } from '../bus';
import { ask } from '../runtime';
import type { TaskSpec } from '../scheduler';
import { feedbackMemory } from './agent';
import { steerStyle } from '../memory';

/**
 * Intake and match: deterministic first. The brief is read with rules, every upload is measured (length, size,
 * speech rate, faces, cut rate), and the result is scored against the style signatures in the craft graph. A model
 * is asked only for the brief's intent when it names none; the user is asked only when an upload is ambiguous.
 */
export interface Upload { id: string; name: string; path: string; mime: string; size: number; sha: string; probe?: string | null; role?: string | null }

export const intake: Handler = async ctx => {
  const req = ctx.run.request as { text?: string; ratio?: 'auto' | '9:16' | '16:9' | '1:1' | '4:5'; uploads?: string[] };
  const all = await ctx.q<Upload>(P.uploads, { chat: ctx.chat });
  const ups = all.filter(u => !req.uploads?.length || req.uploads.includes(u.id));
  const probes: UploadProbe[] = [];
  for (const u of ups) {
    ctx.note('measuring your upload');
    const p: UploadProbe = { id: u.id, name: u.name, mime: u.mime };
    try {
      const pr = await probe(u.path);
      Object.assign(p, { duration: pr.duration, width: pr.width, height: pr.height, hasAudio: pr.hasAudio });
      if (u.mime.startsWith('video/')) {
        p.cutRate = await cutRate(u.path, pr.duration);
        p.faceRatio = await faceRatio(u.path).catch(() => 0);
        if (pr.hasAudio) p.speechRate = await speechRate(u.path, join(ctx.dir, 'intake', u.id), pr.duration).catch(() => 0);
      }
    } catch (e) { await ctx.activity('note', `couldn’t measure ${u.name}: ${(e as Error).message}`); }
    probes.push(p);
    await ctx.q(P.setUploadProbe, { id: u.id, probe: JSON.stringify(p), role: null, why: null });
  }
  const f = features(req.text ?? '', probes, req.ratio);
  const said = [f.format && `format ${f.format}`, f.seconds && `${f.seconds} s`, f.language !== 'en' && f.language, f.footage !== 'none' && `upload: ${f.footage}`, f.urls.length && `${f.urls.length} link${f.urls.length > 1 ? 's' : ''}`].filter(Boolean).join(' · ');
  return { output: { features: f, probes }, note: said || 'brief read' };
};

/** Words a second in the first 45 s of a clip's audio (Whisper on the user's own key; 0 when none is available). */
async function speechRate(file: string, dir: string, duration: number) {
  ensureDir(dir);
  if (!sttAvailable()) return 0;
  const words = await transcribeWords(file, dir, { maxSeconds: 45 });
  return +(words.length / Math.max(1, Math.min(45, duration))).toFixed(2);
}

const LIKE_BEFORE = /\b(like|same as|similar to) (the |my |our )?(previous|last|earlier|other|first) (one|video|reel)\b|\bsame (style|look|vibe) (as )?(before|again)?\b|\bsame as (before|last time)\b|\b(another|one more) like (that|it|this)\b/i;

export const matchStyle: Handler = async ctx => {
  const { features: f0 } = (await ctx.out<{ features: Features }>('intake'))!;
  const f: Features = { ...f0 };
  if (f.footage === 'unclear') {
    if (!ctx.task.answer) return { park: { question: 'footage-or-reference', text: 'Is this clip footage you want me to edit, or a video whose style you want me to copy for something new?', choices: [{ id: 'edit', label: 'Edit this footage' }, { id: 'reference', label: 'Copy its style' }] } };
    f.footage = ctx.task.answer === 'reference' ? 'reference' : 'edit';
    f.footageWhy = [...f.footageWhy, `you said: ${ctx.task.answer === 'reference' ? 'copy its style' : 'edit it'}`];
  }
  if (f.clip) await ctx.q(P.setUploadProbe, { id: f.clip, probe: null, role: f.footage, why: f.footageWhy.join('; ') });

  // "like the previous one": the project's last finished video sets the style and its card
  let reuse: { video: string; style: string; card: unknown; skill: string | null } | null = null;
  if (LIKE_BEFORE.test(f.text)) {
    const vids = await ctx.q<{ video: string; style: string | null; card: string | null; skill: string | null; chat: string }>(P.videos);
    const prev = vids.find(v => v.chat !== ctx.chat && v.skill);
    if (prev) reuse = { video: prev.video, style: prev.skill!, card: prev.card ? JSON.parse(prev.card) : null, skill: prev.skill };
  }

  let m: Match = match(f);
  if (!reuse && m.needsIntent) {
    ctx.note('reading the brief');
    const r = await ask({ agent: 'moovi:intent', tier: 'fast', system: 'You classify what a short video brief is for. Choose only from the given intents.', prompt: `Brief: ${f.text || '(no text)'}\n\nPick the 1–3 intents that describe it best from: ${INTENTS.join(', ')}`, schema: { intents: z.array(z.enum(INTENTS as [string, ...string[]])).min(1).max(3) }, maxTurns: 3, signal: ctx.signal });
    m = match({ ...f, intents: r.intents });
  }
  // a style this user already turned down is not eligible: the Art Director designs a new look instead
  const steer = reuse ? { match: m, steered: null } : steerStyle(m, (await feedbackMemory(ctx, 'planner')).mem);
  m = steer.match;
  const style = reuse?.style ?? m.style;
  const pkg = PACKAGES[style] ?? PACKAGES.unique!;
  const nearestName = { s1: 'Style 1, the explainer short', s2: 'Style 2, the Hinglish promo', s3: 'Style 3, the launch film', s4: 'Style 4, the metaphor essay', e1: 'the premium reel edit' }[m.nearest] ?? m.nearest;
  const matchRow = { style, score: m.score, nearest: m.nearest, scores: m.scores, footage: f.footage, features: f, reuse: reuse ? { video: reuse.video } : null, steered: steer.steered };
  await ctx.q(P.setRun, { id: ctx.run.id, status: null, brief: null, skill: style, card: reuse?.card ? JSON.stringify(reuse.card) : null, match: JSON.stringify(matchRow), error: null, at: Date.now() });
  await publish(ctx.chat, { type: 'run', run: { id: ctx.run.id, n: ctx.run.n, status: 'running', style } });
  const say = reuse ? `Same look as your earlier video, new script. I’m keeping its ${style === 'unique' ? 'style card' : 'style'} and writing fresh.`
    : style === 's1' ? `This is a Style 1 explainer: a vertical short where every word lands on the voice. (match ${(m.score * 100).toFixed(0)}%)`
    : f.footage === 'edit' ? `I’ll edit your footage into a premium reel with a look designed for it (closest known: ${nearestName}).`
    : f.footage === 'reference' ? 'I’ll study your reference and design a new style from it, with a fresh script and our own assets.'
    : `No known style fits this one exactly, so the Art Director will design one for it (closest known: ${nearestName}).`;
  await ctx.say(steer.steered ? `You turned ${steer.steered === 's1' ? 'Style 1' : steer.steered} down before, so I’m not using it. ${say}` : say, 'text', undefined, 'moovi');
  return { output: matchRow, spawn: playbookSpecs(ctx, pkg.playbook, f, !!reuse?.card), note: style === 'unique' ? `unique (nearest ${m.nearest})` : style };
};

const FANOUT_SOURCE: Record<string, string> = { questions: 'plan', assets: 'board', scenes: 'board', chunks: 'assemble' };

/** The matched style's playbook as tasks: conditions decide which stages exist; fan-out stages are spawned later. */
export function playbookSpecs(ctx: TaskCtx, stages: (typeof PACKAGES)['s1']['playbook'], f: Features, haveCard = false): TaskSpec[] {
  const voiceover = !!f.voiceover && f.footage !== 'edit';
  const on = (when?: string) => !when || (when === 'footage' ? f.footage === 'edit' || voiceover : when === 'reference' ? f.footage === 'reference' : when === 'tts' ? f.footage !== 'edit' && !voiceover : when === 'urls' ? f.urls.length > 0 : true);
  const kept = stages.filter(s => s.kind !== 'intake' && s.kind !== 'match' && on(s.when) && !(haveCard && s.kind === 'card') && !(haveCard && s.kind === 'study'));
  const byKind = new Map(kept.map(s => [s.kind, s]));
  return kept.filter(s => !s.fanout).map(s => {
    const deps = new Set<string>(['match']), waits: string[] = [];
    for (const a of s.after) {
      const st = byKind.get(a);
      if (!st) continue;
      if (st.fanout) { waits.push(a); deps.add(FANOUT_SOURCE[st.fanout]!); } else deps.add(a);
    }
    return { key: s.kind, kind: s.kind, agent: s.agent, resource: s.resource, title: s.title, deps: [...deps].filter(d => d === 'match' || byKind.has(d)), waits, max: s.max, optional: s.kind === 'study' };
  });
}
