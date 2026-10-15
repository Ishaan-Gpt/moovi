/**
 * The `style1-timeline` component's input, as the MotionEasy renderer reads it
 * (MotionEasy packages/library/src/components/style1-timeline.ts). Every time is an absolute frame at `fps`.
 * Positions are in the format's pixels (1080×1920 vertical, 1920×1080 landscape).
 * The kit (./style-1/kit) is the only thing that writes these; agents write scene programs (./program.ts).
 */

export type Format = 'vertical' | 'landscape';
export const SIZE: Record<Format, { W: number; H: number }> = { vertical: { W: 1080, H: 1920 }, landscape: { W: 1920, H: 1080 } };

/** The engine's fonts (MotionEasy packages/engine/src/fonts.ts). */
export const FONTS = ['jakarta', 'inter', 'bricolage', 'instrument', 'fraunces', 'mono', 'geist', 'archivo', 'anton', 'pacifico', 'roboto', 'inter-std'] as const;
export type FontId = (typeof FONTS)[number];

export type TWord = { w: string; f: number };
export type TLine = {
  kind: 'line'; words: TWord[]; font?: FontId; weight?: number; size?: number; width?: number; top: number;
  align?: 'center' | 'left'; cx?: number; x?: number; color?: string; grey?: string; reveal?: number; slide?: number; hold?: number;
  tracking?: number; motion?: 'rise' | 'elastic' | 'slam' | 'slide'; italic?: boolean; gradient?: string[]; instant?: boolean;
  dim?: number; dimTo?: string; chip?: string; sparks?: boolean; count?: [number, number]; out?: number; shimmer?: number;
  look?: 'metal' | 'neon' | 'glow';
};
export type TImage = {
  kind: 'image'; src?: string; cx: number; cy: number; w: number; h: number; rot?: number; spin?: number;
  draw?: string; color?: string; label?: string; sub?: string; screen?: string; logo?: string; logoScale?: number;
  ui?: { draw: string; p?: Record<string, unknown> }[]; zoom?: number; shadow?: [number, number, number, number];
  kill?: number; shatter?: boolean; p?: Record<string, unknown>; exit?: number; exitDir?: 'up' | 'right';
  path?: [number, number, number][]; pathRot?: boolean; end?: number;
  app?: string; title?: string; body?: string; icon?: string; iconSrc?: string; text?: string; settle?: number[];
  browser?: string; pages?: [number, string][]; tilt?: number; loop?: [number, number]; glow?: string;
  float?: [number, number, number] | [number, number, number][]; pivot?: [number, number]; f?: number; out?: number;
  enter?: 'pop' | 'rise' | 'left' | 'right' | 'slam' | 'glide'; vt?: number; bw?: boolean; fit?: 'cover' | 'contain';
  focus?: [number, number]; radius?: number; card?: boolean; rays?: [number, number, number][]; core?: number;
  wm?: number; wmOff?: number; shades?: number; dizzy?: [number, number];
};
export type TTypeBox = { kind: 'typebox'; x: number; y: number; w: number; h: number; r?: number; fill?: string; text: string; font?: FontId; weight?: number; color?: string; cursor: number; start: number; perChar: number; pad?: number; shadow?: boolean };
export type TCursor = { kind: 'cursor'; keys: [number, number, number, number?][]; size?: number; f?: number; out?: number };
export type TSearch = { kind: 'search'; x: number; y: number; w: number; h: number; text: string; f: number; start: number; perChar: number; morph?: { f: number; frames?: number; to: [number, number, number, number]; screen: string; url: string; focus?: [number, number] } };
export type TMark = { kind: 'mark'; x: number; y: number; w: number; h: number; f: number; frames?: number; color?: string; out?: number };
export type TProgress = { kind: 'progress'; x: number; y: number; w: number; h: number; f: number; f1: number; label: string; done: string; out?: number };
export type TComment = { kind: 'comment'; x: number; y: number; w: number; h: number; f: number; text: string; start: number; perChar: number; send: number; out?: number };
export type TFeed = { kind: 'feed'; x: number; y: number; w: number; h: number; f: number; rows: number[]; text: string; out?: number; title?: string };
export type TDeck = { kind: 'deck'; cx: number; cy: number; w: number; f: number; every: number; items: string[]; out?: number; vt?: number };
export type TCarousel = { kind: 'carousel'; cx: number; cy: number; rx: number; ry: number; w: number; f: number; items: [string, string][]; speed?: number; out?: number; step?: number };
export type TRect = { kind: 'rect'; x: number; y: number; w: number; h: number; stops: [number, string][]; f?: number; out?: number };
export type TGrid = { kind: 'grid'; x0: number; y0: number; x1: number; y1: number; col: number; row: number; fade?: number; color?: string; dot?: number };
export type TLayer = (TLine | TImage | TTypeBox | TCursor | TSearch | TMark | TProgress | TComment | TFeed | TDeck | TCarousel | TRect | TGrid) & { fixed?: boolean };

export type CamKey = [number, number, number, number] | [number, number, number, number, number];
export type TScene = {
  f0: number; f1: number; layers: TLayer[];
  enter?: { axis: 'x' | 'y'; from: number; tau: number; arrive?: number };
  exit?: { axis: 'x' | 'y'; to: number; frames: number };
  keys?: CamKey[];
};
export type TCorner = { src: string; x: number; y: number; w: number; h?: number; rot?: number; in?: number; out?: number; still?: boolean; beats?: number[]; pulse?: number[]; grey?: boolean; cycle?: number; phase?: number };
export type TBackdrop = {
  corners?: TCorner[]; sparkles?: [number, number, number, string, number][]; glows: [number, number, number, string, number][];
  grid?: { step: number; color: string; dot: number; line?: string }; grain?: number; vignette?: number;
  chips?: [number, number, string, string, string, number, number, number, number][];
};
export type Timeline = {
  fps: number; frames: number; bg?: string; backdrop?: TBackdrop; scenes: TScene[];
  grade?: { media?: string; split?: [string, string]; vignette?: number; lift?: string };
  mblur?: { n: number; shutter: number; win: [number, number][] };
  watermark?: { text: string; y: number; size?: number; color: string; weight?: number; font?: FontId };
};

/** The engine spec for one Style-1-timeline video (what the render pool and the studio player load). */
export interface EngineSpec { component: 'style1-timeline'; format: Format; fps: number; props: { timeline: Timeline } }
export const spec = (timeline: Timeline, format: Format): EngineSpec => ({ component: 'style1-timeline', format, fps: timeline.fps, props: { timeline } });

/** SFX events (MotionEasy styles/style-1/sfx/map.json): the mixer turns these into one sound each. */
export const SFX_EVENTS = ['word', 'key-word', 'list-item', 'pop', 'cascade', 'bubble', 'card-in', 'slide-out', 'scene', 'hard-hit', 'stat',
  'notify', 'click-ui', 'accent', 'code', 'ui-reveal', 'build', 'big-build', 'cta'] as const;
export type SfxEvent = (typeof SFX_EVENTS)[number];
export type Ev = { t: number; event: SfxEvent; text?: string; sound?: string; count?: number; spacing?: number };

/** A voice's word times (faster-whisper via MotionEasy styles/tools/words.py, or reading pace). */
export interface Word { word: string; t: number; end: number }
