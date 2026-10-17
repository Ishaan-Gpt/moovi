/**
 * The floor rules (PIPELINE.html band F, STAGE-1 W9, decision 11): the minimums no film ships without, as numbers in one
 * place. The Designer reads them to avoid a break, Lens checks them on every film: CHECK (review/lint.ts, collide.ts)
 * on edit plans, the film review (review/film/plan.ts) on generated films, through the same rule functions here.
 *
 * Taste is Ishaan's: every number below is exactly what the product does today, with the file it comes from. A rule
 * with no number today is OFF and marked `pending: 'ishaan'` (he sets it on the floor-numbers page); `proposed` only
 * quotes the pipeline's suggestion for that page and is never applied. Pure code over a film's data, no pixels.
 */
import { REVIEW_DEFAULTS, type ReviewConfig } from './config';

/** The one severity scale of Lens: block = the viewer sees a broken film, fix = a craft fault to send back, note = a lead. */
export type Level = 'block' | 'fix' | 'note';

export type Area = 'captions' | 'transitions' | 'text' | 'components' | 'theme' | 'pacing' | 'sound';

export interface FloorRule {
  area: Area;
  /** what it guards, in a few words (the floor-numbers page shows it) */
  label: string;
  /** min: a finding under the value; max: over it; flag: a finding whenever the data says it happened */
  kind: 'min' | 'max' | 'flag';
  unit?: 's' | 'words' | 'lines' | 'share' | 'frame height' | 'frame width' | 'per 5 s' | 'count' | 'dB' | 'LUFS' | 'LU';
  on: boolean;
  value: number | null;
  /** how a finding counts; null while Ishaan has not said */
  level: Level | null;
  pending?: 'ishaan';
  /** where today's number lives (or why there is none) */
  today: string;
  /** the pipeline's proposal (docs/PIPELINE.html band F), for the floor-numbers page only */
  proposed?: number | string;
}

/** the master loudness every mix is gained to today (audio/style1.ts STYLE1.masterLufs) */
export const MASTER_LUFS = -14;

const off = (area: Area, label: string, kind: FloorRule['kind'], unit: FloorRule['unit'] | undefined, today: string, proposed?: number | string): FloorRule =>
  ({ area, label, kind, ...(unit ? { unit } : {}), on: false, value: null, level: null, pending: 'ishaan', today, ...(proposed !== undefined ? { proposed } : {}) });

