/**
 * The Edit type exactly as the studio runs it (router/edit.ts, the mastery path), on a local clip: planEdit with the
 * player path's settings, the graded cut, the look from the footage, then the spec from the free model's menu (compact,
 * the server's tier, through router/edit.ts's own directedFromMenu) or the skeleton, and the player served on a local port. This is the one local way to make an edit;
 * the old edit-round1.ts runs the retired page's casting and must not be used for the Edit type.
 *
 *   pnpm --filter @moovi/engine exec tsx --env-file-if-exists=../../.env.local scripts/edit-mastery.ts <clip.mp4>
 *     [--out edit-x] [--from 9] [--spec skeleton|menu|keep] [--brief "..."] [--port 4610] [--mp4]
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';
import { config } from '../src/config';
import { planEdit } from '../src/edit/job';
import { prepareClip, renderMasteryFilm, serveMastery, skeletonSpec, writeSpec } from '../src/edit/mastery';

const args = process.argv.slice(2), flag = (k: string) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : undefined; };
const clip = resolve(args[0] ?? ''); if (!existsSync(clip)) { console.error('usage: edit-mastery.ts <clip.mp4> [--out edit-x] [--from s] [--spec skeleton|menu|keep] [--port n] [--mp4]'); process.exit(1); }
const out = join(config.data, flag('--out') ?? `edit-${basename(clip).replace(/\W+/g, '-').slice(0, 24)}`), dir = join(out, 'edit');
mkdirSync(dir, { recursive: true });
const from = Number(flag('--from') ?? 0);
let src = clip;
if (from > 0) { src = join(out, `from-${from}.mp4`); if (!existsSync(src)) execFileSync(config.ffmpeg, ['-v', 'error', '-y', '-ss', String(from), '-i', clip, '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '14', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '192k', '-movflags', '+faststart', src]); }

const t0 = Date.now(), lap = (s: string) => console.log(`${((Date.now() - t0) / 1000).toFixed(1).padStart(6)} s  ${s}`);
// --reuse: the plan and the graded cut already on disk (only the direction runs again)
const reuse = args.includes('--reuse') && existsSync(join(dir, 'cut.mp4'));
const plan = reuse
  ? (() => { const edl = JSON.parse(readFileSync(join(dir, 'edl.json'), 'utf8')); const w = JSON.parse(readFileSync(join(dir, 'words.json'), 'utf8')); return { edl, words: Array.isArray(w) ? w : w.words, source: edl.source, duration: 0 } as unknown as Awaited<ReturnType<typeof planEdit>>; })()
  : await planEdit({ path: src, dir, name: basename(clip), onStage: (_s, text) => lap(text), library: false, inserts: false, effects: false, beats: false, moves: [], check: false, brief: flag('--brief') ?? '', requireWords: true, asks: flag('--brief') ?? '', footage: process.env.MOOVI_EDIT_FOOTAGE === 'on' });
if (!reuse) {
  lap(`plan: ${plan.duration.toFixed(1)} s, ${plan.edl.shots.length} shots, ${plan.words.length} words`);
  const r = await plan.restore.catch(() => null);
  await prepareClip(dir); lap(`graded cut ${r ? '(restored)' : ''}`);
}
// --spec keep: serve the spec already in the folder (one written by hand, the full tier)
if (flag('--spec') !== 'keep') writeSpec(dir, skeletonSpec(dir));

if ((flag('--spec') ?? 'menu') === 'menu') {
  const words = plan.words, edl = plan.edl as { removed?: { src_in: number; src_out: number }[] };
  const kept = words.filter(w => !(edl.removed ?? []).some(x => w.t >= x.src_in - 1e-3 && w.t < x.src_out - 1e-3));
  const prevFile = join(config.data, 'edit-last-film.json');
  let previous: string[] = []; try { previous = (JSON.parse(readFileSync(prevFile, 'utf8')) as { devices: string[] }).devices; } catch { previous = []; }
  // the studio's own menu step (router/edit.ts): the Designer's library ranks, the model's picks, the checklist completion,
  // Sound's sfx and bed, the footage; a local run has no signed-in user, so its memory is only the last film here
  const { directedFromMenu } = await import('../src/router/edit');
  const d = await directedFromMenu(dir, kept.map(w => ({ word: w.word, t: w.t, end: w.end })), plan.source.duration, flag('--brief') ?? '', { previous, notes: [] }, undefined, { tag: (agent, kind, text) => lap(`${agent} ${kind}: ${text}`) });
  writeSpec(dir, d.value ?? skeletonSpec(dir));
  writeFileSync(prevFile, JSON.stringify({ devices: d.devices }));
  lap(`directed: ${d.devices.join(' ') || 'the skeleton'}; model problems: ${d.problems.flat().slice(0, 3).join('; ') || 'none'}`);
}
if (args.includes('--mp4')) { const f = await renderMasteryFilm(dir, join(out, 'edit.mp4')); lap(`mp4 ${f.out} in ${f.seconds.toFixed(0)} s`); }
const s = await serveMastery(dir, { port: Number(flag('--port') ?? 4610) });
lap(`preview: ${s.url}`);
