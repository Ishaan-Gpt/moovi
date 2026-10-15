import { params, defaults, type Params, type SfxRef } from './spec';
import type { EffectId } from './effects';
import { BRANDS, GRID, PROP_COLORS, TYPE, type BrandName } from './tokens';

/**
 * UI components and props used in Style 1 films, each as a parameterised spec: size, layout numbers, look, params with
 * defaults, entry/exit effect and sound. Sizes are px on the 1080x1920 frame (scale with tokens.scaleFor for landscape).
 * `place(id, ...)` turns any entry into an image layer (`draw` + `p`) the kit and renderer understand; `at` is an anchor
 * (a spoken word or a frame), exactly like a scene program's `at`.
 */

export type UiGroup = 'device' | 'media' | 'message' | 'input' | 'proof' | 'data' | 'draw' | 'brand' | 'collection';

export interface UiDef {
  id: string;
  group: UiGroup;
  /** `draw` id of an image layer, or `kind` of a layer of its own. */
  render: { draw: string } | { kind: string } | { image: 'card' | 'browser' | 'media' };
  /** Default box. h may be a ratio of w (`hRatio`). */
  size: { w: number; h?: number; hRatio?: number; wRange?: readonly [number, number] };
  /** Layout numbers inside the component (px or ratios of w/h as the key says). */
  layout: Record<string, unknown>;
  /** Look: colours, radius, shadow, type. */
  look: Record<string, unknown>;
  /** Params (the layer's `p`, or layer keys when `onLayer`). */
  params: Params;
  enter: EffectId | null;
  exit: EffectId | 'kill' | 'none';
  idle?: EffectId;
  sfx: readonly SfxRef[];
  use: string;
  /** Past videos (folder ids under MotionEasy styles/style-1/videos) that use it. */
  usedIn: readonly string[];
  source: string;
}

const ex = <T extends Record<string, unknown>>(x: T) => x;
const pop: SfxRef = { id: 'pop', event: 'pop' };
const cardIn: readonly SfxRef[] = [{ id: 'woosh-short', event: 'card-in' }, { id: 'soft-hit', event: 'card-in', offset: 0 }];
const SHADOW_DEFAULT = [0, 30, 50, 0.28] as const; // phone: [dx, dy, blur, alpha]
const P = PROP_COLORS;

