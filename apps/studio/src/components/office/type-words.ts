/**
 * The brief box's words. The three preset names are Ishaan's (decision 19: Edit, Launch video, Showreel); every line
 * marked PENDING is a placeholder waiting for his wording (decision 12). Nothing here is a default.
 */
import type { Preset } from '@moovi/engine';

export const WORDS_PENDING = 'ishaan' as const;

/** The first screen: one of three presets, picked before anything else (decision 19). */
export const PRESET_CARDS: { id: Preset; title: string; line: string }[] = [
  { id: 'edit', title: 'Edit', line: 'PENDING · upload your video' },
  { id: 'launch', title: 'Launch video', line: 'PENDING · your site link or a brief' },
  { id: 'showreel', title: 'Showreel', line: 'PENDING · a topic, a link or a brief' },
];
export const PRESET_IDS = PRESET_CARDS.map(c => c.id);

/** Placeholders inside each preset (PENDING). */
export const PRESET_HINTS: Record<Preset, { text: string; url?: string; drop?: string }> = {
  edit: { text: 'Anything Moovi should know (optional)', drop: 'Choose the video to edit' },
  launch: { text: 'What to say about it (optional)', url: 'Your site, e.g. https://acme.com' },
  showreel: { text: 'A topic, a link or a brief' },
};