export const FLOOR = {
  // captions
  'captions.minSec': { area: 'captions', label: 'time on screen', kind: 'min', unit: 's', on: true, value: REVIEW_DEFAULTS.minCaptionSec, level: 'note', today: 'review/config.ts REVIEW_DEFAULTS.minCaptionSec 0.45 (CHECK caption_time, warn)', proposed: 0.8 },
  'captions.secPerWord': off('captions', 'seconds per word', 'min', 's', 'no check today', 0.3),
  'captions.maxLines': off('captions', 'lines at once', 'max', 'lines', 'no check today', 2),
  'captions.maxWords': { area: 'captions', label: 'words at once', kind: 'max', unit: 'words', on: true, value: REVIEW_DEFAULTS.maxCaptionWords, level: 'note', today: 'review/config.ts REVIEW_DEFAULTS.maxCaptionWords 4 (CHECK caption_words, warn)', proposed: 7 },
  'captions.face': { area: 'captions', label: 'never on the face (share of the caption allowed on it)', kind: 'max', unit: 'share', on: true, value: REVIEW_DEFAULTS.faceOverlap, level: 'fix', today: 'review/config.ts REVIEW_DEFAULTS.faceOverlap 0 (CHECK face, error)' },
  'captions.midWord': off('captions', 'no change mid-word', 'flag', undefined, 'no check today'),
  // transitions
  'transitions.minSec': off('transitions', 'shortest transition', 'min', 's', 'no check today', 0.25),
  'transitions.maxSec': off('transitions', 'longest transition', 'max', 's', 'no check today', 0.6),
  'transitions.keyWord': off('transitions', 'never during a key word', 'flag', undefined, 'no check today'),
  'transitions.holdSec': off('transitions', 'the new frame holds before anything else moves', 'min', 's', 'no check today', 0.6),
  // text
  'text.headlineMin': off('text', 'headline height', 'min', 'frame height', 'no check today', 0.06),
  'text.bodyMin': off('text', 'body text height', 'min', 'frame height', 'no check today', 0.035),
  'text.textOnly': off('text', 'no beat with only text', 'flag', undefined, 'no check today'),
  // components
  'components.emptySlot': off('components', 'no empty image slot', 'flag', undefined, 'no check today (the film review\'s empty-frame is a whole frame, not a slot)'),
  'components.minWidth': off('components', 'component width', 'min', 'frame width', 'no check today', 0.4),
  // theme
  'theme.palettes': off('theme', 'palettes per film', 'max', 'count', 'no check today', 1),
  'theme.typePairs': off('theme', 'type pairs per film', 'max', 'count', 'no check today', 1),
  'theme.grades': off('theme', 'grades per film', 'max', 'count', 'no check today', 1),
  // pacing
  'pacing.hookSec': { area: 'pacing', label: 'the opening beat changes by', kind: 'max', unit: 's', on: true, value: 4.0, level: 'note', today: 'review/film/plan.ts late-hook, over 4.0 s (P2)' },
  'pacing.maxBeatSec': { area: 'pacing', label: 'longest beat on one set-up (the end card may hold)', kind: 'max', unit: 's', on: true, value: 6.5, level: 'fix', today: 'review/film/plan.ts dead-beat, over 6.5 s (P1)', proposed: 4 },
  'pacing.minChangeSec': off('pacing', 'shortest gap between visual changes', 'min', 's', 'no check today', 1.5),
  'pacing.effectsPer5s': off('pacing', 'effects per 5 s', 'max', 'per 5 s', 'no check today', 1),
  'pacing.maxStillSec': off('pacing', 'longest frame without motion', 'max', 's', 'no check today', 4),
  // sound
  'sound.musicUnderDb': off('sound', 'music under the voice', 'min', 'dB', 'no check today; audio/style1.ts mixes the bed 3 LU under the voice (a mix setting, not a check)', 18),
  'sound.sfxOnKeyWord': off('sound', 'no sfx on a key word unless it is the accent', 'flag', undefined, 'no check today'),
  'sound.lufsTolerance': off('sound', 'loudness off -14 LUFS by at most', 'max', 'LU', 'no check today; audio/style1.ts masters to -14 LUFS (±0.3 LU while mixing), decision 6 names -14'),
  'sound.clicks': off('sound', 'no clicks', 'flag', undefined, 'no check today'),
} satisfies Record<string, FloorRule>;

export type RuleId = keyof typeof FLOOR;
export type FloorRules = Record<RuleId, FloorRule>;
export type FloorOverride = Partial<Record<RuleId, Partial<Pick<FloorRule, 'on' | 'value' | 'level'>>>>;

export const RULE_IDS = Object.keys(FLOOR) as RuleId[];

/**
 * The rules in force: the floor, then each override (later wins). A rule is only on with a number (flags need none) and
 * a level, so turning a pending rule on means giving it both.
 */
export function floorRules(...over: (FloorOverride | null | undefined)[]): FloorRules {
  const out = Object.fromEntries(RULE_IDS.map(id => [id, { ...FLOOR[id] }])) as FloorRules;
  for (const o of over) {
    if (!o || typeof o !== 'object') continue;
    for (const id of RULE_IDS) {
      const x = o[id]; if (!x) continue;
      const r = out[id];
      if (typeof x.value === 'number' && Number.isFinite(x.value)) r.value = x.value;
      if (x.level === 'block' || x.level === 'fix' || x.level === 'note') r.level = x.level;
      if (typeof x.on === 'boolean') r.on = x.on;
    }
  }
  for (const id of RULE_IDS) { const r = out[id]; if (r.on && (r.level === null || (r.kind !== 'flag' && r.value === null))) r.on = false; }
  return out;
}

/** CHECK's own numbers (a style or kit may move them through style_laws.review) over the floor, so an edit is held to what its config says. */
export const floorOfConfig = (cfg: Pick<ReviewConfig, 'minCaptionSec' | 'maxCaptionWords' | 'faceOverlap'>, ...over: (FloorOverride | null | undefined)[]): FloorRules =>
  floorRules({ 'captions.minSec': { value: cfg.minCaptionSec }, 'captions.maxWords': { value: cfg.maxCaptionWords }, 'captions.face': { value: cfg.faceOverlap } }, ...over);

/** Every rule still waiting for Ishaan's number or level (the floor-numbers page and the final report list these). */
export const pendingRules = (rules: FloorRules = floorRules()) => RULE_IDS.filter(id => rules[id].pending === 'ishaan' && !rules[id].on);

