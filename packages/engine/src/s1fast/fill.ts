import { config } from '../config';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { z } from 'zod';
import { s1kit } from '@contenteasy/skills';
import { fill, loadTemplates, templateIndex, type MediaSlot, type SlotValues, type Template } from '@contenteasy/library/style-1/templates';
import { describe } from '../render/qa';
import { ask, modelName, modelScope, nearestEnum } from '../runtime';
import { brandJson, emptyProps, fitToFrame, planOf, qa, writeOut, type KitExtra } from './make';
import type { Op, Scene, Storyboard, Word } from './planner';

/**
 * The template filler: the owner's own proven scenes (library/style-1/templates), chosen and filled in ONE model call.
 * words + brief → { scene split, template id, slot values } → lint (one bounce at most) → fill() with the owner's type
 * scale kept → runPlan → fitToFrame → geometry QA → a failing scene is first re-set tighter, and only then becomes a
 * plain title (never two plain titles that look alike). No per-scene model calls.
 */

type Obj = Record<string, any>;

/** The pictures a website brand has: its desktop page, its own phone layout, its mark. */
export interface Media { site: string | null; mobile?: string | null; logo?: string | null }

const TEXT_PRESETS = new Set(['lines', 'list_left', 'stack_slam']);
const TEXT_ELS = new Set(['ln', 'serif', 'accent']);
const BOXES = new Set(['panel', 'receipt', 'chat', 'note', 'reach']), ROWS = new Set(['row', 'rline', 'panel', 'receipt', 'chat', 'note', 'reach']);
/** Drawn layers that dress a scene but show nothing: a scene whose only picture is one of these reads as empty. */
const DECOR = new Set(['asterisk', 'marker', 'zzz', 'sky', 'brackets', 'ring', 'sparkle']);
/** The scene's hero visual: a preset that draws one, or ≥1 non-text layer of real size (≥ 250×250 px, or any kit element). */
export function hasHero(t: Template): boolean {
  if (!TEXT_PRESETS.has(t.preset)) return true;
  let hero = false;
  const walk = (v: unknown): void => {
    if (hero || !v || typeof v !== 'object') return;
    if (Array.isArray(v)) { v.forEach(walk); return; }
    const o = v as Obj;
    if (typeof o.$el === 'string' && !TEXT_ELS.has(o.$el) && o.$el !== 'burst') hero = true;
    else if (o.kind === 'carousel' || o.kind === 'image' && (typeof o.w !== 'number' || typeof o.h !== 'number' || o.w * o.h >= 250 * 250) && !DECOR.has(o.draw)) hero = true;
    Object.values(o).forEach(walk);
  };
  walk(t.ops);
  return hero;
}
/** A panel/receipt/chat must show ≥ 2 filled rows: a box with fewer content slots reads as an empty frame. */
export function denseEnough(t: Template): boolean {
  if (!t.props.some(p => BOXES.has(p))) return true;
  return t.slots.content.filter(s => ROWS.has(s.prop)).length >= 2;
}

/** The width of the layer that shows a media slot (an `image.src` 170 px wide is an icon, 900 px wide is a picture). */
function slotWidth(t: Template, id: string): number | null {
  let w: number | null = null;
  const walk = (v: unknown): void => {
    if (w !== null || !v || typeof v !== 'object') return;
    if (Array.isArray(v)) { v.forEach(walk); return; }
    const o = v as Obj;
    if (Object.values(o).some(x => x && typeof x === 'object' && (x as Obj).$M === id)) { w = typeof o.w === 'number' ? o.w : 0; return; }
    Object.values(o).forEach(walk);
  };
  walk(t.ops);
  return w;
}
/**
 * Which of the brand's pictures a media slot shows: a phone shows the site's PHONE layout (never a desktop page squeezed
 * into a portrait screen), a laptop/browser/card the desktop page, a mark/notification icon or a small image the logo.
 * null = this brand has nothing that belongs there (the template is not eligible).
 */
export function pictureFor(t: Template, s: MediaSlot, m: Media): string | null {
  if (/^phone\.(src|screen)$/.test(s.as)) return m.mobile ?? m.site;
  if (/^(card|browser|laptop)\.src$/.test(s.as)) return m.site;
  if (s.as === 'image.src') return (slotWidth(t, s.id) ?? 0) >= 400 ? m.site : m.logo ?? null;
  if (s.as === 'mark.src' || s.as === 'notif.iconSrc') return m.logo ?? null;
  return null; // decks, carousels, tool icons, logo grids, clips: media a website brand doesn't have
}

export function eligible(o: Media | { site: string | null; logo?: boolean | string | null; mobile?: string | null }): Template[] {
  const m: Media = { site: o.site, mobile: o.mobile ?? null, logo: typeof o.logo === 'string' ? o.logo : o.logo ? 'logo' : null };
  return loadTemplates().filter(t => {
    if (!t.ok || (t.needs.logo && !m.logo)) return false;
    // Devanagari left in the ops is a fixed (unslotted) Hindi line of the owner's video: it would leak into this brand's reel
    if (/[ऀ-ॿ]/.test(JSON.stringify(t.ops))) return false;
    const pics = t.slots.media.map(s => pictureFor(t, s, m));
    // every slot gets a picture, and never the same picture twice in one scene (three phones with one screenshot)
    if (pics.some(p => !p) || new Set(pics).size < pics.length) return false;
    return hasHero(t) && denseEnough(t);
  });
}

/** One model call with a REAL deadline: aborted at `ms` (the SDK's own timer can run past it on a retry). */
export function within<T>(ms: number, run: (signal: AbortSignal) => Promise<T>): Promise<T> {
  const ac = new AbortController();
  let timer: NodeJS.Timeout | undefined;
  return Promise.race([
    run(ac.signal),
    new Promise<never>((_, rej) => { timer = setTimeout(() => { ac.abort(); rej(new Error(`deadline ${ms / 1000} s`)); }, ms); }),
  ]).finally(() => clearTimeout(timer));
}

