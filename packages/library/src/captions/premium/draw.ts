/**
 * The premium caption painter: word-timed two-tier cards on a 2D canvas. Self-contained (no imports at runtime) so the
 * gallery and the MP4 path (Chromium) inline the very same code as the studio preview.
 */
import type { PremiumPreset, TierSpec } from './presets';

export interface Word { text: string; t: number; end: number }
export interface Card { lead: Word[]; key: Word[]; t0: number; t1: number }

const STOP = new Set(('a an the and or but so to of in on at for is are am was be it i we you he she they my your our ' +
  'this that with as by from now just then very really can will do does basically which').split(' '));

/** how strongly a word carries the line: the one the voice hits goes to the key tier */
function weight(w: Word, i: number): number {
  const bare = w.text.replace(/[^\p{L}\p{N}]/gu, '');
  const low = bare.toLowerCase();
  if (!bare) return -9;
  let s = Math.min(bare.length, 9) / 3;
  if (STOP.has(low)) s -= 4;
  if (/\d/.test(bare)) s += 3;
  if (i > 0 && /^\p{Lu}/u.test(bare)) s += 2;
  if (/[!?]$/.test(w.text)) s += 1.5;
  return s;
}

/** Cards: phrases split at punctuation and pauses; each card ends on its key word, the strongest within `maxWords`. */
export function cards(words: Word[], maxWords: number): Card[] {
  const phrases: Word[][] = [];
  let cur: Word[] = [];
  words.forEach((w, i) => {
    cur.push(w);
    const next = words[i + 1];
    if (!next || /[.,!?;:]$/.test(w.text) || next.t - w.end > 0.35) { phrases.push(cur); cur = []; }
  });
  const out: Card[] = [];
  for (let p of phrases) {
    while (p.length) {
      const win = p.slice(0, maxWords);
      // the voice leans on the end of a phrase: a small bias to later words
      const score = (i: number) => weight(win[i]!, i) + (i === p.length - 1 ? 0.6 : 0);
      let k = 0;
      win.forEach((_, i) => { if (score(i) >= score(k)) k = i; });
      // one short word that closes the phrase rides with the key ("DID IT!")
      const cut = p.length - k - 1 === 1 && p[k + 1]!.text.replace(/\W/g, '').length <= 3 && /[.!?]$/.test(p[k + 1]!.text) ? k + 2 : k + 1;
      const seg = p.slice(0, cut);
      out.push({ lead: seg.slice(0, k), key: seg.slice(k), t0: seg[0]!.t, t1: seg[seg.length - 1]!.end });
      p = p.slice(cut);
    }
  }
  // a card holds until the next one starts (at most 0.9 s past its last word)
  out.forEach((c, i) => { const n = out[i + 1]; c.t1 = n ? Math.min(n.t0, c.t1 + 0.9) : c.t1 + 0.6; });
  return out;
}

/**
 * Captions never show punctuation (Ishaan, 2026-10-18): only letters, digits and the symbols that carry meaning
 * (% $ # & +) reach the screen. The words keep it for timing and key-word choice.
 */
