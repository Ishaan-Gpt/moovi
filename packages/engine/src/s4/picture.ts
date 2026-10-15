/**
 * Code-drawn Style 4 pictures. ONE model call per sentence (all sentences in parallel) writes a layered GREYSCALE
 * SVG cut-out made of that sentence's nouns (literal / fusion / scale shift / replacement / collection). The engine
 * then gives every picture the same material treatment with a fixed filter stack (law 1: unity comes from the
 * treatment), so the model only has to draw form and value:
 *   per layer  paper grain inside the shapes + relief light from the top left (diffuse + specular on the alpha bump)
 *   per cut    an irregular cut edge, a thin paper-white cut border, a contact shadow in the ink hue, and the tone
 *              map: luminance → ink / edge / top / mid / paper of the film's single-hue world
 * Each picture is validated deterministically in headless Chrome (parses, draws, fills a sensible part of its box,
 * has tonal detail, every opaque pixel inside the world hue) and the model gets one retry with the failure. The
 * accepted SVG is cached by hash (data/s4/cache); the full cut-out and each top-level layer are written as PNGs so
 * the player can turn and lift parts separately.
 */
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { chromium, type Browser } from 'playwright-core';
import { z } from 'zod';
import { config } from '../config';
import { ask, modelName } from '../runtime';
import { toneStops, type World } from './world';
import { byKey as libByKey, drawsWell, nearest as libNearest } from './library-pics';

export const KINDS = ['literal', 'fusion', 'scale-shift', 'replacement', 'collection'] as const;
export const MOVES = ['still', 'lift', 'turn', 'sway', 'spin'] as const;

export interface PictureSpec {
  kind: (typeof KINDS)[number]; idea: string; keys: string[]; coined: string; antagonist: boolean; orbit: boolean;
  layers: { id: string; move: (typeof MOVES)[number] }[]; svg: string;
  /** words the object carries (a sign, a ticket's title, a carved name): NEVER drawn in the SVG, set by the player in a real font */
  label?: string; labelBox?: number[];
}
/** A picture's words as a real text layer: `box` is [x, y, w, h] as fractions of the picture's square, `angle` in degrees. */
export interface PicLabel { text: string; box: [number, number, number, number]; angle: number }
export interface Picture extends PictureSpec { full: string; parts: { id: string; move: string; png: string }[]; stats: Stats; model: string; cached: boolean; seconds: number; labelAt: PicLabel | null }
interface Stats { ok: boolean; why: string; cover: number; bbox: [number, number, number, number]; lumStd: number; inHue: number; layers: string[]; glyphs?: number; texts?: number }

const V = 5; // prompt version: bump to invalidate the cache
const SIZE = 1000;

/* ───────────── the material: fixed filters, from the world ───────────── */
function defs(w: World, colour = false) {
  const st = toneStops(w).map(h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16) / 255));
  const tv = (c: number) => st.map(s => s[c]!.toFixed(3)).join(' ');
  const ink = w.ink, paper = w.paper;
  return `<defs>
<filter id="s4mat" x="-4%" y="-4%" width="108%" height="108%" color-interpolation-filters="sRGB">
 <feTurbulence type="fractalNoise" baseFrequency="0.95" numOctaves="2" seed="4" result="n"/>
 <feColorMatrix in="n" type="saturate" values="0" result="ng"/>
 <feComposite in="SourceGraphic" in2="ng" operator="arithmetic" k1="0" k2="1" k3="0.22" k4="-0.11" result="gr"/>
 <feTurbulence type="fractalNoise" baseFrequency="0.012 0.06" numOctaves="3" seed="9" result="fib"/>
 <feColorMatrix in="fib" type="saturate" values="0" result="fibg"/>
 <feComposite in="gr" in2="fibg" operator="arithmetic" k1="0" k2="1" k3="0.10" k4="-0.05" result="gr2"/>
 <feGaussianBlur in="SourceAlpha" stdDeviation="7" result="bump"/>
 <feDiffuseLighting in="bump" surfaceScale="5" diffuseConstant="1.12" lighting-color="#fff" result="dif"><feDistantLight azimuth="225" elevation="52"/></feDiffuseLighting>
 <feSpecularLighting in="bump" surfaceScale="6" specularConstant="0.55" specularExponent="22" lighting-color="#fff" result="spe"><feDistantLight azimuth="225" elevation="38"/></feSpecularLighting>
 <feComposite in="spe" in2="SourceAlpha" operator="in" result="spe2"/>
 <feBlend in="gr2" in2="dif" mode="multiply" result="lit"/>
 <feComposite in="lit" in2="spe2" operator="arithmetic" k1="0" k2="1" k3="0.55" k4="0" result="lit2"/>
 <feComposite in="lit2" in2="SourceAlpha" operator="in"/>
</filter>
<filter id="s4cut" x="-8%" y="-8%" width="116%" height="120%" color-interpolation-filters="sRGB">
 <feTurbulence type="fractalNoise" baseFrequency="0.045" numOctaves="2" seed="11" result="t"/>
 <feDisplacementMap in="SourceGraphic" in2="t" scale="6" xChannelSelector="R" yChannelSelector="G" result="g"/>
 <feComponentTransfer in="g" result="gc"><feFuncR type="linear" slope="1.12" intercept="-0.05"/><feFuncG type="linear" slope="1.12" intercept="-0.05"/><feFuncB type="linear" slope="1.12" intercept="-0.05"/></feComponentTransfer>
 <feColorMatrix in="gc" type="matrix" values="0.2126 0.7152 0.0722 0 0  0.2126 0.7152 0.0722 0 0  0.2126 0.7152 0.0722 0 0  0 0 0 1 0" result="l"/>
 ${colour ? '<feComponentTransfer in="gc" result="tone"><feFuncA type="identity"/></feComponentTransfer>' : `<feComponentTransfer in="l" result="tone"><feFuncR type="table" tableValues="${tv(0)}"/><feFuncG type="table" tableValues="${tv(1)}"/><feFuncB type="table" tableValues="${tv(2)}"/></feComponentTransfer>`}
 <feMorphology in="g" operator="dilate" radius="4.5" result="d"/>
 <feTurbulence type="fractalNoise" baseFrequency="0.11" numOctaves="1" seed="2" result="t2"/>
 <feDisplacementMap in="d" in2="t2" scale="4" xChannelSelector="R" yChannelSelector="G" result="d2"/>
 <feFlood flood-color="${paper}" result="pf"/><feComposite in="pf" in2="d2" operator="in" result="border"/>
 <feGaussianBlur in="d2" stdDeviation="3.5" result="cb"/><feOffset in="cb" dx="3" dy="6" result="co"/>
 <feFlood flood-color="${ink}" flood-opacity="0.55" result="cf"/><feComposite in="cf" in2="co" operator="in" result="contact"/>
 <feGaussianBlur in="d2" stdDeviation="11" result="sb"/><feOffset in="sb" dx="14" dy="20" result="so"/>
 <feFlood flood-color="${ink}" flood-opacity="0.32" result="sf"/><feComposite in="sf" in2="so" operator="in" result="cast"/>
 <feMerge><feMergeNode in="cast"/><feMergeNode in="contact"/><feMergeNode in="border"/><feMergeNode in="tone"/></feMerge>
</filter></defs>`;
}

