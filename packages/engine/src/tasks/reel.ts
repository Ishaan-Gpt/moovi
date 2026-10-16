import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { project as P, run as runQ, SYS, sys as S } from '@moovi/graph';
import { publish } from '../bus';
import { config } from '../config';
import type { Handler } from '../ctx';
import type { AgentId } from '../events';
import { activity } from '../live';
import { STAGES, styleOf, type StyleId } from '../styles';
import { recordInserts } from '../styles/kit/borrow';
import { runStyle, table } from '../styles/run';
import { liveRefFile, type LiveRef } from '../styles/serve';

export interface ReelInput { style: StyleId; url?: string; script?: string; brand?: string; /** Auto's kit match (styles/kit/kits.ts) */ kit?: { id: string; name: string; palette: Record<string, string> } }

const slug = (s: string) => s.replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/[^a-z0-9]+/gi, '-').toLowerCase().replace(/^-|-$/g, '').slice(0, 40);

/**
 * A style reel: one of the four live-preview styles, run by the SAME function its terminal script calls
 * (src/styles/run.ts). Every stage of that run becomes the office's status line at the desk that does it and a timed
 * row in the chat; the timings are kept with the task (the run's output) and in the film's dir; the video pops up the
 * moment the live preview is ready (the contact sheet, if the style makes one, follows while you watch).
 */
