import type { Law, Section, Signature, Stage, StylePackage } from '../types';

/**
 * The unique style: when no known style fits, the crew designs one for this video from the skills. The rules come
 * from the owner's ishaan-motion skill (the approach for motion design that feels hand-made) and, for footage
 * edits, from the owner's edit-style-1 laws. The Art Director writes a style card (./card.ts) first; everything
 * after that runs on the same kit and renderer as Style 1.
 */
const SECTIONS: Section[] = [
  {
    id: 'u:what', title: 'What a unique style is', roles: [],
    text: `No known style fits this brief, so this video gets its own: a style card (palette, type, motion, camera, transitions, sound, a signature move) designed for this message and this audience, rendered on the same timeline engine as Style 1. It must feel hand-made by a senior motion designer, never "AI-made".`,
  },
  {
    id: 'u:nonneg', title: 'The non-negotiables', roles: [],
    text: `1. Never a cheap copy. If a shot would be better with a real asset (a capture, the product's UI, the user's footage), get it; a labelled placeholder beats a fake.
2. Beyond perfectionist, never "optimized". Every shot takes a leap past the obvious version.
3. Micro-details are never skipped, only added: every arrival, press, settle, number change gets its micro-motion (blur-in, overshoot, secondary wobble, shadow) AND its sound.
4. Never the template choice: every shot, transition and text treatment must be specific to this product. If it could appear in any other brand's video unchanged, it is still generic.
5. Honesty: every claim, number and quote is real.`,
  },
  {
    id: 'u:card', title: 'Designing the style card', roles: ['director', 'moovi'],
    text: `- Start from the message and the audience, then the user's own look (their palette and font, when known), then the reference's measurements when there is one, then the nearest known style's laws.
- Palette: the brand's colours only; one accent. Light worlds: white or pastel paper with soft blooms. Dark worlds: exactly ONE big soft bloom, never glows on every element. "Two worlds" alternates light and dark every 1–3 scenes to signal a topic change.
- Type: a display sans for everything plus a serif-italic accent for the hero word. Hierarchy by weight and colour, not size; the size changes once, for the big line.
- Pick the camera grammar and a transition rotation (never the same transition 3 times running; no crossfades).
- Name one signature move the video will be remembered for.
- Banned unless asked: crossfades, lens flares, glow on everything, camera shake, random particles, stock-looking 3D, fake UI, emoji as icons.`,
  },
  {
    id: 'u:shots', title: 'The shot list', roles: ['director', 'scribe', 'moovi'],
    text: `- The arc: hook (the pain) → drop (the line) → the brand → product proof → how it works → breadth → facts → end card. Adapt it, but always a hook and a payoff.
- One sentence, one hero word and one signature move per shot (a morph, a slam, a match cut, a dive, a wall). If you can't name the move, the shot isn't designed.
- Visualise the verb: "born" makes cards appear, "fade" blurs things away, "real" turns the word the accent colour.`,
  },
  {
    id: 'u:motion', title: 'Motion laws', roles: ['director', 'builder', 'lens'],
    text: `1. No dead stops between keys: ease only at the start and end of a move. 2. Cut in on motion: a scene starts already moving. 3. The camera is never still: a 3–6% push or drift over the whole shot. 4. Big scale changes in log space. 5. Stagger groups with jitter (2–2.5 frames apart, never one shared start frame). 6. Long soft settles: the last 5% of travel takes a third of the time. 7. Springs with small overshoot only for pops. 8. Separate objects get separate timing. 9. Word-by-word type: each word rises a few px, blur → sharp, grey → ink. 10. Depth of field is a tool: defocus as a transition.`,
  },
  {
    id: 'u:look', title: 'Look and layout', roles: ['builder', 'lens'],
    text: `- Measured layout: text never overflows, never overlaps, sits inside phone-safe margins (keep the top 8% and bottom 14% of a 9:16 frame clear of key words).
- Every staged shot has a backdrop on a parallax plane (the stage's glows and grid), and objects cast soft shadows.
- Product UI as clean cards with real labels, tilted at varied depths with soft shadows.`,
  },
  {
    id: 'u:footage', title: 'Editing the user’s footage', roles: ['director', 'builder', 'lens'],
    text: `When the user gives footage to edit (a talking head, a podcast, a screen recording):
- Every reel is bespoke: a direction first (concept, type, palette, scenes, music), never a recolour of an earlier edit.
- Captions on the chest: 62–70% of the frame height, 1–3 words at a time, every word on the frame it is spoken.
- Never a static face: a slow push on every shot and a +5–8% punch-in every phrase or two.
- A full-screen motion scene about every ~4 s replaces the face for one idea, then hands back.
- Every cut hides in light or motion (a light wash, a strip wipe, a zoom blur, a flash).
- Honest and theirs: the original voice track, a natural grade, no invented stats, logos only if their site shows them.`,
  },
  {
    id: 'u:sound', title: 'Sound', roles: ['builder', 'lens'],
    text: `The music carries the piece; SFX are sparse and recorded: a hit on slams, a whoosh on wipes, a click on cursor clicks, one keystroke per typed word. Risers end exactly on the hit. Master −14 LUFS, true peak ≤ −1 dB.`,
  },
  {
    id: 'u:review', title: 'Review', roles: ['lens', 'builder'],
    text: `- Stills first: a contact sheet at fixed timestamps; fix size and timing before the full render.
- The leap check: each shot must be clearly better than the obvious version of it.
- No text overflow, no overlapping elements, phone-safe margins; every shot moves on its first and last frame; no lockstep groups; no banned effects; the light/dark rhythm reads at speed.`,
  },
];

