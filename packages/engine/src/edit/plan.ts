import { execFile } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { z } from 'zod';
import { probe } from '../bench';
import { config } from '../config';
import { ask } from '../runtime';
import { buildEdl, sentences, type BuildInput, type Face, type Laws } from './build';
import { envelope, pauses, type Word } from './cut';
import { quietPauses } from './voice';
import { lookFaces } from './look';
import { validateEdl, type Edl, type EdlBeat } from './edl';
import type { Palette } from './lib';

/**
 * Plan an edit of one clip: the media work around the pure builder (build.ts). Probe, one 16 kHz mono read of the
 * voice, its loudness pauses, the words (given, or heard by `hear`), beat tags from ONE fast model call (optional; rule
 * tags otherwise), then `buildEdl` and `validateEdl`. Every stage is timed; nothing here renders or encodes.
 */
export interface PlanOpts {
  input: string; dir: string; palette: Palette;
  words?: Word[];
  hear?: (audio: string, dir: string) => Promise<Word[]>;
  /** face keys when known; else the look step finds them (unless `look` is false) */
  faces?: Face[];
  look?: boolean;
  /** ask the model for beat tags (one call, fast tier, 12 s budget); false keeps the rule tags */
  tag?: boolean;
  style?: BuildInput['style']; laws?: Partial<Laws>; seed?: number; signal?: AbortSignal;
  /** the clip's own file name inside the edit folder (the player resolves `source.file` against the EDL's folder) */
  file?: string;
}
export interface Plan { edl: Edl; audio: string; words: Word[]; timings: Record<string, number>; problems: string[]; faces: { n: number; why?: string } }

const run = (args: string[]) => new Promise<void>((res, rej) => execFile(config.ffmpeg, args, { timeout: 60_000, killSignal: 'SIGKILL' }, e => e ? rej(e) : res()));

export const TAGS = ['hook', 'claim', 'number', 'list', 'story', 'quote', 'name', 'cta', 'aside'] as const satisfies readonly EdlBeat['tag'][];

/** One model call: a tag per sentence (what a style may show for it). Null when no model answers in time. */
export async function tagBeats(lines: string[], signal?: AbortSignal): Promise<Record<number, EdlBeat['tag']> | null> {
  if (!lines.length) return {};
  try {
    const a = await ask({
      agent: 'edit:beats', tier: 'fast', maxTurns: 1, deadlineMs: 12_000, ...(signal ? { signal } : {}),
      system: 'You tag each sentence of a person talking to camera with what it does in the video, so an editor knows what to show: hook (the opening that grabs), claim (a statement or promise), number (a figure, price, time or count matters), list (names several items), story (something that happened), quote (repeats someone), name (introduces a product, person or place), cta (asks the viewer to act), aside (a filler remark). One tag per sentence, by its index.',
      prompt: lines.map((l, i) => `${i}: ${l}`).join('\n'),
      schema: { tags: z.array(z.object({ i: z.number().int(), tag: z.enum(TAGS) })) },
    });
    const out: Record<number, EdlBeat['tag']> = {};
    for (const t of a.tags) if (t.i >= 0 && t.i < lines.length) out[t.i] = t.tag;
    return out;
  } catch { return null; }
}

export async function planEdit(o: PlanOpts): Promise<Plan> {
  const timings: Record<string, number> = {}, t0 = Date.now(); let tl = t0;
  const lap = (k: string) => { timings[k] = +((Date.now() - tl) / 1000).toFixed(3); tl = Date.now(); };
  mkdirSync(o.dir, { recursive: true });
  const pr = await probe(o.input);
  if (!pr.hasVideo) throw new Error('the clip has no video stream');
  lap('probe');
  const audio = join(o.dir, 'voice16k.wav');
  let ps: [number, number][] = [];
  if (pr.hasAudio) {
    await run(['-nostdin', '-v', 'error', '-y', '-i', o.input, '-vn', '-ac', '1', '-ar', '16000', '-c:a', 'pcm_s16le', audio]);
    ps = pauses(await envelope(audio));
  }
  lap('loudness');
  // the look step runs beside the hearing (separate processes, no shared work); its own clock is `look`
  const lookP = o.faces || o.look === false ? Promise.resolve({ faces: o.faces ?? [], seconds: 0, why: o.faces ? 'given' : 'off' }) : lookFaces(o.input, pr.duration);
  const quietP = pr.hasAudio ? quietPauses(o.input, { dir: o.dir }) : Promise.resolve(null);
  const words = o.words ?? (pr.hasAudio && o.hear ? await o.hear(audio, o.dir) : []);
  lap('hear');
  const look = await lookP, quiet = await quietP;
  timings.look = look.seconds; tl = Date.now();
  let tags: Record<number, EdlBeat['tag']> | undefined;
  if (o.tag && words.length) {
    const ids = sentences(words), lines: string[] = [];
    words.forEach((w, k) => { lines[ids[k]!] = `${lines[ids[k]!] ?? ''} ${w.word}`.trim(); });
    tags = (await tagBeats(lines, o.signal)) ?? undefined;
  }
  lap('tags');
  const source = { file: o.file ?? 'src.mp4', duration: pr.duration, w: pr.width ?? 1080, h: pr.height ?? 1920, fps: pr.fps ?? 30 };
  const edl = buildEdl({ source, words, pauses: ps, ...(quiet ? { quiet: quiet.pauses } : {}), palette: o.palette, ...(look.faces.length ? { faces: look.faces } : {}), ...(tags ? { tags } : {}), ...(o.style ? { style: o.style } : {}), ...(o.laws ? { laws: o.laws } : {}), ...(o.seed !== undefined ? { seed: o.seed } : {}) });
  const { problems } = validateEdl(edl);
  lap('build');
  timings.total = +((Date.now() - t0) / 1000).toFixed(3);
  return { edl, audio, words, timings, problems, faces: { n: look.faces.length, ...(look.why ? { why: look.why } : {}) } };
}
