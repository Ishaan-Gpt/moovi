/**
 * The Launch brief: ONE model call writes the film's on-screen words from the site (a launch film's copy is short
 * headlines, not a voice-over): one line per arc slot with its key word marked *like this*, the brand's real
 * features, a realistic request a user would type into the product, one number from the page and a tagline. Then the
 * doctor fixes what weak models get wrong, deterministically (labels, hype, "!", invented numbers, lines too long,
 * repeats, a missing brand line), and every line gets exactly one accent word. No model at all = a brief built from
 * the site's own title, description, headings and sentences, so a film is always made.
 */
import { z } from 'zod';
import { ask } from '../runtime';
import { briefChain, fallbackBrief } from '../styles/common';
import { cleanLine, grounded, inventedNumbers, pageWords, shorten, type Site } from '../styles/kit/script';
import type { LaunchArc } from './arcs';
import type { Token } from './plan';

export interface LaunchNumber { value: number | string; prefix?: string; suffix?: string; label?: string }
export interface LaunchBrief {
  name: string; color: string; tagline: string; facts: string[]; features: string[]; prompt: string; audience: string;
  number: LaunchNumber | null; lines: string[]; tokens: Token[][]; source: string; notes: string[];
}

const GENERIC = /\b(easy[- ]to[- ]use|user[- ]friendly|get started|ready to|next level|look no further|all[- ]in[- ]one|one[- ]stop|powerful|robust|innovative|streamlin\w*|best[- ]in[- ]class|world[- ]class|solutions?|elevate|transform your|boost your productivity|work smarter|unleash|supercharg\w*|at your fingertips|game[- ]chang\w*|revolution\w*|seamless\w*|cutting[- ]edge)\b/gi;
const STOP = new Set('a an the and or but of to in on for with at by from is are was be it its this that your you our we they their as into than then so not no yes all any every each more most very just only also can will'.split(' '));
const words = (s: string) => s.split(/\s+/).filter(Boolean);
const bare = (w: string) => w.toLowerCase().replace(/[^\p{L}\p{N}%$€£₹.]/gu, '').replace(/\.$/, '');

/** "11 hours saved per week" → { value: 11, suffix: 'h', label: 'saved per week' }; non-numbers → null */
export function parseNumber(s: string | null | undefined): LaunchNumber | null {
  const m = String(s ?? '').match(/([$€£₹])?\s*(\d[\d,]*(?:\.\d+)?)\s*(%|x|×|k\b|K\b|M\b|B\b|million|billion|thousand|hours?|hrs?|h\b|minutes?|mins?|seconds?|secs?|s\b|ms\b|days?|weeks?|years?|languages?|countries|users|customers|teams)?/i);
  if (!m) return null;
  const raw = Number(m[2]!.replace(/,/g, '')); if (!Number.isFinite(raw)) return null;
  const unit = (m[3] ?? '').toLowerCase();
  const short: Record<string, string> = { hours: 'h', hour: 'h', hrs: 'h', hr: 'h', h: 'h', minutes: ' min', minute: ' min', mins: ' min', min: ' min', seconds: 's', second: 's', secs: 's', sec: 's', s: 's', ms: 'ms', '%': '%', x: '×', '×': '×', k: 'K', m: 'M', b: 'B', million: 'M', billion: 'B', thousand: 'K' };
  const suffix = unit in short ? short[unit] : unit ? ` ${unit}` : '';
  const label = String(s).slice((m.index ?? 0) + m[0].length).replace(/^[\s,:-]+/, '').trim().split(/\s+/).slice(0, 5).join(' ');
  return { value: raw, ...(m[1] ? { prefix: m[1] } : {}), ...(suffix ? { suffix } : {}), ...(label ? { label } : {}) };
}

