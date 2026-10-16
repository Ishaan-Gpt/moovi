import { copyFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { extname, join } from 'node:path';
import { color } from '@moovi/brand';
import { sttAvailable } from '../audio/stt';
import { probe } from '../bench';
import { buildEdl } from './build';
import { envelope, pauses, type Word } from './cut';
import { keepOf, validateEdl } from './edl';
import { hear, type Heard } from './hear';
import { EDIT, type PlayerEdl } from './lib';
import { lookFaces } from './look';
import { roughEdl } from './rough';
import { romanizeWords } from './romanize';
import { cleanVoice, type CleanVoice } from './voice';

/**
 * The upload edit's plan stage, one function: probe, look (faces) beside hear (D1.2), the EDL (D1.3), and the voice
 * clean-up (D1.2b) started beside the preview. The studio's edit job (router/edit.ts) and the bench
 * (scripts/edit-bench.ts) both call this, so the bench measures the same path the studio runs, never a shortcut.
 * Writes src.<ext>, words.json, hear.json and edl.json into `dir`; voice.m4a and voice.json when the clean-up ends.
 */
export interface PlanInput {
  /** the uploaded clip on disk */
  path: string;
  /** the edit's working folder (created) */
  dir: string;
  /** the clip's display name (its extension names the copy) */
  name?: string;
  caption?: string;
  names?: string[];
  signal?: AbortSignal;
  /** a stage starts (probe, hear, plan) */
  onStage?: (stage: string, text: string) => unknown;
  /** a stage ends, with its seconds */
  onDone?: (stage: string, seconds: number) => unknown;
  /** something the person should know (no speech key, a weak transcript, the stand-in plan) */
  onNote?: (text: string) => unknown;
  /** write Hinglish heard in Devanagari in Latin letters for the captions (default true) */
  romanize?: boolean;
  /** start the voice clean-up (default true) */
  voice?: boolean;
}
export interface Planned {
  edl: PlayerEdl;
  words: Word[];
  language?: string;
  heard: Heard | null;
  faces: number;
  /** seconds per stage */
  lap: Record<string, number>;
  /** the output length (EDIT.timeline) */
  duration: number;
  source: { file: string; duration: number; w: number; h: number; fps: number; hasAudio: boolean };
  /** true when the builder failed and roughEdl planned the edit */
  rough: boolean;
  /** the voice clean-up, running; resolves null when there is no audio or it failed */
  voice: Promise<CleanVoice | null>;
}

export const EDIT_PALETTE = () => ({ ink: color.ink, paper: color.surface, accent: color.ice, accent2: color.frostMid, deep: color.ink, pop: color.iceWhite });

export async function planEdit(o: PlanInput): Promise<Planned> {
  const lap: Record<string, number> = {}; let tl = Date.now();
  const done = async (stage: string) => { lap[stage] = +((Date.now() - tl) / 1000).toFixed(2); tl = Date.now(); await o.onDone?.(stage, lap[stage]!); };
  const dir = o.dir; mkdirSync(dir, { recursive: true });
  const file = `src${extname(o.name ?? o.path).toLowerCase() || '.mp4'}`;
  await o.onStage?.('probe', 'measuring your clip');
  copyFileSync(o.path, join(dir, file));
  const pr = await probe(o.path);
  if (!pr.hasVideo) throw new Error(`${o.name ?? 'the clip'} has no video stream`);
  await done('probe');

  // D1.3 look: the speaker's face, beside the hearing (edit/look.ts; [] without a face detector), for crop and punch-ins
  const lookP = lookFaces(o.path, pr.duration);
  await o.onStage?.('hear', 'timing every word');
  // D1.2: language-locked, in pieces, the accurate text laid on, and a confidence gate (edit/hear.ts)
  let words: Word[] = [], language: string | undefined, heard: Heard | null = null;
  if (pr.hasAudio && sttAvailable()) {
    // the vocabulary prompt: Moovi, Ishaan, MOOVI_VOCAB and the project's own names
    heard = await hear(o.path, dir, { ...(o.signal ? { signal: o.signal } : {}), ...(o.names?.length ? { names: o.names } : {}) });
    words = heard.words; language = heard.language;
    writeFileSync(join(dir, 'hear.json'), JSON.stringify({ language: heard.language, lang: heard.lang, detected: heard.detected, by: heard.by, prompt: heard.prompt, gate: heard.gate, pieces: heard.pieces, timings: heard.timings }, null, 1));
    if (!heard.gate.ok) await o.onNote?.(`the transcript may be off (${heard.gate.reasons.join('; ')}), so check the captions`);
  } else if (pr.hasAudio) await o.onNote?.('no speech-to-text key, so no cuts or captions from words this time');
  // Hinglish heard in Devanagari is captioned in Latin letters, as Indian reels are (edit/romanize.ts); times unchanged
  if (o.romanize !== false && words.length) {
    const r = await romanizeWords(words, o.signal ? { signal: o.signal } : {});
    if (r) { writeFileSync(join(dir, 'words.heard.json'), JSON.stringify(words, null, 1)); words = r.words; await o.onNote?.(`Hinglish captions in Latin letters (${r.changed} words written out)`); }
  }
  writeFileSync(join(dir, 'words.json'), JSON.stringify(words, null, 1));
  await done('hear');

  await o.onStage?.('plan', 'planning the cuts');
  const palette = EDIT_PALETTE();
  // D1.3: the EDL builder (edit/build.ts): take window, pause and filler cuts snapped to words, a framing per sentence
  const ps = pr.hasAudio ? pauses(await envelope(o.path)) : [];
  const look = await lookP;
  const source = { file, duration: pr.duration, w: pr.width ?? 1080, h: pr.height ?? 1920, fps: pr.fps ?? 30 };
  let edl: PlayerEdl, rough = false;
  try {
    const e = buildEdl({ source, words, pauses: ps, palette, ...(look.faces.length ? { faces: look.faces } : {}), style: { id: 'base', ...(o.caption ? { caption: o.caption } : {}) }, ...(language ? { language } : {}) });
    const bad = validateEdl(e).problems.filter(p => !p.startsWith('version'));
    if (bad.length) throw new Error(bad.slice(0, 3).join('; '));
    edl = e;
  } catch (e) {
    // if the builder throws or its EDL does not validate, the stand-in plan (rough.ts) still gives an edit
    console.warn(`[edit] builder failed, rough plan instead: ${String((e as Error).message ?? e).slice(0, 200)}`);
    await o.onNote?.('the full edit planner hit a problem, so this is the simple cut');
    edl = roughEdl(source, words.map(w => ({ word: w.word, t: w.t, end: w.end })), { palette, captionStyle: o.caption ?? 'punch-duo' });
    rough = true;
  }
  const t = EDIT.timeline(edl);
  if (t.problems.length) throw new Error(`The edit plan is inconsistent: ${t.problems.join('; ')}`);
  writeFileSync(join(dir, 'edl.json'), JSON.stringify(edl, null, 1));
  await done('plan');
  // D1.2b: the voice cleaned on the film's clock (edit/voice.ts), beside the preview (it does not hold the first frame)
  const voice: Promise<CleanVoice | null> = pr.hasAudio && o.voice !== false
    ? cleanVoice(join(dir, file), join(dir, 'voice.m4a'), { dir, keep: keepOf(edl) })
      .then(v => { writeFileSync(join(dir, 'voice.json'), JSON.stringify(v, null, 1)); return v; })
      .catch(e => { console.warn(`[edit] voice clean-up: ${String((e as Error).message ?? e).slice(0, 160)}`); return null; })
    : Promise.resolve(null);
  return { edl, words, ...(language ? { language } : {}), heard, faces: look.faces.length, lap, duration: t.duration, source: { ...source, hasAudio: pr.hasAudio }, rough, voice };
}