/* ───────────── the browser: validate + rasterise ───────────── */
let browser: Promise<Browser> | null = null;
const getBrowser = () => (browser ??= chromium.launch({ headless: true, ...(config.chrome.path ? { executablePath: config.chrome.path } : { channel: config.chrome.channel }) }));
export async function closePictures() { if (browser) { const b = await browser; browser = null; await b.close().catch(() => undefined); } }

/** In the page: parse, wrap with the material, render the full cut-out and each layer; measure. */
const RASTER = async ([raw, defsXml, size, hue, photo]: [string, string, number, number, boolean]) => {
  const NS = 'http://www.w3.org/2000/svg';
  const doc = new DOMParser().parseFromString(raw, 'image/svg+xml');
  if (doc.querySelector('parsererror') || doc.documentElement.nodeName.toLowerCase() !== 'svg') return { error: 'the SVG does not parse as XML: ' + (doc.querySelector('parsererror')?.textContent ?? '').slice(0, 160) };
  const src = doc.documentElement;
  src.querySelectorAll(photo ? 'script,foreignObject,filter' : 'script,foreignObject,image,filter,use[href^="http"]').forEach(e => e.remove());
  const vb = (src.getAttribute('viewBox') ?? `0 0 ${size} ${size}`).trim();
  // NO LETTERING in a picture (a model's letters come out garbled: a tombstone reading "NERZ"): every <text> goes, and
  // letters drawn as shapes are found and removed: the marks (each sub-path's box, measured live with its transforms)
  // that touch are merged into glyph clusters; a run of >= 3 clusters in drawing order, letter-sized, similar height,
  // on one baseline, stepping left to right with letter gaps and NOT identical (stitches, teeth, hatching repeat
  // exactly; letters vary) is lettering. The words belong in the picture's label, set by the player in a real font.
  const texts = src.querySelectorAll('text,tspan,textPath').length;
  src.querySelectorAll('text').forEach(e => e.remove());
  let glyphs = 0, glyphErr = '';
  if (!photo) try {
    const cands = [...src.querySelectorAll('path,polygon,polyline,line')].filter(e => !e.closest('defs,clipPath,mask,pattern,marker,symbol'));
    cands.forEach((e, i) => e.setAttribute('data-gi', String(i)));
    const live = document.importNode(src, true) as unknown as SVGSVGElement; live.setAttribute('width', String(size)); live.setAttribute('height', String(size)); live.setAttribute('viewBox', vb);
    const host = document.createElement('div'); host.style.cssText = 'position:absolute;left:0;top:0'; host.appendChild(live); document.body.appendChild(host);
    const base = live.getBoundingClientRect();
    type Mark = { x0: number; y0: number; x1: number; y1: number; len: number; gi: number };
    const marks: Mark[] = [];
    for (const e of [...live.querySelectorAll('[data-gi]')] as SVGGeometryElement[]) {
      const gi = Number(e.getAttribute('data-gi')), m = e.getScreenCTM(); if (!m || !e.getTotalLength) continue;
      const total = e.getTotalLength(); if (!(total > 0)) continue;
      const k = Math.hypot(m.a, m.b) || 1, step = Math.max(1.2, total / 260); let cur: Mark | null = null, prev: DOMPoint | null = null, run = 0;
      for (let l = 0; l <= total + 1e-6; l += step) {
        const q = e.getPointAtLength(Math.min(l, total)).matrixTransform(m), x = q.x - base.left, y = q.y - base.top;
        // a jump much longer than the sampling step is a moveto: a new sub-path starts
        if (prev && Math.hypot(q.x - prev.x, q.y - prev.y) > step * k * 2.5) { if (cur) { cur.len = run; marks.push(cur); } cur = null; run = 0; }
        if (prev && cur) run += Math.hypot(q.x - prev.x, q.y - prev.y);
        if (!cur) cur = { x0: x, y0: y, x1: x, y1: y, len: 0, gi }; else { cur.x0 = Math.min(cur.x0, x); cur.y0 = Math.min(cur.y0, y); cur.x1 = Math.max(cur.x1, x); cur.y1 = Math.max(cur.y1, y); }
        prev = q;
      }
      if (cur) { cur.len = run; marks.push(cur); }
    }
    host.remove();
    // touching marks (the strokes of one letter, a letter and its counter) become one cluster, in drawing order
    type Cl = { x0: number; y0: number; x1: number; y1: number; len: number; gis: Set<number> };
    const cl: Cl[] = [];
    for (const k of marks) {
      const c = cl.at(-1), pad = 2;
      const small = (x0: number, y0: number, x1: number, y1: number) => Math.max(x1 - x0, y1 - y0) <= 0.2 * size;
      if (c && small(c.x0, c.y0, c.x1, c.y1) && small(Math.min(c.x0, k.x0), Math.min(c.y0, k.y0), Math.max(c.x1, k.x1), Math.max(c.y1, k.y1)) && k.x0 <= c.x1 + pad && k.x1 >= c.x0 - pad && k.y0 <= c.y1 + pad && k.y1 >= c.y0 - pad) { c.x0 = Math.min(c.x0, k.x0); c.y0 = Math.min(c.y0, k.y0); c.x1 = Math.max(c.x1, k.x1); c.y1 = Math.max(c.y1, k.y1); c.len += k.len; c.gis.add(k.gi); }
      else cl.push({ x0: k.x0, y0: k.y0, x1: k.x1, y1: k.y1, len: k.len, gis: new Set([k.gi]) });
    }
    const H = (c: Cl) => c.y1 - c.y0, Wd = (c: Cl) => c.x1 - c.x0;
    const letter = (c: Cl) => H(c) >= 0.014 * size && H(c) <= 0.17 * size && Wd(c) <= 1.5 * H(c);
    const follows = (a: Cl, b: Cl) => { const h = Math.max(H(a), H(b)), gap = b.x0 - a.x1;
      return h / Math.max(1e-3, Math.min(H(a), H(b))) <= 1.7 && Math.abs((a.y0 + a.y1) / 2 - (b.y0 + b.y1) / 2) <= 0.45 * h && gap >= -0.35 * h && gap <= 0.9 * h; };
    const cv = (v: number[]) => { const mu = v.reduce((a, b) => a + b, 0) / v.length; return mu ? Math.sqrt(v.reduce((a, b) => a + (b - mu) ** 2, 0) / v.length) / mu : 0; };
    const drop = new Set<number>();
    for (let i = 0; i < cl.length;) {
      if (!letter(cl[i]!)) { i++; continue; }
      let j = i + 1; while (j < cl.length && letter(cl[j]!) && follows(cl[j - 1]!, cl[j]!)) j++;
      const run = cl.slice(i, j);
      if (run.length >= 3 && run.filter(c => Wd(c) >= 0.3 * H(c)).length >= run.length / 2 && (cv(run.map(Wd)) > 0.12 || cv(run.map(c => c.len)) > 0.1)) { glyphs += run.length; run.forEach(c => c.gis.forEach(g => drop.add(g))); }
      i = j;
    }
    src.querySelectorAll('[data-gi]').forEach(e => { if (drop.has(Number(e.getAttribute('data-gi')))) e.remove(); else e.removeAttribute('data-gi'); });
  } catch (e) { glyphErr = String(e).slice(0, 200); src.querySelectorAll('[data-gi]').forEach(e => e.removeAttribute('data-gi')); }
  const cleaned = new XMLSerializer().serializeToString(src);
  // top-level layers: every <g id> child; loose shapes are gathered into a "base" layer
  const kids = [...src.children].filter(e => e.nodeName.toLowerCase() !== 'defs' && e.nodeName.toLowerCase() !== 'title' && e.nodeName.toLowerCase() !== 'desc');
  const userDefs = [...src.children].filter(e => e.nodeName.toLowerCase() === 'defs').map(e => e.innerHTML).join('');
  const layers: { id: string; xml: string }[] = []; let loose = '';
  for (const k of kids) {
    if (k.nodeName.toLowerCase() === 'g' && k.getAttribute('id')) { k.removeAttribute('filter'); layers.push({ id: k.getAttribute('id')!, xml: new XMLSerializer().serializeToString(k) }); }
    else loose += new XMLSerializer().serializeToString(k);
  }
  if (loose) layers.unshift({ id: 'base', xml: `<g id="base" xmlns="${NS}">${loose}</g>` });
  if (!layers.length) return { error: 'the SVG draws nothing' };
  const wrap = (only: number | null) => `<svg xmlns="${NS}" viewBox="${vb}" width="${size}" height="${size}">${defsXml}<defs>${userDefs}</defs><g filter="url(#s4cut)">` +
    layers.map((l, i) => only === null || only === i ? l.xml.replace(/^<g /, '<g filter="url(#s4mat)" ') : '').join('') + '</g></svg>';
  const draw = async (svg: string) => {
    const img = new Image(); img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svg)));
    await img.decode();
    const c = document.createElement('canvas'); c.width = size; c.height = size;
    const x = c.getContext('2d', { willReadFrequently: true })!; x.drawImage(img, 0, 0, size, size);
    return c;
  };
  // auto-levels: the lit object's own luminance range (2nd to 98th percentile) is stretched to the full tone map, so a
  // picture drawn in timid mid-greys still gets the refs' deep ink shadows and paper-white highlights (they are
  // photographs, ours were mid-blue mush). Measured on the material pass alone, before the cut filter.
  let defsUse = defsXml;
  try {
    const raw = await draw(`<svg xmlns="${NS}" viewBox="${vb}" width="${size}" height="${size}">${defsXml}<defs>${userDefs}</defs><g>` + layers.map(l => l.xml.replace(/^<g /, '<g filter="url(#s4mat)" ')).join('') + '</g></svg>');
    const q = document.createElement('canvas'); q.width = 200; q.height = 200; const qx = q.getContext('2d', { willReadFrequently: true })!; qx.drawImage(raw, 0, 0, 200, 200);
    const dd = qx.getImageData(0, 0, 200, 200).data, hist = new Array(256).fill(0); let cnt = 0;
    for (let i = 0; i < 200 * 200; i++) { if (dd[i * 4 + 3]! < 200) continue; hist[Math.round(0.2126 * dd[i * 4]! + 0.7152 * dd[i * 4 + 1]! + 0.0722 * dd[i * 4 + 2]!)]++; cnt++; }
    if (cnt > 400) {
      let acc = 0, lo = 0, hi = 255;
      for (let v = 0; v < 256; v++) { acc += hist[v]; if (acc >= cnt * 0.02) { lo = v; break; } }
      acc = 0; for (let v = 255; v >= 0; v--) { acc += hist[v]; if (acc >= cnt * 0.02) { hi = v; break; } }
      const L0 = lo / 255, L1 = hi / 255;
      if (L1 - L0 > 0.08 && L1 - L0 < 0.86) {
        const k = Math.min(3.2, 0.92 / (L1 - L0)), c = 0.04 - L0 * k;
        defsUse = defsXml.split('slope="1.12" intercept="-0.05"').join('slope="' + k.toFixed(3) + '" intercept="' + c.toFixed(3) + '"');
      }
    }
  } catch { /* measured without levels */ }
  const wrapL = (only: number | null) => wrap(only).replace(defsXml, defsUse);
  let full: HTMLCanvasElement;
  try { full = await draw(wrapL(null)); } catch (e) { return { error: 'the SVG does not render: ' + String(e).slice(0, 120) }; }
  // measure on a 250 px copy
  const s = 250, m = document.createElement('canvas'); m.width = s; m.height = s;
  const mx = m.getContext('2d', { willReadFrequently: true })!; mx.drawImage(full, 0, 0, s, s);
  const d = mx.getImageData(0, 0, s, s).data;
  let n = 0, x0 = s, y0 = s, x1 = -1, y1 = -1, sum = 0, sum2 = 0, inHue = 0, coloured = 0;
  for (let i = 0; i < s * s; i++) {
    const a = d[i * 4 + 3]!; if (a < 200) continue;
    const r = d[i * 4]! / 255, g = d[i * 4 + 1]! / 255, b = d[i * 4 + 2]! / 255;
    n++; const px = i % s, py = (i / s) | 0; if (px < x0) x0 = px; if (px > x1) x1 = px; if (py < y0) y0 = py; if (py > y1) y1 = py;
    const L = 0.2126 * r + 0.7152 * g + 0.0722 * b; sum += L; sum2 += L * L;
    const M = Math.max(r, g, b), mn = Math.min(r, g, b), dd = M - mn;
    if (dd / (M || 1) < 0.12) { inHue++; continue; }
    coloured++;
    let h = dd === 0 ? 0 : M === r ? ((g - b) / dd) % 6 : M === g ? (b - r) / dd + 2 : (r - g) / dd + 4; h = (h * 60 + 360) % 360;
    if (Math.min(Math.abs(h - hue), 360 - Math.abs(h - hue)) <= 30) inHue++;
  }
  const mean = n ? sum / n : 0, std = n ? Math.sqrt(Math.max(0, sum2 / n - mean * mean)) : 0;
  const parts: string[] = [];
  if (layers.length > 1) for (let i = 0; i < layers.length; i++) parts.push((await draw(wrapL(i))).toDataURL('image/png'));
  return { full: full.toDataURL('image/png'), parts, layers: layers.map(l => l.id), cover: n / (s * s), bbox: [x0 / s, y0 / s, (x1 + 1) / s, (y1 + 1) / s], lumStd: std, inHue: n ? inHue / n : 0, glyphs, texts, glyphErr, svg: cleaned };
};

