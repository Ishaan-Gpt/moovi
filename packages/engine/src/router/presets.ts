import { project as P } from '@moovi/graph';
import type { Command, Preset, Trim } from '../commands';
import { PRESETS } from '../commands';
import type { Handler } from '../ctx';
import { pq, say } from '../live';
import { startRun } from '../runs';
import { styleReel } from '../tasks/reel';
import { editReel, editTarget } from './edit';
import { linkIn } from './pipeline-job';
import { LAUNCH_NEEDS_LINK, NEED_VIDEO, NO_PRESET, SHOWREEL_NEEDS_TEXT } from './pipeline-words';

/**
 * Three presets, no generic prompt (decision 19). The studio offers exactly Edit, Launch video and Showreel and the user
 * picks one first; the router sends each to its own path and refuses a brief with none:
 * - Edit: an uploaded video is required; today's edit job (router/edit.ts, Edit mastery's player) runs on it with the
 *   part picked at upload as its trim {in, out} (the edit job cuts it; a bad span edits the whole clip).
 * - Launch video: Launch mastery's skill-driven writer (launch/skill.ts through the launch style), which reads the site.
 * - Showreel: the Showreel session's entry, showreel/index.ts `showreel()`, run as a live style reel (the writer picks
 *   the theme; its renderer plays the film).
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

const withInput = <T>(ctx: Parameters<Handler>[0], v: T) => Object.create(ctx, { input: { value: () => v } }) as typeof ctx;

export const presetJob: Handler = async ctx => {
  const inp = ctx.input<PresetInput>();
  if (inp.preset === 'edit') {
    const all = await ctx.q<Upload>(P.uploads, { chat: ctx.chat });
    const u = inp.uploads.map(id => all.find(x => x.id === id)).find(x => x?.mime.startsWith('video/'));
    if (!u) throw new Error('The clip to edit is missing');
    await ctx.q(P.setUploadProbe, { id: u.id, probe: null, role: 'footage', why: 'the Edit preset' });
    const target = editTarget({ text: inp.text, uploads: [u.id] }, [u], true) ?? { upload: u.id };
    const trim = inp.trim && inp.trim.upload === u.id ? { in: inp.trim.in, out: inp.trim.out } : undefined;
    return editReel(withInput(ctx, { ...target, brief: inp.text, ...(trim ? { trim } : {}) }));
  }
  if (inp.preset === 'launch') return styleReel(withInput(ctx, { style: 'launch' as const, url: inp.url ?? linkIn(inp.text)! }));
  // the theme is the writer's pick (no theme choice in the UI until Ishaan says); `style` gives way to its renderer
  return styleReel(withInput(ctx, { style: 'darkvox' as const, showreel: { brief: inp.text, ...(inp.url ? { url: inp.url } : {}) } }));
};
