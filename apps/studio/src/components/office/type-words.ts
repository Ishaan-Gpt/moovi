/**
 * The type cards and role chips' words (Stage 1 W1, behind MOOVI_ROUTER=pipeline). ALL PENDING ISHAAN (decisions 2
 * and 12): these are placeholders from the type names in docs/PIPELINE.html so the switch can be tried; his options are
 * in the W1 hand-over. Nothing here is a default.
 */
import type { AttachmentRole } from '@moovi/engine';

export const WORDS_PENDING = 'ishaan' as const;

export type FilmType = 'edit' | 'launch' | 'showreel' | 'brand-post' | 'saas-explainer' | 'ui-morph' | 'kinetic';

/** The seven type cards, in the registry's order (packages/library/src/types/index.ts TYPES). `soon`: not built yet. */
export const TYPE_CARDS: { id: FilmType; title: string; line: string; soon?: boolean }[] = [
  { id: 'edit', title: 'Edit my video', line: 'PENDING · your clip, edited' },
  { id: 'launch', title: 'Launch', line: 'PENDING · a product launch' },
  { id: 'showreel', title: 'Showreel', line: 'PENDING · a montage' },
  { id: 'brand-post', title: 'Brand post', line: 'PENDING · an idea or a story' },
  { id: 'saas-explainer', title: 'SaaS explainer', line: 'PENDING · how it works' },
  { id: 'ui-morph', title: 'UI morph', line: 'PENDING · soon', soon: true },
  { id: 'kinetic', title: 'Kinetic type', line: 'PENDING · soon', soon: true },
];
export const FILM_TYPES = TYPE_CARDS.map(c => c.id);
/** The first card: no type picked, Moovi decides (placeholder). */
export const AUTO_CARD = { title: 'Moovi picks', line: 'PENDING · any brief' };

/** Role chips on each attachment; null = Moovi decides (placeholders). */
export const ROLE_CHIPS: { id: AttachmentRole | null; label: string }[] = [
  { id: null, label: 'Moovi decides' },
  { id: 'footage', label: 'Footage' },
  { id: 'reference', label: 'Reference' },
  { id: 'asset', label: 'Asset' },
];
