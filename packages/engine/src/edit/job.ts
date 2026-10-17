import { stopIfDown } from '@moovi/graph';
import { copyFileSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { extname, join } from 'node:path';
import { color } from '@moovi/brand';
import { NEEDS_SPEECH_KEY, plainSpeechError, speechAvailable } from '../audio/stt';
import { mixStyle1, sfxStem } from '../audio/style1';
import { probe } from '../bench';
import { buildEdl, type BuildInput, type Face } from './build';
import { castStyleSfx, isD22, pickEditStyle, styledEdl } from './styles';
import { castEdl, openLibrary, type CastTrace } from './cast';
import { envelope, pauses, type Word } from './cut';
import { keepOf, validateEdl } from './edl';
import { hear, type Heard } from './hear';
import { castInserts, openInserts, type InsertTrace } from './inserts';
import { autoMoves, castMoves } from './moves';
import { BRIDGE_PROVIDER, directEdit, overridesOf } from './direct';
import type { Direction } from './direct.schema';
import { modelScope } from '../runtime';
import { autoFx, openFx, type AutoFx } from './effects/auto';
import { srcToEdit } from './effects/onedit';
import { EDIT, type PlayerEdl } from './lib';
import { keepTextInFrame, lookText } from './burned';
import { lookFaces } from './look';
import { roughEdl } from './rough';
import { ownerGrade, restoreVideo, useRestored, type Restored } from './restore';
import { romanizeWords } from './romanize';
import { dropSpans, findTakes } from './takes';
import { checkAndRepair } from '../review/runner';
import { scSfxEvents, studioCutEdl, SC_ID } from './templates/studio-cut';
import { cleanVoice, quietPauses, type CleanVoice } from './voice';
import { forksOf, linkInto } from '../change/fork';

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
  /** the clip's words are the point (an edit of a talking clip): stop with a plain reason rather than plan a no-words edit when nothing can hear them */
  requireWords?: boolean;
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
  /** start the picture restore for a weak clip (edit/restore.ts; default true) */
  restore?: boolean;
  /** cast camera moves, sounds and transitions from the library graph per beat (edit/cast.ts; default true) */
  library?: boolean;
  /** D2.5: cast Style 1 UI cards and Editorial posters into insert frames on the beats that call for one (edit/inserts.ts; default true) */
  inserts?: boolean;
  /** D2.7: X1 moves (by number, e.g. ['13', '17', '05']) a style asks for, placed on the beats they suit (edit/moves.ts);
   * not given: the moves the edit's beats call for (autoMoves); [] for none */
  moves?: string[];
  /** D2.2: an R4 style with its own laws (edit/styles.ts: atlas, handmade, studio-minimal); 'auto' picks the one that
   * fits the brief and the clip (pickEditStyle); default the base edit */
  style?: string;
  /** the user's words with the upload (the style auto-pick reads them) */
  brief?: string;
  /** the reel effects library picked for this clip's words (edit/effects/auto.ts, effects.json; default true) */
  effects?: boolean;
  /** the creator's name or handle for the style's end card */
  handle?: string;
  /** CHECK on the first plan (review/runner.ts, code only; default true) */
  check?: boolean;
  /** the edit grammar: 'studio-cut' (asked for by name, or MOOVI_EDIT_TEMPLATE=studio-cut) dresses the plan as a Studio Cut (templates/studio-cut.ts:
   *  stacked captions, a continuous camera, graphics, Style 1 sound and its mix), 'none' keeps the plain cut + library cast */
  template?: 'studio-cut' | 'none';
  /** the brand a Studio Cut names on its title, name and end cards (none: those cards use the spoken words) */
  brand?: { name?: string; url?: string; tagline?: string; logo?: string };
  /** Claude Code bridge (docs/agents/claude-code-bridge item 11a): the creative choices from ONE brain call (edit/direct.ts).
   *  'ask' asks for them; a Direction uses it; null or not given in the bridge scope = 'ask', elsewhere the rules */
  direction?: Direction | 'ask' | null;
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
  /** the X1 moves placed (moves.json) */
  moves: string[];
  /** the D2.2 style the edit ran in (null: the base edit) and why */
  style: { id: string | null; why: string };
  /** the reel effects picked for the clip's words, on the source clock (effects.json), null when off or too few words */
  effects: AutoFx | null;
  /** why faces are missing, when they are (the look step's own words) */
  lookWhy?: string;
  /** the voice clean-up, running; resolves null when there is no audio or it failed */
  voice: Promise<CleanVoice | null>;
  /** the picture restore, running; resolves null when the clip did not need it or it failed */
  restore: Promise<Restored | null>;
  /** the finished soundtrack (a Studio Cut: voice, bed and the Style 1 stem, mix.m4a), running; null when there is none */
  mix: Promise<{ file: string; lufs: number } | null>;
}

