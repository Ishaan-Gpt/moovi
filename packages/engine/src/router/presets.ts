import { createHash } from 'node:crypto';
import { createReadStream, statSync } from 'node:fs';
import { dirname, extname, join } from 'node:path';
import { project as P } from '@moovi/graph';
import { probe, sh } from '../bench';
import type { Command, Preset, Trim } from '../commands';
import { PRESETS } from '../commands';
import { config } from '../config';
import type { Handler } from '../ctx';
import { newId } from '../ids';
import { pq, say } from '../live';
import { startRun } from '../runs';
import { styleReel } from '../tasks/reel';
import { editReel, editTarget } from './edit';
import { linkIn } from './pipeline-job';
import { LAUNCH_NEEDS_LINK, NEED_VIDEO, NO_PRESET, SHOWREEL_NEEDS_TEXT, SHOWREEL_NOT_READY } from './pipeline-words';
import { showreel } from './showreel-entry';

/**
 * Three presets, no generic prompt (decision 19). The studio offers exactly Edit, Launch video and Showreel and the user
 * picks one first; the router sends each to its own path and refuses a brief with none:
 * - Edit: an uploaded video is required; a trim (picked at upload) cuts that part out first, then today's edit job
 *   (router/edit.ts, Edit mastery's player) runs on it unchanged.
 * - Launch video: Launch mastery's skill-driven writer (launch/skill.ts through the launch style), which reads the site.
 * - Showreel: the Showreel session's entry (router/showreel-entry.ts, a stub until it lands).
 * No fallback to the old style pipelines or Auto (decision 18). MOOVI_DEFAULT_STYLE=crew is the only way past the
 * refusal (the old router, emergency only, decision 4).
 */
export const PRESET_KIND = 'preset';
type Brief = Extract<Command, { type: 'brief' }>;
interface Upload { id: string; name: string; path: string; mime: string }
export interface PresetInput { preset: Preset; text: string; uploads: string[]; trim?: Trim; url?: string }

const crewIsDefault = () => (process.env.MOOVI_DEFAULT_STYLE ?? '').trim().toLowerCase() === 'crew';
const isPreset = (p: unknown): p is Preset => typeof p === 'string' && (PRESETS as readonly string[]).includes(p);

/** What a preset brief is missing before anything runs (the sentence to say), or null when it can start. Pure. */
export function presetProblem(preset: Preset | undefined, text: string, uploads: Upload[]): string | null {
  if (!isPreset(preset)) return NO_PRESET;
  if (preset === 'edit') return uploads.some(u => u.mime.startsWith('video/')) ? null : NEED_VIDEO;
  if (preset === 'launch') return linkIn(text) ? null : LAUNCH_NEEDS_LINK;
  return text.trim() ? null : SHOWREEL_NEEDS_TEXT;
}

/** A sane trim of a clip `duration` seconds long, or null (no trim, or the whole clip). Pure. */
export function trimOf(t: Trim | undefined, duration: number): { in: number; out: number } | null {
  if (!t || !Number.isFinite(t.in) || !Number.isFinite(t.out)) return null;
  const a = Math.max(0, Math.min(t.in, duration)), b = Math.max(0, Math.min(t.out, duration));
  if (b - a < 0.5) return null;
  if (a <= 0.05 && b >= duration - 0.05) return null;
  return { in: +a.toFixed(3), out: +b.toFixed(3) };
}

/**
 * Every brief goes through here first. A preset brief starts its one job (true); a brief with no preset, or one missing
 * what its preset needs, is answered with one plain sentence (true). Only MOOVI_DEFAULT_STYLE=crew lets a preset-less
 * brief through to the old router (false).
 */
