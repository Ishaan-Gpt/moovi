import { copyFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { extname, join } from 'node:path';
import { color } from '@moovi/brand';
import { sttAvailable } from '../audio/stt';
import { probe } from '../bench';
import { buildEdl } from './build';
import { castEdl, openLibrary, type CastTrace } from './cast';
import { envelope, pauses, type Word } from './cut';
import { keepOf, validateEdl } from './edl';
import { hear, type Heard } from './hear';
import { castInserts, openInserts, type InsertTrace } from './inserts';
import { castMoves } from './moves';
import { EDIT, type PlayerEdl } from './lib';
import { lookFaces } from './look';
import { roughEdl } from './rough';
import { ownerGrade, restoreVideo, useRestored, type Restored } from './restore';
import { cleanVoice, quietPauses, type CleanVoice } from './voice';

/**
 * The upload edit's plan stage, one function: probe, look (faces) beside hear (D1.2), the EDL (D1.3), and the voice
 * clean-up (D1.2b) started beside the preview. The studio's edit job (router/edit.ts) and the bench
 * (scripts/edit-bench.ts) both call this, so the bench measures the same path the studio runs, never a shortcut.
 * Writes src.<ext>, words.json, hear.json and edl.json into `dir`; voice.m4a and voice.json when the clean-up ends; for a
 * weak clip (low resolution or a starved bitrate) hd.mp4 and restore.json when the picture restore ends, and edl.json
 * then points at hd.mp4.
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
  /** start the voice clean-up (default true) */
  voice?: boolean;
  /** start the picture restore for a weak clip (edit/restore.ts; default true) */
  restore?: boolean;
  /** cast camera moves, sounds and transitions from the library graph per beat (edit/cast.ts; default true) */
  library?: boolean;
  /** D2.5: cast Style 1 UI cards and Editorial posters into insert frames on the beats that call for one (edit/inserts.ts; default true) */
  inserts?: boolean;
  /** D2.7: X1 moves (by number, e.g. ['13', '17', '05']) a style asks for, placed on the beats they suit (edit/moves.ts) */
  moves?: string[];
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
  /** the library cast's per-beat trace (cast.json), null when off, rough or it failed */
  cast: CastTrace | null;
  /** the inserts cast from the generation styles (inserts.json), null when off, rough or it failed */
  inserts: InsertTrace | null;
  /** why faces are missing, when they are (the look step's own words) */
  lookWhy?: string;
  /** the voice clean-up, running; resolves null when there is no audio or it failed */
  voice: Promise<CleanVoice | null>;
  /** the picture restore, running; resolves null when the clip did not need it or it failed */
  restore: Promise<Restored | null>;
}

export const EDIT_PALETTE = () => ({ ink: color.ink, paper: color.surface, accent: color.ice, accent2: color.frostMid, deep: color.ink, pop: color.iceWhite });

