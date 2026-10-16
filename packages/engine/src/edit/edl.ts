import { z } from 'zod';
import { EDIT, type PlayerEdl } from './lib';

/**
 * The EDL (edit decision list), schema v0: everything an edit decides, as pure data. The browser preview player
 * (page.ts) and the MP4 renderer read the same file, so the preview is the film. It extends the player's `PlayerEdl`
 * (lib.ts) without renaming anything the player reads: a valid EDL plays in the player as it is.
 *
 * Time: `shots[]` and `words[]` carry SOURCE seconds (`src_*`); everything else (shot output spans, cuts, captions,
 * inserts, overlays, sfx, music beats, end card) is in OUTPUT seconds. `shots[]` is the single source of truth for
 * what is kept: `keepOf()` derives the keep ranges; `removed[]` records what was cut and why.
 * Determinism (R4): same source, same style id, same seed, same rules version: same EDL. Every decision names the
 * rule that made it (`rule_id`), which is also what "edit by words" changes.
 * Asset references (`asset_ref`) are R7 library ids, `<category>:<slug>` (caption ids may omit `caption:`).
 * Field list: docs/agents/research/R4-edit-styles.md, "What the EDL must carry".
 */
export const EDL_VERSION = '0.1';

const sec = z.number().min(0);
const frac = z.number().min(-0.5).max(1.5);
const ruleId = z.string().min(1).describe('the rule that made this decision, e.g. "law.pause_trim" or "nightdesk.split_on_number"');
const assetRef = z.string().regex(/^[a-z0-9][a-z0-9_-]*:[a-z0-9][\w.-]*$/i, 'asset ids are <category>:<slug>').describe('an R7 library Asset id');
const role = z.enum(['ink', 'paper', 'accent', 'accent2', 'deep', 'pop']);
const ease = z.enum(['out', 'inout', 'linear', 'cut']);

export const Header = {
  version: z.string().describe(`schema version, "${EDL_VERSION}" for v0`),
  style_id: z.string().describe('atlas, night-desk, handmade, crimson-cutout, brand-promo, studio-minimal, or rough'),
  style_variant: z.string().optional().describe('Night Desk: "A" (split explainer) or "B" (story)'),
  seed: z.number().int().optional(),
  rules_version: z.string().optional().describe('version of the style laws that built this EDL'),
  source: z.object({
    file: z.string().describe('the source clip, relative to the EDL file'),
    id: z.string().optional().describe('upload id or sha256 of the clip'),
    duration: z.number().positive(), w: z.number().int().positive(), h: z.number().int().positive(), fps: z.number().positive(),
  }),
  output: z.object({ w: z.number().int().positive(), h: z.number().int().positive(), fps: z.number().positive(), aspect: z.string().optional().describe('9:16, 1:1, 16:9, 4:5') }),
  palette: z.object({ ink: z.string(), paper: z.string(), accent: z.string(), accent2: z.string(), deep: z.string(), pop: z.string() }),
  caption_style_id: z.string().describe('R8 caption style id (with or without "caption:")'),
  caption_look: z.object({
    number: z.number().int(), id: z.string(), name: z.string(),
    player_style: z.string().describe('the nearest of the preview player\'s caption styles (what caption_style_id carries when no style was asked for)'),
    style: z.record(z.string(), z.unknown()).describe('the full CaptionStyle captionseasy validated'),
    settings: z.record(z.string(), z.unknown()).describe('captionseasy pacing settings'),
    overrides: z.record(z.string(), z.unknown()).optional(), warnings: z.array(z.string()).optional(), rule_id: ruleId,
  }).optional().describe('the captionseasy look (number and id are permanent) with its validated props'),
};

export const Word = z.object({
  src_t0: sec, src_t1: sec, text: z.string(),
  role: z.enum(['connector', 'key', 'number', 'title']).optional(),
  line_id: z.number().int().optional().describe('sentence or line index'),
  speaker: z.number().int().optional(), conf: z.number().min(0).max(1).optional(),
});

export const Zoom = z.object({ t: sec, scale: z.number().positive(), cx: frac, cy: frac, ease: ease.optional(), dur: sec.optional(), rot: z.number().optional().describe('roll, degrees clockwise (a rolled camera move)'), rule_id: ruleId.optional() });

