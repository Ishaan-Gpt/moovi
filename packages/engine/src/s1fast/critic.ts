import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { z } from 'zod';
import { config } from '../config';
import { sheet } from '../render/sheet';
import { ask, tool } from '../runtime';
import { meUrls } from './preview';

/**
 * The art director's eye: one still per scene (at the moment it reads best) next to frames from the owner's own
 * finished Style 1 films, judged by a model that SEES both. Geometry QA catches clipping; this catches what the owner
 * catches: an empty stage, a weak or off-topic visual, a prop with cut text, a scene that doesn't show what is said.
 */

type Obj = Record<string, any>;
export interface Note { scene: number; verdict: 'keep' | 'fix'; severity: number; note: string }

/** A contact sheet of the owner's gold films (cached): the bar every scene is judged against. */
function referenceSheet(): string | null {
  const out = join(config.data, 'cache', 's1ref', 'gold.png');
  if (existsSync(out)) return out;
  const vids = ['ce-11-hormozi-style', 'ce-10-teen-galtiyaan', 'ce-12-kia-scene-hai'].map(v => join(config.data, 'library', 'style-1', 'videos', v, `${v}.mp4`)).filter(existsSync);
  if (!vids.length) return null;
  mkdirSync(join(config.data, 'cache', 's1ref'), { recursive: true });
  const parts = vids.map((v, i) => { const p = join(config.data, 'cache', 's1ref', `r${i}.png`); execFileSync(config.ffmpeg, ['-v', 'error', '-y', '-i', v, '-vf', 'fps=1/4,scale=216:384,tile=4x1', '-frames:v', '1', p]); return p; });
  execFileSync(config.ffmpeg, ['-v', 'error', '-y', ...parts.flatMap(p => ['-i', p]), '-filter_complex', `vstack=inputs=${parts.length}`, out]);
  return out;
}

export async function critique(o: { spec: Obj; timeline: Obj; dir: string; board: { scenes: { name: string; text: string; idea: string }[] }; log?: (s: string) => void }): Promise<Note[]> {
  const T = o.timeline, n = Math.min(o.board.scenes.length, T.scenes.length);
  // each scene at 70% of its length: the visual has landed, the line is fully on screen
  const times = Array.from({ length: n }, (_, i) => { const sc = T.scenes[i]; return +((sc.f0 + (sc.f1 - sc.f0) * 0.7) / 30).toFixed(2); });
  const film = await sheet(meUrls(o.spec), times, join(o.dir, 'review'), { scale: 0.3, cols: Math.min(6, n), name: 'scenes' });
  const ref = referenceSheet();
  const img = (p: string) => ({ data: readFileSync(p).toString('base64'), mime: 'image/png' as const });
  const look = tool({
    name: 'look', description: 'See the stills: this video (one per scene, left to right, top to bottom) and the owner\'s gold films (the bar).', input: {},
    async run() { return { text: `This video: scenes 1..${n} in order. ${ref ? 'Second image: the owner\'s finished Style 1 films (3 films, 4 frames each).' : ''}`, images: [img(film.sheet), ...(ref ? [img(ref)] : [])] }; },
  });
  const out = await ask({
    agent: 's1-critic', tier: 'crew', tools: [look], maxTurns: 4, deadlineMs: 90_000,
    system: 'You are the art director of a Style 1 short (a voice-led 9:16 explainer on a light stage). You judge stills against the owner\'s finished films and send precise, fixable notes. Call look first.',
    prompt: `Scenes (what is said · the planned idea):\n${o.board.scenes.slice(0, n).map((s, i) => `${i + 1}. "${s.text}" · ${s.idea}`).join('\n')}\n\nFor EVERY scene return keep or fix. Fix when: the stage is mostly empty; the visual is small, generic or doesn't show what is said; text inside a prop/button is cut off or unreadable; text is crowded, off-centre or too close to an edge; it looks weaker than the owner's films. The note must say exactly what to change (e.g. "button text 'Download' is cut to 'Downloa': widen the pill to 420 or shorten to 'Get it'", "stage empty below the title: add a big phone prop at cy 1150 showing ..."). Be strict: the owner's films are the bar.`,
    schema: { scenes: z.array(z.object({ scene: z.number().int(), verdict: z.enum(['keep', 'fix']), severity: z.number().int().min(1).max(5).describe('5 = broken/empty, 1 = minor polish'), note: z.string() })) },
  });
  return out.scenes.map(s => ({ ...s, scene: s.scene - 1 })).filter(s => s.scene >= 0 && s.scene < n).sort((a, b) => b.severity - a.severity);
}