export async function raster(svg: string, w: World, photo = false, colour = false) {
  const b = await getBrowser(), page = await b.newPage();
  try {
    await page.setContent('<!doctype html><html><body><script>window.__name = (f) => f;</script></body></html>');
    return await page.evaluate(RASTER as never, [svg, defs(w, colour), SIZE, w.hue, photo] as never) as { error?: string; full?: string; parts?: string[]; layers?: string[]; cover?: number; bbox?: [number, number, number, number]; lumStd?: number; inHue?: number; glyphs?: number; texts?: number; glyphErr?: string; svg?: string };
  } finally { await page.close().catch(() => undefined); }
}

export function judge(r: Awaited<ReturnType<typeof raster>>, colour = false): Stats {
  if (r.error) return { ok: false, why: r.error, cover: 0, bbox: [0, 0, 0, 0], lumStd: 0, inHue: 0, layers: [] };
  const [x0, y0, x1, y1] = r.bbox!, bw = x1 - x0, bh = y1 - y0;
  const why = r.glyphs ? `it has lettering drawn as shapes (${r.glyphs} letter-like marks in a row): a picture carries NO letters, numbers or words at all; leave that area blank and give the words in "label" with its "labelBox"`
    : r.cover! < 0.1 ? `it fills only ${(r.cover! * 100).toFixed(0)}% of its box (draw the object larger, about 70-85% of the box)`
    : bw < 0.4 && bh < 0.4 ? `its drawing spans only ${(bw * 100).toFixed(0)}% x ${(bh * 100).toFixed(0)}% of the box (draw it larger)`
    : x0 < 0.005 || y0 < 0.005 || x1 > 0.995 || y1 > 0.995 ? 'it touches the edge of the box (keep a 6% margin all round)'
    : !colour && r.inHue! < 0.97 ? 'it has colour outside the world hue (draw in greys only)' : '';
  return { ok: !why, why, cover: +r.cover!.toFixed(3), bbox: r.bbox!.map(v => +v.toFixed(3)) as Stats['bbox'], lumStd: +r.lumStd!.toFixed(3), inHue: +r.inHue!.toFixed(3), layers: r.layers!, glyphs: r.glyphs ?? 0, texts: r.texts ?? 0 };
}

