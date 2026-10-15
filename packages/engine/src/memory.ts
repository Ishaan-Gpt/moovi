import { createHash } from 'node:crypto';
import { project as P, projectGraph, run as runQ, user as U, userGraph, type Q } from '@moovi/graph';

/**
 * The memory loop. When a user edits or rejects anything in a film (a script line, the voice, the style, a shot, a
 * caption, the sound), `recordFeedback` stores a Feedback node linked to the Film, the Scene and the Run, with what
 * changed and why. Before the next film, `loadMemory` runs the named queries (rejected styles, preferred voice,
 * rewritten lines, rejected shots, caption notes, style taste) and the planner, the art director, the scribe, the
 * style matcher and the voice step use the answers. Every Cypher query lives in packages/graph (docs/QUERIES.md).
 */
export const FEEDBACK_KINDS = ['script_line', 'voice', 'style', 'shot', 'caption', 'sound'] as const;
export type FeedbackKind = (typeof FEEDBACK_KINDS)[number];

export interface Feedback {
  kind: FeedbackKind;
  /** the user turned something down (true) or chose something (false: a voice they asked for, a style they picked) */
  rejected: boolean;
  /** 0-based scene index this is about, if any */
  scene?: number | null;
  /** what it was (the line, the shot's idea, the old voice) */
  before?: string | null;
  /** what it became (the rewritten line) */
  after?: string | null;
  /** a style id or voice name the note is about */
  value?: string | null;
  /** the user's reason, in their words */
  why?: string | null;
  /** chat = the user's message · diff = a script line that changed against the last version · ui = a studio control */
  source?: 'chat' | 'diff' | 'ui';
}

/** The film the note belongs to: ids from the project graph (the Video is the film, the Run its version). */
export interface FilmRef { user: string; project: string; run: string; runN: number; video: string; style: string | null; title: string | null }

type Rows = <T = Record<string, unknown>>(q: Q, params?: Record<string, unknown>) => Promise<T[]>;

const clip = (s: string | null | undefined, n: number) => (s == null ? null : s.length > n ? `${s.slice(0, n - 1)}…` : s);

/** Same note, same id: a retried task never stores it twice. */
export const feedbackId = (run: string, f: Feedback) =>
  `fb_${createHash('sha1').update(JSON.stringify([run, f.kind, f.rejected, f.scene ?? null, f.before ?? null, f.after ?? null, f.value ?? null, f.why ?? null])).digest('hex').slice(0, 16)}`;

/**
 * Store the notes: in the user's graph (what later films read, with Film, Scene and Run as refs) and in the project
 * graph (on the real Run, Video and Scene, so "why" can show them). Returns the ids.
 */
export async function recordFeedback(ref: FilmRef, items: Feedback[], at = Date.now()): Promise<string[]> {
  const ids: string[] = [];
  const ug = userGraph(ref.user), pg = projectGraph(ref.project);
  for (const f of items) {
    const id = feedbackId(ref.run, f);
    const scene = f.scene == null ? null : `${ref.run}:scene:${f.scene}`;
    const body = { id, kind: f.kind, rejected: f.rejected, before: clip(f.before, 400), after: clip(f.after, 400), value: clip(f.value, 120), why: clip(f.why, 400), source: f.source ?? 'chat', scene: f.scene ?? null, at };
    await runQ(ug, U.recordFeedback, { ...body, film: ref.video, project: ref.project, style: ref.style, title: clip(ref.title, 80), run: ref.run, runN: ref.runN });
    if (scene) await runQ(ug, U.linkFeedbackScene, { id, scene, i: f.scene });
    await runQ(pg, P.noteFeedback, { ...body, run: ref.run });
    if (scene) await runQ(pg, P.noteFeedbackScene, { id, scene });
    ids.push(id);
  }
  return ids;
}

/* ───────── reading it back ───────── */

export interface Memory {
  rejectedStyles: { style: string; n: number; last: number; reasons: string[] }[];
  voice: { prefer: string | null; avoid: string[] };
  rewrittenLines: { before: string; after: string; why: string | null; film: string | null }[];
  rejectedShots: { scene: number | null; shot: string | null; why: string | null; style: string | null; film: string | null }[];
  captionNotes: { kind: string; why: string | null; value: string | null; style: string | null }[];
  styleTaste: { style: string; films: number; notes: number; rejected: number }[];
  /** nothing remembered yet (the first film of a new user) */
  empty: boolean;
}

export const NO_MEMORY: Memory = { rejectedStyles: [], voice: { prefer: null, avoid: [] }, rewrittenLines: [], rejectedShots: [], captionNotes: [], styleTaste: [], empty: true };

