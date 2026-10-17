// pnpm --filter @moovi/engine exec tsx scripts/caption-gallery.ts [--artifact <out.html>]
// The caption gallery (decision 5, docs/agents/DECISIONS.md): every live-player caption style and a spread of
// captionseasy looks, each drawn with the player's own caption code (edit/lib.ts EDIT and the drawCaptions block of
// edit/page.ts, lifted from the page source so the gallery cannot drift from it) over the Ishaan test clip, word-timed
// and looping. A choosing tool only: Ishaan ticks the set, each type's default and alternates, and the floor numbers,
// then copies his picks as JSON. Nothing here changes a default.
// Writes docs/galleries/captions.html (fonts inlined, the clip referenced by a relative path so no media goes in git).
// --artifact also writes a copy without the document skeleton and with the clip inlined, for a claude.ai Artifact.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { color } from '@moovi/brand';
import { describeLook } from 'captionseasy';
import { CAPTION_FONTS, CAPTION_STYLES } from '../src/edit/captions';
import { EDIT, EDIT_SRC } from '../src/edit/lib';
import { STYLE_LOOKS, pickLook } from '../src/edit/looks';
import { PAGE } from '../src/edit/page';
import { STYLE_LAWS } from '../src/edit/styles';
import { CM_LOOK, CM_PALETTE } from '../src/edit/templates/clip-moment';

const ROOT = join(import.meta.dirname, '..', '..', '..');
const OUT = join(ROOT, 'docs', 'galleries', 'captions.html');
const CLIP = join(ROOT, 'docs', 'agents', 'ishaan-test', 'ishaan-test.mp4');
const FONTS = join(ROOT, 'packages', 'engine', 'assets', 'renderer', 'fonts');
const arg = (k: string) => { const i = process.argv.indexOf(`--${k}`); return i > 0 ? process.argv[i + 1] : undefined; };

/** the base edit palette (edit/job.ts EDIT_PALETTE, restated here so the script does not load the whole job module) */
const EDIT_PALETTE = { ink: color.ink, paper: color.surface, accent: color.ice, accent2: color.frostMid, deep: color.ink, pop: color.iceWhite };
/** a player style that belongs to one edit style is drawn with that style's palette, as the product does */
const STYLE_PALETTE: Record<string, { of: string; palette: Record<string, string> }> = {
  'atlas-two': { of: 'Atlas', palette: { ...EDIT_PALETTE, ...STYLE_LAWS.atlas.palette } },
  'ed-serif': { of: 'Handmade', palette: { ...EDIT_PALETTE, ...STYLE_LAWS.handmade.palette } },
  'sm-two': { of: 'Studio Minimal', palette: { ...EDIT_PALETTE, ...STYLE_LAWS['studio-minimal'].palette } },
  'cm-gold': { of: 'Clip Moment', palette: { ...CM_PALETTE } },
};

/* ── the two sample lines, word-timed (no voice: timings are synthesised from word length and punctuation) ── */
type Word = { text: string; role?: 'key' | 'number' | 'title' };
const LINES: { id: string; label: string; words: Word[] }[] = [
  { id: 'A', label: 'Plain line', words: 'Most people spend hours on every edit, and still lose the viewer in the first few seconds.'.split(' ').map(text => ({ text })) },
  { id: 'B', label: 'Number and name', words: [
    { text: 'Ishaan', role: 'title' }, { text: 'cut' }, { text: '40', role: 'number' }, { text: 'hours' }, { text: 'of' }, { text: 'editing' },
    { text: 'down' }, { text: 'to' }, { text: '5', role: 'number' }, { text: 'minutes' }, { text: 'with' }, { text: 'Moovi.', role: 'title' }] },
];
function timed(ws: Word[]) {
  let t = 0.4;
  const out = ws.map(w => {
    const d = 0.16 + 0.04 * w.text.replace(/[^\p{L}\p{N}]/gu, '').length, o = { ...w, t0: +t.toFixed(3), t1: +(t + d).toFixed(3) };
    t += d + (/[.!?]$/.test(w.text) ? 0.5 : /,$/.test(w.text) ? 0.3 : 0.04);
    return o;
  });
  return { words: out, loop: +(t + 0.9).toFixed(2) };
}
const TIMED = LINES.map(l => ({ id: l.id, label: l.label, text: l.words.map(w => w.text).join(' '), ...timed(l.words) }));