const SRC = '~/.claude/skills/ishaan-motion (owner) + MotionEasy edit-style-1';
const LAWS: Law[] = [
  { n: 1, title: 'Word-synced and honest', text: 'Every shown word lands on the frame it is spoken; every claim is real.', src: SRC,
    checks: [
      { id: 'voice-locked', kind: 'voiceLocked', about: 'At least 85% of shown words are spoken in their scene.', params: { min: 0.85 }, blocking: true, owner: 'builder' },
      { id: 'truth', kind: 'truth', about: 'Every claim passed the truth guard.', params: {}, blocking: true, owner: 'scribe' },
    ] },
  { n: 2, title: 'Hook first', text: 'The hook lands in the first 2 seconds.', src: SRC,
    checks: [{ id: 'hook-time', kind: 'hookTime', about: 'The first visual event lands before 2.0 s.', params: { max: 2.0 }, blocking: true, owner: 'scribe' }] },
  { n: 3, title: 'Measured layout', text: 'No overflow, no overlap, no empty frames, phone-safe margins.', src: SRC,
    checks: [
      { id: 'geometry', kind: 'geometry', about: 'No empty frame, clipped text or overlap lasting 0.2 s or more.', params: { minRun: 0.2 }, blocking: true, owner: 'builder' },
      { id: 'line-length', kind: 'lineLength', about: 'No line longer than 32 characters or 6 words.', params: { chars: 32, words: 6 }, blocking: false, owner: 'builder' },
    ] },
  { n: 4, title: 'Always moving', text: 'Every shot moves on its first and last frame; something new at least every 1.6 s.', src: SRC,
    checks: [
      { id: 'motion', kind: 'motion', about: 'Every scene’s camera moves.', params: {}, blocking: true, owner: 'builder' },
      { id: 'dead-air', kind: 'deadAir', about: 'No stretch longer than 1.8 s without a new visual event.', params: { max: 1.8 }, blocking: true, owner: 'builder' },
    ] },
  { n: 5, title: 'Footage edits: captions on the chest', text: 'Word captions at 62–70% of the height, 1–3 words at a time.', src: 'MotionEasy edit-style-1 §1',
    checks: [{ id: 'captions', kind: 'captions', about: 'When editing footage, captions cover the spoken words.', params: { min: 0.8 }, blocking: false, owner: 'builder' }] },
  { n: 6, title: 'The leap check', text: 'The still sheet reads premium and specific to this product, never like a template.', src: SRC,
    checks: [{ id: 'vision', kind: 'vision', about: 'The still sheet scores 7/10 or better against the card and the laws.', params: { min: 7 }, blocking: false, owner: 'builder' }] },
  { n: 7, title: 'Mastered', text: 'Master −14 LUFS, true peak ≤ −1 dB; a clean file.', src: SRC,
    checks: [
      { id: 'loudness', kind: 'loudness', about: 'Master −14 ±0.5 LUFS, peak ≤ −1 dB.', params: { target: -14, tol: 0.5, peak: -1 }, blocking: true, owner: 'lens' },
      { id: 'risers', kind: 'risers', about: 'At most two risers.', params: { max: 2 }, blocking: true, owner: 'builder' },
      { id: 'artifacts', kind: 'artifacts', about: 'No black, frozen or blank runs; the right length.', params: {}, blocking: true, owner: 'lens' },
    ] },
];

