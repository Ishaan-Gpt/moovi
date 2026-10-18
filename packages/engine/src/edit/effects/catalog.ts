/**
 * The effects library: the motion graphics creator reels put on a talking head (studied from three @tenfoldmarc reels,
 * docs in the effects study), as reusable components for any selfie / talking-head clip. Pure data and rules here; the
 * drawing is ./runtime.ts (CSS 3D in the browser, one pure function of time per effect), the film is ./render.ts.
 *
 * Kinds:
 * - overlay: a graphic over (or behind) the speaker. At most ONE overlay is up at any moment.
 * - camera: moves the picture itself (zoom punches, the phone it shrinks into, the app window it pulls back into).
 *   A camera effect that frames the picture (phone, pull back) also counts as the moment's one overlay.
 * - transition: a short move between two moments (card flip, whip spin), never longer than 0.8 s.
 * Layers: `behind` effects are drawn between the background and the person cut out of the picture (needs a person
 * mask), so the speaker stays in front of them.
 */
export const FX_IDS = [
  'orbit', 'headline-wall', 'digital-zoom', 'spotlight', 'checklist', 'freeze-label', 'before-after', 'comment-cta',
  'phone-mockup', 'giant-word', 'pull-back', 'stat-counter', 'strike-tags', 'card-flip', 'whip-spin', 'timeline-ui',
] as const;
export type FxId = typeof FX_IDS[number];
export type FxKind = 'overlay' | 'camera' | 'transition';

export interface FxSpec {
  id: FxId;
  label: string;
  kind: FxKind;
  /** a camera effect that puts the picture in a frame (phone, window) holds the overlay slot too */
  framesPicture?: boolean;
  /** the effect is its own text (a giant keyword): the caption steps aside while it is up */
  ownsText?: boolean;
  /** drawn behind the speaker (needs the person mask; without one it draws in front, smaller) */
  behind?: boolean;
  /** seconds: the shortest and longest it may hold */
  min: number;
  max: number;
  /** the sound it lands with (a library sfx role) */
  sfx: 'whoosh' | 'pop' | 'tick' | 'type' | 'swoosh' | 'riser' | 'click' | 'none';
  /** where it sits, as a band of the frame height (0 top, 1 bottom): captions keep out of it */
  zone?: [number, number];
  /** one line on what it does (shown in the demo and the docs) */
  does: string;
}

export const FX: Record<FxId, FxSpec> = {
  'orbit': { id: 'orbit', label: 'Orbit', kind: 'overlay', behind: true, min: 1.6, max: 6, sfx: 'whoosh', zone: [0.14, 0.52], does: 'cards circle the speaker in 3D, passing behind the head and in front of it' },
  'headline-wall': { id: 'headline-wall', label: 'Headline Wall', kind: 'overlay', behind: true, min: 1.4, max: 5, sfx: 'pop', zone: [0.06, 0.5], does: 'cards fly in with a 3D tilt and settle in a collage around the head' },
  'digital-zoom': { id: 'digital-zoom', label: 'Digital Zoom', kind: 'camera', min: 0.6, max: 5, sfx: 'click', does: 'stepped punch ins on the face, one per stressed word' },
  'spotlight': { id: 'spotlight', label: 'Spotlight', kind: 'overlay', min: 0.8, max: 4, sfx: 'click', does: 'the room goes dark around the face for one line' },
  'checklist': { id: 'checklist', label: 'Checklist', kind: 'overlay', min: 1.6, max: 6, sfx: 'tick', zone: [0.08, 0.42], does: 'a glass card whose rows tick as each item is said' },
  'freeze-label': { id: 'freeze-label', label: 'Freeze and Label', kind: 'overlay', min: 1, max: 3, sfx: 'click', zone: [0.2, 0.6], does: 'the frame freezes and labels draw on with leader lines' },
  'before-after': { id: 'before-after', label: 'Before / After', kind: 'overlay', min: 1.4, max: 5, sfx: 'swoosh', zone: [0.08, 0.16], does: 'a wipe line splits the raw take from the edited one' },
  'comment-cta': { id: 'comment-cta', label: 'Comment CTA', kind: 'overlay', min: 1.6, max: 5, sfx: 'type', zone: [0.6, 0.86], does: 'a comment box types the keyword, a reply slides up' },
  'phone-mockup': { id: 'phone-mockup', label: 'Phone Mockup', kind: 'camera', framesPicture: true, min: 1.4, max: 5, sfx: 'whoosh', zone: [0.1, 0.9], does: 'the video shrinks into a phone that rotates in, in 3D' },
  'giant-word': { id: 'giant-word', label: 'Giant Word', kind: 'overlay', behind: true, ownsText: true, min: 0.8, max: 4, sfx: 'pop', zone: [0.18, 0.42], does: 'one huge keyword behind the speaker, blurring in' },
  'pull-back': { id: 'pull-back', label: 'Pull Back Reveal', kind: 'camera', framesPicture: true, min: 1.6, max: 6, sfx: 'riser', zone: [0.05, 0.95], does: 'the camera pulls back and the video becomes a window in an app' },
  'stat-counter': { id: 'stat-counter', label: 'Stat Counter', kind: 'overlay', min: 1.2, max: 5, sfx: 'tick', zone: [0.12, 0.4], does: 'a big number rolls up with a bar' },
  'strike-tags': { id: 'strike-tags', label: 'Strike Tags', kind: 'overlay', min: 1.4, max: 5, sfx: 'pop', zone: [0.14, 0.44], does: 'name tags pop one by one, then get struck through' },
  'card-flip': { id: 'card-flip', label: 'Card Flip', kind: 'transition', min: 0.4, max: 0.8, sfx: 'swoosh', does: 'the whole picture flips like a card in 3D' },
  'whip-spin': { id: 'whip-spin', label: 'Whip Spin', kind: 'transition', min: 0.3, max: 0.7, sfx: 'whoosh', does: 'a fast spin with motion blur between two moments' },
  'timeline-ui': { id: 'timeline-ui', label: 'Timeline UI', kind: 'overlay', min: 1.4, max: 5, sfx: 'swoosh', zone: [0.66, 0.92], does: 'an editor timeline slides up and its playhead scrubs' },
};

export const isFx = (x: string): x is FxId => (FX_IDS as readonly string[]).includes(x);
/** does this effect hold the one overlay slot while it is up */
export const holdsSlot = (id: FxId) => FX[id].kind === 'overlay' || !!FX[id].framesPicture;
