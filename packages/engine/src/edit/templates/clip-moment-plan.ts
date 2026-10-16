import { CM_ICONS, type CmBeat, type CmIcon, type CmScript, type CmShow, type CmTheme } from './clip-moment';

/**
 * Clip Moment for ANY topic: the plain script lines become beats by content (pure, deterministic, tested). Each line
 * gets 1 or 2 concrete on-screen nouns as its Mixkit search (Tab2/Tab3: "one or two plain nouns or actions per line"),
 * one Buckology component chosen from what the line says (a year flips, a number counts, two numbers compare, a list
 * stacks tiles, a question ends), a kicker chip and one accent word. No model call: the same lines give the same plan.
 */

const STOP = new Set('a an the and or but so of to in on at by for from with into onto over under than then that this these those it its it\'s is are was were be been being has have had do does did can could will would should may might must not no yes you your we our they their them he she his her i me my us as if when while where which who whom what why how all any each every some more most much many very just also too only even still own same such here there out up down off about after before again once both few other own s t d ll re ve y'.split(' '));
/** words that name no picture */
const ABSTRACT = new Set('way ways thing things part parts time times kind lot lots idea ideas reason reasons fact facts number numbers work works working make makes made take takes took get gets got give gives keep keeps let lets put puts say says said tell tells told think thinks know knows mean means need needs want wants use uses used using like look looks feel come comes came go goes went turn turns start starts happen happens one two three four five six seven eight nine ten first second third next last new old big small whole real simple really actually basically every each almost about around enough less least million billion trillion thousand hundred percent year years day days'.split(' '));
/** a spoken word → what Mixkit has a clip of (concrete, on screen) */
export const CM_VISUAL: Record<string, string> = {
  bus: 'bus', buses: 'bus', driver: 'bus driver', passenger: 'passengers', passengers: 'passengers', rider: 'passengers', riders: 'passengers',
  engine: 'car engine', engines: 'car engine', diesel: 'diesel engine', motor: 'engine', fuel: 'fuel pump', gas: 'gas station', petrol: 'gas station',
  gear: 'gears', gears: 'gears', gearbox: 'gears', transmission: 'gears', clutch: 'gears', wheel: 'wheel', wheels: 'wheel', tyre: 'tire', tire: 'tire', tires: 'tire',
  brake: 'car brakes', brakes: 'car brakes', braking: 'car brakes', compressor: 'air compressor', gauge: 'pressure gauge',
  door: 'bus door', doors: 'bus door', stop: 'bus stop', stops: 'bus stop', route: 'city street', routes: 'city street', street: 'city street', road: 'highway',
  traffic: 'city traffic', city: 'city traffic', cities: 'city traffic', commute: 'commuters', ticket: 'ticket', tickets: 'ticket', station: 'train station',
  money: 'money', dollars: 'money', cash: 'cash', price: 'money', paid: 'money', pay: 'money', bank: 'bank', profit: 'money', revenue: 'money',
  phone: 'smartphone', phones: 'smartphone', app: 'smartphone', computer: 'computer', laptop: 'laptop', chip: 'microchip', chips: 'microchip', code: 'coding', ai: 'technology',
  game: 'video game', games: 'video game', gaming: 'video game', player: 'gamer', players: 'gamer', console: 'video game',
  rocket: 'rocket launch', space: 'space', planet: 'planet', moon: 'moon', mars: 'mars', star: 'stars', stars: 'stars', earth: 'earth',
  factory: 'factory', robot: 'robot', robots: 'robot', car: 'car', cars: 'car', truck: 'truck', train: 'train', plane: 'airplane', airplane: 'airplane', ship: 'cargo ship',
  water: 'water', fire: 'fire', electricity: 'electricity', battery: 'battery', power: 'power lines', solar: 'solar panels', food: 'food', coffee: 'coffee', office: 'office',
  people: 'crowd', crowd: 'crowd', kids: 'children', school: 'school', doctor: 'doctor', hospital: 'hospital', store: 'store', shop: 'shopping',
};
const ICON: Record<string, CmIcon> = { stop: 'globe', stops: 'globe', timetable: 'chart', timetables: 'chart', schedule: 'chart', transfer: 'deal', transfers: 'deal', money: 'coin', cash: 'coin', price: 'coin', film: 'film', movie: 'film', tv: 'film', product: 'box', products: 'box', box: 'box', deal: 'deal', partner: 'deal', people: 'people', passengers: 'people', phone: 'phone', app: 'phone', chip: 'chip', engine: 'chip', world: 'globe', city: 'globe', route: 'globe', video: 'play', game: 'play', shop: 'cart', store: 'cart', growth: 'chart', sales: 'chart' };

