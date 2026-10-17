// pnpm --filter @moovi/engine exec tsx scripts/sound-gallery.ts [--artifact <out.html>]
// The sound board (decision 6, docs/agents/DECISIONS.md): every sound event any player or the edit emits, where it is
// emitted (found by reading the players' own source, so the board cannot drift from them), the sound each event plays
// today (assets/sfx/map.json, the map every castStem style and the edit's library cast play; assets/sfx-style1/map.json,
// the owner's pack the Studio Cut plays) and every vendored sound as a candidate, each playable, with its licence and
// level. A choosing tool only: Ishaan picks a sound and a level per event for each type, and how many sfx a film gets,
// then copies his picks as JSON. Nothing here changes a mapping, a gain or a cap.
// Writes docs/galleries/sounds.html (sounds referenced by relative path to the tracked files, so no media goes in git).
// --artifact also writes a copy without the document skeleton and with the sounds inlined, for a claude.ai Artifact.
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, statSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { color } from '@moovi/brand';
import { licenceTerms } from '@moovi/graph';
import { EVENT_SOUNDS, SOUND_RULES } from '@moovi/library/style-1';
import { SFX_EVENTS as S1_PLANNER_EVENTS } from '@moovi/skills';
import { STYLE1 } from '../src/audio/style1';
import { SFX_EVENT_TO_MAP, SFX_MAP_EVENTS } from '../src/edit/edl';
import { STYLE_LAWS } from '../src/edit/styles';
import { CM_SFX } from '../src/edit/templates/clip-moment';
import { sfx as catalogueSfx } from '../src/library/catalog';

const ROOT = join(import.meta.dirname, '..', '..', '..');
const OUT = join(ROOT, 'docs', 'galleries', 'sounds.html');
const ASSETS = join(ROOT, 'packages', 'engine', 'assets');
const arg = (k: string) => { const i = process.argv.indexOf(`--${k}`); return i > 0 ? process.argv[i + 1] : undefined; };
const rel = (f: string) => relative(ROOT, f).replace(/\\/g, '/');
const TYPES = ['Edit my video', 'Launch', 'Showreel', 'Brand post', 'SaaS explainer', 'UI morph', 'Kinetic type'] as const;
type TypeName = (typeof TYPES)[number];

/* ── the two maps, as the mixers read them ── */
interface SoundSpec { file: string; align?: string; slices?: string; slice_len?: number }
interface EventSpec { sounds: string[]; level_db: number; then?: { sound: string; after: number; level_db: number }; every?: number; fade_db?: number; max_len?: number; why?: string }
interface SfxMap { sounds: Record<string, SoundSpec>; events: Record<string, EventSpec>; rules: { min_gap: number; priority: string[]; jitter_db: number; peak_ceiling_db: number } }
const MAP = JSON.parse(readFileSync(join(ASSETS, 'sfx', 'map.json'), 'utf8')) as SfxMap;
const MAP1 = JSON.parse(readFileSync(join(ASSETS, 'sfx-style1', 'map.json'), 'utf8')) as SfxMap;

