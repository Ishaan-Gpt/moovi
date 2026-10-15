import type { Law } from '../types';

const SRC = 'MotionEasy .claude/skills/style-1/SKILL.md';

/** Style 1's laws, each with the checks that test it. Lens runs every check; a failure names its law and owner. */
export const LAWS: Law[] = [
  { n: 1, title: 'The voice drives everything', text: 'Every visual event lands on a spoken word; each shown word appears on the frame the voice says it.', src: `${SRC} §1, §0 Sound`,
    checks: [{ id: 'voice-locked', kind: 'voiceLocked', about: 'At least 90% of shown words are words the voice says in that scene.', params: { min: 0.9 }, blocking: true, owner: 'builder' }] },
  { n: 2, title: 'Hook in under two seconds', text: 'The first shown word lands before 2 s; the hook is a bold claim with one object.', src: `${SRC} §3, §6`,
    checks: [{ id: 'hook-time', kind: 'hookTime', about: 'The first shown word lands before 2.0 s.', params: { max: 2.0 }, blocking: true, owner: 'scribe' }] },
  { n: 3, title: 'The screen carries the key words', text: 'Key words only: at most ~22 characters and 5 words a line.', src: `${SRC} §0 Direction`,
    checks: [{ id: 'line-length', kind: 'lineLength', about: 'No line longer than 26 characters or 5 words.', params: { chars: 26, words: 5 }, blocking: true, owner: 'builder' }] },
  { n: 4, title: 'One type style, one gold accent', text: 'One font family per video and at most one serif-italic gold line per scene.', src: `${SRC} §0 Look`,
    checks: [{ id: 'serif-per-scene', kind: 'serifPerScene', about: 'At most one serif accent line in any scene.', params: { max: 1 }, blocking: true, owner: 'builder' }] },
  { n: 5, title: 'Never change the background', text: 'The stage stays: light paper, soft glows, a fading dot grid, grain, and two still corner assets.', src: `${SRC} §0 Look, §2`,
    checks: [{ id: 'corners', kind: 'corners', about: 'Two corner assets sit on the stage.', params: { n: 2 }, blocking: false, owner: 'hunter' }] },
  { n: 6, title: 'No overlapping text, no dead air', text: 'Text never touches text or an object; something new at least every 1.5 s; no empty or clipped frames.', src: `${SRC} §0 (2026-10-10), §1, §8`,
    checks: [
      { id: 'geometry', kind: 'geometry', about: 'The renderer’s boxes show no empty frame, no clipped text and no overlap lasting 0.2 s or more.', params: { minRun: 0.2 }, blocking: true, owner: 'builder' },
      { id: 'dead-air', kind: 'deadAir', about: 'No stretch longer than 1.6 s without a new visual event.', params: { max: 1.6 }, blocking: true, owner: 'builder' },
    ] },
  { n: 7, title: 'Hook → proof → climax → CTA, all true', text: 'The story arc ends on the ask, and every line rests on a verified fact.', src: `${SRC} §0 Direction, §6`,
    checks: [
      { id: 'cta-tail', kind: 'ctaTail', about: 'The last scene is the ask (a comment keyword or the call to action).', params: {}, blocking: false, owner: 'director' },
      { id: 'truth', kind: 'truth', about: 'Every claim passed the truth guard.', params: {}, blocking: true, owner: 'scribe' },
    ] },
  { n: 8, title: 'Quality never drops', text: 'Every scene moves, every scene longer than 1.5 s has a visual, and the last third is as dense as the first.', src: `${SRC} §0 Look (2026-10-09)`,
    checks: [
      { id: 'motion', kind: 'motion', about: 'Every scene’s camera moves (its keys change scale or position).', params: {}, blocking: true, owner: 'builder' },
      { id: 'visual-per-scene', kind: 'visualPerScene', about: 'No text-only scene longer than 1.5 s.', params: { max: 1.5 }, blocking: true, owner: 'builder' },
      { id: 'vision', kind: 'vision', about: 'The still sheet reads premium to the end: no overlaps, no empty space, the last third as rich as the first.', params: { min: 7 }, blocking: false, owner: 'builder' },
    ] },
  { n: 9, title: 'Loud and clear, like the references', text: 'Master −14 LUFS, true peak ≤ −1 dB, SFX dense but felt, risers rare and complete.', src: `${SRC} §0 Sound, §5`,
    checks: [
      { id: 'loudness', kind: 'loudness', about: 'Master −14 ±0.5 LUFS, peak ≤ −1 dB.', params: { target: -14, tol: 0.5, peak: -1 }, blocking: true, owner: 'lens' },
      { id: 'sfx-rate', kind: 'sfxRate', about: 'Between 2 and 3.5 sound events a second.', params: { min: 2, max: 3.5 }, blocking: false, owner: 'builder' },
      { id: 'risers', kind: 'risers', about: 'At most two risers in the video.', params: { max: 2 }, blocking: true, owner: 'builder' },
      { id: 'artifacts', kind: 'artifacts', about: 'The file has no black, frozen or blank runs and the right length.', params: {}, blocking: true, owner: 'lens' },
    ] },
  { n: 10, title: 'Clear of the app’s own UI', text: 'On a 9:16 reel no word sits where Instagram, TikTok or Shorts draw over it: the bottom band (caption, handle, audio, buttons) and the like/comment/share rail on the right.', src: 'MotionEasy .claude/skills/style-3-impact §6, style-3-review (the 9:16 UI zone); bounds measured on the kit and delivered films (docs/STUDIO.md)',
    // reference units 1080×1920: the bottom `bottom` px, and right of 1080 − `rail` from y `railTop` down
    checks: [{ id: 'safe-zone', kind: 'safeZone', about: 'No words (lines, pills, fields, word props) in the bottom 270 px (14%), or right of x 960 below y 960, for 0.2 s or more.', params: { bottom: 270, rail: 120, railTop: 960, minRun: 0.2 }, blocking: true, owner: 'builder' }] },
];
