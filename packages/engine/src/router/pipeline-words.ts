/**
 * Every sentence the one way in shows on screen (Stage 1 W1). ALL OF IT IS PENDING ISHAAN (decisions 2 and 12: the
 * one-line pick and every on-screen word are his). These are working placeholders so the switch can be tried; the
 * options he chooses from are in docs/agents/STAGE-1.md's W1 log and the W1 hand-over note. Nothing here is a default.
 */
import { typeOf, type TypeId } from '@moovi/library/types';

export const WORDS_PENDING = 'ishaan' as const;

/** How the type was picked, as the pick line's reason (placeholder). */
export const HOW_WORDS: Record<'card' | 'style' | 'video' | 'words' | 'previous' | 'model' | 'answer', string> = {
  card: 'you picked it',
  style: 'you picked its look',
  video: 'you sent a video',
  words: 'your words name it',
  previous: 'same as your last film',
  model: 'my best read of your brief',
  answer: 'you chose it',
};

const lookName = (type: TypeId, look: string | null) => (look ? typeOf(type).looks.find(l => l.id === look)?.name ?? look : null);

/** Moovi's one-line pick, before anything runs (placeholder; decision 2). */
export function pickLine(p: { type: TypeId; look: string | null; how: keyof typeof HOW_WORDS }): string {
  const look = lookName(p.type, p.look);
  return `${typeOf(p.type).name}${look && look !== typeOf(p.type).name ? `, ${look} look` : ''}: ${HOW_WORDS[p.how]}. Tap a type card to change it.`;
}

/** The one question when two types fit equally (placeholder). */
export const TYPE_QUESTION = 'Two kinds of video fit this. Which one do you want?';
/** The one question when an attachment's role is unclear (placeholder). */
export const ROLE_QUESTION = 'What are your attachments for?';
export const ROLE_CHOICES: Record<string, string> = {
  'video-reference': 'The video shows the look; the images go in',
  'images-reference': 'Edit the video; the images show the look',
  'first-footage': 'Edit the first video; the others show the look',
  'all-reference': 'They all show the look',
  'all-footage': 'Edit them all',
};
export const typeChoice = (t: TypeId) => typeOf(t).name;

/** A type with no implementation yet (UI morph, Kinetic type; placeholder). */
export const notBuilt = (t: TypeId) => `${typeOf(t).name} is not built yet. Send me about five videos you like in this kind and I’ll learn it from them.`;
/** The Edit type with no video attached (placeholder). */
export const NEED_VIDEO = 'Send me the video to edit and I’ll start.';

/* ───── the three presets (decision 19); placeholders, pending Ishaan ───── */
/** A brief with no preset (the router refuses it). */
export const NO_PRESET = 'Pick one first: Edit, Launch video or Showreel.';
/** Launch with no site link (the skill path reads the live site). */
export const LAUNCH_NEEDS_LINK = 'Launch video needs your site’s link. Paste it and send again.';
/** Showreel with no words. */
export const SHOWREEL_NEEDS_TEXT = 'Tell me the topic, or paste a link, for the showreel.';
/** Showreel before its entry is wired. */
export const SHOWREEL_NOT_READY = 'Showreel is being built right now. Try Edit or Launch video meanwhile.';