/* ───────────── the model ───────────── */
const SYSTEM = `You draw ONE picture for one sentence of a Style 4 editorial essay reel, as SVG code: a real object made of the sentence's own nouns, like a studio still-life photo cut out of a magazine (never a flat icon, cartoon or toy).
- viewBox="0 0 1000 1000", transparent background, no floor/frame; the object fills 70-85% of the box, base near y=900, 6% margin.
- GREYS ONLY. The engine adds colour, grain, top-left relief light, cut edge and shadows: you draw FORM and VALUE.
- Value like a black-and-white product PHOTO: the full range on every object, from near-black (#0A0A0A-#222) core shadows and occlusion to near-white (#EEE-#FFF) highlights and edges; never a picture of mid-greys. Every surface gets a 3-5 stop gradient: near-black shadow lower right, bright top-left edge; specular streaks on glossy parts; dark occlusion where parts meet; 40-150 elements of material detail (seams, screws, weave, grain, folds, wear). Three-quarter view from slightly above.
- ONE clear silhouette that reads in one second at phone size: a recognisable real thing (a specific object the viewer owns or has seen) drawn with its REAL outline (curves, folds, seams, handles), big; never an abstract shape, blob, disc, slab, or a pile of plain boxes/cuboids (unless the thing is literally a box).
- NO LETTERING: never <text>, and never letters, numbers or words drawn as paths (they come out garbled). If the object carries words (a sign, a label, a ticket title, a carved name), leave that area BLANK (a clean flat panel) and return the words in "label" and that blank area in "labelBox"; the engine sets them in a real font.
- 2-5 top-level <g id="kebab-id"> layers; a part that should move (lid, hand, floating item) is its own layer. Gradients in a top <defs>. No <image>/<filter>/<script>/<text>/CSS. Under 5000 characters: concise path data, no comments.
Types: literal, fusion (two nouns as one object), scale-shift (tiny on giant), replacement (one part swapped for another noun), collection (6-12 small items). No cliches (lightbulb, handshake, chess, rocket, gears).`;

/** Dark Vox draws in COLOUR: a vintage paper-theatre prop in the set's own inks (the reference's cards, booths, frames
 *  and globes are full-colour engraved prints; a brand-hue tritone made every prop the same green). */
const SYSTEM_COLOUR = (palette: string[]) => SYSTEM
  .replace("for one sentence of a Style 4 editorial essay reel, as SVG code: a real object made of the sentence's own nouns, like a studio still-life photo cut out of a magazine (never a flat icon, cartoon or toy).",
    "for one line of a Dark Vox reel (a lit paper-theatre stage at night), as SVG code: a real object made of the line's own nouns, like a vintage engraved and hand-tinted print cut out of an old book, a playing card or a theatre programme (never a flat icon, cartoon or toy).")
  .replace('- GREYS ONLY. The engine adds colour, grain, top-left relief light, cut edge and shadows: you draw FORM and VALUE.',
    `- COLOUR, from these inks only (gradients between them, plus their mixes toward #FFFFFF / #231A18): ${palette.join(', ')}. The LAST ink is the loud one: on ONE part of the object only. Ink outlines and engraving hatches in #231A18. The engine adds grain, relief light, cut edge and shadows.`)
  .replace('- Value like a black-and-white product PHOTO:', '- Value like a hand-tinted engraving:');

const schema = {
  kind: z.enum(KINDS), idea: z.string().describe('one line: what the picture shows'),
  keys: z.array(z.string()).describe('the KEY words of the sentence exactly as written (nouns, verbs, numbers, names: 35-50% of the words)'),
  coined: z.string().describe("the film's coined term if THIS sentence says it, else empty"),
  antagonist: z.boolean().describe('true if the thing the essay argues against acts in this sentence'),
  orbit: z.boolean().describe('true only if the sentence is about turning, cycles or repetition'),
  layers: z.array(z.object({ id: z.string(), move: z.enum(MOVES) })).describe('one per top-level <g id>, same order'),
  svg: z.string().describe('the complete SVG (no <text>, no letters drawn as shapes)'),
  label: z.string().describe('the words the object carries (1-3 words copied from the sentence or the brand name), set later in a real font; empty if none'),
  labelBox: z.array(z.number()).describe('[x, y, w, h] in viewBox units of the blank area the label sits on; [] if no label'),
};

