import type { CameraPresetId } from './camera';
import type { EffectId } from './effects';
import type { LookId } from './text';
import type { TransitionId } from './transitions';
import type { UiId } from './ui';
import { PUSH_BY_PRESET } from './camera';
import { PRESET_SLIDE } from './transitions';

/**
 * Scene recipes: the repeatable shots of a Style 1 film. Each names the kit preset it compiles to (or null for a bespoke
 * build), which text looks / UI / effects / transition / camera it combines, the sounds that belong to it, how long it runs
 * and which past videos (folder ids under MotionEasy styles/style-1/videos) use it. Pick one per beat of the script.
 */

export type SceneRole = 'hook' | 'problem' | 'proof' | 'demo' | 'explain' | 'list' | 'compare' | 'social' | 'cta' | 'outro' | 'bridge';

/** A sound that belongs to the scene, placed on a moment (word anchors are resolved by the kit). */
export interface SceneSfx {
  /** Where it lands: the first word, the key/slam word, the last line, each item, an object entry, the cut. */
  when: 'first-word' | 'key-word' | 'last-line' | 'each-item' | 'object-entry' | 'cut' | 'payoff' | 'end';
  event: string;
  id: string | null;
  note?: string;
}

export interface SceneRecipe {
  id: string;
  role: SceneRole;
  use: string;
  /** Typical length in seconds at the style's pace (~2.6-2.9 words/s). */
  seconds: readonly [number, number];
  /** Kit preset in s1kit.py / Moovi presets.ts, or null (built from layers). */
  preset: 'lines' | 'list_left' | 'stack_slam' | 'reveal' | 'trio' | 'grid4' | 'export_proof' | 'logo_land' | 'icon_ring' | 'logo_grid' | 'cta_comment' | 'cta_pill' | 'notif' | 'note' | 'seal' | 'flip' | null;
  text: readonly { look: LookId; note: string }[];
  ui: readonly UiId[];
  effects: readonly EffectId[];
  transition: TransitionId;
  camera: CameraPresetId;
  /** Camera push at the cut when the preset sets one. */
  push?: number;
  sfx: readonly SceneSfx[];
  /** The one thing that makes it this shot (layout numbers, rules). */
  layout: string;
  rules: readonly string[];
  usedIn: readonly string[];
}

const slam = { id: 'punch', event: 'hard-hit' } as const;
const cut = { when: 'cut', event: 'scene', id: 'air-cut', note: 'alternates with woosh-tight' } as const;

