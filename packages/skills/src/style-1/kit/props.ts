/**
 * Every prop the renderer draws in code (MotionEasy style1-timeline.ts `drawn()` + style1-props.ts), for the Shot
 * Builder's `kit.docs`: what it is, a good size, its params (`p`, unless noted) and which of them are frames.
 * Frame params take anchors in programs ({ w: "word" } or frames after the cut). Low-key 3D throughout: extrusion,
 * bevels, glass highlights, contact shadows. Sizes are for 1080-wide vertical; scale for landscape.
 */
/** `decor`: decoration, not layout; `type`: the prop is words (a pill, a stamp, a numeral), so the QA's text rules see it as text. */
export interface PropDoc { id: string; what: string; size: string; params: string; frames: string[]; decor?: boolean; top?: boolean; type?: boolean }

export const PROPS: PropDoc[] = [
  // drawn in the timeline (params on the image itself, not in p)
  { id: 'phone', what: 'a phone (rounded frame, side buttons, island, glass glare as it lands) showing `screen` (image or video); `ui` props draw over the screen', size: 'w 260–380, h = w × 2.03', params: 'screen: asset ref; focus [x,y]; zoom; vt (video start s); ui: [{draw, p}]; wm/wmOff: a free-plan watermark over the screen', frames: ['wm', 'wmOff'], top: true },
  { id: 'notif', what: 'a glass notification card: squircle app icon (or iconSrc), APP NAME + "now", bold title, one body line', size: 'w 860–900, h 150–170', params: 'app, title, body (on the image); icon: colour; iconSrc: asset ref', frames: [], top: true },
  { id: 'flip', what: 'a split-flap board: tiles cycle letters and land on `text`', size: 'w = tile × letters, h = tile × 1.5 (tile ≤ 150)', params: 'text (≤ 10 letters, on the image); settle: frame per tile', frames: ['settle[]'], top: true, type: true },
  { id: 'asterisk', what: 'the style\'s burst: a soft many-rayed asterisk behind a hero (decor)', size: 'd 600–1200', params: 'color; rays [[deg, len, width]]; core; spin', frames: [], decor: true },
  { id: 'badge', what: 'a filled circle holding a logo', size: 'w 200–340', params: 'color; logo: asset ref; logoScale', frames: [] },
  { id: 'owl', what: 'a drawn owl mascot (blinks; pupils can spin; sunglasses drop)', size: 'w 300–420', params: 'shades: frame the sunglasses land; dizzy: [from, to] frames (on the image)', frames: ['shades', 'dizzy[]'] },
  { id: 'trial', what: 'a free-trial card counting down to zero, then "Trial ended" with a lock', size: 'w 620, h 260', params: '(none)', frames: [] },
  { id: 'tag', what: 'a price tag card', size: 'w 360, h 150', params: 'label, sub (on the image)', frames: [], type: true },
  { id: 'clock', what: 'a neon stopwatch, hand sweeping one turn a second', size: 'w 260', params: 'color', frames: [] },
  { id: 'watch', what: 'a low-key 3D stopwatch with a draining countdown arc (green → urgent orange)', size: 'w 380', params: 'end: frame the arc reaches zero (on the image)', frames: ['end'] },
  { id: 'plane', what: 'a folded paper plane (send moments; give it a path)', size: 'w 160', params: '(none)', frames: [] },
  // style1-props.ts (params in p)
  { id: 'sticker', what: 'an Instagram-style "reply to comment" sticker; the comment types in', size: 'w 760, h 300', params: 'handle, text, typeAt, perChar', frames: ['typeAt'] },
  { id: 'seal', what: 'a gold rosette stamped in: serrated edge, cream ring, two-line label, shine sweep (the proof moment)', size: 'w = h 400–480', params: 'top (≤ 8 chars), bottom (≤ 10)', frames: [] },
  { id: 'panel', what: 'a white glass card with a header', size: 'w 860, h 500–900', params: 'title', frames: [] },
  { id: 'row', what: 'a checklist row: ticked, turns to a cross when killed (then shatters with kill + shatter)', size: 'w 760, h 110', params: 'label', frames: [], type: true },
  { id: 'file', what: 'a video file icon with a folded corner and a label', size: 'w 260, h 320', params: 'label', frames: [] },
  { id: 'dropzone', what: 'a dashed drop target that turns solid green with a tick', size: 'w 760, h 420', params: 'label, done, doneAt', frames: ['doneAt'] },
  { id: 'swatch', what: 'a look on a dark tile; a ring + lift when picked', size: 'w 300, h 200', params: 'src (media in p), name, selAt', frames: ['selAt'] },
  { id: 'receipt', what: 'thermal paper unrolling from a printer slot: header, dashes, TOTAL odometer landing', size: 'w 620, h 900', params: 'print [[frame, length px]…], title, sub, dashes [y…], totalY, total, landAt, foot, footY', frames: ['print[][0]', 'landAt'] },
  { id: 'rline', what: 'one receipt line (label … price); shatters when voided', size: 'w 560, h 50', params: 'left, right', frames: [], type: true },
  { id: 'stamp', what: 'a rubber stamp with distressed ink', size: 'w 360, h 140', params: 'text, color', frames: [], type: true },
  { id: 'coin', what: 'a 3D coin flip that lands face-up', size: 'w 300', params: 'face, landAt, flips', frames: ['landAt'] },
  { id: 'loupe', what: 'a magnifier gliding over a phone screen, redrawing the video ×zoom under the lens (decor)', size: 'w = h of the phone area', params: 'path [[frame, x, y]…], r, zoom, screen [x,y,w,h], src, vt', frames: ['path[][0]'], decor: true },
  { id: 'laptop', what: 'a low-key 3D laptop with browser chrome and live media', size: 'w 900, h 620', params: 'src, vt', frames: [] },
  { id: 'shield', what: 'a ripple, then a green lock badge pops (protection, blocked) (decor)', size: 'w 300', params: '(none)', frames: [], decor: true },
  { id: 'lockphone', what: 'a phone lock screen: violet wallpaper, big time, date, moon; a notification can land; dims to sleep', size: 'w 380–400, h = w × 2.03', params: 'time, date, notif, notifAt, sleepAt', frames: ['notifAt', 'sleepAt'], top: true },
  { id: 'note', what: 'an apricot sticky note on tape: a title, ticked items, the last one unticked and pulsing', size: 'w 400–640, h 220 + 74 × items', params: 'title, items [[label, done]…], pulseAt', frames: ['pulseAt'] },
  { id: 'nle', what: 'a dark editing timeline: tracks, a running playhead, keyframes popping in, a racing timecode; collapses to a point', size: 'w 960, h 560', params: 'tracks [names], keys [[frame, track, x 0..1]…], tc [from, to] frames, collapseAt', frames: ['keys[][0]', 'tc[]', 'collapseAt'] },
  { id: 'ring', what: 'a glowing selection ring that pops onto a picked card (decor)', size: 'the card\'s box', params: 'r', frames: [], decor: true },
  { id: 'zzz', what: 'three Z\'s drifting up (sleep) (decor)', size: 'w 160, h 220', params: 'color', frames: [], decor: true },
  { id: 'reach', what: 'an analytics card: a line chart rising, then the last leg plunges; red end dot pulses', size: 'w 860, h 560', params: 'title, sub, dropAt', frames: ['dropAt'] },
  { id: 'reelui', what: 'a reels-style overlay for a phone screen: scrim, right rail, @handle + Follow, caption, audio row (use in phone ui)', size: 'the screen', params: 'handle, caption, caption2, inAt, userAt, textAt', frames: ['inAt', 'userAt', 'textAt'] },
  { id: 'capt', what: 'a caption drawn on a phone screen (plain | stroke | box | hormozi); chunks swap on frames (use in phone ui)', size: 'the screen', params: 'style, text | chunks [[frame, text, hero?]…], ys [[frame, yFrac]…], size, upper, heroWord, fade, fix, squig, tick, from, until, at', frames: ['chunks[][0]', 'ys[][0]', 'fade[]', 'fix[0]', 'squig[0]', 'tick', 'from', 'until', 'at'] },
  { id: 'sky', what: 'a bright overexposed beach/sky frame for a phone screen', size: 'the screen', params: '(none)', frames: [] },
  { id: 'num', what: 'a chunky low-key 3D numeral that slams onto the desk', size: 'w 300, h 360', params: 'text, rot', frames: [], type: true },
  { id: 'marker', what: 'a hand-drawn marker loop drawn on over frames; optional label pill (decor)', size: 'around the target', params: 'frames, color, width, rot, label, lx, ly', frames: [], decor: true },
  { id: 'dict', what: 'a dictionary entry card; the definition types in', size: 'w 880, h 520', params: 'word, pron, pos, def, typeAt, perChar', frames: ['typeAt'] },
  { id: 'wave', what: 'a voice track: waveform bars scroll past a playhead; the word being said above it', size: 'w 860, h 360', params: 'words [[frame, text, hero?]…]', frames: ['words[][0]'] },
  { id: 'brackets', what: 'camera focus brackets that snap tight onto a target, turn green, LOCKED (decor)', size: 'the target box', params: 'lockAt', frames: ['lockAt'], decor: true },
  { id: 'pill', what: 'a dark-glass UI pill button', size: 'w 220, h 80', params: 'text, fill, color', frames: [], type: true },
  { id: 'chat', what: 'a DM thread on a white card; bubbles pop up (text or a reel)', size: 'w 860, h 900', params: 'name, msgs [[frame, "in"|"out", text | {reel: src}]…], seenAt', frames: ['msgs[][0]', 'seenAt'] },
  { id: 'voice', what: 'a voice-note bubble; the waveform fills as it plays', size: 'w 620, h 120', params: 'playAt, dur, len', frames: ['playAt'] },
  { id: 'crowd', what: 'follower avatars in a grid; the right half greys out with "?" bubbles', size: 'w 860, h 420', params: 'cols, rows, confuseAt', frames: ['confuseAt'] },
  { id: 'bookmark', what: 'the Save button: a glossy tile whose bookmark fills, a spark ring, a "Saved" pill', size: 'w = h 260', params: 'saveAt', frames: ['saveAt'] },
];