/** Run the named queries (in parallel) before a film is planned. A user graph that has no notes answers with empty lists. */
export async function loadMemory(rows: Rows): Promise<Memory> {
  const [styles, pref, avoid, lines, shots, notes, taste] = await Promise.all([
    rows<{ style: string; n: number; last: number; reasons: (string | null)[] }>(U.rejectedStyles, { n: 6 }),
    rows<{ voice: string }>(U.preferredVoice, { n: 1 }),
    rows<{ voice: string }>(U.rejectedVoices, { n: 6 }),
    rows<{ before: string; after: string; why: string | null; film: string | null }>(U.rewrittenLines, { n: 8 }),
    rows<{ scene: number | null; shot: string | null; why: string | null; style: string | null; film: string | null }>(U.rejectedShots, { n: 6 }),
    rows<{ kind: string; why: string | null; value: string | null; style: string | null }>(U.captionNotes, { n: 5 }),
    rows<{ style: string; films: number; notes: number; rejected: number }>(U.styleTaste),
  ]);
  const m: Memory = {
    rejectedStyles: styles.map(s => ({ ...s, reasons: s.reasons.filter((x): x is string => !!x) })),
    voice: { prefer: pref[0]?.voice ?? null, avoid: avoid.map(v => v.voice) },
    rewrittenLines: lines, rejectedShots: shots, captionNotes: notes, styleTaste: taste, empty: false,
  };
  m.empty = !m.rejectedStyles.length && !m.voice.prefer && !m.voice.avoid.length && !m.rewrittenLines.length && !m.rejectedShots.length && !m.captionNotes.length;
  return m;
}

/* ───────── using it ───────── */

export type MemoryRole = 'planner' | 'director' | 'scribe';
const q = (s: string | null | undefined) => (s ? `“${s.replace(/\s+/g, ' ').trim()}”` : '(no reason given)');

/**
 * The part of a prompt that carries the user's feedback to an agent (empty when there is nothing to carry). Each role
 * gets what it can act on: the planner everything about words and style, the art director styles and shots, the scribe
 * lines.
 */
export function memoryBlock(m: Memory, role: MemoryRole): string {
  const out: string[] = [];
  if (role !== 'scribe' && m.rejectedStyles.length) out.push(`STYLES THIS USER TURNED DOWN (do not pick or imitate them): ${m.rejectedStyles.map(s => `${s.style} (${s.n}×${s.reasons[0] ? `, ${q(s.reasons[0])}` : ''})`).join(' · ')}`);
  if (role !== 'scribe') {
    const bad = m.styleTaste.filter(t => t.rejected > 0 && !m.rejectedStyles.some(s => s.style === t.style));
    if (bad.length) out.push(`STYLES THAT DREW REJECTIONS OF PARTS OF THE FILM: ${bad.map(t => `${t.style} (${t.rejected} of ${t.notes} notes over ${t.films} film${t.films === 1 ? '' : 's'})`).join(' · ')}`);
  }
  if (role === 'planner' && m.voice.prefer) out.push(`THE VOICE THIS USER KEEPS CHOOSING: ${m.voice.prefer}${m.voice.avoid.length ? ` (turned down: ${m.voice.avoid.join(', ')})` : ''}`);
  if (m.rewrittenLines.length && role !== 'director') out.push(`LINES THIS USER REWROTE (write the way the AFTER reads, never the way the BEFORE does):\n${m.rewrittenLines.slice(0, role === 'scribe' ? 8 : 5).map(l => `- before: “${l.before}” → after: “${l.after}” (${q(l.why)})`).join('\n')}`);
  if (role === 'director' && m.rejectedShots.length) out.push(`SHOTS THIS USER SENT BACK (design something clearly different):\n${m.rejectedShots.map(s => `- ${s.shot ? `“${s.shot.slice(0, 140)}”` : `scene ${s.scene == null ? '?' : s.scene + 1}`}${s.style ? ` [${s.style}]` : ''}: ${q(s.why)}`).join('\n')}`);
  if (role === 'director' && m.captionNotes.length) out.push(`WHAT THIS USER SAID ABOUT CAPTIONS AND SOUND: ${m.captionNotes.map(n => q(n.why ?? n.value)).join(' · ')}`);
  return out.length ? `WHAT THIS USER HAS ALREADY TOLD US ABOUT THEIR FILMS (from their feedback memory, newest first):\n${out.join('\n')}` : '';
}