export const Shot = z.object({
  t_in: sec, t_out: sec, src_in: sec, src_out: sec,
  layout: z.enum(['full', 'fit', 'split_top', 'split_bottom', 'card', 'pip', 'grid', 'full_insert']).optional(),
  framing: z.object({ scale: z.number().positive(), cx: frac, cy: frac, rot: z.number().optional() }).optional(),
  zoom: z.array(Zoom).optional(),
  camera: z.object({ asset_ref: assetRef.describe('camera:<move id>, an R7 camera move (edit-scope moves on user footage)'), t: sec.optional(), dur: sec.optional(), params: z.record(z.string(), z.unknown()).optional(), rule_id: ruleId.optional() })
    .optional().describe('a named library camera move on this shot; zoom keys stay the numbers the player draws'),
  bg: z.object({ mode: z.enum(['original', 'blur', 'matte_fill', 'matte_texture']), asset_ref: assetRef.optional(), role: role.optional() }).optional().describe("'blur': the same footage, blurred, fills the frame behind a 'fit' shot"),
  matte: z.boolean().optional().describe('cut the person out (person mask)'),
  mono: z.boolean().optional(), grade_id: z.string().optional(),
  rule_id: ruleId.optional(),
});

export const Removed = z.object({
  src_in: sec, src_out: sec,
  reason: z.enum(['pause_trim', 'filler', 'slate', 'retake', 'pre_roll', 'tail', 'silence']),
  text: z.string().optional().describe('the words removed, if any'), rule_id: ruleId,
});

export const Cut = z.object({
  t: sec,
  type: z.enum(['hard', 'jump', 'punch', 'flash', 'glitch', 'blur_zoom', 'zoom_through', 'whip', 'tile_grid', 'paper_tear', 'circle_wipe', 'slide', 'device_pullback']),
  dur: sec.optional(), trigger: z.enum(['sentence', 'pause', 'filler', 'keyword', 'number', 'beat', 'insert', 'hold_max']), rule_id: ruleId,
});

export const CaptionEvent = z.object({
  t0: sec, t1: sec, word_idx: z.array(z.number().int().min(0)),
  tier: z.enum(['connector', 'key', 'title']).optional(), style_id: z.string().optional(),
  case: z.enum(['upper', 'title', 'as-is', 'lower']).optional(), size: z.enum(['S', 'M', 'L', 'XL', 'XXL']).optional(),
  font_role: z.string().optional(),
  position: z.enum(['chest', 'left_of_head', 'top', 'lower', 'center', 'behind_subject', 'face-safe']).optional(),
  path: z.enum(['line', 'arc', 'vertical']).optional(), rotation: z.number().optional(),
  entry: z.string().optional(), exit: z.string().optional(), highlight_idx: z.array(z.number().int()).optional(), colour_role: role.optional(),
  rule_id: ruleId,
});

export const Insert = z.object({
  t0: sec, t1: sec,
  kind: z.enum(['broll', 'panel', 'poster', 'ui', 'checklist', 'card', 'title', 'timer', 'number', 'map', 'phone', 'object3d', 'photo']),
  frame: z.enum(['full', 'top_half', 'card_box', 'beside_head']),
  label: z.string().optional(), asset_ref: assetRef.optional(),
  need: z.string().optional().describe('the R4b need this insert serves, e.g. "show_number"'),
  query: z.string().optional().describe('stock search words, resolved to a file at render time'),
  side: z.enum(['left', 'right']).optional(), enter: z.string().optional(), exit: z.string().optional(),
  rule_id: ruleId.optional(),
});

export const Overlay = z.object({
  t0: sec, t1: sec,
  kind: z.enum(['halo', 'sunburst', 'doodle', 'outline_stroke', 'header_strip', 'glow_trace', 'grain', 'vignette', 'light_leak', 'title_behind', 'face_label']),
  asset_ref: assetRef.optional(), text: z.string().optional(), params: z.record(z.string(), z.unknown()).optional(), rule_id: ruleId,
});

