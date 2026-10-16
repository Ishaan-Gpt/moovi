/**
 * Typed params per library category (Tab's R7 review, point 7): what an EDL builder needs to place an asset on time.
 * The catalogue fills these and test/library.test.ts checks every row against them, so a builder can rely on the
 * fields. Numbers are seconds unless named _ms; loudness in LUFS.
 */
import { z } from 'zod';

const sec = z.number().min(0);
export const PARAMS = {
  sfx: z.object({
    dur: sec, peak_ms: z.number().int().min(0).describe('where the attack peaks: land this on the cut'),
    lufs: z.number().nullable().describe('integrated loudness; null for a sound shorter than one 400 ms block'),
    peak_dbfs: z.number().nullable(), align: z.string(),
  }).passthrough(),
  music: z.object({
    bpm: z.number().positive(), dur: sec.nullable(), loop: z.boolean(), end_button_at: sec.nullable().describe('where a clean button ending lands, if known'),
    mood: z.array(z.string()).min(1), beats: z.array(sec).describe('the beat grid anchors: strong-beat entry points'),
  }).passthrough(),
  transition: z.object({ dur: sec, needs_overlap: z.boolean().describe('both shots on screen during it (J and L cuts need handles)') }).passthrough(),
  voice: z.object({ lang: z.string().min(2), engine: z.string().min(2), locale: z.string() }).passthrough(),
  /** the browser player's caption styles carry R8's CaptionStyle */
  caption: z.object({ font: z.object({ family: z.string(), weight: z.number(), case: z.string() }).passthrough(), size: z.string(), chunk: z.object({ mode: z.string() }).passthrough(), entry: z.string(), position: z.string() }).passthrough(),
  grade: z.object({ ffmpeg: z.string().min(3), css: z.string().min(3) }).passthrough(),
  font: z.object({ family: z.string(), role: z.string() }).passthrough(),
} as const;

/** The schema a row's params must meet, or null (categories and sub-kinds without a contract yet). */
export function paramsSchema(r: { category: string; runtime: string[] }) {
  if (r.category === 'caption') return r.runtime.includes('browser') ? PARAMS.caption : null;
  return (PARAMS as Record<string, z.ZodTypeAny>)[r.category] ?? null;
}
