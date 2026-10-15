import { z } from 'zod';
import { FONTS, SFX_EVENTS } from './timeline';

/**
 * Scene programs: what a Shot Builder writes for one scene. The kit compiles a program into a `style1-timeline`
 * scene (./timeline.ts). Programs never hold absolute frames:
 * - a number in a frame field is frames after the scene starts (0 = the cut);
 * - `{ w: "website" }` is the frame the voice says "website" in this scene (`n: 2` = its second time,
 *   `off: -3` = three frames before it); `{ w: 4 }` is the scene's 5th spoken word.
 * Screen words in `line` layers are timed automatically: each lands on the frame the voice says it.
 * Positions are format pixels (vertical 1080×1920, landscape 1920×1080).
 */

export const Anchor = z.union([
  z.number().describe('frames after the scene starts'),
  z.object({
    w: z.union([z.string(), z.number().int().min(0)]).describe('a spoken word of this scene (text), or its index'),
    n: z.number().int().min(1).optional().describe('which occurrence of the word (default 1)'),
    off: z.number().optional().describe('frames to add (negative = before the word)'),
  }).strict(),
]);
export type Anchor = z.infer<typeof Anchor>;

const N = z.number();
const XY = z.tuple([N, N]);
const Color = z.string().regex(/^(#[0-9a-fA-F]{3,8}|rgba?\([^)]*\))$/, 'a #hex or rgb()/rgba() colour');
const Src = z.string().min(1).describe('an asset ref: "asset:<id>" or "upload:<id>"');
const Float = z.union([z.tuple([N, N, N]), z.array(z.tuple([N, N, N]))]).describe('[amplitude px, period s, phase rad] idle float');

export const LineP = z.object({
  kind: z.literal('line'),
  text: z.string().min(1).describe('the screen words, spoken in this scene, in order'),
  look: z.enum(['ink', 'accent', 'serif', 'quiet']).default('ink').describe('ink = the type colour; accent = the style accent, slams; serif = the one serif-italic accent line; quiet = light weight'),
  top: N.describe('cap-top y of the line'),
  width: N.optional().describe('the line width it is sized to (the renderer solves the font size); default from the text'),
  size: N.optional(), weight: N.optional(), tracking: N.optional(), italic: z.boolean().optional(),
  align: z.enum(['center', 'left']).optional(), x: N.optional().describe('left x when align = left'), cx: N.optional(),
  motion: z.enum(['rise', 'elastic', 'slam', 'slide']).optional().describe('word entry; default rise (centred) / elastic (left)'),
  instant: z.boolean().optional().describe('skip the grey → ink fill'),
  out: Anchor.optional().describe('frame the line fades out (a later line replaces it)'),
  dim: z.union([Anchor, z.literal('next')]).optional().describe('frame the line steps back to grey; "next" = when the next line starts'),
  sparks: z.boolean().optional(), chip: Color.optional(), count: z.tuple([N, N]).optional().describe('[from, frames]: a number word counts up'),
  key: z.boolean().optional().describe('a key word: gets the key-word sound (accent lines are key by default)'),
  fixed: z.boolean().optional().describe('rides above the camera'),
}).strict();

export const ImageP = z.object({
  kind: z.literal('image'),
  draw: z.string().optional().describe('a prop drawn in code (see the prop catalogue): phone, notif, flip, seal, note, lockphone, nle …'),
  src: Src.optional().describe('media for a plain image/card (or the phone screen when draw = phone, via `screen`)'),
  screen: Src.optional(), logo: Src.optional(), iconSrc: Src.optional(),
  cx: N, cy: N, w: N, h: N,
  at: Anchor.optional().describe('entry frame (default: the cut)'),
  enter: z.enum(['pop', 'rise', 'left', 'right', 'slam', 'glide']).optional(),
  exit: z.union([Anchor, z.literal('auto'), z.literal('none')]).optional().describe('glide-out frame; auto = 10 frames before the cut (default)'),
  exitDir: z.enum(['up', 'right']).optional(),
  out: Anchor.optional(), kill: Anchor.optional().describe('struck / shattered at this frame'), shatter: z.boolean().optional(),
  rot: N.optional(), spin: N.optional(), tilt: N.optional(), float: Float.optional(), pivot: XY.optional(),
  glow: Color.optional(), fit: z.enum(['cover', 'contain']).optional(), focus: XY.optional(), radius: N.optional(), card: z.boolean().optional(),
  browser: z.string().optional().describe('draw a browser window around the media; the URL pill text ("" = a lock)'),
  pages: z.array(z.tuple([Anchor, Src])).optional(),
  path: z.array(z.tuple([Anchor, N, N])).optional().describe('[[frame, x, y], …]: the image travels these points'), pathRot: z.boolean().optional(),
  shadow: z.tuple([N, N, N, N]).optional(), zoom: N.optional(), vt: N.optional().describe('video start time (s)'), loop: XY.optional(),
  ui: z.array(z.object({ draw: z.string(), p: z.record(z.string(), z.unknown()).optional() })).optional().describe('props drawn over a phone screen'),
  p: z.record(z.string(), z.unknown()).optional().describe('prop params; *At keys and frame lists take anchors'),
  color: Color.optional(), label: z.string().optional(), sub: z.string().optional(),
  app: z.string().optional(), title: z.string().optional(), body: z.string().optional(), icon: Color.optional(),
  text: z.string().optional(), settle: z.array(Anchor).optional(),
  rays: z.array(z.tuple([N, N, N])).optional(), core: N.optional(), bw: z.boolean().optional(),
  wm: Anchor.optional(), wmOff: Anchor.optional(), shades: Anchor.optional(), dizzy: z.tuple([Anchor, Anchor]).optional(), end: Anchor.optional(),
  fixed: z.boolean().optional(),
}).strict();

const Box = { x: N, y: N, w: N, h: N };
export const TypeBoxP = z.object({ kind: z.literal('typebox'), ...Box, r: N.optional(), fill: Color.optional(), text: z.string(), font: z.enum(FONTS).optional(), weight: N.optional(), color: Color.optional(), cursor: Anchor, start: Anchor, perChar: N.positive(), pad: N.optional(), shadow: z.boolean().optional(), fixed: z.boolean().optional() }).strict();
export const CursorP = z.object({ kind: z.literal('cursor'), keys: z.array(z.union([z.tuple([Anchor, N, N]), z.tuple([Anchor, N, N, z.literal(1)])])).min(1).describe('[[frame, x, y, 1 = click], …]'), size: N.optional(), at: Anchor.optional(), out: Anchor.optional(), fixed: z.boolean().optional() }).strict();
export const SearchP = z.object({ kind: z.literal('search'), ...Box, text: z.string(), at: Anchor, start: Anchor, perChar: N.positive(), morph: z.object({ at: Anchor, frames: N.optional(), to: z.tuple([N, N, N, N]), screen: Src, url: z.string(), focus: XY.optional() }).strict().optional() }).strict();
export const MarkP = z.object({ kind: z.literal('mark'), ...Box, at: Anchor, frames: N.optional(), color: Color.optional(), out: Anchor.optional() }).strict();
export const ProgressP = z.object({ kind: z.literal('progress'), ...Box, at: Anchor, until: Anchor, label: z.string(), done: z.string(), out: Anchor.optional(), fixed: z.boolean().optional() }).strict();
export const CommentP = z.object({ kind: z.literal('comment'), ...Box, at: Anchor, text: z.string(), start: Anchor, perChar: N.positive(), send: Anchor, out: Anchor.optional() }).strict();
export const FeedP = z.object({ kind: z.literal('feed'), ...Box, at: Anchor, rows: z.array(Anchor).min(1), text: z.string(), title: z.string().optional(), out: Anchor.optional() }).strict();
export const DeckP = z.object({ kind: z.literal('deck'), cx: N, cy: N, w: N, at: Anchor, every: N.positive(), items: z.array(Src).min(2), out: Anchor.optional(), vt: N.optional() }).strict();
export const CarouselP = z.object({ kind: z.literal('carousel'), cx: N, cy: N, rx: N, ry: N, w: N, at: Anchor, items: z.array(z.tuple([Src, z.string()])).min(3), speed: N.optional(), step: N.optional(), out: Anchor.optional() }).strict();
export const RectP = z.object({ kind: z.literal('rect'), ...Box, stops: z.array(z.tuple([N, Color])).min(2), at: Anchor.optional(), out: Anchor.optional(), fixed: z.boolean().optional() }).strict();
export const GridP = z.object({ kind: z.literal('grid'), x0: N, y0: N, x1: N, y1: N, col: N, row: N, fade: N.optional(), color: z.string().optional(), dot: N.optional() }).strict();

export const LayerP = z.discriminatedUnion('kind', [LineP, ImageP, TypeBoxP, CursorP, SearchP, MarkP, ProgressP, CommentP, FeedP, DeckP, CarouselP, RectP, GridP]);
export type LayerP = z.input<typeof LayerP>;

/** Kit presets: tested layouts a program can start from (layers added in `layers` draw on top). Lines: "*WORD*" = accent slam, "~words" = the serif accent. */
export const PresetP = z.discriminatedUnion('id', [
  z.object({ id: z.literal('lines'), lines: z.array(z.string()).min(1).max(4), burst: z.boolean().optional() }).strict(),
  z.object({ id: z.literal('stack_slam'), lines: z.array(z.string()).min(2).max(4) }).strict(),
  z.object({ id: z.literal('list_left'), lines: z.array(z.string()).min(2).max(5) }).strict(),
  z.object({ id: z.literal('logo_land'), word: z.string(), title: z.string().optional(), wordmark: z.string().optional(), mark: Src.optional() }).strict(),
  z.object({ id: z.literal('icon_ring'), icons: z.array(Src).min(3).max(8), words: z.array(z.string()).min(1), title: z.string(), footer: z.array(z.string()).max(2).optional(), mark: Src.optional() }).strict(),
  z.object({ id: z.literal('logo_grid'), logos: z.array(Src).min(3).max(9), word: z.string(), title: z.string().optional() }).strict(),
  z.object({ id: z.literal('trio'), clips: z.tuple([Src, Src, Src]), words: z.tuple([z.string(), z.string(), z.string()]), title: z.string().optional() }).strict(),
  z.object({ id: z.literal('grid4'), clips: z.tuple([Src, Src, Src, Src]), title: z.string() }).strict(),
  z.object({ id: z.literal('export_proof'), clip: Src, exportWord: z.string(), proofWord: z.string(), title: z.string().optional() }).strict(),
  z.object({ id: z.literal('reveal'), clip: Src, capture: Src, rect: z.tuple([N, N, N, N]).describe('the clip pane inside the capture, in capture px (2880 wide)'), titleLines: z.array(z.string()).min(1).max(2), revealLine: z.string(), pullWord: z.string(), revealWord: z.string() }).strict(),
  z.object({ id: z.literal('cta_comment'), keyword: z.string(), bubble: z.string(), title: z.string().optional(), phoneClip: Src.optional() }).strict(),
  z.object({ id: z.literal('cta_pill'), lines: z.array(z.string()).min(1).max(2), pill: z.string(), pillWord: z.string().optional(), wordmark: z.string().optional() }).strict(),
  z.object({ id: z.literal('notif'), lines: z.array(z.string()).min(1).max(2), cards: z.array(z.object({ app: z.string(), title: z.string(), body: z.string() }).strict()).min(2).max(3) }).strict(),
  z.object({ id: z.literal('note'), lines: z.array(z.string()).min(1).max(2), title: z.string(), items: z.array(z.string()).min(2).max(4) }).strict(),
  z.object({ id: z.literal('seal'), lines: z.array(z.string()).min(1).max(2), top: z.string().max(8), bottom: z.string().max(10) }).strict(),
  z.object({ id: z.literal('flip'), lines: z.array(z.string()).min(1).max(2), word: z.string().max(10) }).strict(),
]);
export type PresetP = z.input<typeof PresetP>;
export const PRESET_IDS = PresetP.options.map(o => o.shape.id.value);

export const CamKeyP = z.object({ at: Anchor, scale: N.positive(), cx: N, cy: N, roll: N.optional() }).strict();
export const SfxP = z.object({ at: Anchor, event: z.enum(SFX_EVENTS), sound: z.string().optional() }).strict();

export const SceneProgram = z.object({
  name: z.string().min(1).max(40).describe('a short slug for the scene'),
  preset: PresetP.optional(),
  layers: z.array(LayerP).default([]),
  camera: z.array(CamKeyP).optional().describe('camera keys: the layout point (cx, cy) at the frame centre, scaled; default a slow push'),
  enter: z.enum(['up', 'down', 'left', 'right', 'none']).optional().describe('how the scene arrives on the cut (default up)'),
  push: N.optional().describe('default camera: start scale (pushes back to 1.0 by the next cut)'),
  sfx: z.array(SfxP).optional().describe('extra sound events (words, cuts and entries are sounded automatically)'),
}).strict();
export type SceneProgram = z.input<typeof SceneProgram>;
export type SceneProgramOut = z.output<typeof SceneProgram>;
