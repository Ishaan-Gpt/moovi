// pnpm --filter @moovi/engine exec tsx scripts/floor-gallery.ts [--artifact <out.html>]
// The floor-numbers page (decision 11, docs/agents/DECISIONS.md): one control per floor number with a live 9:16 example
// that redraws as the number moves, the proposed value (the starting point, approved for showing) beside every value the
// product uses today (imported or lifted from the source, so the page cannot drift from it); the banned-phrase list
// (REVIEW_DEFAULTS.banned) as editable rows; and a block / warn / off choice for every CHECK kind and film-review code
// (read from the kind unions in review/types.ts and review/film/types.ts, today's severity read from the code that raises
// each). A choosing tool only: Ishaan sets the numbers and copies his picks as JSON. Nothing here changes a default.
// Writes docs/galleries/floor.html (the Ishaan test clip and the music bed referenced by relative paths: no media in git).
// --artifact also writes a copy without the document skeleton, with a neutral still and small audio extracts inlined.
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { color } from '@moovi/brand';
import { CAMERA } from '@moovi/library/dark-vox';
import { EVENT_SOUNDS, FPS, SOUND_RULES, TIMING, TYPE } from '@moovi/library/style-1';
import { STYLE1 } from '../src/audio/style1';
import { MUSIC_MIX } from '../src/audio/music-lib';
import { DEFAULT_LAWS } from '../src/edit/build';
import { CAPTION_FONTS, CAPTION_STYLES } from '../src/edit/captions';
import { FX_RULES } from '../src/edit/effects/plan';
import { FLOOR } from '../src/review/floor';
import { checkSevOf, filmSevOf } from '../src/review/lens';
import { FX_MIX } from '../src/edit/effects/render';
import { EDIT } from '../src/edit/lib';
import { STYLE_LAWS } from '../src/edit/styles';
import { REVIEW_DEFAULTS } from '../src/review/config';

const ROOT = join(import.meta.dirname, '..', '..', '..');
const ENG = join(ROOT, 'packages', 'engine');
const OUT = join(ROOT, 'docs', 'galleries', 'floor.html');
const CLIP = join(ROOT, 'docs', 'agents', 'ishaan-test', 'ishaan-test.mp4');
const BED = join(ENG, 'assets', 'music', 'bed.mp3');
const FONTS = join(ENG, 'assets', 'renderer', 'fonts');
const arg = (k: string) => { const i = process.argv.indexOf(`--${k}`); return i > 0 ? process.argv[i + 1] : undefined; };
const src = (p: string) => readFileSync(join(ROOT, p), 'utf8');
/** a number written inline in a product file, lifted by pattern so the page follows the code (throws if the code changed shape) */
function lift(p: string, re: RegExp, n = 1): number {
  const m = re.exec(src(p));
  if (!m) throw new Error(`floor-gallery: ${p} changed shape (looked for ${re}); update the extraction`);
  return Number(m[n]);
}
const W = 1080, H = 1920;
const pctH = (px: number) => +(px / H * 100).toFixed(2);
const r2 = (x: number) => Math.round(x * 100) / 100;

/* ── what the product does today, per floor number ── */
interface Cur { label: string; value: string; src: string }
interface Floor {
  id: string; label: string; what: string; unit: string; control: 'single' | 'range' | 'toggle';
  proposed: number | [number, number] | boolean; min?: number; max?: number; step?: number;
  /** "none today" when the product has no such rule; `today` then lists the nearest numbers it does use */
  rule: string | null; today: Cur[]; demo: string;
  /** product values on the control's own scale, drawn as marks on the example */
  marks?: { label: string; v: number }[];
}

// text sizes: the player sizes captions as a share of frame WIDTH (edit/lib.ts SIZE via EDIT.sizePx); shown here as a share of height
const sizeMarks = (pick: (s: typeof CAPTION_STYLES[number]) => string | undefined) => {
  const by = new Map<string, string[]>();
  for (const s of CAPTION_STYLES) { const z = pick(s); if (z) by.set(z, [...(by.get(z) ?? []), s.id]); }
  return [...by].map(([z, ids]) => { const px = EDIT.sizePx(z as never, W); return { size: z, px, pct: pctH(px), ids }; }).sort((a, b) => a.px - b.px);
};
const BODY = sizeMarks(s => s.size), HEAD = sizeMarks(s => s.key?.size);
const S1_HERO = Math.round(TYPE.goldSize * TYPE.heroScale);

const LAUNCH_DEF = { pre: lift('packages/engine/src/launch/plan.ts', /: \{ pre: ([\d.]+), post: [\d.]+ \}\)/), post: lift('packages/engine/src/launch/plan.ts', /: \{ pre: [\d.]+, post: ([\d.]+) \}\)/) };
const LAUNCH_TR = [...src('packages/library/src/kits/launch/trans.js').matchAll(/pre: ([\d.]+), post: ([\d.]+)/g)].map(m => r2(+m[1]! + +m[2]!));
const VIS_TR = lift('packages/engine/src/visual/page/motion.js', /export const TRANSITION_S = ([\d.]+)/);
const SM_FLASH = lift('packages/engine/src/edit/styles.ts', /c\.dur = ([\d.]+)/);
// the film review's beat numbers live in the floor rules now (review/floor.ts)
const DEAD_BEAT = FLOOR['pacing.maxBeatSec'].value;
const LATE_HOOK = FLOOR['pacing.hookSec'].value;
const EDITOR_BED = lift('packages/engine/src/tasks/editor.ts', /bedLu: adj\.bedLu \?\? ([\d.]+)/);
const S1_ARRIVE = r2(TIMING.sceneArrive / FPS);
const KEY_SFX = EVENT_SOUNDS['key-word'];

