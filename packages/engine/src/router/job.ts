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
import { combinedFilm, direct, secsOf } from './film';
import { styleReel, type ReelInput } from '../tasks/reel';
import { briefNeeds, matchKit } from '../styles/kit/kits';
import { pickClipMoment } from '../edit/templates/clip-moment-plan';

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

/**
 * "Auto" as a live preview (the default; MOOVI_AUTO_RENDER=mp4 makes the mixed MP4 film instead, which wants about
 * 8 GB and minutes per film): a link goes straight to the style that suits the brief; plain words get a script from
 * the director first. Either way the result plays live in that style's own browser player, nothing encoded.
 */
const DOMAIN = /\b[a-z0-9-]+\.(?:com|io|ai|app|dev|co|org|net|so|xyz|in)\b/i;
export function autoStyleFor(brief: string, kinds: string[] = []): ReelInput['style'] {
  const b = brief.toLowerCase(), n = (k: string) => kinds.filter(x => x === k).length;
  if (/\b(story|fable|tale|history|journey|founder|legend)\b/.test(b) || n('quote') + n('story') >= 3) return 'darkvox';
  return 'anatomy';
}
/**
 * Auto's pick for a script it wrote, with the reason (logged like the kit pick): a story stays Dark Vox; a script whose
 * lines can be illustrated with stock clips (most lines name something footage shows) is Clip Moment; else Anatomy.
 */
export function autoPickFor(brief: string, kinds: string[], lines: string[]): { style: ReelInput['style']; why: string } {
  const first = autoStyleFor(brief, kinds);
  if (first === 'darkvox') return { style: 'darkvox', why: 'a story or quotes: Dark Vox' };
  const cm = pickClipMoment({ lines });
  return cm.pick ? { style: 'clip-moment', why: cm.why } : { style: first, why: `${cm.why}: Anatomy draws it instead` };
}
export function urlStyleFor(brief: string): ReelInput['style'] {
  const b = brief.toLowerCase();
  if (/\b(launch(es|ing)?|announce\w*|release|promo|product (film|video)|new feature|keynote)\b/.test(b)) return 'launch';
  if (/\b(story|fable|tale|history|journey|founder)\b/.test(b)) return 'darkvox';
  if (/\b(how (it|they) works?|architecture|under the hood|system|product)\b/.test(b)) return 'anatomy';
  if (/\b(essay|idea|why|metaphor|calm)\b/.test(b)) return 's4';
  if (/\b(list|steps|explain|explainer|clear|simple)\b/.test(b)) return 's5';
  return 's1';
}
async function autoLive(ctx: Parameters<Handler>[0], brief: string) {
  const link = brief.match(/https?:\/\/[^\s)]+/)?.[0] ?? (brief.match(DOMAIN) ? `https://${brief.match(DOMAIN)![0]}` : undefined);
  let reel: ReelInput;
  if (link) reel = { style: urlStyleFor(brief), url: link };
  else {
    await ctx.say('Auto: I write the script first, then pick the style that fits it and play it live.', 'note', undefined, 'moovi');
    const d = await direct(brief, secsOf(brief), ['darkvox', 'anatomy'], { signal: ctx.signal });
    const brand = (d.title || brief).replace(/[^\p{L}\p{N} .&'-]/gu, '').trim().split(/\s+/).slice(0, 3).join(' ') || 'Moovi';
    const pick = autoPickFor(brief, d.beats.map(b => b.kind), d.beats.map(b => b.say.trim()));
    console.log(`[auto ${ctx.run.id}] style ${pick.style}: ${pick.why}`);
    // Clip Moment's brand pill is the user's own brand only, never a title Auto made up
    reel = { style: pick.style, script: d.beats.map(b => b.say.trim()).join('\n'), ...(pick.style === 'clip-moment' ? {} : { brand }) };
  }
  // a kit whose parts serve the brief (the script's lines when there is one): its palette dresses the style's inserts
  const kit = await matchKit(briefNeeds(reel.script ? reel.script.split('\n') : [brief]));
  if (kit) {
    reel = { ...reel, kit: { id: kit.id, name: kit.name, palette: kit.palette } };
    console.log(`[auto ${ctx.run.id}] kit ${kit.id}: ${kit.covered} of ${kit.of} needs (${kit.hits} part hits)`);
    await ctx.say(`The brief fits the ${kit.name} kit (${kit.covered} of its ${kit.of} needs): its colours dress the library inserts.`, 'note', { kit: kit.id, covered: kit.covered, of: kit.of }, 'moovi');
  }
  return styleReel(Object.create(ctx, { input: { value: () => reel } }) as typeof ctx);
}

export const combinedReel: Handler = async ctx => {
  const inp = ctx.input<{ brief: string }>();
  if ((process.env.MOOVI_AUTO_RENDER ?? 'live').trim().toLowerCase() !== 'mp4') return autoLive(ctx, inp.brief);
  const t0 = Date.now();
  const [c] = await ctx.q<{ version: number | null }>(P.chat, { id: ctx.chat });
  const version = (c?.version ?? 0) + 1;
  const stat = (agent: AgentId, state: 'working' | 'done', text: string) => publish(ctx.chat, { type: 'status', agent, state, text, task: `${ctx.task.id}:${agent}` }).catch(() => undefined);
  const title = inp.brief.replace(/,?\s*in \d+\s*(s|sec|seconds)\b.*$/i, '').slice(0, 60);
  await ctx.q(P.setChat, { id: ctx.chat, title, status: null, at: Date.now() });
  await publish(ctx.chat, { type: 'title', title });
  await ctx.say(`On it: a ${secsOf(inp.brief)} s film. I write the script, then each beat gets the look that fits it (Style 1, Dark Vox and Anatomy, real footage, the globe, a 3D prop) with word-by-word captions over the whole film. Each step shows here with its time.`, 'note', undefined, 'moovi');
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
