/**
 * The premium caption painter: word-timed two-tier cards on a 2D canvas. Self-contained (no imports at runtime) so the
 * gallery and the MP4 path (Chromium) inline the very same code as the studio preview.
 */
import type { PremiumPreset, TierSpec } from './presets';

export interface Word { text: string; t: number; end: number }
export interface Card { lead: Word[]; key: Word[]; tail: Word[]; t0: number; t1: number }

const STOP = new Set(('a an the and or but so to of in on at for is are am was be it i we you he she they my your our ' +
  'this that with as by from now just then very really can will do does basically which after before into them get also').split(' '));

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

/**
 * Cards: phrases split at punctuation and pauses; the key word is the strongest within `maxWords`. Two tiers
 * (`tailMax` 0): each card ends on its key. Three tiers: the key takes a second strong word ("SOCIAL MEDIA") and up to
 * `tailMax` words after it stay on the card as its tail ("grow karna").
 */
export function cards(words: Word[], maxWords: number, tailMax = 0): Card[] {
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
      if (tailMax > 0) {
        const kEnd = k + 1 < win.length && weight(win[k + 1]!, k + 1) >= 1.5 ? k + 2 : k + 1;
        const end = Math.min(p.length, kEnd + tailMax);
        const seg = p.slice(0, end);
        out.push({ lead: seg.slice(0, k), key: seg.slice(k, kEnd), tail: seg.slice(kEnd), t0: seg[0]!.t, t1: seg[seg.length - 1]!.end });
        p = p.slice(end);
        continue;
      }
      // one short word that closes the phrase rides with the key ("DID IT!")
      const cut = p.length - k - 1 === 1 && p[k + 1]!.text.replace(/\W/g, '').length <= 3 && /[.!?]$/.test(p[k + 1]!.text) ? k + 2 : k + 1;
      const seg = p.slice(0, cut);
      out.push({ lead: seg.slice(0, k), key: seg.slice(k), tail: [], t0: seg[0]!.t, t1: seg[seg.length - 1]!.end });
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
const cased = (tier: TierSpec, s: string) => (tier.casing === 'none' ? bare(s) : tier.casing === 'lower' ? bare(s).toLowerCase() : bare(s).toUpperCase());

const clamp = (x: number) => Math.min(Math.max(x, 0), 1);

type Ctx2D = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;
/** the font of the last `font()` call, applied as-is to offscreen layers (`ctx.font` reads back without the stretch) */
let face = { font: '', stretch: 'normal', spacing: '0px' };
function setFace(c: Ctx2D) {
  c.font = face.font;
  (c as unknown as { fontStretch: string }).fontStretch = face.stretch;
  (c as unknown as { letterSpacing: string }).letterSpacing = face.spacing;
}

/** cap height as a share of the em, per face; the cap of the last font() call */
const CAPS = new Map<string, number>();
let cap = 0.72;

function font(ctx: CanvasRenderingContext2D, tier: TierSpec, S: number, k = 1): number {
  // the face's own cap height (measured once per face): sizes are cap heights, so any font lands at the same size
  const id = `${tier.italic ? "italic " : ""}${tier.weight} "${tier.font}"`;
  if (!CAPS.has(id)) { face = { font: `${tier.italic ? "italic " : ""}${tier.weight} 100px "${tier.font}"`, stretch: tier.stretch ?? "normal", spacing: "0px" }; setFace(ctx); const a = ctx.measureText("H").actualBoundingBoxAscent; if (a > 0) CAPS.set(id, a / 100); }
  cap = CAPS.get(id) ?? 0.72;
  const px = (tier.size * S / cap) * k;
  face = { font: `${tier.italic ? "italic " : ""}${tier.weight} ${px}px "${tier.font}"`, stretch: tier.stretch ?? 'normal', spacing: `${tier.tracking * px}px` };
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
  const base = cy + px * cap / 2;
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
      const cx = wd / k / 2, cyw = base - px * cap / 2;
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
/**
 * Paint the caption for time `t` (s) on a W x H canvas that already holds the video frame. `scene.person`: the speaker
 * cut out of the same frame (video masked by a person matte); words of a tier marked `behind` are painted under it.
 * `scene.face`: the face box, which a stack card never covers.
 */
export function drawCaption(ctx: CanvasRenderingContext2D, p: PremiumPreset, list: Card[], t: number, W: number, H: number, scene: Scene = {}) {
  const c = list.find(c => t >= c.t0 && t < c.t1);
  if (!c) return;
  if (p.layout === 'stack') return drawStack(ctx, p, c, t, W, H, scene);
  const S = Math.min(W, H);
  const [t1, t2] = p.tiers;
  const h1 = c.lead.length ? t1.size * S : 0;
  const h2 = t2.size * S;
  const t3 = p.tiers[2] ?? t1;
  const h3 = c.tail.length ? t3.size * S : 0;
  const gap = c.lead.length ? p.gap * S : 0;
  const gap3 = c.tail.length ? p.gap * S : 0;
  const top = p.y * H - (h1 + gap + h2 + gap3 + h3) / 2;
  // the hold: the whole card settles slowly smaller while it is up (the reference's drift)
  const d = 1 + p.enter.drift * (t - c.t0);
  ctx.save();
  ctx.translate(W / 2, p.y * H); ctx.scale(d, d); ctx.translate(-W / 2, -p.y * H);
  tierLine(ctx, p, t1, c.lead, t, W, top + h1 / 2, S);
  tierLine(ctx, p, t2, c.key, t, W, top + h1 + gap + h2 / 2, S);
  tierLine(ctx, p, t3, c.tail, t, W, top + h1 + gap + h2 + gap3 + h3 / 2, S);
  ctx.restore();
}

/** The word onsets that get a Style 1 typing tick (one per word, the owner's rule in sfx-style1/map.json "word"). */
export function ticks(list: Card[]): number[] {
  return list.flatMap(c => [...c.lead, ...c.key, ...c.tail].map(w => w.t));
}

/** Where the speaker is, as shares of the frame (from a face detector and the person matte), for placement. */
export interface Scene { face?: { x: number; y: number; w: number; h: number } | null; person?: CanvasImageSource | null }

/** The anchor of a stack card, read once when the card starts (so the block never jumps while it holds). */
type Anchor = { cx: number; cy: number; span: number; face: { x: number; y: number; w: number; h: number } | null };
const ANCHORS = new Map<string, Anchor>();

/**
 * The stack (Premium Caption 3, ref c04): the highlighted word is the card. It is scaled to span the speaker's
 * shoulders and centred on the body at shoulder height, behind the speaker (a shiny negative of the frame), the way the
 * reel's "second" crosses behind the neck. Everything else is arranged around it: the words before it above, starting
 * at its left edge (pushed left if they would reach the face), the words after it below, right-aligned to its right
 * edge. Connectors are small, content words a middle size, in clean white Montserrat. Text never covers the face.
 * Each word slides up out of a blur as it is said; the card drifts slowly while it holds.
 */
function drawStack(ctx: CanvasRenderingContext2D, p: PremiumPreset, c: Card, t: number, W: number, H: number, scene: Scene) {
  const S = Math.min(W, H);
  const m = 0.04 * S;
  const [content, key] = p.tiers;
  const connector = p.tiers[2] ?? content;
  const hl = new Set(c.key);
  const isConnector = (w: Word) => { const b = bare(w.text).toLowerCase(); return b.length <= 3 || STOP.has(b); };

  // the anchor: the neck line, from the face box; the highlight spans about 3.2 face boxes, past the shoulders, so the
  // neck and shoulders cut into it but most of the word shows (as the reel's "second" behind the neck)
  const id = `${c.t0}|${W}x${H}`;
  let an = ANCHORS.get(id);
  if (!an) {
    const f = scene.face ?? null;
    an = f
      ? { cx: (f.x + f.w / 2) * W, cy: (f.y + f.h) * H - 0.08 * f.h * H, span: Math.min(W - 2 * m, f.w * W * 3.2), face: f }
      : { cx: W / 2, cy: p.y * H, span: W * 0.62, face: null };
    if (ANCHORS.size > 500) ANCHORS.clear();
    ANCHORS.set(id, an);
  }

  type Item = { w: Word; tier: TierSpec; text: string; px: number; cap: number; width: number; k: number };
  const item = (w: Word, k = 1): Item => {
    const tier = hl.has(w) ? key : isConnector(w) ? connector : content;
    const px = font(ctx, tier, S, k);
    const text = cased(tier, w.text);
    return { w, tier, text, px, cap, width: ctx.measureText(text).width, k };
  };
  const gapX = (l: Item) => l.px * 0.24;
  const widthOf = (line: Item[]) => line.reduce((a, l, i) => a + l.width + (i ? gapX(l) : 0), 0);
  const capOf = (line: Item[]) => Math.max(0, ...line.map(l => l.px * l.cap));

  // the highlight line, scaled so it spans the shoulders (never past the frame)
  const base = c.key.map(w => item(w));
  const kScale = c.key.length ? Math.max(0.6, Math.min(3, an.span / Math.max(1, widthOf(base)))) : 1;
  const keyLine = c.key.map(w => item(w, kScale));
  const pairs = (ws: Word[]) => { const out: Item[][] = []; for (let i = 0; i < ws.length; i += 2) out.push(ws.slice(i, i + 2).map(w => item(w))); return out; };
  const above = pairs(c.lead), below = pairs(c.tail);
  const lead = p.gap * S;
  const keyW = widthOf(keyLine), keyCap = capOf(keyLine);

  // vertical: the highlight's cap centred on the shoulder line, the rest stacked above and below, all kept in frame
  const aboveH = above.reduce((a, l) => a + capOf(l) + lead, 0), belowH = below.reduce((a, l) => a + lead + capOf(l), 0);
  let keyTop = an.cy - keyCap / 2;
  keyTop = Math.min(keyTop, H - m - belowH - keyCap);
  keyTop = Math.max(keyTop, m + aboveH);
  const keyLeft = Math.min(Math.max(an.cx - keyW / 2, m), W - m - keyW);

  type Placed = { items: Item[]; x: number; base: number };
  const placed: Placed[] = [];
  let y = keyTop - lead;
  for (let i = above.length - 1; i >= 0; i--) {
    const line = above[i]!, w = widthOf(line);
    let x = keyLeft;
    // never into the face: a line that would reach it moves left of it
    const f = an.face;
    if (f && x + w > f.x * W - m && y - capOf(line) < (f.y + f.h) * H + m && y > f.y * H - m) x = Math.max(m, f.x * W - m - w);
    placed.unshift({ items: line, x, base: y });
    y -= capOf(line) + lead;
  }
  if (keyLine.length) placed.push({ items: keyLine, x: keyLeft, base: keyTop + keyCap });
  y = keyTop + keyCap;
  for (const line of below) {
    y += lead + capOf(line);
    placed.push({ items: line, x: Math.max(m, keyLeft + keyW - widthOf(line)), base: y });
  }

  const r = p.enter;
  const drift = 1 + r.drift * (t - c.t0);
  ctx.save();
  ctx.translate(an.cx, an.cy); ctx.scale(drift, drift); ctx.translate(-an.cx, -an.cy);
  const draw = (behind: boolean) => placed.forEach(line => {
    let x = line.x;
    line.items.forEach((l, i) => {
      if (i) x += gapX(l);
      const e = t - l.w.t;
      if (e >= 0 && !!l.tier.behind === behind) {
        const k = 1 - Math.pow(1 - clamp(e / r.blurS), 3);
        const dy = (1 - k) * (r.rise ?? 0.04) * S;
        ctx.save();
        if (k < 1) ctx.filter = `blur(${(1 - k) * r.blur * S}px)`;
        font(ctx, l.tier, S, l.k); // each word in its own face and size (the layout pass left the last one set)
        if (l.tier.shiny) paintShiny(ctx, l.tier, l.text, x, line.base + dy, l.px, S, clamp(e / r.fadeS));
        else paintWord(ctx, l.tier, l.text, x, line.base + dy, l.px, S, clamp(e / r.fadeS));
        ctx.restore();
      }
      x += l.width;
    });
  });
  // the highlight behind the speaker, the speaker over it, the plain words in front
  draw(true);
  if (scene.person && placed.some(l => l.items.some(i => i.tier.behind && t >= i.w.t))) { ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.drawImage(scene.person, 0, 0, W, H); ctx.restore(); }
  draw(false);
  ctx.restore();
}

/**
 * The shiny negative (Premium Caption 3's highlight): inside the letters the frame is inverted (difference with
 * white), so the background decides the colour, then saturation and brightness are pushed to the bright side, so the
 * word reads as a shiny, transparent light blue, orange or green depending on what is behind it, with the video's
 * texture still moving inside. A light sheen runs over the top. Flat: no 3D, no perspective.
 */
function paintShiny(ctx: CanvasRenderingContext2D, tier: TierSpec, text: string, x: number, y: number, px: number, S: number, alpha: number) {
  const sh = tier.shiny!;
  const m = ctx.getTransform();
  const pad = Math.ceil(px * 0.2);
  const tw = ctx.measureText(text).width;
  // the word's box in canvas pixels (the stack only scales and translates)
  const bx = Math.floor(m.a * (x - pad) + m.e), by = Math.floor(m.d * (y - px - pad) + m.f);
  const bw = Math.ceil(m.a * (tw + pad * 2)), bh = Math.ceil(m.d * (px * 1.35 + pad * 2));
  if (bw < 2 || bh < 2) return;
  const o = new OffscreenCanvas(bw, bh), g = o.getContext('2d')!;
  // 1. the frame under the word, inverted: the background decides the colour
  g.drawImage(ctx.canvas, bx, by, bw, bh, 0, 0, bw, bh);
  g.globalCompositeOperation = 'difference';
  g.fillStyle = '#FFFFFF'; g.fillRect(0, 0, bw, bh);
  // 2. hue/saturation and brightness on the bright side: shiny, not muddy
  g.globalCompositeOperation = 'copy';
  g.filter = `saturate(${sh.saturate}) brightness(${sh.lift}) contrast(${sh.contrast})`;
  g.drawImage(o, 0, 0);
  g.filter = 'none';
  // 3. the sheen: a light band over the top of the letters
  const sg = g.createLinearGradient(0, pad * m.d, 0, (pad + px) * m.d);
  sg.addColorStop(0, `rgba(255,255,255,${sh.sheen})`); sg.addColorStop(0.5, 'rgba(255,255,255,0.05)'); sg.addColorStop(1, 'rgba(255,255,255,0)');
  g.globalCompositeOperation = 'screen';
  g.fillStyle = sg; g.fillRect(0, 0, bw, bh);
  // 4. kept only inside the letters
  g.globalCompositeOperation = 'destination-in';
  g.setTransform(m.a, 0, 0, m.d, 0, 0);
  setFace(g);
  g.fillStyle = '#FFFFFF';
  g.fillText(text, pad, pad + px);
  g.setTransform(1, 0, 0, 1, 0, 0);
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = alpha * sh.opacity;
  if (tier.shadow) { ctx.shadowColor = tier.shadow.color; ctx.shadowBlur = tier.shadow.blur * S * m.a; }
  ctx.drawImage(o, bx, by);
  ctx.restore();
}
