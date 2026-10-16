import { copyFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { project as P, run as runQ, SYS, sys as S } from '@moovi/graph';
import { publish } from '../bus';
import { probe, sh } from '../bench';
import { config } from '../config';
import type { Handler } from '../ctx';
import type { Command } from '../commands';
import type { AgentId } from '../events';
import { activity } from '../live';
import { startRun } from '../runs';
import { combinedFilm, secsOf } from './film';

/**
 * The combined film as an engine job, so the studio's normal path runs it: the brief box's "Auto" style, and (unless
 * MOOVI_DEFAULT_STYLE=crew) any brief sent with no style picked and no uploads. Ishaan's four styles keep their own
 * style-reel job exactly as before; a brief with uploads keeps the crew (the combined film does not use uploads yet).
 */
export const COMBINED_KIND = 'combined-reel';
export const combinedIsDefault = () => (process.env.MOOVI_DEFAULT_STYLE ?? 'combined').trim().toLowerCase() === 'combined';

type Brief = Extract<Command, { type: 'brief' }>;

/** If this brief is the combined film's, start its run and say so (true); else leave it to the existing paths. */
export async function routeCombined(cmd: Brief): Promise<boolean> {
  const picked = (cmd.style?.id as string | undefined) === 'combined';
  if (!picked && (cmd.style?.id || cmd.uploads?.length || !combinedIsDefault())) return false;
  const brief = (picked ? (cmd.style?.script || cmd.text || cmd.style?.url) : cmd.text)?.trim();
  if (!brief) return false;
  await startRun(cmd.project, cmd.chat, {
    kind: 'make', request: { text: cmd.text || brief, ratio: '9:16', uploads: [], ...(picked ? { style: cmd.style } : {}) },
    specs: [{ key: 'film', kind: COMBINED_KIND, agent: 'moovi', resource: 'cpu', title: 'Make the film', input: { brief }, max: 1 }],
  });
  return true;
}

/** Which desk shows each stage of the combined film. */
const DESK: Record<string, { text: string; desk: AgentId }> = {
  director: { text: 'writing the script', desk: 'director' as AgentId },
  voice: { text: 'recording voices', desk: 'editor' as AgentId },
  footage: { text: 'casting footage', desk: 'hunter' as AgentId },
  captions: { text: 'drawing captions', desk: 'builder' as AgentId },
  segments: { text: 'building scenes', desk: 'builder' as AgentId },
  cut: { text: 'cutting the film', desk: 'editor' as AgentId },
};

export const combinedReel: Handler = async ctx => {
  const inp = ctx.input<{ brief: string }>();
  const t0 = Date.now();
  const [c] = await ctx.q<{ version: number | null }>(P.chat, { id: ctx.chat });
  const version = (c?.version ?? 0) + 1;
  const stat = (agent: AgentId, state: 'working' | 'done', text: string) => publish(ctx.chat, { type: 'status', agent, state, text, task: `${ctx.task.id}:${agent}` }).catch(() => undefined);
  const title = inp.brief.replace(/,?\s*in \d+\s*(s|sec|seconds)\b.*$/i, '').slice(0, 60);
  await ctx.q(P.setChat, { id: ctx.chat, title, status: null, at: Date.now() });
  await publish(ctx.chat, { type: 'title', title });
  await ctx.say(`On it: a ${secsOf(inp.brief)} s film. I write the script, then each beat gets the look that fits it (Ishaan’s Style 1, Dark Vox and Anatomy, real footage, the globe, a 3D prop) with Ishaan’s captions over the whole film. Each step shows here with its time.`, 'note', undefined, 'moovi');
  const r = await combinedFilm({
    brief: inp.brief, id: `${ctx.run.id.slice(-8)}`, signal: ctx.signal,
    log: s => console.log(`[combined ${ctx.run.id}] ${s}`),
    stage: (name, state, secs) => {
      const st = DESK[name] ?? { text: name, desk: 'moovi' as AgentId };
      void stat(st.desk, state === 'start' ? 'working' : 'done', state === 'start' ? st.text : 'done');
      void activity(ctx.chat, st.desk, ctx.task.id, state === 'start' ? 'start' : 'done', state === 'start' ? st.text : `${name} · ${(secs ?? 0).toFixed(1)} s`, { ...(secs !== undefined ? { ms: Math.round(secs * 1000) } : {}), scope: name });
    },
  });
  const vdir = join(ctx.projectDir, 'videos', ctx.chat); mkdirSync(vdir, { recursive: true });
  const file = join(vdir, `v${version}.mp4`), poster = join(vdir, `v${version}.jpg`);
  copyFileSync(r.out, file);
  const pr = await probe(file);
  await sh(config.ffmpeg, ['-v', 'error', '-y', '-ss', Math.min(pr.duration * 0.35, 6).toFixed(2), '-i', file, '-frames:v', '1', '-vf', 'scale=432:-2', poster], { timeout: 60_000 });
  await ctx.q(P.setVideo, { id: ctx.run.video, status: 'ready', path: file, poster: `${ctx.chat}/v${version}.jpg`, duration: +pr.duration.toFixed(2), version, style: 'combined', format: 'vertical', at: Date.now() });
  await ctx.q(P.setChat, { id: ctx.chat, title: null, status: 'ready', at: Date.now() });
  const vids = await ctx.q<{ video: string }>(P.videos), chats = await ctx.q<{ id: string }>(P.chats);
  await runQ(SYS, S.touchProject, { id: ctx.pid, name: null, chats: chats.length, videos: vids.length, poster: `${ctx.chat}/v${version}.jpg`, at: Date.now() });
  await publish(ctx.chat, { type: 'video', video: { id: ctx.run.video, status: 'ready', version, duration: +pr.duration.toFixed(2), format: 'vertical' } });
  const wall = +((Date.now() - t0) / 1000).toFixed(1);
  const looks = [...new Set(r.segments.map(s => s.made))].join(', ');
  await ctx.say(`Here it is: ${pr.duration.toFixed(1)} s (${looks}; ${Math.round(r.footageShare * 100)}% real footage), made in ${wall} s. Ask me for any change.`, 'video', { video: ctx.run.video, version, duration: +pr.duration.toFixed(2), format: 'vertical', run: ctx.run.id, style: 'combined' }, 'moovi');
  await ctx.say(`Timings, stage by stage: ${Object.entries(r.timings).map(([k, v]) => `${k} ${v.toFixed(1)} s`).join(' · ')}.`, 'note', { timings: r.timings }, 'moovi');
  writeFileSync(join(r.dir, 'job-report.json'), JSON.stringify({ via: 'engine combined-reel job', project: ctx.pid, chat: ctx.chat, run: ctx.run.id, task: ctx.task.id, brief: inp.brief, file, wall, timings: r.timings }, null, 1));
  return { output: { style: 'combined', file, dir: r.dir, version, duration: +pr.duration.toFixed(2), timings: r.timings, footageShare: r.footageShare }, note: `combined film ${pr.duration.toFixed(1)} s in ${wall} s` };
};