// ---------------------------------------------------------------- the data a film gives the floor

export interface FloorCaption {
  i: number; t0: number; t1: number; text: string; words: number;
  lines?: number;
  /** the caption's share on the face at a few sampled moments (CHECK samples 3) */
  face?: { t: number; share: number }[];
  /** the caption changes while a word is being said */
  midWord?: boolean;
}
export interface FloorBeat { i: number; t0: number; t1: number; setup: string; /** the end card, which may hold */ end?: boolean; textOnly?: boolean }
export interface FloorFilm {
  input: 'edit' | 'film';
  duration: number;
  captions?: FloorCaption[];
  beats?: FloorBeat[];
  transitions?: { t0: number; t1: number; onKeyWord?: boolean; holdSec?: number }[];
  texts?: { t: number; role: 'headline' | 'body'; height: number; text?: string }[];
  components?: { t: number; beat?: number; name: string; emptySlot?: boolean; width?: number }[];
  theme?: { palettes?: number; typePairs?: number; grades?: number };
  /** visual changes (cuts, beats, cards) in time order */
  changes?: number[];
  effects?: number[];
  stills?: { t0: number; t1: number }[];
  sound?: { musicUnderDb?: number; lufs?: number; sfxOnKeyWord?: { t: number; accent?: boolean }[]; clicks?: number[] };
}

export interface FloorFinding { rule: RuleId; level: Level; t: number | null; text: string; value?: number; caption?: number; beat?: number }

const hit = (rules: FloorRules, id: RuleId) => { const r = rules[id]; return r.on ? r : null; };
const f = (id: RuleId, r: FloorRule, x: Omit<FloorFinding, 'rule' | 'level'>): FloorFinding => ({ rule: id, level: r.level!, ...x });
const s1 = (n: number) => n.toFixed(1);

// ---------------------------------------------------------------- rule functions (CHECK and the film review call these)

/** One caption's time and size rules, in today's order (time, then words). The messages are CHECK's own. */
export function captionFloor(c: FloorCaption, rules: FloorRules): FloorFinding[] {
  const out: FloorFinding[] = [], dur = c.t1 - c.t0;
  let r = hit(rules, 'captions.minSec');
  if (r && dur < r.value!) out.push(f('captions.minSec', r, { t: (c.t0 + c.t1) / 2, caption: c.i, value: +dur.toFixed(2), text: `caption "${c.text}" is on screen ${dur.toFixed(2)} s (least ${r.value} s to read)` }));
  r = hit(rules, 'captions.secPerWord');
  if (r && c.words > 0 && dur / c.words < r.value!) out.push(f('captions.secPerWord', r, { t: (c.t0 + c.t1) / 2, caption: c.i, value: +(dur / c.words).toFixed(2), text: `caption "${c.text}" gives ${(dur / c.words).toFixed(2)} s a word (least ${r.value} s)` }));
  r = hit(rules, 'captions.maxWords');
  if (r && c.words > r.value!) out.push(f('captions.maxWords', r, { t: (c.t0 + c.t1) / 2, caption: c.i, value: c.words, text: `caption "${c.text}" shows ${c.words} words (most ${r.value})` }));
  r = hit(rules, 'captions.maxLines');
  if (r && c.lines !== undefined && c.lines > r.value!) out.push(f('captions.maxLines', r, { t: (c.t0 + c.t1) / 2, caption: c.i, value: c.lines, text: `caption "${c.text}" runs to ${c.lines} lines (most ${r.value})` }));
  r = hit(rules, 'captions.midWord');
  if (r && c.midWord) out.push(f('captions.midWord', r, { t: c.t0, caption: c.i, text: `caption "${c.text}" changes in the middle of a word` }));
  return out;
}

/** A caption on the face: the first sampled moment it covers more than the allowed share (CHECK's message). */
export function faceFloor(c: FloorCaption, rules: FloorRules): FloorFinding | null {
  const r = hit(rules, 'captions.face'); if (!r || !c.face) return null;
  const s = c.face.find(x => x.share > r.value!); if (!s) return null;
  return f('captions.face', r, { t: s.t, caption: c.i, value: +s.share.toFixed(3), text: `caption "${c.text}" covers the face at ${s1(s.t)} s (${Math.round(s.share * 100)}% of the caption)` });
}

