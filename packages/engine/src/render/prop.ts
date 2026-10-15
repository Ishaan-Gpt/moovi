import { writeFileSync } from 'node:fs';
import { spec, type Timeline } from '@moovi/skills';
import { matte } from './host';

/**
 * A prop from the style's own catalogue, drawn by the renderer and saved as a transparent PNG. This is how a video
 * about a product with nothing to capture still gets its two Style 1 corner assets: relatable objects drawn in the
 * style's low-key 3D, picked from what the script talks about.
 */
export interface CornerProp { id: string; w: number; h: number; rx: RegExp; extra?: Record<string, unknown> }
export const CORNER_PROPS: CornerProp[] = [
  { id: 'clock', w: 300, h: 300, rx: /\b(time|fast|minutes?|seconds?|hours?|quick|deadline|schedule|late|speed|wait)/i },
  { id: 'watch', w: 380, h: 380, rx: /\b(countdown|timer|urgent|limited|ends?|hurry|last chance)/i, extra: { end: 45 } },
  { id: 'plane', w: 240, h: 170, rx: /\b(send|share|message|e-?mail|mail|dm|deliver|ship|launch|reply)/i },
  { id: 'bookmark', w: 300, h: 300, rx: /\b(save|bookmark|keep|library|later|collect|remember|notes?|ideas?)/i, extra: { p: { saveAt: 12 } } },
  { id: 'file', w: 260, h: 320, rx: /\b(files?|videos?|edit|export|documents?|uploads?|clips?|footage|record\w*|memos?)/i, extra: { label: '' } },
  { id: 'coin', w: 300, h: 300, rx: /\b(money|price|pay|cost|cheap|free|earn|budget|deal|cash|\$)/i, extra: { p: { landAt: 12, flips: 2 } } },
  { id: 'owl', w: 360, h: 360, rx: /\b(learn|study|smart|wise|night|school|course|teach|focus)/i },
];
const DEFAULTS = ['bookmark', 'clock'];

/** The two props that fit a text best (by how often their words come up), never the same twice. */
export function pickCorners(text: string, exclude: string[] = []): CornerProp[] {
  const scored = CORNER_PROPS.filter(p => !exclude.includes(p.id)).map(p => ({ p, n: (text.match(new RegExp(p.rx.source, 'gi')) ?? []).length })).sort((a, b) => b.n - a.n);
  const out = scored.filter(s => s.n > 0).map(s => s.p);
  for (const d of DEFAULTS) if (out.length < 2 && !out.some(p => p.id === d) && !exclude.includes(d)) out.push(CORNER_PROPS.find(p => p.id === d)!);
  return out.slice(0, 2);
}

/** Draw one prop and save it as a transparent PNG (cropped). A coin shows the video's own currency. */
export async function drawProp(p: CornerProp, out: string, currency = '$') {
  if (p.id === 'coin') p = { ...p, extra: { ...p.extra, p: { ...(p.extra?.p as object), face: `${currency}0` } } };
  const tl = (bg: string): Timeline => ({
    fps: 30, frames: 120, bg,
    scenes: [{ f0: 0, f1: 120, layers: [{ kind: 'image', draw: p.id, cx: 540, cy: 960, w: p.w, h: p.h, f: 0, ...p.extra } as never] }],
  });
  const r = await matte(spec(tl('#000000'), 'vertical'), spec(tl('#FFFFFF'), 'vertical'), 3.2, 1);
  if (!r) throw new Error(`The prop "${p.id}" drew nothing`);
  writeFileSync(out, Buffer.from(r.png, 'base64'));
  return { path: out, w: r.w, h: r.h };
}