/* ── which captionseasy looks, and why ── */
const LOOK_OF: Record<number, string[]> = {};
for (const [style, n] of Object.entries(STYLE_LOOKS)) (LOOK_OF[n] ??= []).push(style);
/** the strongest others, across the package's families; each says why it is here */
const EXTRA: [number, string][] = [
  [1, 'the package\'s first viral look: letter-slam caps with a script key word'],
  [3, 'glow family: neon caps with an italic serif partner'],
  [7, 'stacked family: three lines with a big middle word'],
  [13, 'one-word family: a single word with a 3D shadow'],
  [109, 'one-word family, quieter: one tall caps word'],
  [18, 'keyword colours: caps where key words take their own colours'],
  [20, 'label family: a solid box with a solo word'],
  [27, 'word plates: italic caps on plates that pop'],
  [25, 'weight jump: light words, a bold italic key word'],
  [62, 'typographic: big and small words, minimal'],
  [64, 'loud caps that slide in and out'],
  [72, 'slam family: stacked caps that slam in'],
  [71, 'fade-in words with an italic key word (calm)'],
  [69, 'editorial serif with an italic accent (story)'],
  [108, 'luxe serif with a wipe'],
  [81, 'karaoke family: a pill, words dim until spoken'],
  [107, 'karaoke, full line read-along'],
  [82, 'highlighter family: a selection highlight that expands'],
  [17, 'highlighter on a card (marker)'],
  [102, 'soft box highlight (storytime)'],
  [104, 'minimal with a pill'],
  [105, 'the plain subtitle bar (Netflix-like), the most readable floor'],
  [114, 'mono typewriter with a cursor (tech)'],
  [124, 'glitch family: sliced caps with RGB split'],
  [93, 'social family: a phone notification banner'],
];
/** the layouts the player draws as one line of words (anything else is approximated) */
const LINE_LAYOUTS = new Set(['sentence', 'word', 'plain-line', 'solo']);

interface Tile {
  key: string; id: string; group: string; source: string; name: string; note: string; why?: string;
  st: string; palette: Record<string, string>; look?: { number: number; id: string; style: Record<string, unknown> };
  fidelity: 'player' | 'close' | 'approx'; gaps: string[];
}
const tiles: Tile[] = [];

// 1. every player style (none hidden), in captions.ts order
for (const s of CAPTION_STYLES) {
  const own = STYLE_PALETTE[s.id];
  tiles.push({ key: `player:${s.id}`, id: s.id, group: 'Player styles', source: 'edit/captions.ts (live player)', name: s.id,
    note: `${s.family}, energy ${s.energy}; ${s.font.family} ${s.font.weight} ${s.font.case}${s.key ? ` + key ${s.key.family}` : ''}; ${s.chunk.mode} chunks; entry ${s.entry}; ${s.position}${own ? `; ${own.of} palette` : ''}`,
    st: s.id, palette: own?.palette ?? EDIT_PALETTE, fidelity: 'player', gaps: [] });
}

// 2. captionseasy looks, through the player's look path (pickLook → player_style, EDIT.lookProps)
const sample = TIMED[0]!.words.map(w => ({ text: w.text, t0: w.t0, t1: w.t1 }));
function lookTile(n: number, group: string, why?: string): Tile | null {
  let d, l;
  try { d = describeLook(n); l = pickLook(sample, { look: n }); } catch (e) { console.warn(`look ${n}: ${(e as Error).message}`); return null; }
  const s = l.style as any, lk = EDIT.lookProps(s, 1080)!, gaps: string[] = [];
  if (!LINE_LAYOUTS.has(d.layout)) gaps.push(`layout "${d.layout}": the player draws one line of words`);
  if (s.fill?.type && s.fill.type !== 'solid') gaps.push(`${s.fill.type} fill dropped (solid ${lk.fill ?? 'palette'} instead)`);
  if (s.background?.type && s.background.type !== 'none') gaps.push(`${s.background.type} backing dropped`);
  if (s.glow?.enabled) gaps.push('glow dropped');
  const eff = String(s.active?.effect ?? '');
  if (eff && !['box', 'pill', 'highlight', 'scale', 'pop', 'color', 'colour', 'none'].includes(eff)) gaps.push(`active word "${eff}" drawn as ${lk.hi.treat}`);
  if (typeof s.inactiveOpacity === 'number' && s.inactiveOpacity < 1) gaps.push('words not yet spoken are not dimmed');
  if (s.rotation) gaps.push(`rotation ${s.rotation}° dropped`);
  const font = String(s.fontId ?? s.fontFamily ?? '');
  if (font && !font.toLowerCase().includes(lk.family.toLowerCase().split(' ')[0]!)) gaps.push(`font ${font} → ${lk.family}`);
  const structural = gaps.some(g => !g.startsWith('font '));
  const used = LOOK_OF[n];
  const note = [d.description, `drawn over player style ${l.player_style}`, used ? `STYLE_LOOKS: ${used.join(', ')}` : '', n === CM_LOOK ? 'Clip Moment\'s stored look (the product draws Clip Moment as cm-gold)' : ''].filter(Boolean).join('. ');
  return { key: `look:${n}`, id: `${n} ${d.id}`, group, source: `captionseasy look ${n} (${d.section})`, name: d.name, note, ...(why ? { why } : {}),
    st: l.player_style, palette: EDIT_PALETTE, look: { number: n, id: d.id, style: s }, fidelity: structural ? 'approx' : gaps.length ? 'close' : 'player', gaps };
}
const editLooks = [...new Set([...Object.values(STYLE_LOOKS), CM_LOOK])];
for (const n of editLooks) { const t = lookTile(n, 'Looks the edit styles start from'); if (t) tiles.push(t); }
for (const [n, why] of EXTRA) { if (editLooks.includes(n)) continue; const t = lookTile(n, 'Other captionseasy looks', why); if (t) tiles.push(t); }