export const styleReel: Handler = async ctx => {
  const inp = ctx.input<ReelInput>();
  const info = styleOf(inp.style);
  if (!info) throw new Error(`Unknown style "${inp.style}"`);
  const id = `${slug(inp.url ?? inp.brand ?? 'script')}-${ctx.run.id.slice(-6)}`;
  const [c] = await ctx.q<{ version: number | null }>(P.chat, { id: ctx.chat });
  const version = (c?.version ?? 0) + 1;
  const on = new Map<string, AgentId>();
  const stat = (agent: AgentId, state: 'working' | 'done', text: string) => publish(ctx.chat, { type: 'status', agent, state, text, task: `${ctx.task.id}:${agent}` }).catch(() => undefined);
  let current: string | null = null;
  const t0 = Date.now();
  let announced = false;

  const title = `${inp.url ? new URL(inp.url).hostname.replace(/^www\./, '') : inp.brand ?? 'Your script'} · ${info.name}`;
  await ctx.q(P.setChat, { id: ctx.chat, title, status: null, at: Date.now() });
  await publish(ctx.chat, { type: 'title', title });
  await ctx.say(`${info.name} (${info.kind}) it is. ${inp.url ? `Reading ${inp.url} now.` : 'Voicing your script now.'} I’ll show you each step with its time.`, 'note', undefined, 'moovi');
  const r = await runStyle(inp.style, { url: inp.url, script: inp.script, brand: inp.brand, kit: inp.kit, id, signal: ctx.signal }, {
    log: s => console.log(`[reel ${ctx.run.id}] ${s}`),
    start: stage => {
      current = stage;
      const st = STAGES[stage] ?? { text: stage, desk: 'moovi' as const };
      on.set(stage, st.desk);
      void stat(st.desk, 'working', st.text);
      void activity(ctx.chat, st.desk, ctx.task.id, 'start', st.text, { scope: stage });
    },
    lap: (stage, seconds) => {
      const st = STAGES[stage] ?? { text: stage, desk: 'moovi' as const };
      void stat(st.desk, 'done', 'done');
      void activity(ctx.chat, st.desk, ctx.task.id, 'done', `${stage} · ${seconds.toFixed(1)} s`, { ms: Math.round(seconds * 1000), scope: stage });
    },
    progress: text => {
      const desk = current ? (STAGES[current]?.desk ?? 'moovi') : 'moovi';
      void stat(desk, 'working', text.slice(0, 28));
      void activity(ctx.chat, desk, ctx.task.id, 'note', text, { scope: current ?? undefined });
    },
    preview: async p => {
      // the video is ready to watch now: the live player through the studio's preview route
      const ref: LiveRef = { style: inp.style, player: p.player, dir: p.dir, id: p.id, run: ctx.run.id, timings: {}, duration: p.duration };
      mkdirSync(join(ctx.projectDir, 'videos', ctx.chat), { recursive: true });
      writeFileSync(liveRefFile(ctx.projectDir, ctx.chat, version), JSON.stringify(ref, null, 1));
      await ctx.q(P.setVideo, { id: ctx.run.video, status: 'ready', path: p.dir, poster: null, duration: p.duration, version, style: `live:${inp.style}`, format: 'vertical', at: Date.now() });
      await ctx.q(P.setChat, { id: ctx.chat, title: null, status: 'ready', at: Date.now() });
      await publish(ctx.chat, { type: 'video', video: { id: ctx.run.video, status: 'ready', version, duration: p.duration, format: 'vertical', live: true } });
      await ctx.say(`Here it is, playing live: ${p.duration.toFixed(1)} s of ${info.name}, ready ${p.seconds.toFixed(1)} s after you asked.${info.player === 's1-engine' ? '' : ' Lens is still pulling a contact sheet from it.'}`, 'video', { video: ctx.run.video, version, duration: p.duration, format: 'vertical', run: ctx.run.id, live: true, style: inp.style }, 'moovi');
      announced = true;
    },
  });
  r.close(); // the studio serves the film itself; the local preview server was only for the contact sheet
  // the inserts the style borrowed from the library graph, in this project's graph (Scene)-[:USES_ARTIFACT {slot: 'library'}]
  const borrowed = await recordInserts((q, p) => ctx.q(q, p), ctx.run.id, inp.style, r.dir).catch(e => { console.warn(`[reel] library inserts: ${String(e).slice(0, 120)}`); return 0; });
  if (borrowed) console.log(`[reel ${ctx.run.id}] ${borrowed} library insert(s) recorded`);
  for (const d of new Set(on.values())) void stat(d, 'done', 'done');

  // a poster for the dock and the project card: the middle still of the contact sheet (styles 4, 5, Dark Vox)
  const vdir = join(ctx.projectDir, 'videos', ctx.chat);
  try {
    const sd = join(r.dir, 'sheet'), stills = existsSync(sd) ? readdirSync(sd).filter(f => /^o[\d.]+\.png$/.test(f)).sort((a, b) => parseFloat(a.slice(1)) - parseFloat(b.slice(1))) : [];
    const src = stills.length ? join(sd, stills[Math.floor(stills.length / 2)]!) : existsSync(join(r.dir, 'site.png')) ? join(r.dir, 'site.png') : null;
    if (src) execFileSync(config.ffmpeg, ['-v', 'error', '-y', '-i', src, '-vf', 'scale=432:-2', join(vdir, `v${version}.jpg`)]);
  } catch (e) { console.warn(`[reel] poster: ${String(e).slice(0, 120)}`); }
  const ref: LiveRef = { style: inp.style, player: r.player, dir: r.dir, id: r.id, run: ctx.run.id, timings: r.timings, duration: r.duration };
  writeFileSync(liveRefFile(ctx.projectDir, ctx.chat, version), JSON.stringify(ref, null, 1));
  writeFileSync(join(r.dir, 'job-report.json'), JSON.stringify({ via: 'engine style-reel job', project: ctx.pid, chat: ctx.chat, run: ctx.run.id, task: ctx.task.id, seconds: r.timings, wall: +((Date.now() - t0) / 1000).toFixed(1) }, null, 1));
  if (existsSync(join(vdir, `v${version}.jpg`))) await ctx.q(P.setVideo, { id: ctx.run.video, status: null, path: null, poster: `${ctx.chat}/v${version}.jpg`, duration: null, version: null, style: null, format: null, at: Date.now() });
  const vids = await ctx.q<{ video: string }>(P.videos), chats = await ctx.q<{ id: string }>(P.chats);
  await runQ(SYS, S.touchProject, { id: ctx.pid, name: null, chats: chats.length, videos: vids.length, poster: existsSync(join(vdir, `v${version}.jpg`)) ? `${ctx.chat}/v${version}.jpg` : null, at: Date.now() });
  if (!announced) throw new Error('the preview never came up');
  const rows = Object.entries(r.timings).map(([k, v]) => `${k} ${v.toFixed(1)} s`).join(' · ');
  await ctx.say(`Timings, stage by stage: ${rows}.`, 'note', { timings: r.timings, table: table({ studio: r.timings }) }, 'moovi');
  return { output: { style: inp.style, id: r.id, dir: r.dir, player: r.player, version, timings: r.timings, duration: r.duration, sheet: r.sheet ?? null }, note: `${info.name} ready in ${(r.timings.to_preview ?? r.timings.total ?? 0).toFixed(1)} s` };
};