/** R7: the engine sfx map's events, the names of the library's (:Event) nodes that sfx assets FIT. */
export const SFX_MAP_EVENTS = ['word', 'key-word', 'list-item', 'pop', 'cascade', 'bubble', 'card-in', 'slide-out', 'scene', 'hard-hit', 'stat', 'notify', 'accent', 'click-ui', 'code', 'ui-reveal', 'build', 'big-build', 'cta', 'page-turn', 'riffle', 'paper-pop', 'thud', 'tear'] as const;
/** The EDL's own sfx events and the library event each one sounds as (for the (:Event) query). */
export const SFX_EVENT_TO_MAP: Record<string, (typeof SFX_MAP_EVENTS)[number]> = { cut: 'scene', insert_in: 'card-in', title_in: 'hard-hit', flash: 'accent', stamp: 'thud', ui_click: 'click-ui', number_hit: 'stat', whoosh: 'slide-out', riser: 'build', end: 'cta' };

export const Sfx = z.object({
  t: sec, asset_ref: assetRef,
  event: z.enum(['cut', 'insert_in', 'title_in', 'flash', 'stamp', 'ui_click', 'number_hit', 'whoosh', 'riser', 'end',
    // the library's (:Event) names, which the engine sfx map and R7's FITS edges use (assets/sfx/map.json)
    ...SFX_MAP_EVENTS]),
  gain_db: z.number().optional(), rule_id: ruleId,
});

export const Music = z.object({
  asset_ref: assetRef, offset: sec.optional().describe('start point in the track, seconds'),
  bpm: z.number().positive().optional(), beats: z.array(sec).optional().describe('output seconds'),
  gain_db: z.number(), duck: z.object({ db: z.number(), attack_ms: z.number().min(0), release_ms: z.number().min(0) }).optional(),
  cut_on_beat: z.boolean().optional(), end: z.enum(['button', 'fade', 'cut']).optional(), fade: sec.optional(),
  credit: z.string().optional().describe('the credit line a CC BY track needs'), rule_id: ruleId.optional(),
});

export const Voice = z.object({
  clean: z.enum(['none', 'arnndn', 'afftdn']), gain_db: z.number().optional(),
  target_lufs: z.number().max(0), true_peak: z.number().max(0),
});

export const End = z.object({ kind: z.enum(['cta_comment', 'cta_pill', 'logo', 'name', 'text']), t0: sec, title: z.string().optional(), line: z.string().optional(), asset_ref: assetRef.optional(), rule_id: ruleId.optional() });

export const Face = z.object({ src_t: sec, x: z.number(), y: z.number(), w: z.number().positive(), h: z.number().positive(), conf: z.number().min(0).max(1).optional() }).describe('a face box in source time, as fractions of the source frame');

export const Beat = z.object({ t0: sec, t1: sec, word_idx: z.array(z.number().int().min(0)), tag: z.enum(['hook', 'claim', 'number', 'list', 'story', 'quote', 'name', 'cta', 'aside']), need: z.string().optional() }).describe('one model call tags the script; style rules map tags to inserts and cuts');

export const Metrics = z.object({
  duration: sec, source_duration: sec, changes_per_s: z.number().min(0), events_per_s: z.number().min(0),
  median_shot: sec, max_hold: sec, words_per_s: z.number().min(0), max_gap: sec,
  cuts_on_word_pct: z.number().min(0).max(100), sfx_on_cut_pct: z.number().min(0).max(100),
});

export const EdlSchema = z.object({
  ...Header,
  words: z.array(Word),
  shots: z.array(Shot).min(1),
  removed: z.array(Removed).optional(),
  cuts: z.array(Cut).optional(),
  captions: z.array(CaptionEvent).optional().describe('explicit caption events; when absent the player chunks words by the caption style'),
  inserts: z.array(Insert).optional(),
  overlays: z.array(Overlay).optional(),
  sfx: z.array(Sfx).optional(),
  music: Music.optional(),
  voice: Voice.optional(),
  end: End.optional(),
  faces: z.array(Face).optional(),
  beats: z.array(Beat).optional(),
  laws: z.object({ pause_max: sec, pause_keep: sec, hold_max: sec, snap_ms: z.number().min(0) }).optional().describe('the shared-law numbers this EDL was built with'),
  metrics: Metrics.optional(),
});

