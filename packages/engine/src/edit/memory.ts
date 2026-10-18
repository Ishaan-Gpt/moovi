import { user as U, type Q } from '@moovi/graph';

/**
 * The edit's memory in the user's own graph (Claude 1, from Ishaan's run: "Your memory: 0 calls"). Before directing,
 * Keeper reads what this user taught (current lessons for the director and the builder, in the edit style or every
 * style), what they said about captions and sound, their standing preferences, and the last edit's device sequence;
 * after the film, Keeper files this edit's choices so the next one reads them. Nothing here is a taste of ours: only
 * the user's own words and choices go back to the model.
 */
type UQ = <T = Record<string, unknown>>(query: Q, params?: Record<string, unknown>) => Promise<T[]>;
export const EDIT_STYLE = 'edit';

export interface EditMemory { /** the last edit film's device sequence (never repeated) */ previous: string[]; /** the user's own notes for the director, as lines */ notes: string[] }

export async function readEditMemory(uq: UQ): Promise<EditMemory> {
  const [dir, bld, caps, prefs, last] = await Promise.all([
    uq<{ text: string }>(U.lessonsFor, { role: 'director', style: EDIT_STYLE }),
    uq<{ text: string }>(U.lessonsFor, { role: 'builder', style: EDIT_STYLE }),
    uq<{ kind: string; why: string | null; value: string | null }>(U.captionNotes, { n: 5 }),
    uq<{ key: string; value: unknown }>(U.preferences, {}),
    uq<{ card: string | null }>(U.recentPresets, { style: EDIT_STYLE, n: 1 }),
  ]);
  let previous: string[] = [];
  try { previous = (JSON.parse(last[0]?.card ?? '{}') as { devices?: string[] }).devices ?? []; } catch { previous = []; }
  const notes = [...new Set([...dir, ...bld].map(l => l.text))]
    .concat(caps.map(c => `${c.kind}: ${[c.why, c.value].filter(Boolean).join(' — ')}`).filter(s => !/:\s*$/.test(s)))
    .concat(prefs.map(p => `${p.key}: ${typeof p.value === 'string' ? p.value : JSON.stringify(p.value)}`));
  return { previous, notes: notes.slice(0, 12) };
}

/** The brief the model reads: the user's brief, then their memory (their own words, never ours). Pure. */
export const briefWithMemory = (brief: string, m: EditMemory) => m.notes.length ? `${brief.trim()}\n\nWHAT THIS USER TAUGHT MOOVI (follow it):\n${m.notes.map(n => `- ${n}`).join('\n')}`.trim() : brief;

/** The devices a spec cast, beat by beat (the player's own layer types, the camera left out). Pure. */
export const specDevices = (spec: Record<string, unknown> | null) => ((spec?.beats ?? []) as { layers?: { t?: string }[] }[])
  .map(b => (b.layers ?? []).map(L => L.t).filter((t): t is string => !!t && t !== 'cam').join('+') || 'speaker');

/** Keeper files this edit: its devices in order, the caption and the bed it took. */
export async function rememberEdit(uq: UQ, o: { video: string; project: string; title: string; devices: string[]; caption?: string | null; bed?: string | null }) {
  const presets = o.devices.map(d => `${EDIT_STYLE}:${d}`).concat(o.caption ? [`${EDIT_STYLE}:caption:${o.caption}`] : []);
  await uq(U.recordVideo, { video: o.video, project: o.project, style: EDIT_STYLE, angle: null, hook: null, title: o.title, at: Date.now(), bed: o.bed ?? null, card: JSON.stringify({ devices: o.devices }), presets: [...new Set(presets)] });
  const seq = o.devices.map(d => `${EDIT_STYLE}:${d}`);
  if (seq.length > 1) await uq(U.recordSequence, { video: o.video, pairs: seq.slice(1).map((b, i) => ({ a: seq[i]!, b })) });
}