/** How far the library's camera moves may push in on this source (a 478 px tall clip goes soft past about 1.2x). */
export const castMaxZoom = (s: { w: number; h: number }) => Math.min(2, Math.max(1.2, 1.3 * Math.min(s.w, s.h) / 720));

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
  // the heard pauses (voice.ts quietPauses) beside the hearing: Whisper's word edges get fitted to them in the builder
  const quietP = pr.hasAudio ? quietPauses(o.path, { dir }) : Promise.resolve(null);
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
  writeFileSync(join(dir, 'words.json'), JSON.stringify(words, null, 1));
  await done('hear');

  await o.onStage?.('plan', 'planning the cuts');
  const palette = EDIT_PALETTE();
  // D1.3: the EDL builder (edit/build.ts): take window, pause and filler cuts snapped to words, a framing per sentence
  const ps = pr.hasAudio ? pauses(await envelope(o.path)) : [];
  const look = await lookP, quiet = await quietP;
  if (quiet) writeFileSync(join(dir, 'quiet.json'), JSON.stringify(quiet, null, 1));
  const source = { file, duration: pr.duration, w: pr.width ?? 1080, h: pr.height ?? 1920, fps: pr.fps ?? 30 };
  let edl: PlayerEdl, rough = false;
  try {
    const e = buildEdl({ source, words, pauses: ps, ...(quiet ? { quiet: quiet.pauses } : {}), palette, ...(look.faces.length ? { faces: look.faces } : {}), style: { id: 'base', ...(o.caption ? { caption: o.caption } : {}) }, ...(language ? { language } : {}) });
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
  // the library in the edit path: camera:<id> moves (by the needs each beat's tag SERVES, framed on the face keys),
  // sfx by the library's events and transitions on beat changes, all from the FalkorDB graph (catalogue if it is down)
  let cast: CastTrace | null = null;
  if (!rough && o.library !== false) {
    try {
      const before = JSON.stringify(edl);
      cast = await castEdl(edl as never, { lib: await openLibrary(), maxZoom: castMaxZoom(source) });
      const bad = validateEdl(edl as never).problems.filter(p => !p.startsWith('version'));
      if (bad.length || EDIT.timeline(edl).problems.length) { edl = JSON.parse(before); cast = null; console.warn(`[edit] library cast undone: ${bad.slice(0, 2).join('; ')}`); }
      else writeFileSync(join(dir, 'cast.json'), JSON.stringify(cast, null, 1));
    } catch (e) { console.warn(`[edit] library cast: ${String((e as Error).message ?? e).slice(0, 160)}`); cast = null; }
  }
  // D2.7: the X1 moves a style asked for, on the beats they suit (first, so the inserts fit around them)
  if (!rough && o.moves?.length) {
    const before = JSON.stringify(edl);
    const done = castMoves(edl as never, o.moves);
    const bad = validateEdl(edl as never).problems.filter(p => !p.startsWith('version'));
    if (bad.length || EDIT.timeline(edl).problems.length) { edl = JSON.parse(before); console.warn(`[edit] moves undone: ${bad.slice(0, 2).join('; ')}`); }
    else writeFileSync(join(dir, 'moves.json'), JSON.stringify(done, null, 1));
  }
  // D2.5: Style 1 UI cards and Editorial posters on the beats that call for one, cast from the same graph
  let ins: InsertTrace | null = null;
  if (!rough && o.inserts !== false && o.library !== false) {
    const before = JSON.stringify(edl);
    try {
      ins = await castInserts(edl as never, { src: await openInserts() });
      const bad = validateEdl(edl as never).problems.filter(p => !p.startsWith('version'));
      if (bad.length) { edl = JSON.parse(before); ins = null; console.warn(`[edit] inserts undone: ${bad.slice(0, 2).join('; ')}`); }
      else writeFileSync(join(dir, 'inserts.json'), JSON.stringify(ins, null, 1));
    } catch (e) { edl = JSON.parse(before); console.warn(`[edit] inserts: ${String((e as Error).message ?? e).slice(0, 160)}`); ins = null; }
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
  // the picture pass beside it (edit/restore.ts): every clip gets the owner's grade baked in (its exact LUT), and a weak
  // clip is also deblocked, cleaned, upscaled to 1080 and sharpened; edl.json then points at hd.mp4 (the preview's next
  // load and every render). The zoom cap above stays on the original resolution.
  const restore: Promise<Restored | null> = o.restore !== false
    ? restoreVideo(join(dir, file), join(dir, 'hd.mp4'), { w: source.w, h: source.h, fps: source.fps, duration: pr.duration }, { grade: ownerGrade() ?? undefined })
      .then(r => { if (r) { useRestored(dir, r); writeFileSync(join(dir, 'restore.json'), JSON.stringify(r, null, 1)); } return r; })
      .catch(e => { console.warn(`[edit] picture restore: ${String((e as Error).message ?? e).slice(0, 160)}`); return null; })
    : Promise.resolve(null);
  return { edl, words, ...(language ? { language } : {}), heard, faces: look.faces.length, lap, duration: t.duration, source: { ...source, hasAudio: pr.hasAudio }, rough, cast, inserts: ins, ...(look.why ? { lookWhy: look.why } : {}), voice, restore };
}