export type Edl = z.infer<typeof EdlSchema>;
export type EdlShotV0 = z.infer<typeof Shot>;
export type EdlRemoved = z.infer<typeof Removed>;
export type EdlCut = z.infer<typeof Cut>;
export type EdlMetrics = z.infer<typeof Metrics>;
export type EdlBeat = z.infer<typeof Beat>;

/** Compile-time guarantee: every EDL is a PlayerEdl, so the preview player plays it unchanged. */
export const asPlayerEdl = (e: Edl): PlayerEdl => e;

/** The JSON Schema (draft 2020-12) of the EDL, for other tools and languages. */
export function edlJsonSchema(): Record<string, unknown> {
  return { $id: 'https://moovi.dev/schema/edl-0.1.json', title: 'Moovi EDL v0', ...(z.toJSONSchema(EdlSchema, { target: 'draft-2020-12' }) as Record<string, unknown>) };
}

/** Keep ranges in source seconds, derived from shots (adjacent shots on contiguous source merge). */
export function keepOf(e: Pick<Edl, 'shots'>): { src_in: number; src_out: number }[] {
  const out: { src_in: number; src_out: number }[] = [];
  for (const s of e.shots) {
    const last = out.at(-1);
    if (last && Math.abs(s.src_in - last.src_out) < 0.002) last.src_out = s.src_out;
    else out.push({ src_in: s.src_in, src_out: s.src_out });
  }
  return out;
}

const median = (xs: number[]) => { if (!xs.length) return 0; const s = [...xs].sort((a, b) => a - b), m = s.length >> 1; return s.length % 2 ? s[m]! : (s[m - 1]! + s[m]!) / 2; };
const r3 = (x: number) => Math.round(x * 1000) / 1000;

/** R4's metrics block, measured from the EDL itself (output seconds). */
export function metricsOf(e: Edl, snapMs = 100): EdlMetrics {
  const { duration } = EDIT.timeline(e);
  const lens = e.shots.map(s => s.t_out - s.t_in);
  // a framing change: every shot boundary, every zoom key, every insert in and out
  const zooms = e.shots.reduce((n, s) => n + (s.zoom?.length ?? 0), 0);
  const inserts = e.inserts ?? [];
  const changes = (e.shots.length - 1) + zooms + inserts.length * 2;
  const events = changes + (e.overlays?.length ?? 0) + (e.sfx?.length ?? 0) + (e.captions?.length ?? 0);
  // longest single framing: a shot split by its zoom keys and by inserts covering it
  const marks = new Set<number>([0, duration]);
  e.shots.forEach(s => { marks.add(s.t_in); (s.zoom ?? []).forEach(z => marks.add(z.t)); });
  inserts.forEach(i => { marks.add(i.t0); marks.add(i.t1); });
  const ms = [...marks].filter(x => x >= 0 && x <= duration).sort((a, b) => a - b);
  let maxHold = 0; for (let i = 1; i < ms.length; i++) maxHold = Math.max(maxHold, ms[i]! - ms[i - 1]!);
  const ow = EDIT.outWords(e);
  let maxGap = ow.length ? ow[0]!.t0 : duration;
  for (let i = 1; i < ow.length; i++) maxGap = Math.max(maxGap, ow[i]!.t0 - ow[i - 1]!.t1);
  if (ow.length) maxGap = Math.max(maxGap, duration - ow.at(-1)!.t1);
  // a cut is on a word when its source in-point (or the previous shot's out-point) lies within snapMs of a word edge
  const edges = e.words.flatMap(w => [w.src_t0, w.src_t1]);
  const near = (x: number) => edges.some(y => Math.abs(x - y) <= snapMs / 1000);
  let onWord = 0, jumps = 0;
  for (let i = 1; i < e.shots.length; i++) {
    const a = e.shots[i - 1]!, b = e.shots[i]!;
    if (Math.abs(b.src_in - a.src_out) < 0.002) continue; // a framing change on continuous source, not a jump cut
    jumps++; if (near(b.src_in) || near(a.src_out)) onWord++;
  }
  const cutTimes = e.shots.slice(1).map(s => s.t_in);
  const sfx = e.sfx ?? [];
  const sfxOnCut = sfx.filter(s => cutTimes.some(t => Math.abs(t - s.t) <= 0.1)).length;
  return {
    duration: r3(duration), source_duration: r3(e.source.duration),
    changes_per_s: duration ? r3(changes / duration) : 0, events_per_s: duration ? r3(events / duration) : 0,
    median_shot: r3(median(lens)), max_hold: r3(maxHold), words_per_s: duration ? r3(ow.length / duration) : 0, max_gap: r3(Math.max(0, maxGap)),
    cuts_on_word_pct: jumps ? Math.round(1000 * onWord / jumps) / 10 : 100, sfx_on_cut_pct: sfx.length ? Math.round(1000 * sfxOnCut / sfx.length) / 10 : 100,
  };
}

