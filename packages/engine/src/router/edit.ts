import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { project as P, run as runQ, SYS, sys as S } from '@moovi/graph';
import { publish } from '../bus';
import type { Command } from '../commands';
import { config } from '../config';
import type { Handler } from '../ctx';
import { CAPTION_STYLES } from '../edit/captions';
import { planEdit } from '../edit/job';
import { EDIT } from '../edit/lib';
import { FX } from '../edit/effects/catalog';
import type { FxEvent } from '../edit/effects/plan';
import { fxLines } from '../edit/effects/auto';
import { fxMusic } from '../edit/effects/music';
import { filmMix, renderFilm, useMix } from '../edit/film';
import { activity, stageLines } from '../live';
import { startRun } from '../runs';
import { liveRefFile, type LiveRef } from '../styles/serve';
import { assetCauses, noteDecision, wordsCause, type Cause } from '../why';

/**
 * Your own clip in, an edit playing live out: an upload with no style picked is EDITED (not sent to the crew, which
 * took 19.7 min on R3's clip and transcribed it as Urdu). One job: probe, hear, plan, and the edit preview player
 * plays the plan over the clip in the browser, nothing encoded. The plan is D1.3's EDL builder (../edit/build.ts);
 * the words come from D1.2's hear (../edit/hear.ts, language-locked). MOOVI_EDIT=crew keeps the old crew path; a brief that asks to copy a video's style
 * ("like this", "in the style of") still goes to the crew's reference path.
 */
export const EDIT_KIND = 'edit-reel';
const editIsOn = () => (process.env.MOOVI_EDIT ?? 'live').trim().toLowerCase() !== 'crew';
/** A brief that says the clip has no words to caption (music, b-roll): the edit may go ahead without hearing any. */
export const NO_WORDS = /\b(no (captions?|subtitles?|subs|words|talking|speech)|without (captions?|subtitles?|words)|music[- ]only|only music|instrumental|b-?roll|no one (talks|speaks))\b/i;
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

/**
 * Whether the edit also gets its effects film (the reel effects library over the clip itself, edit/effects/render.ts):
 * on unless MOOVI_FX=off, when the plan picked at least two effects for a speaker on screen in a clip of 90 s or less
 * (the film renders every frame, about a few minutes for a Short). Pure.
 */
export function fxFilmFor(p: { effects: { events: FxEvent[] } | null; faces: number; source: { duration: number } }, env = process.env.MOOVI_FX): { go: boolean; why: string } {
  if ((env ?? 'auto').trim().toLowerCase() === 'off') return { go: false, why: 'MOOVI_FX=off' };
  const n = p.effects?.events.filter(e => FX[e.fx].kind !== 'transition').length ?? 0;
  if (n < 2) return { go: false, why: `${n} effect${n === 1 ? '' : 's'} fit the words` };
  if (p.faces < 1) return { go: false, why: 'no speaker on screen' };
  if (p.source.duration > 90) return { go: false, why: 'longer than 90 s' };
  return { go: true, why: `${n} effects fit the words` };
}

/** The plain reason an effects render failed, for the job's note and the log: the error's last meaningful line. Pure. */
export function fxReason(e: unknown): string {
  const m = String((e as Error)?.message ?? e ?? 'unknown error').replace(/\s+at\s.*$/s, '');
  const lines = m.split('\n').map(l => l.trim()).filter(Boolean);
  const last = lines.find(l => /error|not found|no such|cannot|enoent|exit|failed|missing|timed out/i.test(l)) ?? lines[0] ?? 'unknown error';
  return last.length > 220 ? last.slice(0, 217) + '...' : last;
}

/** If this brief is an edit of the user's own clip, start its run (true); else leave it to the other paths. */
export async function routeEdit(cmd: Brief, uploads: Upload[]): Promise<boolean> {
  const target = editTarget(cmd, uploads);
  if (!target) return false;
  await startRun(cmd.project, cmd.chat, {
    kind: 'make', request: { text: cmd.text, ratio: cmd.ratio ?? 'auto', uploads: cmd.uploads },
    specs: [{ key: 'edit', kind: EDIT_KIND, agent: 'editor', resource: 'cpu', title: 'Edit your clip', input: { ...target, brief: cmd.text ?? '' }, max: 1 }],
  });
  return true;
}

/**
 * "Why this edit?" (decision 13): the live edit's decisions with their causes in the project graph (why.ts): the
 * style, the caption look, the cuts, the library cast and the effects, each back to the brief's words, the rule that
 * chose it or the library assets (and the reference reels those came from).
 */