export const bare = (s: string) => s.replace(/[^\p{L}\p{N}%$#&+ ]/gu, '');
const cased = (tier: TierSpec, s: string) => (tier.casing === 'none' ? bare(s) : bare(s).toUpperCase());

const clamp = (x: number) => Math.min(Math.max(x, 0), 1);

type Ctx2D = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;
/** the font of the last `font()` call, applied as-is to offscreen layers (`ctx.font` reads back without the stretch) */
let face = { font: '', stretch: 'normal', spacing: '0px' };
function setFace(c: Ctx2D) {
  c.font = face.font;
  (c as unknown as { fontStretch: string }).fontStretch = face.stretch;
  (c as unknown as { letterSpacing: string }).letterSpacing = face.spacing;
}

function font(ctx: CanvasRenderingContext2D, tier: TierSpec, S: number, k = 1): number {
  const px = (tier.size * S / 0.72) * k; // cap height ≈ 0.72 em in a heavy grotesk
  face = { font: `${tier.weight} ${px}px "${tier.font}"`, stretch: tier.stretch ?? 'normal', spacing: `${tier.tracking * px}px` };
  setFace(ctx);
  return px;
}

function fillStyle(ctx: Ctx2D, tier: TierSpec, y: number, px: number): string | CanvasGradient {
  if (typeof tier.fill === 'string') return tier.fill;
  const g = ctx.createLinearGradient(0, y - px * 0.74, 0, y);
  tier.fill.forEach((c, i, a) => g.addColorStop(i / (a.length - 1), c));
  return g;
}

/**
 * The bloom: the word drawn once into its own layer, then laid back blurred at each radius in screen mode, wide and
 * faint to tight and hot, so the light falls off like a lens bloom instead of stacked shadow rings.
 */
function bloom(ctx: CanvasRenderingContext2D, tier: TierSpec, text: string, x: number, y: number, px: number, S: number, alpha: number) {
  const g = tier.glow!;
  const pad = Math.ceil(Math.max(...g.layers.map(l => l.r)) * S * 2.5);
  const w = Math.ceil(ctx.measureText(text).width) + pad * 2, h = Math.ceil(px * 1.3) + pad * 2;
  const off = new OffscreenCanvas(w, h);
  const o = off.getContext('2d')!;
  setFace(o);
  o.fillStyle = '#fff'; o.fillText(text, pad, pad + px);
  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  // each layer carries its own hue (emerald halo, lime body, near-white core): the white mask tinted per layer
  const tint = new OffscreenCanvas(w, h), tc = tint.getContext('2d')!;
  for (const l of g.layers) {
    tc.globalCompositeOperation = 'copy'; tc.drawImage(off, 0, 0);
    tc.globalCompositeOperation = 'source-in'; tc.fillStyle = l.c ?? g.color; tc.fillRect(0, 0, w, h);
    ctx.globalAlpha = alpha * l.a;
    ctx.filter = `blur(${l.r * S}px)`;
    ctx.drawImage(tint, x - pad, y - px - pad);
  }
  ctx.restore();
}

/** soft corners: the word stroked in its own fill with round joins, so square cuts read as rounded squares */
function round(c: Ctx2D, tier: TierSpec, text: string, x: number, y: number, px: number) {
  if (!tier.round) return;
  c.save(); c.lineJoin = 'round'; c.lineWidth = tier.round * px; c.strokeStyle = c.fillStyle; c.strokeText(text, x, y); c.restore();
}

function paintWord(ctx: CanvasRenderingContext2D, tier: TierSpec, text: string, x: number, y: number, px: number, S: number, alpha: number, glowGain = 1) {
  ctx.save();
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  if (tier.shadow) {
    ctx.globalAlpha = alpha;
    ctx.shadowColor = tier.shadow.color; ctx.shadowBlur = tier.shadow.blur * S; ctx.shadowOffsetY = tier.shadow.dy * S;
    ctx.fillStyle = '#000'; ctx.fillText(text, x, y);
    ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;
  }
  if (tier.glow) bloom(ctx, tier, text, x, y, px, S, alpha * glowGain);
  ctx.globalAlpha = alpha;
  if (tier.edge) {
    ctx.lineJoin = 'round'; ctx.strokeStyle = tier.edge.color; ctx.lineWidth = tier.edge.width * S / 1080;
    ctx.strokeText(text, x, y);
  }
  if (!tier.sheen) {
    ctx.fillStyle = fillStyle(ctx, tier, y, px);
    round(ctx, tier, text, x, y, px);
    ctx.fillText(text, x, y);
    ctx.restore();
    return;
  }
  // the letters lit from inside: on their own layer, the fill, then their shape blurred white and kept only inside
  // the letters (strongest at the core, falling off to the gradient at the edges)
  const pad = Math.ceil(px * 0.2);
  const w = Math.ceil(ctx.measureText(text).width) + pad * 2, h = Math.ceil(px * 1.3) + pad * 2;
  const layer = new OffscreenCanvas(w, h), o = layer.getContext('2d')!;
  setFace(o);
  const by = pad + px;
  o.fillStyle = fillStyle(o, tier, by, px);
  round(o, tier, text, pad, by, px);
  o.fillText(text, pad, by);
  o.globalCompositeOperation = 'source-atop';
  o.globalAlpha = tier.sheen;
  o.filter = `blur(${px * 0.07}px)`;
  o.fillStyle = '#FFFFFF';
  o.fillText(text, pad, by - px * 0.03);
  ctx.drawImage(layer, x - pad, y - by);
  ctx.restore();
}

/**
 * One tier centred at `cy` (its cap middle). Each word enters on its own onset (`p.enter`, decoded from the reference
 * reel at 30 fps): it pops in large and soft, snaps to size on a damped spring (a small undershoot, the bounce), and its
 * glow flashes on arrival then eases. Words not yet spoken keep their place.
 */
function tierLine(ctx: CanvasRenderingContext2D, p: PremiumPreset, tier: TierSpec, ws: Word[], t: number, W: number, cy: number, S: number) {
  if (!ws.length) return;
  let px = font(ctx, tier, S);
  const text = cased(tier, ws.map(w => w.text).join(' '));
  const k = tier.wide ?? 1;
  const fit = Math.min(1, (W * 0.9) / (ctx.measureText(text).width * k));
  if (fit < 1) px = font(ctx, tier, S, fit);
  const full = ctx.measureText(text).width * k;
  const base = cy + px * 0.36;
  const space = ctx.measureText(' ').width * k + (tier.wordGap ?? 0) * px * k;
  let x = W / 2 - full / 2;
  for (const w of ws) {
    const s = cased(tier, w.text);
    const wd = ctx.measureText(s).width * k;
    const e = t - w.t;
    if (e >= 0) {
      const r = p.enter;
      // damped spring 1 - exp(-decay e) cos(freq e): from scaleFrom down through 1, a little under, back to 1
      const spring = 1 - Math.exp(-r.decay * e) * Math.cos(r.freq * e);
      const sc = r.scaleFrom + (1 - r.scaleFrom) * spring;
      const pull = clamp(1 - e / r.blurS);
      const flash = 1 + r.flash * Math.exp(-e / r.flashS);
      ctx.save();
      ctx.translate(x, 0); ctx.scale(k, 1);
      const cx = wd / k / 2, cyw = base - px * 0.36;
      ctx.translate(cx, cyw); ctx.scale(sc, sc);
      if (tier.skew) ctx.transform(1, 0, -tier.skew, 1, 0, 0);
      ctx.translate(-cx, -cyw);
      // focus pull: the word arrives soft and sharpens as it lands
      if (pull > 0) ctx.filter = `blur(${pull * r.blur * S}px)`;
      paintWord(ctx, tier, s, 0, base, px, S, clamp(e / r.fadeS), flash);
      ctx.restore();
    }
    x += wd + space;
  }
}

/** Paint the caption for time `t` (s) on a W x H canvas. */
export function drawCaption(ctx: CanvasRenderingContext2D, p: PremiumPreset, list: Card[], t: number, W: number, H: number) {
  const c = list.find(c => t >= c.t0 && t < c.t1);
  if (!c) return;
  const S = Math.min(W, H);
  const [t1, t2] = p.tiers;
  const h1 = c.lead.length ? t1.size * S : 0;
  const h2 = t2.size * S;
  const gap = c.lead.length ? p.gap * S : 0;
  const top = p.y * H - (h1 + gap + h2) / 2;
  // the hold: the whole card settles slowly smaller while it is up (the reference's drift)
  const d = 1 + p.enter.drift * (t - c.t0);
  ctx.save();
  ctx.translate(W / 2, p.y * H); ctx.scale(d, d); ctx.translate(-W / 2, -p.y * H);
  tierLine(ctx, p, t1, c.lead, t, W, top + h1 / 2, S);
  tierLine(ctx, p, t2, c.key, t, W, top + h1 + gap + h2 / 2, S);
  ctx.restore();
}

/** The word onsets that get a Style 1 typing tick (one per word, the owner's rule in sfx-style1/map.json "word"). */
export function ticks(list: Card[]): number[] {
  return list.flatMap(c => [...c.lead, ...c.key].map(w => w.t));
}