// ── the text lint ────────────────────────────────────────────────────────────────────────────────────────────
/** Words a title may not END on (a line that ends "It connects your" reads as a cut-off). */
const DANGLING = new Set('a an the and or but nor to of for with without your our its it in on at by from into onto that this these those is are was were be been as so than then just very really my their his her we you i if when while who which what how get'.split(' '));
const QUOTES = /^[“”"'‘’«»\s]+|[“”"'‘’«»\s]+$/g;
const toks = (s: string) => s.toLowerCase().normalize('NFKD').replace(/[^\p{L}\p{N}%$₹ ]/gu, ' ').split(/\s+/).filter(Boolean);
/** Fit a value to its slot: on a word boundary, never past max chars (a prop is a fixed-size box: past it, it clips). */
export const clip = (s: string, max: number) => {
  s = s.replace(/[ऀ-ॿ]+/g, '').replace(/\s+/g, ' ').trim(); if ([...s].length <= max) return s;
  // always on a word boundary ("50+ languag" is worse than "50+"); a single word longer than the box gives '' (the
  // caller then takes the scene's own words that fit)
  const cut = [...s].slice(0, max + 1).join(''), i = cut.lastIndexOf(' ');
  return i > 0 ? cut.slice(0, i).replace(/[\s,.;:·–—-]+$/, '').trim() : '';
};
/** A title, tidied: no wrapping quotes (a template's “…” is not this brand's), fitted, never ending on a dangling word. */
export function tidy(s: string, max: number): string {
  let v = clip(s.replace(QUOTES, ''), max);
  for (let k = 0; k < 4; k++) {
    const ws = v.split(' '), last = ws.at(-1)!.toLowerCase().replace(/[^a-z']/g, '');
    if (ws.length > 1 && DANGLING.has(last)) v = ws.slice(0, -1).join(' ').replace(/[,;:–—-]+$/, ''); else break;
  }
  return v.trim();
}
/** The share of a title's words that the voice says in that scene (the owner's rule: words appear on OUR voice's frame). */
export function spokenShare(title: string, said: string, brand = ''): number {
  const heard = new Set([...toks(said), ...toks(brand)]), stem = (w: string) => w.slice(0, Math.max(4, w.length - 2));
  const ws = toks(title).filter(w => !DANGLING.has(w));
  if (!ws.length) return 1;
  return ws.filter(w => heard.has(w) || [...heard].some(h => h.length >= 4 && stem(h) === stem(w))).length / ws.length;
}
/** A slot the model left empty: the scene's own longest spoken words, never the owner's original (another brand's text). */
const fromScene = (text: string, max: number) => {
  const ws = text.replace(/[^\p{L}\p{N}%₹$' ]/gu, ' ').split(/\s+/).filter(Boolean), len = (x: string) => [...x].length;
  // the longest run of whole words that fits and does not start or end on a dangling word, else the longest word
  let best = '';
  for (let i = 0; i < ws.length; i++) for (let j = i + 1; j <= ws.length; j++) {
    const r = ws.slice(i, j).join(' '); if (len(r) > max) break;
    if (j - i <= 3 && !DANGLING.has(ws[i]!.toLowerCase()) && !DANGLING.has(ws[j - 1]!.toLowerCase()) && len(r) > len(best)) best = r;
  }
  return best || [...ws].filter(w => !DANGLING.has(w.toLowerCase())).sort((x, y) => len(y) - len(x)).find(w => len(w) <= max) || ws[0]?.slice(0, max) || 'Now';
};

/** A template whose props SHATTER or are struck out means "no / not / gone": on a positive line it says the opposite. */
export const negates = (t: Template) => /"(kill|shatter)"/.test(JSON.stringify(t.ops));
const NEGATION = /\b(no|not|never|without|stop|zero|nothing|none|nobody|forget|ditch|kill|quit|skip|lose|lost|gone|free of)\b|n't\b/i;

// ── polarity: a ✓ means done / good ───────────────────────────────────────────────────────────────────────────────
/** A problem line ("Tasks lost in between", "Answers buried"): negation or a pain word. A ticked row on it says the opposite. */
export const PROBLEM = /\b(no|not|never|without|nothing|none|nobody|lose|loses|losing|lost|gone|missing|missed|miss|buried|bury|scattered|scatter|mess|messy|chaos|chaotic|clutter(?:ed)?|stuck|waste[sd]?|wasting|forgot(?:ten)?|forget|confus\w*|drown\w*|juggl\w*|overload\w*|broken|breaks?|fail\w*|wrong|mistakes?|errors?|pain(?:ful)?|struggl\w*|tired|slow|late|behind|hidden|hunt\w*|search(?:ing)? for|dig(?:ging)?|switch(?:ing)? between|too many|endless|frustrat\w*|problems?)\b|n't\b/i;
const visualsOf = (ops: unknown): Obj[] => { const out: Obj[] = []; const walk = (v: unknown): void => { if (!v || typeof v !== 'object') return; if (Array.isArray(v)) { v.forEach(walk); return; } const o = v as Obj; if (o.kind === 'image' && typeof o.draw === 'string') out.push(o); Object.values(o).forEach(walk); }; walk(ops); return out; };
/** A template that shows ✓ ticks (a checklist row not killed, a sticky note's done items, a dropzone that turns done): positive polarity. */
export function ticks(t: Template): boolean {
  return visualsOf(t.ops).some(v => (v.draw === 'row' && v.kill === undefined) || (v.draw === 'note' && Array.isArray((v.p as Obj)?.items) && ((v.p as Obj).items as unknown[][]).some(it => it[1] === true)) || v.draw === 'dropzone');
}
/** The polarity a template carries: 'neg' (its props shatter / are struck out), 'pos' (✓ ticks), else 'neutral'. */
export const polarity = (t: Template): 'neg' | 'pos' | 'neutral' => (negates(t) ? 'neg' : ticks(t) ? 'pos' : 'neutral');
/** Content slot ids a template shows on ticked rows / note items (a ✓ next to "Tasks lost" is the bug). */
function tickedContent(t: Template): Set<string> {
  const ids = new Set<string>();
  for (const v of visualsOf(t.ops)) {
    if (v.draw === 'row' && v.kill === undefined && (v.p as Obj)?.label?.$C) ids.add((v.p as Obj).label.$C);
    if (v.draw === 'note') for (const it of ((v.p as Obj)?.items ?? []) as unknown[][]) if (it[1] === true && (it[0] as Obj)?.$C) ids.add((it[0] as Obj).$C as string);
  }
  return ids;
}
/**
 * A problem line on a ticking template, repaired in the template itself: every checklist row is KILLED the moment it
 * enters (the kit draws a killed row crossed ✗ from 5 frames before its kill, then strikes it off the list), a sticky
 * note's items stay unticked. On a positive line only a row whose own label is a problem ("Answers buried") is crossed.
 */
export function crossTicks(t: Template, negLine: boolean, content: Record<string, string>): Template {
  const ops = JSON.parse(JSON.stringify(t.ops)) as Op[];
  const neg = (id: unknown) => negLine || (typeof id === 'string' && PROBLEM.test(content[id] ?? ''));
  for (const v of visualsOf(ops)) {
    if (v.draw === 'row' && v.kill === undefined && neg((v.p as Obj)?.label?.$C)) {
      const f = v.f as Obj | number | undefined;
      v.kill = typeof f === 'number' ? f + 5 : f && typeof f === 'object' && '$W' in f ? { ...f, add: (f.add ?? 0) + 5 } : f && typeof f === 'object' && '$S' in f ? { $S: (f.$S as number) + 5 } : { $S: 5 };
    }
    if (v.draw === 'note' && Array.isArray((v.p as Obj)?.items)) (v.p as Obj).items = ((v.p as Obj).items as unknown[][]).map(it => [it[0], it[1] === true && !neg((it[0] as Obj)?.$C)]);
  }
  return { ...t, ops };
}

/** The hero props of a template, for the no-repeat rule (two lock screens in one reel read as a copy-paste). */
const GENERIC = new Set(['asterisk', 'burst', 'cursor', 'typebox', 'comment', 'plane', 'marker', 'mark_hl', 'sticker', 'win', 'row', 'rline', 'num', 'capt', 'pill', 'stamp', 'seal', 'brackets', 'ring']);
const heroProps = (t: Template) => t.props.filter(p => !GENERIC.has(p)).map(p => (p === 'lockphone' || p === 'phone' ? 'phone' : p));

/** Ids of the text slots a template sets as its own title lines (ln/serif/accent), with the line's width. */
export function lineSlots(t: Template): Map<string, number> {
  const out = new Map<string, number>();
  const walk = (v: unknown): void => {
    if (!v || typeof v !== 'object') return;
    if (Array.isArray(v)) { v.forEach(walk); return; }
    const o = v as Obj;
    if (TEXT_ELS.has(o.$el) && o.args?.[0]?.$T && typeof o.args[2] === 'number') out.set(o.args[0].$T, o.args[2]);
    Object.values(o).forEach(walk);
  };
  walk(t.ops);
  return out;
}
/** A title line's real limit: a line is widened with its text (keepTypeScale) and then shrinks gently, so it holds ~35 %
 *  more than the owner's own words (at ≥ 0.74 of his size); a prop's box label keeps its hard limit. */
export const slotMax = (t: Template, id: string, max: number) => (lineSlots(t).has(id) ? Math.round(max * 1.35) : max);

// ── the owner's type scale ──────────────────────────────────────────────────────────────────────────────────────
/** A text's width in em at size 1 (Inter-like proportions; only ratios between two texts are used). */
export const textW = (s: string) => [...s].reduce((a, ch) => a + (/[MW]/.test(ch) ? 0.9 : /[A-Z]/.test(ch) ? 0.68 : /[ijlft]/.test(ch) ? 0.3 : /[mw]/.test(ch) ? 0.85 : /[a-z]/.test(ch) ? 0.56 : /[0-9]/.test(ch) ? 0.6 : ch === ' ' ? 0.28 : /[.,:;'!|’]/.test(ch) ? 0.28 : 0.62), 0);
/**
 * A line's width is what sets its size (size = width / text width), and the owner chose each width for HIS words: a
 * longer value in the same width prints smaller ("No-shows and meeting overload" came out at ~35 px), a shorter one
 * huge. So each title line's width is scaled by new/old text width, which keeps his type size, inside the frame (and
 * clear of the corner logos up top).
 */
export function keepTypeScale(t: Template, text: Record<string, string>, scale = 1): Template {
  const ops = JSON.parse(JSON.stringify(t.ops)) as Op[];
  const walk = (v: unknown): void => {
    if (!v || typeof v !== 'object') return;
    if (Array.isArray(v)) { v.forEach(walk); return; }
    const o = v as Obj;
    if (TEXT_ELS.has(o.$el) && Array.isArray(o.args) && o.args[0]?.$T && typeof o.args[2] === 'number') {
      const id = o.args[0].$T as string, orig = t.slots.text.find(s => s.id === id)?.orig ?? '', now = text[id] ?? orig;
      if (orig && now && (now !== orig || scale !== 1)) {
        // a line in the top band (it rises another ~40 px under the scene's push) stays clear of the top-left corner mark
        // and a slam overshoots ~15 % while it lands: its resting width leaves that room inside the frame
        const top = typeof o.args[1] === 'number' ? o.args[1] : 600, cap = Math.min(top < 480 ? 600 : 940, o.kw?.motion === 'slam' ? 800 : 940);
        o.args[2] = Math.round(Math.max(160, Math.min(cap, o.args[2] * scale * textW(now) / Math.max(0.5, textW(orig)))));
      }
    }
    Object.values(o).forEach(walk);
  };
  walk(ops);
  return { ...t, ops };
}

// ── another brand's look out of the owner's scenes ─────────────────────────────────────────────────────────────
/**
 * The templates were cut from CaptionsEasy / OPED films: their burst lavender, CTA teal-green, purple accents and OPED's
 * teal serif are THAT brand's colours, and a phone's burnt-in WATERMARK is a CaptionsEasy gag. Each brand colour maps to
 * this brand's theme (burst, deep accent, accent); the serif goes back to the pipeline's gold; semantic colours (a red
 * "wrong", a green "right") stay.
 */
export function sanitize(ops: Op[], theme: { burst?: string; accent?: string; accent_deep?: string }): Op[] {
  const MAP: Record<string, string | undefined> = { '#E9CCFF': theme.burst, '#F3DDFF': theme.burst, '#F3E8FF': theme.burst, '#034F46': theme.accent_deep, '#7B4FD6': theme.accent };
  const walk = (v: unknown): unknown => {
    if (Array.isArray(v)) return v.map(walk);
    if (!v || typeof v !== 'object') return v;
    const o: Obj = {};
    for (const [k, x] of Object.entries(v as Obj)) {
      if (k === 'wm' || k === 'wmOff') continue;
      if (k === 'gradient' && Array.isArray(x) && x.every(c => typeof c === 'string' && /^#04BDBD$/i.test(c))) continue;
      if ((k === 'color' || k === 'fill') && typeof x === 'string' && MAP[x.toUpperCase()]) { o[k] = MAP[x.toUpperCase()]; continue; }
      o[k] = walk(x);
    }
    return o;
  };
  return walk(ops) as Op[];
}

// ── one type system per reel ─────────────────────────────────────────────────────────────────────────────────
const isUpper = (s: string) => /[A-Z]/.test(s) && s === s.toUpperCase();
/** Text slot ids a template sets in the serif italic (never in caps: Instrument italic caps read wrong and run wide). */
export function serifSlots(t: Template): Set<string> {
  const out = new Set<string>();
  const walk = (v: unknown): void => {
    if (!v || typeof v !== 'object') return;
    if (Array.isArray(v)) { v.forEach(walk); return; }
    const o = v as Obj;
    if (o.$el === 'serif' && o.args?.[0]?.$T) out.add(o.args[0].$T);
    Object.values(o).forEach(walk);
  };
  walk(t.ops);
  return out;
}
/** A title in the reel's case: caps for a caps reel; otherwise the voice script's own casing ("PRs", "Linear"), first letter up. */
export function recase(v: string, upper: boolean, W: Word[]): string {
  if (upper) return v.toUpperCase();
  const said = new Map(W.map(w => [w.word.toLowerCase().replace(/[^\p{L}\p{N}']/gu, ''), w.word.replace(/[^\p{L}\p{N}'.]/gu, '').replace(/\.$/, '')]));
  const out = v.split(/(\s+)/).map(tok => {
    const core = tok.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}']+$/gu, ''); if (!core) return tok;
    const s = said.get(core.toLowerCase());
    const cased = s && s.toLowerCase() === core.toLowerCase() ? s : isUpper(core) && core.length <= 3 ? core : core.toLowerCase();
    return tok.replace(core, cased);
  }).join('');
  return out.replace(/\p{L}/u, c => c.toUpperCase());
}

// ── the plain title (the fallback), never twice alike ─────────────────────────────────────────────────────────────
/**
 * A scene's key words as the kit's plain title: one ink line, then the gold serif line (owner rule: never two ink
 * lines), each sized to the owner's scale (~100 px ink, ~130 px serif), and a visual that is not the one the last plain
 * title used: the brand's page in a browser card / its phone layout, its mark on a burst, or the key word on a pill.
 */
export function plainTitle(board: Storyboard, i: number, words: Word[], o: { titles?: string[]; media: Media; variant: number; brand: string; upper?: boolean; noShot?: boolean; noPhone?: boolean; noMark?: boolean }): Op[] {
  const s = board.scenes[i]!, ws = words.slice(s.from, s.to + 1).map(w => w.word);
  let lines = (o.titles ?? []).map(x => tidy(x, 22)).filter(Boolean);
  if (!lines.length) { const half = Math.ceil(ws.length / 2); lines = [tidy(ws.slice(0, Math.min(half, 3)).join(' '), 20), tidy(ws.slice(half).slice(-3).join(' '), 22)].filter(Boolean); }
  const a = recase(lines[0]!, !!o.upper, words), b = lines.length > 1 ? recase(lines.slice(1).join(' '), false, words) : '';
  const said = (x: string) => ws.find(w => toks(w)[0] && toks(x).includes(toks(w)[0]!)) ?? ws[0]!;
  const out: Op[] = [{ $el: 'ln', args: [a, 440, Math.round(Math.min(900, Math.max(200, textW(a) * 104)))], kw: {} }];
  if (b) out.push({ $el: 'serif', args: [b, 545, Math.round(Math.min(900, Math.max(220, textW(b) * 128)))], kw: {} });
  const clean = ws.map(w => w.replace(/[^\p{L}\p{N}%₹$]/gu, ''));
  const key = [...clean].filter(w => w && !DANGLING.has(w.toLowerCase())).sort((x, y) => y.length - x.length)[0] ?? '';
  const chip = key.toUpperCase().slice(0, 14);
  // a picture the reel does not already show elsewhere: the page in a card, the phone layout, the mark, else the key word
  const kinds = [o.media.site && !o.noShot ? 'page' : '', o.media.mobile && !o.noPhone ? 'phone' : '', o.media.logo && !o.noMark ? 'mark' : '', chip ? 'chip' : ''].filter(Boolean);
  const kind = kinds[o.variant % Math.max(1, kinds.length)];
  // every visual lands on the scene's first word: a key word said late would leave the stage bare until then
  const visuals: Op[] = kind === 'phone' ? [{ $el: 'phone', args: [o.media.mobile, 540, 1230, 360, ws[0]], kw: { enter: 'glide', float: [5, 3, 0.4] } }]
    : kind === 'page' ? [{ $el: 'card', args: [o.media.site, 540, 1180, 880, 550, ws[0]], kw: { enter: 'rise', shadow: [0, 30, 50, 0.24] } }]
    : kind === 'mark' ? [{ $el: 'burst', args: [540, 1180, 700, ws[0]], kw: {} }, { $el: 'mark', args: [540, 1180, 300, said(o.brand)], kw: { spin: 8 } }]
      : kind === 'chip' ? [{ $el: 'burst', args: [540, 1180, 760, ws[0]], kw: {} },
        { kind: 'image', draw: 'pill', cx: 540, cy: 1180, w: Math.min(860, 140 + chip.length * 40), h: 150, enter: 'glide', p: { text: chip, fill: 'rgba(20,18,23,0.92)' }, rot: -3, _at: ws[0], _off: 4 }] : [];
  return [{ call: 'lines', args: [s.name, out], kw: { at: ws[0], ...(visuals.length ? { visuals } : {}) } }];
}

/** No model: split at sentence ends (3-10 words a scene), pick a template whose word range fits (hook first, cta last,
 *  presets varied, media templates first when there is a picture), fill titles from the scene's own words. */
export function mechanicalFill(W: Word[], pool: Template[], site: boolean) {
  const cuts: number[] = [0];
  for (let i = 0; i < W.length - 1; i++) { const len = i + 1 - cuts[cuts.length - 1]!; if ((/[.?!]$/.test(W[i]!.word) && len >= 3) || len >= 10) cuts.push(i + 1); }
  if (cuts.length > 1 && W.length - cuts[cuts.length - 1]! < 3) cuts.pop();
  const used = new Set<string>(), heroes = new Set<string>(); let lastPreset = '';
  return { scenes: cuts.map((from, i) => {
    const to = i + 1 < cuts.length ? cuts[i + 1]! - 1 : W.length - 1, n = to - from + 1, last = i === cuts.length - 1;
    const want = (t: Template) => (i === 0 && /hook/i.test(t.role) ? 4 : 0) + (last && /cta|end/i.test(t.role) ? 4 : 0) + (!last && /cta/i.test(t.role) ? -6 : 0) + (t.fits[0] <= n && n <= t.fits[1] ? 2 : 0) + (site && t.slots.media.length ? 1 : 0) + (t.preset !== lastPreset ? 1 : 0) - (heroProps(t).some(p => heroes.has(p)) ? 5 : 0);
    const t = pool.filter(t => !used.has(t.id)).sort((a, b) => want(b) - want(a) || a.id.localeCompare(b.id))[0] ?? pool[0]!;
    used.add(t.id); lastPreset = t.preset; heroProps(t).forEach(p => heroes.add(p));
    const ws = W.slice(from, to + 1).map(w => w.word), k = Math.max(1, t.slots.text.length), per = Math.ceil(ws.length / k);
    return { from, template: t.id, name: `s${i}`, text: t.slots.text.map((s, j) => ({ id: s.id, value: ws.slice(j * per, (j + 1) * per).join(' ') })), content: [] as { id: string; value: string }[] };
  }) };
}

type Pick = { from: number; template: string; name: string; text: { id: string; value: string }[]; content: { id: string; value: string }[] };
/** What a scene split + fill breaks (the bounce text the model gets once; afterwards the same rules are repaired in code). */
export function lintPicks(picks: Pick[], W: Word[], byId: Map<string, Template>, brand: string, media: Media = { site: null }): string[] {
  const sorted = [...picks].sort((a, b) => a.from - b.from), out: string[] = [], seen = new Map<string, number>();
  const pageAt = sorted.map(s => { const t = byId.get(s.template); return !!t && !!media.site && t.slots.media.some(m => pictureFor(t, m, media) === media.site); });
  if (pageAt.filter(Boolean).length > 2) out.push(`The site's page shows in ${pageAt.filter(Boolean).length} scenes: at most 2 (the same picture three times reads as a loop); pick other templates.`);
  pageAt.forEach((x, i) => { if (x && pageAt[i - 1]) out.push(`Scenes ${i - 1} and ${i} both show the site's page: never twice in a row.`); });
  sorted.forEach((s, i) => {
    const t = byId.get(s.template); if (!t) return;
    const to = i + 1 < sorted.length ? sorted[i + 1]!.from - 1 : W.length - 1, said = W.slice(s.from, to + 1).map(w => w.word).join(' ');
    for (const slot of t.slots.text) {
      const v = (s.text.find(x => x.id === slot.id)?.value ?? '').replace(QUOTES, '');
      if (!v) continue;
      const lim = slotMax(t, slot.id, slot.max);
      if ([...v].length > lim * 1.1) out.push(`scene ${i} (${s.template}) ${slot.id} "${v}" is ${[...v].length} chars, its box holds ${lim}: write a shorter title (the key words only).`);
      if (spokenShare(v, said, brand) < 0.5) out.push(`scene ${i} ${slot.id} "${v}" is not what the voice says in that scene ("${said}"): a title shows the scene's OWN spoken key words (they appear on the frame the voice says them).`);
      const last = v.split(/\s+/).at(-1)!.toLowerCase().replace(/[^a-z']/g, '');
      if (v.split(/\s+/).length > 1 && DANGLING.has(last)) out.push(`scene ${i} ${slot.id} "${v}" ends on "${last}": a title never ends on a dangling word; pick a complete key phrase.`);
    }
    // the scene's payoff (its last content word: "babysitting", "growth") belongs on screen in a short scene
    const words = said.split(/\s+/), payoff = toks(words.filter(w => !DANGLING.has(toks(w)[0] ?? '')).at(-1) ?? '')[0];
    const shown = toks(s.text.map(x => x.value).join(' '));
    if (words.length <= 8 && payoff && payoff.length > 3 && !shown.some(w => w === payoff || w.slice(0, 5) === payoff.slice(0, 5))) out.push(`scene ${i} (${s.template}) never shows "${payoff}", the payoff of "${said}": put it on screen (pick a template whose slots fit it).`);
    // a ✓ on a problem line says the opposite of the voice ("Tasks lost" ticked): the line's polarity must match
    if (ticks(t)) {
      const bad = [...tickedContent(t)].map(id => s.content.find(x => x.id === id)?.value ?? '').filter(v => PROBLEM.test(v));
      if (PROBLEM.test(said) || bad.length) out.push(`scene ${i} uses ${s.template}, whose rows/items show a ✓ tick (done, good), on a problem line ("${said}"${bad.length ? `; ticked: ${bad.map(v => `"${v}"`).join(', ')}` : ''}): pick a template whose polarity matches (a NEGATION template whose props shatter / are struck out, or one without ticks).`);
    }
    if (negates(t) && !NEGATION.test(said)) out.push(`scene ${i} uses ${s.template}, whose props shatter / are struck out (it means "no X"), on a positive line ("${said}"): pick a template that shows the thing working.`);
    for (const p of heroProps(t)) { const j = seen.get(p); if (j !== undefined) out.push(`scenes ${j} and ${i} both show a ${p}: every hero prop at most once per reel; pick another template for scene ${i}.`); else seen.set(p, i); }
  });
  if (sorted.length && !/cta|end/i.test(byId.get(sorted.at(-1)!.template)?.role ?? '')) out.push('The last scene must use a cta/ending template.');
  return out;
}

export async function fillPlan(o: { dir: string; id: string; brand: string; words: Word[]; brief: string; site: string | null; mobile?: string | null; logo?: string | null; name?: string; log?: (s: string) => void }) {
  const log = o.log ?? console.log, B = brandJson(o.brand), W = o.words, n = W.length, times: Record<string, number> = {}, t0 = Date.now();
  const media: Media = { site: o.site, mobile: o.mobile ?? null, logo: o.logo ?? null }, brandName = o.name ?? '';
  // the owner's FINAL corner rule (2026-10-10 v3): the brand's mark half off the left edge up top and the right edge
  // at the bottom, still between a rotate-in and a rotate-out (eg-01, ce-12)
  const extra: KitExtra = media.logo ? { logo: media.logo, corners: [{ src: media.logo, x: 0, y: 150, w: 380, still: true }, { src: media.logo, x: 1080, y: 1690, w: 360, still: true, in: 8 }] } : {};
  const pool = eligible(media), byId = new Map(pool.map(t => [t.id, t]));
  const index = templateIndex(pool.map(t => ({ ...t, slots: { ...t.slots, text: t.slots.text.map(x => ({ ...x, max: slotMax(t, x.id, x.max) })) } })))
    .map(t => ({ ...t, ...(negates(byId.get(t.id)!) ? { role: `${t.role} · NEGATION: its props shatter / are struck out, only for "no X / not Y" lines` } : ticks(byId.get(t.id)!) ? { role: `${t.role} · TICKS: its rows show a ✓ (done, good): only for positive lines, never a problem line` } : {}), media: byId.get(t.id)!.slots.media.map(s => s.as).join(',') || undefined }));
  log(`templates: ${pool.length} eligible${media.logo ? ' (logo)' : ''}${media.mobile ? ' (phone layout)' : ''}`);
  const slot = z.array(z.object({ id: z.string(), value: z.string() }));
  const schema = {
    scenes: z.array(z.object({
      from: z.number().int().describe("index of the scene's first word"), template: z.string().describe('a template id from the index'),
      name: z.string().describe('short snake_case scene name'), text: slot.describe('every text slot of the template: the title lines on screen'), content: slot.describe("every content slot: the prop's own words/numbers"),
    })).min(3),
  };
  const pics = [media.site && 'its desktop page (laptop/browser/card templates)', media.mobile && 'its own phone layout (phone templates)', media.logo && 'its logo mark (mark, logo-land "MEET <brand>" and the CTA lockup templates)'].filter(Boolean).join('; ');
  let bounced = false;
  type Entry = (typeof index)[number];
  const call = (tier: 'crew' | 'fast', ms: number, menu: Entry[] = index) => within(ms, signal => ask({
    agent: 's1-fill', tier, deadlineMs: ms, maxTurns: 3, signal,
    onTool: (name, _a, r, took) => log(`  fill ${tier} ${name} ${took} ms${r.error ? `: ${String(r.error).slice(0, 300)}` : ''} at ${((Date.now() - t0) / 1000).toFixed(1)} s`),
    system: "You edit a Style 1 reel (voice-led 9:16 explainer on a light stage) by picking the owner's own proven scene templates and filling their slots. You never invent layouts, only choose and fill. You think like a senior motion designer: one idea per scene, the screen carries the KEY words, the pictures carry the rest.",
    prompt: `Brief: ${o.brief}\nThis brand's pictures: ${pics || 'none (drawn props only)'}.\n\nSpoken words (index:word):\n${W.map((w, i) => `${i}:${w.word}`).join(' ')}\n\nTemplate index (id · shows · role · fits = word-count range · text slots id≤maxChars "original" · content slots id≤maxChars prop.key "original" · media = which picture slots it has):\n${menu.map(t => JSON.stringify(t)).join('\n')}\n\nSplit the words into 6-9 scenes (each a whole phrase, 3-10 words, the first starts at 0, in order) and give each the template that best SHOWS what is said (fits should cover its word count; hook first, a cta/ending template last; use each template at most once; vary presets; every hero prop (phone, laptop, panel, coin, lock screen…) at most ONCE in the reel).${media.logo ? ' Put the brand reveal ("Meet <brand>" / its name) on a logo template (logo_land / mark), and end on a logo CTA template (cta_pill with the brand wordmark) when one fits.' : ''}\nFill EVERY text and content slot for this brand:\n- text slots = the on-screen title: the scene's OWN spoken key words (1-4 words, they are typed on screen on the frame the voice says them, so never words the voice does not say in that scene), UPPERCASE where the original is; never end a title on a dangling word (your, the, and, with…); no quote marks.\n- content slots = what the prop shows (real facts from the brief only, same kind of value as the original: a number stays a number, a label a label). A panel/receipt/list gets every row filled with a distinct real item.\n- HARD LIMIT: a slot's value is at most its ≤N characters (count them; boxes are fixed-size): write a shorter phrase, never a cut-off one.\nNever leave the original brand's words (other brand names, Hindi lines, ₹ prices) in.`,
    schema,
    validate: a => {
      // a near-miss id ("Lines_02" for "lines-02", a dropped suffix) is the template the model meant: weak models do this
      for (const s of a.scenes) if (!byId.has(s.template)) s.template = String(nearestEnum(s.template, [...byId.keys()]) ?? s.template);
      const bad = a.scenes.filter(s => !byId.has(s.template)).map(s => s.template);
      if (bad.length) return `Unknown template ids: ${bad.join(', ')}. Use ids from the index.`;
      // the lint bounces ONCE (a bounce costs a turn); a second submission is taken and repaired in code
      if (bounced) return null;
      const issues = lintPicks(a.scenes, W, byId, brandName, media);
      if (!issues.length) return null;
      bounced = true;
      log(`  fill lint: ${issues.length} issue(s), sent back once`);
      return `Fix these and submit again (everything else stays):\n- ${issues.slice(0, 12).join('\n- ')}`;
    },
  }));
  // a real deadline on the crew model (room for one lint bounce), then the fast one; if both are out the reel still
  // ships: a mechanical split + pick + fill, no model. A provider with tight request / per-minute token limits (free
  // tiers: Groq, Cerebras; a local model) gets a shorter menu (a spread over every role) and no lint bounce (the code
  // repairs the picks instead); any other model that answers 413 "too large" falls back to the same.
  const short = shortlist(index, 30), tooBig = (e: unknown) => /\b413\b|too large|context.{0,20}(length|window)|maximum context|reduce the length/i.test(String(e));
  const tight = ['groq', 'cerebras', 'ollama'].includes(modelScope()?.provider ?? (config.runtime === 'http' ? config.provider : ''));
  // tight limits are counted per model per minute: the brief just used the crew model's budget, so the fill goes to
  // the fast model first (its own budget), with time to wait out a rate-limit window
  if (tight) { bounced = true; log(`templates: a ${short.length}-template menu for ${modelName('fast')} (tight request limits)`); }
  const [t1, t2, ms1, ms2] = tight ? ['fast', 'crew', 120_000, 120_000] as const : ['crew', 'fast', 60_000, 45_000] as const;
  const first = tight ? short : index;
  const ans = await call(t1, ms1, first).catch(e => { if (!tooBig(e) || first === short) throw e; log(`the template menu is too large for ${modelName(t1)}: retrying with ${short.length} templates`); bounced = true; return call(t1, ms1, short); })
    .catch(e => { log(`fill on ${modelName(t1)} failed (${String(e).slice(0, 100)}); retrying on ${modelName(t2)}`); bounced = tight || tooBig(e); return call(t2, ms2, tight || tooBig(e) ? short : index); })
    .catch(e => { log(`fill on both models failed (${String(e).slice(0, 100)}); mechanical fill`); return mechanicalFill(W, pool, !!o.site); });
  times.call = Date.now() - t0;

  // the split: sorted, de-duplicated, first at 0, each scene ends where the next starts
  const picks = ans.scenes.filter(s => byId.has(s.template) && s.from >= 0 && s.from < n).sort((a, b) => a.from - b.from).filter((s, i, a) => i === 0 || s.from > a[i - 1]!.from);
  if (picks.length) picks[0]!.from = 0;
  const left = lintPicks(picks, W, byId, brandName, media);
  if (left.length) log(`  lint left after the model (repaired in code): ${left.length}`);
  const names = new Set<string>();
  const board: Storyboard = { brand: o.brand, brief: o.brief, scenes: picks.map((s, i) => {
    let name = (s.name || `s${i}`).toLowerCase().replace(/[^a-z0-9_]/g, '_').slice(0, 24) || `s${i}`; while (names.has(name)) name += '_'; names.add(name);
    const to = i + 1 < picks.length ? picks[i + 1]!.from - 1 : n - 1, t = byId.get(s.template)!;
    return { name, from: s.from, to, text: W.slice(s.from, to + 1).map(w => w.word).join(' '), idea: `${t.id}: ${t.shows}`, preset: t.preset, props: t.props, tier: 'fast' } satisfies Scene;
  }) };
  // one type system per reel: caps when most of the picked titles were caps in the owner's films, else sentence case
  // case: each line keeps the owner's case for it (his caps layouts are set tight for caps: a descender collides), the
  // serif accent is never caps (Instrument italic caps run wide and read wrong)
  const upper = picks.length > 0 && isUpper(byId.get(picks[0]!.template)!.slots.text[0]?.orig ?? '');
  const run = (scenes: Op[][]) => { const r = s1kit.runPlan(planOf(o.id, o.brand, scenes, {}, extra), { brand: B, words: W as s1kit.Word[] }); fitToFrame(r.timeline as Obj); if ((r.spec as Obj).props) (r.spec as Obj).props.timeline = r.timeline; return r; };
  // a repeated hero prop that survived the bounce: the later scene becomes a plain title (a copy-paste reads worse)
  const heroSeen = new Set<string>(), repeat = new Set<number>();
  picks.forEach((p, i) => { const hs = heroProps(byId.get(p.template)!); if (hs.some(h => heroSeen.has(h))) repeat.add(i); hs.forEach(h => heroSeen.add(h)); });
  let plainN = 0;
  const showsPage = (i: number) => { const t = byId.get(picks[i]?.template ?? ''); return !!t && t.slots.media.some(m => /^(card|browser|laptop)\.src$/.test(m.as) || (m.as.startsWith('phone') && !media.mobile)); };
  const plain = (i: number) => plainTitle(board, i, W, { titles: picks[i]?.text.map(x => x.value).filter(v => spokenShare(v, board.scenes[i]!.text, brandName) >= 0.5), media, variant: plainN++, brand: brandName, upper: i === 0 && upper,
    noShot: showsPage(i - 1) || showsPage(i + 1) || picks.filter((_, j) => j !== i && showsPage(j)).length >= 2,
    noPhone: picks.some((p, j) => j !== i && heroProps(byId.get(p.template)!).includes('phone')),
    // the brand's mark already lands in its own reveal / CTA: a third logo moment is a repeat
    noMark: picks.some((p, j) => j !== i && (byId.get(p.template)?.needs.logo ?? false)) });
  const titleVals = (i: number, tight = 1) => {
    const t = byId.get(picks[i]!.template)!, sc = board.scenes[i]!, serif = serifSlots(t);
    return Object.fromEntries(t.slots.text.map(s => {
      const max = Math.max(4, Math.floor(slotMax(t, s.id, s.max) * tight));
      let v = tidy(picks[i]!.text.find(x => x.id === s.id)?.value ?? '', max);
      // a title the voice never says in this scene is replaced by the scene's own key words
      if (!v || spokenShare(v, sc.text, brandName) === 0) v = fromScene(sc.text, max);
      return [s.id, recase(v, isUpper(s.orig) && !serif.has(s.id), W)];
    }));
  };
  const build = (i: number, tight = 1): Op[] => {
    const p = picks[i]!, t = byId.get(p.template)!, sc = board.scenes[i]!;
    const text = titleVals(i, tight);
    const vals: SlotValues = {
      text,
      content: Object.fromEntries(t.slots.content.map(s => [s.id, clip((p.content.find(x => x.id === s.id)?.value ?? '').replace(QUOTES, ''), s.max) || fromScene(sc.text, s.max)])),
      media: Object.fromEntries(t.slots.media.map(s => [s.id, pictureFor(t, s, media)!])),
    };
    // polarity: a ticking template on a problem line (or a ticked row whose label is a problem) gets its ✓ crossed out
    const negLine = PROBLEM.test(sc.text), tt = ticks(t) ? crossTicks(t, negLine, vals.content ?? {}) : t;
    if (tt !== t && JSON.stringify(tt.ops) !== JSON.stringify(t.ops) && tight === 1) log(`  ${sc.name}: ✓ rows crossed (problem ${negLine ? 'line' : 'labels'})`);
    const ops = fill(keepTypeScale({ ...tt, ops: sanitize(tt.ops, B) }, text, tight < 1 ? 0.85 : 1), vals, W as never, { from: sc.from, to: sc.to, next: i + 1 < picks.length ? picks[i + 1]!.from : null, first: i === 0, name: sc.name });
    // the owner's own scene sets the bar: only a prop emptier than in his original fails (his title-only panels pass)
    const nEmpty = (x: unknown) => (emptyProps(x)?.match(/\(p: /g) ?? []).length;
    const empty = emptyProps(ops); if (empty && nEmpty(ops) > nEmpty(t.ops)) throw new Error(empty);
    run([ops]);
    return ops;
  };
  const scenes: Op[][] = picks.map((p, i) => {
    const sc = board.scenes[i]!;
    if (repeat.has(i)) { log(`  ${sc.name} <- ${p.template} repeats a hero prop -> plain title`); return plain(i); }
    try { const ops = build(i); log(`  ${sc.name} <- ${p.template} (${sc.to - sc.from + 1} words)`); return ops; }
    catch (e) { log(`  ${sc.name} <- ${p.template} failed -> plain title: ${String(e).slice(0, 160)}`); return plain(i); }
  });
  let out = run(scenes);
  times.fill = Date.now() - t0;
  // geometry QA: a scene with clipped/overlapping/empty frames is first re-set with tighter titles (the usual cause: a
  // title near its max that collides while it slams in); still failing, it becomes a plain title
  const sceneIssues = async () => {
    // a touch under 0.15 s (two samples) is a slam or a push passing by, not a collision anyone reads
    const issues = (await qa(out).catch(e => { log(`qa skipped: ${String(e).slice(0, 160)}`); return []; })).filter(is => !(is.type === 'empty' && is.to - is.from < 0.2) && !(is.type === 'overlap' && is.to - is.from < 0.15));
    log(`qa: ${issues.length} issues${issues.length ? `\n${describe(issues)}` : ''}`);
    const T = out.timeline as Obj, bad = new Set<number>();
    for (const is of issues) {
      const ids = [...new Set(is.ids.map(id => Number(/^s(\d+)\./.exec(id)?.[1])).filter(i => Number.isInteger(i) && i < scenes.length))];
      for (const i of ids.length ? ids : (T.scenes as Obj[]).map((sc, i) => (is.from * 30 < sc.f1 && is.to * 30 >= sc.f0 ? i : -1)).filter(i => i >= 0 && i < scenes.length)) bad.add(i);
    }
    return bad;
  };
  let bad = await sceneIssues();
  const tightened = new Set<number>();
  for (const i of bad) {
    if (repeat.has(i) || !byId.has(picks[i]?.template ?? '')) continue;
    try { scenes[i] = build(i, 0.7); tightened.add(i); log(`  ${board.scenes[i]!.name} -> tighter titles (qa)`); } catch { /* falls to plain below */ }
  }
  if (tightened.size) { out = run(scenes); bad = await sceneIssues(); }
  for (const i of bad) { log(`  ${board.scenes[i]!.name} -> plain title (qa)`); scenes[i] = plain(i); }
  if (bad.size) out = run(scenes);
  times.qa = Date.now() - t0;
  writeFileSync(join(o.dir, 'fill.json'), JSON.stringify({ answer: ans, lint: left, times }, null, 1));
  writeOut({ ...o, extra }, board, scenes, out, log);
  return { board, out, times, plain: [...bad] };
}

/** At most `n` templates, spread round-robin over their roles (openers, lists, proofs, CTA endings all stay on the menu). */
function shortlist<T extends { role: string }>(index: T[], n: number): T[] {
  const groups = new Map<string, T[]>();
  for (const e of index) { const k = e.role.split(' ')[0]!.toLowerCase(); groups.set(k, [...(groups.get(k) ?? []), e]); }
  const out: T[] = [], lists = [...groups.values()];
  for (let i = 0; out.length < n && lists.some(l => l.length > i); i++) for (const l of lists) if (l[i] && out.length < n) out.push(l[i]!);
  return out;
}