export async function routePreset(cmd: Brief): Promise<boolean> {
  if (!cmd.preset && crewIsDefault()) return false;
  const all = cmd.uploads?.length ? await pq<Upload>(cmd.project, P.uploads, { chat: cmd.chat }) : [];
  const uploads = (cmd.uploads ?? []).map(id => all.find(u => u.id === id)).filter((u): u is Upload => !!u);
  const text = cmd.text ?? '';
  const problem = presetProblem(cmd.preset, text, uploads);
  if (problem) { await say(cmd.project, cmd.chat, 'moovi', problem, 'error'); return true; }
  const preset = cmd.preset!;
  const input: PresetInput = { preset, text, uploads: cmd.uploads ?? [], ...(cmd.trim ? { trim: cmd.trim } : {}), ...(preset !== 'edit' && linkIn(text) ? { url: linkIn(text)! } : {}) };
  await startRun(cmd.project, cmd.chat, {
    kind: 'make', request: { text, ratio: cmd.ratio ?? 'auto', uploads: cmd.uploads ?? [], preset },
    specs: [{ key: preset, kind: PRESET_KIND, agent: preset === 'edit' ? 'editor' : 'moovi', resource: 'cpu', title: preset === 'edit' ? 'Edit your clip' : 'Make the film', input, max: 1 }],
  });
  return true;
}

const sha256 = (file: string) => new Promise<string>((res, rej) => { const h = createHash('sha256'); createReadStream(file).on('data', d => h.update(d)).on('end', () => res(h.digest('hex'))).on('error', rej); });
const clock = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

/** Cut [in, out] out of the clip as a new upload of the chat (frame-accurate, so the edit starts where you chose). */
async function trimmed(ctx: Parameters<Handler>[0], u: Upload, t: Trim): Promise<Upload> {
  const pr = await probe(u.path);
  const cut = trimOf(t, pr.duration);
  if (!cut) return u;
  const id = newId('f'), path = join(dirname(u.path), `${id}${extname(u.path) || '.mp4'}`);
  await sh(config.ffmpeg, ['-v', 'error', '-y', '-ss', String(cut.in), '-i', u.path, '-t', String(+(cut.out - cut.in).toFixed(3)), '-map', '0:v:0', '-map', '0:a?',
    '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '16', '-c:a', 'aac', '-b:a', '192k', '-movflags', '+faststart', path], { timeout: 600_000 });
  const name = `${u.name.replace(/\.[^.]+$/, '')} (${clock(cut.in)}–${clock(cut.out)})${extname(u.name) || '.mp4'}`;
  await ctx.q(P.addUpload, { chat: ctx.chat, id, name, path, mime: 'video/mp4', size: statSync(path).size, sha: await sha256(path), at: Date.now() });
  ctx.activity('note', `kept ${clock(cut.in)} to ${clock(cut.out)} of ${u.name}`);
  return { id, name, path, mime: 'video/mp4' };
}

const withInput = <T>(ctx: Parameters<Handler>[0], v: T) => Object.create(ctx, { input: { value: () => v } }) as typeof ctx;

export const presetJob: Handler = async ctx => {
  const inp = ctx.input<PresetInput>();
  if (inp.preset === 'edit') {
    const all = await ctx.q<Upload>(P.uploads, { chat: ctx.chat });
    const u = inp.uploads.map(id => all.find(x => x.id === id)).find(x => x?.mime.startsWith('video/'));
    if (!u) throw new Error('The clip to edit is missing');
    const clip = inp.trim && inp.trim.upload === u.id ? await trimmed(ctx, u, inp.trim) : u;
    await ctx.q(P.setUploadProbe, { id: clip.id, probe: null, role: 'footage', why: 'the Edit preset' });
    const target = editTarget({ text: inp.text, uploads: [clip.id] }, [clip], true) ?? { upload: clip.id };
    return editReel(withInput(ctx, { ...target, brief: inp.text }));
  }
  if (inp.preset === 'launch') return styleReel(withInput(ctx, { style: 'launch' as const, url: inp.url ?? linkIn(inp.text)! }));
  const out = await showreel({ text: inp.text, ...(inp.url ? { url: inp.url } : {}), uploads: inp.uploads }, ctx);
  if (out) return out;
  await ctx.say(SHOWREEL_NOT_READY, 'note', undefined, 'moovi');
  return { output: { preset: 'showreel', built: false }, note: 'Showreel: not wired yet' };
};