/** A line's tokens with exactly one accent word: the one the model marked, else the brand, a number, or the line's weightiest word. */
export function accentTokens(line: string, o: { brand: string; marked?: string[]; kind?: string }): Token[] {
  const ws = words(line);
  if (!ws.length) return [];
  const toks: Token[] = ws.map(s => ({ s }));
  if (ws.length === 1) { toks[0]!.accent = o.kind === 'reveal' || o.kind === 'list'; return toks; }
  const brand = bare(o.brand.split(/\s+/)[0] ?? '');
  let at = -1;
  for (const m of o.marked ?? []) { const k = toks.findIndex(t => bare(t.s) === bare(m.split(/\s+/)[0] ?? '')); if (k >= 0) { at = k; break; } }
  if (at < 0 && o.kind === 'reveal') at = toks.findIndex(t => bare(t.s) === brand);
  if (at < 0) at = toks.findIndex(t => /\d/.test(t.s));
  if (at < 0) {
    // the weightiest content word, preferring the line's second half (where the meaning lands)
    let best = -1, score = -1;
    toks.forEach((t, i) => { const w = bare(t.s); if (STOP.has(w) || w.length < 3) return; const sc = w.length * 0.3 + (i >= ws.length / 2 ? 2 : 0) + (i === ws.length - 1 ? 0.6 : 0); if (sc > score) { score = sc; best = i; } });
    at = best;
  }
  if (at >= 0) toks[at]!.accent = true;
  return toks;
}

/** strip *marks*, return the clean line and the marked words */
function unmark(l: string): { line: string; marked: string[] } {
  const marked = [...l.matchAll(/\*+([^*]+?)\*+/g)].map(m => m[1]!.trim());
  return { line: l.replace(/\*+([^*]+?)\*+/g, '$1'), marked };
}

