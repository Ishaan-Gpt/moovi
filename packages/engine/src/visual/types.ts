import type { FormatId, LayoutId } from './layouts';

/** How an element arrives (0.5 s), how it moves while it is on screen (always something), and how the camera and cuts move. */
export const ENTERS = ['pop', 'rise', 'left', 'right', 'drop', 'flip', 'zoom', 'unfold'] as const;
export const IDLES = ['float', 'sway', 'spin', 'pulse', 'breathe', 'bob'] as const;
export const CAMERAS = ['push', 'pull', 'drift-left', 'drift-right', 'orbit', 'rise', 'tilt'] as const;
export const TRANSITIONS = ['whip-left', 'whip-right', 'push-up', 'zoom-through', 'slide-down'] as const;
export const TYPE_STYLES = ['slam', 'rise', 'slide', 'scale'] as const;
export type Enter = (typeof ENTERS)[number];
export type Idle = (typeof IDLES)[number];
export type CameraId = (typeof CAMERAS)[number];
export type TransitionId = (typeof TRANSITIONS)[number];
export type TypeStyle = (typeof TYPE_STYLES)[number];

/** What an element shows. The words are the film's own (the beat's text); the planner never invents a claim. */
export interface Content {
  title?: string;
  /** short phrases for lists, chips, chat bubbles, toggles, timelines */
  items?: string[];
  /** real numbers the scene says (a chart's last value is the spoken one) */
  numbers?: number[];
  unit?: string;
  /** callout text beside an icon in a label slot */
  label?: string;
  /** a file in the engine's data dir (a site capture or a clip frame): shown on a device or as a tile */
  image?: string;
  /** a clip (mp4/webm) in the data dir, played on the element's screen when the page can decode it */
  /** real footage in the data dir (mp4/webm): played on the element's screen or in its panel, frame-accurate, looped */
  clip?: string;
  /** stock footage fills a panel; a scroll or screen recording is shown whole and top-aligned */
  clipKind?: 'footage' | 'scroll' | 'recording';
  /** seconds into the clip where this element starts (different elements show different moments) */
  clipAt?: number;
}

export interface VElement {
  slot: string;
  art: string;
  content: Content;
  enter: Enter;
  idle: Idle;
  /** seconds after the scene starts that it arrives */
  at: number;
}

export interface TypeLine {
  text: string;
  /** seconds after the scene starts each word lands */
  at: number[];
  style: TypeStyle;
  /** index of the accent word (within the line) */
  em: number | null;
  /** lines on the same page show together; a later page replaces an earlier one */
  page: number;
}

export interface VScene {
  i: number;
  start: number;
  end: number;
  layout: LayoutId;
  elements: VElement[];
  /** footage filling the whole frame behind the scene (stock footage; the scene's words are set in white over it) */
  backdrop?: { clip: string; kind: 'footage' | 'scroll' | 'recording'; at: number } | null;
  /** ambient artifact ids: a backdrop, particles, light */
  ambient: string[];
  camera: CameraId;
  /** how this scene arrives (none for the first) */
  transition: TransitionId | null;
  type: TypeLine[];
}

export interface VPlan {
  format: FormatId;
  fps: number;
  seconds: number;
  theme: 'light' | 'dark';
  seed: number;
  scenes: VScene[];
}

/** One beat of the film as the planner gets it: its words, when it is spoken, and what it needs on screen. */
export interface BeatIn {
  text: string;
  start: number;
  end: number;
  /** word timings from the voice, when there are any */
  words?: { w: string; start: number; end: number }[];
  /** needs from the model's tags; merged with the detector */
  needs?: string[];
}