const FLOORS: Floor[] = [
  { id: 'headline_min_h', label: 'Headline text size', what: 'the smallest a headline, key word or hero number may be, as a share of frame height', unit: '% of height', control: 'single',
    proposed: 6, min: 2, max: 14, step: 0.25, rule: null, demo: 'headline',
    today: [
      ...HEAD.map(h => ({ label: `key word ${h.size} (${h.ids.join(', ')})`, value: `${h.pct} % (${h.px} px)`, src: 'edit/captions.ts key.size → edit/lib.ts SIZE (share of width)' })),
      { label: 'Style 1 gold word', value: `${pctH(TYPE.goldSize)} % (${TYPE.goldSize} px)`, src: 'library style-1 TYPE.goldSize' },
      { label: 'Style 1 hero word', value: `${pctH(S1_HERO)} % (${S1_HERO} px)`, src: 'TYPE.goldSize × TYPE.heroScale' },
    ],
    marks: [...HEAD.map(h => ({ label: h.size, v: h.pct })), { label: 'S1 gold', v: pctH(TYPE.goldSize) }, { label: 'S1 hero', v: pctH(S1_HERO) }] },
  { id: 'body_min_h', label: 'Body text size', what: 'the smallest a caption or body line may be, as a share of frame height', unit: '% of height', control: 'single',
    proposed: 3.5, min: 1.5, max: 8, step: 0.25, rule: null, demo: 'body',
    today: [
      ...BODY.map(b => ({ label: `caption ${b.size} (${b.ids.length} styles: ${b.ids.join(', ')})`, value: `${b.pct} % (${b.px} px)`, src: 'edit/captions.ts size → edit/lib.ts SIZE (share of width)' })),
      { label: 'Style 1 ink line', value: `${pctH(TYPE.inkSize)} % (${TYPE.inkSize} px)`, src: 'library style-1 TYPE.inkSize' },
    ],
    marks: [...BODY.map(b => ({ label: b.size, v: b.pct })), { label: 'S1 ink', v: pctH(TYPE.inkSize) }] },
  { id: 'transition_s', label: 'Transition length', what: 'how long a transition between two shots may run, shortest to longest', unit: 's', control: 'range',
    proposed: [0.25, 0.6], min: 0.05, max: 1.5, step: 0.05, rule: null, demo: 'transition',
    today: [
      { label: 'Launch default (pre + post)', value: `${r2(LAUNCH_DEF.pre + LAUNCH_DEF.post)} s, capped at 40 % of either shot`, src: 'launch/plan.ts (inline)' },
      { label: `Launch kit transitions (${LAUNCH_TR.length})`, value: `${Math.min(...LAUNCH_TR)} to ${Math.max(...LAUNCH_TR)} s`, src: 'library kits/launch/trans.js (inline pre + post)' },
      { label: 'Visual renderer', value: `${VIS_TR} s`, src: 'visual/page/motion.js TRANSITION_S' },
      { label: 'Style 1 scene arrive', value: `${S1_ARRIVE} s (${TIMING.sceneArrive} frames)`, src: 'library style-1 TIMING.sceneArrive' },
      { label: 'Dark Vox zoom-through cut', value: `${r2(CAMERA.cut.ramp + CAMERA.cut.settle)} s (ramp ${CAMERA.cut.ramp} + settle ${CAMERA.cut.settle})`, src: 'library dark-vox CAMERA.cut' },
      { label: 'Studio Minimal flash cut', value: `${SM_FLASH} s`, src: 'edit/styles.ts (inline)' },
    ],
    marks: [{ label: 'Launch', v: r2(LAUNCH_DEF.pre + LAUNCH_DEF.post) }, { label: 'Visual', v: VIS_TR }, { label: 'S1', v: S1_ARRIVE }, { label: 'DarkVox', v: r2(CAMERA.cut.ramp + CAMERA.cut.settle) }, { label: 'SM flash', v: SM_FLASH }] },
  { id: 'hold_after_transition_s', label: 'Hold after a transition', what: 'the least time a shot holds still after a transition lands, before anything else changes', unit: 's', control: 'single',
    proposed: 0.6, min: 0, max: 2, step: 0.05, rule: null, demo: 'hold',
    today: [
      { label: 'Edit: shortest shot', value: `${DEFAULT_LAWS.min_shot} s (atlas ${STYLE_LAWS.atlas.laws.min_shot ?? DEFAULT_LAWS.min_shot}, handmade ${STYLE_LAWS.handmade.laws.min_shot ?? DEFAULT_LAWS.min_shot}, studio-minimal ${STYLE_LAWS['studio-minimal'].laws.min_shot ?? DEFAULT_LAWS.min_shot})`, src: 'edit/build.ts DEFAULT_LAWS.min_shot, STYLE_LAWS[id].laws (a shot length, not a hold after a transition)' },
      { label: 'Dark Vox camera hold between moves', value: `${CAMERA.hold.min} to ${CAMERA.hold.max} s`, src: 'library dark-vox CAMERA.hold' },
    ] },
  { id: 'visual_change_s', label: 'A visual change every', what: 'how often the picture must change (a cut, a reframe, a new element): at least every this many seconds, and not faster than the low end', unit: 's', control: 'range',
    proposed: [1.5, 4], min: 0.25, max: 8, step: 0.25, rule: 'yes, but per path', demo: 'change',
    today: [
      { label: 'Edit: longest hold', value: `${DEFAULT_LAWS.hold_max} s (atlas ${STYLE_LAWS.atlas.laws.hold_max}, handmade ${STYLE_LAWS.handmade.laws.hold_max}, studio-minimal ${STYLE_LAWS['studio-minimal'].laws.hold_max})`, src: 'edit/build.ts DEFAULT_LAWS.hold_max, STYLE_LAWS[id].laws.hold_max' },
      { label: 'Edit: measured band, longest hold', value: `atlas ${STYLE_LAWS.atlas.bands.max_hold?.[1]}, handmade ${STYLE_LAWS.handmade.bands.max_hold?.[1]}, studio-minimal ${STYLE_LAWS['studio-minimal'].bands.max_hold?.[1]} s`, src: 'STYLE_LAWS[id].bands.max_hold' },
      { label: 'Film review: dead beat', value: `over ${DEAD_BEAT} s on one set-up`, src: 'review/film/plan.ts (inline)' },
      { label: 'Film review: late hook', value: `opening beat over ${LATE_HOOK} s`, src: 'review/film/plan.ts (inline)' },
      { label: 'Style 1: something new every', value: `${TIMING.newEventEverySec[0]} to ${TIMING.newEventEverySec[1]} s, dead air at most ${TIMING.deadAirMaxSec} s`, src: 'library style-1 TIMING' },
      { label: 'Dark Vox: reframe a shot after', value: `${CAMERA.reframe.after} s`, src: 'library dark-vox CAMERA.reframe.after' },
    ],
    marks: [{ label: 'edit', v: DEFAULT_LAWS.hold_max }, { label: 'dead beat', v: DEAD_BEAT }, { label: 'S1 dead air', v: TIMING.deadAirMaxSec }, { label: 'DarkVox', v: CAMERA.reframe.after }] },
  { id: 'effects_per_5s', label: 'Most effects per 5 s', what: 'the most effects (an insert, a card, an X1 move, a flash) inside any 5-second window', unit: 'per 5 s', control: 'single',
    proposed: 1, min: 0, max: 6, step: 1, rule: null, demo: 'effects',
    today: [
      { label: 'Effects film: one effect type at most', value: `${FX_RULES.maxPerType} times a film, ${FX_RULES.breathe} s of plain picture wanted between overlays (at least ${FX_RULES.minGap} s)`, src: 'edit/effects/plan.ts FX_RULES' },
      { label: 'CHECK: overlays at once', value: `at most ${REVIEW_DEFAULTS.maxOverlays}`, src: 'review/config.ts REVIEW_DEFAULTS.maxOverlays' },
      { label: 'CHECK: the same card again', value: `not inside ${REVIEW_DEFAULTS.repeatWindow} s`, src: 'review/config.ts REVIEW_DEFAULTS.repeatWindow' },
      { label: 'Style 1 sfx density', value: `${SOUND_RULES.sfxPerSec[0]} to ${SOUND_RULES.sfxPerSec[1]} sfx a second (sound, not effects)`, src: 'library style-1 SOUND_RULES.sfxPerSec' },
    ] },
  { id: 'component_min_w', label: 'Component minimum width', what: 'the narrowest a card, chart or UI component may be, as a share of frame width', unit: '% of width', control: 'single',
    proposed: 40, min: 10, max: 100, step: 1, rule: null, demo: 'component',
    today: [{ label: 'Style 1 width budgets (caps, not minimums)', value: `${Math.min(...Object.values(TYPE.width).map(w => w.cap))} to ${Math.max(...Object.values(TYPE.width).map(w => w.cap))} px of ${W}`, src: 'library style-1 TYPE.width[*].cap' }] },
  { id: 'music_under_voice_db', label: 'Music under the voice', what: 'how far the music bed sits below the voice, in loudness (dB ≈ LU)', unit: 'dB', control: 'single',
    proposed: 18, min: 0, max: 30, step: 1, rule: 'yes, four different numbers', demo: 'music',
    today: [
      { label: 'Style 1 mix', value: `${STYLE1.bedLuUnder} LU (no ducking)`, src: 'audio/style1.ts STYLE1.bedLuUnder; library SOUND_RULES.bedUnderVoiceLu = ' + SOUND_RULES.bedUnderVoiceLu },
      { label: 'Editor mix (crew films, bench)', value: `${EDITOR_BED} LU, the user may set 0 to 14`, src: 'tasks/editor.ts (inline)' },
      { label: 'Effects film', value: `${FX_MIX.under} LU, ducked ${FX_MIX.duck} dB on words`, src: 'edit/effects/render.ts FX_MIX.under' },
      { label: 'Music library bed (Clip Moment)', value: `${MUSIC_MIX.underVoiceLu} LU plus a sidechain`, src: 'audio/music-lib.ts MUSIC_MIX.underVoiceLu' },
    ],
    marks: [{ label: 'S1', v: STYLE1.bedLuUnder }, { label: 'FX', v: FX_MIX.under }, { label: 'lib', v: MUSIC_MIX.underVoiceLu }] },
  { id: 'no_sfx_on_key_word', label: 'No sfx on a key word', what: 'a sound effect never lands on a key word unless it is the accent (it moves to the cut or beat beside it)', unit: '', control: 'toggle',
    proposed: true, rule: null, demo: 'sfx',
    today: [{ label: 'The opposite today: Style 1 and Launch play a sound on the key word', value: `"key-word" → ${KEY_SFX.ids.join(', ')} at ${KEY_SFX.db} dB (${KEY_SFX.note})`, src: 'library style-1 EVENT_SOUNDS["key-word"]; launch kit events' }] },
];