async function recordEditWhy(ctx: Parameters<Handler>[0], plan: Awaited<ReturnType<typeof planEdit>>, inp: { caption?: string; brief?: string }) {
  const rows = ((q: never, p?: Record<string, unknown>) => ctx.q(q, p)) as never, run = ctx.run.id;
  const brief = (inp.brief ?? '').trim(), words = brief ? [wordsCause(`brief:${run}`, brief, 'your brief')] : [];
  const style = plan.style.id ?? 'base';
  await noteDecision(rows, run, { kind: 'style', agent: 'editor', choice: `the ${style} edit`, why: plan.style.why,
    causes: [...words, { label: 'Rule', id: `rule:edit-style:${style}`, text: plan.style.why, how: 'picked the style' }] });
  const cap = String(plan.edl.caption_style_id ?? '').replace(/^caption:/, ''), look = (plan.edl as { caption_look?: { id?: string; number?: number } }).caption_look;
  const capId = look?.id ? `caption:${look.id}` : `caption:${cap}`;
  const capRule: Cause = inp.caption ? { label: 'Rule', id: 'rule:caption:named', text: 'a caption style named in the brief is the one used', how: 'you named it' }
    : look?.id ? { label: 'Rule', id: 'rule:caption:directed', text: 'the director picks a caption look for the clip', how: 'directed' }
    : { label: 'Rule', id: `rule:caption:${style}`, text: `the ${style} edit's own caption look`, how: 'the style default' };
  const capAssets = await assetCauses([capId], () => 'the caption look');
  await noteDecision(rows, run, { kind: 'caption', agent: 'editor', choice: look?.number ? `caption look ${look.number}` : `${cap} captions`, why: capRule.text,
    causes: [...(inp.caption ? words : []), capRule, ...capAssets.causes], links: [...capAssets.links, ...(inp.caption && words[0] ? [{ from: capRule.id, to: words[0].id, rel: 'LEARNED_FROM' as const }] : [])] });
  const cut = plan.source.duration - plan.duration;
  await noteDecision(rows, run, { kind: 'cut', agent: 'editor', choice: `${cut.toFixed(1)} s of pauses cut, ${plan.edl.shots.length} shots`, why: 'pauses and fillers cut on word edges',
    causes: [...words.map(w => ({ ...w, how: 'read for how tight to cut' })), { label: 'Rule', id: 'rule:cut:pauses', text: 'cut pauses and fillers, snapped to the words', how: 'the cut rule' }] });
  if (plan.cast?.beats.length) {
    const ids = plan.cast.beats.flatMap(b => [...b.sfx, ...b.camera, ...(b.transition ? [b.transition] : [])]);
    const need = new Map(plan.cast.beats.flatMap(b => [...b.sfx, ...b.camera, ...(b.transition ? [b.transition] : [])].map(id => [id, `serves ${b.tag}: ${b.needs.join(', ')}`] as const)));
    const a = await assetCauses(ids, id => need.get(id) ?? 'cast');
    await noteDecision(rows, run, { kind: 'cast', agent: 'editor', choice: `${new Set(ids).size} library pieces (sound, camera, transitions)`, why: `cast by need from the library graph (${plan.cast.source})`, causes: a.causes, links: a.links });
  }
  if (plan.effects?.picks.length) {
    const a = await assetCauses(plan.effects.picks.map(p => `effect:reel-${p.fx}`), id => { const p = plan.effects!.picks.find(x => `effect:reel-${x.fx}` === id); return p ? `“${p.line.slice(0, 60)}” needs ${p.needs.join(', ')}` : 'effect'; });
    await noteDecision(rows, run, { kind: 'effects', agent: 'editor', choice: plan.effects.picks.map(p => p.fx).join(', '), why: `effects that serve what the clip says (${plan.effects.source})`, causes: a.causes, links: a.links });
  }
}