/* ── every vendored sound, one entry per distinct file (the owner pack keeps byte-identical copies of 14 sfx files) ── */
interface Sound {
  id: string; name: string; label: string; paths: string[]; bytes: number; pack: 'sfx' | 'sfx-style1';
  licence: { code: string | null; text: string; credit: string | null; ship: boolean | null; attribution: boolean | null; inLibrary: boolean };
  keys: { sfx: string[]; style1: string[] }; note: string | null;
}
const byHash = new Map<string, Sound>();
const soundOfPath = new Map<string, string>(); // 'sfx/x.wav' or 'sfx-style1/x.wav' → sound id
const libRows = catalogueSfx();
const credits = readFileSync(join(ASSETS, 'CREDITS.md'), 'utf8');
const ownerRow = credits.split('\n').find(l => l.includes('sfx-style1/typing.mp3')) ?? '';
const ownerFiles = new Set([...ownerRow.split('|')[1]?.matchAll(/`([^`]+)`/g) ?? []].map(m => m[1]!.replace(/^sfx-style1\//, '')));
const ownerText = ownerRow.split('|').map(s => s.trim()).filter(Boolean).at(-1) ?? 'not in CREDITS.md';
const readme1 = readFileSync(join(ASSETS, 'sfx-style1', 'README.md'), 'utf8');
const readmeNote = (f: string) => {
  const r = readme1.split('\n').find(l => l.startsWith('|') && l.split('|')[1]!.split('·').map(s => s.trim()).includes(f));
  return r ? r.split('|').slice(2, 4).map(s => s.trim()).join(': ') : null;
};
for (const pack of ['sfx', 'sfx-style1'] as const) {
  for (const f of readdirSync(join(ASSETS, pack)).filter(f => /\.(wav|mp3)$/i.test(f)).sort()) {
    const p = join(ASSETS, pack, f), buf = readFileSync(p), h = createHash('md5').update(buf).digest('hex'), path = `${pack}/${f}`;
    const have = byHash.get(h);
    if (have) { have.paths.push(path); soundOfPath.set(path, have.id); continue; }
    const row = pack === 'sfx' ? libRows.find(r => r.file === `packages/engine/assets/sfx/${f}`) : undefined;
    const t = row ? licenceTerms(row.licence) : null;
    const licence = row
      ? { code: t!.code, text: row.licence, credit: row.credit ?? (row as { author?: string | null }).author ?? null, ship: t!.ship, attribution: t!.attribution, inLibrary: true }
      : { code: null, text: ownerFiles.has(f) ? ownerText : 'not listed in assets/CREDITS.md', credit: ownerFiles.has(f) ? 'the owner (Ishaan)' : null, ship: null, attribution: null, inLibrary: false };
    const s: Sound = { id: path, name: f, label: pack === 'sfx-style1' ? `owner pack: ${f}` : f, paths: [path], bytes: buf.length, pack, licence, keys: { sfx: [], style1: [] }, note: pack === 'sfx-style1' ? readmeNote(f) : (row?.about ?? null) };
    byHash.set(h, s); soundOfPath.set(path, s.id);
  }
}
const SOUNDS = [...byHash.values()];
const fileOfKey = (M: SfxMap, pack: 'sfx' | 'sfx-style1', key: string) => {
  const f = M.sounds[key]?.file; if (!f) return null;
  const path = f.startsWith('../sfx/') ? `sfx/${f.slice(7)}` : `${pack}/${f}`;
  return soundOfPath.get(path) ?? null;
};
for (const [k] of Object.entries(MAP.sounds)) { const id = fileOfKey(MAP, 'sfx', k); if (id) byHash.get([...byHash].find(([, s]) => s.id === id)![0])!.keys.sfx.push(k); }
for (const [k] of Object.entries(MAP1.sounds)) { const id = fileOfKey(MAP1, 'sfx-style1', k); if (id) byHash.get([...byHash].find(([, s]) => s.id === id)![0])!.keys.style1.push(k); }

/* ── who emits which event: read from the players' own source ── */
interface Loc { at: string; gain: number | null; sound: string | null }
interface Emitter { id: string; label: string; types: TypeName[]; pack: 'sfx' | 'sfx-style1'; how: string; events: Map<string, Loc[]> }
const EMITTERS: Emitter[] = [];
const emitter = (id: string, label: string, types: TypeName[], how: string, pack: 'sfx' | 'sfx-style1' = 'sfx') => {
  let e = EMITTERS.find(x => x.id === id);
  if (!e) { e = { id, label, types, pack, how, events: new Map() }; EMITTERS.push(e); }
  return e;
};
const add = (e: Emitter, ev: string, loc: Loc) => { const l = e.events.get(ev) ?? []; l.push(loc); e.events.set(ev, l); };
/** the string literals of an expression that can be its value (not the operands of a comparison) */
const values = (expr: string) => [...expr.matchAll(/(===|!==|==|!=)?\s*'([a-z][a-z0-9-]*)'/g)].filter(m => !m[1]).map(m => m[2]!);
/** the text of a call's arguments from the open paren at `i`, split at top-level commas */
function callArgs(src: string, i: number): string[] {
  let d = 0, cur = '', out: string[] = [];
  for (let j = i; j < src.length; j++) {
    const c = src[j]!;
    if ('([{'.includes(c)) { d++; if (d === 1) continue; }
    if (')]}'.includes(c)) { d--; if (d === 0) { out.push(cur); return out; } }
    if (c === ',' && d === 1) { out.push(cur); cur = ''; continue; }
    if (d >= 1) cur += c;
  }
  return out;
}
const num = (s: string | undefined) => (s === undefined ? null : Number(s));
/** `event: <expr>` objects (every player but s4 and the Studio Cut) */
function scanEvents(e: Emitter, file: string) {
  const src = readFileSync(file, 'utf8'), lines = src.split('\n');
  lines.forEach((line, n) => {
    for (const m of line.matchAll(/\bevent:\s*([^,}]+)/g)) {
      const evs = values(m[1]!); if (!evs.length) continue;
      const tail = line.slice(m.index!, line.indexOf('}', m.index!) > 0 ? line.indexOf('}', m.index!) : undefined);
      const head = line.slice(line.lastIndexOf('{', m.index!) + 1, m.index!);
      const gain = num(/gain_db:\s*(-?[\d.]+)/.exec(tail)?.[1]), sound = /\b(?:sound|id):\s*'([a-z0-9-]+)'/.exec(head + tail)?.[1] ?? null;
      for (const ev of evs) add(e, ev, { at: `${rel(file)}:${n + 1}`, gain, sound });
    }
  });
}
/** a sound helper called as NAME(t, event, extra) (s4 compose.ts E, the Studio Cut's S) */
function scanCalls(e: Emitter, file: string, fn: string) {
  const src = readFileSync(file, 'utf8'), lines = src.split('\n');
  lines.forEach((line, n) => {
    for (const m of line.matchAll(new RegExp(`(?<![\\w.])${fn}\\(`, 'g'))) {
      const a = callArgs(line, m.index! + fn.length); if (a.length < 2) continue;
      const evs = values(a[1]!); if (!evs.length) continue;
      const gain = num(/gain_db:\s*(-?[\d.]+)/.exec(a[2] ?? '')?.[1]), sound = /sound:\s*'([a-z0-9-]+)'/.exec(a[2] ?? '')?.[1] ?? null;
      for (const ev of evs) add(e, ev, { at: `${rel(file)}:${n + 1}`, gain, sound });
    }
  });
}
const P = (...p: string[]) => join(ROOT, 'packages', ...p);
const walk = (dir: string, re: RegExp): string[] => readdirSync(dir, { recursive: true }).map(String).filter(f => re.test(f)).map(f => join(dir, f)).filter(f => statSync(f).isFile()).sort();

// Style 1: the kit recipes (skills style-1, library style-1); the planner may also name any event of its vocabulary
const s1 = emitter('s1', 'Style 1', ['SaaS explainer'], 'scene recipes and kit presets (event: …)');
for (const f of [...walk(P('skills', 'src', 'style-1'), /\.ts$/), ...walk(P('library', 'src', 'style-1'), /\.ts$/)]) scanEvents(s1, f);
const s1p = emitter('s1-planner', 'Style 1 planner', ['SaaS explainer'], 'the events the Style 1 planner may write (skills timeline.ts SFX_EVENTS)');
for (const ev of S1_PLANNER_EVENTS) add(s1p, ev, { at: 'packages/skills/src/timeline.ts SFX_EVENTS', gain: null, sound: null });
scanEvents(emitter('s5', 'Clear Signal', ['SaaS explainer'], 'plan.ts sound events'), P('engine', 'src', 's5', 'plan.ts'));
scanEvents(emitter('anatomy', 'Anatomy', ['SaaS explainer'], 'plan.ts sound events'), P('engine', 'src', 'anatomy', 'plan.ts'));
scanCalls(emitter('s4', 'Editorial', ['Brand post'], 'compose.ts E(t, event)'), P('engine', 'src', 's4', 'compose.ts'), 'E');
scanEvents(emitter('darkvox', 'Dark Vox', ['Brand post'], 'film.ts sound events'), P('engine', 'src', 'darkvox', 'film.ts'));
scanEvents(emitter('borrow', 'Kit borrow', ['Brand post'], 'a borrowed ui piece pops (styles/kit/borrow.ts)'), P('engine', 'src', 'styles', 'kit', 'borrow.ts'));
// the Launch kit: every setup's plan(); l09 and l06 also seed UI morph, l02 seeds Kinetic type (decision 9)
const SEEDS: Record<string, TypeName[]> = { 'p-l09': ['UI morph'], 'p-l06': ['UI morph'], 'p-l02': ['Kinetic type'] };
for (const f of walk(P('library', 'src', 'kits', 'launch'), /^[^\\/]+\.js$/)) {
  const base = f.split(/[\\/]/).pop()!.replace(/\.js$/, ''), seed = SEEDS[base];
  scanEvents(emitter('launch', 'Launch kit', ['Launch'], 'setup plan() events (library kits/launch)'), f);
  if (seed) scanEvents(emitter(`launch-${base}`, `Launch ${base.slice(2)} (seed)`, seed, `the ${base.slice(2)} reference seeds this type`), f);
}
scanEvents(emitter('visual', 'Visual renderer', ['Kinetic type'], 'film.ts sound events'), P('engine', 'src', 'visual', 'film.ts'));
scanEvents(emitter('clip-moment', 'Clip Moment', ['Showreel'], 'template sound events (CM_SFX names each one\'s library asset)'), P('engine', 'src', 'edit', 'templates', 'clip-moment.ts'));
// the edit: the library cast (EVENT table + slide-out on transitions), the D2.2 styles' laws, the Studio Cut, the EDL's aliases
{
  const e = emitter('edit-cast', 'Edit: library cast', ['Edit my video'], 'edit/cast.ts: a fast move, a beat tag, a transition'), f = P('engine', 'src', 'edit', 'cast.ts');
  const lines = readFileSync(f, 'utf8').split('\n');
  lines.forEach((l, n) => {
    if (/^const EVENT = \{/.test(l)) for (const m of l.matchAll(/(\w+):\s*'([a-z-]+)'/g)) add(e, m[2]!, { at: `${rel(f)}:${n + 1} (${m[1]})`, gain: null, sound: null });
    for (const m of l.matchAll(/soundFor\('([a-z-]+)'\)/g)) add(e, m[1]!, { at: `${rel(f)}:${n + 1}`, gain: null, sound: null });
  });
}
for (const [id, law] of Object.entries(STYLE_LAWS)) {
  const e = emitter(`edit-${id}`, `Edit: ${id}`, ['Edit my video'], `edit/styles.ts STYLE_LAWS.${id}.sfx (EDL event → library event)`);
  for (const [edlEv, ev] of Object.entries(law.sfx)) add(e, ev!, { at: `packages/engine/src/edit/styles.ts STYLE_LAWS.${id}.sfx.${edlEv}`, gain: null, sound: null });
}
scanCalls(emitter('studio-cut', 'Edit: Studio Cut', ['Edit my video'], 'templates/studio-cut.ts S(t, event); mixed with the owner\'s Style 1 pack (audio/style1.ts)', 'sfx-style1'), P('engine', 'src', 'edit', 'templates', 'studio-cut.ts'), 'S');
{
  const e = emitter('edl', 'Edit: EDL event names', ['Edit my video'], 'edit/edl.ts SFX_EVENT_TO_MAP: an EDL sound event sounds as a library event');
  for (const alias of Object.keys(SFX_EVENT_TO_MAP)) add(e, alias, { at: 'packages/engine/src/edit/edl.ts SFX_EVENT_TO_MAP', gain: null, sound: null });
}

/* ── the event rows ── */
const today = (M: SfxMap, pack: 'sfx' | 'sfx-style1', ev: string) => {
  const s = M.events[ev]; if (!s) return null;
  const sounds = s.sounds.map(k => ({ key: k, sound: fileOfKey(M, pack, k) }));
  return { sounds, level_db: s.level_db, ...(s.then ? { then: { key: s.then.sound, sound: fileOfKey(M, pack, s.then.sound), after: s.then.after, level_db: s.then.level_db } } : {}),
    ...(s.every ? { every: s.every } : {}), ...(s.fade_db ? { fade_db: s.fade_db } : {}), ...(s.max_len ? { max_len: s.max_len } : {}), ...(s.why ? { why: s.why } : {}) };
};
const ALIAS = SFX_EVENT_TO_MAP as Record<string, string>;
const allEvents = new Set<string>([...MAP.rules.priority, ...Object.keys(MAP.events), ...Object.keys(MAP1.events), ...SFX_MAP_EVENTS, ...S1_PLANNER_EVENTS, ...EMITTERS.flatMap(e => [...e.events.keys()])]);
const prio = (ev: string) => { const i = MAP.rules.priority.indexOf(ALIAS[ev] ?? ev); return i < 0 ? 99 : i; };
const EVENTS = [...allEvents].map(ev => {
  const aliasOf = ALIAS[ev] ?? null, key = aliasOf ?? ev;
  const t = today(MAP, 'sfx', key), t1 = today(MAP1, 'sfx-style1', key);
  const by = EMITTERS.filter(e => e.events.has(ev)).map(e => ({ id: e.id, label: e.label, types: e.types, pack: e.pack, locs: e.events.get(ev)! }));
  const red: string[] = [];
  const missing = (x: ReturnType<typeof today>) => !x || !x.sounds.some(s => s.sound);
  if (by.some(b => b.pack === 'sfx') && missing(t)) red.push(t ? 'its sounds in assets/sfx/map.json point at no file' : 'no entry in assets/sfx/map.json: the mixer plays nothing for it');
  if (by.some(b => b.pack === 'sfx-style1') && missing(t1)) red.push('the Studio Cut emits it, but assets/sfx-style1/map.json has no sound for it');
  const tok = (EVENT_SOUNDS as Record<string, { ids: readonly string[]; db: number; note: string }>)[key];
  return {
    id: ev, aliasOf, prio: prio(ev), today: t, style1: t1, red, emitted: by.length > 0, by,
    aliases: Object.entries(ALIAS).filter(([, v]) => v === ev).map(([k]) => k),
    tokens: tok ? { ids: [...tok.ids], db: tok.db, note: tok.note } : null,
    cm: (CM_SFX as Record<string, string>)[key] ?? null,
  };
}).sort((a, b) => Number(b.red.length > 0) - Number(a.red.length > 0) || a.prio - b.prio || Number(!!a.aliasOf) - Number(!!b.aliasOf) || a.id.localeCompare(b.id));

const CAPS = { sfxPerFilm: null as number | null, maxHardHits: SOUND_RULES.maxHardHits, maxRisers: SOUND_RULES.maxRisers };
const DATA = {
  types: TYPES, sounds: SOUNDS, events: EVENTS, caps: CAPS, rules: { ...MAP.rules, sfxPerSec: SOUND_RULES.sfxPerSec, stemDb: STYLE1.stemDb },
  emitters: EMITTERS.map(e => ({ id: e.id, label: e.label, types: e.types, pack: e.pack, how: e.how, n: e.events.size })),
};

/* ── the page ── */
function page(media: { rel: string } | { b64: Record<string, string> }, skeleton: boolean) {
  const nRed = EVENTS.filter(e => e.red.length).length, nEmitted = EVENTS.filter(e => e.emitted).length;
  const body = `<title>Sound Board</title>
<meta name="claude:viewport-fit-sides" content="cover">
<style>
/* Layout: a sticky type strip with the copy action over one row per sound event; each row says who emits it, what plays today, and holds the pick for the chosen type. Quiet chrome, the sounds are the content. */
:root{
  --bg:#0A111C; --panel:#111B2A; --panel2:#0E1724; --line:#22324A; --fg:${color.iceWhite}; --muted:#93A6BF; --ice:${color.ice}; --flag:#FF7A6B; --ok:#8FD9B6; --warn:#F2C86B;
  --ui:'Geist',system-ui,sans-serif; --mono:'JetBrains Mono',ui-monospace,monospace; color-scheme:dark;
}
html,body{background:var(--bg);color:var(--fg)}
body{font:14px/1.45 var(--ui);margin:0;padding-left:max(16px,env(safe-area-inset-left,0px));padding-right:max(16px,env(safe-area-inset-right,0px));padding-block:0 48px}
h1{font:600 22px/1.2 var(--ui);margin:0;letter-spacing:-.01em;text-wrap:balance}
h2{font:600 13px var(--ui);text-transform:uppercase;letter-spacing:.08em;color:var(--muted);margin:28px 0 12px}
p{margin:0}
code{font:12px var(--mono)}
.intro{display:grid;gap:6px;padding-block:20px 12px;max-width:84ch;color:var(--muted)}
.intro h1{color:var(--fg)}
.bar{position:sticky;top:env(safe-area-inset-top,0px);z-index:5;background:color-mix(in srgb,var(--bg) 92%,transparent);backdrop-filter:blur(8px);border-bottom:1px solid var(--line);padding-block:10px;display:grid;gap:8px}
.row{display:flex;flex-wrap:wrap;gap:8px 16px;align-items:center}
.ctl{display:flex;gap:6px;align-items:center;color:var(--muted);font-size:12px}
.ctl input[type=number]{width:64px;background:var(--panel);color:var(--fg);border:1px solid var(--line);border-radius:6px;padding:4px 6px;font:13px var(--mono)}
.seg{display:inline-flex;flex-wrap:wrap;border:1px solid var(--line);border-radius:8px;overflow:hidden}
.seg button{border:0;border-radius:0;background:transparent;color:var(--muted);padding:6px 10px;font:12px var(--ui);cursor:pointer}
.seg button[aria-pressed=true]{background:var(--ice);color:#0A111C}
.seg button .n{font:10px var(--mono);opacity:.75;margin-left:4px}
button.act{border:1px solid var(--ice);background:var(--ice);color:#0A111C;border-radius:8px;padding:7px 14px;font:600 13px var(--ui);cursor:pointer}
button.ghost{border:1px solid var(--line);background:transparent;color:var(--fg);border-radius:8px;padding:5px 10px;font:12px var(--ui);cursor:pointer}
button:focus-visible,input:focus-visible,select:focus-visible{outline:2px solid var(--ice);outline-offset:2px}
#copied{font-size:12px;color:var(--ok)}
#out{display:none;width:100%;min-height:120px;background:var(--panel);color:var(--fg);border:1px solid var(--line);border-radius:8px;font:12px var(--mono)}
.legend{font-size:12px;color:var(--muted)}
.ev{border:1px solid var(--line);border-radius:10px;background:var(--panel2);padding:12px;display:grid;gap:10px;margin-bottom:12px;min-width:0}
.ev.red{border-color:var(--flag)}
.ev.here{box-shadow:inset 3px 0 0 var(--ice)}
.ev.none{opacity:.8}
.evh{display:flex;flex-wrap:wrap;gap:6px 12px;align-items:baseline}
.evh code.name{font:600 15px var(--mono);color:var(--fg)}
.ev.red .evh code.name{color:var(--flag)}
.badge{font:10px var(--ui);text-transform:uppercase;letter-spacing:.06em;border-radius:4px;padding:1px 5px;border:1px solid currentColor;color:var(--muted)}
.badge.red{color:var(--flag)}.badge.here{color:var(--ice)}.badge.alias{color:var(--warn)}
.redwhy{color:var(--flag);font-size:12px}
.cols{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:10px 18px}
@media (max-width:760px){.cols{grid-template-columns:minmax(0,1fr)}}
.k{font-size:11px;text-transform:uppercase;letter-spacing:.06em;color:var(--muted);margin-bottom:3px}
.today{font-size:12px;color:var(--fg);display:grid;gap:3px}
.today .m{color:var(--muted)}
.chips{display:flex;flex-wrap:wrap;gap:4px}
.em{font-size:11px;border:1px solid var(--line);border-radius:999px;padding:1px 8px;color:var(--muted)}
.em.here{border-color:var(--ice);color:var(--ice)}
details{font-size:12px;color:var(--muted)}
details summary{cursor:pointer}
details ul{margin:4px 0 0;padding-left:16px;max-height:220px;overflow:auto}
.pick{display:flex;flex-wrap:wrap;gap:8px 14px;align-items:center;border-top:1px solid var(--line);padding-top:10px}
.pick select{max-width:100%;background:var(--panel);color:var(--fg);border:1px solid var(--line);border-radius:6px;padding:4px 6px;font:12px var(--mono)}
.pick input[type=range]{width:180px;max-width:50vw}
.pick .db{font:12px var(--mono);min-width:7ch}
.pick .changed{font-size:11px;color:var(--warn)}
.cands{display:flex;flex-wrap:wrap;gap:4px}
.cand{display:inline-flex;align-items:stretch;border:1px solid var(--line);border-radius:6px;overflow:hidden;font:11px var(--mono)}
.cand button{border:0;background:transparent;color:var(--fg);padding:3px 6px;font:inherit;cursor:pointer}
.cand button.pl{color:var(--ice);border-right:1px solid var(--line)}
.cand button.pl[aria-pressed=true]{background:var(--ice);color:#0A111C}
.cand .lic{padding:3px 5px;color:var(--muted);border-left:1px solid var(--line)}
.cand.today{border-color:var(--ok)}
.cand.today .nm::after{content:' today';color:var(--ok)}
.cand.picked{border-color:var(--ice);background:color-mix(in srgb,var(--ice) 16%,transparent)}
table{border-collapse:collapse;width:100%;font-size:12px}
th,td{text-align:left;border-bottom:1px solid var(--line);padding:6px 8px;vertical-align:top}
th{color:var(--muted);font-weight:600}
.tablewrap{overflow-x:auto}
.mediahint{color:var(--warn);font-size:12px}
@media (prefers-reduced-motion:reduce){.bar{backdrop-filter:none}}
</style>
<div class="intro">
  <h1>Sound Board</h1>
  <p>Every sound event a player or the edit emits (${nEmitted} emitted, ${EVENTS.length} in all, ${nRed} with no sound${nRed ? ', in red at the top' : ''}), where it is emitted, what plays today, and all ${SOUNDS.length} vendored sounds as candidates. Pick a type, then for each event a sound and a level, and how many sfx a film of that type gets. Copy your picks and paste them into chat. Nothing here changes a mapping or a gain.</p>
  <p class="legend">"Today" is <code>assets/sfx/map.json</code>, which every style's stem plays (the library graph is seeded from it, so its FITS gain is the same level) and which the edit's library cast and the Atlas, Handmade and Studio Minimal laws play. The Studio Cut plays the owner's pack, <code>assets/sfx-style1/map.json</code>, shown beside it. Levels are the RMS each hit is set to in the SFX stem (dBFS), before the stem's +${STYLE1.stemDb} dB. <b>▶</b> plays a file as it is; <b>Hear at level</b> plays your pick as the mixer would place it (RMS to the level, peak ceiling ${MAP.rules.peak_ceiling_db} dBFS, +${STYLE1.stemDb} dB stem). Rows marked with a blue edge are emitted by the type you are on.</p>
</div>
<div class="bar">
  <div class="row">
    <span class="seg" role="group" aria-label="Type" id="types"></span>
    <button class="act" id="copy">Copy my picks</button><span id="copied" aria-live="polite"></span>
  </div>
  <div class="row" id="caps"></div>
  <textarea id="out" readonly aria-label="Picks JSON"></textarea>
</div>
<p class="mediahint" id="mediahint" hidden></p>
<h2>Events</h2>
<div id="events"></div>
<h2>Every sound (${SOUNDS.length})</h2>
<div class="tablewrap"><table id="sounds"><thead><tr><th>Play</th><th>Sound</th><th>Files</th><th>Licence</th><th>Mixer keys today</th><th>Length</th><th>Note</th></tr></thead><tbody></tbody></table></div>
<h2>Emitters (${EMITTERS.length})</h2>
<div class="tablewrap"><table id="emitters"><thead><tr><th>Emitter</th><th>Type</th><th>How it emits</th><th>Plays through</th><th>Events</th></tr></thead><tbody></tbody></table></div>
<audio id="player" preload="none"></audio>
<script>var DATA = ${JSON.stringify(DATA)};
var MEDIA = ${JSON.stringify(media)};
</script>
<script>${CLIENT}</script>`;
  return skeleton ? `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">\n${body.replace('</style>', '</style></head><body>')}\n</body></html>` : body;
}

const CLIENT = String.raw`
(() => {
const $ = id => document.getElementById(id), TYPES = DATA.types, S = Object.fromEntries(DATA.sounds.map(s => [s.id, s]));
const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const store = { get(k, d) { try { const v = localStorage.getItem('moovi-sg-' + k); return v ? JSON.parse(v) : d; } catch { return d; } }, set(k, v) { try { localStorage.setItem('moovi-sg-' + k, JSON.stringify(v)); } catch {} } };
const picks = store.get('picks', {}); // type -> event -> { sound?, db? } (only what differs from today)
const caps = store.get('caps', {});   // type -> { sfxPerFilm, maxHardHits, maxRisers }
let TYPE = store.get('type', TYPES[0]); if (!TYPES.includes(TYPE)) TYPE = TYPES[0];

/* media: the tracked files by relative path, or inlined (artifact) */
const urls = {};
const urlOf = id => {
  if (urls[id]) return urls[id];
  if (MEDIA.b64) { const b = MEDIA.b64[id]; if (!b) return null; const bin = atob(b), u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return urls[id] = URL.createObjectURL(new Blob([u], { type: /\.mp3$/i.test(id) ? 'audio/mpeg' : 'audio/wav' })); }
  return urls[id] = MEDIA.rel + id;
};
if (location.protocol === 'file:' && !MEDIA.b64) { const h = $('mediahint'); h.hidden = false; h.textContent = 'Opened from disk: ▶ works, but "Hear at level" needs the page served over http (any static server at the repo root) to read the files.'; }

const player = $('player'); let playing = null;
function play(id, btn) {
  document.querySelectorAll('button.pl[aria-pressed=true]').forEach(b => b.setAttribute('aria-pressed', 'false'));
  if (playing === id && !player.paused) { player.pause(); playing = null; return; }
  const u = urlOf(id); if (!u) return;
  player.src = u; player.currentTime = 0; playing = id;
  player.play().then(() => { document.querySelectorAll('button.pl[data-s="' + CSS.escape(id) + '"]').forEach(b => b.setAttribute('aria-pressed', 'true')); }, e => { $('copied').textContent = 'Could not play ' + id + ': ' + e.message; });
}
player.addEventListener('ended', () => { playing = null; document.querySelectorAll('button.pl[aria-pressed=true]').forEach(b => b.setAttribute('aria-pressed', 'false')); });

/* hear at level: the mixer's own placement (RMS of the sound trimmed of near-silence → level, capped by the peak ceiling, + stem lift) */
let AC = null; const decoded = {};
async function buf(id) {
  if (decoded[id]) return decoded[id];
  AC = AC || new (window.AudioContext || window.webkitAudioContext)();
  const ab = await (await fetch(urlOf(id))).arrayBuffer(), b = await AC.decodeAudioData(ab);
  const y = b.getChannelData(0); let m = 0; for (let i = 0; i < y.length; i++) m = Math.max(m, Math.abs(y[i]));
  let a = 0, z = y.length; while (a < z && Math.abs(y[a]) <= m * 0.03) a++; while (z > a && Math.abs(y[z - 1]) <= m * 0.03) z--;
  let s = 0; for (let i = a; i < z; i++) s += y[i] * y[i];
  return decoded[id] = { b, rms: Math.sqrt(s / Math.max(1, z - a)) + 1e-9, peak: m + 1e-9 };
}
async function hear(id, db) {
  try {
    const d = await buf(id); if (AC.state === 'suspended') await AC.resume();
    let g = db - 20 * Math.log10(d.rms); g = Math.min(g, DATA.rules.peak_ceiling_db - 20 * Math.log10(d.peak)); g += DATA.rules.stemDb;
    const src = AC.createBufferSource(), gn = AC.createGain(); src.buffer = d.b; gn.gain.value = Math.pow(10, g / 20); src.connect(gn).connect(AC.destination); src.start();
  } catch (e) { $('copied').textContent = 'Could not decode ' + id + ': ' + (e && e.message || e); }
}

/* the type strip and per-type caps */
const usedIn = (ev, ty) => ev.by.some(b => b.types.includes(ty));
function renderTypes() {
  $('types').innerHTML = TYPES.map(t => '<button type="button" aria-pressed="' + (t === TYPE) + '" data-t="' + esc(t) + '">' + esc(t) + '<span class="n">' + DATA.events.filter(e => usedIn(e, t)).length + '</span></button>').join('');
  $('types').querySelectorAll('button').forEach(b => b.addEventListener('click', () => { TYPE = b.dataset.t; store.set('type', TYPE); renderTypes(); renderCaps(); renderPicks(); }));
}
const capOf = t => Object.assign({ sfxPerFilm: DATA.caps.sfxPerFilm, maxHardHits: DATA.caps.maxHardHits, maxRisers: DATA.caps.maxRisers }, caps[t] || {});
function renderCaps() {
  const c = capOf(TYPE), R = DATA.rules;
  $('caps').innerHTML =
    '<span class="ctl"><label for="c-sfxPerFilm">SFX per film, ' + esc(TYPE) + '</label><input id="c-sfxPerFilm" type="number" min="0" step="1" placeholder="no cap"></span>' +
    '<span class="ctl"><label for="c-maxHardHits">Max hard hits</label><input id="c-maxHardHits" type="number" min="0" step="1"></span>' +
    '<span class="ctl"><label for="c-maxRisers">Max risers</label><input id="c-maxRisers" type="number" min="0" step="1"></span>' +
    '<span class="ctl">Today: no per-film sfx cap in the product; Style 1 rules (library style-1 SOUND_RULES) ' + R.sfxPerSec[0] + '–' + R.sfxPerSec[1] + ' sfx a second, max ' + DATA.caps.maxHardHits + ' hard hits, max ' + DATA.caps.maxRisers + ' risers; same event at least ' + R.min_gap + ' s apart.</span>';
  for (const k of ['sfxPerFilm', 'maxHardHits', 'maxRisers']) {
    const inp = $('c-' + k); inp.value = c[k] == null ? '' : c[k];
    inp.addEventListener('input', () => { const v = inp.value === '' ? null : Math.max(0, Math.round(+inp.value)); (caps[TYPE] = caps[TYPE] || {})[k] = v; store.set('caps', caps); });
  }
}

/* the event rows */
const todayOf = ev => ev.today ? { sound: (ev.today.sounds.find(s => s.sound) || {}).sound || null, db: ev.today.level_db } : { sound: null, db: null };
const pickOf = (ty, ev) => { const p = (picks[ty] || {})[ev.id] || {}, t = todayOf(ev); return { sound: p.sound !== undefined ? p.sound : t.sound, db: p.db !== undefined ? p.db : t.db, changed: (p.sound !== undefined && p.sound !== t.sound) || (p.db !== undefined && p.db !== t.db) }; };
const setPick = (ev, k, v) => { const t = todayOf(ev), P = (picks[TYPE] = picks[TYPE] || {}), p = (P[ev.id] = P[ev.id] || {}); p[k] = v; if (p.sound === t.sound) delete p.sound; if (p.db === t.db) delete p.db; if (!Object.keys(p).length) delete P[ev.id]; store.set('picks', picks); };
const lic = s => s.licence.code || 'owner';
const todayLine = (t, label) => {
  if (!t) return '<div class="m">' + label + ': no entry</div>';
  const snd = t.sounds.map(s => s.sound ? '<code>' + esc(s.key) + '</code> = ' + esc(S[s.sound].label) : '<code>' + esc(s.key) + '</code> = <span class="redwhy">no file</span>').join(', then ');
  return '<div>' + label + ': ' + snd + ' at <b>' + t.level_db + ' dB</b>' + (t.sounds.length > 1 ? ' <span class="m">(rotates)</span>' : '') +
    (t.then ? ' <span class="m">+ follow-up <code>' + esc(t.then.key) + '</code> = ' + esc(t.then.sound ? S[t.then.sound].label : 'no file') + ' at ' + t.then.level_db + ' dB</span>' : '') +
    (t.every ? ' <span class="m">every ' + t.every + ' item(s), fading ' + t.fade_db + ' dB</span>' : '') + (t.max_len ? ' <span class="m">cut to ' + t.max_len + ' s</span>' : '') + '</div>';
};
const rows = [];
const evBox = $('events');
for (const ev of DATA.events) {
  const el = document.createElement('article'); el.className = 'ev' + (ev.red.length ? ' red' : '') + (ev.emitted ? '' : ' none');
  const tSounds = new Set([...(ev.today ? ev.today.sounds.map(s => s.sound) : []), ...(ev.today && ev.today.then ? [ev.today.then.sound] : [])].filter(Boolean));
  const t1Sounds = new Set([...(ev.style1 ? ev.style1.sounds.map(s => s.sound) : []), ...(ev.style1 && ev.style1.then ? [ev.style1.then.sound] : [])].filter(Boolean));
  const order = [...DATA.sounds].sort((a, b) => Number(tSounds.has(b.id)) - Number(tSounds.has(a.id)) || Number(t1Sounds.has(b.id)) - Number(t1Sounds.has(a.id)) || a.id.localeCompare(b.id));
  const emit = ev.by.map(b => '<details><summary><span class="em" data-types="' + esc(b.types.join('|')) + '">' + esc(b.label) + ' ×' + b.locs.length + '</span> <span>' + esc(b.types.join(', ')) + (b.pack === 'sfx-style1' ? ' · owner pack' : '') + '</span></summary><ul>' + b.locs.map(l => '<li><code>' + esc(l.at) + '</code>' + (l.gain != null ? ' gain ' + (l.gain > 0 ? '+' : '') + l.gain + ' dB' : '') + (l.sound ? ' names sound <code>' + esc(l.sound) + '</code>' : '') + '</li>').join('') + '</ul></details>').join('');
  el.innerHTML = '<div class="evh"><code class="name">' + esc(ev.id) + '</code>' +
    (ev.red.length ? '<span class="badge red">no sound</span>' : '') + (ev.aliasOf ? '<span class="badge alias">EDL name → ' + esc(ev.aliasOf) + '</span>' : '') +
    (ev.emitted ? '' : '<span class="badge">nothing emits it</span>') + '<span class="badge here" hidden>in this type</span>' +
    '<span class="badge">priority ' + (ev.prio < 99 ? ev.prio + 1 : '—') + '</span>' + (ev.aliases.length ? '<span class="legend">EDL names for it: ' + ev.aliases.map(a => '<code>' + esc(a) + '</code>').join(', ') + '</span>' : '') + '</div>' +
    (ev.red.length ? '<div class="redwhy">' + ev.red.map(esc).join('; ') + '</div>' : '') +
    '<div class="cols"><div><div class="k">Today</div><div class="today">' + todayLine(ev.today, 'sfx/map.json') + todayLine(ev.style1, 'Studio Cut, owner pack') +
    (ev.today && ev.today.why ? '' : (ev.style1 && ev.style1.why ? '<div class="m">Owner\'s note: ' + esc(ev.style1.why) + '</div>' : '')) +
    (ev.tokens ? '<div class="m">Style 1 tokens: ' + esc(ev.tokens.ids.join(', ')) + ' at ' + ev.tokens.db + ' dB, "' + esc(ev.tokens.note) + '"</div>' : '') +
    (ev.cm ? '<div class="m">Clip Moment names <code>' + esc(ev.cm) + '</code></div>' : '') + '</div></div>' +
    '<div><div class="k">Emitted by</div>' + (emit || '<div class="legend">No player or edit code emits it (only a map lists it).</div>') + '</div></div>' +
    '<div><div class="k">Candidates (' + order.length + ')</div><div class="cands">' + order.map(s => '<span class="cand' + (tSounds.has(s.id) ? ' today' : '') + '" data-s="' + esc(s.id) + '"><button type="button" class="pl" data-s="' + esc(s.id) + '" aria-pressed="false" aria-label="Play ' + esc(s.name) + '">▶</button><button type="button" class="nm" title="' + esc(s.paths.join(', ')) + (t1Sounds.has(s.id) ? ' · Studio Cut today' : '') + '">' + esc(s.label) + (t1Sounds.has(s.id) && !tSounds.has(s.id) ? ' (owner today)' : '') + '</button><span class="lic">' + esc(lic(s)) + '</span></span>').join('') + '</div></div>' +
    '<div class="pick"></div>';
  evBox.appendChild(el);
  el.querySelectorAll('button.pl').forEach(b => b.addEventListener('click', () => play(b.dataset.s, b)));
  el.querySelectorAll('button.nm').forEach(b => b.addEventListener('click', () => { setPick(ev, 'sound', b.parentElement.dataset.s); renderPick(row); }));
  const row = { ev, el }; rows.push(row);
}
function renderPick(r) {
  const ev = r.ev, p = pickOf(TYPE, ev), t = todayOf(ev), box = r.el.querySelector('.pick');
  const opts = '<option value="">none (silent)</option>' + DATA.sounds.map(s => '<option value="' + esc(s.id) + '"' + (s.id === p.sound ? ' selected' : '') + '>' + esc(s.label) + (s.id === t.sound ? ' (today)' : '') + ' · ' + esc(lic(s)) + '</option>').join('');
  const db = p.db == null ? -26 : p.db;
  box.innerHTML = '<span class="k" style="margin:0">' + esc(TYPE) + '</span><select aria-label="Sound for ' + esc(ev.id) + '">' + opts + '</select>' +
    '<button type="button" class="ghost hear">Hear at level</button>' +
    '<input type="range" min="-45" max="-6" step="0.5" value="' + db + '" aria-label="Level for ' + esc(ev.id) + ' in dB"><span class="db">' + (p.db == null ? 'no level' : db + ' dB') + '</span>' +
    '<span class="legend">today ' + (t.sound ? esc(S[t.sound].label) : 'none') + (t.db != null ? ', ' + t.db + ' dB' : '') + '</span>' + (p.changed ? '<span class="changed">changed</span>' : '') +
    '<button type="button" class="ghost reset"' + (p.changed ? '' : ' hidden') + '>Back to today</button>';
  box.querySelector('select').addEventListener('change', e => { setPick(ev, 'sound', e.target.value || null); renderPick(r); });
  const rg = box.querySelector('input[type=range]');
  rg.addEventListener('input', () => { box.querySelector('.db').textContent = rg.value + ' dB'; });
  rg.addEventListener('change', () => { setPick(ev, 'db', +rg.value); renderPick(r); });
  box.querySelector('.hear').addEventListener('click', () => { const q = pickOf(TYPE, ev); if (q.sound) hear(q.sound, q.db == null ? -26 : q.db); });
  box.querySelector('.reset').addEventListener('click', () => { if (picks[TYPE]) delete picks[TYPE][ev.id]; store.set('picks', picks); renderPick(r); });
  r.el.querySelectorAll('.cand').forEach(c => c.classList.toggle('picked', c.dataset.s === p.sound));
}
function renderPicks() {
  for (const r of rows) {
    const here = usedIn(r.ev, TYPE); r.el.classList.toggle('here', here); r.el.querySelector('.badge.here').hidden = !here;
    r.el.querySelectorAll('.em').forEach(e => e.classList.toggle('here', e.dataset.types.split('|').includes(TYPE)));
    renderPick(r);
  }
}

/* the sound and emitter tables */
const st = $('sounds').querySelector('tbody');
for (const s of DATA.sounds) {
  const tr = document.createElement('tr'), L = s.licence;
  tr.innerHTML = '<td><span class="cand"><button type="button" class="pl" data-s="' + esc(s.id) + '" aria-pressed="false" aria-label="Play ' + esc(s.name) + '">▶</button></span></td><td><code>' + esc(s.name) + '</code></td><td>' + s.paths.map(p => '<code>' + esc(p) + '</code>').join('<br>') + '</td>' +
    '<td>' + (L.code ? '<b>' + esc(L.code) + '</b>' + (L.ship ? ' ships' : ' does not ship') + (L.attribution ? ', credit required' : '') : '<b>no library code</b>') + '<br><span class="legend">' + esc(L.text) + (L.credit ? ' · ' + esc(L.credit) : '') + (L.inLibrary ? '' : ' · not in the library graph') + '</span></td>' +
    '<td>' + (s.keys.sfx.length ? 'sfx: ' + s.keys.sfx.map(k => '<code>' + esc(k) + '</code>').join(', ') : '') + (s.keys.style1.length ? (s.keys.sfx.length ? '<br>' : '') + 'owner pack: ' + s.keys.style1.map(k => '<code>' + esc(k) + '</code>').join(', ') : '') + (!s.keys.sfx.length && !s.keys.style1.length ? '<span class="redwhy">no key</span>' : '') + '</td>' +
    '<td class="len" data-s="' + esc(s.id) + '">' + (s.bytes / 1024).toFixed(0) + ' KB</td><td class="legend">' + esc(s.note || '') + '</td>';
  st.appendChild(tr);
  tr.querySelector('button.pl').addEventListener('click', e => play(s.id, e.currentTarget));
}
const et = $('emitters').querySelector('tbody');
for (const e of DATA.emitters) { const tr = document.createElement('tr'); tr.innerHTML = '<td>' + esc(e.label) + '</td><td>' + esc(e.types.join(', ')) + '</td><td class="legend">' + esc(e.how) + '</td><td>' + (e.pack === 'sfx' ? 'sfx/map.json (library graph)' : 'owner pack, sfx-style1/map.json') + '</td><td>' + e.n + '</td>'; et.appendChild(tr); }
// lengths, read from each file's metadata
for (const td of document.querySelectorAll('td.len')) { const a = new Audio(); a.preload = 'metadata'; a.addEventListener('loadedmetadata', () => { if (isFinite(a.duration)) td.textContent = a.duration.toFixed(2) + ' s · ' + td.textContent; }, { once: true }); const u = urlOf(td.dataset.s); if (u) a.src = u; }

$('copy').addEventListener('click', () => {
  const out = { gallery: 'docs/galleries/sounds.html', picked: new Date().toISOString().slice(0, 10), types: {} };
  for (const ty of TYPES) {
    const c = capOf(ty), evs = {};
    for (const ev of DATA.events) { const p = pickOf(ty, ev), t = todayOf(ev); evs[ev.id] = { sound: p.sound, level_db: p.db, today: { sound: t.sound, level_db: t.db }, changed: p.changed, emitted_in_type: usedIn(ev, ty) }; }
    out.types[ty] = { sfx_per_film: c.sfxPerFilm, max_hard_hits: c.maxHardHits, max_risers: c.maxRisers, changed: Object.keys(evs).filter(k => evs[k].changed), events: evs };
  }
  const text = JSON.stringify(out, null, 2), box = $('out'), n = TYPES.reduce((s, t) => s + out.types[t].changed.length, 0);
  box.value = text;
  const fallback = () => { box.style.display = 'block'; box.focus(); box.select(); let ok = false; try { ok = document.execCommand('copy'); } catch {} $('copied').textContent = ok ? 'Copied' : 'Select the text below and copy it'; };
  if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(() => { $('copied').textContent = 'Copied (' + n + ' changes across ' + TYPES.length + ' types)'; box.style.display = 'none'; }, fallback); else fallback();
});

renderTypes(); renderCaps(); renderPicks();
window.__soundboard = { events: DATA.events.length, red: DATA.events.filter(e => e.red.length).map(e => e.id), sounds: DATA.sounds.length };
})();
`;

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, page({ rel: '../../packages/engine/assets/' }, true));
console.log(`wrote ${OUT}: ${EVENTS.length} events (${EVENTS.filter(e => e.emitted).length} emitted, ${EVENTS.filter(e => e.red.length).length} with no sound), ${SOUNDS.length} sounds, ${EMITTERS.length} emitters`);
for (const e of EVENTS) console.log(`  ${e.red.length ? 'RED ' : '    '}${e.id.padEnd(12)} ${e.aliasOf ? `→ ${e.aliasOf.padEnd(10)}` : ''.padEnd(13)} ${e.by.map(b => `${b.id}×${b.locs.length}`).join(' ') || '(nothing emits it)'}${e.red.length ? `  [${e.red.join('; ')}]` : ''}`);
const art = arg('artifact');
if (art) {
  const b64 = Object.fromEntries(SOUNDS.map(s => [s.id, readFileSync(join(ASSETS, s.id)).toString('base64')]));
  const size = Object.values(b64).reduce((n, b) => n + b.length, 0);
  if (size > 12e6) { writeFileSync(art, page({ rel: '../../packages/engine/assets/' }, false).replace('<p class="mediahint" id="mediahint" hidden></p>', '<p class="mediahint">The sounds are too large to inline here: play them from the repo copy, docs/galleries/sounds.html.</p>')); console.log(`wrote ${art} without media (${(size / 1e6).toFixed(1)} MB inlined would be too big)`); }
  else { writeFileSync(art, page({ b64 }, false)); console.log(`wrote ${art} (${(size / 1e6).toFixed(1)} MB of sounds inlined)`); }
}