/** The last resort when no model answers in time: a taped paper print with the sentence's longest word engraved. */
function fallback(sentence: string): PictureSpec {
  const w = (sentence.match(/[A-Za-z]{4,}/g) ?? ['print']).sort((a, b) => b.length - a.length)[0]!.toUpperCase().slice(0, 12);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1000"><defs><linearGradient id="pp" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#f4f4f4"/><stop offset=".6" stop-color="#c9c9c9"/><stop offset="1" stop-color="#8a8a8a"/></linearGradient><linearGradient id="ph" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#5a5a5a"/><stop offset="1" stop-color="#1c1c1c"/></linearGradient></defs>
<g id="print"><path d="M170 230 L800 170 L840 850 L200 900 Z" fill="url(#pp)"/><path d="M220 280 L760 230 L790 700 L240 740 Z" fill="url(#ph)"/>${Array.from({ length: 14 }, (_, i) => `<path d="M${240 + i * 38} ${300 - i * 3} l${10 + (i % 3) * 6} 400" stroke="#777" stroke-width="2" opacity=".35"/>`).join('')}<path d="M300 770 L720 745 L726 842 L306 866 Z" fill="#e9e9e9"/></g>
<g id="tape"><rect x="420" y="135" width="190" height="60" fill="#e6e6e6" opacity=".85" transform="rotate(-6 515 165)"/></g></svg>`;
  return { kind: 'literal', idea: `fallback print: ${w}`, keys: (sentence.match(/[A-Za-z0-9]{5,}/g) ?? []), coined: '', antagonist: false, orbit: false, layers: [{ id: 'print', move: 'still' }, { id: 'tape', move: 'lift' }], svg, label: w, labelBox: [306, 752, 420, 104] };
}

/** Re-frame an SVG on its drawn bounds (square, 8 % margin): fixes "touches the edge" / "too small" without asking again. */
function reframe(svg: string, [x0, y0, x1, y1]: [number, number, number, number]): string {
  const vb = /viewBox="([-\d.\s,]+)"/.exec(svg)?.[1]?.trim().split(/[\s,]+/).map(Number) ?? [0, 0, SIZE, SIZE];
  const [vx, vy, vw, vh] = vb as [number, number, number, number];
  const cx = vx + (x0 + x1) / 2 * vw, cy = vy + (y0 + y1) / 2 * vh, side = Math.max((x1 - x0) * vw, (y1 - y0) * vh) * 1.16;
  const nvb = `${(cx - side / 2).toFixed(1)} ${(cy - side / 2).toFixed(1)} ${side.toFixed(1)} ${side.toFixed(1)}`;
  return /viewBox="[^"]*"/.test(svg) ? svg.replace(/viewBox="[^"]*"/, `viewBox="${nvb}"`) : svg.replace(/<svg\b/, `<svg viewBox="${nvb}"`);
}

const hash = (s: string) => createHash('sha1').update(s).digest('hex').slice(0, 16);
const STOP = new Set('that this with from what when where which their there they them have will would could should into about your just than then were been being does doing some only very more most such also over under after before while because across through using every each other another same different'.split(' '));
/** The sentence's content words (lower, de-pluralised): the cache matches pictures by these, not only by exact text. */
export const nouns = (s: string) => [...new Set((s.toLowerCase().match(/[a-z]{4,}/g) ?? []).filter(w => !STOP.has(w)).map(w => w.replace(/ies$/, 'y').replace(/([^s])s$/, '$1')))];
/** A sentence that needs the crew model: a fusion/contrast shape or many nouns. Simple object lines can go to the fast one. */
export const complex = (s: string) => /\b(like|instead|without|but|while|replac\w*|becom\w*|into|than|versus)\b/i.test(s) || nouns(s).length >= 7;

const INDEX = () => join(config.data, 's4', 'cache', 'index.json');
const readIndex = (): { nouns: string[]; key: string; sentence: string }[] => { try { return JSON.parse(readFileSync(INDEX(), 'utf8')); } catch { return []; } };
function indexAdd(sentence: string, key: string) { const ix = readIndex().filter(e => e.key !== key); ix.push({ nouns: nouns(sentence), key, sentence }); writeFileSync(INDEX(), JSON.stringify(ix)); }
export { byNouns };
/** A cached picture sharing the most content words (at least one of 5+ letters): the last resort before the fallback print. */
export function nearestCached(sentence: string): string | null {
  const n = nouns(sentence).filter(w => w.length >= 5); if (!n.length) return null;
  let best: string | null = null, bs = 0;
  for (const e of readIndex()) { const hit = n.filter(w => e.nouns.includes(w)).length; if (hit > bs && existsSync(join(config.data, 's4', 'cache', `${e.key}.json`))) { bs = hit; best = e.key; } }
  return best;
}
/** A cached picture for a sentence about the same things (>= 75 % of its content words, at least 2). */
function byNouns(sentence: string): string | null {
  const n = nouns(sentence); if (n.length < 2) return null;
  let best: string | null = null, bs = 0;
  for (const e of readIndex()) { const hit = n.filter(w => e.nouns.includes(w)).length, sc = hit / n.length; if (hit >= 2 && sc >= 0.75 && sc > bs) { bs = sc; best = e.key; } }
  return best;
}

/* ───────────── real people and archival moments: a photo print, not a drawing ───────────── */
/** Proper names in the sentence ("Satyajit Ray", "Albert Einstein"), never a capitalised opener alone. */
export function personOf(sentence: string): string | null {
  const m = [...sentence.matchAll(/\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)/g)].map(x => x[1]!).filter(n => !/^(The|In|By|But|When|Today|We|It|This|A|An)\b/.test(n));
  return m[0] ?? null;
}
const UA = { 'user-agent': 'Moovi-s4/0.1 (hackathon reel builder)' };
type PageInfo = { title: string; index: number; imageinfo?: { thumburl: string; thumbwidth: number; thumbheight: number; mime: string; descriptionurl: string; extmetadata?: Record<string, { value: string }> }[] };
/** One public-domain / CC photo from Wikimedia Commons for a name, within `ms`; licence and source kept. */
async function commonsPhoto(q: string, ms = 10_000): Promise<{ data: Buffer; w: number; h: number; meta: Record<string, string> } | null> {
  const sig = AbortSignal.timeout(ms);
  const api = `https://commons.wikimedia.org/w/api.php?action=query&format=json&generator=search&gsrnamespace=6&gsrlimit=8&gsrsearch=${encodeURIComponent(`${q} filetype:bitmap`)}&prop=imageinfo&iiprop=url|size|mime|extmetadata&iiurlwidth=900`;
  const j = await fetch(api, { headers: UA, signal: sig }).then(r => r.json()).catch(() => null) as { query?: { pages?: Record<string, PageInfo> } } | null;
  const pages = Object.values(j?.query?.pages ?? {}).sort((a, b) => a.index - b.index);
  for (const p of pages) {
    const ii = p.imageinfo?.[0]; if (!ii || !/jpeg|png/.test(ii.mime)) continue;
    const lic = ii.extmetadata?.LicenseShortName?.value ?? '';
    if (!/public domain|^pd|cc/i.test(lic)) continue;
    const data = await fetch(ii.thumburl, { headers: UA, signal: sig }).then(r => r.arrayBuffer()).then(b => Buffer.from(b)).catch(() => null);
    if (!data) continue;
    const strip = (v?: string) => (v ?? '').replace(/<[^>]+>/g, '').trim().slice(0, 200);
    return { data, w: ii.thumbwidth, h: ii.thumbheight, meta: { query: q, title: p.title, image: ii.thumburl, source: ii.descriptionurl, license: lic, artist: strip(ii.extmetadata?.Artist?.value), credit: strip(ii.extmetadata?.Credit?.value) } };
  }
  return null;
}
/** The photo as a taped archival print (paper border, slight tilt): the skill's rule for archival photos. */
function printSvg(data: Buffer, w: number, h: number, mime: string) {
  const k = Math.min(700 / w, 720 / h), pw = w * k, ph = h * k, b = 26, x = (1000 - pw) / 2, y = 905 - ph - b;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1000"><g id="print" transform="rotate(-3 500 ${y + ph / 2})"><rect x="${x - b}" y="${y - b}" width="${pw + 2 * b}" height="${ph + 2 * b}" fill="#f1f1f1"/><image x="${x}" y="${y}" width="${pw}" height="${ph}" preserveAspectRatio="xMidYMid slice" href="data:${mime};base64,${data.toString('base64')}"/></g><g id="tape"><rect x="${500 - 85}" y="${y - b - 26}" width="170" height="54" fill="#e2e2e2" opacity=".85" transform="rotate(-7 500 ${y - b})"/></g></svg>`;
}
const keysOf = (s: string) => s.split(/\s+/).filter(w => /\d/.test(w) || (/^[A-Z][a-z]/.test(w) && !/^(The|In|By|But|When|We|It|A|An)$/.test(w.replace(/\W/g, ''))) || w.replace(/\W/g, '').length >= 6);