/** A style's measured bands (R4): each metric must sit inside [min, max]. */
export type MetricBands = Partial<Record<keyof EdlMetrics, [number, number]>>;
/** Out-of-band metrics, one line each; empty when the edit is inside its style. Fails loudly by design (Claude 1's D1.1 note 3). */
export function checkMetrics(m: EdlMetrics, bands: MetricBands): string[] {
  return (Object.entries(bands) as [keyof EdlMetrics, [number, number]][])
    .filter(([k, [lo, hi]]) => !(m[k] >= lo && m[k] <= hi)).map(([k, [lo, hi]]) => `${k} ${m[k]} is outside ${lo} to ${hi}`);
}

/**
 * Validate an EDL: the schema, the player's own timeline check (EDIT.timeline), and the cross-field rules the schema
 * cannot say (word and removed ranges inside the source, output-timed events inside the film, word indexes in range,
 * kept and removed source never overlapping). Returns the parsed EDL and every problem found.
 */
export function validateEdl(input: unknown): { edl: Edl | null; problems: string[] } {
  const p = EdlSchema.safeParse(input);
  if (!p.success) return { edl: null, problems: p.error.issues.map(i => `${i.path.join('.') || '(root)'}: ${i.message}`) };
  const e = p.data, problems = [...EDIT.timeline(e).problems];
  const dur = e.shots.at(-1)!.t_out, sd = e.source.duration + 0.05, eps = 0.02;
  if (!e.version.startsWith('0')) problems.push(`version ${e.version} is not a v0 EDL`);
  e.words.forEach((w, i) => { if (w.src_t1 < w.src_t0 || w.src_t1 > sd) problems.push(`words.${i}: source times out of order or past the clip`); });
  e.shots.forEach((s, i) => (s.zoom ?? []).forEach((z, k) => { if (z.t < s.t_in - eps || z.t > s.t_out + eps) problems.push(`shots.${i}.zoom.${k}: key at ${z.t} is outside its shot`); }));
  const keep = keepOf(e);
  (e.removed ?? []).forEach((r, i) => {
    if (r.src_out <= r.src_in || r.src_out > sd) problems.push(`removed.${i}: empty or past the clip`);
    if (keep.some(k => r.src_in < k.src_out - eps && r.src_out > k.src_in + eps)) problems.push(`removed.${i}: overlaps a kept shot`);
  });
  const span = (name: string, xs: { t0: number; t1: number }[] | undefined) => (xs ?? []).forEach((x, i) => { if (x.t1 < x.t0 || x.t1 > dur + eps) problems.push(`${name}.${i}: ${x.t0} to ${x.t1} is outside the film (${dur.toFixed(2)} s)`); });
  span('captions', e.captions); span('inserts', e.inserts); span('overlays', e.overlays); span('beats', e.beats);
  (e.cuts ?? []).forEach((c, i) => { if (c.t > dur + eps) problems.push(`cuts.${i}: past the end`); });
  (e.sfx ?? []).forEach((s, i) => { if (s.t > dur + eps) problems.push(`sfx.${i}: past the end`); });
  for (const [name, xs] of [['captions', e.captions], ['beats', e.beats]] as const) (xs ?? []).forEach((x, i) => { if (x.word_idx.some(k => k >= e.words.length)) problems.push(`${name}.${i}: word index out of range`); });
  if (e.end && e.end.t0 > dur + eps) problems.push('end: starts after the film');
  return { edl: e, problems };
}