/* ── the player's own caption code, lifted from the page source ── */
function between(src: string, from: string, to: string, inclusiveTo = false) {
  const a = src.indexOf(from), b = src.indexOf(to, a);
  if (a < 0 || b < 0) throw new Error(`caption-gallery: the player page changed shape (looked for "${from}" … "${to}"); update the extraction`);
  return src.slice(a, inclusiveTo ? b + to.length : b);
}
const DRAW_SRC = between(PAGE, 'let chunkKey = -2;', "cap.style.top = (CAP_BASE * H) + 'px';", true);
const CAP_CSS = PAGE.split('\n').filter(l => l.startsWith('.cap')).join('\n');
if (!CAP_CSS.includes('.cap .w')) throw new Error('caption-gallery: caption CSS not found in the player page');
const LAYER_SRC = `function makeLayer(E, ST, LK, CW, cap, W, H) { const TPL = null;\n${DRAW_SRC}\nreturn drawCaptions; }`;

const FONT_CSS = CAPTION_FONTS.replace(/url\(\/engine\/fonts\/([^)]+)\)/g, (_, f: string) => `url(data:font/woff2;base64,${readFileSync(join(FONTS, f)).toString('base64')})`);
const FONT_FACES = CAPTION_FONTS.split('\n').map(l => { const m = /font-family:'([^']+)'.*font-weight:([^;]+);font-style:(\w+)/.exec(l)!; return { family: m[1], weight: m[2]!.split(' ').pop(), style: m[3] }; });

const TYPES = ['Edit my video', 'Launch', 'Showreel', 'Brand post', 'SaaS explainer', 'UI morph', 'Kinetic type'];
const FLOOR = { minSec: 0.45, secPerWord: 0, maxLines: 0, maxWords: 4 }; // CHECK today (review/config.ts) for the first and last; 0 = off

const DATA = { tiles, lines: TIMED, types: TYPES, floor: FLOOR, styles: CAPTION_STYLES, faces: FONT_FACES };