/** a search → broader searches Mixkit answers (walked, in order, before a clip is ever reused) */
export const CM_BROADER: Record<string, string[]> = {
  bus: ['city bus', 'bus driving', 'public transport'], 'bus driver': ['driver steering wheel', 'bus'], passengers: ['commuters', 'people on bus', 'crowd'],
  'diesel engine': ['engine', 'truck engine', 'mechanic engine', 'motor'], 'car engine': ['engine', 'mechanic engine', 'motor'], engine: ['car engine', 'mechanic', 'machine'],
  'fuel pump': ['gas station', 'fuel'], 'gas station': ['fuel pump', 'refueling'], gears: ['machine gears', 'gear', 'machinery', 'gear shift'], wheel: ['car wheel', 'tire', 'wheels turning'],
  tire: ['wheel', 'car wheel'], 'car brakes': ['brake', 'car wheel', 'braking', 'tire'], 'air compressor': ['compressor', 'pressure gauge', 'air pressure', 'tools'], 'pressure gauge': ['gauge', 'meter'],
  'bus door': ['bus doors', 'door opening', 'subway doors', 'train doors'], 'bus stop': ['people waiting bus', 'bus station', 'waiting'], 'city street': ['street', 'city traffic', 'downtown'],
  'city traffic': ['traffic', 'city street', 'cars'], highway: ['road', 'traffic'], commuters: ['passengers', 'crowd'], ticket: ['ticket machine', 'payment'], 'train station': ['train', 'station'],
  money: ['cash', 'dollar bills', 'coins'], cash: ['money', 'dollar bills'], smartphone: ['phone', 'hands phone'], computer: ['laptop', 'typing'], laptop: ['computer', 'typing'], microchip: ['circuit board', 'technology'],
  coding: ['programmer', 'code screen'], technology: ['circuit board', 'data center'], 'video game': ['gamer', 'gaming'], gamer: ['gaming', 'video game'], 'rocket launch': ['rocket', 'space'], space: ['stars', 'galaxy'],
  car: ['cars', 'driving'], truck: ['trucks', 'highway'], train: ['railway', 'train station'], airplane: ['plane', 'airport'], 'cargo ship': ['ship', 'port'], crowd: ['people', 'city crowd'],
  factory: ['industry', 'machinery'], robot: ['robotic arm', 'technology'], 'power lines': ['electricity', 'power plant'], battery: ['charging', 'electricity'],
};
/** words that name a part or a mechanism: a line with them is a "how it works" line (diagram callouts) */
export const CM_MECH = new Set('engine engines motor gearbox gear gears transmission clutch brake brakes compressor crankshaft piston pistons valve valves pump tank tanks wheel wheels axle battery chip circuit sensor turbine fan door doors cable spring lever shaft fuel torque pedal steering radiator exhaust filter hydraulic hydraulics'.split(' '));
const MECH_VERBS = /\b(spins?|turns?|burns?|pushes|pumps?|opens?|closes?|compress(es)?|powers?|drives?|keeps?|moves?|rotates?|works?)\b/i;
const MODS = new Set('air diesel rear front automatic electric hydraulic main big'.split(' '));