export interface Plan { noun: string; picture: string; kind: (typeof KINDS)[number]; key?: string; label?: string }
const headOf = (n: string) => n.toLowerCase().replace(/[^a-z ]/g, '').trim().split(/\s+/).pop()!.replace(/s$/, '');
/** The variety rule, checked deterministically: no object twice in a row, none more than twice a film. */
export function varietyErrors(plans: Plan[]): string {
  const errs: string[] = [], count = new Map<string, number[]>();
  plans.forEach((p, i) => { const h = headOf(p.noun); count.set(h, [...(count.get(h) ?? []), i + 1]); if (i && headOf(plans[i - 1]!.noun) === h) errs.push(`pictures ${i} and ${i + 1} are both a ${h}`); });
  for (const [h, at] of count) if (at.length > 2) errs.push(`"${h}" is used ${at.length} times (pictures ${at.join(', ')}); at most twice a film`);
  return errs.join('; ');
}
/** Shapes that show nothing ("Patagonia treats…" came out as a pile of boxes): banned as a picture's object unless the sentence itself names them. */
export const GENERIC_SHAPES = ['box', 'boxes', 'cube', 'cubes', 'cuboid', 'crate', 'crates', 'carton', 'container', 'package', 'parcel', 'block', 'blocks', 'blob', 'blobs', 'disc', 'disk', 'orb', 'sphere', 'slab', 'cylinder', 'pyramid', 'shape', 'shapes', 'abstract', 'geometric', 'tile', 'tiles', 'tin', 'token', 'icon', 'symbol'];
const stem = (w: string) => w.toLowerCase().replace(/[^a-z]/g, '').replace(/(es|s)$/, '');
/** The idea check, deterministic: no generic shape the sentence does not name, and the key noun really is the sentence's. */
export function ideaErrors(plans: Plan[], sentences: string[]): string {
  const errs: string[] = [];
  plans.forEach((p, i) => {
    const said = new Set((sentences[i] ?? '').toLowerCase().match(/[a-z]+/g)?.map(stem) ?? []);
    const bad = GENERIC_SHAPES.filter(g => new RegExp(`\\b${g}\\b`, 'i').test(`${p.noun} ${p.picture}`) && !said.has(stem(g)));
    if (bad.length) errs.push(`picture ${i + 1} ("${p.picture}") uses a generic ${bad.join('/')}: show one specific, recognisable real object instead`);
    if (p.key && !(p.key.toLowerCase().match(/[a-z]+/g) ?? []).some(w => said.has(stem(w)))) errs.push(`picture ${i + 1}: key "${p.key}" is not a word of its sentence ("${sentences[i]}"): copy the sentence's key noun`);
  });
  return errs.join('; ');
}
const planItem = (n: number) => z.array(z.object({
  key: z.string().describe("the sentence's key noun (or noun phrase), copied from the sentence: what the picture SHOWS"),
  noun: z.string().describe('the main object drawn, 1-2 words'), picture: z.string().describe('one line: what to draw'), kind: z.enum(KINDS),
  label: z.string().describe('words ON the object (a sign, a ticket title, a carved name), 1-3 words copied from the sentence; set later in a real font, never drawn; usually empty'),
})).describe(`exactly ${n} entries, in order`);

/** One cheap pass over ALL sentences first: each sentence's picture, planned together so objects never repeat back to back
 *  or more than twice a film; the coined term's sentence gets one single clear hero object. The idea step: one clear,
 *  specific, recognisable HERO object per beat that SHOWS the sentence's key noun, the brand's own product category
 *  first; a deterministic check bans generic shapes and checks the key noun, with one re-ask. */
export async function planPictures(sentences: string[], coined: string, style: 's4' | 'darkvox' = 's4', brand = ''): Promise<Plan[] | null> {
  if (style === 'darkvox') return planDarkVox(sentences);
  const prompt = `${brand ? `Brand: ${brand}\n` : ''}${coined ? `Coined term: "${coined}". Its sentence gets ONE single, clear, instantly readable object (hero size, no second object).\n` : ''}Plan one picture per sentence of this Style 4 essay reel. Each picture is ONE clear, specific, recognisable HERO object that SHOWS that sentence's key noun, readable in 1 second with the sound off, like a magazine cut-out photo: a worn leather loafer, a brass compass, a stack of receipts, a phone showing a cart. When the sentence is about the brand, its customer or its craft, the hero is the brand's REAL product category (for an outdoor-clothing brand: a jacket, a fleece, a boot, a pack; for a coffee brand: a cup, a bag of beans) doing what the sentence says (a repair = that jacket with a sewn patch, needle and thread). Fusions / scale shifts / replacements / collections are made of the sentence's own nouns. Never a generic shape (${GENERIC_SHAPES.slice(0, 14).join(', ')}…) unless the sentence names it, and never a symbol standing for an idea. No words in the picture: if the object needs words (a sign, a label), give them in label. Mix the kinds (at most two literals in a row; at least one fusion and one scale shift in the film). Vary the objects: never the same main object in two consecutive pictures, and no main object more than twice in the film. No cliches (lightbulb, handshake, chess, rocket, gears).\n\n${sentences.map((t, i) => `${i + 1}. ${t}`).join('\n')}`;
  let asked = false;
  try {
    // the creative step (what each line SHOWS) is the crew model's; the fast model only if the crew is out
    const go = (tier: 'crew' | 'fast', ms: number) => ask({ agent: 's4-plan', tier, deadlineMs: ms, maxTurns: 3, quick: true, system: 'You are the picture planner (art director) of a Style 4 editorial metaphor essay reel: every line becomes one real, photographable hero object that shows its key noun.', prompt,
      schema: { pictures: planItem(sentences.length) },
      validate: x => {
        if (x.pictures.length !== sentences.length) return `give exactly ${sentences.length} pictures, one per sentence`;
        const v = varietyErrors(x.pictures); if (v) return v;
        if (asked) return null; // the idea check re-asks ONCE; the second answer is taken
        const e = ideaErrors(x.pictures, sentences); if (!e) return null;
        asked = true; console.warn(`  picture plan: ${e.slice(0, 160)}; re-asked once`); return `${e}. Fix those pictures (keep the rest).`;
      } });
    const a = await go('crew', 50_000).catch(e => { console.warn(`picture plan on ${modelName('crew')} failed (${String(e).slice(0, 80)}); ${modelName('fast')}`); asked = false; return go('fast', 35_000); });
    return a.pictures;
  } catch (e) { console.warn(`picture plan failed (${String(e).slice(0, 80)}); drawing without it`); return null; }
}

/** Dark Vox's props, planned together: a vintage paper-theatre object per line, never the same object twice in a row or
 *  more than twice a film, and none of the stock symbols (the first Duolingo film showed a padlock four times). */
