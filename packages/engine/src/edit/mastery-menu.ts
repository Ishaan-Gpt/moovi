import { copyFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs';
import { extname, join } from 'node:path';
import { z } from 'zod';
import { CRAFT, library as L, needGraph, run } from '@moovi/graph';
import { config, REPO } from '../config';
import { askChecked, estimateTokens, runtime, type Checked, type History } from '../runtime';
import { skillPrompt } from '../skill-prompt';
import { PLAYER_DIR } from './mastery';

/**
 * The compact writer for Edit mastery's player (decision 20, Precise mode: the server model and every user API key).
 * Ishaan: "for a free model we will make it more library focus ... directing it, not building from scratch". The model
 * reads the compact skill (skillPrompt edit/compact) and Edit mastery's menu (docs/agents/mastery/edit-player/menu.json,
 * read from the repo now) and answers per sentence with a device id from that menu and the words its slots need, all
 * taken from the speaker's own sentence. Code fills ONLY the menu's slots: anchors on the said words, the library's sounds
 * per video ({sfx:<event>} from the graph), the bed ({music:<mood>}), real footage ({footage:<query>}) and the desk places.
 * The rules block is checked; a broken pick gets one repair re-ask with its exact errors, then is played as the speaker.
 */
export const MENU_AGENT = 'direct:edit-menu';

export interface MenuDevice { id: string; use: string; layers: Record<string, unknown>[]; sfx?: Record<string, unknown>[]; desk_item?: Record<string, unknown>; places?: Record<string, number | number[]>[]; desk?: { w: number; h: number }; after?: string; doodles?: Record<string, { use: string; paths: string[] } | string> }
const doodleNames = (d: MenuDevice) => Object.keys(d.doodles ?? {}).filter(k => k !== '_');
export interface Coverage { id: string; what: string; devices: string[]; min?: number }
export interface Menu { rules: string[]; slots: Record<string, string>; captions: { allowed: string[]; default: string; accent: string }; devices: MenuDevice[]; end?: { sfx?: Record<string, unknown>[] };
  /** what every film must show (owner, 2026-10-18: at least 80-90% of the checklist on every edit) */
  coverage?: { picked: Coverage[]; short_clip?: string };
  /** what code adds by itself: the leak after an away beat, the push on a long hold */
  auto?: { leak?: { layers: Record<string, unknown>[]; sfx?: Record<string, unknown>[] }; push?: { push: number } } }
export const loadMenu = (): Menu => JSON.parse(readFileSync(join(PLAYER_DIR, 'menu.json'), 'utf8')) as Menu;

/** the text slots a device needs (what the model must give), from its templates */
export function slotsOf(d: MenuDevice): string[] {
  const s = JSON.stringify([d.layers, d.desk_item ?? {}]), out = new Set<string>();
  for (const m of s.matchAll(/\{(\w+)(?:\[\d+\])?\}/g)) if (!['line', 'last'].includes(m[1]!)) out.add(m[1]!);
  for (const m of s.matchAll(/\{footage:<query>\}/g)) { void m; out.add('footage'); }
  return [...out].filter(x => x !== 'place');
}

export interface Sentence { i: number; t0: number; t1: number; text: string; words: { word: string; t: number; end: number }[] }
/** Words to beats: sentences closed at . ! ?, and a long one split into phrases (at a comma after about 2.2 s, at any
 * word edge after 3.6 s), so a film has a beat every 2-3.5 s for its devices (owner: every edit shows the checklist). Pure. */
export function sentencesOfWords(ws: { word: string; t: number; end: number }[]): Sentence[] {
  const out: Sentence[] = []; let cur: Sentence['words'] = [];
  const close = () => { if (cur.length) out.push({ i: out.length, t0: cur[0]!.t, t1: cur.at(-1)!.end, text: cur.map(w => w.word).join(' '), words: cur }); cur = []; };
  ws.forEach((w, k) => { cur.push(w); const span = w.end - cur[0]!.t, rest = ws.slice(k + 1).reduce((a, x) => a + (x.end - x.t), 0);
    if (/[.!?]["')\]]*$/.test(w.word) || (span > 2.2 && /[,;:]$/.test(w.word)) || (span > 3.6 && rest > 1)) close(); });
  close();
  return out;
}

/** The step: the compact skill, Edit mastery's menu as a digest, this clip's sentences. */
export function menuStep(sentences: Sentence[], menu: Menu, brief = '', ranks: Map<number, string[]> = new Map()) {
  const skill = skillPrompt('edit', 'compact');
  const doodles = (d: MenuDevice) => doodleNames(d).length ? `\n  doodle is one of: ${doodleNames(d).map(n => `${n} (${(d.doodles![n] as { use: string }).use})`).join('; ')}` : '';
  const devices = menu.devices.map(d => `- ${d.id}: ${d.use}${slotsOf(d).length ? ` [give: ${slotsOf(d).join(', ')}]` : ''}${doodles(d)}`).join('\n');
  const slots = Object.entries(menu.slots).filter(([k]) => !k.startsWith('{sfx') && !k.startsWith('{music') && !['{line}', '{last}'].includes(k)).map(([k, v]) => `${k} ${v}`).join('\n');
  const system = [
    skill.text,
    'You direct this edit from the approved library menu below; you never invent a device. Per sentence pick one device id (or "speaker"), and give the words its slots need, copied from that sentence as spoken.',
    `RULES:\n${menu.rules.map(r => `- ${r}`).join('\n')}`,
    `DEVICES:\n${devices}`,
    `SLOTS:\n${slots}`,
    ...(ranks.size ? ['A sentence may carry the library graph\'s ranking of menu devices for what it says (library: …): a hint from the craft graph; you still pick for the sentence.'] : []),
    ...(menu.coverage ? [`EVERY FILM MUST SHOW (the owner's checklist; a film that misses one is sent back):\n${menu.coverage.picked.map(c => `- ${c.what}${c.min ? ` (at least ${c.min})` : ''}: one of ${c.devices.join(', ')}`).join('\n')}\n- a short clip (under 6 sentences): ${menu.coverage.short_clip ?? 'as many as fit'}\nLight leaks, the grade, the music and the sounds are added by code: never pick them.`] : []),
    `Answer one JSON object: { "caption": one of ${JSON.stringify(menu.captions.allowed)}, "mood": "<one word for the music bed>", "beats": [ { "i": <sentence number>, "device": "<id>", "hero": "<word>", ...the slots it needs } ] }, one beat per sentence.`,
  ].join('\n\n');
  const prompt = [`BRIEF: ${brief.trim().slice(0, 200) || '(none)'}`, 'SENTENCES (number [start s] words):', ...sentences.map(s => `${s.i} [${s.t0.toFixed(1)}] ${s.text}${ranks.get(s.i)?.length ? ` (library: ${ranks.get(s.i)!.join(', ')})` : ''}`)].join('\n');
  return { system, prompt, tokens: estimateTokens(system) + estimateTokens(prompt), skillTokens: skill.tokens };
}

export interface Pick { i: number; device: string; doodle?: string; hero?: string; hero2?: string; name?: string; role?: string; phrase?: string; number?: string; next?: string; unit?: string; chars?: string; items?: string[]; still?: number; footage?: string }
export interface MenuAnswer { caption?: string; mood?: string; beats: Pick[] }

const norm = (s: string) => s.toLowerCase().normalize('NFKD').replace(/[^\p{L}\p{N}]/gu, '');
const FULL_SCREEN = new Set(['split', 'card', 'corner-br', 'corner-tl', 'corner-tr']);
/** a device that leaves the full-frame speaker (the menu's leak returns from it) */
const awayFromSpeaker = (d: MenuDevice) => !!d.places || d.layers.some(l => l.t === 'mg' || l.t === 'desk' || FULL_SCREEN.has(String(l.form ?? '')));

/** Check the picks against the menu, the rules and the sentences: plain problems per beat (empty = all fine). Pure. */
/**
 * The answer numbered one sentence off (a small model counts from 1, or skips the first): when moving every beat by
 * one sentence puts strictly more of its slot words in the sentence that says them, the whole answer moves. The words
 * decide, never the device. Pure.
 */
export function realignPicks(a: MenuAnswer, sentences: Sentence[], menu: Menu): { answer: MenuAnswer; shift: number } {
  const byId = new Map(menu.devices.map(d => [d.id, d])), byI = new Map(sentences.map(s => [s.i, s]));
  const wordsOf = (b: Pick) => { const d = byId.get(b.device); if (!d) return []; return slotsOf(d).filter(k => !['still', 'footage', 'role', 'doodle', 'next'].includes(k)).flatMap(k => { const v = (b as unknown as Record<string, unknown>)[k]; return Array.isArray(v) ? v.map(String) : v === undefined || v === null || v === '' ? [] : [String(v)]; }); };
  const said = (s: Sentence | undefined, text: string) => { if (!s) return false; const w = new Set(s.words.map(x => norm(x.word))); const t = text.split(/\s+/).filter(Boolean); return t.length > 0 && t.every(x => w.has(norm(x))); };
  const fit = (shift: number) => (a.beats ?? []).filter(b => { const ws = wordsOf(b); return ws.length > 0 && ws.every(t => said(byI.get(b.i + shift), t)); }).length;
  const base = fit(0), best = [-1, 1].map(k => ({ k, n: fit(k) })).sort((x, y) => y.n - x.n)[0]!;
  if (!Array.isArray(a.beats) || best.n <= base) return { answer: a, shift: 0 };
  return { answer: { ...a, beats: a.beats.map(b => ({ ...b, i: b.i + best.k })).filter(b => byI.has(b.i)) }, shift: best.k };
}

export function checkPicks(a: MenuAnswer, sentences: Sentence[], menu: Menu, previous: string[] = []): { problems: string[]; bad: Set<number> } {
  const problems: string[] = [], bad = new Set<number>(), byId = new Map(menu.devices.map(d => [d.id, d]));
  const said = (s: Sentence, text: string) => { const w = new Set(s.words.map(x => norm(x.word))); return text.split(/\s+/).filter(Boolean).every(t => w.has(norm(t))); };
  const flag = (i: number, why: string) => { problems.push(`sentence ${i}: ${why}`); bad.add(i); };
  if (a.caption !== undefined && !menu.captions.allowed.includes(String(a.caption))) problems.push(`caption "${a.caption}" is not one of ${menu.captions.allowed.join(', ')}`);
  let prev = '', desks = 0, leaks = 0, prevAway = false;
  const beats = [...(a.beats ?? [])].sort((x, y) => x.i - y.i);
  beats.forEach((b, k) => {
    const s = sentences.find(x => x.i === b.i); if (!s) { problems.push(`sentence ${b.i} does not exist`); return; }
    const d = byId.get(b.device); if (!d) { flag(b.i, `"${b.device}" is not a device in the menu`); return; }
    if (b.device !== 'speaker' && b.device === prev) flag(b.i, `"${b.device}" twice in a row`);
    if (((k === 0 && awayFromSpeaker(d)) || (k === beats.length - 1 && b.device !== 'speaker' && b.device !== 'punch'))) flag(b.i, k === 0 ? 'the first beat keeps the speaker full frame' : 'the last beat is the speaker');
    for (const slot of slotsOf(d)) {
      const v = (b as unknown as Record<string, unknown>)[slot];
      if (slot === 'still' || slot === 'footage') { if (slot === 'footage' && (typeof v !== 'string' || !v.trim())) flag(b.i, `${b.device} needs "footage" (what the footage shows)`); continue; }
      if (slot === 'role') continue;
      if (slot === 'doodle') { if (!doodleNames(d).includes(String(v))) flag(b.i, `${b.device} needs "doodle", one of ${doodleNames(d).join(', ')}`); continue; }
      if (v === undefined || v === null || v === '' || (Array.isArray(v) && !v.length)) { flag(b.i, `${b.device} needs "${slot}"`); continue; }
      for (const t of Array.isArray(v) ? v : [String(v)]) if (!['next'].includes(slot) && !said(s, String(t))) flag(b.i, `"${t}" (${slot}) is not said in that sentence: on-screen words are the speaker's own`);
    }
    if (d.desk_item && String(d.desk_item.label ?? '').includes('{phrase}') && String(b.phrase ?? '').length > 16) flag(b.i, `the print's label "${b.phrase}" is over 16 characters`);
    if (d.places) { desks++; if (desks > d.places.length) flag(b.i, `at most ${d.places.length} ${d.id} per film`); }
    if (b.device === 'leak') { leaks++; if (!prevAway) flag(b.i, 'a leak only returns to the speaker after a desk-print or a full-screen device'); if (leaks > 3) flag(b.i, 'at most three leaks'); }
    prev = b.device; prevAway = awayFromSpeaker(d);
  });
  // the owner's checklist: every film shows a burned-in graphic, a form change, a full-screen beat and the punches
  if (menu.coverage && beats.length) {
    const used = beats.map(b => b.device), short = sentences.length < 6;
    const miss = menu.coverage.picked.filter(c => used.filter(u => c.devices.includes(u)).length < (short ? 1 : c.min ?? 1));
    const need = short ? miss.filter(c => c.id === 'burn' || c.id === 'camera' || (c.id === 'form' && miss.some(x => x.id === 'fullscreen'))) : miss;
    for (const c of need) problems.push(`the film needs ${c.what}${c.min && !short ? ` (at least ${c.min})` : ''}: give a sentence one of ${c.devices.join(', ')}`);
  }
  // two clips never get the same film: not the last film's device sequence again
  const seq = deviceSequence(a);
  if (seq.length >= 2 && seq.join(' ') === previous.join(' ')) problems.push(`the same devices in the same order as the last film (${seq.join(', ')}): pick for this clip`);
  return { problems: [...new Set(problems)].slice(0, 14), bad };
}

const STOP = new Set('a an the and or but so to of in on at for with from by is are was were be been it its this that these those i you we he she they my your our their me us them will can just very really going about into as if then than also because which who what when where how not no yes do does did have has had am'.split(' '));
/** the beat's hero: its longest content word (the speaker's own) */
const heroOf = (s: Sentence) => [...s.words].filter(w => !STOP.has(norm(w.word)) && norm(w.word).length > 2).sort((a, b) => norm(b.word).length - norm(a.word).length)[0]?.word.replace(/[^\p{L}\p{N}'-]/gu, '');
/**
 * The owner's checklist made whole by code when the model missed part of it (owner, 2026-10-18: every edit shows it, at
 * least 80-90%). Only the menu's approved devices, filled with this clip's own words: a glass widget of the beat's own
 * hero words (burned in), the look flip (a form change), a desk print of real footage of the hero word (full screen),
 * punches on hero words. The model's valid picks stay; bad ones and gaps are what it fills. Pure.
 */
export function completeCoverage(a: MenuAnswer | null, sentences: Sentence[], menu: Menu, bad = new Set<number>()): MenuAnswer {
  const byId = new Map(menu.devices.map(d => [d.id, d]));
  const beats: Pick[] = sentences.map(s => { const b = a?.beats?.find(x => x.i === s.i); return b && !bad.has(s.i) && byId.has(b.device) ? b : { i: s.i, device: 'speaker' }; });
  if (!menu.coverage) return { ...(a ?? {}), beats };
  const n = beats.length, used = () => beats.map(b => b.device);
  const free = (k: number, away: boolean) => beats[k]!.device === 'speaker' && k < n - 1 && (!away || k > 0) && beats[k - 1]?.device !== beats[k]!.device;
  const fillers: Record<string, (s: Sentence) => Pick | null> = {
    burn: s => { const h = heroOf(s); if (!h) return null; const at = s.words.findIndex(w => norm(w.word) === norm(h)); const phrase = s.words.slice(Math.max(0, at - 1), at + 1).map(w => w.word.replace(/[^\p{L}\p{N}'-]/gu, '')).join(' '); return { i: s.i, device: 'glass-widgets', hero: h, phrase }; },
    form: s => ({ i: s.i, device: 'look-flip', hero: heroOf(s) ?? '' }),
    fullscreen: s => { const h = heroOf(s), q = s.words.map(w => w.word.replace(/[^\p{L}\p{N}'-]/gu, '')).filter(w => w && !STOP.has(norm(w))).slice(0, 5).join(' '); return h && h.length <= 16 && q ? { i: s.i, device: 'desk-print', hero: h, phrase: h, footage: q, doodle: 'underline' } : null; },
    camera: s => { const h = heroOf(s); return h ? { i: s.i, device: 'punch', hero: h } : null; },
  };
  const wantOf = (c: { min?: number }) => (sentences.length < 6 ? 1 : c.min ?? 1);
  // no free sentence left: a device the checklist has more of than it needs (a second punch on a short clip) gives its place up
  const spare = (k: number) => { const d = beats[k]!.device; return d !== 'speaker' && k < n - 1 && menu.coverage!.picked.every(c => !c.devices.includes(d) || used().filter(u => c.devices.includes(u)).length > wantOf(c)); };
  for (const c of menu.coverage.picked) {
    const want = wantOf(c);
    while (used().filter(u => c.devices.includes(u)).length < want) {
      const away = c.id === 'fullscreen' || c.id === 'form';
      const longest = [...beats.keys()].sort((x, y) => (sentences[y]!.t1 - sentences[y]!.t0) - (sentences[x]!.t1 - sentences[x]!.t0));
      const fits = (j: number) => !(away && (j === 0 || (beats[j - 1] && awayFromSpeaker(byId.get(beats[j - 1]!.device)!)) || (beats[j + 1] && awayFromSpeaker(byId.get(beats[j + 1]!.device)!))));
      const k = longest.find(j => free(j, away) && !(away && (beats[j - 1] && awayFromSpeaker(byId.get(beats[j - 1]!.device)!)))) ?? longest.find(j => spare(j) && fits(j));
      const pick = k === undefined ? null : fillers[c.id]?.(sentences[k]!) ?? null;
      if (k === undefined || !pick) break;
      beats[k] = pick;
    }
  }
  return { ...(a ?? {}), beats };
}

/** the film's devices in order, the plain speaker left out (what "the same film" compares) */
export const deviceSequence = (a: MenuAnswer) => [...(a.beats ?? [])].sort((x, y) => x.i - y.i).map(b => b.device).filter(d => d !== 'speaker');

/* ───── filling the slots ───── */
type Anchor = { w: string; after: number; dt?: number };
const anchorOf = (s: Sentence, word: string | undefined, fallback: 'first' | 'last' = 'first'): Anchor => {
  const w = word ? s.words.find(x => norm(x.word) === norm(word)) : undefined;
  const pick = w ?? (fallback === 'last' ? s.words.at(-1)! : s.words[0]!);
  return { w: pick.word.toLowerCase().replace(/[^a-z0-9]/g, '') || norm(pick.word), after: +Math.max(0, s.t0 - 0.01).toFixed(3) };
};

export interface Resolved { sounds: Record<string, string>; music: { file: string; start: number; gain: number } | null; footage: Record<number, string>; /** palette + theme from the footage (or the brand) */ look?: { palette: Record<string, string>; theme: Record<string, unknown> } | null }

/** Fill one device's templates for one sentence; null when a slot cannot be filled (the beat then plays as the speaker). */
export function fillDevice(d: MenuDevice, b: Pick, s: Sentence, o: { place?: Record<string, number | number[]>; footageSrc?: string | null }): { layers: Record<string, unknown>[]; sfx: Record<string, unknown>[]; deskItem?: Record<string, unknown> } | null {
  const text: Record<string, unknown> = { name: b.name, role: b.role, phrase: b.phrase, number: b.number, next: b.next, unit: b.unit, chars: b.chars, items: b.items, still: b.still ?? +(((s.t0 + s.t1) / 2).toFixed(2)) };
  const anchors: Record<string, Anchor> = { line: anchorOf(s, undefined), hero: anchorOf(s, b.hero), hero2: anchorOf(s, b.hero2 ?? b.hero, 'last'), last: anchorOf(s, undefined, 'last') };
  let missing = false;
  const fill = (v: unknown): unknown => {
    if (Array.isArray(v)) return v.map(fill);
    if (v && typeof v === 'object') { const out: Record<string, unknown> = {}; for (const [k, x] of Object.entries(v)) { const f = fill(x); if (f !== undefined) out[k] = f; } return out; }
    if (typeof v !== 'string') return v;
    let m = v.match(/^\{(line|hero|hero2|last)\}(?:\+([\d.]+))?$/); if (m) return { ...anchors[m[1]!]!, ...(m[2] ? { dt: +m[2] } : {}) };
    m = v.match(/^\{sfx:(\w+)\}$/); if (m) return m[1];
    m = v.match(/^\{place\.(\w+)\}$/); if (m) return o.place?.[m[1]!];
    if (v === '{doodle}') { const x = d.doodles?.[String(b.doodle)]; if (!x || typeof x === 'string') { missing = true; return undefined; } return x.paths; }
    if (/^\{footage:<query>\}$/.test(v)) { if (!o.footageSrc) missing = true; return o.footageSrc ?? undefined; }
    m = v.match(/^\{(\w+)(?:\[(\d+)\])?\}$/);
    if (m) {
      const x = text[m[1]!], val = m[2] !== undefined ? (Array.isArray(x) ? x[+m[2]] : typeof x === 'string' ? x[+m[2]] : undefined) : x;
      if (val === undefined || val === null || val === '') { if (m[1] !== 'role') missing = true; return undefined; }
      return val;
    }
    return v;
  };
  const layers = fill(d.layers) as Record<string, unknown>[], sfx = (fill(d.sfx ?? []) as Record<string, unknown>[]);
  const deskItem = d.desk_item ? { ...(fill(d.desk_item) as Record<string, unknown>), ...Object.fromEntries(Object.entries(o.place ?? {}).filter(([k]) => k !== 'focus')) } : undefined;
  return missing ? null : { layers, sfx, ...(deskItem ? { deskItem } : {}) };
}

/** The spec from the picks (code fills the menu's slots; a pick it cannot fill plays as the speaker). */
export function specFromPicks(a: MenuAnswer, sentences: Sentence[], menu: Menu, res: Resolved, bad = new Set<number>()): Record<string, unknown> {
  const byId = new Map(menu.devices.map(d => [d.id, d])), speaker = byId.get('speaker')!;
  const beats: Record<string, unknown>[] = [], sfx: Record<string, unknown>[] = [], items: Record<string, unknown>[] = [];
  let deskN = 0, desk: { w: number; h: number } | null = null, wasAway = false;
  const leak = menu.auto?.leak, push = menu.auto?.push?.push;
  for (const s of sentences) {
    const b = a.beats.find(x => x.i === s.i);
    let d = b && !bad.has(s.i) ? byId.get(b.device) ?? speaker : speaker;
    const place = d.places ? d.places[deskN] : undefined;
    let f = fillDevice(d, b ?? { i: s.i, device: 'speaker' }, s, { ...(place ? { place } : {}), footageSrc: res.footage[s.i] ?? null });
    if (!f || (d.places && !place)) { d = speaker; f = fillDevice(speaker, { i: s.i, device: 'speaker' }, s, {})!; }
    if (d.places && f.deskItem) { items.push(f.deskItem); deskN++; desk = d.desk ?? desk; }
    let layers = f.layers;
    // a plain speaker hold over 3 s gets a slow push (eased from rest); the beat after an away beat opens on a leak
    if (push && d.id === 'speaker' && s.t1 - s.t0 > 3) layers = layers.map(l => l.t === 'cam' && l.push === undefined && !l.punch ? { ...l, push } : l);
    if (leak && wasAway && !awayFromSpeaker(d)) { const lf = fillDevice({ id: 'leak', use: '', layers: leak.layers, sfx: leak.sfx ?? [] }, { i: s.i, device: 'leak' }, s, {}); if (lf) { layers = [...layers, ...lf.layers]; sfx.push(...lf.sfx); } }
    wasAway = awayFromSpeaker(d);
    beats.push({ from: anchorOf(s, undefined), layers });
    sfx.push(...f.sfx);
  }
  const lastS = sentences.at(-1);
  if (lastS && menu.end?.sfx) sfx.push(...(fillDevice({ id: 'end', use: '', layers: [], sfx: menu.end.sfx }, { i: lastS.i, device: 'end' }, lastS, {})?.sfx ?? []));
  const caption = menu.captions.allowed.includes(String(a.caption)) ? String(a.caption) : menu.captions.default;
  return {
    caption: { variant: caption, preset: caption, accent: menu.captions.accent },
    ...(sentences[0] ? { start: anchorOf(sentences[0], undefined) } : {}),
    ...(res.music ? { music: res.music } : {}),
    ...(res.look ? { palette: res.look.palette, theme: res.look.theme } : {}),
    ...(Object.keys(res.sounds).length ? { sounds: res.sounds } : {}),
    ...(items.length && desk ? { desk: { ...desk, items } } : {}),
    beats, sfx,
  };
}

/* ───── the library, per video ───── */
/** {sfx:<event>}: a file per event from the graph's library (assetsForEvent), rotated by this clip's seed, never the same pick for every film. */
export async function resolveSounds(events: string[], seed: number): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  if (!events.length || !(await needGraph('edit: the sound library'))) return out;
  for (const ev of [...new Set(events)]) {
    const rows = (await run<{ file: string | null; then: boolean }>(CRAFT, L.assetsForEvent, { event: ev, category: 'sfx', shipOnly: true })).filter(r => r.file && !r.then);
    if (!rows.length) continue;
    const f = String(rows[(seed + ev.length) % rows.length]!.file).replace(/\\/g, '/'), k = f.lastIndexOf('assets/');
    const rel = k >= 0 ? f.slice(k + 7) : f;
    if (existsSync(join(config.assets, rel))) out[ev] = rel;
  }
  return out;
}

/** {music:<mood>}: a bed from the library for the clip's words and the model's mood, copied into the edit folder for the player. */
export async function resolveMusic(dir: string, lines: string[], mood: string, seconds: number, signal?: AbortSignal): Promise<Resolved['music']> {
  const { fxMusic } = await import('./effects/music');
  const bed = await fxMusic([mood, ...lines].filter(Boolean), seconds, signal ? { signal } : {});
  if (!bed) return null;
  const name = `bed${extname(bed.file) || '.mp3'}`; copyFileSync(bed.file, join(dir, name));
  return { file: `../../../v/${name}`, start: 2, gain: 0.07 };
}

/** the first accepted clip with no text burned in (its words and the caption would be two text layers at once) */
export async function textFree<C extends { path?: string; duration?: number; width?: number; height?: number }>(clips: C[], look?: (f: string, d: number, w: number, h: number) => Promise<unknown[]>): Promise<C | null> {
  const see = look ?? (await import('./burned')).lookText;
  for (const c of clips) { if (!c.path || !existsSync(c.path)) continue; const bands = await see(c.path, c.duration ?? 8, c.width ?? 1080, c.height ?? 1920).catch(() => []); if (!bands.length) return c; }
  return null;
}

/** {footage:<query>}: a real clip per desk-print beat from the footage finder (none with burned-in text), copied into the edit folder. */
export async function resolveFootage(dir: string, picks: Pick[], signal?: AbortSignal): Promise<Record<number, string>> {
  const { findClipsOrStill } = await import('../footage');
  const out: Record<number, string> = {};
  for (const b of picks.filter(p => p.footage)) {
    try {
      const r = await findClipsOrStill(String(b.footage), { dir: join(dir, 'footage', '.search', `s${b.i}`), want: 3, tries: 6, seconds: 6, w: 1080, h: 1080, ...(signal ? { signal } : {}) });
      const c = await textFree(r.accepted); if (!c?.path) continue;
      mkdirSync(join(dir, 'footage'), { recursive: true }); copyFileSync(c.path, join(dir, 'footage', `s${b.i}.mp4`));
      out[b.i] = `../../../v/footage/s${b.i}.mp4`;
    } catch (e) { console.warn(`[edit] footage "${b.footage}": ${String((e as Error).message ?? e).slice(0, 120)}`); }
  }
  return out;
}

/**
 * The Designer's library cast (decision 19, per-video library use): per sentence, the craft graph's named query editCast
 * ranks the edit registry for what the sentence does and the verbs it says; a menu device ranks by its best-ranked layer.
 * The model reads it as a hint and still picks from the menu (the menu, its rules and the checks are unchanged).
 */
export async function libraryRanks(ss: Sentence[], menu: Menu, top = 3): Promise<Map<number, string[]>> {
  const { openCaster, readSentences } = await import('./beatspec');
  const caster = await openCaster(), out = new Map<number, string[]>();
  await Promise.all(ss.map(async s => {
    const r = readSentences(s.words as never); if (!r.length) return;
    const rows = await caster.cast({ fn: r[0]!.fn, verbs: [...new Set(r.flatMap(x => x.verbs))], recent: [], n: 8 });
    const rank = new Map<string, number>(); rows.forEach((x, k) => { if (!rank.has(x.edit.device)) rank.set(x.edit.device, k); });
    const ids = menu.devices.filter(d => d.id !== 'speaker').map(d => ({ id: d.id, k: Math.min(99, ...d.layers.map(l => rank.get(String(l.t)) ?? 99)) }))
      .filter(x => x.k < 99).sort((a, b) => a.k - b.k).slice(0, top).map(x => x.id);
    if (ids.length) out.set(s.i, ids);
  }));
  return out;
}

const PickShape = { caption: z.string().optional(), mood: z.string().optional(), beats: z.array(z.object({ i: z.number(), device: z.string() }).passthrough()) };

/** Ask, check, one repair re-ask with the exact errors; then the picks that pass (the rest play as the speaker). */
export async function directFromMenu(i: { sentences: Sentence[]; brief?: string; /** the Designer's library ranking per sentence (libraryRanks) */ ranks?: Map<number, string[]>; /** the last film's device sequence (rejected if repeated) */ previous?: string[]; /** lanes not to use (the compact step after Claude Code did not answer) */ skipLanes?: ('claude-code' | 'key' | 'server')[]; signal?: AbortSignal; log?: (s: string) => void }): Promise<Checked<{ answer: MenuAnswer; bad: Set<number> } | null> & { tokens: number }> {
  const menu = loadMenu(), step = menuStep(i.sentences, menu, i.brief ?? '', i.ranks);
  let last: { answer: MenuAnswer; bad: Set<number> } | null = null;
  const r = await askChecked<{ answer: MenuAnswer; bad: Set<number> } | null>({
    label: MENU_AGENT, ...(i.log ? { log: i.log } : {}),
    ask: async (history?: History) => {
      const rt = runtime(); if (!rt.complete) throw new Error(`${rt.name} has no single-answer call`);
      return rt.complete({ agent: MENU_AGENT, system: step.system, prompt: step.prompt, schema: PickShape, model: 'brain', deadlineMs: 120_000, ...(i.skipLanes ? { skipLanes: i.skipLanes } : {}), ...(history ? { history } : {}), ...(i.signal ? { signal: i.signal } : {}) });
    },
    read: raw => {
      let a: MenuAnswer;
      try { a = (raw && typeof raw === 'object' ? raw : JSON.parse(String(raw).replace(/^```(json)?|```$/g, '').trim())) as MenuAnswer; } catch { return { ok: false, problems: ['not one JSON object'] }; }
      if (!Array.isArray(a.beats)) return { ok: false, problems: ['"beats" must be a list, one beat per sentence'] };
      const re = realignPicks(a, i.sentences, menu); if (re.shift) { a = re.answer; i.log?.(`${MENU_AGENT}: the answer was numbered one sentence off (${re.shift > 0 ? '+' : ''}${re.shift}); moved to the sentences that say its words`); }
      const c = checkPicks(a, i.sentences, menu, i.previous ?? []); last = { answer: a, bad: c.bad };
      return c.problems.length ? { ok: false, problems: c.problems } : { ok: true, value: { answer: a, bad: c.bad } };
    },
    fallback: () => last,
  });
  return { ...r, tokens: step.tokens };
}
