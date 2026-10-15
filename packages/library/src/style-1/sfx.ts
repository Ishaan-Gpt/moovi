// Style 1 sound effects. Source of truth: MotionEasy styles/style-1/sfx/ (map.json: alignment + level_db, README.md: provenance).
// gainDb is map.json's level_db, the target RMS in the SFX stem (before the stem's +6 dB, see mix.ts). Durations are ffprobe'd.
import type { Sfx, SfxRole } from '../types';

const s = (
  id: string, file: string, role: SfxRole, duration: number, gainDb: number, use: string, tags: string[],
  extra: Pick<Sfx, 'align' | 'peakAt' | 'slices'> = {},
): Sfx => ({ id, file: `sfx/${file}`, source: `styles/style-1/sfx/${file}`, role, duration, gainDb, use, tags, ...extra });

export const sfx: Sfx[] = [
  s('typing', 'typing.mp3', 'typing', 2.586, -18, 'One keystroke per word as words fill in on the voice; layered over a soft click.', ['word', 'text'], { align: 'start', slices: { by: 'onsets', maxLen: 0.06 } }),
  s('fast-typing', 'fs.foley.very-fast-typing-short.wav', 'typing', 2.104, -34, 'Terminal or code being typed inside a screenshot (clip to 1.2 s).', ['code', 'terminal'], { align: 'start' }),
  s('viral-typing', 'viral.typing.wav', 'typing', 2.412, -25, 'Typing burst alternative; not mapped to an event.', ['text'], { align: 'start' }),
  s('ui-blip', 'ui-animations.mp3', 'ui', 2.142, -26, 'List items, cards and bullets appearing, one blip at a time.', ['list', 'card'], { align: 'start', slices: { by: 'onsets' } }),
  s('click', 'kenney.click.wav', 'click', 0.091, -26, 'Soft click under each typed word and on list items.', ['ui', 'soft'], { align: 'start' }),
  s('mouse', 'fs.ui.mouse-2-button-fast-click.wav', 'click', 0.203, -27, 'Cursor clicks something inside a screenshot.', ['cursor', 'ui'], { align: 'peak', peakAt: 0.11 }),
  s('snap', 'finger-snap-tight.wav', 'snap', 0.6, -24, 'Emphasis on the one big bold key word in a line.', ['emphasis', 'key-word'], { align: 'peak', peakAt: 0.197 }),
  s('snap-long', 'finger-snap.mp3', 'snap', 2.743, -24, 'Uncut original of the snap; use snap instead.', ['emphasis'], { align: 'start' }),
  s('pop', 'ui.pop.wav', 'pop', 0.32, -25, 'Icon, logo, chip or badge pops in with overshoot.', ['pop', 'icon'], { align: 'start' }),
  s('pop-4', 'fs.ui.pop-4.wav', 'pop', 0.22, -27, 'Pop variant, rotated with pop and pop-9 so repeats never sound identical.', ['pop'], { align: 'start' }),
  s('pop-9', 'fs.ui.pop-9.wav', 'pop', 0.093, -27, 'Short pop for cascades (every 2nd item, fading 6 dB across the run).', ['pop', 'cascade'], { align: 'start' }),
  s('bubble', 'fs.ui.the-best-bubble-pop-sound-fo.wav', 'pop', 0.284, -24, 'Speech-bubble comment appears.', ['bubble', 'comment'], { align: 'start' }),
  s('drop', 'fs.foley.water-drop.wav', 'drop', 1.583, -27, 'Small surprise accent, used sparingly.', ['accent', 'foley'], { align: 'start' }),
  s('drop-splash', 'fs.foley.water-drop-splash.wav', 'drop', 1.084, -28, 'Comment-keyword or lead magnet lands (the CTA).', ['cta', 'foley'], { align: 'peak', peakAt: 0.611 }),
  s('woosh-short', 'woosh-short.wav', 'whoosh', 0.45, -25, 'Screenshot, card or phone enters; the peak lands on arrival.', ['enter', 'card'], { align: 'peak', peakAt: 0.254 }),
  s('woosh-tight', 'woosh-tight.wav', 'whoosh', 0.3, -30, 'Element leaves or gets pushed out; alternate scene-change cut.', ['exit', 'slide'], { align: 'peak', peakAt: 0.134 }),
  s('woosh', 'woosh.mp3', 'whoosh', 1.515, -25, 'Slow original whoosh (too slow for most moves); not mapped to an event.', ['move'], { align: 'peak' }),
  s('air-cut', 'fs.whoosh.swosh-whoosh-air-cut.wav', 'whoosh', 0.437, -25, 'Fast air cut on a topic or scene change.', ['scene', 'cut'], { align: 'peak', peakAt: 0.143 }),
  s('soft-hit', 'fs.impact.soft-hit.wav', 'impact', 0.258, -32, 'Soft landing under a card arrival; also a book closing or heavy print landing (-22 dB there).', ['land', 'thud'], { align: 'start' }),
  s('punch', 'fs.impact.punch2.wav', 'impact', 0.352, -21, 'Hook title slam or big claim. Maximum 2 per video.', ['hit', 'hook'], { align: 'peak', peakAt: 0.126 }),
  s('riser', 'riser.mp3', 'riser', 3.161, -30, 'Full build into a reveal or the CTA. Always play it complete so it ends exactly on the cut; only where 3 s fit.', ['build', 'cta'], { align: 'end' }),
  s('riser-short', 'riser-short.wav', 'riser', 1.561, -30, 'Last 1.4 s of the riser, for short builds.', ['build'], { align: 'end' }),
  s('ui-riser', 'ui-riser.mp3', 'riser', 2.299, -32, 'Short bright rise when a UI screen builds in.', ['ui', 'reveal'], { align: 'start' }),
  s('chime', 'tonal.chime.wav', 'chime', 3.9, -27, 'Bell for a logo or a number landing (214k stars, 64 agents).', ['stat', 'logo'], { align: 'start' }),
  s('notify', 'tonal.notify.wav', 'notify', 2.0, -30, 'Two-note ping for a notification, message or comment moment.', ['notification'], { align: 'start' }),
];

/** SfxEvent name (packages/skills timeline.ts) → the sfx id that plays it. First choice only; map.json rotates alternates. */
export const sfxForEvent: Record<string, string> = {
  word: 'typing',
  'key-word': 'snap',
  'list-item': 'ui-blip',
  pop: 'pop',
  cascade: 'pop-9',
  bubble: 'bubble',
  'card-in': 'woosh-short',
  'slide-out': 'woosh-tight',
  scene: 'air-cut',
  'hard-hit': 'punch',
  stat: 'chime',
  notify: 'notify',
  'click-ui': 'mouse',
  accent: 'drop',
  code: 'fast-typing',
  'ui-reveal': 'ui-riser',
  build: 'riser',
  'big-build': 'riser',
  cta: 'drop-splash',
};

export const getSfx = (id: string): Sfx | undefined => sfx.find(x => x.id === id);
export const byRole = (role: SfxRole): Sfx[] => sfx.filter(x => x.role === role);