async function planDarkVox(lines: string[]): Promise<Plan[] | null> {
  const prompt = `Plan one prop per line of this Dark Vox reel (a fable told on a lit paper-theatre stage at night). Each prop is a REAL, specific object made of THAT line's own nouns, drawn like a vintage engraved print cut out of an old book: a theatre ticket, a tarot card, a brass telescope, a pocket watch, a postcard, a gramophone, a globe on a stand, an old radio, a ticket booth, a framed portrait, a hand holding a letter. Readable in one second at phone size. Never a stock symbol (lightbulb, padlock, key, trophy, handshake, chess piece, rocket, gears, target, magnifying glass, question mark) and never an abstract shape. No words drawn in the prop: if it carries words (a sign, a ticket's title, a carved name), give 1-3 words copied from the line in label (set later in a real font), else leave label empty. Vary them: never the same main object in two consecutive lines, no main object more than twice.\n\n${lines.map((t, i) => `${i + 1}. ${t}`).join('\n')}`;
  const go = (tier: 'crew' | 'fast', ms: number) => ask({ agent: 'darkvox-props', tier, deadlineMs: ms, maxTurns: 3, quick: true, system: 'You are the prop master of a Dark Vox reel: every line gets one vintage paper-theatre prop made of its own nouns.', prompt,
    schema: { pictures: planItem(lines.length) },
    validate: x => x.pictures.length !== lines.length ? `give exactly ${lines.length} props, one per line` : (varietyErrors(x.pictures) || (x.pictures.find(p => /\b(light ?bulb|padlock|lock|key|trophy|handshake|chess|rocket|gear|target|magnifying)\b/i.test(p.noun)) ? 'no stock symbols (lightbulb, padlock, key, trophy, handshake, chess, rocket, gears, target, magnifier): pick a specific vintage object instead' : null)) });
  try { return (await go('crew', 40_000).catch(() => go('fast', 30_000))).pictures; }
  catch (e) { console.warn(`prop plan failed (${String(e).slice(0, 80)}); drawing without it`); return null; }
}

/** Draw (or, for a real person, fetch a photo print), validate (one retry with the failure) and rasterise one sentence's picture. */
export async function drawPicture(o: { sentence: string; script: string; coined?: string; world: World; out: string; index: number; avoid?: string; deadlineMs?: number; photos?: boolean; plan?: Plan; hero?: boolean; nounCache?: boolean; palette?: string[]; prior?: boolean;
  /** library-first (a model that does not draw well, ./library-pics.ts): the library picture assigned to this sentence, if any */
  library?: string | null; libraryFirst?: boolean; libraryAvoid?: Set<string> }): Promise<Picture> {
  const colour = !!o.palette?.length;
  const t0 = Date.now(), cdir = join(config.data, 's4', 'cache'); mkdirSync(cdir, { recursive: true }); mkdirSync(o.out, { recursive: true });
  const png = (d: string, f: string) => { writeFileSync(join(o.out, f), Buffer.from(d.split(',')[1]!, 'base64')); return f; };
  const who = o.photos === false ? null : personOf(o.sentence);
  if (who) {
    const ph = await commonsPhoto(who).catch(() => null);
    if (ph) {
      const mime = ph.data[0] === 0x89 ? 'image/png' : 'image/jpeg', r = await raster(printSvg(ph.data, ph.w, ph.h, mime), o.world, true), stats = judge(r);
      if (!r.error && r.full) {
        writeFileSync(join(o.out, `p${o.index}.source.json`), JSON.stringify(ph.meta, null, 1));
        const ids = r.layers ?? [], parts = (r.parts ?? []).map((d, i) => ({ id: ids[i]!, move: ids[i] === 'tape' ? 'lift' : 'still', png: png(d, `p${o.index}-${i}.png`) }));
        const coined = o.coined && o.sentence.toLowerCase().includes(o.coined.toLowerCase()) ? o.coined : '';
        return { kind: 'literal', idea: `photo print: ${ph.meta.title} (${ph.meta.license})`, keys: keysOf(o.sentence), coined, antagonist: false, orbit: false, layers: [{ id: 'print', move: 'still' }, { id: 'tape', move: 'lift' }], svg: '(photo print)', full: png(r.full, `p${o.index}.png`), parts, stats, model: 'photo', cached: false, seconds: +((Date.now() - t0) / 1000).toFixed(1), labelAt: null };
      }
    }
    console.warn(`  pic ${o.index + 1}: no photo for "${who}" in 10 s; drawing it`);
  }
  // the cache: this exact sentence (this or the earlier prompt version), else a sentence about the same nouns
  const key = hash(`${V}|${colour ? `colour:${o.palette!.join(',')}|` : ''}${o.sentence}|${o.coined ?? ''}|${o.plan?.picture ?? ''}`), legacy = hash(`3|${o.sentence}|${o.script}|${o.coined ?? ''}`);
  const exact = [key, ...(colour ? [] : [legacy])].find(k => existsSync(join(cdir, `${k}.json`))), hitKey = exact ?? (o.nounCache === false || colour ? null : byNouns(o.sentence));
  let spec: PictureSpec | null = hitKey && existsSync(join(cdir, `${hitKey}.json`)) ? JSON.parse(readFileSync(join(cdir, `${hitKey}.json`), 'utf8')) : null;
  if (spec && !exact) spec = { ...spec, keys: keysOf(o.sentence), coined: '' }; // a noun match: its picture, this sentence's words
  // a re-run (--reuse) keeps the picture this film already drew, through the same checks (lettering is drawn again)
  const priorSvg = join(o.out, `p${o.index}.svg`);
  if (!spec && o.prior && existsSync(priorSvg)) {
    const side = (() => { try { return JSON.parse(readFileSync(join(o.out, `p${o.index}.label.json`), 'utf8')) as { label?: string; labelBox?: number[] } | null; } catch { return null; } })();
    spec = { kind: 'literal', idea: '(reused: drawn earlier for this film)', keys: keysOf(o.sentence), coined: '', antagonist: false, orbit: false, layers: [], svg: readFileSync(priorSvg, 'utf8'), label: side?.label ?? '', labelBox: side?.labelBox ?? [] };
  }
  // library-first: the library picture assigned to this sentence (its picture, this sentence's words)
  let fromLib = false;
  if (!spec && o.libraryFirst && !colour && o.library) { const p = libByKey(o.library); if (p) { spec = { kind: p.kind, idea: p.idea, keys: keysOf(o.sentence), coined: '', antagonist: p.antagonist, orbit: p.orbit, layers: p.layers, svg: p.svg, label: p.label, labelBox: p.labelBox }; fromLib = true; } }
  const cached = !!spec;
  let r: Awaited<ReturnType<typeof raster>> | null = null, stats: Stats | null = null, model = cached ? (fromLib ? 'library' : exact ? 'cache' : hitKey ? 'cache-nouns' : 'reuse') : '';
  // a cached picture drawn before the no-lettering rule (a <text>, or letters as shapes) is drawn again
  if (spec && /<text\b/i.test(spec.svg)) { console.warn(`  pic ${o.index + 1}: cached picture has lettering; redrawing`); spec = null; }
  if (spec) { r = await raster(spec.svg, o.world, false, colour); stats = judge(r, colour); if (!stats.ok) { console.warn(`  pic ${o.index + 1}: cached picture rejected (${stats.why.slice(0, 70)}); redrawing`); spec = null; } }
  let feedback = '';
  // the crew model draws every picture (fast models' drawings read as clip-art: blobs, discs, slabs); the fast one is the fallback
  const hard = complex(o.sentence), first = 'crew' as const, second = 'fast' as const, name = (t: 'crew' | 'fast') => modelName(t);
  // library-first models draw once (the library stands in if that drawing fails); Claude gets a second try
  const tries = o.libraryFirst && !colour ? 1 : 2;
  for (let attempt = 0; !spec && attempt < tries; attempt++) {
    const prompt = `${o.coined ? `The film's coined term: "${o.coined}".\n` : ''}Sentence: "${o.sentence}"${o.plan ? `\nPlanned picture (draw exactly this, ${o.plan.kind}): ${o.plan.picture}${o.plan.label ? `\nIts words "${o.plan.label}" are set later in a real font: leave a clean blank panel for them; return them in label and the panel in labelBox.` : ''}` : ''}${o.hero ? '\nThis is the coined term: ONE single clear object, filling 85% of the box, nothing else.' : ''}${o.avoid ? `\nPrevious picture was a ${o.avoid}; prefer another type.` : ''}${feedback}\nDraw it and submit.`;
    const call = (tier: 'crew' | 'fast', ms: number) => ask({ agent: 's4-picture', tier, deadlineMs: ms, maxTurns: 2, quick: true, system: colour ? SYSTEM_COLOUR(o.palette!) : SYSTEM, prompt, schema });
    let a: PictureSpec;
    try { a = await call(first, o.deadlineMs ?? (hard ? 95_000 : 80_000)); model = name(first); }
    catch (e) {
      console.warn(`  pic ${o.index + 1}: ${name(first)} failed (${String(e).slice(0, 60)}); ${name(second)}`);
      try { a = await call(second, 60_000); model = name(second); }
      catch { console.warn(`  pic ${o.index + 1}: both failed; the drawn fallback (a taped print)`); a = fallback(o.sentence); model = 'fallback'; }
    }
    r = await raster(a.svg, o.world, false, colour); stats = judge(r, colour);
    // what is kept is the checker's copy: every <text> and any lettering drawn as shapes taken out
    if (r.svg) { if (r.texts) console.log(`  pic ${o.index + 1}: ${r.texts} <text> element(s) stripped`); a = { ...a, svg: r.svg }; }
    if (!stats.ok && /edge|fills only|spans only/.test(stats.why) && !r.error) { a = { ...a, svg: reframe(a.svg, r.bbox!) }; r = await raster(a.svg, o.world, false, colour); stats = judge(r, colour); if (stats.ok) console.log(`  pic ${o.index + 1}: re-framed deterministically`); }
    // a drawing is kept in the cache with who drew it: only a strong drawer's pictures ever join the library
    if (stats.ok) { spec = a; if (model !== 'fallback') { writeFileSync(join(cdir, `${key}.json`), JSON.stringify({ ...a, strong: drawsWell() })); indexAdd(o.sentence, key); } }
    else {
      feedback = `\nYour previous SVG was rejected by the checker: ${stats.why}. Fix that.`; console.warn(`  pic ${o.index + 1}: rejected (${stats.why}); ${attempt + 1 >= tries ? 'giving up' : 'retrying once'}`);
      // library-first: a failed drawing gives way to the closest library picture (never a stick figure)
      if (attempt + 1 >= tries && o.libraryFirst && !colour) {
        const near = libNearest(o.sentence, o.plan, o.libraryAvoid ?? new Set());
        const nr = near ? await raster(near.svg, o.world, false, colour) : null, ns = nr ? judge(nr, colour) : null;
        if (near && nr && ns?.ok) { o.libraryAvoid?.add(near.key); spec = { ...near, keys: keysOf(o.sentence), coined: '' }; r = nr; stats = ns; model = 'library-near'; console.warn(`  pic ${o.index + 1}: the closest library picture instead (${near.idea.slice(0, 60)})`); continue; }
      }
      if (attempt + 1 >= tries) {
        // a weak model's drawing failed twice: the nearest cached picture about the same things (greyscale styles), else
        // its own drawing if it at least renders, else the drawn fallback print: never an empty or broken frame
        const near = colour ? null : nearestCached(o.sentence);
        const alt = near ? JSON.parse(readFileSync(join(cdir, `${near}.json`), 'utf8')) as PictureSpec : null;
        const ar = alt ? await raster(alt.svg, o.world, false, colour) : null, as = ar ? judge(ar, colour) : null;
        if (alt && ar && as?.ok) { spec = { ...alt, keys: keysOf(o.sentence), coined: '' }; r = ar; stats = as; model = 'cache-near'; console.warn(`  pic ${o.index + 1}: the nearest cached picture instead`); }
        else if (!r.error && r.full) spec = a;
        else { spec = fallback(o.sentence); model = 'fallback'; r = await raster(spec.svg, o.world, false, colour); stats = judge(r, colour); }
      }
    }
  }
  if (!spec || !r || r.error || !r.full) throw new Error(`picture ${o.index + 1} failed: ${stats?.why}`);
  if (exact === legacy && !existsSync(join(cdir, `${key}.json`))) { writeFileSync(join(cdir, `${key}.json`), JSON.stringify(spec)); indexAdd(o.sentence, key); }
  const full = png(r.full, `p${o.index}.png`);
  writeFileSync(join(o.out, `p${o.index}.svg`), spec.svg);
  const ids = r.layers ?? [];
  const parts = (r.parts ?? []).map((d, i) => ({ id: ids[i]!, move: spec!.layers.find(l => l.id === ids[i])?.move ?? 'still', png: png(d, `p${o.index}-${i}.png`) }));
  const labelAt = placeLabel(spec, `${o.sentence} ${o.script} ${model === 'fallback' ? spec.label ?? '' : ''}`);
  writeFileSync(join(o.out, `p${o.index}.label.json`), JSON.stringify({ label: spec.label ?? '', labelBox: spec.labelBox ?? [], labelAt }));
  return { ...spec, full, parts, stats: stats!, model, cached, seconds: +((Date.now() - t0) / 1000).toFixed(1), labelAt };
}