/* ── the page ── */
function page(clip: { src: string } | { b64: string }, skeleton: boolean) {
  const body = `<title>Caption Gallery</title>
<meta name="claude:viewport-fit-sides" content="cover">
<style>
/* Layout: a sticky control strip over a contact sheet of 9:16 phone frames, one per caption; the film is the hero, the chrome stays quiet. */
:root{
  --bg:#0A111C; --panel:#111B2A; --line:#22324A; --fg:${color.iceWhite}; --muted:#93A6BF; --ice:${color.ice}; --flag:#FF7A6B; --ok:#8FD9B6; --warn:#F2C86B;
  --ui:'Geist',system-ui,sans-serif; --mono:'JetBrains Mono',ui-monospace,monospace; color-scheme:dark;
}
${FONT_CSS}
${CAP_CSS}
html,body{background:var(--bg);color:var(--fg)}
body{font:14px/1.45 var(--ui);margin:0;padding-left:max(16px,env(safe-area-inset-left,0px));padding-right:max(16px,env(safe-area-inset-right,0px));padding-block:0 48px}
h1{font:600 22px/1.2 var(--ui);margin:0;letter-spacing:-.01em;text-wrap:balance}
h2{font:600 13px var(--ui);text-transform:uppercase;letter-spacing:.08em;color:var(--muted);margin:28px 0 12px}
p{margin:0}
.intro{display:grid;gap:6px;padding-block:20px 12px;max-width:80ch;color:var(--muted)}
.intro h1{color:var(--fg)}
.bar{position:sticky;top:env(safe-area-inset-top,0px);z-index:5;background:color-mix(in srgb,var(--bg) 92%,transparent);backdrop-filter:blur(8px);border-bottom:1px solid var(--line);padding-block:10px;display:grid;gap:8px}
.row{display:flex;flex-wrap:wrap;gap:8px 16px;align-items:center}
.ctl{display:flex;gap:6px;align-items:center;color:var(--muted);font-size:12px}
.ctl input[type=number]{width:58px;background:var(--panel);color:var(--fg);border:1px solid var(--line);border-radius:6px;padding:4px 6px;font:13px var(--mono)}
.seg{display:inline-flex;border:1px solid var(--line);border-radius:8px;overflow:hidden}
.seg button{border:0;border-radius:0;background:transparent;color:var(--muted);padding:6px 10px;font:12px var(--ui);cursor:pointer}
.seg button[aria-pressed=true]{background:var(--ice);color:#0A111C}
button.act{border:1px solid var(--ice);background:var(--ice);color:#0A111C;border-radius:8px;padding:7px 14px;font:600 13px var(--ui);cursor:pointer}
button.ghost{border:1px solid var(--line);background:transparent;color:var(--fg);border-radius:8px;padding:6px 12px;font:12px var(--ui);cursor:pointer}
button:focus-visible,input:focus-visible{outline:2px solid var(--ice);outline-offset:2px}
.sum{display:flex;flex-wrap:wrap;gap:6px;font-size:12px}
.sum span{border:1px solid var(--line);border-radius:999px;padding:2px 9px;color:var(--muted)}
.sum span b{color:var(--fg);font-weight:600}
.sum span.miss{border-style:dashed}
#copied{font-size:12px;color:var(--ok)}
#out{display:none;width:100%;min-height:120px;background:var(--panel);color:var(--fg);border:1px solid var(--line);border-radius:8px;font:12px var(--mono)}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(210px,1fr));gap:18px}
.tile{display:grid;gap:8px;align-content:start;min-width:0}
.frame{position:relative;aspect-ratio:9/16;max-width:100%;border-radius:10px;overflow:hidden;background:#000;outline:1px solid var(--line)}
.tile.flag .frame{outline:2px solid var(--flag)}
.tile.inset .frame{box-shadow:0 0 0 3px var(--bg),0 0 0 5px var(--ice)}
.frame canvas{position:absolute;inset:0;width:100%;height:100%}
.stage{position:absolute;left:0;top:0;width:1080px;height:1920px;transform-origin:0 0;overflow:hidden}
.meta{display:grid;gap:3px;min-width:0}
.idl{display:flex;gap:6px;align-items:baseline;flex-wrap:wrap}
.idl code{font:600 13px var(--mono);color:var(--fg)}
.badge{font:10px var(--ui);text-transform:uppercase;letter-spacing:.06em;border-radius:4px;padding:1px 5px;border:1px solid currentColor}
.badge.player{color:var(--ok)}.badge.close{color:var(--warn)}.badge.approx{color:var(--flag)}
.src{font-size:11px;color:var(--muted)}
.note{font-size:12px;color:var(--muted)}
.why{font-size:12px;color:var(--fg)}
details{font-size:12px;color:var(--muted)}
details summary{cursor:pointer;color:var(--warn)}
details ul{margin:4px 0 0;padding-left:16px}
.flags{font-size:12px;color:var(--flag);min-height:0}
.pick{display:grid;gap:6px;border-top:1px solid var(--line);padding-top:8px}
.pick label{display:flex;gap:6px;align-items:center;font-size:12px;cursor:pointer}
.types{display:flex;flex-wrap:wrap;gap:4px}
.types button{font:11px var(--ui);border:1px solid var(--line);background:transparent;color:var(--muted);border-radius:999px;padding:2px 7px;cursor:pointer}
.types button.alt{border-color:var(--ice);color:var(--ice)}
.types button.def{background:var(--ice);border-color:var(--ice);color:#0A111C;font-weight:600}
.legend{font-size:12px;color:var(--muted)}
@media (prefers-reduced-motion:reduce){.bar{backdrop-filter:none}}
</style>
<div class="intro">
  <h1>Caption Gallery</h1>
  <p>Every live-player caption style and ${tiles.filter(t => t.look).length} captionseasy looks, drawn by the player's own caption code over the Ishaan test clip. Pick 8 to 12 for the set, then a default and alternates for each type. Tap a type chip once for alternate, twice for default, a third time to clear. Copy your picks and paste them into chat.</p>
  <p class="legend">Badges: <span class="badge player">player</span> drawn exactly as users see it · <span class="badge close">close</span> only the font is swapped · <span class="badge approx">approx</span> the player cannot draw the look's layout or effects (open "what the player drops"). Looks move with their player style's entry and size, not their own. No face data here, so face-safe styles sit at the chest band.</p>
</div>
<div class="bar">
  <div class="row">
    <span class="seg" role="group" aria-label="Sample line">${TIMED.map((l, i) => `<button id="line-${l.id}" aria-pressed="${i === 0}" data-line="${i}">${l.id}: ${l.label}</button>`).join('')}</span>
    <button class="ghost" id="pause">Pause</button>
    <input id="scrub" type="range" min="0" max="1000" value="0" aria-label="Time" style="flex:1;min-width:120px">
    <button class="act" id="copy">Copy my picks</button><span id="copied" aria-live="polite"></span>
  </div>
  <div class="row">
    <span class="ctl"><label for="f-minSec">Min seconds on screen</label><input id="f-minSec" type="number" step="0.05" min="0"></span>
    <span class="ctl"><label for="f-secPerWord">Seconds per word</label><input id="f-secPerWord" type="number" step="0.05" min="0"></span>
    <span class="ctl"><label for="f-maxLines">Max lines</label><input id="f-maxLines" type="number" step="1" min="0"></span>
    <span class="ctl"><label for="f-maxWords">Max words</label><input id="f-maxWords" type="number" step="1" min="0"></span>
    <span class="ctl" id="flagcount"></span>
    <span class="ctl">0 = off. Starts at CHECK today: 0.45 s, 4 words.</span>
  </div>
  <div class="sum" id="sum"></div>
  <textarea id="out" readonly aria-label="Picks JSON"></textarea>
</div>
<div id="groups"></div>
<video id="clip" muted loop playsinline autoplay preload="auto" style="display:none"></video>
<script>${EDIT_SRC}
${LAYER_SRC}
var DATA = ${JSON.stringify(DATA)};
var CLIP = ${JSON.stringify(clip)};
</script>
<script>${CLIENT}</script>`;
  return skeleton ? `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">\n${body.replace('</style>', '</style></head><body>')}\n</body></html>` : body;
}

