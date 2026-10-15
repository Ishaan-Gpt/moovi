/**
 * The brief, the same way for every style and every model: the site's own words + an arc (./arcs.ts) as numbered
 * slots + the style's voice rules → { name, colour, facts, lines }. Then the SCRIPT DOCTOR fixes what weaker models
 * get wrong, deterministically: slot labels and numbering copied into the line, quotes and emoji, hype words,
 * exclamation marks, numbers the site never said, lines far too long, repeats, a missing brand line, missing lines
 * (filled from the site's own facts). The result is a script a strong model would have written, or close, whichever
 * model wrote the draft.
 */
import { z } from 'zod';
import { ask } from '../../runtime';
import { briefChain, fallbackBrief } from '../common';
import { arcBrief, type Arc } from './arcs';

export interface Site { meta: (re: RegExp) => string | undefined; text: string; counts: string[]; html: string }
export interface Brief { name: string; color: string; facts: string[]; lines: string[]; script: string; source: string; notes: string[]; arc: string; extra: Record<string, string> }

const HYPE: [RegExp, string][] = [
  [/\brevolution(ize|ise|izes|ises|izing|ary)\b/gi, 'change'], [/\bseamless(ly)?\b/gi, 'smooth'], [/\bunlock(s|ing)?\b/gi, 'open'],
  [/\bgame[- ]chang(er|ing)\b/gi, 'difference'], [/\bsupercharg(e|es|ed|ing)\b/gi, 'speed up'], [/\beffortless(ly)?\b/gi, 'easy'],
  [/\bcutting[- ]edge\b/gi, 'new'], [/\bstate[- ]of[- ]the[- ]art\b/gi, 'modern'], [/\bleverag(e|es|ing)\b/gi, 'use'], [/\bempower(s|ing)?\b/gi, 'help'],
  [/\bin today'?s (fast[- ]paced )?world,?\s*/gi, ''], [/\b(user[- ]friendly|easy[- ]to[- ]use)\b/gi, 'simple'], [/\bstreamlines\b/gi, 'speeds up'], [/\bstreamline\b/gi, 'speed up'], [/\bwith ease\b/gi, 'easily'],[/\bsay goodbye to\b/gi, 'leave behind'], [/\bintroducing\b/gi, 'meet'], [/\bdive (deep )?into\b/gi, 'look at'],
];
// a numbering prefix is "3. " / "3) " / "Line 3:", never the start of a number ("11.2 million" keeps its 11)
const LABEL = /^\s*(?:(?:line|slot|beat|step)?\s*\d+\s*(?:[.)](?!\d)|[:\-–])\s*)?(?:\*\*)?(?:\[?(?:hook|stakes|proof\s*\d?|climax|cta|payoff|the turn|turn|step\s*\d|part\s*\d|thing\s*\d|check\s*\d|claim|benefit|reason|answer|question|result|moral|zoom out( again)?|the whole picture)\]?\s*[:\-–]\s*)?(?:\*\*)?/i;
const words = (s: string) => s.split(/\s+/).filter(Boolean);