/* ── problems: every CHECK kind and film-review code, read from the unions; today's severity from the code that raises it ── */
const union = (p: string, re: RegExp) => { const m = re.exec(src(p)); if (!m) throw new Error(`floor-gallery: ${p} changed shape (looked for ${re})`); return [...m[1]!.matchAll(/'([^']+)'/g)].map(x => x[1]!); };
const CHECK_KINDS = union('packages/engine/src/review/types.ts', /export type IssueKind = ([^;]+);/);
const FILM_CODES = union('packages/engine/src/review/film/types.ts', /code: ([^;]+);/);
const reviewSrc = ['collide.ts', 'lint.ts', 'pixels.ts', 'runner.ts', 'vision.ts', 'contrast.ts', 'geometry.ts', 'index.ts'].map(f => src(`packages/engine/src/review/${f}`)).join('\n');
const filmSrc = ['index.ts', 'plan.ts', 'frames.ts'].map(f => src(`packages/engine/src/review/film/${f}`)).join('\n');
const sevOf = new Map<string, Set<string>>();
for (const m of reviewSrc.matchAll(/kind: '(\w+)', severity: ([^,]+),/g)) for (const s of m[2]!.matchAll(/'(error|warn)'/g)) (sevOf.get(`check.${m[1]}`) ?? sevOf.set(`check.${m[1]}`, new Set()).get(`check.${m[1]}`)!).add(s[1]!);
// the rules CHECK and the film review run through the floor (review/floor.ts): their severity is the rule's level
for (const [rule, key] of [['captions.minSec', 'check.caption_time'], ['captions.maxWords', 'check.caption_words'], ['captions.face', 'check.face']] as const) { const l = FLOOR[rule].level; if (FLOOR[rule].on && l) (sevOf.get(key) ?? sevOf.set(key, new Set()).get(key)!).add(checkSevOf(l)); }
for (const [rule, key] of [['pacing.hookSec', 'film.late-hook'], ['pacing.maxBeatSec', 'film.dead-beat']] as const) { const l = FLOOR[rule].level; if (FLOOR[rule].on && l) (sevOf.get(key) ?? sevOf.set(key, new Set()).get(key)!).add(filmSevOf[l]); }
for (const m of filmSrc.matchAll(/sev: ([^,]+), code: '([\w-]+)'/g)) for (const s of m[1]!.matchAll(/'(P\d)'/g)) (sevOf.get(`film.${m[2]}`) ?? sevOf.set(`film.${m[2]}`, new Set()).get(`film.${m[2]}`)!).add(s[1]!);
/** today's severity on the page's scale: CHECK error and film P0 → block; CHECK warn, P1, P2 → warn (today nothing holds up the preview) */
const toChoice = (s: string) => (s === 'error' || s === 'P0' ? 'block' : 'warn');
const RANK: Record<string, number> = { error: 0, P0: 0, P1: 1, warn: 2, P2: 2 };
/** where the code raises one kind at two severities, each case gets its own choice */
const SPLIT: Record<string, { id: string; label: string; today: string }[]> = {
  'check.face': [{ id: 'caption', label: 'a caption covers the face', today: 'error' }, { id: 'card', label: 'a card covers over 20 % of the face', today: 'warn' }],
  'check.vision': [{ id: 'strong', label: `the model rates it ${REVIEW_DEFAULTS.visionMinSeverity} or more of 5`, today: 'error' }, { id: 'mild', label: `the model rates it under ${REVIEW_DEFAULTS.visionMinSeverity}`, today: 'warn' }],
  'film.text-off-frame': [{ id: 'text', label: 'full text runs off the frame', today: 'P0' }, { id: 'dimmed', label: 'a dimmed word runs off the frame', today: 'P2' }],
};
const ABOUT: Record<string, string> = {
  'check.banned_word': 'a caption or card carries a banned phrase', 'check.caption_words': `a caption shows over ${REVIEW_DEFAULTS.maxCaptionWords} words`, 'check.caption_time': `a caption is on screen under ${REVIEW_DEFAULTS.minCaptionSec} s`,
  'check.repeat': `the same card twice inside ${REVIEW_DEFAULTS.repeatWindow} s`, 'check.overlays': `over ${REVIEW_DEFAULTS.maxOverlays} overlay on screen at once`, 'check.contrast': `caption contrast under ${REVIEW_DEFAULTS.minContrast}:1`,
  'check.face': 'text on the face', 'check.safe_zone': 'a caption in the platform UI bars', 'check.collision': 'a caption overlaps a card', 'check.burned_text': "a caption sits on the source's own text", 'check.vision': 'a finding from the model look at frames',
  'film.empty-frame': 'nothing on screen', 'film.sparse-frame': 'a near-empty frame', 'film.text-off-frame': 'text runs off the frame', 'film.dead-beat': `one set-up over ${DEAD_BEAT} s`, 'film.late-hook': `the opening beat holds over ${LATE_HOOK} s`,
  'film.end-card': 'the end card outside 8–30 % of the film', 'film.caption-gap': "captions miss over 15 % of the script's words", 'film.repeat-setup': 'the same set-up twice in a row', 'film.player-error': 'the player did not load',
  'check.floor': 'a floor rule Ishaan switches on (review/floor.ts)', 'film.floor': 'a floor rule Ishaan switches on (review/floor.ts)', 'film.vision': 'a finding from the model look at the beat stills (opt-in)',
};
interface Prob { id: string; group: string; kind: string; about: string; today: string; start: 'block' | 'warn' | 'off'; note?: string }
const PROBS: Prob[] = [];
for (const [group, pre, kinds] of [['CHECK (edit plans, review/)', 'check', CHECK_KINDS], ['Film review (generated films, review/film/)', 'film', FILM_CODES]] as const) {
  for (const k of kinds) {
    const key = `${pre}.${k}`, found = [...(sevOf.get(key) ?? [])].sort((a, b) => RANK[a]! - RANK[b]!);
    const split = found.length > 1 ? SPLIT[key] : undefined;
    if (split) for (const s of split) PROBS.push({ id: `${key}.${s.id}`, group, kind: k, about: `${ABOUT[key] ?? k}: ${s.label}`, today: s.today, start: toChoice(s.today) });
    else PROBS.push({ id: key, group, kind: k, about: ABOUT[key] ?? k, today: found.join(' / ') || 'not raised in code', start: found.length ? toChoice(found[0]!) : 'off',
      ...(found.length > 1 ? { note: `raised at ${found.join(' and ')}; starts at the stronger` } : !found.length ? { note: 'no code raises it today' } : {}) });
  }
}

/* ── loudness of the demo voice (the test clip) and the bed, measured so the music demo sets real dB ── */
function lufs(file: string): number | null {
  const r = spawnSync('ffmpeg', ['-hide_banner', '-nostats', '-i', file, '-vn', '-af', 'ebur128', '-f', 'null', '-'], { encoding: 'utf8' });
  return r.error ? null : parseL(String(r.stderr ?? ''));
}
function parseL(o: string) { const m = /I:\s+(-?[\d.]+) LUFS\s*\n\s*Threshold[\s\S]*$/.exec(o) ?? /I:\s+(-?[\d.]+) LUFS/.exec(o); return m ? +m[1]! : null; }
const LOUD = { voice: lufs(CLIP), bed: lufs(BED) };
const bedStart = (JSON.parse(readFileSync(join(ENG, 'assets', 'music', 'bed.json'), 'utf8')) as { start?: number }).start ?? 0;

const FONT_CSS = CAPTION_FONTS.split('\n').filter(l => /'(Inter|Anton|Geist|JetBrains Mono)'/.test(l))
  .map(l => l.replace(/url\(\/engine\/fonts\/([^)]+)\)/, (_, f: string) => `url(data:font/woff2;base64,${readFileSync(join(FONTS, f)).toString('base64')})`)).join('\n');