export const UI = {
  // ── devices & frames ───────────────────────────────────────────────────────────────────────────────────────
  phone: {
    id: 'phone', group: 'device', render: { draw: 'phone' }, size: { w: 300, hRatio: 2.03, wRange: [260, 420] },
    layout: ex({ bezel: 0.035, radius: 0.16, focus: [0.5, 0.5], trioXs: GRID.phoneTrio.xs, gridXs: GRID.phoneGrid.xs, gridYs: GRID.phoneGrid.ys }),
    look: ex({ shadow: SHADOW_DEFAULT, floorBlob: 0.55, glare: 'glass sweep as it lands', frame: 'rounded, side buttons, island' }),
    params: params({ screen: '', vt: [1.0, 's', 'video start'], zoom: [1, 'x', '1.5 + focus top hides burned-in captions'], float: [6, 'px'], glow: '' }),
    enter: 'glide-in', exit: 'glide-out', idle: 'idle-float', sfx: cardIn,
    use: 'The hero object: a phone showing a clip or an `ui` overlay (reelui, capt, sky). One per scene, three in a trio, four in a grid.',
    usedIn: ['ce-01-viral-captions', 'ce-02-open-source', 'ce-06-haiku-v2', 'ce-06-sab-chhod-ke', 'ce-08-zero-ka-bill', 'ce-10-teen-galtiyaan', 'ce-11-hormozi-style', 'ce-12-kia-scene-hai'],
    source: 's1kit.phone, style1-timeline drawn("phone")',
  },
  browser: {
    id: 'browser', group: 'device', render: { image: 'browser' }, size: { w: 1000, hRatio: 0.625 },
    layout: ex({ origin: [GRID.browser.x, GRID.browser.y], bar: 'max(46, w * 0.075)', height: 'bar + w / 1.6', capturePx: GRID.browser.canvasW, radius: 'max(18, w * 0.03)' }),
    look: ex({ dots: P.browserDots, pill: P.browserPill, pillText: '#55544C', divider: 'rgba(0,0,0,0.08)', tilt: 4 }),
    params: params({ url: '', tilt: [4, 'deg'], focus: [0.5, 0], pages: ''}),
    enter: 'glide-in', exit: 'glide-out', sfx: cardIn,
    use: 'The real product, captured: a drawn browser window around a screenshot or video. Empty URL shows a lock (never show a URL the owner did not approve). `pages` changes the capture with a 4-frame dissolve.',
    usedIn: ['ce-02-open-source', 'ce-03-not-after-effects', 'ce-04-im-your-caption', 'ce-05-ullu-ban-gaye', 'ce-06-haiku-v2', 'ce-07-reply-comment', 'eg-01', 'nb-01'],
    source: 's1kit.win/browser/at_px, style1-timeline browserWin',
  },
  laptop: {
    id: 'laptop', group: 'device', render: { draw: 'laptop' }, size: { w: 900, h: 640 },
    layout: ex({ bezel: true, chrome: 'browser', base: 'aluminium with a lip and trackpad' }),
    look: ex({ extrusion: 'low-key 3D' }), params: params({ src: '', vt: [4.0, 's'] }),
    enter: 'glide-in', exit: 'glide-out', sfx: cardIn,
    use: 'Local / private: "it runs in your browser, the video never leaves the laptop". Pair with a file that hits a wall (shield).',
    usedIn: ['ce-08-zero-ka-bill'], source: 'style1-props laptop',
  },
  lockphone: {
    id: 'lockphone', group: 'device', render: { draw: 'lockphone' }, size: { w: 390, hRatio: 2.03, wRange: [370, 400] },
    layout: ex({ wallpaper: 'deep violet', time: 'big', date: 'under time', moon: true }),
    look: ex({}), params: params({ time: '2:00', date: 'Tuesday, 13 October', notif: '', notifAt: [0, 'frames'], sleepAt: [0, 'frames'] }),
    enter: 'glide-in', exit: 'glide-out', idle: 'idle-float', sfx: cardIn,
    use: 'Story beats told through a lock screen: the time passes (2:00 -> 2:07 -> 11:00), a notification lands, the phone dims to sleep.',
    usedIn: ['ce-09-raat-ke-2-baje'], source: 'style1-props lockphone',
  },
  mediaCard: {
    id: 'mediaCard', group: 'media', render: { image: 'card' }, size: { w: 600, hRatio: 0.375, wRange: [340, 860] },
    layout: ex({ radius: 28, lookClip: [640, 240], loop: [0.35, 1.8], vt: 0.4, shadow: [0.9, 1.25] }),
    look: ex({ base: '#FFFFFF behind contain media', radius: 28 }), params: params({ src: '', fit: 'cover', radius: [28, 'px'], rot: [0, 'deg'], loopFrom: 0.35, loopTo: 1.8 }),
    enter: 'glide-in', exit: 'glide-out', idle: 'idle-float', sfx: cardIn,
    use: 'Any clip or still on a white card with a soft shadow. Caption-look previews are 640x240 clips that are blank at both ends: loop [0.35, 1.8] and play from 0.4-0.7 s.',
    usedIn: ['ce-01-viral-captions', 'ce-02-open-source', 'ce-04-im-your-caption', 'ce-05-ullu-ban-gaye', 'ce-11-hormozi-style', 'nb-01'], source: 's1kit.card/look',
  },
  iconCard: {
    id: 'iconCard', group: 'brand', render: { image: 'card' }, size: { w: 190, h: 190 },
    layout: ex({ icon: 190, ring: 170, logoGrid: 250 }), look: ex({ radius: 40, fit: 'contain', logoRadius: 36 }),
    params: params({ src: '', rot: [0, 'deg'], float: [6, 'px'] }), enter: 'pop-in', exit: 'glide-out', idle: 'idle-float', sfx: [pop],
    use: 'An app / tool / platform icon on a rounded white card. Logos read best on a cream pill card with a soft shadow, never on a busy burst.',
    usedIn: ['eg-01'], source: 's1kit.icon/logo_grid',
  },
  mark: {
    id: 'mark', group: 'brand', render: { image: 'media' }, size: { w: 340, h: 340, wRange: [150, 720] },
    layout: ex({ landingCentre: [540, 840], wordmarkTop: 1120, titleTop: 520 }), look: ex({ shadow: [0, 18, 30, 0.18] }),
    params: params({ src: '', spin: [10, 'deg'] }), enter: 'pop-in', exit: 'glide-out', idle: 'idle-spin', sfx: [pop],
    use: 'The brand mark / logo: pops over a burst on the landing word; the one riser of the film ends here.',
    usedIn: ['eg-01', 'ce-06-haiku-v2', 'ce-09-raat-ke-2-baje', 'ce-11-hormozi-style', 'nb-01'], source: 's1kit.mark/logo_land',
  },
  badge: {
    id: 'badge', group: 'brand', render: { draw: 'badge' }, size: { w: 270, h: 270, wRange: [200, 340] }, layout: ex({ logoScale: 1 }), look: ex({}),
    params: params({ color: '#FFFFFF', logo: '', logoScale: [1, 'x'] }), enter: 'pop-in', exit: 'glide-out', sfx: [pop],
    use: 'A filled circle holding a logo. Needs a logo asset: without one it reads as a placeholder dot.', usedIn: [], source: 'style1-timeline drawn("badge")',
  },
  burst: {
    id: 'burst', group: 'draw', render: { draw: 'asterisk' }, size: { w: 640, h: 640, wRange: [600, 1200] },
    layout: ex({ core: 0.14, rays: 12, centre: [540, GRID.hero.cy] }), look: ex({ color: P.burst }),
    params: params({ d: [640, 'px'], spin: [22, 'deg'], color: P.burst }), enter: 'burst-behind', exit: 'none', idle: 'idle-spin', sfx: [],
    use: 'The style\'s asterisk behind a hero. Decor, not layout: QA ignores it. Brand burst colour.',
    usedIn: ['ce-01-viral-captions', 'ce-05-ullu-ban-gaye', 'ce-06-haiku-v2', 'ce-08-zero-ka-bill', 'ce-11-hormozi-style', 'eg-01', 'nb-01'], source: 's1kit.burst',
  },

  // ── messaging ───────────────────────────────────────────────────────────────────────────────────────────────
  notification: {
    id: 'notification', group: 'message', render: { draw: 'notif' }, size: { w: 860, h: 170, wRange: [860, 900] },
    layout: ex({ iconSquircle: true, lines: 'APP NAME + now, title, one body line' }), look: ex({ glass: true }),
    params: params({ app: 'App', title: 'Your reel is ready', body: '', icon: P.lavender, iconSrc: '' }),
    enter: 'glide-in', exit: 'swipe-out', sfx: [{ id: 'notify', event: 'notify' }],
    use: 'A glass notification card. Real-UI urgency (swiped away) beats a clock. Top layer.', usedIn: ['ce-06-haiku', 'ce-09-raat-ke-2-baje'], source: 'style1-timeline notif()',
  },
  chat: {
    id: 'chat', group: 'message', render: { draw: 'chat' }, size: { w: 860, h: 900 },
    layout: ex({ radius: 36, header: 'avatar + name + Active now', bubbleMax: 0.62, reelBubbleMax: 0.5 }),
    look: ex({ out: P.violet, in: P.bubbleIn, seen: P.ok }),
    params: params({ name: 'Dost', msgs: '[[frame, "in"|"out", text | {reel}]]', seenAt: [0, 'frames'] }),
    enter: 'glide-in', exit: 'glide-out', sfx: [{ id: 'bubble', event: 'bubble' }],
    use: 'A DM thread: a friend asks, THIS reel is the reply ("Sent ✓"). The soft CTA for value-first films.', usedIn: ['ce-11-hormozi-style'], source: 'style1-props chat',
  },
  voiceNote: {
    id: 'voiceNote', group: 'message', render: { draw: 'voice' }, size: { w: 620, h: 120 }, layout: ex({ bars: 26 }), look: ex({ fill: P.violet }),
    params: params({ playAt: [0, 'frames'], dur: [30, 'frames'], len: '0:07', transcript: '' }), enter: 'glide-in', exit: 'glide-out', sfx: [{ id: 'bubble', event: 'bubble' }],
    use: 'A voice-note bubble whose waveform fills as it plays, with a transcript chip. Relatable story beats.', usedIn: ['ce-12-kia-scene-hai'], source: 'style1-props voice',
  },
  commentComposer: {
    id: 'commentComposer', group: 'input', render: { kind: 'comment' }, size: { w: 900, h: 140 }, layout: ex({ x: 90, y: 760, avatar: 0.62, send: 0.7, hint: 'Add a comment…' }),
    look: ex({ fill: '#FFFFFF', caret: P.violet, sendFilled: P.green, sendIdle: '#D8D6CA' }), params: params({ text: 'captions', perChar: [1.6, 'frames'], blinkFrames: [8, 'frames'] }),
    enter: null, exit: 'none', sfx: [{ id: 'mouse', event: 'click-ui', offset: -2 }, { id: 'notify', event: 'notify', offset: 8 }, { id: 'drop-splash', event: 'cta', offset: 14 }],
    use: 'The comment-keyword CTA: types the keyword, a cursor clicks send (button squashes), a DM bubble confirms.', usedIn: ['ce-05-ullu-ban-gaye', 'ce-06-haiku', 'ce-08-zero-ka-bill', 'ce-06-sab-chhod-ke'], source: 'style1-timeline drawComment, s1kit.cta_comment',
  },
  replySticker: {
    id: 'replySticker', group: 'message', render: { draw: 'sticker' }, size: { w: 760, h: 300 }, layout: ex({ radius: 0.16, avatar: 0.13 }),
    look: ex({ fill: '#FFFFFF', hint: P.mutedText }), params: params({ handle: '@someone', text: '', typeAt: [0, 'frames'], perChar: [1, 'frames'] }),
    enter: 'glide-in', exit: 'glide-out', sfx: [{ id: 'bubble', event: 'bubble' }],
    use: '"Reply to @handle\'s comment" sticker with the comment typing in: reply-to-comment videos.', usedIn: ['ce-07-reply-comment'], source: 'style1-props sticker',
  },
  commentFeed: {
    id: 'commentFeed', group: 'message', render: { kind: 'feed' }, size: { w: 760, h: 730 }, layout: ex({ rowH: 'auto', newestAtBottom: true }),
    look: ex({ avatars: P.avatars }), params: params({ text: 'captions', rows: '[frame, …]', title: '' }),
    enter: 'glide-in', exit: 'glide-out', sfx: [{ id: 'pop-4', event: 'pop' }],
    use: 'A live comment sheet: rows arrive on frames, newer rows push older up. Social proof ("everyone is commenting").', usedIn: ['ce-05-ullu-ban-gaye'], source: 'style1-timeline drawFeed',
  },
  crowd: {
    id: 'crowd', group: 'collection', render: { draw: 'crowd' }, size: { w: 860, h: 420 }, layout: ex({ cols: 8, rows: 4 }), look: ex({ confused: 'right half greys out with ? bubbles' }),
    params: params({ cols: 8, rows: 4, confuseAt: [0, 'frames'] }), enter: 'glide-in', exit: 'glide-out', sfx: [{ id: 'pop-4', event: 'cascade' }],
    use: 'Follower avatars; at the turn the right half greys out with "?" (the audience that did not understand).', usedIn: ['ce-12-kia-scene-hai'], source: 'style1-props crowd',
  },

  // ── inputs & actions ───────────────────────────────────────────────────────────────────────────────────────
  typebox: {
    id: 'typebox', group: 'input', render: { kind: 'typebox' }, size: { w: 600, h: 130, wRange: [240, 700] },
    layout: ex({ radius: 'h / 2', cta: { x: 240, y: 830, w: 600, h: 130 }, bubble: { x: 300, y: 1010, w: 680, h: 124 }, chipSmall: { w: 240, h: 88 } }),
    look: ex({ fill: BRANDS.captionseasy.accentDeep, color: BRANDS.captionseasy.stage, shadow: true }),
    params: params({ text: 'Free', perChar: [1.0, 'frames', '0.7-1.6'], cursor: [0, 'frames'], start: [0, 'frames'] }),
    enter: null, exit: 'none', sfx: [{ id: 'fast-typing', event: 'code' }],
    use: 'A pill / bubble that types its text: CTA ("Book your free consultation"), a chip ("Open source", "Free", "0 watermarks", "No watermark."), a sent-confirmation ("Sent! Check your DMs").',
    usedIn: ['ce-02-open-source', 'ce-08-zero-ka-bill', 'ce-11-hormozi-style', 'eg-01', 'nb-01'], source: 'style1-timeline drawTypeBox, s1kit.cta_pill',
  },
  ctaPill: {
    id: 'ctaPill', group: 'input', render: { kind: 'typebox' }, size: { w: 600, h: 130 }, layout: ex({ x: 240, y: 830, r: 65, cursorEnd: [640, 910], cursorStart: [820, 1220] }),
    look: ex({ fill: BRANDS.captionseasy.accent, color: '#FFFFFF' }), params: params({ text: 'Book now', perChar: [1.2, 'frames'] }),
    enter: null, exit: 'none', sfx: [{ id: 'fast-typing', event: 'code', offset: -1 }, { id: 'mouse', event: 'click-ui', offset: 20 }, { id: 'drop-splash', event: 'cta', offset: 24 }],
    use: 'The brand-coloured call-to-action pill that types, then a cursor clicks it. Brand without a keyword: eegnite.com, "Book your free consultation".', usedIn: ['eg-01', 'nb-01', 'ce-06-sab-chhod-ke'], source: 's1kit.cta_pill',
  },
  cursor: {
    id: 'cursor', group: 'input', render: { kind: 'cursor' }, size: { w: 110, h: 110 }, layout: ex({ shape: '7-point arrow', outline: 5 }),
    look: ex({ fill: '#111111', stroke: '#FFFFFF', ripple: P.cursorRipple, shadow: 'rgba(20,15,40,0.35)' }),
    params: params({ size: [110, 'px'], keys: '[[frame, x, y, 1 = click], …]' }), enter: null, exit: 'none', sfx: [{ id: 'mouse', event: 'click-ui' }],
    use: 'A big cursor that travels the flow and clicks (press 82 %, 16-frame ripple). Constant on-screen size whatever the camera does.', usedIn: ['ce-02-open-source', 'ce-05-ullu-ban-gaye', 'ce-08-zero-ka-bill', 'ce-09-raat-ke-2-baje', 'eg-01'], source: 'style1-timeline drawCursor',
  },
  searchBar: {
    id: 'searchBar', group: 'input', render: { kind: 'search' }, size: { w: 900, h: 150 }, layout: ex({ x: 90, y: 880 }), look: ex({}),
    params: params({ text: 'CaptionsEasy', perChar: [1, 'frames'], morph: 'grows into the site window' }), enter: null, exit: 'none', sfx: [{ id: 'fast-typing', event: 'code' }],
    use: 'A search bar types the brand and grows into the real site (morph). The "go to" beat.', usedIn: ['ce-02-open-source'], source: 'style1-timeline drawSearch',
  },
  pillButton: {
    id: 'pillButton', group: 'input', render: { draw: 'pill' }, size: { w: 220, h: 80 }, layout: ex({ radius: 'h / 2' }), look: ex({ fill: P.glassPill, color: '#FFFFFF' }),
    params: params({ text: 'Skip  ›', fill: P.glassPill, color: '#FFFFFF' }), enter: 'glide-in', exit: 'kill', sfx: [{ id: 'pop', event: 'pop' }],
    use: 'A UI pill button (Skip ›, Follow). Shatters when it is the thing viewers are about to hit.', usedIn: ['ce-11-hormozi-style', 'ce-12-kia-scene-hai'], source: 'style1-props pill',
  },
  progressPill: {
    id: 'progressPill', group: 'input', render: { kind: 'progress' }, size: { w: 560, h: 118 }, layout: ex({ x: 260, y: 230, radius: 'h / 2' }),
    look: ex({ fill: P.lavenderSoft, done: P.green, text: P.ink, doneText: P.cream }), params: params({ label: 'Exporting', done: 'Exported' }),
    enter: null, exit: 'none', sfx: [{ id: 'mouse', event: 'click-ui', offset: -3 }, { id: 'notify', event: 'notify' }],
    use: 'An honest export pill (never a fake download modal): fills with a %, turns deep green "Exported". Proof of "no watermark".', usedIn: ['ce-06-sab-chhod-ke', 'ce-07-reply-comment'], source: 'style1-timeline drawProgress, s1kit.export_proof',
  },
  highlighter: {
    id: 'highlighter', group: 'draw', render: { kind: 'mark' }, size: { w: 520, h: 92 }, layout: ex({ frames: 9 }), look: ex({ color: P.highlighter, radius: 0.18 }),
    params: params({ frames: [9, 'frames'], color: P.highlighter }), enter: null, exit: 'none', sfx: [{ id: 'chime', event: 'stat' }],
    use: 'A lavender highlighter sweeps a detail (repo name, headword, a corner that is empty of watermark).', usedIn: ['ce-02-open-source', 'ce-06-sab-chhod-ke', 'ce-07-reply-comment', 'ce-11-hormozi-style'], source: 'style1-timeline drawMark, s1kit.mark_hl',
  },
  marker: {
    id: 'marker', group: 'draw', render: { draw: 'marker' }, size: { w: 420, h: 160 }, layout: ex({ points: 48, labelPill: 'bricolage 800 34 px' }), look: ex({ color: P.red, width: 10 }),
    params: params({ frames: [10, 'frames'], color: P.red, width: [10, 'px'], rot: [-0.06, 'deg'], label: '', lx: 0, ly: 0 }), enter: null, exit: 'none', sfx: [{ id: 'drop', event: 'accent' }],
    use: 'A hand-drawn marker loop around the thing to notice, with an optional label pill.', usedIn: ['ce-10-teen-galtiyaan', 'ce-12-kia-scene-hai'], source: 'style1-props marker',
  },
  selectionRing: {
    id: 'selectionRing', group: 'draw', render: { draw: 'ring' }, size: { w: 650, h: 380 }, layout: ex({ r: 34 }), look: ex({ stroke: P.lavender, glow: true }),
    params: params({ r: [34, 'px'] }), enter: 'pop-in', exit: 'none', sfx: [{ id: 'chime', event: 'stat' }],
    use: 'A glowing ring pops onto the picked card / option.', usedIn: ['ce-09-raat-ke-2-baje'], source: 'style1-props ring',
  },
  focusBrackets: {
    id: 'focusBrackets', group: 'draw', render: { draw: 'brackets' }, size: { w: 330, h: 170 }, layout: ex({ startScale: 1.6, lock: 12 }), look: ex({ locked: '#22C55E', idle: P.cream }),
    params: params({ lockAt: [12, 'frames'] }), enter: null, exit: 'none', sfx: [{ id: 'chime', event: 'stat' }],
    use: 'Camera focus brackets snap onto a caption and say LOCKED: "the eye stays here".', usedIn: ['ce-11-hormozi-style'], source: 'style1-props brackets',
  },
  loupe: {
    id: 'loupe', group: 'draw', render: { draw: 'loupe' }, size: { w: 420, h: 852 }, layout: ex({ r: 150, zoom: 2.0 }), look: ex({}),
    params: params({ path: '[[frame, x, y], …]', r: [150, 'px'], zoom: [2.0, 'x'], screen: '[x, y, w, h]', src: '', vt: [0, 's'] }), enter: null, exit: 'none', sfx: [{ id: 'drop', event: 'accent' }],
    use: 'A magnifier glides over a phone screen and redraws the video x2 under the lens: "look closely" / "zero watermark in the corner".', usedIn: ['ce-08-zero-ka-bill'], source: 'style1-props loupe',
  },

  // ── proof & objects ────────────────────────────────────────────────────────────────────────────────────────
  checklistRow: {
    id: 'checklistRow', group: 'proof', render: { draw: 'row' }, size: { w: 760, h: 110, wRange: [640, 760] },
    layout: ex({ radius: 0.3, box: 0.46 }), look: ex({ fill: P.rowFill, rejected: P.rowFillRejected, tick: P.green, cross: P.red }),
    params: params({ label: 'Free trial' }), enter: 'glide-in', exit: 'kill', sfx: [{ id: 'ui-blip', event: 'list-item' }, { id: 'soft-hit', event: 'thud' }],
    use: 'A checklist row: ticked, turns to a red cross just before it SHATTERS on its word. For "no X, no Y, no Z".', usedIn: ['ce-06-haiku', 'ce-06-haiku-v2', 'ce-07-reply-comment', 'ce-10-teen-galtiyaan'], source: 'style1-props row',
  },
  panel: {
    id: 'panel', group: 'proof', render: { draw: 'panel' }, size: { w: 860, h: 700, wRange: [500, 900] }, layout: ex({ radius: 34, header: 112 }), look: ex({ fill: P.glass, ring: P.lavenderRing }),
    params: params({ title: 'Requirements' }), enter: 'glide-in', exit: 'glide-out', sfx: cardIn,
    use: 'A white glass card with a header and three dots: a container for rows, requirements, a plan.', usedIn: ['ce-06-haiku-v2', 'ce-07-reply-comment', 'ce-10-teen-galtiyaan'], source: 'style1-props panel',
  },
  stickyNote: {
    id: 'stickyNote', group: 'proof', render: { draw: 'note' }, size: { w: 400, h: 420, wRange: [400, 640] }, layout: ex({ rowH: 74, base: 220 }), look: ex({ paper: 'apricot', tape: true }),
    params: params({ title: 'To-do', items: '[[label, done], …]', pulseAt: [0, 'frames'] }), enter: 'glide-in', exit: 'glide-out', idle: 'idle-float', sfx: cardIn,
    use: 'A to-do on tape: ticked items and one unticked that pulses on its word ("Captions").', usedIn: ['ce-09-raat-ke-2-baje'], source: 'style1-props note',
  },
  receipt: {
    id: 'receipt', group: 'proof', render: { draw: 'receipt' }, size: { w: 620, h: 900, wRange: [520, 770] }, layout: ex({ scale: 1.2, totalY: 480, footY: 570 }),
    look: ex({ paper: 'thermal, zigzag tear' }), params: params({ print: '[[frame, length px], …]', title: 'RECEIPT', sub: 'ORDER #0001', dashes: '[y…]', total: '₹0', landAt: [0, 'frames'], foot: '' }),
    enter: null, exit: 'none', sfx: [{ id: 'ui-blip', event: 'list-item' }, { id: 'fast-typing', event: 'code' }],
    use: 'Thermal paper unrolls the cost line by line; the TOTAL odometer lands on 0; PAID stamps. "The bill".', usedIn: ['ce-08-zero-ka-bill'], source: 'style1-props receipt',
  },
  receiptLine: {
    id: 'receiptLine', group: 'proof', render: { draw: 'rline' }, size: { w: 560, h: 50 }, layout: ex({}), look: ex({}), params: params({ left: 'Subscription', right: '₹ ••••' }),
    enter: null, exit: 'kill', sfx: [{ id: 'soft-hit', event: 'thud' }], use: 'One receipt line that shatters when voided.', usedIn: ['ce-08-zero-ka-bill'], source: 'style1-props rline',
  },
  stamp: {
    id: 'stamp', group: 'proof', render: { draw: 'stamp' }, size: { w: 360, h: 140, wRange: [360, 480] }, layout: ex({ rotDeg: [-10, -14], double: true }), look: ex({ ink: 'distressed', color: P.red }),
    params: params({ text: 'PAID', color: P.red }), enter: 'slam-in', exit: 'none', sfx: [{ id: 'soft-hit', event: 'hard-hit' }],
    use: 'A rubber stamp: PAID, NO. Red only for rejection stamps.', usedIn: ['ce-06-haiku-v2', 'ce-07-reply-comment', 'ce-08-zero-ka-bill'], source: 'style1-props stamp',
  },
  seal: {
    id: 'seal', group: 'proof', render: { draw: 'seal' }, size: { w: 440, h: 440, wRange: [400, 480] }, layout: ex({ teeth: 28, shine: [8, 26] }), look: ex({ gold: P.gold, ring: 'cream' }),
    params: params({ top: '100%', bottom: 'FREE' }), enter: 'slam-in', exit: 'glide-out', sfx: [{ id: 'punch', event: 'hard-hit' }, { id: 'chime', event: 'stat', offset: 4 }],
    use: 'A gold rosette stamped in with one shine sweep: THE proof moment ("100% FREE", "ONE FREE").', usedIn: ['ce-06-haiku-v2', 'ce-07-reply-comment'], source: 'style1-props seal',
  },
  coin: {
    id: 'coin', group: 'proof', render: { draw: 'coin' }, size: { w: 340, h: 340, wRange: [300, 380] }, layout: ex({ flips: 6 }), look: ex({ gold: P.gold }),
    params: params({ face: '₹0', landAt: [0, 'frames'], flips: 6 }), enter: 'glide-in', exit: 'glide-out', sfx: [{ id: 'chime', event: 'stat' }],
    use: 'A 3D gold coin flips and lands face-up on the price: "free".', usedIn: ['ce-06-haiku-v2', 'ce-08-zero-ka-bill'], source: 'style1-props coin',
  },
  priceTag: {
    id: 'priceTag', group: 'proof', render: { draw: 'tag' }, size: { w: 360, h: 150, wRange: [360, 520] }, layout: ex({ label: 'bold', sub: 'small' }), look: ex({}),
    params: params({ label: 'Free trial', sub: 'limited' }), enter: 'pop-in', exit: 'kill', sfx: [pop],
    use: 'A price / plan tag. Rejected ones shatter on their words (Na trial. Na per-minute charge.).', usedIn: ['ce-05-ullu-ban-gaye'], source: 'style1-timeline drawn("tag")',
  },
  trialCard: {
    id: 'trialCard', group: 'proof', render: { draw: 'trial' }, size: { w: 620, h: 260 }, layout: ex({ countdown: true, lock: true }), look: ex({}), params: params({}),
    enter: 'pop-in', exit: 'kill', sfx: [pop], use: 'A free-trial card counting down to zero then "Trial ended" with a lock. The competitor\'s trap.', usedIn: ['ce-05-ullu-ban-gaye'], source: 'style1-timeline drawn("trial")',
  },
  reachChart: {
    id: 'reachChart', group: 'data', render: { draw: 'reach' }, size: { w: 860, h: 560 }, layout: ex({}), look: ex({ end: P.red }),
    params: params({ title: 'Reach', sub: '', dropAt: [0, 'frames'] }), enter: 'glide-in', exit: 'glide-out', sfx: [{ id: 'soft-hit', event: 'thud' }],
    use: 'An analytics card: line rising, then the last leg plunges, red end dot pulses. The "your reach dies" beat.', usedIn: ['ce-10-teen-galtiyaan'], source: 'style1-props reach',
  },
  dictionaryCard: {
    id: 'dictionaryCard', group: 'data', render: { draw: 'dict' }, size: { w: 880, h: 520 }, layout: ex({}), look: ex({}),
    params: params({ word: 'Hormozi style', pron: '/hor·mo·zi stail/', pos: 'noun', def: '', typeAt: [0, 'frames'], perChar: [0.75, 'frames'] }), enter: 'glide-in', exit: 'glide-out', sfx: [{ id: 'fast-typing', event: 'code' }],
    use: 'A dictionary entry names a thing ("what is this style called?"): headword, pronunciation, part of speech, definition typing in.', usedIn: ['ce-11-hormozi-style'], source: 'style1-props dict',
  },
  voiceTrack: {
    id: 'voiceTrack', group: 'data', render: { draw: 'wave' }, size: { w: 860, h: 360, wRange: [860, 900] }, layout: ex({}), look: ex({ hero: 'word in a green box' }),
    params: params({ words: '[[frame, text, hero?], …]' }), enter: 'glide-in', exit: 'glide-out', sfx: [{ id: 'pop', event: 'pop' }],
    use: 'A voice track: waveform scrolls past a playhead; the word being said sits above it, important words in the green box. Shows the "one word at a time" rule live.', usedIn: ['ce-11-hormozi-style'], source: 'style1-props wave',
  },
  editorTimeline: {
    id: 'editorTimeline', group: 'data', render: { draw: 'nle' }, size: { w: 960, h: 560 }, layout: ex({}), look: ex({ dark: true }),
    params: params({ tracks: 'Text, Glow, Video', keys: '[[frame, track, x 0..1], …]', tc: '[from, to]', collapseAt: [0, 'frames'] }), enter: 'glide-in', exit: 'glide-out', sfx: [{ id: 'fast-typing', event: 'code' }],
    use: 'A dark editing timeline: keyframes flood tracks, the timecode races to hours, then everything collapses into the product icon. "The grind".', usedIn: ['ce-09-raat-ke-2-baje'], source: 'style1-props nle',
  },
  num3d: {
    id: 'num3d', group: 'data', render: { draw: 'num' }, size: { w: 300, h: 360 }, layout: ex({ fontSize: 0.92, extrusion: 10 }), look: ex({ face: P.ink, extrusion: P.violet }),
    params: params({ text: '30', rot: [-6, 'deg'] }), enter: 'glide-in', exit: 'glide-out', sfx: [{ id: 'punch', event: 'hard-hit' }],
    use: 'A chunky 3D numeral that thuds onto the desk with a contact shadow: the stat as a physical thing.', usedIn: ['ce-06-haiku-v2', 'ce-10-teen-galtiyaan', 'ce-12-kia-scene-hai'], source: 'style1-props num',
  },
  flipBoard: {
    id: 'flipBoard', group: 'data', render: { draw: 'flip' }, size: { w: 750, h: 225, wRange: [300, 1500] }, layout: ex({ tileMax: 150, h: 'tile * 1.5' }), look: ex({}),
    params: params({ text: 'FREE', settle: '[frame per tile]' }), enter: 'glide-in', exit: 'glide-out', sfx: [{ id: 'pop-9', event: 'cascade' }],
    use: 'A split-flap board whose tiles cycle and land on a word: urgency/“available” without a clock.', usedIn: [], source: 'style1-timeline drawn("flip"); in Moovi preset flip',
  },
  watchCountdown: {
    id: 'watchCountdown', group: 'data', render: { draw: 'watch' }, size: { w: 380, h: 380 }, layout: ex({}), look: ex({ arc: 'green -> urgent orange' }),
    params: params({ end: [0, 'frames'] }), enter: 'glide-in', exit: 'glide-out', sfx: [{ id: 'chime', event: 'stat' }],
    use: 'A low-key 3D stopwatch with a draining arc. Flat clocks were REJECTED by the owner; use only this 3D one, or real-UI urgency instead.', usedIn: ['ce-05-ullu-ban-gaye'], source: 'style1-timeline drawn("watch"), SKILL ce-06 v3',
  },
  owl: {
    id: 'owl', group: 'brand', render: { draw: 'owl' }, size: { w: 420, h: 420, wRange: [300, 520] }, layout: ex({ float: [8, 2.8, 0.3] }), look: ex({ shadow: [0, 26, 46, 0.22] }),
    params: params({ shades: [0, 'frames'], dizzy: '[from, to]' }), enter: 'slam-in', exit: 'glide-out', idle: 'idle-float', sfx: [{ id: 'punch', event: 'hard-hit' }],
    use: 'A drawn mascot (blinks, dizzy pupils, sunglasses drop). One film\'s gag, not a template (owner: never carry mascots to the next video).', usedIn: ['ce-05-ullu-ban-gaye'], source: 'style1-timeline drawn("owl")',
  },
  file: {
    id: 'file', group: 'draw', render: { draw: 'file' }, size: { w: 260, h: 320, wRange: [120, 260] }, layout: ex({ fold: 0.28 }), look: ex({ extrusion: P.violet }), params: params({ label: '.mp4' }),
    enter: 'pop-in', exit: 'none', sfx: [pop], use: 'A video file icon that can travel a path (to a wall, into a drop zone).', usedIn: ['ce-08-zero-ka-bill'], source: 'style1-props file',
  },
  dropzone: {
    id: 'dropzone', group: 'draw', render: { draw: 'dropzone' }, size: { w: 760, h: 420 }, layout: ex({ dash: [18, 14] }), look: ex({ done: P.green }), params: params({ label: 'Drop your video', done: 'Uploaded', doneAt: [0, 'frames'] }),
    enter: 'glide-in', exit: 'glide-out', sfx: [{ id: 'notify', event: 'notify' }], use: 'A dashed drop target that turns solid green with a tick when the file lands.', usedIn: ['ce-07-reply-comment'], source: 'style1-props dropzone',
  },
  swatch: {
    id: 'swatch', group: 'media', render: { draw: 'swatch' }, size: { w: 380, h: 142, wRange: [300, 720] }, layout: ex({ radius: 0.16 }), look: ex({ tile: P.tile }),
    params: params({ src: '', name: 'Soft Glow', selAt: [0, 'frames'] }), enter: 'glide-in', exit: 'glide-out', sfx: [{ id: 'pop', event: 'cascade' }],
    use: 'A caption look on a dark tile with its real name; a lavender ring + lift when picked. A picked one, four more around it.', usedIn: ['ce-07-reply-comment', 'ce-11-hormozi-style'], source: 'style1-props swatch',
  },
  shield: {
    id: 'shield', group: 'draw', render: { draw: 'shield' }, size: { w: 200, h: 200, wRange: [200, 300] }, layout: ex({}), look: ex({ lock: P.green }), params: params({}),
    enter: null, exit: 'none', sfx: [{ id: 'notify', event: 'notify' }], use: 'A ripple from a wall, then a green lock badge: "blocked / private / stays on your device".', usedIn: ['ce-08-zero-ka-bill'], source: 'style1-props shield',
  },
  bookmark: {
    id: 'bookmark', group: 'draw', render: { draw: 'bookmark' }, size: { w: 260, h: 260 }, layout: ex({}), look: ex({}), params: params({ saveAt: [0, 'frames'] }),
    enter: 'pop-in', exit: 'glide-out', sfx: [{ id: 'chime', event: 'stat' }], use: 'The Save button: a glossy tile whose bookmark fills with a spark ring and a "Saved" pill. Save-CTA for value-first films.', usedIn: ['ce-10-teen-galtiyaan'], source: 'style1-props bookmark',
  },
  paperPlane: {
    id: 'paperPlane', group: 'draw', render: { draw: 'plane' }, size: { w: 160, h: 160 }, layout: ex({}), look: ex({}), params: params({}), enter: null, exit: 'none', sfx: [{ id: 'woosh-short', event: 'card-in' }],
    use: 'A folded paper plane on a path: the send moment (DM, share).', usedIn: [], source: 'style1-timeline drawn("plane")',
  },
  zzz: {
    id: 'zzz', group: 'draw', render: { draw: 'zzz' }, size: { w: 160, h: 220 }, layout: ex({}), look: ex({}), params: params({ color: '#8E7BB0' }), enter: null, exit: 'none', sfx: [],
    use: 'Three Z\'s drift up: sleep.', usedIn: ['ce-09-raat-ke-2-baje'], source: 'style1-props zzz',
  },

  // ── phone-screen overlays ──────────────────────────────────────────────────────────────────────────────────
  reelUi: {
    id: 'reelUi', group: 'media', render: { draw: 'reelui' }, size: { w: 300, hRatio: 2.03 }, layout: ex({ parts: 'bottom scrim, right rail, @handle + Follow, caption, audio row' }), look: ex({ generic: true }),
    params: params({ handle: '@creator', caption: '', caption2: '', inAt: [0, 'frames'], userAt: [0, 'frames'], textAt: [0, 'frames'] }), enter: null, exit: 'none', sfx: [],
    use: 'A generic reels overlay (never a real app\'s UI) drawn over a phone screen so the phone reads as a reel.', usedIn: ['ce-06-haiku', 'ce-10-teen-galtiyaan'], source: 'style1-props reelui',
  },
  phoneCaption: {
    id: 'phoneCaption', group: 'media', render: { draw: 'capt' }, size: { w: 300, hRatio: 2.03 }, layout: ex({ styles: ['plain', 'stroke', 'box', 'hormozi'] }), look: ex({ font: 'bricolage 800 outlined' }),
    params: params({ style: 'stroke', chunks: '[[frame, text, hero?], …]', ys: '[[frame, yFrac], …]', heroWord: '', fade: [0, 'frames'], fix: '', squig: false, tick: false }),
    enter: null, exit: 'none', sfx: [{ id: 'typing', event: 'word' }],
    use: 'A caption drawn ON a phone: plain / stroke / box / hormozi. Chunks swap on frames; `fix` retypes a word, `squig` draws a red spell-check line, `tick` a tick. ONE look per film.', usedIn: ['ce-10-teen-galtiyaan', 'ce-12-kia-scene-hai'], source: 'style1-props capt',
  },

  // ── collections ────────────────────────────────────────────────────────────────────────────────────────────
  logoGrid: {
    id: 'logoGrid', group: 'collection', render: { image: 'card' }, size: { w: 250, h: 250 }, layout: ex({ ...GRID.logoGrid }), look: ex({ radius: 36, fit: 'contain' }),
    params: params({ cols: 3, rotCycle: '[-4, 3, -2, 4, -3, 2]', stagger: [2, 'frames'] }), enter: 'cascade-pops', exit: 'glide-out', idle: 'idle-float', sfx: [{ id: 'pop-9', event: 'cascade' }],
    use: 'Logos / clients / tools as 250 px cards in a 3-column grid, each rotated a few degrees and floating; cascade one pop every 2 frames.', usedIn: ['eg-01'], source: 's1kit.logo_grid',
  },
  iconRing: {
    id: 'iconRing', group: 'collection', render: { image: 'card' }, size: { w: 170, h: 170 }, layout: ex({ ...GRID.iconRing }), look: ex({ radius: 40 }),
    params: params({ n: 6, centreMark: true, centreSpin: [10, 'deg'] }), enter: 'pop-in', exit: 'glide-out', idle: 'idle-float', sfx: [pop],
    use: 'Icons arranged on a ring (rx 280, ry 270) around the centre mark, one per spoken tool. "Works with everything you use."', usedIn: ['eg-01'], source: 's1kit.icon_ring',
  },
  deck: {
    id: 'deck', group: 'collection', render: { kind: 'deck' }, size: { w: 360, hRatio: 2.03 }, layout: ex({ every: 'frames per shuffle' }), look: ex({}), params: params({ items: '[clip, …]', every: [20, 'frames'] }),
    enter: null, exit: 'none', sfx: [{ id: 'pop', event: 'cascade' }], use: 'A fanned deck of phones (same clip, a different look each) that shuffles: front reel flicks out on an arc and tucks in behind. Leaves 10 frames before the cut.', usedIn: ['ce-06-haiku-v2'], source: 'style1-timeline drawDeck',
  },
  carousel: {
    id: 'carousel', group: 'collection', render: { kind: 'carousel' }, size: { w: 560, h: 560 }, layout: ex({ cx: 540, cy: 1190, rx: 400, ry: 120, step: 0.42 }), look: ex({ glass: true }),
    params: params({ items: '[[src, name], …]', step: [0.42, 's'], speed: 1 }), enter: null, exit: 'none', sfx: [{ id: 'pop-9', event: 'cascade' }],
    use: 'A slow 3D carousel of glass cards with their real names, back cards defocused. Labels are drawn in Inter by the engine.', usedIn: ['ce-06-haiku'], source: 'style1-timeline drawCarousel',
  },
} as const satisfies Record<string, UiDef>;