/** A line as it should be spoken: no labels, numbering, markdown, emoji, quotes around it, hype or "!". */
export function cleanLine(l: string, brand: string): string {
  let s = l.replace(/\\(["'])/g, '$1').replace(LABEL, '').replace(/[*_`#]+/g, '').replace(/\p{Extended_Pictographic}/gu, '').replace(/<\s*brand\s*>|\[\s*brand\s*\]|\{\s*brand\s*\}/gi, brand);
  s = s.replace(/^["'“”‘’]+|["'“”‘’]+$/g, '').replace(/\s+/g, ' ').trim();
  for (const [re, to] of HYPE) s = s.replace(re, to);
  // one hyphen (models emit U+2010-2012), and no doubled words a swap can leave ("easy simple", "the the")
  s = s.replace(/[‐-‒]/g, '-').replace(/\b(easy|simple|smooth),?\s+(easy|simple|smooth)\b/gi, 'simple').replace(/\b(\w+)\s+\1\b/gi, '$1');
  s = s.replace(/!+/g, '.').replace(/\?\./g, '?').replace(/\s+([.,?;:])/g, '$1').replace(/\.{2,}/g, '.').trim();
  if (s && !/[.?…]$/.test(s)) s += '.';
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Numbers in a line that the site never says (a model's invention). */
export function inventedNumbers(line: string, siteText: string): string[] {
  // whole numbers only: "8" is not on a page that says "99.8" (a substring match let "8% crash-free" pass)
  const site = siteText.replace(/(\d),(?=\d{3}\b)/g, '$1');
  const onPage = (n: string) => new RegExp(`(?<![\\d.])${n.replace('.', '\\.')}(?![\\d]|\\.\\d)`).test(site);
  return (line.match(/\d[\d,]*(?:\.\d+)?/g) ?? []).map(n => n.replace(/,/g, '')).filter(n => !onPage(n));
}

/** A line cut back to about `max` words, at a comma or a conjunction when there is one. */
export function shorten(line: string, max: number): string {
  const w = words(line); if (w.length <= max) return line;
  const head = w.slice(0, max + 1).join(' ');
  const cut = Math.max(head.lastIndexOf(','), head.search(/\s(and|but|so|because|while|which)\s[^,]*$/i));
  const s = cut > head.length * 0.45 ? head.slice(0, cut) : w.slice(0, max).join(' ');
  return s.replace(/[,;:\s]+$/, '').replace(/\s(and|but|so|or|the|a|an|of|to|with|for|in|on)$/i, '') + '.';
}

/** word overlap of two lines, ignoring case, punctuation and hyphen variants ("crash‑free" = "crash-free") */
const toks = (s: string) => words(s.toLowerCase().replace(/[‐-―]/g, '-').replace(/[^\p{L}\p{N}%.\s-]|\.(?!\d)/gu, ''));
const jac = (a: string, b: string) => { const A = new Set(toks(a)), B = new Set(toks(b)); let n = 0; for (const x of A) if (B.has(x)) n++; return n / Math.max(1, new Set([...A, ...B]).size); };

/** The doctor: returns the fixed lines and a note per fix (logged, and counted by the bench). */
export function doctor(raw: string[] | string, o: { arc: Arc; name: string; host: string; siteText: string; facts: string[] }): { lines: string[]; notes: string[] } {
  const notes: string[] = [];
  let ls = (Array.isArray(raw) ? raw : raw.split(/\r?\n/)).flatMap(l => String(l ?? '').split(/\r?\n/)).map(l => cleanLine(l, o.name)).filter(l => words(l).length >= 1);
  // a model that wrote one paragraph: one sentence per line
  if (ls.length < Math.ceil(o.arc.slots.length / 2)) { const split = ls.join(' ').split(/(?<=[.?])\s+(?=[A-Z])/).map(x => x.trim()).filter(Boolean); if (split.length > ls.length) { ls = split; notes.push('split a paragraph into lines'); } }
  // numbers the site never said: the line goes (a fact replaces it below)
  ls = ls.filter(l => { const bad = inventedNumbers(l, o.siteText); if (bad.length) notes.push(`dropped "${l}" (number ${bad.join(', ')} is not on the site)`); return !bad.length; });
  // repeats
  ls = ls.filter((l, i) => { const dup = ls.slice(0, i).some(p => jac(p, l) > 0.75); if (dup) notes.push(`dropped a repeat: "${l}"`); return !dup; });
  // length per slot (a line far past its slot is cut at a comma)
  ls = ls.map((l, i) => { const slot = o.arc.slots[Math.min(i, o.arc.slots.length - 1)]!, max = slot.words[1] + 3; if (words(l).length > max) { const s = shorten(l, slot.words[1] + 1); notes.push(`shortened line ${i + 1}`); return s; } return l; });
  // too many lines: keep the first slots-1 and the last (the payoff)
  if (ls.length > o.arc.slots.length + 1) { ls = [...ls.slice(0, o.arc.slots.length - 1), ls.at(-1)!]; notes.push('trimmed extra lines'); }
  // too few: fill from the site's own facts before the last line
  const factLines = o.facts.map(f => shorten(cleanLine(f, o.name), 12)).filter(f => !inventedNumbers(f, o.siteText).length && !ls.some(l => jac(l, f) > 0.5));
  while (ls.length < o.arc.slots.length - 1 && factLines.length) { ls.splice(Math.max(1, ls.length - 1), 0, factLines.shift()!); notes.push('filled a missing line from the site\'s facts'); }
  if (!ls.length) ls = [`Meet ${o.name}.`];
  // the brand is named at least once
  // the brand's first word as written ("Cal.com" keeps its dot: "Calcom" never matched it), punctuation escaped
  const brandRe = new RegExp((o.name.split(/\s+/)[0] ?? '').replace(/[.,!?]+$/, '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&').slice(0, 30) || '\\u0000', 'i');
  if (!ls.some(l => brandRe.test(l))) { const k = o.arc.slots.findIndex(s => s.needs.includes('brand')); const at = k >= 0 && k < ls.length ? k : Math.max(1, ls.length - 1); ls.splice(at, 0, `Meet ${o.name}.`); notes.push('added the brand line'); }
  // slot by slot: a slot that needs the brand names it, a number slot says a number the site says, the CTA has the domain
  if (ls.length === o.arc.slots.length) ls = ls.flatMap((l, i) => {
    const slot = o.arc.slots[i]!;
    if (slot.needs.includes('number') && !/\d/.test(l)) {
      const f = o.facts.map(x => cleanLine(x, o.name)).find(x => /\d/.test(x) && !inventedNumbers(x, o.siteText).length && !ls.some(y => jac(y, x) > 0.5));
      if (f) { notes.push(`line ${i + 1} needed a number: used a fact`); return [shorten(cleanLine(f, o.name), slot.words[1] + 1)]; }
    }
    // the brand's slot: its line is kept (never trade a true line for a name); the name goes in front of it
    if (slot.needs.includes('brand') && !brandRe.test(l) && !brandRe.test(ls[i - 1] ?? '')) {
      notes.push(`line ${i + 1} needed the brand`);
      // "It's fast." → "Plausible is fast." (the pronoun was the brand all along)
      const named = l.replace(/^(It|This|We)(['’]s|['’]re| is| are)\s/i, `${o.name} is `);
      if (named !== l) return [named];
      return slot.words[1] <= 6 ? [`Meet ${o.name}.`, l] : [`With ${o.name}, ${l.charAt(0).toLowerCase()}${l.slice(1)}`];
    }
    if (slot.needs.includes('cta') && !l.toLowerCase().includes(o.host.toLowerCase())) { notes.push(`line ${i + 1} needed the domain`); return [words(l).length <= 7 ? `${l.replace(/[.?]$/, '')} at ${o.host}.` : `${o.name}. At ${o.host}.`]; }
    return [l];
  });
  // last word on repeats: a slot fix may have brought back a line already said (a film never says one thing twice)
  ls = ls.filter((l, i) => { const dup = ls.slice(0, i).some(p => jac(p, l) > 0.75); if (dup) notes.push(`dropped a repeat: "${l}"`); return !dup; });
  // a CTA arc ends on the domain
  if (o.arc.slots.at(-1)!.needs.includes('cta') && !ls.some(l => l.toLowerCase().includes(o.host.toLowerCase()))) { ls.push(`${o.name}. At ${o.host}.`); notes.push('added the domain'); }
  return { lines: ls, notes };
}

const hex = (s: string | undefined) => (/^#?[0-9a-f]{6}$/i.test((s ?? '').trim()) ? `#${s!.trim().replace('#', '').toUpperCase()}` : null);
const saturation = (h: string) => { const [r, g, b] = [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16)); return Math.max(r!, g!, b!) - Math.min(r!, g!, b!); };

/** Stock phrases a weak model reaches for when it has nothing specific to say. */
const GENERIC = /\b(easy[- ]to[- ]use|user[- ]friendly|get started|ready to|take (your|it) to the next level|look no further|whether you'?re|in just a few clicks|all[- ]in[- ]one|one[- ]stop|powerful|robust|innovative|streamlin\w*|best[- ]in[- ]class|world[- ]class|solutions?|elevate|transform your|boost your productivity|work smarter|not harder|game plan|next level|unleash|supercharg\w*|at your fingertips)\b/gi;
const STOP = new Set('that this with your from have will they them their what when where which while about into than then there these those just only also more most very much many some such each every other been being were does doing make makes made want need help helps your yours ours would could should'.split(' '));
/** Share of a script's content words that the page itself uses: low = generic, written without the page. */
export function grounded(lines: string[], siteText: string): number {
  const site = siteText.toLowerCase();
  const ws = lines.join(' ').toLowerCase().match(/[a-z][a-z'-]{3,}/g)?.filter(w => !STOP.has(w)) ?? [];
  return ws.length ? ws.filter(w => site.includes(w.replace(/'s$/, ''))).length / ws.length : 0;
}
/** The page's most-used content nouns (a weak model is handed them in its repair turn). */
export function pageWords(siteText: string, n = 12): string[] {
  const c = new Map<string, number>();
  for (const w of siteText.toLowerCase().match(/[a-z][a-z-]{4,}/g) ?? []) if (!STOP.has(w)) c.set(w, (c.get(w) ?? 0) + 1);
  return [...c.entries()].sort((a, b) => b[1] - a[1]).slice(0, n).map(([w]) => w);
}

/**
 * The brief for any style: one call (crew, then fast, then the site's own words), then the doctor. `voice` is the
 * style's tone rules; `extra` asks for more short fields (e.g. Editorial's coined term) as plain strings.
 * Each line is its own named field with its slot's instruction beside it (small models fill named fields far more
 * reliably than they keep count in a list). One quality bounce: invented numbers, generic stock phrases or a script
 * that barely uses the page's own words go back once with the exact fix; the second answer is taken as it is.
 */
export async function writeBrief(o: { url: string; site: Site; arc: Arc; voice: string; extra?: Record<string, string>; signal?: AbortSignal; log?: (s: string) => void; agent: string }): Promise<Brief> {
  const { site } = o, host = new URL(o.url).hostname.replace(/^www\./, '');
  const fb0 = fallbackBrief(o.url, site);
  const extraShape = Object.fromEntries(Object.entries(o.extra ?? {}).map(([k, d]) => [k, z.string().describe(d)]));
  const slotKeys = o.arc.slots.map((_, i) => `line${i + 1}`);
  const lineShape = Object.fromEntries(o.arc.slots.map((s, i) => [slotKeys[i]!, z.string().describe(`${s.does.replace(/<Brand>/g, 'the brand')} (${s.words[0]}-${s.words[1]} words)`)]));
  let bounced = 0;
  const validate = (a: Record<string, unknown>) => {
    if (bounced++ >= 1) return null;
    const ls = slotKeys.map(k => String(a[k] ?? ''));
    const problems: string[] = [];
    const missing = slotKeys.filter((k, i) => !ls[i]!.trim()); if (missing.length) problems.push(`${missing.join(', ')} are empty: write every line`);
    const nums = ls.flatMap(l => inventedNumbers(l, site.text)); if (nums.length) problems.push(`the numbers ${nums.join(', ')} are not on the page: use only numbers the page says, or none`);
    const gen = [...new Set(ls.join(' ').match(GENERIC) ?? [])]; if (gen.length) problems.push(`replace the stock phrases (${gen.join(', ')}) with this brand's own concrete words`);
    const long = ls.map((l, i) => [i, words(l).length] as const).filter(([i, n]) => n > o.arc.slots[i]!.words[1] + 4); if (long.length) problems.push(`${long.map(([i]) => slotKeys[i]).join(', ')} are too long: keep each within its word count`);
    if (grounded(ls, site.text) < 0.3) problems.push(`the lines barely use the page; build them from its own words, such as: ${pageWords(site.text).join(', ')}`);
    return problems.length ? problems.join('; ') : null;
  };
  const call = (tier: 'crew' | 'fast', signal: AbortSignal) => { bounced = 0; return ask({
    agent: o.agent, tier, deadlineMs: 45_000, signal, validate,
    system: `You write short voice-over scripts for vertical video reels about a brand, from its website. ${o.voice}\nHard rules: facts come ONLY from the page text (never invent numbers, names, prices, years, awards or claims; if you say a number it must be on the page); plain spoken English; no hype words; no exclamation marks; no emoji; no hashtags; write only the spoken words (no labels).\nGood lines are concrete and specific to THIS brand: its real nouns, features and numbers from the page. Bad: "Get started with our easy-to-use platform." Good: "Share one link. They pick the time."`,
    prompt: `Site: ${o.url}\nTitle: ${site.meta(/<title[^>]*>([^<]*)/i) ?? ''}\nDescription: ${site.meta(/name=["']description["'][^>]*content=["']([^"']*)/i) ?? ''}\nTheme colour: ${site.meta(/name=["']theme-color["'][^>]*content=["']([^"']*)/i) ?? ''}\nMost-used colours: ${site.counts.join(', ')}\n\nPage text:\n${site.text}\n\n${arcBrief(o.arc, 'the brand')}\n\nReturn: name (the brand name as the site writes it), color (its main brand colour as #RRGGBB: a saturated colour from the site, not white, grey or black), facts (3-6 short facts copied or closely paraphrased from the page), then ${slotKeys[0]}…${slotKeys.at(-1)} (one spoken line each, in order)${Object.keys(o.extra ?? {}).length ? `, ${Object.keys(o.extra!).join(', ')}` : ''}.`,
    schema: { name: z.string(), color: z.string(), facts: z.array(z.string()).min(1), ...lineShape, ...extraShape },
  }); };
  const fallback = () => ({ name: fb0.name, color: fb0.color, facts: fb0.facts, ...Object.fromEntries(fb0.script.split('\n').map((l, i) => [`line${i + 1}`, l])), ...Object.fromEntries(Object.keys(o.extra ?? {}).map(k => [k, k === 'coined' ? fb0.coined : ''])) });
  const b = await briefChain(call, fallback, { signal: o.signal, log: o.log }) as { name: string; color: string; facts: string[]; source: string } & Record<string, unknown>;
  const raw = Object.keys(b).filter(k => /^line\d+$/.test(k)).sort((x, y) => Number(x.slice(4)) - Number(y.slice(4))).map(k => String(b[k] ?? ''));
  // the brand's name: the model's, unless it is empty, a URL or a sentence
  const name = String(b.name ?? '').trim().replace(/^https?:\/\/(www\.)?|\/.*$/gi, '').trim();
  const nm = name && words(name).length <= 4 && name.length <= 40 ? name : fb0.name;
  // its colour: a saturated one (a weak model often names the page's white or grey)
  const h = hex(b.color);
  const color = h && saturation(h) > 50 ? h : fb0.color;
  const facts = (b.facts ?? []).map(f => String(f).trim()).filter(f => f && !inventedNumbers(f, site.text).length).slice(0, 6);
  const fx = facts.length ? facts : fb0.facts;
  const d = doctor(raw, { arc: o.arc, name: nm, host, siteText: site.text, facts: fx });
  for (const n of d.notes) o.log?.(`script doctor: ${n}`);
  const extra = Object.fromEntries(Object.keys(o.extra ?? {}).map(k => [k, String(b[k] ?? '').trim()]));
  return { name: nm, color, facts: fx, lines: d.lines, script: d.lines.join('\n'), source: b.source, notes: d.notes, arc: o.arc.id, extra };
}