export const EDIT_PALETTE = () => ({ ink: color.ink, paper: color.surface, accent: color.ice, accent2: color.frostMid, deep: color.ink, pop: color.iceWhite });

/** How far the library's camera moves may push in on this source (a 478 px tall clip goes soft past about 1.2x). */
export const castMaxZoom = (s: { w: number; h: number }) => Math.min(2, Math.max(1.2, 1.3 * Math.min(s.w, s.h) / 720));

/** The music bed every Studio Cut mixes under the voice (assets/music, CC BY: the credit rides on the EDL's music). */
const BED = join(import.meta.dirname, '..', '..', 'assets', 'music');
const editTemplate = (o: PlanInput) => o.template ?? ((process.env.MOOVI_EDIT_TEMPLATE ?? '').trim().toLowerCase() === 'studio-cut' || /\bstudio[ -]?cut\b/i.test(o.brief ?? '') ? 'studio-cut' : 'none');

/**
 * Cleanup levels (Cardboard's Light / Balanced / Tight): the brief's own words pick how hard the pauses are cut. Balanced
 * is the default laws (pause over 0.4 s cut to 0.18 s), so a brief that says neither changes nothing. Pure.
 */
export function cleanupLevel(brief: string): { level: 'light' | 'tight'; laws: { pause_max: number; pause_keep: number } } | null {
  const b = brief.toLowerCase();
  if (/\b(tight|tighter|snappy|snappier|fast[- ]?paced|no pauses|cut (all )?(the )?pauses|jump ?cuts?)\b/.test(b)) return { level: 'tight', laws: { pause_max: 0.28, pause_keep: 0.12 } };
  if (/\b(light(ly)?|gentle|natural|keep (the )?pauses|breathe|breathing room|don'?t cut much)\b/.test(b)) return { level: 'light', laws: { pause_max: 0.65, pause_keep: 0.26 } };
  return null;
}

/** The direction for this edit: given, asked for (the bridge scope, or 'ask'), or null for the rules. Never throws. */
async function directionFor(o: PlanInput, words: Word[], faces: Face[], burned: boolean): Promise<Direction | null> {
  const want = o.direction === undefined ? (modelScope()?.provider === BRIDGE_PROVIDER ? 'ask' : null) : o.direction;
  if (want === null || !words.length) return null;
  if (want !== 'ask') return want;
  try {
    const r = await directEdit({ words, faces, brief: o.brief ?? '', burned, ...(o.signal ? { signal: o.signal } : {}), log: l => console.warn(`[edit] ${l}`) });
    if (r.note) await o.onNote?.(r.note);
    return r.value;
  } catch (e) {
    if ((e as Error)?.name === 'BrainWaiting') throw e;
    console.warn(`[edit] direction: ${String((e as Error)?.message ?? e).slice(0, 160)}; the rules instead`);
    return null;
  }
}

export async function planEdit(o: PlanInput): Promise<Planned> {
  const lap: Record<string, number> = {}; let tl = Date.now();
  const done = async (stage: string) => { lap[stage] = +((Date.now() - tl) / 1000).toFixed(2); tl = Date.now(); await o.onDone?.(stage, lap[stage]!); };
  const dir = o.dir; mkdirSync(dir, { recursive: true });
  // edl.json is rewritten after the plan by the restore and the mix: one at a time, never both reading the same version
  let queue: Promise<unknown> = Promise.resolve();
  const patch = (fn: () => void): Promise<void> => { const p = queue.then(fn); queue = p.catch(() => undefined); return p; };
  const file = `src${extname(o.name ?? o.path).toLowerCase() || '.mp4'}`;
  await o.onStage?.('probe', 'measuring your clip');
  copyFileSync(o.path, join(dir, file));
  const pr = await probe(o.path);
  if (!pr.hasVideo) throw new Error(`${o.name ?? 'the clip'} has no video stream`);
  // nothing can hear the words (no key and MOOVI_STT=off): say so now, before a pause-cuts-only edit is passed off as one
  if (pr.hasAudio && o.requireWords && !speechAvailable()) throw new Error(NEEDS_SPEECH_KEY);
  await done('probe');

  // D1.3 look: the speaker's face, beside the hearing (edit/look.ts; [] without a face detector), for crop and punch-ins
  const lookP = lookFaces(o.path, pr.duration);
  // burned-in text (edit/burned.ts): a clip that carries its own subtitles keeps them, and Moovi draws none over them
  const textP = lookText(o.path, pr.duration, pr.width ?? 1080, pr.height ?? 1920);
  // the heard pauses (voice.ts quietPauses) beside the hearing: Whisper's word edges get fitted to them in the builder
  const quietP = pr.hasAudio ? quietPauses(o.path, { dir }) : Promise.resolve(null);
  await o.onStage?.('hear', 'timing every word');
  // D1.2: language-locked, in pieces, the accurate text laid on, and a confidence gate (edit/hear.ts)
  let words: Word[] = [], language: string | undefined, heard: Heard | null = null;
  if (pr.hasAudio && speechAvailable()) {
    // the vocabulary prompt: Moovi, Ishaan, MOOVI_VOCAB and the project's own names. A key, else the local model; a
    // hearing that fails stops the job with one plain sentence (the studio chat and Claude Code both show it)
    heard = await hear(o.path, dir, { ...(o.signal ? { signal: o.signal } : {}), ...(o.names?.length ? { names: o.names } : {}) })
      .catch(e => { if (o.signal?.aborted) throw e; throw new Error(plainSpeechError(e)); });
    words = heard.words; language = heard.language;
    writeFileSync(join(dir, 'hear.json'), JSON.stringify({ language: heard.language, lang: heard.lang, detected: heard.detected, by: heard.by, prompt: heard.prompt, gate: heard.gate, pieces: heard.pieces, timings: heard.timings }, null, 1));
    if (!heard.gate.ok) await o.onNote?.(`the transcript may be off (${heard.gate.reasons.join('; ')}), so check the captions`);
  } else if (pr.hasAudio) await o.onNote?.('speech-to-text is off (MOOVI_STT=off) and there is no key, so no cuts or captions from words this time');
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
  const look = await lookP, quiet = await quietP;
  // the bridge: one brain call directs look, cleanup, tags, moves and caption look; null = the rules below, unchanged
  const direction = await directionFor(o, words, look.faces, (await textP).length > 0);
  const ov = direction ? overridesOf(direction) : null;
  if (direction) { writeFileSync(join(dir, 'direction.json'), JSON.stringify(direction, null, 1)); await o.onNote?.(`direction: ${direction.style}, ${direction.cleanup} (${direction.why})`); }
  if (quiet) writeFileSync(join(dir, 'quiet.json'), JSON.stringify(quiet, null, 1));
  // W15: a line said twice or more keeps its best take (edit/takes.ts); takes.json holds every take, "use take 2" swaps
  const takes = findTakes(words);
  if (takes.groups.length) {
    writeFileSync(join(dir, 'takes.json'), JSON.stringify(takes, null, 1));
    await o.onNote?.(`takes: ${takes.groups.map(g => `${g.takes.length} of “${g.takes[0]!.text.split(/\s+/).slice(0, 5).join(' ')}…”, kept ${g.why}`).join('; ')} (say “use take 1” to swap)`);
  }
  const source = { file, duration: pr.duration, w: pr.width ?? 1080, h: pr.height ?? 1920, fps: pr.fps ?? 30 };
  // a Studio Cut (templates/studio-cut.ts) when you ask for one by name or MOOVI_EDIT_TEMPLATE=studio-cut; it keeps the
  // clip's orientation (a landscape clip is a landscape film). Otherwise the D2.2 styles and the base edit, as before.
  const sc = (ov?.template ?? editTemplate(o)) === 'studio-cut', output = sc && source.w > source.h ? { w: 1920, h: 1080, fps: 30, aspect: '16:9' } : undefined;
  // D2.2 auto: the style that fits the brief and the clip (edit/styles.ts pickEditStyle), when none was named
  let style: string | undefined = ov ? ov.style : o.style, styleWhy = ov ? `directed: ${direction!.why}` : o.style ? `asked for ${o.style}` : 'the base edit';
  if (!ov && o.style === 'auto' && !sc) {
    const p = pickEditStyle({ brief: o.brief ?? '', words: words.map(w => w.word), burned: (await textP).length > 0 });
    style = p.style === 'base' ? undefined : p.style; styleWhy = p.why;
    writeFileSync(join(dir, 'style.json'), JSON.stringify(p, null, 1));
    if (style) await o.onNote?.(`style: ${style} (${p.why})`);
  }
  let edl: PlayerEdl, rough = false;
  try {
    const lv = ov ? (ov.laws ? { level: 'directed', laws: { pause_max: ov.laws.pause_max ?? 0.4, pause_keep: ov.laws.pause_keep ?? 0.18 } } : null) : cleanupLevel(o.brief ?? '');
    if (lv) await o.onNote?.(`cleanup: ${lv.level} (pauses over ${lv.laws.pause_max} s cut to ${lv.laws.pause_keep} s)`);
    const bi: BuildInput = { ...(lv ? { laws: lv.laws } : {}), source, words, pauses: ps, ...(quiet ? { quiet: quiet.pauses } : {}), palette, ...(look.faces.length ? { faces: look.faces } : {}), style: { id: 'base', ...(o.caption ? { caption: o.caption } : {}), ...(ov?.look !== undefined ? { look: ov.look } : {}), ...(output ? { output } : {}) }, ...(ov?.tags ? { tags: ov.tags } : {}), ...(language ? { language } : {}), ...(takes.groups.length ? { retakes: dropSpans(takes) } : {}) };
    const e = isD22(style) ? styledEdl(bi, style, o.handle ? { name: o.handle } : {}) : buildEdl(bi);
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
  const text = await textP;
  if (text.length) {
    edl.source_text = { bands: text.map(b => [b.y0, b.y1] as [number, number]), captions: 'source' };
    keepTextInFrame(edl);
    await o.onNote?.('your clip already has captions burned in, so I kept those and did not add a second set');
  }
  // the library in the edit path: camera:<id> moves (by the needs each beat's tag SERVES, framed on the face keys),
  // sfx by the library's events and transitions on beat changes, all from the FalkorDB graph (catalogue if it is down)
  let cast: CastTrace | null = null;
  if (!rough && !sc && o.library !== false && isD22(style)) {
    // D2.2 styles: the style chose framing and cuts; the library graph gives the sound files for its events
    try { const r = await castStyleSfx(edl as never, await openLibrary()); writeFileSync(join(dir, 'cast.json'), JSON.stringify({ style, ...r }, null, 1)); }
    catch (e) { stopIfDown(e, 'edit: style sounds'); console.warn(`[edit] style sounds: ${String((e as Error).message ?? e).slice(0, 160)}`); }
  } else if (!rough && !sc && o.library !== false) {
    try {
      const before = JSON.stringify(edl);
      cast = await castEdl(edl as never, { lib: await openLibrary(), maxZoom: castMaxZoom(source) });
      const bad = validateEdl(edl as never).problems.filter(p => !p.startsWith('version'));
      if (bad.length || EDIT.timeline(edl).problems.length) { edl = JSON.parse(before); cast = null; console.warn(`[edit] library cast undone: ${bad.slice(0, 2).join('; ')}`); }
      else writeFileSync(join(dir, 'cast.json'), JSON.stringify(cast, null, 1));
    } catch (e) { stopIfDown(e, 'edit: library cast'); console.warn(`[edit] library cast: ${String((e as Error).message ?? e).slice(0, 160)}`); cast = null; }
  }
  // the Studio Cut dresser (templates/studio-cut.ts): its own camera, stacks, graphics and sound; undone if it breaks the plan
  if (sc && !rough && words.length) {
    try {
      const b = o.brand ?? {};
      const d = studioCutEdl(edl as never, { maxZoom: castMaxZoom(source), raw: file, ...(b.name ? { brand: b.name } : {}), ...(b.url ? { url: b.url } : {}), ...(b.tagline ? { tagline: b.tagline } : {}), ...(b.logo ? { logo: b.logo } : {}) });
      const bad = validateEdl(d).problems.filter(p => !p.startsWith('version'));
      if (bad.length || EDIT.timeline(d as never).problems.length) console.warn(`[edit] studio cut undone: ${bad.slice(0, 2).join('; ')}`);
      else edl = d as never;
    } catch (e) { stopIfDown(e, 'edit: studio cut'); console.warn(`[edit] studio cut: ${String((e as Error).message ?? e).slice(0, 160)}`); }
  }
  // D2.7: the X1 moves a style asked for, on the beats they suit (first, so the inserts fit around them)
  const want = rough || sc ? [] : ov?.moves ?? o.moves ?? autoMoves(edl as never);
  let moves: string[] = [];
  if (want.length) {
    const before = JSON.stringify(edl);
    const done = castMoves(edl as never, want);
    moves = done.filter(d => d.ok).map(d => d.n);
    const bad = validateEdl(edl as never).problems.filter(p => !p.startsWith('version'));
    if (bad.length || EDIT.timeline(edl).problems.length) { edl = JSON.parse(before); moves = []; console.warn(`[edit] moves undone: ${bad.slice(0, 2).join('; ')}`); }
    else writeFileSync(join(dir, 'moves.json'), JSON.stringify(done, null, 1));
  }
  // D2.5: Style 1 UI cards and Editorial posters on the beats that call for one, cast from the same graph
  let ins: InsertTrace | null = null;
  if (!rough && !sc && o.inserts !== false && o.library !== false) {
    const before = JSON.stringify(edl);
    try {
      ins = await castInserts(edl as never, { src: await openInserts() });
      const bad = validateEdl(edl as never).problems.filter(p => !p.startsWith('version'));
      if (bad.length) { edl = JSON.parse(before); ins = null; console.warn(`[edit] inserts undone: ${bad.slice(0, 2).join('; ')}`); }
      else writeFileSync(join(dir, 'inserts.json'), JSON.stringify(ins, null, 1));
    } catch (e) { stopIfDown(e, 'edit: inserts'); edl = JSON.parse(before); console.warn(`[edit] inserts: ${String((e as Error).message ?? e).slice(0, 160)}`); ins = null; }
  }
  // the library's camera moves came after: they keep the clip's own text whole too
  if (edl.source_text) keepTextInFrame(edl);
  // the reel effects library (edit/effects): the effects this clip's words call for, cast from the same graph, on the
  // source clock (the effects film renders over the clip itself: router/edit.ts)
  let effects: AutoFx | null = null;
  if (!rough && !sc && o.effects !== false && words.length >= 6) {
    try {
      // picked from the words the cut keeps (a slate or a retake the edit removed never gets an effect), on the source clock
      const kept = words.filter(w => srcToEdit(edl.shots, w.t) !== null);
      effects = await autoFx((kept.length >= 6 ? kept : words).map(w => ({ word: w.word, t: w.t, end: w.end })), { src: await openFx(), total: edl.shots.at(-1)?.t_out ?? pr.duration, ...(look.faces.length ? { faces: look.faces } : look.why ? {} : { faces: [] }) });
      writeFileSync(join(dir, 'effects.json'), JSON.stringify(effects, null, 1));
    } catch (e) { stopIfDown(e, 'edit: effects'); console.warn(`[edit] effects: ${String((e as Error).message ?? e).slice(0, 160)}`); effects = null; }
  }
  // CHECK on the first plan too (review/runner.ts, code only: lint and collision map, at most one repair, the better
  // version kept): the preview never waits on pixels or a model, and a failure here leaves the plan as it was
  if (!rough && o.check !== false) {
    const c = checkAndRepair(edl as never, {});
    if (c.kept === 'repaired' && validateEdl(c.edl as never).problems.filter(p => !p.startsWith('version')).length === 0 && !EDIT.timeline(c.edl as never).problems.length) edl = c.edl as never;
    writeFileSync(join(dir, 'check.json'), JSON.stringify({ before: c.before.score, after: c.after?.score ?? null, repaired: c.repaired, kept: c.kept, issues: (c.kept === 'repaired' ? c.after! : c.before).issues.map(i => i.msg), ...(c.error ? { error: c.error } : {}) }, null, 1));
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
      // a version forked before the pass finished (change/versions.ts) gets the restored picture too
      .then(r => r && patch(() => { useRestored(dir, r); for (const f of forksOf(dir)) { linkInto(dir, f, 'hd.mp4'); useRestored(f, r); } }).then(() => r))
      .then(r => { if (r) { writeFileSync(join(dir, 'restore.json'), JSON.stringify(r, null, 1)); } return r; })
      .catch(e => { console.warn(`[edit] picture restore: ${String((e as Error).message ?? e).slice(0, 160)}`); return null; })
    : Promise.resolve(null);
  // the Studio Cut's soundtrack once the voice is clean (it is already cut on the film's clock): the Style 1 stem from the
  // EDL's sound events, the bed 3 LU under the voice, mastered to -14 LUFS (audio/style1.ts); edl.json then names it
  const isSc = (edl as { template?: { id: string } }).template?.id === SC_ID;
  const mix: Promise<{ file: string; lufs: number } | null> = isSc
    ? voice.then(async v => {
      if (!v) return null;
      const bed = JSON.parse(readFileSync(join(BED, 'bed.json'), 'utf8')) as { file: string; start?: number; credit?: string };
      const stem = await sfxStem(scSfxEvents(edl as never), join(dir, 'stem.wav'), { seed: 1, duration: t.duration });
      const m = await mixStyle1({ voice: v.file, spans: [[0, t.duration]], bed: join(BED, bed.file), bedStart: bed.start ?? 0, stem: stem.file, duration: t.duration, out: join(dir, 'mix.m4a'), dir }); for (const f of ['mix-voice.wav', 'mix-pre.wav']) rmSync(join(dir, f), { force: true });
      await patch(() => {
        const f = join(dir, 'edl.json'), e = JSON.parse(readFileSync(f, 'utf8'));
        e.mix = { file: 'mix.m4a', lufs: +m.lufs.toFixed(1) };
        e.music = { asset_ref: 'music:funkorama', offset: bed.start ?? 0, gain_db: -21, ...(bed.credit ? { credit: bed.credit } : {}), rule_id: 'sc.music' };
        writeFileSync(f, JSON.stringify(e, null, 1));
      });
      return { file: m.file, lufs: m.lufs };
    }).catch(e => { console.warn(`[edit] studio cut mix: ${String((e as Error).message ?? e).slice(0, 160)}`); return null; })
    : Promise.resolve(null);
  return { mix, edl, words, ...(language ? { language } : {}), heard, faces: look.faces.length, lap, duration: t.duration, source: { ...source, hasAudio: pr.hasAudio }, rough, cast, inserts: ins, moves, style: { id: isD22(style) ? style : null, why: styleWhy }, effects, ...(look.why ? { lookWhy: look.why } : {}), voice, restore };
}