export type UiId = keyof typeof UI;
export const UI_IDS = Object.keys(UI) as UiId[];
export const uiBy = (group: UiGroup) => UI_IDS.filter(id => UI[id].group === group);

// ── factories ────────────────────────────────────────────────────────────────────────────────────────────────────
/** An image layer in the renderer's keys; `at` is an anchor (word or frame) resolved by the kit. */
export interface ImageLayer {
  kind: 'image';
  draw?: string;
  cx: number; cy: number; w: number; h: number;
  at?: unknown;
  enter?: string | null;
  exit?: unknown;
  rot?: number;
  float?: readonly number[] | readonly (readonly number[])[];
  p?: Record<string, unknown>;
  [extra: string]: unknown;
}

export interface PlaceOpts {
  cx: number; cy: number; w?: number; h?: number; at?: unknown; enter?: string | null; exit?: unknown;
  rot?: number; float?: ImageLayer['float']; p?: Record<string, unknown>; [extra: string]: unknown;
}

const ENTER_KEY: Partial<Record<EffectId, string>> = { 'glide-in': 'glide', 'pop-in': 'pop', 'slam-in': 'slam', 'rise-in': 'rise', 'side-in': 'left', 'burst-behind': 'pop', 'cascade-pops': 'pop' };

/** Place any image-rendered component: `place('stamp', { cx: 560, cy: 830, at: 'dunga', p: { text: 'PAID' } })`. */
export function place(id: UiId, o: PlaceOpts): ImageLayer {
  const d = UI[id] as UiDef;
  const w = o.w ?? d.size.w;
  const h = o.h ?? d.size.h ?? w * (d.size.hRatio ?? 1);
  const { cx, cy, w: _w, h: _h, p, enter, ...rest } = o;
  const r = d.render as Record<string, string>;
  const L: ImageLayer = { kind: 'image', cx, cy, w, h, ...rest };
  if (r.draw) L.draw = r.draw;
  else if (r.image === 'browser') L.browser = (p?.url as string | undefined) ?? '';
  else if (r.image === 'card') { L.card = true; L.radius = (d.look.radius as number | undefined) ?? 28; if (d.look.fit) L.fit = d.look.fit; }
  L.enter = enter !== undefined ? enter : d.enter ? (ENTER_KEY[d.enter] ?? null) : null;
  const dp = defaults(d.params);
  const merged = { ...Object.fromEntries(Object.entries(dp).filter(([, v]) => typeof v !== 'string' || !/^\[|\{|…/.test(v))), ...(p ?? {}) };
  if (Object.keys(merged).length) L.p = merged;
  return L;
}

/** A phone showing `screen` (s1kit.phone): w 300, h = w * 2.03, focus centred, shadow [0, 30, 50, 0.28]. */
export function phone(screen: string, cx: number, cy: number, w = 300, o: Omit<PlaceOpts, 'cx' | 'cy' | 'w'> = {}): ImageLayer {
  return { kind: 'image', draw: 'phone', screen, cx, cy, w, h: w * UI.phone.size.hRatio, focus: [0.5, 0.5], shadow: [...SHADOW_DEFAULT], enter: 'glide', ...o };
}

/** The browser window box (s1kit.win): bar = max(46, w * 0.075), h = bar + w / 1.6. */
export function browserBox(x: number, y: number, w: number) {
  const bar = Math.max(46, w * 0.075);
  return { x, y, w, h: bar + w / 1.6, bar };
}
/** A point of a capture (px of the 2880-wide screenshot) in frame px inside that window (s1kit.at_px). */
export function capturePx(win: { x: number; y: number; w: number; bar: number }, X: number, Y: number, captureW: number = GRID.browser.canvasW): [number, number] {
  const k = win.w / captureW;
  return [win.x + X * k, win.y + win.bar + Y * k];
}
/** A browser layer around `src` (s1kit.browser): tilt 4 settling flat. */
export function browser(src: string, win: ReturnType<typeof browserBox>, o: Record<string, unknown> = {}): ImageLayer {
  return { kind: 'image', src, browser: '', cx: win.x + win.w / 2, cy: win.y + win.h / 2, w: win.w, h: win.h, enter: 'glide', tilt: 4, ...o };
}

/** A brand mark that pops with a soft shadow (s1kit.mark). */
export function mark(src: string, cx: number, cy: number, w = 340, o: Record<string, unknown> = {}): ImageLayer {
  return { kind: 'image', src, cx, cy, w, h: w, enter: 'pop', shadow: [0, 18, 30, 0.18], ...o };
}

/** The burst: 12 rays [deg, length ratio, width ratio] scaled to diameter d (s1kit.burst). */
export const BURST_RAYS: readonly (readonly [number, number, number])[] = [[12, .98, .2], [48, .85, .14], [81, .9, .19], [122, .88, .15], [145, .92, .16], [174, .94, .15], [190, .9, .22], [225, .95, .12], [254, .95, .16], [276, .9, .14], [309, .94, .11], [342, .94, .17]];
export function burst(cx: number, cy: number, d: number, o: { color?: string; spin?: number; at?: unknown } = {}): ImageLayer {
  return { kind: 'image', draw: 'asterisk', color: o.color ?? P.burst, rays: BURST_RAYS.map(([a, l, w]) => [a, 0.5 * d * l, 0.5 * d * w]), core: d * 0.14, cx, cy, w: d, h: d, spin: o.spin ?? 22, enter: 'pop', ...(o.at !== undefined ? { at: o.at } : {}) };
}

/** A 3-column logo grid (s1kit.logo_grid): cards 250, rotated, floating, staggered 2 frames. */
export function logoGrid(srcs: readonly string[], at?: unknown, top: number = GRID.logoGrid.top): ImageLayer[] {
  const g = GRID.logoGrid;
  return srcs.map((src, i) => ({ kind: 'image', src, card: true, fit: 'contain', radius: g.radius, enter: 'pop', cx: g.x0 + g.dx * (i % g.cols), cy: top + g.dy * Math.floor(i / g.cols), w: g.size, h: g.size, rot: g.rot[i % 6]!, float: [6, 2.8 + 0.2 * i, i], stagger: 2 * i, ...(at !== undefined ? { at } : {}) }));
}

/** Icons on a ring (s1kit.icon_ring): rx 280, ry 270 around (540, 990). */
export function iconRing(srcs: readonly string[], words: readonly string[]): ImageLayer[] {
  const g = GRID.iconRing;
  return srcs.map((src, i) => {
    const a = ((g.startDeg + (360 / srcs.length) * i) * Math.PI) / 180;
    return { kind: 'image', src, card: true, fit: 'contain', radius: g.radius, enter: 'pop', cx: g.cx + g.rx * Math.cos(a), cy: g.cy + g.ry * Math.sin(a), w: g.size, h: g.size, float: [6, 2.6 + 0.3 * i, i], at: words[Math.min(i, words.length - 1)] };
  });
}

/** A typebox pill (kind typebox): text types in from `start`, caret from `cursor` (frames or anchors). */
export function typebox(text: string, box: { x: number; y: number; w: number; h?: number; r?: number; fill?: string; color?: string }, o: { brand?: BrandName; perChar?: number; cursor?: unknown; start?: unknown } = {}) {
  const B = BRANDS[o.brand ?? 'captionseasy'], h = box.h ?? 130;
  return { kind: 'typebox', x: box.x, y: box.y, w: box.w, h, r: box.r ?? h / 2, fill: box.fill ?? B.accentDeep, color: box.color ?? B.stage, text, cursor: o.cursor ?? 0, start: o.start ?? 0, perChar: o.perChar ?? 1.0 };
}

/** A cursor path (kind cursor): keys [[frame, x, y, click?], …]. */
export const cursor = (keys: readonly (readonly [unknown, number, number, 1?])[], size = 110) => ({ kind: 'cursor', keys, size });

/** The comment composer (kind comment), with the send moment `send` frames after the typed keyword. */
export const commentComposer = (text: string, o: { x?: number; y?: number; w?: number; h?: number; start?: unknown; send?: unknown; perChar?: number } = {}) => ({ kind: 'comment', x: o.x ?? 90, y: o.y ?? 760, w: o.w ?? 900, h: o.h ?? 140, text, start: o.start ?? 0, perChar: o.perChar ?? 1.6, send: o.send ?? 0 });

/** The export pill (kind progress). */
export const progressPill = (o: { x?: number; y?: number; w?: number; h?: number; label?: string; done?: string; at?: unknown; until?: unknown } = {}) => ({ kind: 'progress', x: o.x ?? 260, y: o.y ?? 230, w: o.w ?? 560, h: o.h ?? 118, label: o.label ?? 'Exporting', done: o.done ?? 'Exported', at: o.at, until: o.until });

/** A highlighter sweep (kind mark). */
export const highlighter = (x: number, y: number, w: number, h: number, at: unknown, color: string = P.highlighter) => ({ kind: 'mark', x, y, w, h, at, frames: 9, color });

/** Glass notification (draw notif). */
export const notification = (app: string, title: string, body: string, cy = 830, o: Record<string, unknown> = {}): ImageLayer => ({ kind: 'image', draw: 'notif', cx: 540, cy, w: 860, h: 210, app, title, body, enter: 'glide', ...o });

/** A price / plan tag (draw tag). */
export const priceTag = (label: string, sub: string, cx: number, cy: number, o: Record<string, unknown> = {}): ImageLayer => ({ kind: 'image', draw: 'tag', label, sub, cx, cy, w: 520, h: 200, enter: 'pop', ...o });

/** A "no X" checklist that shatters row by row: rows at y 1140 + 110 i (ce-06 v2). */
export const rejectRows = (labels: readonly string[], o: { cx?: number; top?: number; w?: number; h?: number; pitch?: number } = {}): ImageLayer[] =>
  labels.map((label, i) => ({ kind: 'image', draw: 'row', cx: o.cx ?? 540, cy: (o.top ?? 1140) + (o.pitch ?? 130) * i, w: o.w ?? 640, h: o.h ?? 100, enter: 'glide', p: { label }, shatter: true }));

/** Type-safe lookup used by scene recipes. */
export const uiSize = (id: UiId) => UI[id].size;

/** Layout limits the kit enforces on UI: nothing in the reserved corners, text-free gap of 8 px (see tokens.RESERVED). */
export const UI_GAP = { toText: 8, toCorner: 24, maxPerScene: 4, textMaxLines: 4, lineMaxChars: TYPE.maxChars } as const;
