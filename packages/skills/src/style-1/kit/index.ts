import type { Format, Timeline, Word } from '../../timeline';
import { SIZE, spec } from '../../timeline';
import { PRESET_IDS } from '../../program';
import { sceneFrames, type SceneFrame } from './align';
import { assemble, type Assembled } from './assemble';
import { compileScene, ProgramError, type AssetResolver, type Compiled } from './compile';
import { geo } from './presets';
import { propDocs } from './props';
import type { Stage } from './stage';

export { norm, lcs, alignBeats, sceneFrames, readingPace, type SceneFrame, type SceneWord } from './align';
export { AnchorError, frameOf } from './anchors';
export { ProgramError, currencyOf, type Compiled, type AssetResolver } from './compile';
export { assemble, type Assembled } from './assemble';
export { PROPS, PROP_IDS, DECOR, TYPE_PROPS, firstVisual, propDocs, type PropDoc } from './props';
export { GOLD, DEFAULT_GLOWS, stageFrom, accentText, lum, mix, type Stage } from './stage';
export { parseLine } from './presets';

/**
 * The kit for one video: the voice's words split into scenes, a compiler for each scene's program, a preview of
 * one scene (for a Shot Builder's stills and scoped QA) and the assembly of the whole film.
 */
export class Kit {
  readonly scenes: SceneFrame[];
  readonly frames: number;
  readonly W: number; readonly H: number;

  constructor(readonly o: { beats: { say: string }[]; words: Word[]; stage: Stage; format: Format; fps?: number; assets: AssetResolver; currency?: string; product?: string | null }) {
    const { scenes, frames } = sceneFrames(o.beats, o.words, o.fps ?? 30);
    this.scenes = scenes; this.frames = frames;
    ({ W: this.W, H: this.H } = SIZE[o.format]);
  }

  /** Compile one scene's program (throws ProgramError / AnchorError with a message for the agent). */
  compile(i: number, program: unknown, o: { strict?: boolean } = {}): Compiled {
    const sf = this.scenes[i];
    if (!sf) throw new ProgramError(`There is no scene ${i + 1} (the video has ${this.scenes.length}).`);
    return compileScene(sf, program, { stage: this.o.stage, geo: geo(this.W, this.H), assets: this.o.assets, isLast: i === this.scenes.length - 1, currency: this.o.currency, product: this.o.product, strict: o.strict });
  }

  /** The film with only scene i in it (frames outside it show that scene's end): what a Shot Builder looks at. */
  preview(i: number, compiled: Compiled): { timeline: Timeline; spec: ReturnType<typeof spec>; range: [number, number]; events: Assembled['events'] } {
    const sf = this.scenes[i]!;
    const a = assemble([compiled], [sf], { stage: this.o.stage, format: this.o.format, fps: this.o.fps, totalFrames: this.frames, offset: i });
    return { timeline: a.timeline, spec: spec(a.timeline, this.o.format), range: [sf.f0, sf.f1], events: a.events };
  }

  /** Every scene compiled → the finished timeline, the SFX events and the word-match report. */
  assemble(compiled: Compiled[]): Assembled & { spec: ReturnType<typeof spec> } {
    if (compiled.length !== this.scenes.length) throw new ProgramError(`Expected ${this.scenes.length} scenes, got ${compiled.length}.`);
    const a = assemble(compiled, this.scenes, { stage: this.o.stage, format: this.o.format, fps: this.o.fps, totalFrames: this.frames });
    return { ...a, spec: spec(a.timeline, this.o.format) };
  }
}

/** The kit's manual, as the Shot Builder and the Art Director read it (kit.docs). */
export function kitDocs(format: Format): string {
  const { W, H } = SIZE[format];
  return `# The kit (style1-timeline renderer)
Canvas ${W}×${H} (${format}). x grows right, y grows down. Frame rate 30.

## Scene program
{ name, preset?, layers: [...], camera?: [{at, scale, cx, cy, roll?}], enter?: up|down|left|right|none, push?, sfx?: [{at, event, sound?}] }
- Frames: a number = frames after this scene's cut; {w:"word"} = the frame the voice says that word in this scene ({w:"word", n:2} its 2nd time; {w:3} the 4th spoken word; off: ±frames).
- Screen words (line layers) are timed for you: every word lands on the frame the voice says it. Only show KEY words, spoken in this scene, in order.
- Every image enters (at), and glides out 10 frames before the next cut unless exit/kill/out says otherwise ("exit": "none" keeps it).
- Asset refs: "asset:<id>" (from assets.get) or "upload:<id>". Never invent a URL.
- Default camera: a slow push from \`push\` (1.05) back to 1.0. Write \`camera\` keys for dives, pull-outs, rolls: the layout point (cx, cy) sits at the frame centre at that scale.

## Layers
- line {text, look: ink|accent|serif|quiet, top, width?, align?: center|left, x?, motion?: rise|elastic|slam|slide, out?, dim?: frame|"next", sparks?, chip?, count?, key?, fixed?}
  accent = the style accent, slams; serif = the ONE serif-italic gold accent line of the video; text auto-sizes to width.
- image {draw? | src?, cx, cy, w, h, at?, enter?: pop|rise|left|right|slam|glide, exit?, kill?, shatter?, rot?, spin?, tilt?, float?, glow?, fit?, focus?, radius?, card?, browser?, pages?, path?, shadow?, screen?, ui?, vt?, loop?, p?, …}
- typebox {x,y,w,h,r?,fill?,text,color?,cursor,start,perChar} · cursor {keys: [[frame,x,y,1?]…], size?, at?} · search {x,y,w,h,text,at,start,perChar,morph?}
- mark {x,y,w,h,at,frames?,color?} (highlighter) · progress {x,y,w,h,at,until,label,done} · comment {x,y,w,h,at,text,start,perChar,send}
- feed {x,y,w,h,at,rows:[frames],text} · deck {cx,cy,w,at,every,items} · carousel {cx,cy,rx,ry,w,at,items:[[src,name]]} · rect {x,y,w,h,stops} · grid {x0,y0,x1,y1,col,row}

## Presets (preset: {id, …}; your layers draw on top)
${PRESET_IDS.join(' · ')}
Lines inside presets: "*WORD*" = accent slam, "~words" = the serif accent.

## Props (image.draw)
${propDocs()}

## Sound events (sfx; words, cuts and entries are sounded automatically)
word key-word list-item pop cascade bubble card-in slide-out scene hard-hit stat notify click-ui accent code ui-reveal build big-build cta
build = the riser that ENDS on its frame: at most 1–2 per video, only into the biggest reveal.`;
}