/** The opening beat and every beat's length (the film review's late-hook and dead-beat, in its order). */
export function beatFloor(beats: FloorBeat[], rules: FloorRules): FloorFinding[] {
  const out: FloorFinding[] = [], first = beats[0];
  let r = hit(rules, 'pacing.hookSec');
  if (r && first && first.t1 - first.t0 > r.value!) out.push(f('pacing.hookSec', r, { t: first.t0, beat: 0, value: +(first.t1 - first.t0).toFixed(2), text: `the opening beat holds ${s1(first.t1 - first.t0)} s before anything changes; the hook should land by about 2.5 s` }));
  r = hit(rules, 'pacing.maxBeatSec');
  if (r) for (const b of beats) {
    const len = b.t1 - b.t0;
    if (len > r.value! && !b.end) out.push(f('pacing.maxBeatSec', r, { t: b.t0, beat: b.i, value: +len.toFixed(2), text: `beat ${b.i + 1} (${b.setup || 'no set-up'}) runs ${s1(len)} s on one set-up` }));
  }
  r = hit(rules, 'text.textOnly');
  if (r) for (const b of beats) if (b.textOnly) out.push(f('text.textOnly', r, { t: b.t0, beat: b.i, text: `beat ${b.i + 1} (${b.setup || 'no set-up'}) shows only text` }));
  return out;
}

/**
 * The whole floor over a film's data. `skip` names the rules the input already checks inline (CHECK's caption rules,
 * the film review's beat rules), so nothing is counted twice. A rule with no data to read is left out, never guessed.
 */