const words = (s: string) => (s.toLowerCase().match(/[a-z0-9']+/g) ?? []).map(w => w.replace(/'s$/, ''));
const content = (s: string) => words(s).filter(w => w.length > 2 && !STOP.has(w) && !ABSTRACT.has(w) && !/^\d/.test(w));

/** The line's words that name a picture, in order (a word after "to" is a verb: "to stop"). */
export function visualWords(line: string): string[] {
  const all = words(line);
  return all.filter((w, k) => CM_VISUAL[w] && all[k - 1] !== 'to');
}

/** The line's on-screen nouns, best first: mapped visuals first (by order), then plain content words. */
export function cmNouns(line: string): string[] {
  const vis = new Set(visualWords(line));
  const ws = content(line).filter(w => !CM_VISUAL[w] || vis.has(w)), mapped = ws.filter(w => CM_VISUAL[w]).map(w => CM_VISUAL[w]!), plain = ws.filter(w => !CM_VISUAL[w]);
  return [...new Set([...mapped, ...plain])];
}

/**
 * Mixkit searches for a line, a ladder most specific first: its on-screen nouns (2 to 4 concrete queries, the topic's
 * own version first, "bus engine" before "engine"), then broader synonyms of each (CM_BROADER), then the topic itself.
 * The picker searches the first rungs at once and walks down only when nothing licence-clean matches.
 */
export function cmQueries(line: string, topic?: string): string[] {
  const all = cmNouns(line).filter(x => x.length > 2), vis = new Set(Object.values(CM_VISUAL));
  // only words that name a picture (a mapped visual or a part): "air" alone finds balloons, not brakes
  const strong = all.filter(x => vis.has(x) || CM_MECH.has(x)), n = (strong.length ? strong : all).slice(0, 3), head = topic?.split(' ').at(-1), out: string[] = [];
  const add = (q?: string) => { if (q && !out.includes(q)) out.push(q); };
  for (const x of n) {
    if (head && !x.includes(head) && !(topic ?? '').includes(x)) add(`${head} ${x.split(' ').at(-1)}`);
    add(x);
  }
  for (const x of n) for (const b of (CM_BROADER[x] ?? []).slice(0, 3)) add(b);
  if (topic) add(topic);
  for (const b of topic ? CM_BROADER[topic] ?? [] : []) add(b);
  return out.length ? out.slice(0, 12) : ['abstract background'];
}

/** The script's subject: the on-screen noun named most often (first seen breaks ties). */
export function cmTopic(lines: string[]): string | undefined {
  // the subject is named in the hook: of the first line's on-screen nouns, the one whose words recur most in the whole
  // script, the shorter (more general) search breaking ties
  const first = cmNouns(lines[0] ?? '').filter(n => Object.values(CM_VISUAL).includes(n));
  if (!first.length) return cmNouns(lines.join(' '))[0];
  const all = words(lines.join(' '));
  const score = (n: string) => visualWordsOf(n, lines[0]!).reduce((a, w) => a + all.filter(x => x === w).length, 0);
  return [...first].sort((a, b) => score(b) - score(a) || a.length - b.length)[0];
}
const visualWordsOf = (noun: string, line: string) => visualWords(line).filter(w => CM_VISUAL[w] === noun);

const NUM = /(\$)?(\d[\d,]*(?:\.\d+)?)\s*(million|billion|trillion|thousand|percent|%|[mbk]\b)?/gi;
const MULT: Record<string, [number, string]> = { thousand: [1e3, 'K'], k: [1e3, 'K'], million: [1, 'M'], m: [1, 'M'], billion: [1, 'B'], b: [1, 'B'], trillion: [1, 'T'], percent: [1, '%'], '%': [1, '%'] };
interface Num { raw: string; value: number; prefix: string; suffix: string; year: boolean; decimals: number }
export function numbersIn(line: string): Num[] {
  const out: Num[] = [];
  for (const m of line.matchAll(NUM)) {
    const [raw, dollar, digits, unit] = m as unknown as [string, string | undefined, string, string | undefined];
    const v = parseFloat(digits.replace(/,/g, '')), u = unit?.toLowerCase(), year = !dollar && !u && /^(1[5-9]|20)\d{2}$/.test(digits);
    const [k, suf] = u && MULT[u] ? MULT[u]! : [1, ''];
    out.push({ raw: raw.trim(), value: u === 'thousand' || u === 'k' ? v : v * (k === 1e3 ? 1 : 1), prefix: dollar ? '$' : '', suffix: suf, year, decimals: digits.includes('.') ? digits.split('.')[1]!.length : 0 });
  }
  return out;
}

const iconFor = (s: string): CmIcon => { for (const w of words(s)) if (ICON[w]) return ICON[w]!; return CM_ICONS[(s.length * 7) % CM_ICONS.length]!; };
const title = (s: string) => s.replace(/^\s*(and|or)\s+/i, '').replace(/[.!?]+$/, '').trim().replace(/^./, c => c.toUpperCase());

/** Mark the line's accent word (*word*): a number if it has one, else its strongest on-screen noun. */
export function accentLine(line: string): string {
  if (line.includes('*')) return line;
  const n = numbersIn(line).find(x => !x.year) ?? numbersIn(line)[0];
  if (n) { const tok = line.split(/\s+/).find(t => t.replace(/[^\w$.%,]/g, '').includes(n.raw.split(/\s+/)[0]!.replace(/[^\w$.%,]/g, ''))); if (tok) return line.replace(tok, `*${tok.replace(/[.,!?;:]+$/, '')}*${tok.match(/[.,!?;:]+$/)?.[0] ?? ''}`); }
  const ws = content(line); if (!ws.length) return line;
  const v = visualWords(line).filter((w, k, a) => a.indexOf(w) === k).slice(0, 2);
  const key = v.at(-1) ?? [...ws].sort((a, b) => b.length - a.length)[0]!;
  const re = new RegExp(`\\b(${key})\\b`, 'i');
  return line.replace(re, '*$1*');
}

/** One component for a line, from what it says. */
export function showFor(line: string, i: number, n: number): { show: CmShow; why: string } {
  const nums = numbersIn(line), plain = nums.filter(x => !x.year), years = nums.filter(x => x.year);
  const listPart = line.includes(':') ? line.slice(line.indexOf(':') + 1) : line;
  const items = listPart.replace(/[.!?]+$/, '').split(/,\s*(?:and\s+)?|\s+and\s+/).map(s => s.trim()).filter(Boolean);
  if (plain.length >= 2 && /\b(vs|versus|compared|than|while|but|from)\b/i.test(line)) {
    const [a, b] = plain as [Num, Num];
    const lab = (x: Num) => content(line.slice(line.indexOf(x.raw) + x.raw.length)).slice(0, 1).join(' ') || (x === a ? 'before' : 'after');
    return { show: { kind: 'compare', a: { label: lab(a), value: a.value, display: a.prefix + a.raw.replace(/^\$/, '').replace(/\s*(million|billion|trillion)/i, (_, u: string) => u[0]!.toUpperCase()) }, b: { label: lab(b), value: b.value, display: b.prefix + b.raw.replace(/^\$/, '').replace(/\s*(million|billion|trillion)/i, (_, u: string) => u[0]!.toUpperCase()) } }, why: 'two numbers and a comparison word: compare' };
  }
  if (plain.length >= 1) {
    const x = plain[0]!, after = content(line.slice(line.indexOf(x.raw) + x.raw.length)).slice(0, 2).join(' ');
    return { show: { kind: 'stat', value: x.value, prefix: x.prefix, suffix: x.suffix, decimals: x.decimals, ...(after ? { label: after.toUpperCase() } : {}), bar: 0.86 }, why: 'a number: count it up with a bar' };
  }
  if (years.length === 1) { const y = years[0]!.value; return { show: { kind: 'flip', from: y - 6, to: y, label: content(line).slice(0, 2).join(' ').toUpperCase() }, why: 'a year: flip digits' }; }
  if (items.length >= 3 && items.length <= 5 && items.every(s => s.split(/\s+/).length <= 5)) {
    return { show: { kind: 'list', items: items.slice(-4).map(s => ({ icon: iconFor(s), text: title(s).split(/\s+/).slice(-3).join(' ') })) }, why: 'three or more short items: list tiles' };
  }
  // the beat's one idea in 1 to 3 words: its strongest nouns, the last one accented
  const key = visualWords(line).filter((w, k, a) => a.indexOf(w) === k).slice(0, 2);
  const words2 = key.length ? key : content(line).slice(0, 2);
  const text = words2.map((w, k) => (k === words2.length - 1 ? `*${w}*` : w)).join(' ');
  return { show: { kind: 'headline', text, compact: true, ...(i === 0 ? {} : { sub: `${String(i).padStart(2, '0')} / ${String(n - 1).padStart(2, '0')}` }) }, why: 'a plain line: a compact headline card with its key words' };
}

export interface CmPlanOptions { brand?: string; topic?: string; theme?: CmTheme; credit?: string; cta?: string; qr?: string; wps?: number }
export interface CmPlan { script: CmScript; why: string[]; topic?: string }

/** The part and mechanism words of a line as callout labels ("DIESEL ENGINE", "CRANKSHAFT"), at most 3. */
export function calloutLabels(line: string): string[] {
  const ws = words(line), out: string[] = [];
  ws.forEach((w, k) => {
    if (!CM_MECH.has(w)) return;
    const prev = ws[k - 1], lab = prev && MODS.has(prev) && prev !== 'big' ? `${prev} ${w}` : w;
    if (!out.some(o => o.includes(w))) out.push(lab);
  });
  return out.slice(0, 3);
}
/** A line names a part or a mechanism (two part words, or one and a mechanism verb). */
export const isMechanism = (line: string) => { const n = calloutLabels(line).length; return n >= 2 || (n === 1 && MECH_VERBS.test(line)); };
/** The library 3D object a line's idea asks for (cast through the graph at run time; this is the plan's default). */
export function objFor(line: string, show: CmShow['kind']): { obj: string; needs: string[] } {
  const w = words(line);
  if (show === 'stat' || show === 'compare' || numbersIn(line).some(x => !x.year)) return { obj: '3d:obj-tower', needs: ['number', 'data', 'growth'] };
  if (w.some(x => /^(money|cash|price|paid|pay|profit|revenue|dollars?|cost)$/.test(x))) return { obj: '3d:obj-coin', needs: ['money', 'payoff'] };
  if (w.some(x => /^(city|world|global|country|route|routes|across|town|network)$/.test(x))) return { obj: '3d:obj-dotglobe', needs: ['global', 'network', 'location'] };
  return { obj: '3d:obj-gyro', needs: ['process', 'cycle'] };
}
const OBJ_ALT: Record<string, string[]> = { '3d:obj-gyro': ['3d:obj-gyro', '3d:obj-knot', '3d:obj-cubes'], '3d:obj-tower': ['3d:obj-tower', '3d:obj-cubes'], '3d:obj-coin': ['3d:obj-coin', '3d:obj-tower'], '3d:obj-dotglobe': ['3d:obj-dotglobe', '3d:obj-network'] };
/** A fact card from a line: the line in 2 to 3 short rows, the row with the accent word highlighted. */
function factCard(line: string, topic?: string): CmShow {
  const ws = spokenWords(line), per = Math.ceil(ws.length / Math.min(3, Math.max(2, Math.ceil(ws.length / 5)))), rows: string[] = [];
  for (let k = 0; k < ws.length; k += per) rows.push(ws.slice(k, k + per).join(' '));
  const acc = accentLine(line).match(/\*([^*]+)\*/)?.[1]?.toLowerCase(), hl = Math.max(0, rows.findIndex(r => acc && r.toLowerCase().includes(acc)));
  return { kind: 'source', site: `${(topic ?? 'quick').toUpperCase()} FACT`, title: rows[0] ?? title(line), lines: rows.slice(1).length ? rows.slice(1) : rows, highlight: Math.max(0, hl - 1) };
}
const spokenWords = (s: string) => s.replace(/\*/g, '').replace(/[.!?]+$/, '').split(/\s+/).filter(Boolean);

/** The shot moves the template casts from the library's camera layer (CSS 3D on the footage), in turn per shot. */
export const CM_CAMERAS = ['camera:orbit', 'camera:push-in', 'camera:tilt', 'camera:drift-right', 'camera:rise', 'camera:pull-out', 'camera:drift-left'];

/**
 * Plain lines → a Clip Moment script. A last line that is a question becomes the end card; every other line is a beat
 * with its Mixkit search ladder, its components (one, or two on a long line, so a card is up every 2 to 3 s: numbers
 * count or flip, lists stack tiles, parts and mechanisms get diagram callouts, ideas a turning library 3D object, the
 * rest a headline or a fact card; the hook a glowing logo card; the recap a filmstrip of stills from the chosen clips),
 * a kicker chip, an accent word and library camera moves. `why` says what each line got and why.
 */
export function cmPlan(lines: string[], o: CmPlanOptions = {}): CmPlan {
  const ls = lines.map(l => l.replace(/\s+/g, ' ').trim()).filter(Boolean);
  if (!ls.length) throw new Error('clip-moment: no lines');
  const endQ = ls.length > 1 && /\?\s*$/.test(ls.at(-1)!) ? ls.at(-1)! : undefined;
  const body = endQ ? ls.slice(0, -1) : ls, topic = o.topic ?? cmTopic(body), why: string[] = [], wps = o.wps ?? 2.9;
  const head = topic?.split(' ').at(-1)?.toUpperCase();
  const howTo = body.some(l => /\bhow\b[^.?!]*\bworks?\b/i.test(l));
  let callouts = 0, prevMain: CmShow['kind'] | undefined, cam = 0, filmstrip = false;
  const usedObj = new Set<string>();
  // a 3D object per idea, never the same one twice in a row when the idea has another (the run re-casts it from the graph)
  const nextObj = (line: string, k: CmShow['kind']) => { const o2 = objFor(line, k), alt = OBJ_ALT[o2.obj] ?? [o2.obj], pick = alt.find(x => !usedObj.has(x)) ?? alt[usedObj.size % alt.length]!; usedObj.add(pick); return pick; };
  const beats: CmBeat[] = body.map((line, i) => {
    const est = spokenWords(line).length / wps + 0.3, long = est >= 3.2, last = i === body.length - 1;
    let { show, why: w } = showFor(line, i, body.length);
    const mech = isMechanism(line), labels = calloutLabels(line);
    let show2: CmShow | undefined, w2 = '';
    if (i === 0 && head) {
      show = { kind: 'logo', text: head, sub: howTo ? 'HOW IT WORKS' : 'THE STORY' }; w = 'the hook: a glowing logo card naming the subject';
      if (long) { const h = showFor(line, 1, body.length).show; show2 = h.kind === 'headline' ? { ...h, sub: undefined } : h; w2 = 'then its key words'; }
    } else if (show.kind === 'headline' && mech && labels.length) {
      if (callouts >= 3) { show = factCard(line, topic); w = 'a mechanism after three diagrams: a tilted fact card'; if (long) { const ob = nextObj(line, 'headline'); show2 = { kind: 'obj3d', obj: ob, label: labels[0]!.toUpperCase() }; w2 = `then a turning 3D ${ob}`; } }
      else if (prevMain === 'callout') { const ob = nextObj(line, 'headline'); show = { kind: 'obj3d', obj: ob, label: labels[0]!.toUpperCase(), sub: labels.slice(1).join(' + ').toUpperCase() || undefined }; w = `a mechanism right after a diagram: a turning 3D ${ob}`; if (long) { show2 = { kind: 'callout', labels, title: 'HOW IT WORKS' }; w2 = 'then diagram callouts on its parts'; callouts++; } }
      else { show = { kind: 'callout', labels, title: 'HOW IT WORKS' }; callouts++; w = 'names parts and what they do: diagram callouts'; if (long) { const ob = nextObj(line, 'headline'); show2 = { kind: 'obj3d', obj: ob, label: labels.at(-1)!.toUpperCase() }; w2 = `then a turning 3D ${ob}`; } }
    } else if (long) {
      if ((show.kind === 'stat' || show.kind === 'compare') && mech && labels.length && callouts < 3) { show2 = { kind: 'callout', labels, title: labels[0]!.toUpperCase() }; callouts++; w2 = 'then callouts on the parts it names'; }
      else if (show.kind === 'stat' || show.kind === 'compare' || show.kind === 'flip') { const ob = nextObj(line, show.kind); show2 = { kind: 'obj3d', obj: ob, label: (show.kind === 'stat' && show.label) || head || 'THE NUMBER' }; w2 = `then a 3D ${ob}`; }
      else if (show.kind === 'list' || (last && !filmstrip)) { show2 = { kind: 'filmstrip', label: show.kind === 'list' ? 'RECAP' : head ?? 'RECAP' }; filmstrip = true; w2 = 'then a filmstrip of stills from the clips'; }
      else { show2 = factCard(line, topic); w2 = 'then a tilted fact card'; }
    }
    prevMain = show.kind;
    const q = cmQueries(line, topic), ladder = i === 0 && topic ? [topic, ...q.filter(x => x !== topic)] : q;
    const nums = numbersIn(line), first = labels[0]?.toUpperCase();
    const kicker = i === 0 ? (head ? (howTo ? `HOW ${/S$/.test(head) ? `${head}ES` : `${head}S`} WORK` : head) : undefined)
      : show.kind === 'flip' ? nums.find(x => x.year)?.raw : show.kind === 'stat' || show.kind === 'compare' ? 'BY THE NUMBERS' : show.kind === 'list' ? 'IN SHORT' : first ? `THE ${first}` : undefined;
    const clips = long ? 2 : 1, camera = Array.from({ length: clips }, () => CM_CAMERAS[cam++ % CM_CAMERAS.length]!), enter = i % 2 ? 'camera:tilt' : 'camera:orbit';
    why.push(`line ${i + 1}: ${show.kind}${show2 ? ` + ${show2.kind}` : ''} (${w}${w2 ? `; ${w2}` : ''}); footage "${ladder.slice(0, 4).join('" | "')}"${kicker ? `; kicker ${kicker}` : ''}; camera ${camera.join(', ')}`);
    return { say: accentLine(line), show, ...(show2 ? { show2 } : {}), broll: ladder, clips, camera, enter, ...(kicker ? { kicker } : {}), look: 'soft' as const };
  });
  return {
    topic, why,
    script: { ...(o.brand?.trim() ? { brand: o.brand.trim() } : {}), ...(o.theme ? { theme: o.theme } : {}), ...(o.credit ? { credit: o.credit } : {}), beats, end: { question: accentLine(endQ ?? 'What do you think?'), cta: o.cta ?? 'Tell us in the comments', ...(o.qr ? { qr: o.qr } : {}) } },
  };
}

/** How many components a script puts on screen, and of how many kinds (kickers and the end card included). */
export function cmComponentCount(s: CmScript): { n: number; kinds: string[] } {
  const ks: string[] = [];
  for (const b of s.beats) { if (b.kicker) ks.push('kicker'); for (const x of [b.show, b.show2]) if (x && x.kind !== 'none') ks.push(x.kind); }
  if (s.end) ks.push('end');
  return { n: ks.length, kinds: [...new Set(ks)] };
}

/**
 * Subject guards (root's review of bus v3: the gearbox beat showed a bicycle cassette, the doors beat a shoe). A line
 * about one of these vehicle parts only takes a clip whose title shows that part on a vehicle; anything else (and the
 * look-alikes named in `reject`) is refused, and with nothing left the beat becomes a graphic scene (its 3D or diagram
 * component on the graded base), never a wrong clip.
 */
export const CM_CLIP_GUARDS: { id: string; line: RegExp; need: RegExp; reject: RegExp }[] = [
  { id: 'gearbox', line: /\b(gearbox|gearboxes|transmission|gear ?shift|clutch)\b/i, need: /\b(gearbox|transmission|gear ?(shift|stick|lever|knob)|shifting gears?|changing gears?)\b/i, reject: /\b(bicycle|bike|bikes|cycling|cyclist|cassette|chain ?ring|clock|watch)\b/i },
  { id: 'doors', line: /\bdoors?\b/i, need: /\b(bus|buses|tram|trolleybus|coach)\b[^.]*\bdoors?\b|\bdoors?\b[^.]*\b(bus|buses|tram|trolleybus|coach)\b/i, reject: /\b(shoes?|feet|foot|legs?|sneakers?|boots?|heels?)\b/i },
];
/** May this clip (by its title) play under this line? Lines no guard names take any clip the scorer accepts. */
export function cmClipFits(line: string, title: string): boolean {
  const said = line.replace(/\*/g, '');
  for (const gd of CM_CLIP_GUARDS) if (gd.line.test(said) && (!gd.need.test(title) || gd.reject.test(title))) return false;
  return true;
}

/** Mixkit clip page → its licence: only the Mixkit Stock Video Free License may ship (many clips are personal use only). */
export function mixkitLicence(html: string): 'free' | 'restricted' | 'unknown' {
  const t = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
  if (/Restricted License|personal use only/i.test(t) && !/Stock Video Free License/i.test(t)) return 'restricted';
  if (/Mixkit (Stock Video )?Free License/i.test(t) && !/Restricted License/i.test(t)) return 'free';
  if (/Restricted License/i.test(t)) return 'restricted';
  return 'unknown';
}

/**
 * The style picker's rule for Clip Moment (content based, logged): a voice-led script whose lines name things stock
 * footage can show. Score = the share of lines with an on-screen noun, plus a little for numbers and a question
 * close; a talking-head upload where the face is most of the film stays with the user's own footage.
 */
export function pickClipMoment(i: { lines: string[]; faceShare?: number; hasVideo?: boolean }): { pick: boolean; score: number; why: string } {
  const ls = i.lines.filter(l => l.trim());
  if (!ls.length) return { pick: false, score: 0, why: 'no lines' };
  const visual = ls.filter(l => cmNouns(l).some(n => Object.values(CM_VISUAL).includes(n))).length;
  const nums = ls.filter(l => numbersIn(l).length).length;
  const score = Math.round((visual / ls.length + Math.min(0.15, nums * 0.05) + (/\?\s*$/.test(ls.at(-1)!) ? 0.05 : 0)) * 100) / 100;
  const face = i.hasVideo ? i.faceShare ?? 1 : 0;
  const pick = score >= 0.5 && face < 0.5;
  const why = `clip-moment ${pick ? 'picked' : 'not picked'}: ${visual} of ${ls.length} lines name something stock footage shows${nums ? `, ${nums} with numbers` : ''}${i.hasVideo ? `, face on screen ${Math.round(face * 100)}%` : ', voice-led'} (score ${score}, needs 0.5${i.hasVideo ? ' and a face under 50%' : ''})`;
  return { pick, score, why };
}