/**
 * The picture's words as a text layer: its label (only words the voice-over really says, at most 3 words / 24
 * characters: never a model's invented name) on its blank panel, as fractions of the picture's final square (the
 * viewBox may have been re-framed). A missing or degenerate box puts it on the lower third of the object.
 */
export function placeLabel(spec: Pick<PictureSpec, 'label' | 'labelBox' | 'svg'>, said: string): PicLabel | null {
  const text = (spec.label ?? '').replace(/[“”"]/g, '').replace(/\s+/g, ' ').trim();
  if (!text || text.split(' ').length > 3 || text.length > 24) return null;
  const heard = new Set(said.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? []);
  if (!(text.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? []).every(w => heard.has(w))) return null;
  const vb = /viewBox="([-\d.\s,]+)"/.exec(spec.svg)?.[1]?.trim().split(/[\s,]+/).map(Number) ?? [0, 0, SIZE, SIZE];
  const [vx, vy, vw, vh] = vb as [number, number, number, number], side = Math.max(vw, vh), ox = vx - (side - vw) / 2, oy = vy - (side - vh) / 2;
  const lb = spec.labelBox ?? [];
  const b = lb.length === 4 && lb.every(Number.isFinite) && lb[2]! > 20 && lb[3]! > 10 ? lb : [vx + vw * 0.25, vy + vh * 0.62, vw * 0.5, vh * 0.12];
  const f = (v: number, o0: number) => +((v - o0) / side).toFixed(4);
  const box: PicLabel['box'] = [f(b[0]!, ox), f(b[1]!, oy), +(b[2]! / side).toFixed(4), +(b[3]! / side).toFixed(4)];
  if (box[0] < -0.05 || box[1] < -0.05 || box[0] + box[2] > 1.05 || box[1] + box[3] > 1.05) return null;
  return { text, box, angle: 0 };
}