const DATA = { floors: FLOORS, banned: REVIEW_DEFAULTS.banned, probs: PROBS, loud: LOUD, bedStart, frame: { w: W, h: H } };

/* ── the page ── */
type Media = { clip: string; bed: string; voice: string; still?: undefined } | { still: string; voice?: string; bed?: string; b64: true };
function page(media: Media, skeleton: boolean) {
  const body = `<title>Floor Numbers</title>
<meta name="claude:viewport-fit-sides" content="cover">
<style>
/* Layout: a sticky bar over a grid of floor cards (a small 9:16 example, the control, today's values), then the banned phrases and the problem table. */
:root{
  --bg:#0A111C; --panel:#111B2A; --line:#22324A; --fg:${color.iceWhite}; --muted:#93A6BF; --ice:${color.ice}; --flag:#FF7A6B; --ok:#8FD9B6; --warn:#F2C86B;
  --ui:'Geist',system-ui,sans-serif; --mono:'JetBrains Mono',ui-monospace,monospace; color-scheme:dark;
}
${FONT_CSS}
html,body{background:var(--bg);color:var(--fg)}
body{font:14px/1.45 var(--ui);margin:0;padding-left:max(16px,env(safe-area-inset-left,0px));padding-right:max(16px,env(safe-area-inset-right,0px));padding-block:0 48px}
h1{font:600 22px/1.2 var(--ui);margin:0;letter-spacing:-.01em;text-wrap:balance}
h2{font:600 13px var(--ui);text-transform:uppercase;letter-spacing:.08em;color:var(--muted);margin:28px 0 12px}
h3{font:600 15px var(--ui);margin:0}
p{margin:0}
.intro{display:grid;gap:6px;padding-block:20px 12px;max-width:80ch;color:var(--muted)}
.intro h1{color:var(--fg)}
.bar{position:sticky;top:env(safe-area-inset-top,0px);z-index:5;background:color-mix(in srgb,var(--bg) 92%,transparent);backdrop-filter:blur(8px);border-bottom:1px solid var(--line);padding-block:10px;display:grid;gap:8px}
.row{display:flex;flex-wrap:wrap;gap:8px 16px;align-items:center}
button.act{border:1px solid var(--ice);background:var(--ice);color:#0A111C;border-radius:8px;padding:7px 14px;font:600 13px var(--ui);cursor:pointer}
button.ghost{border:1px solid var(--line);background:transparent;color:var(--fg);border-radius:8px;padding:6px 12px;font:12px var(--ui);cursor:pointer}
button:focus-visible,input:focus-visible,select:focus-visible{outline:2px solid var(--ice);outline-offset:2px}
#copied{font-size:12px;color:var(--ok)}
#out{display:none;width:100%;min-height:120px;background:var(--panel);color:var(--fg);border:1px solid var(--line);border-radius:8px;font:12px var(--mono)}
.sum{font-size:12px;color:var(--muted)}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(min(100%,460px),1fr));gap:18px}
.card{display:grid;grid-template-columns:160px 1fr;gap:14px;background:var(--panel);border:1px solid var(--line);border-radius:12px;padding:12px;min-width:0}
@media (max-width:520px){.card{grid-template-columns:1fr}.card .frame{max-width:200px}}
.card.moved{border-color:var(--ice)}
.frame{position:relative;aspect-ratio:9/16;width:100%;border-radius:8px;overflow:hidden;background:#000;outline:1px solid var(--line)}
.frame canvas{position:absolute;inset:0;width:100%;height:100%}
.body{display:grid;gap:8px;align-content:start;min-width:0}
.what{font-size:12px;color:var(--muted)}
.ctl{display:grid;gap:6px}
.ctl .vals{display:flex;gap:10px;align-items:baseline;flex-wrap:wrap}
.ctl .v{font:600 18px var(--mono)}
.ctl .p{font-size:12px;color:var(--muted)}
.ctl input[type=range]{width:100%}
.ctl input[type=number]{width:70px;background:var(--bg);color:var(--fg);border:1px solid var(--line);border-radius:6px;padding:4px 6px;font:13px var(--mono)}
.two{display:flex;gap:8px;align-items:center;flex-wrap:wrap;font-size:12px;color:var(--muted)}
.seg{display:inline-flex;border:1px solid var(--line);border-radius:8px;overflow:hidden}
.seg button{border:0;border-radius:0;background:transparent;color:var(--muted);padding:6px 10px;font:12px var(--ui);cursor:pointer}
.seg button[aria-pressed=true]{background:var(--ice);color:#0A111C}
.seg.sev button[aria-pressed=true][data-v=block]{background:var(--flag)}
.seg.sev button[aria-pressed=true][data-v=warn]{background:var(--warn)}
.seg.sev button[aria-pressed=true][data-v=off]{background:var(--muted)}
.today{font-size:12px;display:grid;gap:3px;border-top:1px solid var(--line);padding-top:8px}
.today b{font-weight:600}
.today .none{color:var(--warn)}
.today li{color:var(--muted)}
.today li span{color:var(--fg)}
.today li small{display:block;font:10.5px var(--mono);color:var(--muted);opacity:.8}
.today ul{margin:0;padding-left:16px;display:grid;gap:3px}
.banned{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:6px;max-width:980px}
.banned .r{display:flex;gap:6px;align-items:center;background:var(--panel);border:1px solid var(--line);border-radius:8px;padding:4px 6px}
.banned .r.new{border-color:var(--ok)}
.banned input{flex:1;min-width:0;background:transparent;color:var(--fg);border:0;font:13px var(--mono)}
.banned button{border:0;background:transparent;color:var(--muted);cursor:pointer;font:16px var(--ui);padding:0 4px}
.gone{font-size:12px;color:var(--muted);margin-top:8px}
.gone button{font:11px var(--mono);border:1px dashed var(--line);background:transparent;color:var(--muted);border-radius:999px;padding:2px 8px;cursor:pointer;margin:2px}
.add{display:flex;gap:6px;margin-top:8px;max-width:420px}
.add input{flex:1;background:var(--panel);color:var(--fg);border:1px solid var(--line);border-radius:8px;padding:6px 8px;font:13px var(--mono)}
table{border-collapse:collapse;width:100%;max-width:1100px;font-size:13px}
th,td{text-align:left;padding:7px 8px;border-bottom:1px solid var(--line);vertical-align:middle}
th{font:600 11px var(--ui);text-transform:uppercase;letter-spacing:.06em;color:var(--muted)}
td code{font:12px var(--mono)}
td.t{color:var(--muted);font:12px var(--mono)}
.tbl{overflow-x:auto}
.note{font-size:11px;color:var(--muted)}
.meter{display:flex;gap:10px;align-items:center}
@media (prefers-reduced-motion:reduce){.bar{backdrop-filter:none}}
</style>
<div class="intro">
  <h1>Floor Numbers</h1>
  <p>The numbers the Designer avoids and Lens checks (decision 11). Each control starts at the proposed value; what the product does today sits underneath, read from the code. Move a number and its example redraws. Then pick the banned phrases and which problems block, warn or stay off, and copy your picks into chat. Nothing here changes the product.</p>
  <p class="note">${'b64' in media ? 'This copy draws the examples over one still frame of the test clip; play the moving clip from the repo copy (docs/galleries/floor.html).' : 'The examples are drawn over the Ishaan test clip (docs/agents/ishaan-test).'} Frames are 1080 × 1920; sizes are measured on that frame.</p>
</div>
<div class="bar">
  <div class="row">
    <button class="act" id="copy">Copy my picks</button><span id="copied" aria-live="polite"></span>
    <button class="ghost" id="reset">Back to the proposals</button>
    <span class="sum" id="sum"></span>
  </div>
  <textarea id="out" readonly aria-label="Picks JSON"></textarea>
</div>
<h2>Floor numbers (${FLOORS.length})</h2>
<div class="grid" id="floors"></div>
<h2>Banned phrases (${REVIEW_DEFAULTS.banned.length} today)</h2>
<p class="note" style="margin-bottom:8px">From review/config.ts REVIEW_DEFAULTS.banned: a caption or card carrying one is flagged. Edit, remove or add; green rows are new.</p>
<div class="banned" id="banned"></div>
<div class="gone" id="gone"></div>
<div class="add"><input id="addw" placeholder="add a phrase (lower case)" aria-label="New banned phrase"><button class="ghost" id="addb">Add</button></div>
<h2>Which problems block, warn or stay off (${PROBS.length})</h2>
<p class="note" style="margin-bottom:8px">Every CHECK kind (review/types.ts) and film-review code (review/film/types.ts). Each starts at today's severity: CHECK "error" and film P0 start at block, CHECK "warn", P1 and P2 at warn. Today nothing holds up the preview; block means "N to fix" and the one repair runs.</p>
<div class="tbl"><table><thead><tr><th>Problem</th><th>Id</th><th>Today</th><th>Your pick</th></tr></thead><tbody id="probs"></tbody></table></div>
${'b64' in media ? '' : '<video id="clip" muted loop playsinline autoplay preload="auto" style="display:none"></video>'}
<script>var DATA = ${JSON.stringify(DATA)};
var MEDIA = ${JSON.stringify(media)};
</script>
<script>${CLIENT}</script>`;
  return skeleton ? `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">\n${body.replace('</style>', '</style></head><body>')}\n</body></html>` : body;
}