export const SCENES = {
  // ── hooks ─────────────────────────────────────────────────────────────────────────────────────────────────
  'hook-claim': {
    id: 'hook-claim', role: 'hook', use: 'Bold two-line claim over a burst with the brand mark or a phone: "YOUR BUSINESS DOESN\'T NEED / MORE TRAFFIC." First word before 2 s.',
    seconds: [2.5, 4], preset: 'lines', text: [{ look: 'film-ink', note: 'line 1, <= 26 chars' }, { look: 'accent-slam', note: 'line 2 slams on the claim word' }],
    ui: ['burst', 'mark'], effects: ['word-rise', 'word-slam', 'burst-behind', 'glide-in'], transition: 'zoom-out-open', camera: 'opening-zoom-out',
    sfx: [{ when: 'key-word', event: 'hard-hit', id: 'punch' }, { when: 'key-word', event: 'key-word', id: 'snap' }],
    layout: 'lines top 420, pitch 110, width min(900, 70*chars+120); burst d 640 at (540, 1150); lines sit above it.',
    rules: ['The first shown word lands before 2.0 s', 'one object only', 'a visual is on frame 0'], usedIn: ['eg-01', 'nb-01', 'ce-06-haiku-v2'],
  },
  'hook-question': {
    id: 'hook-question', role: 'hook', use: 'A question over a hero phone: ink line + gold serif line, a green-slam reel with the look sticker across it. Curiosity first.',
    seconds: [3, 4.5], preset: null, text: [{ look: 'film-ink', note: 'the question; one slam word' }, { look: 'serif-gold', note: 'the twist, gold cursive' }],
    ui: ['burst', 'phone', 'mediaCard'], effects: ['word-slam', 'slam-sparks', 'glow-bloom', 'slam-in', 'idle-float'], transition: 'zoom-out-open', camera: 'roll-settle',
    sfx: [{ when: 'key-word', event: 'hard-hit', id: 'punch' }, { when: 'key-word', event: 'accent', id: 'drop', note: 'on the gold line' }],
    layout: 'phone w 380 at (540, 1180) with glow #E6C6FF; sticker card w 600 at (600, 1420) rot -5; headline top 440; gold line top 555.',
    rules: ['out the first line before the gold one lands', 'camera starts rolled -1 degree'], usedIn: ['ce-11-hormozi-style', 'ce-06-haiku-v2', 'ce-12-kia-scene-hai'],
  },
  'hook-stack-slam': {
    id: 'hook-stack-slam', role: 'hook', use: 'Punch lines stacked at pitch 140; earlier ones dim; the last slams in the accent. "No Fluff. No Excuses. Just Results."',
    seconds: [3, 5], preset: 'stack_slam', text: [{ look: 'ink', note: 'weight 900 x N-1' }, { look: 'accent-slam', note: 'last line' }],
    ui: [], effects: ['word-rise', 'dim-back', 'word-slam', 'slam-sparks'], transition: 'slide-right', camera: 'push-in', push: PUSH_BY_PRESET.stack_slam,
    sfx: [{ when: 'last-line', event: 'key-word', id: 'snap' }, { when: 'last-line', event: 'hard-hit', id: 'punch' }],
    layout: 'top 420, gap 140; width min(820, 54*chars+60); last line top +15, width min(900, 66*chars+80).',
    rules: ['text-only scenes stay under 1.5 s: add a visual if longer'], usedIn: ['eg-01', 'nb-01', 'ce-06-sab-chhod-ke', 'ce-09-raat-ke-2-baje'],
  },
  'hook-story-lockscreen': {
    id: 'hook-story-lockscreen', role: 'hook', use: 'A first-person story opens on a phone lock screen at a time of night, a to-do note beside it. "Raat ke do baje."',
    seconds: [3, 4], preset: null, text: [{ look: 'film-ink', note: 'the time' }, { look: 'serif-gold', note: '"do baje."' }],
    ui: ['lockphone', 'stickyNote'], effects: ['glide-in', 'idle-float', 'word-rise'], transition: 'zoom-out-open', camera: 'pull-out',
    sfx: [{ when: 'object-entry', event: 'card-in', id: 'woosh-short' }],
    layout: 'lockphone w 400 at (370, 1210) rot -4; note w 400 at (800, 1170) rot 5; camera 1.18 on the phone, roll -1.',
    rules: ['the pulsing unticked item is the thing the script is about'], usedIn: ['ce-09-raat-ke-2-baje'],
  },

  // ── problem / pain ────────────────────────────────────────────────────────────────────────────────────────
  'problem-bill': {
    id: 'problem-bill', role: 'problem', use: 'The cost of the old way as a thermal receipt: lines print, the total spins to ₹0, items shatter, PAID stamps. "Subscription. CapCut Pro. Plugins. Total? Zero."',
    seconds: [6, 9], preset: null, text: [{ look: 'film-ink', note: 'setup' }, { look: 'serif-gold', note: '"Total?"' }, { look: 'accent-slam', note: '"Zero rupaye!"' }],
    ui: ['receipt', 'receiptLine', 'stamp'], effects: ['odometer-total', 'shatter', 'stamp-slam', 'slam-sparks'], transition: 'slide-up', camera: 'roll-settle',
    sfx: [{ when: 'each-item', event: 'list-item', id: 'ui-blip' }, { when: 'payoff', event: 'hard-hit', id: 'punch' }, { when: 'payoff', event: 'thud', id: 'soft-hit' }, { when: 'end', event: 'build', id: 'riser-short', note: 'the one riser lands on "Zero"' }],
    layout: 'receipt top 680 scale 1.2 (w 768, h 792); 3 rline at y +190/+270/+350; stamp (600, +300) rot -12.',
    rules: ['non-rupee audiences get their own currency: the port swaps the odometer face'], usedIn: ['ce-08-zero-ka-bill'],
  },
  'problem-reject-list': {
    id: 'problem-reject-list', role: 'problem', use: 'No X, no Y, no Z: rows ticked then crossed then shattered on their words. The "what you will not have to deal with" beat.',
    seconds: [3.5, 5], preset: null, text: [{ look: 'film-ink', note: '"No free trial,"' }, { look: 'serif-gold', note: '"no watermark, no subscription."' }],
    ui: ['checklistRow', 'panel', 'stamp'], effects: ['shatter', 'stamp-slam', 'glide-in'], transition: 'slide-up', camera: 'punch-in',
    sfx: [{ when: 'each-item', event: 'slide-out', id: 'woosh-tight', note: 'on each shatter' }, { when: 'each-item', event: 'thud', id: 'soft-hit' }],
    layout: 'rows w 640 h 100 at y 1140 + 130 i; kill on the item\'s word + 12 frames; red NO stamp only on rejection.',
    rules: ['red appears only here'], usedIn: ['ce-06-haiku', 'ce-06-haiku-v2', 'ce-07-reply-comment', 'ce-05-ullu-ban-gaye'],
  },
  'problem-trap': {
    id: 'problem-trap', role: 'problem', use: 'The competitor\'s trap shown, then rejected: a free-trial card counting down, a watermarked clip, price tags struck.',
    seconds: [4, 6], preset: null, text: [{ look: 'film-ink', note: 'what you get elsewhere' }, { look: 'serif-gold', note: 'the catch' }],
    ui: ['trialCard', 'priceTag', 'phone'], effects: ['pop-in', 'shatter', 'idle-float'], transition: 'slide-left', camera: 'push-in',
    sfx: [{ when: 'object-entry', event: 'pop', id: 'pop' }, { when: 'payoff', event: 'thud', id: 'soft-hit' }],
    layout: 'trial card (540, 760) w 620 h 300; shatter at "Ab nahi"; tags struck on their own words.',
    rules: ['competitors named in text only; never their logos unless the owner asks'], usedIn: ['ce-05-ullu-ban-gaye'],
  },
  'problem-crash': {
    id: 'problem-crash', role: 'problem', use: 'Consequence as a chart: reach card line rises then the last leg plunges, red end dot pulses.',
    seconds: [3, 4.5], preset: null, text: [{ look: 'film-ink', note: 'the mistake' }, { look: 'serif-gold', note: 'what it costs' }], ui: ['reachChart', 'num3d', 'marker'],
    effects: ['glide-in', 'marker-loop'], transition: 'slide-up', camera: 'punch-in', sfx: [{ when: 'payoff', event: 'thud', id: 'soft-hit' }],
    layout: 'chart w 860 h 560 centred at y ~1150; dropAt on the verb.', rules: ['no fake numbers: show the shape, not statistics'], usedIn: ['ce-10-teen-galtiyaan'],
  },
  'problem-grind': {
    id: 'problem-grind', role: 'problem', use: 'The manual way: an editor timeline floods with keyframes while the timecode races to hours; then it collapses into the product icon.',
    seconds: [5, 7], preset: null, text: [{ look: 'film-ink', note: '"Ek ek word pe keyframe."' }, { look: 'serif-gold', note: '"Teen ghante gaye."' }],
    ui: ['editorTimeline', 'mark', 'burst'], effects: ['typewriter-box', 'glide-out', 'burst-behind'], transition: 'collapse-to-point', camera: 'punch-in',
    sfx: [{ when: 'each-item', event: 'code', id: 'fast-typing' }, { when: 'payoff', event: 'hard-hit', id: 'punch' }],
    layout: 'nle w 960 h 560 at (540, 1140); keys one per 2 frames per track; collapseAt on "website".', rules: ['the timecode turns orange at the end'], usedIn: ['ce-09-raat-ke-2-baje'],
  },

  // ── explain ───────────────────────────────────────────────────────────────────────────────────────────────
  'explain-dictionary': {
    id: 'explain-dictionary', role: 'explain', use: 'Name the thing: a dictionary entry types its definition while a highlighter sweeps the headword. "Internet isse ___ bolta hai."',
    seconds: [4, 6], preset: null, text: [{ look: 'film-ink', note: 'setup line' }, { look: 'serif-gold', note: 'the name' }], ui: ['dictionaryCard', 'highlighter'],
    effects: ['typewriter-box', 'highlight-sweep'], transition: 'slide-up', camera: 'roll-punch',
    sfx: [{ when: 'key-word', event: 'key-word', id: 'snap' }, { when: 'each-item', event: 'code', id: 'fast-typing' }, { when: 'payoff', event: 'stat', id: 'chime' }, { when: 'end', event: 'build', id: 'riser-short', note: 'once: lands on the name' }],
    layout: 'card w 900 h 560 at (540, 1090); highlighter at (130, 840) 520x92 on "famous".', rules: ['text groups swap with line.out so lines never stack'], usedIn: ['ce-11-hormozi-style'],
  },
  'explain-voice-rule': {
    id: 'explain-voice-rule', role: 'explain', use: 'Show the rule live: a voice track, the word being said pops above the waveform, important words land in the green box.',
    seconds: [5, 8], preset: null, text: [{ look: 'film-ink', note: 'rule 1' }, { look: 'serif-gold', note: 'rule 2' }], ui: ['voiceTrack'], effects: ['glide-in', 'pop-in'],
    transition: 'slide-up', camera: 'roll-punch', sfx: [{ when: 'key-word', event: 'key-word', id: 'snap' }, { when: 'payoff', event: 'hard-hit', id: 'soft-hit' }],
    layout: 'wave w 900 h 460 at (540, 1150); words = every spoken word, hero = 3 key words; three text groups swap on `out`.', rules: ['one idea at a time'], usedIn: ['ce-11-hormozi-style'],
  },
  'explain-focus-lock': {
    id: 'explain-focus-lock', role: 'explain', use: 'Show where the eye goes: focus brackets lock on a caption on a reel; the Skip button shatters.',
    seconds: [3.5, 5], preset: null, text: [{ look: 'film-ink', note: 'claim' }, { look: 'serif-gold', note: 'consequence' }], ui: ['phone', 'focusBrackets', 'pillButton'],
    effects: ['focus-lock', 'shatter', 'glide-in'], transition: 'slide-up', camera: 'roll-punch', sfx: [{ when: 'payoff', event: 'stat', id: 'chime' }, { when: 'payoff', event: 'hard-hit', id: 'punch' }, { when: 'payoff', event: 'thud', id: 'soft-hit' }],
    layout: 'phone w 400 at (540, 1180); brackets 330x170 on its caption; pill (800, 1500).', rules: [], usedIn: ['ce-11-hormozi-style'],
  },
  'explain-annotate': {
    id: 'explain-annotate', role: 'explain', use: 'Value-first guide step: a phone carries the example, hand-drawn marker loops and 3D numerals mark mistake 1, 2, 3.',
    seconds: [4, 6], preset: null, text: [{ look: 'film-ink', note: 'the mistake' }, { look: 'serif-gold', note: 'the fix' }], ui: ['phone', 'phoneCaption', 'marker', 'num3d'],
    effects: ['marker-loop', 'glide-in', 'idle-float'], transition: 'slide-up', camera: 'roll-punch', sfx: [{ when: 'payoff', event: 'accent', id: 'drop' }, { when: 'object-entry', event: 'hard-hit', id: 'punch' }],
    layout: 'phone w 400 at (540, 1180) with a drawn caption; marker 420x160 around the problem; numeral w 300 h 360 beside.', rules: ['one caption look per film'], usedIn: ['ce-10-teen-galtiyaan', 'ce-12-kia-scene-hai'],
  },

  // ── list / steps ──────────────────────────────────────────────────────────────────────────────────────────
  'list-steps': {
    id: 'list-steps', role: 'list', use: 'Steps or value list: left-aligned lines arrive elastic from the right; each earlier line dims. "SEO that ranks. Ads that convert. ..."',
    seconds: [4, 8], preset: 'list_left', text: [{ look: 'bullet-item', note: 'one per spoken phrase' }], ui: ['phone', 'mediaCard'],
    effects: ['word-elastic', 'dim-back', 'bullet-sparkle', 'glide-in'], transition: 'slide-left', camera: 'push-in', push: PUSH_BY_PRESET.list_left,
    sfx: [{ when: 'each-item', event: 'list-item', id: 'ui-blip' }],
    layout: 'x 90, top 270 (centred around y 760 in the port), pitch 110, width min(860, 46*chars+60); bullets at x 250 with text at x 330 for step lists.',
    rules: ['3-5 items', 'visual on the right or below, never over the words'], usedIn: ['eg-01', 'nb-01', 'ce-06-sab-chhod-ke', 'ce-05-ullu-ban-gaye', 'ce-01-viral-captions'],
  },
  'list-looks-grid': {
    id: 'list-looks-grid', role: 'list', use: 'Many options at once: a 2-column grid of phones or look swatches cascading in, one pop every 2 frames; a serif title above.',
    seconds: [3, 5], preset: 'grid4', text: [{ look: 'serif-gold', note: 'the title' }], ui: ['phone', 'swatch', 'mediaCard'], effects: ['cascade-pops', 'idle-float', 'pop-in'],
    transition: 'slide-right', camera: 'push-in', push: PUSH_BY_PRESET.grid4, sfx: [{ when: 'first-word', event: 'cascade', id: 'pop-9', note: 'count 4, spacing 0.067' }],
    layout: 'phones w 290 at xs [350, 730], ys [760, 1390], rot [-2, 2, 2, -2], vt 4.0 + (1+2i)/30; title top 175.', rules: ['rotate pops, never repeat one back to back'], usedIn: ['ce-06-sab-chhod-ke', 'ce-01-viral-captions'],
  },
  'list-picker': {
    id: 'list-picker', role: 'list', use: 'Pick one: a real option is picked (ring + lift), four more drop in under it, the product icon and a Free chip land.',
    seconds: [5, 7], preset: null, text: [{ look: 'film-ink', note: '"Ye wala look,"' }, { look: 'serif-gold', note: '"aur 30+ aise looks"' }], ui: ['swatch', 'selectionRing', 'mark', 'typebox'],
    effects: ['selection-ring', 'cascade-pops', 'typewriter-box'], transition: 'slide-up', camera: 'roll-punch',
    sfx: [{ when: 'payoff', event: 'click-ui', id: 'mouse' }, { when: 'payoff', event: 'stat', id: 'chime' }, { when: 'each-item', event: 'cascade', id: 'pop-9' }],
    layout: 'picked swatch w 720 h 270 at (540, 870); four swatches w 380 h 142 at xs [320, 760], ys [1210, 1430]; icon w 150 at (900, 700); chip (420, 1585).', rules: ['real looks with their real names'], usedIn: ['ce-11-hormozi-style', 'ce-07-reply-comment'],
  },

  // ── stat / proof ──────────────────────────────────────────────────────────────────────────────────────────
  'stat-reveal': {
    id: 'stat-reveal', role: 'proof', use: 'A number is the proof: a 3D numeral thuds onto the desk (or a count-up line lands) with a chime; the claim sits beside it.',
    seconds: [2.5, 4], preset: null, text: [{ look: 'stat-number', note: 'count-up' }, { look: 'film-ink', note: 'what it counts' }], ui: ['num3d', 'swatch', 'mediaCard'],
    effects: ['count-up', 'glide-in', 'word-slam'], transition: 'slide-up', camera: 'punch-in', sfx: [{ when: 'key-word', event: 'stat', id: 'chime' }, { when: 'key-word', event: 'hard-hit', id: 'punch' }],
    layout: 'numeral w 300 h 360 rot -6; three look cards rise below it.', rules: ['verified numbers only: no number the brief does not give'], usedIn: ['ce-06-haiku-v2', 'ce-10-teen-galtiyaan', 'ce-01-viral-captions'],
  },
  'proof-coin': {
    id: 'proof-coin', role: 'proof', use: 'Free: a gold coin flips and lands face-up on the price, an "Open source" pill types in.',
    seconds: [3, 4.5], preset: null, text: [{ look: 'film-ink', note: '"Genuinely free hai."' }, { look: 'serif-gold', note: '"Aur open source bhi."' }], ui: ['coin', 'burst', 'typebox'],
    effects: ['coin-flip', 'burst-behind', 'typewriter-box'], transition: 'slide-up', camera: 'roll-settle', sfx: [{ when: 'payoff', event: 'stat', id: 'chime' }, { when: 'object-entry', event: 'pop', id: 'pop' }],
    layout: 'coin w 380 at (540, 1150) on a d 820 burst; pill (330, 1460) w 420 h 104.', rules: [], usedIn: ['ce-08-zero-ka-bill', 'ce-06-haiku-v2'],
  },
  'proof-seal': {
    id: 'proof-seal', role: 'proof', use: 'The proof moment: a gold rosette stamps in ("ONE FREE" / "100% FREE") with one shine sweep; a finished reel on a phone beside it.',
    seconds: [3, 4.5], preset: 'seal', text: [{ look: 'film-ink', note: 'claim' }, { look: 'serif-gold', note: 'qualifier' }], ui: ['seal', 'phone'], effects: ['stamp-slam', 'shine-sweep', 'glide-in'],
    transition: 'slide-up', camera: 'punch-in', sfx: [{ when: 'key-word', event: 'hard-hit', id: 'punch' }, { when: 'key-word', event: 'stat', id: 'chime' }],
    layout: 'seal w 440 (top <= 8 chars, bottom <= 10).', rules: [], usedIn: ['ce-06-haiku-v2', 'ce-07-reply-comment'],
  },
  'proof-export': {
    id: 'proof-export', role: 'proof', use: 'No watermark: an honest export pill fills and turns green, a phone shows the result and a highlighter circles the empty corner.',
    seconds: [3.5, 5], preset: 'export_proof', text: [{ look: 'film-ink', note: '"No watermark."' }], ui: ['progressPill', 'phone', 'highlighter'], effects: ['progress-fill', 'highlight-sweep', 'glide-in'],
    transition: 'slide-up', camera: 'push-in', push: PUSH_BY_PRESET.export_proof, sfx: [{ when: 'first-word', event: 'click-ui', id: 'mouse' }, { when: 'payoff', event: 'notify', id: 'notify' }],
    layout: 'pill (260, 230) 560x118; phone w 360 at (540, 1150); highlighter 160x110 at the phone\'s bottom-right corner.', rules: ['never show a fake "instant download" modal'], usedIn: ['ce-06-sab-chhod-ke', 'ce-07-reply-comment'],
  },
  'proof-local': {
    id: 'proof-local', role: 'proof', use: 'It stays on your device: a laptop plays the reel, a video file tries to leave, hits the wall, ripples and bounces back, a green lock badge.',
    seconds: [4.5, 6], preset: null, text: [{ look: 'film-ink', note: '"Sab tumhare browser mein."' }, { look: 'serif-gold', note: '"laptop se bahar nahi jaati."' }], ui: ['laptop', 'file', 'shield'],
    effects: ['move-along-path', 'glide-in'], transition: 'slide-up', camera: 'roll-settle', sfx: [{ when: 'object-entry', event: 'pop', id: 'pop' }, { when: 'payoff', event: 'thud', id: 'soft-hit' }, { when: 'payoff', event: 'notify', id: 'notify' }],
    layout: 'laptop w 900 h 640 at (540, 1150); file w 120 on path (540,1000) -> (905,830) -> (600,1010); shield (930, 820).', rules: [], usedIn: ['ce-08-zero-ka-bill'],
  },

  // ── compare / reveal ─────────────────────────────────────────────────────────────────────────────────────
  'compare-pull-reveal': {
    id: 'compare-pull-reveal', role: 'compare', use: 'Before/after through travel: open full-bleed on a clip that is secretly the editor\'s preview pane; one long pull-out reveals the whole browser, the reveal line slams.',
    seconds: [5, 8], preset: 'reveal', text: [{ look: 'dark-title', note: 'white, fixed, on a scrim' }, { look: 'accent-slam', note: 'the reveal line' }], ui: ['browser', 'mediaCard'],
    effects: ['word-slam', 'glide-in'], transition: 'pull-out-reveal', camera: 'reveal-pull', sfx: [{ when: 'cut', event: 'scene', id: 'air-cut', note: 'at pull - 3' }, { when: 'payoff', event: 'hard-hit', id: 'soft-hit' }],
    layout: 'browser w 1000 at (40, 560); pane rect in capture px (of 2880); fill = max(1080/pw, 1920/ph) * 1.01; scrim 640 px high 62 % black.', rules: ['titles leave 4 frames before the pull'], usedIn: ['ce-03-not-after-effects', 'ce-06-sab-chhod-ke'],
  },
  'compare-plain-vs-styled': {
    id: 'compare-plain-vs-styled', role: 'compare', use: 'Plain vs styled: a boring caption on a phone, then the viral look cards stack in beside it. Slow push, two hero cards.',
    seconds: [4, 6], preset: null, text: [{ look: 'hero-word', note: 'PLAIN WHITE' }, { look: 'film-ink', note: 'verdict' }], ui: ['phone', 'mediaCard', 'burst'], effects: ['glide-in', 'side-in', 'idle-float'],
    transition: 'slide-up', camera: 'push-in', sfx: [{ when: 'object-entry', event: 'card-in', id: 'woosh-short' }], layout: 'phone w 380 at left; look cards w 820-860 at (540, 840/1180/1500), alternating left/right entries.', rules: [], usedIn: ['ce-01-viral-captions', 'ce-04-im-your-caption'],
  },

  // ── demo ──────────────────────────────────────────────────────────────────────────────────────────────────
  'demo-trio': {
    id: 'demo-trio', role: 'demo', use: 'Three phones, one per spoken word: slam, glow, pop. "Pick a look, add motion, export."',
    seconds: [3, 4.5], preset: 'trio', text: [{ look: 'film-ink', note: 'title top 290' }], ui: ['phone', 'burst'], effects: ['slam-in', 'glow-bloom', 'pop-in', 'idle-float', 'burst-behind'],
    transition: 'slide-up', camera: 'push-in', push: PUSH_BY_PRESET.trio, sfx: [{ when: 'object-entry', event: 'hard-hit', id: 'punch', note: 'first phone' }, { when: 'object-entry', event: 'stat', id: 'chime', note: 'middle' }, { when: 'object-entry', event: 'bubble', id: 'bubble', note: 'last' }],
    layout: 'phones w 300 at xs [215, 540, 865], y 1090 (middle -40), rot [-4, 0, 4]; burst d 620 behind.', rules: [], usedIn: ['ce-06-sab-chhod-ke'],
  },
  'demo-browser-flow': {
    id: 'demo-browser-flow', role: 'demo', use: 'The real product flow: search bar types the brand and grows into the site, a big cursor clicks through (upload, written, looks, export) with chip titles above the moving UI; the payoff is a real output clip.',
    seconds: [8, 14], preset: null, text: [{ look: 'chip-title', note: 'titles on chips above the UI' }], ui: ['searchBar', 'browser', 'cursor', 'highlighter', 'mediaCard'],
    effects: ['cursor-move', 'click-ripple', 'highlight-sweep', 'tilt-settle'], transition: 'search-to-site', camera: 'dive-to-detail',
    sfx: [{ when: 'object-entry', event: 'code', id: 'fast-typing' }, { when: 'each-item', event: 'click-ui', id: 'mouse' }, { when: 'payoff', event: 'notify', id: 'notify' }],
    layout: 'search (90, 880) 900x150; browser w 1000 at (40, 560) with `pages` dissolving every click; cursor 110 px.', rules: ['captures are the real product, no URL pills unless approved'], usedIn: ['ce-02-open-source', 'ce-04-im-your-caption', 'ce-05-ullu-ban-gaye'],
  },
  'demo-looks-panel': {
    id: 'demo-looks-panel', role: 'demo', use: 'The editor\'s Looks panel beside a reel: the cursor picks one, the ring pops, the reel switches look.',
    seconds: [4, 6], preset: null, text: [{ look: 'film-ink', note: '"Look chuno,"' }, { look: 'serif-gold', note: '"After Effects jaisa."' }], ui: ['mediaCard', 'phone', 'selectionRing', 'cursor'],
    effects: ['cursor-move', 'click-ripple', 'selection-ring', 'glow-bloom'], transition: 'slide-up', camera: 'roll-punch', sfx: [{ when: 'payoff', event: 'click-ui', id: 'mouse' }, { when: 'payoff', event: 'stat', id: 'chime' }],
    layout: 'panel capture w 400 at (290, 1190); phone w 360 at (800, 1180), swapped at the click; ring over the picked option.', rules: [], usedIn: ['ce-09-raat-ke-2-baje'],
  },
  'demo-phone-hero': {
    id: 'demo-phone-hero', role: 'demo', use: 'One hero phone playing the product output over a burst, a loupe or highlighter on the detail.',
    seconds: [3, 5], preset: null, text: [{ look: 'film-ink', note: 'claim' }, { look: 'serif-gold', note: 'detail' }], ui: ['phone', 'burst', 'loupe', 'typebox'], effects: ['glide-in', 'idle-float', 'move-along-path', 'typewriter-box'],
    transition: 'slide-up', camera: 'punch-in', sfx: [{ when: 'object-entry', event: 'card-in', id: 'woosh-short' }, { when: 'payoff', event: 'stat', id: 'chime' }], layout: 'phone w 420 at (540, 1190); loupe r 150 x2 on a path; chip (610, 1660) w 330.', rules: [], usedIn: ['ce-08-zero-ka-bill', 'ce-06-haiku-v2'],
  },
  'demo-deck': {
    id: 'demo-deck', role: 'demo', use: 'The same clip in four looks: a fanned deck of phones that shuffles, front reel flicking out on an arc.',
    seconds: [3, 4.5], preset: null, text: [{ look: 'film-ink', note: 'two ink lines + two gold lines on swap' }], ui: ['deck'], effects: ['glide-in', 'cascade-pops'], transition: 'slide-up', camera: 'push-in',
    sfx: [{ when: 'each-item', event: 'cascade', id: 'pop' }], layout: 'deck w 360 centred y 1180, every 20 frames, leaves 10 frames before the cut.', rules: ['shows several caption looks at once: say so to the owner'], usedIn: ['ce-06-haiku-v2'],
  },

  // ── social proof / messages ───────────────────────────────────────────────────────────────────────────────
  'social-logos': {
    id: 'social-logos', role: 'social', use: 'Trust: client or tool logos as a 3-column grid of rotated cards, a title above. "Trusted by / works with".',
    seconds: [3, 4.5], preset: 'logo_grid', text: [{ look: 'film-ink', note: 'title top 420' }], ui: ['logoGrid', 'iconCard'], effects: ['cascade-pops', 'idle-float'], transition: 'slide-up', camera: 'push-in', push: PUSH_BY_PRESET.logo_grid,
    sfx: [{ when: 'first-word', event: 'cascade', id: 'pop-9' }], layout: 'cards 250 at xs 230 + 310 col, ys 1040 + 300 row; rot cycle [-4, 3, -2, 4, -3, 2]; float 6 px.', rules: ['real logos only (Simple Icons / site captures)'], usedIn: ['eg-01'],
  },
  'social-icon-ring': {
    id: 'social-icon-ring', role: 'social', use: 'The ecosystem: icons orbit the centre mark, one per spoken tool; a footer line and an accent line below.',
    seconds: [4, 6], preset: 'icon_ring', text: [{ look: 'film-ink', note: 'title top 420' }, { look: 'film-ink', note: 'footer top 1395' }, { look: 'accent-slam', note: 'footer 2, rises' }], ui: ['iconRing', 'mark'], effects: ['pop-in', 'idle-float', 'idle-spin'],
    transition: 'slide-up', camera: 'push-in', push: PUSH_BY_PRESET.icon_ring, sfx: [{ when: 'object-entry', event: 'pop', id: 'pop', note: 'rotate pop / pop-9 / pop-4' }],
    layout: 'ring centre (540, 990), rx 280, ry 270, icons 170; centre mark 210 spinning 10 deg/s.', rules: [], usedIn: ['eg-01'],
  },
  'social-chat': {
    id: 'social-chat', role: 'social', use: 'The reel is the reply: a DM thread, a friend asks, our reel arrives as the answer ("Sent ✓"). Soft CTA for value-first films.',
    seconds: [4, 6], preset: null, text: [{ look: 'film-ink', note: '"Agli baar koi poochhe,"' }, { look: 'serif-gold', note: '"ye video bhej dena."' }], ui: ['chat', 'voiceNote'], effects: ['glide-in', 'pop-in'],
    transition: 'slide-up', camera: 'roll-settle', sfx: [{ when: 'object-entry', event: 'notify', id: 'notify', note: 'the question' }, { when: 'payoff', event: 'card-in', id: 'woosh-short' }, { when: 'end', event: 'cta', id: 'drop-splash' }],
    layout: 'chat w 860 h 860 at (540, 1170); msgs: in on "poochhe" + 2, out reel on "bhej"; seenAt +10.', rules: ['no link ask in value-first films'], usedIn: ['ce-11-hormozi-style', 'ce-12-kia-scene-hai'],
  },
  'social-comments': {
    id: 'social-comments', role: 'social', use: 'Everyone is commenting: a live comment sheet fills row by row, each row a pop.',
    seconds: [3, 4.5], preset: null, text: [{ look: 'film-ink', note: 'claim' }], ui: ['commentFeed', 'replySticker'], effects: ['glide-in', 'pop-in'], transition: 'slide-up', camera: 'push-in',
    sfx: [{ when: 'each-item', event: 'pop', id: 'pop-4', note: 'rotating pops; the riser ends on the turn' }], layout: 'feed (120, 820) 760x730; rows on frames.', rules: [], usedIn: ['ce-05-ullu-ban-gaye', 'ce-07-reply-comment'],
  },
  'social-reply': {
    id: 'social-reply', role: 'social', use: 'Reply-to-comment format: the sticker opens the film ("Reply to @x\'s comment"), the comment types in, the answer follows.',
    seconds: [3, 5], preset: null, text: [{ look: 'film-ink', note: 'the answer' }], ui: ['replySticker', 'panel', 'dropzone', 'seal'], effects: ['glide-in', 'typewriter-box'], transition: 'slide-up', camera: 'push-in',
    sfx: [{ when: 'object-entry', event: 'bubble', id: 'bubble' }], layout: 'sticker w 760 h 300 near the top third.', rules: [], usedIn: ['ce-07-reply-comment'],
  },
  'social-audience': {
    id: 'social-audience', role: 'social', use: 'The relatable beat: follower avatars; half go "?" at the turn. A voice note, a Skip pill that shatters.',
    seconds: [4, 6], preset: null, text: [{ look: 'film-ink', note: 'setup' }, { look: 'serif-gold', note: 'turn' }], ui: ['crowd', 'voiceNote', 'pillButton', 'marker'], effects: ['pop-in', 'shatter', 'marker-loop'], transition: 'slide-up', camera: 'roll-punch',
    sfx: [{ when: 'payoff', event: 'accent', id: 'drop' }, { when: 'object-entry', event: 'bubble', id: 'bubble' }], layout: 'crowd w 860 h 420; confuseAt on the turn word.', rules: [], usedIn: ['ce-12-kia-scene-hai'],
  },
  'notification-landing': {
    id: 'notification-landing', role: 'bridge', use: 'Urgency without a fake clock: cards land as notifications (or a lock screen with one), then get swiped away. The reel is ready.',
    seconds: [3, 4.5], preset: 'notif', text: [{ look: 'film-ink', note: '1-2 lines' }], ui: ['notification', 'lockphone', 'phone'], effects: ['glide-in', 'swipe-out', 'pop-in'], transition: 'slide-up', camera: 'push-in',
    sfx: [{ when: 'object-entry', event: 'notify', id: 'notify' }, { when: 'payoff', event: 'slide-out', id: 'woosh-tight', note: 'on the swipe' }], layout: 'notif w 860 h 210 stacked at (540, 830) pitch ~230; swipe right 900 px, tilt 9 deg.', rules: ['no countdown that implies a deadline the brief does not have'], usedIn: ['ce-06-haiku', 'ce-09-raat-ke-2-baje'],
  },

  // ── cta / outro ───────────────────────────────────────────────────────────────────────────────────────────
  'cta-comment': {
    id: 'cta-comment', role: 'cta', use: 'Comment the keyword: "Comment" + the keyword slams, the composer types it, a cursor taps send, a DM bubble confirms. Brand with a lead magnet.',
    seconds: [4, 6], preset: 'cta_comment', text: [{ look: 'film-ink', note: '"Comment" top 300' }, { look: 'accent-slam', note: '"KEYWORD" top 400' }, { look: 'label-pill', note: 'DM bubble' }], ui: ['commentComposer', 'cursor', 'typebox', 'phone'], effects: ['cursor-move', 'click-ripple', 'typewriter-box', 'word-slam'],
    transition: 'slide-up', camera: 'push-in', push: PUSH_BY_PRESET.cta_comment, sfx: [{ when: 'payoff', event: 'click-ui', id: 'mouse', note: 'send - 2' }, { when: 'payoff', event: 'notify', id: 'notify', note: 'send + 8' }, { when: 'end', event: 'cta', id: 'drop-splash', note: 'send + 14' }],
    layout: 'composer (90, 760) 900x140; cursor (820, 1180) -> (920, 835) click; bubble (300, 1010) 680x124 deep green; phone w 260 at (540, 1500) rot -3.', rules: ['the last scene is the ask'], usedIn: ['ce-05-ullu-ban-gaye', 'ce-06-haiku', 'ce-06-sab-chhod-ke', 'ce-08-zero-ka-bill', 'ce-01-viral-captions'],
  },
  'cta-pill': {
    id: 'cta-pill', role: 'cta', use: 'Brand call to action without a keyword: two lines (the second accent), a pill types "Book your free consultation", a cursor clicks it, the wordmark lands.',
    seconds: [4, 6], preset: 'cta_pill', text: [{ look: 'film-ink', note: 'top 470' }, { look: 'accent-slam', note: 'top 580, rises' }, { look: 'label-pill', note: 'the pill' }], ui: ['ctaPill', 'cursor', 'mark'], effects: ['typewriter-box', 'cursor-move', 'click-ripple'],
    transition: 'slide-up', camera: 'push-in', push: PUSH_BY_PRESET.cta_pill, sfx: [{ when: 'payoff', event: 'code', id: 'fast-typing' }, { when: 'payoff', event: 'click-ui', id: 'mouse' }, { when: 'end', event: 'cta', id: 'drop-splash' }],
    layout: 'pill (240, 830) 600x130; cursor f+6 (820, 1220) -> f+20 (640, 910) click; mark w 150 at (420, 1300) + wordmark left at x 510.', rules: [], usedIn: ['eg-01', 'nb-01', 'ce-06-sab-chhod-ke'],
  },
  'cta-save-share': {
    id: 'cta-save-share', role: 'cta', use: 'Value-first films end on a save / share: the Save tile\'s bookmark fills with a spark ring and a "Saved" pill; no link ask.',
    seconds: [2.5, 4], preset: null, text: [{ look: 'film-ink', note: '"Save kar lo,"' }, { look: 'serif-gold', note: 'reason' }], ui: ['bookmark', 'mark'], effects: ['spark-ring', 'pop-in'], transition: 'slide-up', camera: 'push-in', sfx: [{ when: 'payoff', event: 'stat', id: 'chime' }, { when: 'end', event: 'cta', id: 'drop-splash' }],
    layout: 'bookmark w 260 at the centre; mark below.', rules: ['no "link in comments" when the brief says value first'], usedIn: ['ce-10-teen-galtiyaan'],
  },
  'outro-logo-land': {
    id: 'outro-logo-land', role: 'outro', use: 'The logo mark pops on its word over a burst; the one riser of the film lands here; wordmark slams below.',
    seconds: [2.5, 4], preset: 'logo_land', text: [{ look: 'film-ink', note: 'title top 520, weight 700' }, { look: 'accent-slam', note: 'wordmark top 1120' }], ui: ['mark', 'burst'], effects: ['pop-in', 'burst-behind', 'word-slam', 'idle-spin'],
    transition: 'slide-up', camera: 'push-in', push: PUSH_BY_PRESET.logo_land, sfx: [{ when: 'key-word', event: 'build', id: 'riser-short', note: 'ends on the word' }, { when: 'key-word', event: 'key-word', id: 'snap' }],
    layout: 'burst d 1.9 x size at (540, 840); mark 340 (720x300 contain for a product logo); wordmark width min(900, 95*chars).', rules: ['riser complete, ends on the hit'], usedIn: ['eg-01', 'ce-09-raat-ke-2-baje', 'ce-06-haiku-v2'],
  },
  'outro-follow': {
    id: 'outro-follow', role: 'outro', use: 'Identical CTA tail of the reference channel: comment keyword, lead magnet mock-up, "follow <brand>", crown/logo. A formula, not a one-off.',
    seconds: [4, 7], preset: null, text: [{ look: 'film-ink', note: 'the ask' }, { look: 'accent-slam', note: 'the brand' }], ui: ['commentComposer', 'mark', 'typebox'], effects: ['typewriter-box', 'pop-in'], transition: 'slide-up', camera: 'push-in',
    sfx: [{ when: 'payoff', event: 'cta', id: 'drop-splash' }], layout: 'ask, lead magnet 3D mock-up, follow line, logo.', rules: ['same tail on every video of the brand'], usedIn: ['ce-01-viral-captions', 'ce-02-open-source'],
  },
} as const satisfies Record<string, SceneRecipe>;

export type SceneId = keyof typeof SCENES;
export const SCENE_IDS = Object.keys(SCENES) as SceneId[];
export const scenesBy = (role: SceneRole) => SCENE_IDS.filter(id => SCENES[id].role === role);

/** Scenes that use a past video, for "which gold videos show this shot". */
export const scenesUsedIn = (video: string) => SCENE_IDS.filter(id => (SCENES[id].usedIn as readonly string[]).includes(video));

/** A story arc: hook -> proof -> climax -> CTA (law 7, SKILL §6). Roles in order, with how many seconds each takes of a 25-45 s film. */
export const ARCS = {
  promo: ['hook', 'problem', 'proof', 'demo', 'cta'],
  explainer: ['hook', 'explain', 'explain', 'social', 'cta'],
  guide: ['hook', 'explain', 'explain', 'explain', 'demo', 'cta'],
  story: ['hook', 'problem', 'bridge', 'demo', 'proof', 'cta'],
} as const satisfies Record<string, readonly SceneRole[]>;

/** Slide a recipe's preset uses (falls back to the recipe's transition). */
export const slideFor = (id: SceneId) => { const p = SCENES[id].preset; return p ? PRESET_SLIDE[p] ?? 'up' : null; };