export const PROP_IDS = new Set(PROPS.map(p => p.id));
/** Props whose `p` (or image) frame fields the kit converts from anchors to absolute frames. */
export const FRAME_KEYS = new Map(PROPS.map(p => [p.id, p.frames]));
/** Props the QA counts as decoration (not layout). */
export const DECOR = new Set(PROPS.filter(p => p.decor).map(p => p.id));
/** Props that are words: the platform safe zone treats them as text (a CTA pill under the app's buttons is a lost CTA). */
export const TYPE_PROPS = new Set(PROPS.filter(p => p.type).map(p => p.id));

/** Kit docs for agents: one line per prop. */
export const propDocs = () => PROPS.map(p => `- ${p.id}: ${p.what}. Size: ${p.size}. Params: ${p.params}.${p.frames.length ? ` Frames: ${p.frames.join(', ')}.` : ''}`).join('\n');

/** When a scene's first real visual arrives (any layer but its lines and decoration), or null when it has none. */
export function firstVisual(layers: { kind: string; draw?: string; f?: number }[], f0: number): number | null {
  const fs = layers.filter(l => l.kind !== 'line' && !(l.kind === 'image' && DECOR.has(l.draw ?? ''))).map(l => l.f ?? f0);
  return fs.length ? Math.min(...fs) : null;
}