const CLIENT = String.raw`
(async () => {
const $ = id => document.getElementById(id), FW = DATA.frame.w, FH = DATA.frame.h, F = DATA.floors;
const store = { get(k, d) { try { const v = localStorage.getItem('moovi-fl-' + k); return v ? JSON.parse(v) : d; } catch { return d; } }, set(k, v) { try { localStorage.setItem('moovi-fl-' + k, JSON.stringify(v)); } catch {} } };
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
let vals = Object.assign(Object.fromEntries(F.map(f => [f.id, f.proposed])), store.get('vals', {}));
let banned = store.get('banned', null) || DATA.banned.slice();
let sev = Object.assign(Object.fromEntries(DATA.probs.map(p => [p.id, p.start])), store.get('sev', {}));

/* the picture: the clip (repo copy) or one still (artifact) */
const b64url = (s, type) => { const b = atob(s), u = new Uint8Array(b.length); for (let i = 0; i < b.length; i++) u[i] = b.charCodeAt(i); return URL.createObjectURL(new Blob([u], { type })); };
let V = null, STILL = null;
if (MEDIA.b64) { STILL = new Image(); STILL.src = 'data:image/jpeg;base64,' + MEDIA.still; await STILL.decode().catch(() => {}); }
else { V = $('clip'); V.src = MEDIA.clip; V.play().catch(() => {}); document.addEventListener('click', () => V.paused && V.play().catch(() => {}), { once: true }); }
const VOICE = MEDIA.voice ? (MEDIA.b64 ? b64url(MEDIA.voice, 'audio/mpeg') : MEDIA.voice) : null, BEDSRC = MEDIA.bed ? (MEDIA.b64 ? b64url(MEDIA.bed, 'audio/mpeg') : MEDIA.bed) : null;
await Promise.all(['700 40px Inter', '400 40px Anton', '500 40px Geist'].map(f => document.fonts.load(f).catch(() => null)));

/* drawing helpers, all in frame pixels (1080 x 1920) on a scaled context */
function pic(x, punch = 1, dx = 0, tint = null) {
  const src = V && V.readyState >= 2 && V.videoWidth ? V : STILL && STILL.naturalWidth ? STILL : null;
  if (src) {
    const sw0 = src.videoWidth || src.naturalWidth, sh0 = src.videoHeight || src.naturalHeight, k = Math.max(FW / sw0, FH / sh0) * punch, sw = FW / k, sh = FH / k;
    x.drawImage(src, Math.max(0, Math.min(sw0 - sw, (sw0 - sw) / 2 + dx * sw0)), (sh0 - sh) / 2, sw, sh, 0, 0, FW, FH);
  } else { const g = x.createLinearGradient(0, 0, 0, FH); g.addColorStop(0, '#5d6b78'); g.addColorStop(1, '#232a31'); x.fillStyle = g; x.fillRect(0, 0, FW, FH); }
  if (tint) { x.fillStyle = tint; x.fillRect(0, 0, FW, FH); }
}
function text(x, s, px, y, o = {}) {
  x.font = (o.weight || 700) + ' ' + px + 'px ' + (o.family || 'Inter'); x.textAlign = 'center'; x.textBaseline = 'middle';
  x.lineJoin = 'round'; x.lineWidth = Math.max(4, px * 0.12); x.strokeStyle = 'rgba(0,0,0,.55)'; x.strokeText(s, o.x || FW / 2, y);
  x.fillStyle = o.fill || '#fff'; x.fillText(s, o.x || FW / 2, y);
}
function wrap(x, s, px, maxW) { x.font = '700 ' + px + 'px Inter'; const out = []; let line = ''; for (const w of s.split(' ')) { const t = line ? line + ' ' + w : w; if (x.measureText(t).width > maxW && line) { out.push(line); line = w; } else line = t; } if (line) out.push(line); return out; }
function label(x, s, y = 90) { x.font = '600 60px Geist'; x.textAlign = 'left'; x.textBaseline = 'middle'; const w = x.measureText(s).width + 48; x.fillStyle = 'rgba(10,17,28,.8)'; x.beginPath(); x.roundRect(30, y - 44, w, 88, 18); x.fill(); x.fillStyle = '#F7FAFD'; x.fillText(s, 54, y); }
function timeline(x, loop, t, marks, y = FH - 120) {
  x.fillStyle = 'rgba(10,17,28,.7)'; x.fillRect(40, y - 26, FW - 80, 52);
  for (const m of marks) { const a = 40 + (FW - 80) * m.t0 / loop, b = 40 + (FW - 80) * (m.t1 ?? m.t0 + loop / 120) / loop; x.fillStyle = m.c || '${color.ice}'; x.fillRect(a, y - 20, Math.max(6, b - a), 40); }
  x.fillStyle = '#fff'; x.fillRect(40 + (FW - 80) * (t % loop) / loop - 3, y - 32, 6, 64);
}
function ruler(x, marks, v) { // today's product sizes as bars of their real height on the frame, bottom left; coral = under the chosen floor
  const ms = marks.slice().sort((a, b) => a.v - b.v), base = FH - 60, step = Math.min(150, (FW - 80) / ms.length); x.fillStyle = 'rgba(10,17,28,.72)'; x.fillRect(20, base - FH * 0.16, FW - 40, FH * 0.16 + 40);
  ms.forEach((m, j) => { const h = m.v / 100 * FH, cx = 60 + j * step; x.fillStyle = m.v < v ? '#FF7A6B' : '#8FD9B6'; x.fillRect(cx, base - h - 26, step * 0.5, h); x.fillStyle = '#F7FAFD'; x.font = '600 44px Geist'; x.textAlign = 'left'; x.textBaseline = 'middle'; x.fillText(m.label, cx, base - 4); });
  x.fillStyle = '#F7FAFD'; x.fillRect(40, base - v / 100 * FH - 26 - 2, FW - 80, 4); }
const ease = k => 1 - Math.pow(1 - Math.min(1, Math.max(0, k)), 3);

/* one example per floor; each takes (ctx, t seconds, value) */
const SHOTS = [{ punch: 1, dx: 0 }, { punch: 1.45, dx: 0.05, tint: 'rgba(207,230,247,.10)' }, { punch: 1.2, dx: -0.08 }, { punch: 1.7, dx: 0.1, tint: 'rgba(0,0,0,.12)' }];
const shot = (x, i, extra = 1) => { const s = SHOTS[((i % SHOTS.length) + SHOTS.length) % SHOTS.length]; pic(x, s.punch * extra, s.dx, s.tint); };
const DEMO = {
  headline(x, t, v, f) { pic(x); const px = v / 100 * FH; text(x, '40 HOURS', px, FH * 0.42, { family: 'Anton', weight: 400 }); x.strokeStyle = '${color.ice}'; x.setLineDash([16, 12]); x.lineWidth = 4; x.strokeRect(60, FH * 0.42 - px / 2, FW - 120, px); x.setLineDash([]); text(x, 'down to 5 minutes', 0.034 * FH, FH * 0.42 + px * 0.9, { weight: 600 }); label(x, v + ' % = ' + Math.round(px) + ' px'); },
  body(x, t, v) { pic(x); const px = v / 100 * FH, ls = wrap(x, 'Most people spend hours on every edit and still lose the viewer', px, FW * 0.82); ls.forEach((l, i) => text(x, l, px, FH * 0.66 + (i - (ls.length - 1) / 2) * px * 1.18)); label(x, v + ' % = ' + Math.round(px) + ' px'); },
  transition(x, t, v) { // loop: shortest, hold, longest, hold
    const [a, b] = v, hold = 1.2, loop = 2 * hold + a + b, u = t % loop; let k = 0, i = 0, d = a, lab = '';
    if (u < hold) { i = 0; } else if (u < hold + a) { i = 0; k = (u - hold) / a; lab = 'shortest ' + a + ' s'; } else if (u < 2 * hold + a) { i = 1; } else { i = 1; k = (u - 2 * hold - a) / b; d = b; lab = 'longest ' + b + ' s'; }
    if (k > 0) { const e = ease(k); x.save(); x.translate(-e * FW, 0); shot(x, i); x.restore(); x.save(); x.translate((1 - e) * FW, 0); shot(x, i + 1); x.restore(); } else shot(x, i);
    label(x, lab || 'holding'); timeline(x, loop, u, [{ t0: hold, t1: hold + a }, { t0: 2 * hold + a, t1: loop, c: '#F2C86B' }]);
  },
  hold(x, t, v) { const tr = 0.35, loop = 2 * (tr + v + 0.9), u = t % loop, half = loop / 2, h = u % half, i = Math.floor(u / half) * 2;
    if (h < tr) { const e = ease(h / tr); x.save(); x.translate(-e * FW, 0); shot(x, i); x.restore(); x.save(); x.translate((1 - e) * FW, 0); shot(x, i + 1); x.restore(); label(x, 'transition'); }
    else if (h < tr + v) { shot(x, i + 1); label(x, 'hold ' + (h - tr).toFixed(1) + ' / ' + v + ' s'); }
    else { const p = Math.min(1, (h - tr - v) / 0.35); shot(x, i + 1); if (p < 1) { x.globalAlpha = 1; } x.save(); x.translate(FW / 2, FH * 0.3); x.scale(ease(p), ease(p)); x.fillStyle = 'rgba(247,250,253,.92)'; x.beginPath(); x.roundRect(-300, -90, 600, 180, 28); x.fill(); x.fillStyle = '#0A111C'; x.font = '700 80px Inter'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('next change', 0, 0); x.restore(); label(x, 'free to change'); }
    timeline(x, half, h, [{ t0: 0, t1: tr, c: '#F2C86B' }, { t0: tr, t1: tr + v }]);
  },
  change(x, t, v) { const [a, b] = v, gaps = [a, (a + b) / 2, b, (a + b) / 2], loop = gaps.reduce((s, g) => s + g, 0), u = t % loop; let acc = 0, i = 0; while (i < gaps.length - 1 && u >= acc + gaps[i]) acc += gaps[i++];
    shot(x, i, 1 + 0.015 * (u - acc)); label(x, 'this shot ' + gaps[i].toFixed(2) + ' s'); let c = 0; timeline(x, loop, u, gaps.map(g => { const m = { t0: c, t1: c + 0.06 * loop / 4 }; c += g; return m; })); },
  effects(x, t, v) { const loop = 5, u = t % loop; pic(x); const n = Math.round(v); let on = 0; const ms = [];
    for (let j = 0; j < n; j++) { const t0 = (j + 0.5) * loop / n - 0.4, t1 = t0 + 0.8; ms.push({ t0, t1 }); if (u >= t0 && u < t1) on = Math.min(1, (u - t0) / 0.18, (t1 - u) / 0.18) || 0.001; }
    if (on > 0) { x.save(); x.translate(FW / 2, FH * 0.32); const s = 0.6 + 0.4 * ease(on); x.scale(s, s); x.globalAlpha = Math.min(1, on * 1.4); x.fillStyle = '${color.ice}'; x.beginPath(); x.roundRect(-260, -110, 520, 220, 30); x.fill(); x.fillStyle = '#0A111C'; x.font = '400 130px Anton'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('+40%', 0, 6); x.restore(); }
    label(x, n + ' in 5 s'); timeline(x, loop, u, ms); },
  component(x, t, v) { pic(x); const w = v / 100 * FW, h = Math.max(160, w * 0.42), cx = FW / 2, cy = FH * 0.34; x.fillStyle = 'rgba(247,250,253,.94)'; x.beginPath(); x.roundRect(cx - w / 2, cy - h / 2, w, h, Math.min(36, w * 0.06)); x.fill();
    const pad = Math.min(36, w * 0.08), bw = (w - pad * 2) / 5; ['#CFE6F7', '#9CC7E8', '#6BA8D6', '#3D7DB8', '#0A111C'].forEach((c, j) => { const bh = (h - pad * 2) * (0.3 + 0.14 * j); x.fillStyle = c; x.fillRect(cx - w / 2 + pad + j * bw + bw * 0.15, cy + h / 2 - pad - bh, bw * 0.7, bh); });
    x.strokeStyle = '#F2C86B'; x.setLineDash([14, 10]); x.lineWidth = 4; x.strokeRect(cx - w / 2, cy - h / 2 - 30, w, 0.1); x.setLineDash([]); label(x, v + ' % = ' + Math.round(w) + ' px wide'); },
  music(x, t, v) { pic(x); const lv = -16, lm = lv - v, y0 = FH * 0.18, sc = (FH * 0.5) / 40, now = audio.playing ? audio.level() : null;
    const bar = (cx, db, c, name, live) => { const top = y0 + (-db - 6) * sc; x.fillStyle = 'rgba(10,17,28,.72)'; x.fillRect(cx - 90, y0, 180, FH * 0.5); x.fillStyle = c; x.fillRect(cx - 70, top, 140, y0 + FH * 0.5 - top); x.fillStyle = '#fff'; x.font = '600 44px Geist'; x.textAlign = 'center'; x.fillText(name, cx, y0 + FH * 0.5 + 60); x.font = '500 38px JetBrains Mono'; x.fillText(db.toFixed(0) + ' LUFS', cx, y0 + FH * 0.5 + 115); };
    bar(FW * 0.32, lv, '#F7FAFD', 'voice'); bar(FW * 0.68, lm, '${color.ice}', 'music');
    x.font = '400 120px Anton'; x.textAlign = 'center'; x.fillStyle = '#fff'; x.fillText(v + ' dB', FW / 2, y0 - 70);
    for (const m of (F.find(f => f.id === 'music_under_voice_db').marks || [])) { const yy = y0 + (-(lv - m.v) - 6) * sc; x.fillStyle = '#FF7A6B'; x.fillRect(FW * 0.68 - 110, yy - 3, 220, 6); x.font = '500 30px Geist'; x.textAlign = 'left'; x.fillText(m.label + ' ' + m.v, FW * 0.68 + 120, yy); }
    label(x, audio.playing ? 'playing: voice + bed' : 'press Play demo', FH - 110); },
  sfx(x, t, v) { pic(x); const words = ['Ishaan', 'cut', '40 HOURS', 'of', 'editing'], loop = 4, u = t % loop, wt = j => 0.4 + j * 0.55, key = 2;
    const cur = Math.max(-1, ...words.map((_, j) => (u >= wt(j) ? j : -1)));
    x.font = '800 92px Inter'; const ws = words.map(w => x.measureText(w + ' ').width), tot = ws.reduce((s, w) => s + w, 0); let xx = FW / 2 - tot / 2;
    words.forEach((w, j) => { if (j <= cur) text(x, w, j === key ? 100 : 80, FH * 0.66, { x: xx + ws[j] / 2, fill: j === key ? '${color.ice}' : '#fff', family: j === key ? 'Anton' : 'Inter', weight: j === key ? 400 : 800 }); xx += ws[j]; });
    const at = v ? wt(key) - 0.55 : wt(key), hit = u >= at && u < at + 0.25; // on: the sound moves to the beat before the key word
    if (hit) { x.fillStyle = '#F2C86B'; x.beginPath(); x.arc(FW / 2, FH * 0.5, 60 + 180 * (u - at), 0, 7); x.globalAlpha = 1 - (u - at) * 4; x.fill(); x.globalAlpha = 1; }
    label(x, v ? 'sfx on the beat before' : 'sfx on the key word (today)');
    timeline(x, loop, u, [...words.map((_, j) => ({ t0: wt(j), t1: wt(j) + 0.42, c: j === key ? '${color.ice}' : '#5d6b78' })), { t0: at, t1: at + 0.08, c: '#F2C86B' }]); },
};

/* the music demo: the clip's voice and the bed, set to real loudness from the measured LUFS (generator, ffmpeg ebur128) */
const audio = { playing: false, els: null, level: () => 0,
  gains(v) { const L = DATA.loud, lv = L.voice ?? -16, lb = L.bed ?? -14, gv = Math.pow(10, (-16 - lv) / 20), gb = Math.pow(10, (-16 - v - lb) / 20), m = Math.max(1, gv, gb); return [gv / m, gb / m]; },
  set(v) { if (!this.els) return; const [gv, gb] = this.gains(v); this.els[0].volume = gv; this.els[1].volume = gb; },
  toggle(v, btn) {
    if (!VOICE || !BEDSRC) return;
    if (!this.els) { const a = new Audio(VOICE), b = new Audio(BEDSRC); b.loop = true; a.loop = true; this.els = [a, b]; }
    const [a, b] = this.els;
    if (this.playing) { a.pause(); b.pause(); this.playing = false; btn.textContent = 'Play demo'; return; }
    this.set(v); a.currentTime = 0; b.currentTime = MEDIA.b64 ? 0 : DATA.bedStart; Promise.all([a.play(), b.play()]).then(() => { this.playing = true; btn.textContent = 'Stop'; }, e => { btn.textContent = 'Could not play: ' + e.message; });
  } };

/* the floor cards */
const cards = F.map(f => {
  const el = document.createElement('article'); el.className = 'card';
  el.innerHTML = '<div class="frame"><canvas></canvas></div><div class="body"><h3></h3><p class="what"></p><div class="ctl"></div><div class="today"></div></div>';
  el.querySelector('h3').textContent = f.label; el.querySelector('.what').textContent = f.what;
  const ctl = el.querySelector('.ctl'), today = el.querySelector('.today');
  const fmt = v => f.control === 'toggle' ? (v ? 'on' : 'off') : f.control === 'range' ? v[0] + ' to ' + v[1] + ' ' + f.unit : v + ' ' + f.unit;
  ctl.innerHTML = '<div class="vals"><span class="v"></span><span class="p"></span></div>';
  const vEl = ctl.querySelector('.v'), pEl = ctl.querySelector('.p');
  pEl.textContent = 'proposed ' + fmt(f.proposed);
  let sync;
  if (f.control === 'toggle') {
    const seg = document.createElement('span'); seg.className = 'seg'; seg.setAttribute('role', 'group'); seg.setAttribute('aria-label', f.label);
    seg.innerHTML = '<button data-v="1">On</button><button data-v="0">Off</button>'; ctl.appendChild(seg);
    seg.querySelectorAll('button').forEach(b => b.addEventListener('click', () => { vals[f.id] = b.dataset.v === '1'; changed(); }));
    sync = () => seg.querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', String((b.dataset.v === '1') === vals[f.id])));
  } else if (f.control === 'range') {
    const box = document.createElement('div'); box.className = 'two';
    box.innerHTML = '<label>from <input type="number"></label><input type="range" aria-label="' + f.label + ' shortest"><label>to <input type="number"></label><input type="range" aria-label="' + f.label + ' longest">';
    ctl.appendChild(box); const [n0, r0, n1, r1] = box.querySelectorAll('input');
    for (const i of [n0, r0, n1, r1]) { i.min = f.min; i.max = f.max; i.step = f.step; }
    const put = (j, val) => { const v = vals[f.id].slice(); v[j] = Math.min(f.max, Math.max(f.min, +val || 0)); if (v[0] > v[1]) v[1 - j] = v[j]; vals[f.id] = v; changed(); };
    n0.addEventListener('input', () => put(0, n0.value)); r0.addEventListener('input', () => put(0, r0.value)); n1.addEventListener('input', () => put(1, n1.value)); r1.addEventListener('input', () => put(1, r1.value));
    sync = () => { const v = vals[f.id]; if (document.activeElement !== n0) n0.value = v[0]; r0.value = v[0]; if (document.activeElement !== n1) n1.value = v[1]; r1.value = v[1]; };
  } else {
    const box = document.createElement('div'); box.className = 'two'; box.innerHTML = '<input type="range" aria-label="' + f.label + '" style="flex:1"><input type="number" aria-label="' + f.label + ' value">'; ctl.appendChild(box);
    const [r, n] = box.querySelectorAll('input'); for (const i of [r, n]) { i.min = f.min; i.max = f.max; i.step = f.step; }
    const put = val => { vals[f.id] = Math.min(f.max, Math.max(f.min, +val || 0)); changed(); };
    r.addEventListener('input', () => put(r.value)); n.addEventListener('input', () => put(n.value));
    sync = () => { r.value = vals[f.id]; if (document.activeElement !== n) n.value = vals[f.id]; };
  }
  if (f.demo === 'music') { const b = document.createElement('button'); b.className = 'ghost'; b.textContent = VOICE && BEDSRC ? 'Play demo' : 'Demo audio not in this copy'; b.disabled = !(VOICE && BEDSRC); b.addEventListener('click', () => audio.toggle(vals[f.id], b)); ctl.appendChild(b);
    const n = document.createElement('p'); n.className = 'note'; n.textContent = 'Voice: the test clip at -16 LUFS. Bed: the shipped CC-BY bed set the chosen dB under it (measured: voice ' + (DATA.loud.voice ?? '?') + ', bed ' + (DATA.loud.bed ?? '?') + ' LUFS; browser volume caps at 1, so both move together).'; ctl.appendChild(n); }
  const head = f.rule === null ? '<p><b>Today:</b> <span class="none">none today</span> (no such rule). The nearest numbers the product uses:</p>' : '<p><b>Today:</b> ' + f.rule + '.</p>';
  today.innerHTML = head + '<ul>' + f.today.map(() => '<li><span></span><small></small></li>').join('') + '</ul>';
  today.querySelectorAll('li').forEach((li, j) => { li.firstChild.textContent = f.today[j].label + ': ' + f.today[j].value; li.lastChild.textContent = f.today[j].src; });
  $('floors').appendChild(el);
  const cv = el.querySelector('canvas');
  const update = () => { vEl.textContent = fmt(vals[f.id]); el.classList.toggle('moved', !same(vals[f.id], f.proposed)); sync(); if (f.demo === 'music') audio.set(vals[f.id]); };
  return { f, el, cv, update, visible: true };
});
function changed() { store.set('vals', vals); cards.forEach(c => c.update()); summary(); }
/* each canvas follows its frame's size (checked every frame: cheap, and it works where a ResizeObserver is throttled) */
const fit = c => { const w = Math.round(c.cv.parentNode.clientWidth * Math.min(2, devicePixelRatio || 1)); if (w && c.cv.width !== w) { c.cv.width = w; c.cv.height = Math.round(w * 16 / 9); } };
const io = new IntersectionObserver(es => { for (const e of es) { const c = cards.find(c => c.el === e.target); if (c) c.visible = e.isIntersecting; } }, { rootMargin: '200px' });
cards.forEach(c => io.observe(c.el));

/* banned phrases */
function renderBanned() {
  const box = $('banned'); box.innerHTML = '';
  banned.forEach((w, i) => {
    const r = document.createElement('div'); r.className = 'r' + (DATA.banned.includes(w) ? '' : ' new');
    r.innerHTML = '<input aria-label="Banned phrase"><button aria-label="Remove">×</button>';
    const inp = r.querySelector('input'); inp.value = w;
    inp.addEventListener('change', () => { const v = inp.value.trim().toLowerCase(); if (v) banned[i] = v; else banned.splice(i, 1); banned = [...new Set(banned)]; renderBanned(); summary(); });
    r.querySelector('button').addEventListener('click', () => { banned.splice(i, 1); renderBanned(); summary(); });
    box.appendChild(r);
  });
  const gone = DATA.banned.filter(w => !banned.includes(w)), g = $('gone'); g.innerHTML = '';
  if (gone.length) { g.append('Removed (tap to put back): '); for (const w of gone) { const b = document.createElement('button'); b.textContent = w; b.addEventListener('click', () => { banned.push(w); renderBanned(); summary(); }); g.appendChild(b); } }
  store.set('banned', banned);
}
const add = () => { const v = $('addw').value.trim().toLowerCase(); if (v && !banned.includes(v)) banned.push(v); $('addw').value = ''; renderBanned(); summary(); };
$('addb').addEventListener('click', add); $('addw').addEventListener('keydown', e => { if (e.key === 'Enter') add(); });

/* problems */
let group = '';
const tb = $('probs');
for (const p of DATA.probs) {
  if (p.group !== group) { group = p.group; const tr = document.createElement('tr'); tr.innerHTML = '<th colspan="4"></th>'; tr.firstChild.textContent = group; tb.appendChild(tr); }
  const tr = document.createElement('tr'); tr.innerHTML = '<td></td><td><code></code></td><td class="t"></td><td><span class="seg sev" role="group"><button data-v="block">Block</button><button data-v="warn">Warn</button><button data-v="off">Off</button></span></td>';
  tr.children[0].textContent = p.about; if (p.note) { const n = document.createElement('div'); n.className = 'note'; n.textContent = p.note; tr.children[0].appendChild(n); }
  tr.querySelector('code').textContent = p.id; tr.children[2].textContent = p.today;
  const seg = tr.querySelector('.seg'); seg.setAttribute('aria-label', p.id);
  const sync = () => seg.querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.v === sev[p.id])));
  seg.querySelectorAll('button').forEach(b => b.addEventListener('click', () => { sev[p.id] = b.dataset.v; store.set('sev', sev); sync(); summary(); }));
  sync(); tb.appendChild(tr);
}

function picks() {
  const floor = Object.fromEntries(F.map(f => [f.id, vals[f.id]]));
  return { gallery: 'docs/galleries/floor.html', picked: new Date().toISOString().slice(0, 10), floor,
    floor_changed_from_proposed: F.filter(f => !same(vals[f.id], f.proposed)).map(f => ({ id: f.id, proposed: f.proposed, picked: vals[f.id] })),
    floor_units: Object.fromEntries(F.map(f => [f.id, f.unit || 'on/off'])),
    banned: { list: banned, added: banned.filter(w => !DATA.banned.includes(w)), removed: DATA.banned.filter(w => !banned.includes(w)) },
    severity: Object.fromEntries(DATA.probs.map(p => [p.id, sev[p.id]])),
    severity_changed_from_today: DATA.probs.filter(p => sev[p.id] !== p.start).map(p => ({ id: p.id, today: p.today, picked: sev[p.id] })) };
}
function summary() { const p = picks(); $('sum').textContent = p.floor_changed_from_proposed.length + ' of ' + F.length + ' numbers moved · banned +' + p.banned.added.length + ' / −' + p.banned.removed.length + ' · ' + p.severity_changed_from_today.length + ' severities changed'; }
$('copy').addEventListener('click', () => {
  const text = JSON.stringify(picks(), null, 2), box = $('out'); box.value = text;
  const fallback = () => { box.style.display = 'block'; box.focus(); box.select(); let ok = false; try { ok = document.execCommand('copy'); } catch {} $('copied').textContent = ok ? 'Copied' : 'Select the text below and copy it'; };
  if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(() => { $('copied').textContent = 'Copied'; box.style.display = 'none'; }, fallback); else fallback();
});
$('reset').addEventListener('click', () => { vals = Object.fromEntries(F.map(f => [f.id, f.proposed])); banned = DATA.banned.slice(); sev = Object.fromEntries(DATA.probs.map(p => [p.id, p.start])); store.set('vals', vals); store.set('sev', sev); renderBanned(); document.querySelectorAll('.seg.sev').forEach(s => s.querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.v === sev[s.getAttribute('aria-label')])))); changed(); });

renderBanned(); changed();
const T0 = performance.now();
function frame() {
  const t = (performance.now() - T0) / 1000;
  for (const c of cards) if (c.visible) { fit(c); const x = c.cv.getContext('2d'); x.setTransform(c.cv.width / FW, 0, 0, c.cv.height / FH, 0, 0); DEMO[c.f.demo](x, t, vals[c.f.id], c.f); if (c.f.marks && (c.f.demo === 'headline' || c.f.demo === 'body')) ruler(x, c.f.marks, vals[c.f.id]); }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
window.__floor = { picks, cards: cards.length, probs: DATA.probs.length };
})().catch(e => { document.body.insertAdjacentHTML('afterbegin', '<pre style="color:#FF7A6B;white-space:pre-wrap">' + String(e && e.stack || e) + '</pre>'); });
`;

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, page({ clip: '../agents/ishaan-test/ishaan-test.mp4', voice: '../agents/ishaan-test/ishaan-test.mp4', bed: '../../packages/engine/assets/music/bed.mp3' }, true));
console.log(`wrote ${OUT}: ${FLOORS.length} floor numbers (${FLOORS.filter(f => f.rule === null).length} with no rule today), ${REVIEW_DEFAULTS.banned.length} banned phrases, ${PROBS.length} problems (${CHECK_KINDS.length} CHECK kinds, ${FILM_CODES.length} film codes); loudness voice ${LOUD.voice} / bed ${LOUD.bed} LUFS`);
for (const p of PROBS) console.log(`  ${p.id.padEnd(30)} today ${p.today.padEnd(18)} starts ${p.start}`);
const art = arg('artifact');
if (art) {
  // a neutral still (one frame of the clip) and small mono audio extracts, made in a temp folder, inlined, then deleted
  const tmp = mkdtempSync(join(tmpdir(), 'moovi-floor-'));
  try {
    const ff = (a: string[]) => execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', ...a]);
    ff(['-ss', '6', '-i', CLIP, '-frames:v', '1', '-vf', 'scale=480:-2', '-q:v', '5', join(tmp, 'still.jpg')]);
    ff(['-i', CLIP, '-vn', '-ac', '1', '-b:a', '64k', join(tmp, 'voice.mp3')]);
    ff(['-ss', String(bedStart), '-t', '20', '-i', BED, '-ac', '1', '-b:a', '64k', join(tmp, 'bed.mp3')]);
    const b = (f: string) => readFileSync(join(tmp, f)).toString('base64');
    const html = page({ b64: true, still: b('still.jpg'), voice: b('voice.mp3'), bed: b('bed.mp3') }, false);
    writeFileSync(art, html); console.log(`wrote ${art} (${(html.length / 1e6).toFixed(2)} MB)`);
  } finally { rmSync(tmp, { recursive: true, force: true }); }
}
