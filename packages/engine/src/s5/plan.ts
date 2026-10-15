/**
 * Clear Signal planner: a STYLE, not a template. Word timings → beats (phrase rules, a set-up every 1.5-3 s) → what
 * each beat NEEDS (kit detector ∪ the model's tags ∪ the arc slot it came from) → cast from the library (./library.ts,
 * 65 set-ups, every one a renderer in ./client.js) away from this style's recent films → beats nothing serves are
 * IMPROVISED in the style's vocabulary (kit/compose.ts; one short call each, all in parallel; a sketch if the model
 * fails) → the film. Good improvisations join the library (grow), and the film is remembered so the next one is cast
 * away from it.
 *
 * The model's only jobs (one call, flat schema, any model): per script line, 1-4 needs from a fixed list, an optional
 * set-up id hint and the one accent word. Everything else is deterministic, and a failed call changes nothing but
 * the hints.
 */
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { z } from 'zod';
import { config } from '../config';
import { ask } from '../runtime';
import { within } from '../styles/common';
import {
  cast, catalog, detectNeeds, grow, mergeNeeds, grown, iconFor, improvise, isList, keyWords, listItems, NEEDS, recentSetups, spokenNumber,
  type BeatIn, type Cast, type El, type Need, type Role, type Setup, type Spec,
} from '../styles/kit';
import { ICON_NAMES, type IconName } from './icons';
import { S5_IDS, S5_LIBRARY, S5_VOCAB } from './library';

export interface Word { word: string; t: number; end: number }
export interface Tok { text: string; t: number; end: number; accent: boolean }
export interface Item { text: string; t: number; icon: IconName }
export interface Beat {
  /** the renderer in client.js ('compose' = an improvised spec) */
  setup: string;
  /** the library id cast (a grown "gen-…" id, "sketch" for a model-free improvisation) */
  cast: string;
  t0: number; t1: number; toks: Tok[];
  /** spoken list items (each lands on its word) */
  items: Item[];
  /** the beat's key words (content words, in spoken order) */
  keys: Item[];
  icon: IconName; number: number | null; numText: string | null; sub: string; needs: Need[];
  /** the line talks about falling / less (charts point down) */
  down: boolean;
  spec?: Spec; why: string;
}
export interface Colors { paper: string; ink: string; accent: string; grey: string }
export interface Film { id: string; duration: number; colors: Colors; beats: Beat[]; end: { t0: number; name: string; line: string }; audio: string; arc: string }
export interface Tag { needs: Need[]; setup: string; accent: string }

const V = 5;
const norm = (w: string) => w.toLowerCase().replace(/[^a-z0-9]/g, '');

