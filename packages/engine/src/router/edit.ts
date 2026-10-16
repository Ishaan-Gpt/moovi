import { execFileSync } from 'node:child_process';
import { copyFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { extname, join } from 'node:path';
import { color } from '@moovi/brand';
import { project as P, run as runQ, SYS, sys as S } from '@moovi/graph';
import { sttAvailable } from '../audio/stt';
import { probe } from '../bench';
import { publish } from '../bus';
import type { Command } from '../commands';
import { config } from '../config';
import type { Handler } from '../ctx';
import { CAPTION_STYLES } from '../edit/captions';
import { EDIT, type PlayerEdl } from '../edit/lib';
import { buildEdl } from '../edit/build';
import { envelope, pauses, type Word } from '../edit/cut';
import { validateEdl } from '../edit/edl';
import { hear } from '../edit/hear';
import { lookFaces } from '../edit/look';
import { roughEdl } from '../edit/rough';
import { activity } from '../live';
import { startRun } from '../runs';
import { liveRefFile, type LiveRef } from '../styles/serve';

/**
 * Your own clip in, an edit playing live out: an upload with no style picked is EDITED (not sent to the crew, which
 * took 19.7 min on R3's clip and transcribed it as Urdu). One job: probe, hear, plan, and the edit preview player
 * plays the plan over the clip in the browser, nothing encoded. The plan is D1.3's EDL builder (../edit/build.ts);
 * the words come from D1.2's hear (../edit/hear.ts, language-locked). MOOVI_EDIT=crew keeps the old crew path; a brief that asks to copy a video's style
 * ("like this", "in the style of") still goes to the crew's reference path.
 */
export const EDIT_KIND = 'edit-reel';
const editIsOn = () => (process.env.MOOVI_EDIT ?? 'live').trim().toLowerCase() !== 'crew';
const WANTS_REFERENCE = /\b(style of|in the style|like this (one|video|reel)|copy (its|the|this) (style|look|vibe)|make (one|something) like)\b/i;

type Brief = Extract<Command, { type: 'brief' }>;
interface Upload { id: string; name: string; path: string; mime: string }

/** Which upload this brief edits, and in which caption style; null when the brief belongs to another path. Pure. */
export function editTarget(cmd: Pick<Brief, 'text' | 'uploads' | 'style'>, uploads: Upload[], on = editIsOn()): { upload: string; caption?: string } | null {
  if (!on || cmd.style?.id || !cmd.uploads?.length) return null;
  if (WANTS_REFERENCE.test(cmd.text ?? '')) return null;
  const clip = uploads.find(u => cmd.uploads.includes(u.id) && u.mime.startsWith('video/'));
  if (!clip) return null;
  const caption = CAPTION_STYLES.find(s => new RegExp(`\\b${s.id}\\b`, 'i').test(cmd.text ?? ''))?.id;
  return { upload: clip.id, ...(caption ? { caption } : {}) };
}

/** If this brief is an edit of the user's own clip, start its run (true); else leave it to the other paths. */
export async function routeEdit(cmd: Brief, uploads: Upload[]): Promise<boolean> {
  const target = editTarget(cmd, uploads);
  if (!target) return false;
  await startRun(cmd.project, cmd.chat, {
    kind: 'make', request: { text: cmd.text, ratio: cmd.ratio ?? 'auto', uploads: cmd.uploads },
    specs: [{ key: 'edit', kind: EDIT_KIND, agent: 'editor', resource: 'cpu', title: 'Edit your clip', input: target, max: 1 }],
  });
  return true;
}

export const editReel: Handler = async ctx => {
  const inp = ctx.input<{ upload: string; caption?: string; names?: string[] }>();
  const [u] = (await ctx.q<Upload>(P.uploads, { chat: ctx.chat })).filter(x => x.id === inp.upload);
  if (!u) throw new Error('The clip to edit is missing');
  const t0 = Date.now(), lap: Record<string, number> = {}; let tl = t0;
  const step = async (stage: string, text: string) => { await publish(ctx.chat, { type: 'status', agent: 'editor', state: 'working', text, task: `${ctx.task.id}:editor` }).catch(() => undefined); void activity(ctx.chat, 'editor', ctx.task.id, 'start', text, { scope: stage }); };
  const done = (stage: string) => { lap[stage] = +((Date.now() - tl) / 1000).toFixed(2); tl = Date.now(); void activity(ctx.chat, 'editor', ctx.task.id, 'done', `${stage} · ${lap[stage]!.toFixed(1)} s`, { ms: Math.round(lap[stage]! * 1000), scope: stage }); };

  await ctx.say(`I’ll edit ${u.name}: cut the pauses, punch in on each new thought and caption every word. It plays live as soon as the plan is ready.`, 'note', undefined, 'moovi');
  const dir = join(ctx.dir, 'edit'); mkdirSync(dir, { recursive: true });
  const file = `src${extname(u.name).toLowerCase() || '.mp4'}`;
  await step('probe', 'measuring your clip');
  copyFileSync(u.path, join(dir, file));
  const pr = await probe(u.path);
  if (!pr.hasVideo) throw new Error(`${u.name} has no video stream`);
  done('probe');

  // D1.3 look: the speaker's face, beside the hearing (edit/look.ts; [] without a vision python), for crop and punch-ins
  const lookP = lookFaces(u.path, pr.duration);
  await step('hear', 'timing every word');
  // D1.2: language-locked, in pieces, the accurate text laid on, and a confidence gate (edit/hear.ts)
  let words: Word[] = [], language: string | undefined;
  if (pr.hasAudio && sttAvailable()) {
    // the vocabulary prompt: Moovi, Ishaan, MOOVI_VOCAB and the project's own names (inp.names)
    const h = await hear(u.path, dir, { signal: ctx.signal, ...(inp.names?.length ? { names: inp.names } : {}) });
    words = h.words; language = h.language;
    writeFileSync(join(dir, 'hear.json'), JSON.stringify({ language: h.language, lang: h.lang, detected: h.detected, by: h.by, prompt: h.prompt, gate: h.gate, pieces: h.pieces, timings: h.timings }, null, 1));
    if (!h.gate.ok) await ctx.activity('note', `the transcript may be off (${h.gate.reasons.join('; ')}), so check the captions`);
  } else if (pr.hasAudio) await ctx.activity('note', 'no speech-to-text key, so no cuts or captions from words this time');
  writeFileSync(join(dir, 'words.json'), JSON.stringify(words, null, 1));
  done('hear');

  await step('plan', 'planning the cuts');
  const palette = { ink: color.ink, paper: color.surface, accent: color.ice, accent2: color.frostMid, deep: color.ink, pop: color.iceWhite };
  // D1.3: the EDL builder (edit/build.ts): take window, pause and filler cuts snapped to words, a framing per sentence
  const ps = pr.hasAudio ? pauses(await envelope(u.path)) : [];
  const look = await lookP;
  const source = { file, duration: pr.duration, w: pr.width ?? 1080, h: pr.height ?? 1920, fps: pr.fps ?? 30 };
  let edl: PlayerEdl;
  try {
    const e = buildEdl({ source, words, pauses: ps, palette, ...(look.faces.length ? { faces: look.faces } : {}), style: { id: 'base', ...(inp.caption ? { caption: inp.caption } : {}) }, ...(language ? { language } : {}) });
    const bad = validateEdl(e).problems.filter(p => !p.startsWith('version'));
    if (bad.length) throw new Error(bad.slice(0, 3).join('; '));
    edl = e;
  } catch (e) {
    // the builder is new: if it throws or its EDL does not validate, the stand-in plan (rough.ts) still gives an edit
    console.warn(`[edit] builder failed, rough plan instead: ${String((e as Error).message ?? e).slice(0, 200)}`);
    await ctx.activity('note', 'the full edit planner hit a problem, so this is the simple cut');
    edl = roughEdl(source, words.map(w => ({ word: w.word, t: w.t, end: w.end })), { palette, captionStyle: inp.caption ?? 'punch-duo' });
  }
  const t = EDIT.timeline(edl);
  if (t.problems.length) throw new Error(`The edit plan is inconsistent: ${t.problems.join('; ')}`);
  writeFileSync(join(dir, 'edl.json'), JSON.stringify(edl, null, 1));
  done('plan');

  // it plays now: the edit preview player through the studio's preview route, like the live styles
  const [c] = await ctx.q<{ version: number | null }>(P.chat, { id: ctx.chat });
  const version = (c?.version ?? 0) + 1, id = `edit-${ctx.run.id.slice(-6)}`;
  const seconds = +((Date.now() - t0) / 1000).toFixed(1);
  const ref: LiveRef = { style: 'edit', player: 'edit-player', dir, id, run: ctx.run.id, timings: { ...lap, to_preview: seconds }, duration: t.duration };
  const vdir = join(ctx.projectDir, 'videos', ctx.chat); mkdirSync(vdir, { recursive: true });
  writeFileSync(liveRefFile(ctx.projectDir, ctx.chat, version), JSON.stringify(ref, null, 1));
  let poster: string | null = null;
  try { execFileSync(config.ffmpeg, ['-v', 'error', '-y', '-ss', String(EDIT.srcAt(edl, t.duration / 2)), '-i', u.path, '-frames:v', '1', '-vf', 'scale=432:-2', join(vdir, `v${version}.jpg`)]); poster = `${ctx.chat}/v${version}.jpg`; } catch (e) { console.warn(`[edit] poster: ${String(e).slice(0, 120)}`); }
  const title = `${u.name.replace(/\.[^.]+$/, '')} · Edit`;
  await ctx.q(P.setChat, { id: ctx.chat, title, status: 'ready', at: Date.now() });
  await publish(ctx.chat, { type: 'title', title });
  await ctx.q(P.setVideo, { id: ctx.run.video, status: 'ready', path: dir, poster, duration: t.duration, version, style: 'live:edit', format: pr.height && pr.width && pr.width > pr.height ? 'landscape' : 'vertical', at: Date.now() });
  await publish(ctx.chat, { type: 'video', video: { id: ctx.run.video, status: 'ready', version, duration: t.duration, format: 'vertical', live: true } });
  await publish(ctx.chat, { type: 'status', agent: 'editor', state: 'done', text: 'done', task: `${ctx.task.id}:editor` }).catch(() => undefined);
  const cut = pr.duration - t.duration;
  await ctx.say(`Here’s your edit, playing live: ${t.duration.toFixed(1)} s from ${pr.duration.toFixed(1)} s (${cut.toFixed(1)} s of pauses cut), ${edl.shots.length} shots, ${words.length} words captioned. Ready ${seconds.toFixed(1)} s after you sent it.`, 'video', { video: ctx.run.video, version, duration: t.duration, format: 'vertical', run: ctx.run.id, live: true, style: 'edit' }, 'moovi');
  const vids = await ctx.q<{ video: string }>(P.videos), chats = await ctx.q<{ id: string }>(P.chats);
  await runQ(SYS, S.touchProject, { id: ctx.pid, name: null, chats: chats.length, videos: vids.length, poster, at: Date.now() });
  return { output: { dir, version, timings: ref.timings, duration: t.duration, shots: edl.shots.length, words: words.length }, note: `edit ready in ${seconds.toFixed(1)} s` };
};