const CLIENT = String.raw`
(async () => {
const $ = id => document.getElementById(id), W = 1080, H = 1920;
const T = DATA.tiles, TYPES = DATA.types, ST_BY = Object.fromEntries(DATA.styles.map(s => [s.id, s]));
let LINE = 0, paused = false, frozenT = 0, T0 = performance.now();
const store = { get(k, d) { try { const v = localStorage.getItem('moovi-cg-' + k); return v ? JSON.parse(v) : d; } catch { return d; } }, set(k, v) { try { localStorage.setItem('moovi-cg-' + k, JSON.stringify(v)); } catch {} } };
const picks = store.get('picks', {}); // key -> { set: bool, types: { type: 'alt' | 'def' } }
const floor = Object.assign({}, DATA.floor, store.get('floor', {}));

/* the clip: one hidden video, drawn into every visible frame */
const V = $('clip');
if (CLIP.b64) { const b = atob(CLIP.b64), u = new Uint8Array(b.length); for (let i = 0; i < b.length; i++) u[i] = b.charCodeAt(i); V.src = URL.createObjectURL(new Blob([u], { type: 'video/mp4' })); } else V.src = CLIP.src;
V.play().catch(() => {});
document.addEventListener('click', () => V.paused && !paused && V.play().catch(() => {}), { once: true });

await Promise.all(DATA.faces.map(f => document.fonts.load((f.style === 'italic' ? 'italic ' : '') + f.weight + ' 40px "' + f.family + '"').catch(() => null)));

/* an EDL per line, as the player gets it: one shot, the words in source time */
const edl = (tile, li) => ({ version: 'gallery', style_id: 'gallery', source: { file: '', duration: 60, w: 848, h: 478, fps: 30 }, output: { w: W, h: H, fps: 30 }, palette: tile.palette,
  caption_style_id: tile.st, words: DATA.lines[li].words.map(w => ({ src_t0: w.t0, src_t1: w.t1, text: w.text, ...(w.role ? { role: w.role } : {}) })), shots: [{ t_in: 0, t_out: 60, src_in: 0, src_out: 60 }] });

/* the tiles */
const groups = $('groups'); let grid = null, gname = '';
const cards = T.map((tile, i) => {
  if (tile.group !== gname) { gname = tile.group; const h = document.createElement('h2'); h.textContent = gname + ' (' + T.filter(x => x.group === gname).length + ')'; groups.appendChild(h); grid = document.createElement('div'); grid.className = 'grid'; groups.appendChild(grid); }
  const el = document.createElement('article'); el.className = 'tile';
  el.innerHTML = '<div class="frame"><canvas></canvas><div class="stage"><div class="cap"></div></div></div>'
    + '<div class="meta"><div class="idl"><code></code><span class="badge ' + tile.fidelity + '">' + tile.fidelity + '</span></div><div class="src"></div>'
    + (tile.why ? '<p class="why"></p>' : '') + '<p class="note"></p>'
    + (tile.gaps.length ? '<details><summary>What the player drops (' + tile.gaps.length + ')</summary><ul>' + tile.gaps.map(g => '<li></li>').join('') + '</ul></details>' : '')
    + '<div class="flags"></div></div>'
    + '<div class="pick"><label><input type="checkbox" id="set-' + i + '"> In the set</label><div class="types">' + TYPES.map(ty => '<button type="button"></button>').join('') + '</div></div>';
  el.querySelector('code').textContent = tile.key;
  el.querySelector('.src').textContent = tile.source + (tile.look ? ' · ' + tile.name : '');
  if (tile.why) el.querySelector('.why').textContent = 'Why here: ' + tile.why;
  el.querySelector('.note').textContent = tile.note;
  el.querySelectorAll('details li').forEach((li, j) => li.textContent = tile.gaps[j]);
  grid.appendChild(el);
  const stage = el.querySelector('.stage'), cap = el.querySelector('.cap'), cv = el.querySelector('canvas');
  for (const k in tile.palette) stage.style.setProperty('--' + k, tile.palette[k]);
  const ST = ST_BY[tile.st], LK = tile.look ? EDIT.lookProps(tile.look.style, W) : null;
  const layers = DATA.lines.map((_, li) => { const E = edl(tile, li), CW = EDIT.chunk(EDIT.captionWords(E), ST); return { E, CW, draw: null }; });
  const card = { tile, el, stage, cap, cv, ST, LK, layers, li: -1, draw: null, stats: [], visible: false };
  card.use = li => { if (card.li === li) return; card.li = li; cap.innerHTML = ''; cap.removeAttribute('style'); const L = layers[li]; card.draw = makeLayer(L.E, ST, LK, L.CW, cap, W, H); };
  return card;
});

/* scale each stage to its frame */
const ro = new ResizeObserver(es => { for (const e of es) { const c = cards.find(c => c.el.querySelector('.frame') === e.target); if (!c) continue; const w = e.contentRect.width; c.stage.style.transform = 'scale(' + (w / W) + ')'; c.cv.width = Math.round(w * Math.min(2, devicePixelRatio || 1)); c.cv.height = Math.round(c.cv.width * 16 / 9); } });
cards.forEach(c => ro.observe(c.el.querySelector('.frame')));
const io = new IntersectionObserver(es => { for (const e of es) { const c = cards.find(c => c.el === e.target); if (c) c.visible = e.isIntersecting; } }, { rootMargin: '200px' });
cards.forEach(c => io.observe(c.el));

/* per chunk: seconds on screen, words, lines as drawn (measured on the player's own layout, at the chunk's end) */
function measure(c, li) {
  c.use(li); const L = c.layers[li], out = [];
  L.CW.chunks.forEach((ch, k) => {
    const t = Math.max(ch.t0 + 0.01, ch.t1 - 0.045); c.draw(t);
    let lines = 0, prev = null;
    for (const el of c.cap.children) { const cy = el.offsetTop + el.offsetHeight / 2, h = el.offsetHeight; if (!prev || cy - prev.cy > 0.6 * Math.max(h, prev.h)) lines++; prev = { cy, h }; }
    out.push({ dur: ch.t1 - ch.t0, words: ch.words.length, lines, text: ch.words.map(i => L.CW.words[i].text).join(' ') });
  });
  return out;
}
for (const c of cards) c.stats = DATA.lines.map((_, li) => measure(c, li));
cards.forEach(c => c.use(LINE));

function flagsOf(c) {
  const out = [];
  c.stats.forEach((ss, li) => {
    const id = DATA.lines[li].id, n = f => ss.filter(f).length, r = [];
    if (floor.minSec > 0 && n(s => s.dur < floor.minSec)) r.push(n(s => s.dur < floor.minSec) + ' under ' + floor.minSec + ' s');
    if (floor.secPerWord > 0 && n(s => s.dur / s.words < floor.secPerWord)) r.push(n(s => s.dur / s.words < floor.secPerWord) + ' faster than ' + floor.secPerWord + ' s/word');
    if (floor.maxLines > 0 && n(s => s.lines > floor.maxLines)) r.push(n(s => s.lines > floor.maxLines) + ' over ' + floor.maxLines + ' lines (up to ' + Math.max(...ss.map(s => s.lines)) + ')');
    if (floor.maxWords > 0 && n(s => s.words > floor.maxWords)) r.push(n(s => s.words > floor.maxWords) + ' over ' + floor.maxWords + ' words (up to ' + Math.max(...ss.map(s => s.words)) + ')');
    if (r.length) out.push('Line ' + id + ', ' + ss.length + ' chunks: ' + r.join('; '));
  });
  return out;
}
function refreshFlags() {
  let k = 0;
  for (const c of cards) { const f = flagsOf(c); c.flags = f; c.el.classList.toggle('flag', f.length > 0); c.el.querySelector('.flags').textContent = f.join(' · '); if (f.length) k++; }
  $('flagcount').textContent = k + ' of ' + cards.length + ' flagged';
}
for (const k of Object.keys(DATA.floor)) { const inp = $('f-' + k); inp.value = floor[k]; inp.addEventListener('input', () => { floor[k] = Math.max(0, +inp.value || 0); store.set('floor', floor); refreshFlags(); }); }
refreshFlags();

/* picks */
function pickOf(key) { return picks[key] || (picks[key] = { set: false, types: {} }); }
function renderPicks() {
  cards.forEach((c, i) => {
    const p = picks[c.tile.key] || { set: false, types: {} };
    $('set-' + i).checked = !!p.set; c.el.classList.toggle('inset', !!p.set);
    c.el.querySelectorAll('.types button').forEach((b, j) => { const v = p.types[TYPES[j]]; b.className = v || ''; b.textContent = (v === 'def' ? 'Default: ' : v === 'alt' ? 'Alt: ' : '') + TYPES[j]; b.setAttribute('aria-label', TYPES[j] + ': ' + (v === 'def' ? 'default' : v === 'alt' ? 'alternate' : 'not picked')); });
  });
  const inSet = T.filter(t => picks[t.key] && picks[t.key].set).length;
  $('sum').innerHTML = '<span' + (inSet < 8 || inSet > 12 ? ' class="miss"' : '') + '>In the set <b>' + inSet + '</b> (aim 8–12)</span>' + TYPES.map(ty => {
    const d = T.find(t => picks[t.key] && picks[t.key].types[ty] === 'def'), a = T.filter(t => picks[t.key] && picks[t.key].types[ty] === 'alt').length;
    return '<span' + (!d || a < 2 ? ' class="miss"' : '') + '>' + ty + ': <b>' + (d ? d.id : 'no default') + '</b> + ' + a + ' alt</span>';
  }).join('');
  store.set('picks', picks);
}
cards.forEach((c, i) => {
  $('set-' + i).addEventListener('change', e => { pickOf(c.tile.key).set = e.target.checked; renderPicks(); });
  c.el.querySelectorAll('.types button').forEach((b, j) => b.addEventListener('click', () => {
    const ty = TYPES[j], p = pickOf(c.tile.key), v = p.types[ty], next = !v ? 'alt' : v === 'alt' ? 'def' : null;
    if (next === 'def') for (const k in picks) if (picks[k].types[ty] === 'def') picks[k].types[ty] = 'alt'; // one default per type: the old one becomes an alternate
    if (next) { p.types[ty] = next; p.set = true; } else delete p.types[ty];
    renderPicks();
  }));
});
renderPicks();

$('copy').addEventListener('click', () => {
  const keys = T.filter(t => picks[t.key] && picks[t.key].set).map(t => t.key);
  const out = { gallery: 'docs/galleries/captions.html', picked: new Date().toISOString().slice(0, 10), set: keys,
    types: Object.fromEntries(TYPES.map(ty => [ty, { default: (T.find(t => picks[t.key] && picks[t.key].types[ty] === 'def') || {}).key || null, alternates: T.filter(t => picks[t.key] && picks[t.key].types[ty] === 'alt').map(t => t.key) }])),
    floor: { min_seconds_on_screen: floor.minSec, seconds_per_word: floor.secPerWord, max_lines: floor.maxLines, max_words: floor.maxWords },
    flagged_at_this_floor: cards.filter(c => c.flags.length).map(c => ({ key: c.tile.key, why: c.flags })).filter(f => keys.includes(f.key)) };
  const text = JSON.stringify(out, null, 2), box = $('out');
  box.value = text;
  const fallback = () => { box.style.display = 'block'; box.focus(); box.select(); let ok = false; try { ok = document.execCommand('copy'); } catch {} $('copied').textContent = ok ? 'Copied' : 'Select the text below and copy it'; };
  if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(() => { $('copied').textContent = 'Copied ' + keys.length + ' picks'; box.style.display = 'none'; }, fallback); else fallback();
});

/* line toggle, pause, scrub */
document.querySelectorAll('[data-line]').forEach(b => b.addEventListener('click', () => { LINE = +b.dataset.line; document.querySelectorAll('[data-line]').forEach(x => x.setAttribute('aria-pressed', String(x === b))); cards.forEach(c => c.use(LINE)); T0 = performance.now(); frozenT = 0; }));
$('pause').addEventListener('click', () => { paused = !paused; $('pause').textContent = paused ? 'Play' : 'Pause'; if (paused) { frozenT = now(); V.pause(); } else { T0 = performance.now() - frozenT * 1000; V.play().catch(() => {}); } });
$('scrub').addEventListener('input', e => { if (!paused) $('pause').click(); frozenT = +e.target.value / 1000 * DATA.lines[LINE].loop; });
const now = () => paused ? frozenT : ((performance.now() - T0) / 1000) % DATA.lines[LINE].loop;

/* the frame loop: picture (centre crop, object-fit cover), then the player's caption layer */
function drawPic(c) {
  const x = c.cv.getContext('2d'), w = c.cv.width, h = c.cv.height;
  if (V.readyState >= 2 && V.videoWidth) { const k = Math.max(w / V.videoWidth, h / V.videoHeight), sw = w / k, sh = h / k; x.drawImage(V, (V.videoWidth - sw) / 2, (V.videoHeight - sh) / 2, sw, sh, 0, 0, w, h); }
  else { const g = x.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#5d6b78'); g.addColorStop(1, '#232a31'); x.fillStyle = g; x.fillRect(0, 0, w, h); }
}
function frame() {
  const t = now();
  for (const c of cards) if (c.visible) { drawPic(c); c.draw(t); }
  if (!paused) $('scrub').value = String(Math.round(t / DATA.lines[LINE].loop * 1000));
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
window.__gallery = { cards: cards.length, stats: () => cards.map(c => ({ key: c.tile.key, stats: c.stats })) };
})().catch(e => { document.body.insertAdjacentHTML('afterbegin', '<pre style="color:#FF7A6B;white-space:pre-wrap">' + String(e && e.stack || e) + '</pre>'); });
`;

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, page({ src: '../agents/ishaan-test/ishaan-test.mp4' }, true));
console.log(`wrote ${OUT} (${tiles.length} tiles: ${tiles.filter(t => !t.look).length} player styles, ${tiles.filter(t => t.look).length} looks)`);
for (const t of tiles) console.log(`  ${t.key.padEnd(20)} ${t.fidelity.padEnd(6)} ${t.look ? `→ ${t.st}` : ''}${t.gaps.length ? `  [${t.gaps.join('; ')}]` : ''}`);
const art = arg('artifact');
if (art) { writeFileSync(art, page({ b64: readFileSync(CLIP).toString('base64') }, false)); console.log(`wrote ${art}`); }