const PLAYBOOK: Stage[] = [
  { kind: 'intake', agent: 'intake', resource: 'cpu', title: 'Read the brief and the uploads', after: [], max: 2 },
  { kind: 'match', agent: 'match', resource: 'cpu', title: 'Match the brief to a style', after: ['intake'], max: 2 },
  { kind: 'plan', agent: 'moovi', resource: 'llm', title: 'Plan the video', after: ['match'], max: 3 },
  { kind: 'study', agent: 'director', resource: 'llm', title: 'Study the reference', after: ['plan'], when: 'reference', max: 2 },
  { kind: 'transcribe', agent: 'voice', resource: 'voice', title: 'Transcribe the footage', after: ['intake'], when: 'footage', max: 2 },
  { kind: 'research', agent: 'researcher', resource: 'llm', title: 'Find the facts', after: ['plan'], fanout: 'questions', max: 2 },
  { kind: 'card', agent: 'director', resource: 'llm', title: 'Design the style card', after: ['plan', 'study'], max: 3 },
  { kind: 'script', agent: 'scribe', resource: 'llm', title: 'Write the voice', after: ['plan', 'research', 'transcribe'], max: 3 },
  { kind: 'voice', agent: 'voice', resource: 'voice', title: 'Record the voice and time every word', after: ['script'], when: 'tts', max: 2 },
  { kind: 'board', agent: 'director', resource: 'llm', title: 'Board every shot', after: ['script', 'card'], max: 3 },
  { kind: 'asset', agent: 'hunter', resource: 'llm', title: 'Find an asset', after: ['board'], fanout: 'assets', max: 2 },
  { kind: 'build', agent: 'builder', resource: 'llm', title: 'Build a scene', after: ['voice', 'board', 'asset', 'transcribe'], fanout: 'scenes', max: 3 },
  { kind: 'assemble', agent: 'editor', resource: 'cpu', title: 'Assemble the film', after: ['build'], max: 2 },
  { kind: 'render', agent: 'editor', resource: 'render', title: 'Render a chunk', after: ['assemble'], fanout: 'chunks', max: 2 },
  { kind: 'sound', agent: 'editor', resource: 'audio', title: 'Mix and master the sound', after: ['assemble'], max: 2 },
  { kind: 'mux', agent: 'editor', resource: 'cpu', title: 'Join picture and sound', after: ['render', 'sound'], max: 2 },
  { kind: 'review', agent: 'lens', resource: 'llm', title: 'Review the film against the laws', after: ['mux'], max: 2 },
  { kind: 'deliver', agent: 'editor', resource: 'cpu', title: 'Deliver the video', after: ['review'], max: 2 },
  { kind: 'keep', agent: 'keeper', resource: 'llm', title: 'Remember what this video used', after: ['deliver'], max: 2 },
];

const SIGNATURE: Signature = { style: 'unique', formats: ['vertical', 'landscape'], min: 8, max: 120, languages: ['any'], footage: 'any', intents: [], avoid: [], threshold: 0, autonomous: true };

export const UNIQUE: StylePackage = {
  style: { id: 'unique', name: 'A style of its own', number: 0, mode: 'generate', tagline: 'Designed for this one video',
    pitch: 'When no known style fits, the Art Director designs a new one from the motion skill: palette, type, motion, camera, sound and a signature move, on the same engine.',
    formats: ['vertical', 'landscape'], min: 8, max: 120, autonomous: true, needs: ['A brief, footage to edit, or a reference to learn from'] },
  skill: { id: 'unique:skill', name: 'Unique style (ishaan-motion)', version: '1.2.0', source: SRC, sections: SECTIONS },
  laws: LAWS, playbook: PLAYBOOK, signature: SIGNATURE,
};

export { StyleCard, stageFromCard, fallbackCard, type StyleCard as StyleCardT } from './card';