/** the doctor for on-screen lines: clean, short, true, no repeats; the brand on the reveal slot; the end slot = the name */
export function doctorLines(raw: string[], o: { arc: LaunchArc; name: string; siteText: string; facts: string[]; features: string[] }): { lines: string[]; marked: string[][]; notes: string[] } {
  const notes: string[] = [], out: string[] = [], marked: string[][] = [];
  o.arc.slots.forEach((slot, i) => {
    const u = unmark(String(raw[i] ?? ''));
    let l = cleanLine(u.line, o.name);
    if (slot.kind === 'end') { out.push(`${o.name}.`); marked.push([o.name]); return; }
    if (!words(l).length || inventedNumbers(l, o.siteText).length) {
      if (words(l).length) notes.push(`line ${i + 1}: number not on the site, replaced`);
      l = slot.kind === 'reveal' ? `Meet ${o.name}.` : shorten(cleanLine(o.facts[i % Math.max(1, o.facts.length)] ?? o.features[i % Math.max(1, o.features.length)] ?? `Meet ${o.name}.`, o.name), slot.words[1]);
    }
    if (slot.kind === 'reveal' && !new RegExp(o.name.split(/\s+/)[0]!.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i').test(l)) { notes.push(`line ${i + 1}: the reveal names the brand`); l = `Meet ${o.name}.`; }
    if (words(l).length > slot.words[1] + 2) { l = shorten(l, slot.words[1]); notes.push(`line ${i + 1}: shortened`); }
    // a launch line keeps its question mark, drops a trailing full stop only on one-word verbs? (keep the reference's full stops)
    if (out.some(p => p.toLowerCase() === l.toLowerCase())) { notes.push(`line ${i + 1}: repeat dropped`); l = shorten(cleanLine(o.features[i % Math.max(1, o.features.length)] ?? o.name, o.name), slot.words[1]); }
    out.push(l); marked.push(u.marked);
  });
  return { lines: out, marked, notes };
}

/** headings (h1-h3) as short feature names: the page's own words for what it does */
export function pageFeatures(html: string, n = 6): string[] {
  const hs = [...html.matchAll(/<h[23][^>]*>([\s\S]*?)<\/h[23]>/gi)].map(m => m[1]!.replace(/<[^>]+>/g, ' ').replace(/&[a-z#0-9]+;/gi, ' ').replace(/\s+/g, ' ').trim());
  return [...new Set(hs.filter(h => words(h).length >= 1 && words(h).length <= 4 && h.length <= 32 && !/cookie|privacy|faq|pricing|contact|blog|login|sign/i.test(h)))].slice(0, n);
}

/** The brief, never a stall: crew model, then the fast one, then the site's own words. */
export async function launchBrief(o: { url: string; site: Site; arc: LaunchArc; signal?: AbortSignal; log?: (s: string) => void }): Promise<LaunchBrief> {
  const { site, arc } = o, host = new URL(o.url).hostname.replace(/^www\./, '');
  const fb = fallbackBrief(o.url, site);
  const keys = arc.slots.map((_, i) => `line${i + 1}`);
  const lineShape = Object.fromEntries(arc.slots.map((s, i) => [keys[i]!, z.string().describe(`${s.does.replace(/<Brand>/g, 'the brand')} (${s.words[0]}-${s.words[1]} words; wrap the ONE key word in *asterisks*)`)]));
  let bounced = 0;
  const validate = (a: Record<string, unknown>) => {
    if (bounced++ >= 1) return null;
    const ls = keys.map(k => unmark(String(a[k] ?? '')).line), problems: string[] = [];
    const empty = keys.filter((k, i) => !ls[i]!.trim()); if (empty.length) problems.push(`${empty.join(', ')} are empty: write every line`);
    const nums = ls.flatMap(l => inventedNumbers(l, site.text)); if (nums.length) problems.push(`the numbers ${nums.join(', ')} are not on the page: use only numbers the page says`);
    const gen = [...new Set(ls.join(' ').match(GENERIC) ?? [])]; if (gen.length) problems.push(`replace the stock phrases (${gen.join(', ')}) with this brand's own concrete words`);
    const long = ls.map((l, i) => [i, words(l).length] as const).filter(([i, n]) => n > arc.slots[i]!.words[1] + 3); if (long.length) problems.push(`${long.map(([i]) => keys[i]).join(', ')} are too long for a launch film: cut them to the word count`);
    const feats = (a.features as string[] | undefined) ?? []; if (feats.some(f => words(String(f)).length > 4)) problems.push('features must be 1-3 word names, not sentences');
    if (grounded(ls, site.text) < 0.25) problems.push(`the lines barely use the page; build them from its own words, such as: ${pageWords(site.text).join(', ')}`);
    return problems.length ? problems.join('; ') : null;
  };
  const call = (tier: 'crew' | 'fast', signal: AbortSignal) => { bounced = 0; return ask({
    agent: 'launch-brief', tier, deadlineMs: 45_000, signal, validate,
    system: 'You write the ON-SCREEN words of a premium product launch film (the kind Apple, Linear or Stripe ship) from the brand\'s own website. Every line is a short headline that appears alone on screen, so it must hit hard in a few words: concrete nouns from the page, sentence case, no hype words, no exclamation marks, no emoji, no quotes, no hashtags. Wrap the ONE word that carries each line\'s meaning in *asterisks*. Facts come ONLY from the page: never invent numbers, names, prices, customers or claims.',
    prompt: `Site: ${o.url}\nTitle: ${site.meta(/<title[^>]*>([^<]*)/i) ?? ''}\nDescription: ${site.meta(/name=["']description["'][^>]*content=["']([^"']*)/i) ?? ''}\nTheme colour: ${site.meta(/name=["']theme-color["'][^>]*content=["']([^"']*)/i) ?? ''}\nMost-used colours: ${site.counts.join(', ')}\n\nPage text:\n${site.text}\n\nThe film's lines, in order:\n${arc.slots.map((s, i) => `${i + 1}. ${s.does.replace(/<Brand>/g, 'the brand')} (${s.words[0]}-${s.words[1]} words)`).join('\n')}\n\nReturn: name (the brand as the site writes it), color (its main brand colour #RRGGBB, saturated, from the site), tagline (its promise in 3-6 words, from the page), facts (3-6 short facts from the page), features (3-6 things it does, each a 1-3 word name from the page), prompt (one realistic request a user would type or click into the product, 4-9 words; "" if the product has no input), audience (who it is for, 1-4 words), number (one number the page states with its unit and a 2-4 word label, e.g. "11 hours saved per week"; "" if the page states none), then ${keys[0]}…${keys.at(-1)}.`,
    schema: { name: z.string(), color: z.string(), tagline: z.string(), facts: z.array(z.string()).min(1), features: z.array(z.string()).min(1), prompt: z.string(), audience: z.string(), number: z.string(), ...lineShape },
  }); };
  const feats0 = pageFeatures(site.html ?? '');
  const fallback = () => {
    const facts = fb.facts, f = feats0.length >= 3 ? feats0 : [...feats0, ...facts.map(x => shorten(cleanLine(x, fb.name), 3).replace(/\.$/, ''))].slice(0, 4);
    const lines = arc.slots.map((s, i) => s.kind === 'reveal' ? `Meet ${fb.name}.` : s.kind === 'end' ? fb.name : s.kind === 'list' ? f.slice(0, 3).join('. ') + '.' : shorten(cleanLine(facts[i % facts.length] ?? fb.name, fb.name), s.words[1]));
    return { name: fb.name, color: fb.color, tagline: shorten(cleanLine(facts[0] ?? fb.name, fb.name), 6).replace(/\.$/, ''), facts, features: f, prompt: '', audience: '', number: '', ...Object.fromEntries(lines.map((l, i) => [keys[i]!, l])) };
  };
  const b = await briefChain(call, fallback, { signal: o.signal, log: o.log }) as Record<string, unknown> & { source: string };
  const name0 = String(b.name ?? '').trim().replace(/^https?:\/\/(www\.)?|\/.*$/gi, '').trim();
  const name = name0 && words(name0).length <= 4 && name0.length <= 32 ? name0 : fb.name;
  // a neutral brand colour (black, grey, white) can't carry an accent: the site's own most-used saturated colour instead
  const sat = (h: string) => { const n = parseInt(h.slice(1), 16), r = (n >> 16) & 255, g = (n >> 8) & 255, bl = n & 255; return Math.max(r, g, bl) - Math.min(r, g, bl); };
  const hex0 = /^#?[0-9a-f]{6}$/i.test(String(b.color ?? '').trim()) ? `#${String(b.color).trim().replace('#', '').toUpperCase()}` : fb.color;
  const hex = sat(hex0) > 48 ? hex0 : sat(fb.color) > 48 ? fb.color : hex0;
  const facts = ((b.facts as string[]) ?? []).map(String).filter(f => f.trim() && !inventedNumbers(f, site.text).length).slice(0, 6);
  const features = [...new Set(((b.features as string[]) ?? []).map(x => cleanLine(String(x), name).replace(/[.?]$/, '')).filter(x => x && words(x).length <= 4 && !inventedNumbers(x, site.text).length))].slice(0, 6);
  const feats = features.length >= 3 ? features : [...features, ...feats0].slice(0, 6);
  const raw = keys.map(k => String(b[k] ?? ''));
  const d = doctorLines(raw, { arc, name, siteText: site.text, facts: facts.length ? facts : fb.facts, features: feats });
  for (const n of d.notes) o.log?.(`launch doctor: ${n}`);
  const numStr = String(b.number ?? '');
  const number = numStr && !inventedNumbers(numStr, site.text).length ? parseNumber(numStr) : null;
  const prompt = cleanLine(String(b.prompt ?? ''), name).replace(/\.$/, '');
  return {
    name, color: hex, tagline: cleanLine(String(b.tagline ?? ''), name).replace(/\.$/, '') || shorten(cleanLine(fb.facts[0] ?? name, name), 6).replace(/\.$/, ''),
    facts: facts.length ? facts : fb.facts, features: feats.length ? feats : ['Fast', 'Simple', 'Yours'], prompt: words(prompt).length >= 3 && !inventedNumbers(prompt, site.text).length ? prompt : '', audience: String(b.audience ?? '').trim(),
    number, lines: d.lines, tokens: d.lines.map((l, i) => accentTokens(l, { brand: name, marked: d.marked[i], kind: arc.slots[i]!.kind })), source: b.source, notes: d.notes,
  };
}

/** Your own script: one on-screen line per beat (lines starting with # are notes), the key word marked *like this*. */
export function scriptBrief(script: string, o: { brand?: string; color?: string; arc: LaunchArc }): LaunchBrief {
  const ls = script.split('\n').filter(l => !l.trim().startsWith('#')).map(l => l.trim()).filter(Boolean);
  const name = o.brand || 'Brand';
  const u = ls.map(unmark);
  const lines = u.map(x => cleanLine(x.line, name));
  const feats = lines.filter(l => words(l).length <= 3).map(l => l.replace(/[.?]$/, '')).slice(0, 5);
  return { name, color: o.color || '#2B67C6', tagline: '', facts: lines.slice(0, 3), features: feats.length >= 3 ? feats : lines.slice(0, 4).map(l => shorten(l, 3).replace(/\.$/, '')), prompt: '', audience: '', number: parseNumber(lines.find(l => /\d/.test(l)) ?? null), lines, tokens: lines.map((l, i) => accentTokens(l, { brand: name, marked: u[i]!.marked })), source: 'script', notes: [] };
}