/* ───────── icons by meaning (Clear Signal's own icon set first, then the kit's map) ───────── */
const MY_ICONS: [RegExp, IconName][] = [
  [/\b(calendar|schedul\w*|meeting\w*|book(ing)?s?|appointment\w*|date\w*|week\w*)\b/i, 'calendar'],
  [/\b(place\w*|city|cities|store\w*|map\w*|address\w*|local\w*|near\w*)\b/i, 'pin'],
  [/\b(idea\w*|insight\w*|clever|smart)\b/i, 'bulb'],
  [/\b(key\w*|access|password\w*|login|sign[- ]in)\b/i, 'key'],
  [/\b(win\w*|award\w*|best|top|#1|leader\w*)\b/i, 'trophy'],
  [/\b(error\w*|bug\w*|break\w*|broken|risk\w*|danger\w*|mistake\w*|fail\w*)\b/i, 'alert'],
  [/\b(pay\w*|card\w*|checkout|billing)\b/i, 'card'],
  [/\b(price\w*|deal\w*|discount\w*|sale\w*)\b/i, 'tag'],
  [/\b(ship\w*|deliver\w*|order\w*|truck\w*)\b/i, 'truck'],
  [/\b(voice\w*|speak\w*|talk\w*|call\w*|podcast\w*)\b/i, 'mic'],
  [/\b(photo\w*|video\w*|camera\w*|film\w*|record\w*)\b/i, 'camera'],
  [/\b(doc\w*|note\w*|page\w*|write\w*|writing|text|draft\w*|file\w*)\b/i, 'doc'],
  [/\b(folder\w*|organi[sz]\w*|archive\w*)\b/i, 'folder'],
  [/\b(filter\w*|sort\w*|noise)\b/i, 'filter'],
  [/\b(setting\w*|control\w*|tune\w*|custom\w*)\b/i, 'sliders'],
  [/\b(happy|smile\w*|delight\w*|joy|fun)\b/i, 'smile'],
  [/\b(server\w*|infra\w*|backend|hosting|cloud)\b/i, 'server'],
  [/\b(database\w*|record\w*|storage|sql|postgres)\b/i, 'database'],
  [/\b(ai|model\w*|agent\w*|gpt|llm|machine)\b/i, 'chip'],
  [/\b(think\w*|mind\w*|memory|learn\w*|brain\w*)\b/i, 'brain'],
  [/\b(send\w*|email\w*|mail\w*)\b/i, 'send'],
  [/\b(inbox\w*|messages?)\b/i, 'inbox'],
  [/\b(sync\w*|repeat\w*|again|loop\w*|automat\w*|recurring)\b/i, 'refresh'],
  [/\b(click\w*|tap\w*|button\w*)\b/i, 'cursor'],
  [/\b(edit\w*|design\w*|draw\w*|craft\w*)\b/i, 'edit'],
  [/\b(apps?|integrat\w*|tools?|plugins?)\b/i, 'grid'],
  [/\b(tasks?|issues?|projects?|todos?|lists?|tickets?|backlog)\b/i, 'list'],
  [/\b(hot|popular|trend\w*|fire)\b/i, 'flame'],
  [/\b(gift\w*|free|bonus)\b/i, 'gift'],
  [/\b(music|song\w*|sound\w*|audio)\b/i, 'music'],
  [/\b(goal\w*|mission|milestone\w*|launch\w*)\b/i, 'flag'],
  [/\b(grow\w*|rise|rising|increase\w*|more|up)\b/i, 'trend'],
  [/\b(drop\w*|fall\w*|less|fewer|down|lower|reduc\w*|cut\w*)\b/i, 'drop'],
  [/\b(shop\w*|store|buy\w*|retail)\b/i, 'store'],
  [/\b(travel\w*|flight\w*|trip\w*|plane\w*)\b/i, 'plane'],
  [/\b(coffee|tea|drinks?|cups?|caf[eé]\w*|brew\w*|roast\w*|beans?)\b/i, 'cup'],
  [/\b(night|sleep\w*|dark)\b/i, 'moon'],
  [/\b(day|mornings?|sun\w*|bright|sunrise)\b/i, 'sun'],
  [/\b(online|wifi|internet|connect\w*)\b/i, 'wifi'],
];
export function s5Icon(text: string, avoid: string[] = []): IconName {
  for (const [re, n] of MY_ICONS) if (re.test(text) && !avoid.includes(n)) return n;
  // the kit's map by meaning; nothing matched = a neutral spark (never a crowd for a line about no one)
  return iconFor(text, ['spark', ...ICON_NAMES.filter(n => n !== 'spark')], avoid) as IconName;
}

/* ───────── beats from words (phrase rules) ───────── */

const CONJ = /^(and|but|so|because|which|while|then|or|with|without|instead|until|when)$/i;
/** A list a viewer would see as a list: 2-5 short items, none of them a clause ("so feedback becomes labeled"). */
export function spokenList(text: string): string[] {
  const its = listItems(text);
  if (its.length < 2) return [];
  const clause = /^(so|because|which|that|then|to|when|while|if|but|it|they|we|you)/i;
  // the first item may carry the line's intro ("Your clients pick a time"): it keeps its last 3 words
  if (its.some((it, i) => clause.test(it) || it.split(/\s+/).length > (i ? 4 : 6))) return [];
  const lead = /^(you|your|we|our|they|their|it|its|lets|let|can|will|just)$/i;
  return its.map((it, i) => { if (i) return it; const w = it.split(/\s+/).slice(-3); while (w.length > 1 && lead.test(w[0]!)) w.shift(); return w.join(' '); });
}
/** Beat starts: one per sentence; a sentence past ~3 s splits (never leaving a piece under 1.1 s) at the comma / conjunction nearest its middle
 * (a spoken list is kept whole up to ~4.6 s and is cut BEFORE its first item); pieces under 0.9 s merge back. */
export function splitBeats(words: Word[]): number[] {
  const sentences: [number, number][] = []; let a = 0;
  words.forEach((w, i) => { if (/[.!?]["')]?$/.test(w.word) || i === words.length - 1) { sentences.push([a, i + 1]); a = i + 1; } });
  const dur = (s: number, e: number) => words[e - 1]!.end - words[s]!.t;
  const text = (s: number, e: number) => words.slice(s, e).map(w => w.word).join(' ');
  const starts: number[] = [];
  const cut = (s: number, e: number) => {
    const d = dur(s, e), list = spokenList(text(s, e)).length >= 2;
    if (d <= 3.0 || e - s < 5 || (list && d <= 5.2)) { starts.push(s); return; }
    // a list sentence: cut just before the list's first item (the intro is its own beat)
    if (list) {
      const first = norm(spokenList(text(s, e))[0]?.split(/\s+/)[0] ?? '');
      const k = words.slice(s, e).findIndex((w, j) => j >= 2 && norm(w.word) === first);
      if (k >= 4 && e - (s + k) >= 3) { starts.push(s); cut(s + k, e); return; }
    }
    const mid = (words[s]!.t + words[e - 1]!.end) / 2;
    let best = -1, bestD = Infinity, bestGood = false;
    for (let j = s + 2; j <= e - 2; j++) {
      if (words[j - 1]!.end - words[s]!.t < 1.1 || words[e - 1]!.end - words[j]!.t < 1.1) continue; // no fragments
      const good = /[,;:]$/.test(words[j - 1]!.word) || CONJ.test(norm(words[j]!.word));
      const dd = Math.abs(words[j]!.t - mid) - (good ? 0.9 : 0);
      if (dd < bestD) { bestD = dd; best = j; bestGood = good; }
    }
    // no comma or conjunction to cut at: a sentence under 3.6 s stays whole (never "every | open slot")
    if (best < 0 || (!bestGood && d <= 3.6)) { starts.push(s); return; }
    cut(s, best); cut(best, e);
  };
  for (const [s, e] of sentences) cut(s, e);
  // a piece under 1.1 s joins its shorter neighbour, only while the joined beat stays under ~3 s (three short
  // sentences in a row stay three quick set-ups; they never pile into one long one)
  const out = [...new Set(starts)].sort((x, y) => x - y), skip = new Set<number>();
  for (let guard = 0; guard < 40; guard++) {
    const len = (k: number) => dur(out[k]!, out[k + 1] ?? words.length);
    const i = out.findIndex((_, k) => !skip.has(out[k]!) && len(k) < 1.1 && out.length > 2 && ((k > 0 && len(k - 1) + len(k) <= 3.2) || (k < out.length - 1 && len(k + 1) + len(k) <= 3.2)));
    if (i < 0) break;
    const prevOk = i > 0 && len(i - 1) + len(i) <= 3.2, nextOk = i < out.length - 1 && len(i + 1) + len(i) <= 3.2;
    // prefer the neighbour in the same sentence ("and pay nothing." stays with "You can book as many as you want,")
    const endsSent = (w: number) => /[.!?]["')]?$/.test(words[w]!.word);
    const samePrev = i > 0 && !endsSent(out[i]! - 1), sameNext = i < out.length - 1 && !endsSent((out[i + 1] ?? words.length) - 1);
    // a piece of a sentence joins only its own sentence (never "Meetings pile" onto the line before)
    if ((samePrev || sameNext) && !((samePrev && prevOk) || (sameNext && nextOk))) { skip.add(out[i]!); continue; }
    const intoPrev = samePrev || sameNext ? samePrev && prevOk && !(sameNext && nextOk && len(i + 1) < len(i - 1)) : prevOk && (!nextOk || len(i - 1) <= len(i + 1));
    out.splice(intoPrev ? i : i + 1, 1);
  }
  return out;
}

/* ───────── the one model call: per line needs + a set-up hint + the accent word ───────── */

export async function tagLines(lines: string[], o: { signal?: AbortSignal; log?: (s: string) => void; ms?: number } = {}): Promise<{ tags: Tag[]; source: string }> {
  const key = createHash('sha1').update(JSON.stringify([V, lines])).digest('hex').slice(0, 16);
  const cdir = join(config.data, 's5', 'cache'), cfile = join(cdir, `tags-${key}.json`);
  mkdirSync(cdir, { recursive: true });
  if (existsSync(cfile)) try { return { tags: JSON.parse(readFileSync(cfile, 'utf8')), source: 'cache' }; } catch { /* re-ask */ }
  const schema = {
    lines: z.array(z.object({
      needs: z.array(z.enum(NEEDS)).describe('1-4 needs the line shows'),
      setup: z.enum(['none', ...S5_IDS] as [string, ...string[]]).describe('the set-up that pictures it best, or none'),
      accent: z.string().describe('the ONE word of the line that carries its meaning'),
    })),
  };
  try {
    const r = await within(o.ms ?? 30_000, o.signal, signal => ask({
      agent: 's5-tags', tier: 'fast', deadlineMs: o.ms ?? 30_000, maxTurns: 3, quick: true, signal,
      system: 'You tag the lines of a short explainer video so a fixed visual style can picture each one. Pick only from the given lists.',
      prompt: `Lines:\n${lines.map((l, i) => `${i + 1}. ${l}`).join('\n')}\n\nNeeds (pick 1-4 per line): ${NEEDS.join(', ')}\n\nSet-ups (id: what it shows):\n${catalog(S5_LIBRARY, 80)}\n\nReturn "lines": one entry per line, in order, with needs, setup (an id above or none) and accent (one word from that line).`,
      schema,
    }));
    const tags = (r.lines ?? []).map(t => ({ needs: (t.needs ?? []).filter(n => (NEEDS as readonly string[]).includes(n)).slice(0, 4) as Need[], setup: S5_IDS.includes(t.setup) ? t.setup : '', accent: String(t.accent ?? '').trim() }));
    writeFileSync(cfile, JSON.stringify(tags));
    return { tags, source: 'model' };
  } catch (e) {
    if (o.signal?.aborted) throw e;
    o.log?.(`tags failed (${String(e instanceof Error ? e.message : e).slice(0, 100)}); needs from the words alone`);
    return { tags: [], source: 'rules' };
  }
}

/* ───────── re-binding a kept improvisation to a new line ───────── */

/** A grown set-up's spec on a NEW beat: same layout, kinds, shapes, tones, motions; words, icons and timing from this line. */
export function rebind(spec: Spec, ws: Word[], text: string): Spec {
  const keys = keyWords(ws.map(w => ({ ...w })), 6), num = spokenNumber(text);
  let k = 0; const used: string[] = [];
  const elements: El[] = spec.elements.map(e0 => {
    const e = { ...e0 }, key = keys[Math.min(k, Math.max(0, keys.length - 1))];
    if (['word', 'label'].includes(e.kind)) { if (key) { e.text = key.word; e.word = key.index; k++; } }
    else if (e.kind === 'number') { if (num == null) { e.kind = 'icon'; e.icon = s5Icon(text, used); } else { e.value = num; e.word = Math.max(0, ws.findIndex(w => /\d/.test(w.word))); } }
    else { e.word = key ? key.index : 0; if (e.kind === 'icon') { e.icon = s5Icon(key?.word ?? text, used); used.push(e.icon); } }
    e.word = Math.max(0, Math.min(ws.length - 1, e.word));
    return e;
  });
  return { ...spec, elements };
}

/** What the player needs of one beat: its tokens (one accent word), spoken list items and key words (each on its
 * spoken word, each with an icon by meaning), the icon of the whole line and its spoken number. */
export function beatData(ws: Word[], accentWord = '') {
  const text = ws.map(w => w.word).join(' ');
  const keys = keyWords(ws, 3);
  const acc = ws.findIndex(w => accentWord && norm(w.word) === norm(accentWord));
  const accIdx = acc >= 0 ? acc : keys.reduce((m, k) => (k.word.length > (ws[m]?.word.length ?? 0) ? k.index : m), keys[0]?.index ?? ws.length - 1);
  const toks: Tok[] = ws.map((w, j) => ({ text: w.word, t: w.t, end: w.end, accent: j === accIdx }));
  const used: string[] = []; let from = 0;
  const items: Item[] = spokenList(text).map(it => {
    const f = norm(it.split(/\s+/)[0] ?? ''); let k = ws.findIndex((w, j) => j >= from && norm(w.word) === f); if (k < 0) k = from; from = k + 1;
    const icon = s5Icon(it, used); used.push(icon);
    return { text: it.replace(/^(and|or)\s+/i, ''), t: ws[Math.min(k, ws.length - 1)]!.t, icon };
  });
  const kUsed: string[] = [];
  const keyItems: Item[] = keys.map(k => { const icon = s5Icon(k.word, kUsed); kUsed.push(icon); return { text: k.word, t: ws[k.index]!.t, icon }; });
  const numTok = ws.find(w => /\d/.test(w.word));
  return { toks, items, keys: keyItems, icon: s5Icon(text), number: spokenNumber(text) as number | null, numText: (numTok ? numTok.word.replace(/[^\d.,%$€£₹kKmMxX+]/g, '').replace(/[.,]+$/, '') : null) as string | null, sub: text };
}

/**
 * Cast a film from the library (kit cast) with Clear Signal's own rule on top: the last beat is always one of the
 * closing set-ups (the payoff lands like the reference's circled ending), cast among them away from recent films.
 */
export function castFilm(beats: BeatIn[], lib: Setup[], o: { seed: string; recent?: string[]; fresh?: boolean }): Cast[] {
  const opts = { seed: o.seed, recent: o.recent, typeShare: 0.25, floor: 4 };
  const c = cast(beats, lib, opts), last = beats.length - 1;
  if (last > 0 && !c[last]!.setup?.roles?.includes('close')) {
    const closers = lib.filter(s => s.roles?.includes('close') && s.family !== c[last - 1]!.setup?.family);
    const r = cast([beats[last]!], closers, { ...opts, floor: -Infinity })[0]!;
    if (r.setup) c[last] = { ...r, why: `close: ${r.why}` };
  }
  // a film always carries something fresh: when nothing fell below the floor, the weakest-served middle beat
  // (a loose fit, under 5.5) is improvised in the style's grammar instead of taking a near-miss from the library
  if (o.fresh !== false && !c.some(x => !x.setup)) {
    const k = c.map((x, i) => ({ x, i })).filter(({ i, x }) => i > 0 && i < last && x.score < 5.5 && !x.setup?.items).sort((a, b) => a.x.score - b.x.score)[0];
    if (k) c[k.i] = { setup: null, score: k.x.score, why: `fresh (loosest fit ${k.x.setup?.id} ${k.x.score.toFixed(1)})` };
  }
  return c;
}

/* ───────── the plan ───────── */

export interface PlanIn {
  id: string; seed: string; words: Word[];
  /** the script's lines (beats map back to them by position) */
  lines: string[];
  /** the arc's slot needs per line (empty for a pasted script or a clone) */
  slotNeeds?: Need[][];
  tags: Tag[];
  facts: boolean; colors: Colors; name: string; line: string; duration: number; audio: string; arc: string;
  signal?: AbortSignal; log?: (s: string) => void;
}

const PEOPLE = /\b(people|audience|customers?|users?|teams?|developers?|creators?|students?|everyone|humans?|readers?|viewers?|clients?|members?|friends?|community|founders?|families|engineers?|designers?|patients?|buyers?|sellers?|employees?|staff)\b/i;

export async function plan(o: PlanIn): Promise<{ film: Film; casts: Cast[]; improvised: { index: number; source: string; id: string }[] }> {
  const { words } = o, n = words.length, log = o.log ?? console.log;
  const starts = splitBeats(words);
  // beats → script lines, by position in the normalised text
  const lineLen = o.lines.map(l => norm(l).length), totL = lineLen.reduce((a, b) => a + b, 0) || 1;
  const wordAt: number[] = []; let acc = 0; for (const w of words) { wordAt.push(acc); acc += norm(w.word).length; }
  const lineOf = (wi: number) => { const p = wordAt[wi]! / Math.max(1, acc) * totL; let c = 0; for (let k = 0; k < lineLen.length; k++) { c += lineLen[k]!; if (p < c - 0.5) return k; } return Math.max(0, lineLen.length - 1); };

  // the model's tags count only when they look like real reading (kit mergeNeeds: a model tagging at random is ignored)
  const merged = mergeNeeds(o.lines, o.tags.map((t, line) => ({ line, needs: t.needs })));
  if (o.tags.length && !merged.trusted) log("tags not trusted overall; kept only where a line's tags agree with its words");
  const raw = starts.map((s, i) => {
    const e = starts[i + 1] ?? n, ws = words.slice(s, e), text = ws.map(w => w.word).join(' ');
    // untrusted overall: a line's tags still count where they agree with its own words
    const li = lineOf(s), firstOfLine = i === 0 || lineOf(starts[i - 1]!) !== li, t0g = o.tags[li];
    const tag = merged.trusted || (t0g && t0g.needs.some(nd => detectNeeds(o.lines[li] ?? '').includes(nd))) ? t0g : undefined;
    const det = detectNeeds(text, { index: i, count: starts.length });
    const lineNeeds = merged.trusted ? (tag?.needs ?? []) : [];
    // "you" alone is not people on screen
    const refine = [...lineNeeds, ...det].filter(nd => nd !== 'people' || PEOPLE.test(text));
    // "list" only for a list a viewer would see as one (the kit counts commas; a clause with commas is not a list)
    const needs = [...new Set<Need>([...(o.slotNeeds?.[li] ?? []), ...refine])].filter(nd => nd !== 'list' || spokenList(text).length >= 2).slice(0, 7);
    const role: Role = i === 0 ? 'open' : i === starts.length - 1 ? 'close' : 'middle';
    return { s, e, ws, text, li, needs, role, hint: firstOfLine && tag?.setup ? [tag.setup] : [], accent: tag?.accent ?? '' };
  });
  const beatsIn: BeatIn[] = raw.map((r, i) => ({
    index: i, text: r.text, words: r.ws.length, seconds: r.ws.at(-1)!.end - r.ws[0]!.t, needs: r.needs,
    items: spokenList(r.text).length, number: spokenNumber(r.text), role: r.role, hints: r.hint,
  }));

  const lib: Setup[] = [...S5_LIBRARY, ...grown('s5')];
  const casts = castFilm(beatsIn, lib, { seed: o.seed, recent: recentSetups('s5') });

  // improvise every beat nothing serves: all in parallel, each capped (the kit sketches when a call fails)
  const improvised: { index: number; source: string; id: string }[] = [];
  const specs = await Promise.all(casts.map(async (c, i) => {
    const r = raw[i]!;
    if (c.setup?.generated) return rebind(c.setup.generated.spec as Spec, r.ws, r.text);
    if (c.setup) return undefined;
    const bw = { text: r.text, needs: r.needs, words: r.ws.map(w => ({ word: w.word, t: w.t, end: w.end })) };
    const got = await improvise({ style: 's5', vocab: S5_VOCAB, beat: bw, ms: 25_000, signal: o.signal, log, context: 'Style: white paper, one accent colour, flat accent-filled shapes with white line icons, words in a grotesk sans.' });
    let id = 'sketch';
    if (got.source === 'model' && got.spec.elements.filter(e => !['word', 'label'].includes(e.kind)).length >= 2) {
      id = grow('s5', { name: `improvised: ${got.spec.about.slice(0, 40)}`, about: got.spec.about, needs: got.spec.needs.length ? got.spec.needs : r.needs.slice(0, 3), family: 'improvised', seconds: [1.1, 4], generated: { spec: got.spec, model: 'fast', created: new Date().toISOString(), uses: 1 } });
    }
    improvised.push({ index: i, source: got.source, id });
    return got.spec;
  }));

  const beats: Beat[] = raw.map((r, i) => {
    const t0 = i === 0 ? 0 : Math.max(0, words[r.s]!.t - 0.12);
    const t1 = i === raw.length - 1 ? words.at(-1)!.end + 1.0 : Math.max(0, words[r.e]!.t - 0.12);
    const c = casts[i]!, d = beatData(r.ws, r.accent);
    const setup = c.setup ? (c.setup.generated ? 'compose' : c.setup.id) : 'compose';
    if (o.facts === false && d.number == null && setup === 'counter') { d.number = Math.max(3, Math.round((t1 - t0) * 6)); d.numText = String(d.number); }
    return {
      setup, cast: c.setup?.id ?? (improvised.find(x => x.index === i)?.id ?? 'sketch'), t0: +t0.toFixed(3), t1: +t1.toFixed(3), ...d,
      needs: r.needs, down: r.needs.includes('decline') && !r.needs.includes('growth'), spec: specs[i], why: c.why,
    };
  });
  const endT = beats.at(-1)!.t1;
  return { film: { id: o.id, duration: Math.max(o.duration, endT + 2.2), colors: o.colors, beats, end: { t0: endT, name: o.name, line: o.line }, audio: o.audio, arc: o.arc }, casts, improvised };
}

/** Style 1 SFX kit events for a film: a soft whoosh per set-up, a pop per item, a chime on numbers, typing on words. */
export function events(f: Film): Record<string, unknown>[] {
  const ev: Record<string, unknown>[] = [];
  f.beats.forEach((b, i) => {
    ev.push({ t: b.t0, event: i ? 'scene' : 'hard-hit' });
    for (const it of b.items) ev.push({ t: +(it.t + 0.04).toFixed(3), event: 'paper-pop' });
    for (const k of b.toks) { ev.push({ t: +(k.t + 0.03).toFixed(3), event: 'word', text: k.text }); if (k.accent && b.setup !== 'words') ev.push({ t: +(k.t + 0.03).toFixed(3), event: 'key-word' }); }
    if (b.number != null && ['counter', 'slam', 'percent', 'dots', 'stopwatch'].includes(b.setup)) ev.push({ t: +(b.t0 + 0.4).toFixed(3), event: 'stat' });
  });
  ev.push({ t: f.end.t0, event: 'card-in' });
  return ev.sort((a, b) => (a.t as number) - (b.t as number));
}