export function floorCheck(film: FloorFilm, rules: FloorRules = floorRules(), skip: RuleId[] = []): FloorFinding[] {
  const sk = new Set(skip), on = (id: RuleId) => sk.has(id) ? null : hit(rules, id), keep = (xs: FloorFinding[]) => xs.filter(x => !sk.has(x.rule));
  const out: FloorFinding[] = [];
  for (const c of film.captions ?? []) { out.push(...keep(captionFloor(c, rules))); if (!sk.has('captions.face')) { const x = faceFloor(c, rules); if (x) out.push(x); } }
  if (film.beats) out.push(...keep(beatFloor(film.beats, rules)));
  for (const tr of film.transitions ?? []) {
    const len = tr.t1 - tr.t0;
    let r = on('transitions.minSec'); if (r && len < r.value!) out.push(f('transitions.minSec', r, { t: tr.t0, value: +len.toFixed(2), text: `a transition at ${s1(tr.t0)} s lasts ${len.toFixed(2)} s (least ${r.value} s)` }));
    r = on('transitions.maxSec'); if (r && len > r.value!) out.push(f('transitions.maxSec', r, { t: tr.t0, value: +len.toFixed(2), text: `a transition at ${s1(tr.t0)} s lasts ${len.toFixed(2)} s (most ${r.value} s)` }));
    r = on('transitions.keyWord'); if (r && tr.onKeyWord) out.push(f('transitions.keyWord', r, { t: tr.t0, text: `a transition at ${s1(tr.t0)} s runs over a key word` }));
    r = on('transitions.holdSec'); if (r && tr.holdSec !== undefined && tr.holdSec < r.value!) out.push(f('transitions.holdSec', r, { t: tr.t1, value: +tr.holdSec.toFixed(2), text: `after the transition at ${s1(tr.t0)} s the new frame holds ${tr.holdSec.toFixed(2)} s (least ${r.value} s)` }));
  }
  for (const x of film.texts ?? []) {
    const id = x.role === 'headline' ? 'text.headlineMin' : 'text.bodyMin', r = on(id);
    if (r && x.height < r.value!) out.push(f(id, r, { t: x.t, value: +x.height.toFixed(3), text: `${x.role} text${x.text ? ` "${x.text}"` : ''} at ${s1(x.t)} s is ${(x.height * 100).toFixed(1)} % of the frame height (least ${(r.value! * 100).toFixed(1)} %)` }));
  }
  for (const c of film.components ?? []) {
    let r = on('components.emptySlot'); if (r && c.emptySlot) out.push(f('components.emptySlot', r, { t: c.t, ...(c.beat !== undefined ? { beat: c.beat } : {}), text: `the ${c.name} at ${s1(c.t)} s has an empty image slot` }));
    r = on('components.minWidth'); if (r && c.width !== undefined && c.width < r.value!) out.push(f('components.minWidth', r, { t: c.t, ...(c.beat !== undefined ? { beat: c.beat } : {}), value: +c.width.toFixed(3), text: `the ${c.name} at ${s1(c.t)} s is ${Math.round(c.width * 100)} % of the frame width (least ${Math.round(r.value! * 100)} %)` }));
  }
  for (const [id, k, what] of [['theme.palettes', 'palettes', 'palettes'], ['theme.typePairs', 'typePairs', 'type pairs'], ['theme.grades', 'grades', 'grades']] as const) {
    const r = on(id), n = film.theme?.[k];
    if (r && n !== undefined && n > r.value!) out.push(f(id, r, { t: null, value: n, text: `the film uses ${n} ${what} (most ${r.value})` }));
  }
  const ch = film.changes;
  let r = on('pacing.minChangeSec');
  if (r && ch) for (let i = 1; i < ch.length; i++) if (ch[i]! - ch[i - 1]! < r.value!) out.push(f('pacing.minChangeSec', r, { t: ch[i]!, value: +(ch[i]! - ch[i - 1]!).toFixed(2), text: `two visual changes ${(ch[i]! - ch[i - 1]!).toFixed(2)} s apart at ${s1(ch[i]!)} s (least ${r.value} s)` }));
  r = on('pacing.effectsPer5s');
  if (r && film.effects) {
    const fx = [...film.effects].sort((a, b) => a - b);
    for (let i = 0; i < fx.length; i++) { const n = fx.filter(t => t >= fx[i]! && t < fx[i]! + 5).length; if (n > r.value!) { out.push(f('pacing.effectsPer5s', r, { t: fx[i]!, value: n, text: `${n} effects in the 5 s from ${s1(fx[i]!)} s (most ${r.value})` })); break; } }
  }
  r = on('pacing.maxStillSec');
  if (r) for (const s of film.stills ?? []) if (s.t1 - s.t0 > r.value!) out.push(f('pacing.maxStillSec', r, { t: s.t0, value: +(s.t1 - s.t0).toFixed(2), text: `the frame holds still ${s1(s.t1 - s.t0)} s from ${s1(s.t0)} s (most ${r.value} s)` }));
  const snd = film.sound;
  r = on('sound.musicUnderDb'); if (r && snd?.musicUnderDb !== undefined && snd.musicUnderDb < r.value!) out.push(f('sound.musicUnderDb', r, { t: null, value: snd.musicUnderDb, text: `the music sits ${snd.musicUnderDb.toFixed(1)} dB under the voice (least ${r.value} dB)` }));
  r = on('sound.sfxOnKeyWord'); if (r) for (const x of snd?.sfxOnKeyWord ?? []) if (!x.accent) out.push(f('sound.sfxOnKeyWord', r, { t: x.t, text: `a sound effect lands on a key word at ${s1(x.t)} s` }));
  r = on('sound.lufsTolerance'); if (r && snd?.lufs !== undefined && Math.abs(snd.lufs - MASTER_LUFS) > r.value!) out.push(f('sound.lufsTolerance', r, { t: null, value: snd.lufs, text: `the mix is ${snd.lufs.toFixed(1)} LUFS (${MASTER_LUFS} LUFS, within ${r.value} LU)` }));
  r = on('sound.clicks'); if (r) for (const t of snd?.clicks ?? []) out.push(f('sound.clicks', r, { t, text: `a click at ${s1(t)} s` }));
  return out;
}

/** The rules switched on that this film's data could be checked against, and the ones on without data. */
export function floorCoverage(film: FloorFilm, rules: FloorRules = floorRules()): { on: RuleId[]; unread: RuleId[]; pending: RuleId[] } {
  const has: Record<Area, boolean> = {
    captions: !!film.captions?.length, transitions: !!film.transitions, text: !!film.texts || !!film.beats?.some(b => b.textOnly !== undefined), components: !!film.components,
    theme: !!film.theme, pacing: !!film.beats || !!film.changes || !!film.effects || !!film.stills, sound: !!film.sound,
  };
  const on = RULE_IDS.filter(id => rules[id].on);
  return { on, unread: on.filter(id => !has[rules[id].area]), pending: pendingRules(rules) };
}

/** The floor as rows for the floor-numbers page: id, area, label, number, unit, level, on/pending, today, proposed. */
export const floorTable = (rules: FloorRules = floorRules()) => RULE_IDS.map(id => ({ id, ...rules[id] }));