/** The matcher picks a style from the brief alone; a style this user already turned down is not eligible, a new look is designed instead. */
export function steerStyle<T extends { style: string; nearest: string; scores: { style: string; score: number }[] }>(m: T, mem: Memory): { match: T; steered: string | null } {
  const rejected = new Set(mem.rejectedStyles.map(s => s.style));
  if (!rejected.has(m.style)) return { match: m, steered: null };
  const next = m.scores.find(s => !rejected.has(s.style));
  return { match: { ...m, style: 'unique', nearest: next?.style ?? m.nearest }, steered: m.style };
}

/** The voice for this film: the one this user keeps choosing, else the default, never one they turned down. */
export function voiceFor(mem: Memory, fallback: string): { voice: string; why: string } {
  if (mem.voice.prefer && !mem.voice.avoid.includes(mem.voice.prefer)) return { voice: mem.voice.prefer, why: 'the voice this user chose before' };
  if (mem.voice.avoid.includes(fallback)) {
    const alt = ALTERNATE_VOICES.find(v => !mem.voice.avoid.includes(v));
    if (alt) return { voice: alt, why: `${fallback} was turned down` };
  }
  return { voice: fallback, why: 'default' };
}

/** English neural voices, a few to pick between when the default was turned down and no other was named. */
export const ALTERNATE_VOICES = ['en-US-AriaNeural', 'en-US-GuyNeural', 'en-GB-RyanNeural', 'en-US-JennyNeural', 'en-IN-NeerjaNeural'];

/** Lines that changed between two versions of a script, beat by beat (what the user's change did to the words). */
export function changedLines(before: { say: string }[], after: { say: string }[]): { scene: number; before: string; after: string }[] {
  const norm = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
  const out: { scene: number; before: string; after: string }[] = [];
  for (let i = 0; i < Math.min(before.length, after.length); i++) if (norm(before[i]!.say) !== norm(after[i]!.say)) out.push({ scene: i, before: before[i]!.say, after: after[i]!.say });
  return out;
}

/** Project-graph rows (for a TaskCtx or a script): the user graph's query runner. */
export const userRows = (user: string): Rows => (query, params = {}) => runQ(userGraph(user), query, params);

/* ───────── what the chat tells us ───────── */

/** One note as Moovi reads it out of the user's message (1-based scene; the model never writes Cypher). */
export interface EditNote { kind: FeedbackKind; rejected: boolean; scene: number | null; value: string | null; why: string }

const NEURAL = /^[a-z]{2,3}-[A-Z]{2}-[A-Za-z]+Neural$/;

/**
 * The notes behind one requested change: the ones the model read out of the message, completed from facts we hold
 * (the shot being sent back, the voice that was playing, the style of the film). When the model read none, a scene
 * rebuild is a note on each of those shots and a sound change a note on the sound, so a change never goes unrecorded.
 */
export function feedbackFromEdit(e: { mode: string; scenes: number[]; change: string; sound?: { bedLu: number | null; sfxDb: number | null } | null; notes?: EditNote[] | null }, o: { shots: Map<number, string>; voice: string; style: string | null }): Feedback[] {
  const out: Feedback[] = [];
  const seen = new Set<string>();
  const add = (f: Feedback) => { const k = JSON.stringify([f.kind, f.rejected, f.scene ?? null, f.value ?? null]); if (!seen.has(k) && out.length < 8) { seen.add(k); out.push({ source: 'chat', ...f }); } };
  for (const n of e.notes ?? []) {
    const scene = n.scene != null && n.scene >= 1 ? n.scene - 1 : null;
    const why = n.why?.trim() || e.change;
    if (n.kind === 'voice') {
      const value = n.value && NEURAL.test(n.value) ? n.value : n.rejected ? o.voice : null;
      if (value) add({ kind: 'voice', rejected: n.rejected, value, why });
    } else if (n.kind === 'style') {
      const value = n.value?.trim() || (n.rejected ? o.style : null);
      if (value) add({ kind: 'style', rejected: n.rejected, value, why });
    } else add({ kind: n.kind, rejected: n.rejected, scene, before: scene != null ? o.shots.get(scene) ?? null : null, value: n.value, why });
  }
  if (!out.length) {
    if (e.mode === 'scenes') for (const s of e.scenes.slice(0, 6)) add({ kind: 'shot', rejected: true, scene: s - 1, before: o.shots.get(s - 1) ?? null, why: e.change });
    else if (e.mode === 'sound') add({ kind: 'sound', rejected: true, value: e.sound ? JSON.stringify(e.sound) : null, why: e.change });
  }
  return out;
}