export const editReel: Handler = async ctx => {
  const inp = ctx.input<{ upload: string; caption?: string; names?: string[]; brief?: string }>();
  const [u] = (await ctx.q<Upload>(P.uploads, { chat: ctx.chat })).filter(x => x.id === inp.upload);
  if (!u) throw new Error('The clip to edit is missing');
  const t0 = Date.now();
  const lines = stageLines(ctx.chat, ctx.task.id), said = new Map<string, string>();
  const step = async (stage: string, text: string) => { said.set(stage, text); lines.start('editor', stage, text); await publish(ctx.chat, { type: 'status', agent: 'editor', state: 'working', text, task: `${ctx.task.id}:editor` }).catch(() => undefined); void activity(ctx.chat, 'editor', ctx.task.id, 'start', text, { scope: stage }); };
  const done = (stage: string, s: number) => { console.log(`[edit] ${ctx.task.id} ${stage} ${s.toFixed(1)} s`); lines.done('editor', stage, Math.round(s * 1000), said.get(stage) ?? stage); void activity(ctx.chat, 'editor', ctx.task.id, 'done', `${stage} · ${s.toFixed(1)} s`, { ms: Math.round(s * 1000), scope: stage }); };

  await ctx.say(`I’ll edit ${u.name}: cut the pauses, punch in on each new thought and caption every word. It plays live as soon as the plan is ready.`, 'note', undefined, 'moovi');
  const dir = join(ctx.dir, 'edit');
  // probe, look, hear, plan, and the voice clean-up started beside the preview: one function, the bench runs it too
  const plan = await planEdit({ path: u.path, dir, name: u.name, signal: ctx.signal, onStage: step, onDone: done, onNote: text => ctx.activity('note', text),
    style: 'auto', brief: inp.brief ?? '', requireWords: !NO_WORDS.test(inp.brief ?? ''), ...(inp.caption ? { caption: inp.caption } : {}), ...(inp.names?.length ? { names: inp.names } : {}), asks: inp.brief ?? '', footage: (process.env.MOOVI_EDIT_FOOTAGE ?? 'on') !== 'off' }).finally(() => lines.end());
  void plan.restore.then(r => r && ctx.activity('note', r.restored
    ? `cleaned and upscaled your clip from ${r.from.w}x${r.from.h} to ${r.to.w}x${r.to.h}${r.graded ? ', graded' : ''} (${r.seconds} s)`
    : `graded your clip (${r.seconds} s)`));
  const { edl, words, lap } = plan, pr ={ duration: plan.source.duration, width: plan.source.w, height: plan.source.h };
  await recordEditWhy(ctx, plan, inp);
  const t = { duration: plan.duration };

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
  // the reel effects library, picked from what the clip says (edit/effects/auto.ts), baked into the edit itself: the
  // plan's cut with the effects and the captions drawn over it (edit/effects/onedit.ts) becomes the delivered version,
  // so the studio and the Claude Code bridge both get one finished video with the effects in it
  let fxVersion: number | null = null;
  // one film (edit wiring step 3): when the director wrote a beat spec, the delivered MP4 is the preview page itself,
  // captured frame by frame (edit/film.ts), over the soundtrack the preview then plays too (mix.m4a: voice, bed, sounds)
  if (plan.beats && plan.beats.picks.length && (process.env.MOOVI_EDIT_FILM ?? 'on') !== 'off') {
    const names = [...new Set(plan.beats.picks.map(p => p.id.replace(/^[a-z0-9]+:(reel-|edit-|x1-\d+-|s1-)?/, '').replace(/-/g, ' ')))];
    await ctx.say(`Your edit has ${plan.beats.picks.length} moments from the library (${names.join(', ')}), in the preview above. The finished video with the same moments follows in a few minutes.`, 'note', undefined, 'moovi');
    try {
      const lines = fxLines(words.map(w => ({ word: w.word, t: w.t, end: w.end }))).map(l => l.text);
      const bed = await fxMusic(lines, plan.duration, ctx.signal ? { signal: ctx.signal } : {});
      await plan.restore.catch(() => null); const cleaned = await plan.voice.catch(() => null);
      const clips = (await plan.footage.catch(() => [])).filter(c => c.frames > 0);
      if (clips.length) await ctx.activity('note', `real footage for ${clips.map(c => `"${c.query}"`).join(', ')} (${clips.map(c => c.provider).join(', ')})`);
      if (cleaned?.file && existsSync(cleaned.file)) { const m = await filmMix(dir, { voice: cleaned.file, bed: bed ? { file: bed.file } : null }); useMix(dir, m.file); }
      const v2 = version + 1, file = join(vdir, `v${v2}.mp4`), r = await renderFilm({ dir, out: file });
      await ctx.q(P.setVideo, { id: ctx.run.video, status: 'ready', path: file, poster, duration: +t.duration.toFixed(2), version: v2, style: 'edit+film', format: 'vertical', at: Date.now() });
      await publish(ctx.chat, { type: 'video', video: { id: ctx.run.video, status: 'ready', version: v2, duration: +t.duration.toFixed(2), format: 'vertical' } });
      await ctx.say(`Here’s your finished edit, the same film as the preview${bed ? `, music: ${bed.pick.track.title}` : ''}${clips.length ? `, footage: ${clips.map(c => c.credit).join('; ')}` : ''} (rendered in ${r.seconds.toFixed(0)} s).`, 'video', { video: ctx.run.video, version: v2, duration: +t.duration.toFixed(2), format: 'vertical', run: ctx.run.id, style: 'edit+film' }, 'moovi');
      fxVersion = v2;
    } catch (e) {
      const why = fxReason(e);
      console.warn(`[edit] film: ${why}`);
      await ctx.say(`The finished video did not render this time (${why}); the live edit above stands.`, 'note', undefined, 'moovi');
    }
  }
  const fx = plan.beats ? { go: false, why: 'the director cast the effects into the beat spec (one film)' } : fxFilmFor(plan);
  if (fx.go && plan.effects) {
    const names = [...new Set(plan.effects.events.map(e => FX[e.fx].label))];
    await ctx.say(`Adding ${names.length} effects from the library to your edit (${names.join(', ')}). The finished video follows in a few minutes; the live preview above is yours meanwhile.`, 'note', undefined, 'moovi');
    try {
      const lines = fxLines(words.map(w => ({ word: w.word, t: w.t, end: w.end }))).map(l => l.text);
      const bed = await fxMusic(lines, plan.source.duration, ctx.signal ? { signal: ctx.signal } : {});
      const restored = await plan.restore.catch(() => null), cleaned = await plan.voice.catch(() => null);
      const { renderEditFx } = await import('../edit/effects/onedit');
      const v2 = version + 1, file = join(vdir, `v${v2}.mp4`), tr = Date.now();
      console.log(`[edit] ${ctx.task.id} effects render start: ${plan.effects.events.length} effects, ${plan.duration.toFixed(1)} s of film`);
      const base = { video: restored?.file && existsSync(restored.file) ? restored.file : u.path, shots: edl.shots, words: words.map(w => ({ word: w.word, t: w.t, end: w.end })), out: file, audio: plan.source.hasAudio !== false, voice: cleaned?.file ?? null };
      let r: Awaited<ReturnType<typeof renderEditFx>>;
      try { r = await renderEditFx({ ...base, events: plan.effects.events, work: join(dir, 'fx-work'), music: bed ? { file: bed.file } : null }); }
      catch (e1) {
        // one simpler try before giving up: the source clip, no music bed, no effect that needs the person cutout
        const why1 = fxReason(e1);
        console.warn(`[edit] effects edit, first try: ${why1}`);
        await ctx.activity('note', `effects render hit a problem (${why1}), trying once more without the music and the cutout`);
        const simple = plan.effects.events.filter(e => !FX[e.fx].behind);
        r = await renderEditFx({ ...base, video: u.path, events: simple.length ? simple : plan.effects.events, work: join(dir, 'fx-work-2'), music: null });
      }
      const used = [...new Set(r.events.map(e => FX[e.fx].label))];
      console.log(`[edit] ${ctx.task.id} effects render done in ${((Date.now() - tr) / 1000).toFixed(1)} s (${used.join(', ')})${r.events.length < plan.effects.events.length ? `; ${plan.effects.events.length - r.events.length} dropped at render` : ''}`);
      await ctx.q(P.setVideo, { id: ctx.run.video, status: 'ready', path: file, poster, duration: +r.seconds.toFixed(2), version: v2, style: 'edit+fx', format: 'vertical', at: Date.now() });
      await publish(ctx.chat, { type: 'video', video: { id: ctx.run.video, status: 'ready', version: v2, duration: +r.seconds.toFixed(2), format: 'vertical' } });
      await ctx.say(`Here’s your finished edit with effects: ${used.join(', ')}${bed ? `, music: ${bed.pick.track.title}` : ''}.`, 'video', { video: ctx.run.video, version: v2, duration: +r.seconds.toFixed(2), format: 'vertical', run: ctx.run.id, style: 'edit+fx' }, 'moovi');
      fxVersion = v2;
    } catch (e) {
      const why = fxReason(e);
      console.warn(`[edit] effects edit: ${why}`);
      await ctx.say(`The effects did not render onto the edit this time (${why}); the live edit above stands.`, 'note', undefined, 'moovi');
    }
  } else {
    // a skipped effects pass says why, so a plain edit is never a silent surprise
    console.warn(`[edit] no effects film: ${fx.why}`);
    await ctx.activity('note', `no effects this time: ${fx.why}`);
  }
  const vids = await ctx.q<{ video: string }>(P.videos), chats = await ctx.q<{ id: string }>(P.chats);
  await runQ(SYS, S.touchProject, { id: ctx.pid, name: null, chats: chats.length, videos: vids.length, poster, at: Date.now() });
  return { output: { dir, version, timings: ref.timings, duration: t.duration, shots: edl.shots.length, words: words.length, style: plan.style, moves: plan.moves, effects: plan.effects?.events.map(e => e.fx) ?? [], fx: fx.why, fxVersion }, note: `edit ready in ${seconds.toFixed(1)} s` };
};
