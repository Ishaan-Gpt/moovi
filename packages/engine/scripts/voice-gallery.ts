// pnpm --filter @moovi/engine exec tsx --env-file-if-exists=../../.env.local scripts/voice-gallery.ts [--no-render] [--artifact <out.html>]
// The voice board (decision 8, docs/agents/DECISIONS.md): every voice of the library (audio/voices.ts, Edge) and, when
// an OpenAI key is set, the OpenAI speech voices (audio/openai-tts.ts), each speaking the same two sample lines (one
// English, one Hinglish) through the product's own line path (audio/lines.ts speakLines, so its hash cache is reused),
// at the rate the Voice Director gives that voice for a plain brief (audio/cast.ts rateFor). A choosing tool only:
// Ishaan picks voices per type, a speed per type and a two-voice pair per type, then copies his picks as JSON.
// Nothing here changes a default.
// Audio goes to data/galleries/voices/ (gitignored), referenced from the page by relative path; the render skips any
// line already there (--no-render only rebuilds the page). --artifact also writes a copy without the document skeleton,
// the mp3s inlined when they stay under ~12 MB.
import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { color } from '@moovi/brand';
import { config } from '../src/config';
import { rateFor, readWish } from '../src/audio/cast';
import { lineKey, speakLines, type Engine } from '../src/audio/lines';
import { OPENAI_TTS_MODEL, OPENAI_TTS_VOICES } from '../src/audio/openai-tts';
import { DEFAULT_VOICE, VOICES, voiceById } from '../src/audio/voices';

const ROOT = join(import.meta.dirname, '..', '..', '..');
const OUT = join(ROOT, 'docs', 'galleries', 'voices.html');
const GDIR = join(ROOT, 'data', 'galleries', 'voices');
const MANIFEST = join(GDIR, 'manifest.json');
const arg = (k: string) => { const i = process.argv.indexOf(`--${k}`); return i > 0 ? process.argv[i + 1] : undefined; };
const flag = (k: string) => process.argv.includes(`--${k}`);

/* ── the two sample lines (neutral product-video sentences, the same for every voice) ── */
const LINES = [
  { id: 'en', label: 'English', text: 'Paste a link, pick a look, and your video is ready in a few minutes, with a voice, captions and music.' },
  { id: 'hinglish', label: 'Hinglish', text: 'Bas apna link paste karo, ek look chuno, aur aapka video kuch hi minutes mein ready ho jayega.' },
];

/* ── the product's rates today: the Voice Director's rateFor for a plain brief, and the style paths' own defaults ── */
const PLAIN = readWish({ brief: '' });
const DEFAULT_INFO = voiceById(DEFAULT_VOICE)!;
const PRODUCT_RATE = rateFor(PLAIN, DEFAULT_INFO);
const pct = (r: string) => Number(/^([+-]?\d+)%$/.exec(r)?.[1] ?? 0);
const RATE_RULE = {
  plain: PRODUCT_RATE,
  byEnergy: ([1, 2, 3, 4, 5] as const).map(e => ({ energy: e, rate: rateFor({ ...PLAIN, energy: e }, DEFAULT_INFO) })),
  nonEnglish: rateFor({ ...PLAIN, energy: 5 }, VOICES.find(x => x.lang !== 'en')!),
  child: rateFor({ ...PLAIN, energy: 5 }, VOICES.find(x => x.age === 'child')!),
};
/** each style path's own fallback rate, lifted from its source so the board cannot drift from it */
const STYLE_RATES = ([['Editorial (s4)', 'styles/s4.ts'], ['Clear Signal (s5)', 'styles/s5.ts'], ['Dark Vox', 'styles/darkvox.ts'], ['Anatomy', 'styles/anatomy.ts'], ['Clip Moment (edit)', 'edit/templates/clip-moment-run.ts']] as const)
  .map(([where, file]) => { const m = /rate \?\? '([+-]?\d+%)'/.exec(readFileSync(join(import.meta.dirname, '..', 'src', file), 'utf8')); return { where, file: `src/${file}`, rate: m?.[1] ?? null }; });

/* ── the voices ── */
interface Voice {
  key: string; engine: Engine; voice: string; name: string; locale: string; lang: string; accent: string;
  gender: string; age: string; energy: number | null; tone: string[]; use: string[]; multilingual: boolean; rate: string; tagged: boolean;
}
const voices: Voice[] = VOICES.map(x => ({ key: `edge:${x.id}`, engine: 'edge', voice: x.id, name: x.name, locale: x.locale, lang: x.lang, accent: x.accent,
  gender: x.gender, age: x.age, energy: x.energy, tone: x.tone, use: x.use, multilingual: !!x.multilingual, rate: rateFor(PLAIN, x), tagged: true }));
const OPENAI = !!config.voice.openaiKey;
// the openai voices take no rate (the line path sends none) and have no tags in the product yet
if (OPENAI) for (const n of OPENAI_TTS_VOICES) voices.push({ key: `openai:${n}`, engine: 'openai', voice: n, name: n[0]!.toUpperCase() + n.slice(1), locale: '', lang: '', accent: '',
  gender: '', age: '', energy: null, tone: [], use: [], multilingual: true, rate: '+0%', tagged: false });

const fileOf = (v: Voice, lineId: string) => join(GDIR, v.engine, `${v.voice}.${lineId}.mp3`);
const relOf = (v: Voice, lineId: string) => `../../data/galleries/voices/${v.engine}/${v.voice}.${lineId}.mp3`;

type Entry = { seconds: number; bytes: number; from: 'cache' | 'spoken' | 'gallery' };
const manifest: Record<string, Entry> = existsSync(MANIFEST) ? JSON.parse(readFileSync(MANIFEST, 'utf8')) : {};
const failed: { key: string; line: string; error: string }[] = [];

async function renderOne(v: Voice, l: typeof LINES[number]) {
  const out = fileOf(v, l.id), id = `${v.key}.${l.id}`;
  if (existsSync(out) && manifest[id]) { manifest[id]!.from = 'gallery'; return; }
  const work = join(GDIR, 'work', `${v.engine}-${v.voice}-${l.id}`);
  const r = await speakLines(work, [l.text], { voice: v.voice, rate: v.rate, engine: v.engine, concurrency: 1 });
  const k = lineKey({ engine: v.engine, voice: v.voice, rate: v.rate, pitch: '+0Hz', text: l.text });
  mkdirSync(dirname(out), { recursive: true });
  copyFileSync(join(config.voice.cache, k.slice(0, 2), `${k}.mp3`), out);
  rmSync(work, { recursive: true, force: true });
  manifest[id] = { seconds: +r.seconds.toFixed(2), bytes: statSync(out).size, from: r.stats.cached ? 'cache' : 'spoken' };
}
async function pool<T>(items: T[], n: number, fn: (x: T) => Promise<void>) {
  let next = 0;
  await Promise.all(Array.from({ length: Math.max(1, Math.min(n, items.length)) }, async () => { while (next < items.length) await fn(items[next++]!); }));
}

if (!flag('no-render')) {
  const jobs = voices.flatMap(v => LINES.map(l => ({ v, l })));
  const t0 = Date.now();
  let miss: typeof jobs = [];
  // the product's concurrency (config.voice.concurrency lines at once); every failure gets one more try
  await pool(jobs, config.voice.concurrency, async j => { try { await renderOne(j.v, j.l); } catch { miss.push(j); } });
  if (miss.length) {
    console.log(`retrying ${miss.length} failed lines once`);
    const again = miss; miss = [];
    await pool(again, config.voice.concurrency, async j => { try { await renderOne(j.v, j.l); } catch (e) { failed.push({ key: j.v.key, line: j.l.id, error: String(e instanceof Error ? e.message : e).slice(0, 200) }); } });
  }
  rmSync(join(GDIR, 'work'), { recursive: true, force: true });
  mkdirSync(GDIR, { recursive: true });
  writeFileSync(MANIFEST, JSON.stringify(manifest, null, 1));
  writeFileSync(join(GDIR, 'failed.json'), JSON.stringify(failed, null, 1));
  const n = Object.values(manifest);
  console.log(`voices: ${jobs.length - failed.length}/${jobs.length} lines in ${((Date.now() - t0) / 1000).toFixed(1)} s (${n.filter(x => x.from === 'spoken').length} spoken, ${n.filter(x => x.from === 'cache').length} from the line cache, ${n.filter(x => x.from === 'gallery').length} already here)`);
} else if (existsSync(join(GDIR, 'failed.json'))) failed.push(...JSON.parse(readFileSync(join(GDIR, 'failed.json'), 'utf8')));
for (const v of voices) for (const l of LINES) if (!existsSync(fileOf(v, l.id)) && !failed.some(f => f.key === v.key && f.line === l.id)) failed.push({ key: v.key, line: l.id, error: 'not rendered yet (run without --no-render)' });

const TYPES = ['Edit my video', 'Launch', 'Showreel', 'Brand post', 'SaaS explainer', 'UI morph', 'Kinetic type'];
const have = (v: Voice, l: string) => existsSync(fileOf(v, l));
const DATA = {
  voices: voices.map(v => ({ ...v, audio: Object.fromEntries(LINES.map(l => [l.id, have(v, l.id) ? manifest[`${v.key}.${l.id}`] ?? { seconds: 0, bytes: statSync(fileOf(v, l.id)).size } : null])) })),
  lines: LINES, types: TYPES, productRate: PRODUCT_RATE, rateRule: RATE_RULE, styleRates: STYLE_RATES, defaultVoice: `edge:${DEFAULT_VOICE}`, failed,
  openai: { available: OPENAI, model: OPENAI_TTS_MODEL, voices: OPENAI_TTS_VOICES },
};
const totalBytes = voices.reduce((s, v) => s + LINES.reduce((t, l) => t + (have(v, l.id) ? statSync(fileOf(v, l.id)).size : 0), 0), 0);

/* ── the page ── */
type Audio = { kind: 'src' } | { kind: 'b64'; map: Record<string, string> } | { kind: 'none' };
function page(audio: Audio, skeleton: boolean) {
  const AUDIO = audio.kind === 'src' ? { kind: 'src', map: Object.fromEntries(voices.flatMap(v => LINES.filter(l => have(v, l.id)).map(l => [`${v.key}.${l.id}`, relOf(v, l.id)]))) } : audio;
  const body = `<title>Voice Board</title>
<meta name="claude:viewport-fit-sides" content="cover">
<style>
/* Layout: a sticky control strip (type, speed, pair, picks) over a grid of voice cards; sound first, chrome quiet. */
:root{
  --bg:#0A111C; --panel:#111B2A; --line:#22324A; --fg:${color.iceWhite}; --muted:#93A6BF; --ice:${color.ice}; --flag:#FF7A6B; --ok:#8FD9B6; --warn:#F2C86B;
  --ui:'Geist',system-ui,sans-serif; --mono:'JetBrains Mono',ui-monospace,monospace; color-scheme:dark;
}
html,body{background:var(--bg);color:var(--fg)}
body{font:14px/1.45 var(--ui);margin:0;padding-left:max(16px,env(safe-area-inset-left,0px));padding-right:max(16px,env(safe-area-inset-right,0px));padding-block:0 48px}
h1{font:600 22px/1.2 var(--ui);margin:0;letter-spacing:-.01em;text-wrap:balance}
h2{font:600 13px var(--ui);text-transform:uppercase;letter-spacing:.08em;color:var(--muted);margin:28px 0 12px}
p{margin:0}
.intro{display:grid;gap:6px;padding-block:20px 12px;max-width:80ch;color:var(--muted)}
.intro h1{color:var(--fg)}
.bar{position:sticky;top:env(safe-area-inset-top,0px);z-index:5;background:color-mix(in srgb,var(--bg) 92%,transparent);backdrop-filter:blur(8px);border-bottom:1px solid var(--line);padding-block:10px;display:grid;gap:8px}
.row{display:flex;flex-wrap:wrap;gap:8px 16px;align-items:center}
.ctl{display:flex;gap:6px;align-items:center;color:var(--muted);font-size:12px;flex-wrap:wrap}
.ctl input[type=number]{width:58px;background:var(--panel);color:var(--fg);border:1px solid var(--line);border-radius:6px;padding:4px 6px;font:13px var(--mono)}
.ctl input[type=search]{width:160px;background:var(--panel);color:var(--fg);border:1px solid var(--line);border-radius:6px;padding:5px 8px;font:13px var(--ui)}
select{background:var(--panel);color:var(--fg);border:1px solid var(--line);border-radius:6px;padding:4px 6px;font:12px var(--ui);max-width:220px}
.seg{display:inline-flex;flex-wrap:wrap;border:1px solid var(--line);border-radius:8px;overflow:hidden}
.seg button{border:0;border-radius:0;background:transparent;color:var(--muted);padding:6px 10px;font:12px var(--ui);cursor:pointer}
.seg button[aria-pressed=true]{background:var(--ice);color:#0A111C}
button.act{border:1px solid var(--ice);background:var(--ice);color:#0A111C;border-radius:8px;padding:7px 14px;font:600 13px var(--ui);cursor:pointer}
button.ghost{border:1px solid var(--line);background:transparent;color:var(--fg);border-radius:8px;padding:6px 12px;font:12px var(--ui);cursor:pointer}
button:focus-visible,input:focus-visible,select:focus-visible{outline:2px solid var(--ice);outline-offset:2px}
.sum{display:flex;flex-wrap:wrap;gap:6px;font-size:12px}
.sum span{border:1px solid var(--line);border-radius:999px;padding:2px 9px;color:var(--muted)}
.sum span b{color:var(--fg);font-weight:600}
.sum span.miss{border-style:dashed}
#copied{font-size:12px;color:var(--ok)}
#out{display:none;width:100%;min-height:120px;background:var(--panel);color:var(--fg);border:1px solid var(--line);border-radius:8px;font:12px var(--mono)}
.filters{display:grid;gap:6px}
.fdim{display:flex;flex-wrap:wrap;gap:4px;align-items:center}
.fdim > b{font:600 11px var(--ui);text-transform:uppercase;letter-spacing:.06em;color:var(--muted);min-width:72px}
.chip{font:11px var(--ui);border:1px solid var(--line);background:transparent;color:var(--muted);border-radius:999px;padding:2px 8px;cursor:pointer}
.chip[aria-pressed=true]{background:var(--ice);border-color:var(--ice);color:#0A111C}
.chip i{font-style:normal;opacity:.6;margin-left:3px}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(250px,1fr));gap:14px}
.card{display:grid;gap:8px;align-content:start;min-width:0;background:var(--panel);border:1px solid var(--line);border-radius:10px;padding:12px}
.card.picked{box-shadow:0 0 0 2px var(--ice)}
.card.playing{border-color:var(--ok)}
.idl{display:flex;gap:6px;align-items:baseline;flex-wrap:wrap}
.idl strong{font:600 16px var(--ui)}
.idl code{font:11px var(--mono);color:var(--muted);overflow-wrap:anywhere}
.badge{font:10px var(--ui);text-transform:uppercase;letter-spacing:.06em;border-radius:4px;padding:1px 5px;border:1px solid currentColor}
.badge.edge{color:var(--ok)}.badge.openai{color:var(--warn)}.badge.def{color:var(--ice)}
.tags{display:flex;flex-wrap:wrap;gap:4px}
.tags span{font-size:11px;color:var(--muted);border:1px solid var(--line);border-radius:4px;padding:0 5px}
.play{display:flex;gap:6px;flex-wrap:wrap}
.play button{flex:1;min-width:0}
.play button[disabled]{opacity:.4;cursor:not-allowed}
.note{font-size:12px;color:var(--muted)}
.flagl{font-size:12px;color:var(--flag)}
.pick{display:grid;gap:6px;border-top:1px solid var(--line);padding-top:8px}
.types{display:flex;flex-wrap:wrap;gap:4px}
.types button{font:11px var(--ui);border:1px solid var(--line);background:transparent;color:var(--muted);border-radius:999px;padding:2px 7px;cursor:pointer}
.types button.on{background:var(--ice);border-color:var(--ice);color:#0A111C;font-weight:600}
.ab{display:flex;gap:6px;align-items:center;font-size:12px;color:var(--muted)}
.ab button{font:11px var(--ui);border:1px solid var(--line);background:transparent;color:var(--muted);border-radius:6px;padding:2px 9px;cursor:pointer}
.ab button.on{border-color:var(--ok);color:var(--ok);font-weight:600}
.ref{font-size:12px;color:var(--muted);display:grid;gap:2px}
.ref code{font:11px var(--mono);color:var(--fg)}
@media (prefers-reduced-motion:reduce){.bar{backdrop-filter:none}}
</style>
<div class="intro">
  <h1>Voice Board</h1>
  <p>Every voice in the library, each speaking the same two lines, one English and one Hinglish, through the product's own line path, at the rate the Voice Director gives that voice for a plain brief. Choose a type in the bar, set its speed and its two-voice pair, and tap type chips on a card to pick that voice for a type. Copy your picks and paste them into chat. Nothing is picked for you.</p>
  <p id="enginenote"></p>
  <div class="ref" id="ref"></div>
</div>
<div class="bar">
  <div class="row">
    <span class="seg" role="group" aria-label="Type" id="typeseg"></span>
    <button class="act" id="copy">Copy my picks</button><span id="copied" aria-live="polite"></span>
  </div>
  <div class="row">
    <span class="ctl"><label for="speed">Speed for <b id="tyname"></b></label><input id="speedr" type="range" min="-30" max="50" step="1" aria-label="Speed slider"><input id="speed" type="number" step="1" min="-30" max="50"><span>%</span><span id="speednote"></span><button class="ghost" id="speedreset">Back to product</button></span>
  </div>
  <div class="row">
    <span class="ctl"><label for="pairA">Two-voice pair: A</label><select id="pairA"></select><label for="pairB">B</label><select id="pairB"></select><button class="ghost" id="playpair">Play pair</button><span>Product today: no pair rule in code yet, so both start empty.</span></span>
    <span class="seg" role="group" aria-label="Sample line" id="lineseg"></span>
  </div>
  <div class="sum" id="sum"></div>
  <textarea id="out" readonly aria-label="Picks JSON"></textarea>
</div>
<h2>Filter by tag</h2>
<div class="filters" id="filters"></div>
<div class="row" style="margin-top:10px"><span class="ctl"><label for="q">Name</label><input id="q" type="search" placeholder="Andrew, Neerja…"></span><span class="ctl" id="count"></span><button class="ghost" id="clearf">Clear filters</button><label class="ctl"><input type="checkbox" id="onlypicked"> Only voices picked for this type</label></div>
<div id="failbox"></div>
<div id="groups"></div>
<script>
var DATA = ${JSON.stringify(DATA)};
var AUDIO = ${JSON.stringify(AUDIO)};
</script>
<script>${CLIENT}</script>`;
  return skeleton ? `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">\n${body.replace('</style>', '</style></head><body>')}\n</body></html>` : body;
}

const CLIENT = String.raw`
(() => {
const $ = id => document.getElementById(id);
const V = DATA.voices, TYPES = DATA.types, BY = Object.fromEntries(V.map(v => [v.key, v]));
const pct = r => Number((/^([+-]?\d+)%$/.exec(r) || [0, 0])[1]);
const sgn = n => (n >= 0 ? '+' : '') + n + '%';
const store = { get(k, d) { try { const v = localStorage.getItem('moovi-vb-' + k); return v ? JSON.parse(v) : d; } catch { return d; } }, set(k, v) { try { localStorage.setItem('moovi-vb-' + k, JSON.stringify(v)); } catch {} } };
const PRODUCT = pct(DATA.productRate);
// per type: { voices: [key], speed: number (percent), a: key|null, b: key|null }
const picks = store.get('picks', {});
for (const t of TYPES) picks[t] = Object.assign({ voices: [], speed: PRODUCT, a: null, b: null }, picks[t] || {});
let TY = store.get('type', TYPES[0]); if (!TYPES.includes(TY)) TY = TYPES[0];
let LINE = DATA.lines[0].id;

/* the reference: engines and the product's rates */
$('enginenote').innerHTML = '<span class="badge edge">Edge</span> Microsoft Edge voices: dev and production until Kokoro lands (decision 8), then production switches to Kokoro. '
  + (DATA.openai.available ? '<span class="badge openai">OpenAI</span> ' + DATA.openai.voices.length + ' OpenAI voices (' + DATA.openai.model + ') are here because an OpenAI key is set; the product has no tags for them yet.'
    : 'The ' + DATA.openai.voices.length + ' OpenAI voices (' + DATA.openai.model + ': ' + DATA.openai.voices.join(', ') + ') are left out: no OpenAI key in this environment. Run the script with OPENAI_API_KEY set to add them.');
const R = DATA.rateRule;
$('ref').innerHTML = '<span>Speed today (audio/cast.ts rateFor, Edge prosody rate): a plain brief gets <code>' + R.plain + '</code> on the default voice; by brief energy 1 to 5: '
  + R.byEnergy.map(e => '<code>' + e.rate + '</code>').join(' ') + '; non-English voices at most <code>' + R.nonEnglish + '</code>, child voices at most <code>' + R.child + '</code>. Each card plays at its own rate (shown on the card).</span>'
  + '<span>Style paths\' own fallback rates (used when nothing casts a voice): ' + DATA.styleRates.map(s => s.where + ' <code>' + (s.rate || '?') + '</code>').join(' · ') + '.</span>'
  + '<span>The speed control previews by playback rate with pitch kept (close to, not the same as, Edge re-speaking at that rate). Default voice today: <code>' + DATA.defaultVoice.replace('edge:', '') + '</code>.</span>';

/* failures */
if (DATA.failed.length) $('failbox').innerHTML = '<p class="flagl" style="margin-top:12px">Not playable (' + DATA.failed.length + ' lines): ' + DATA.failed.map(f => f.key + ' ' + f.line + ' (' + f.error.replace(/</g, '&lt;') + ')').join('; ') + '</p>';

/* audio: one element, a source per voice and line (a relative path, or inlined mp3 as a blob) */
const A = new Audio(); A.preservesPitch = true; A.mozPreservesPitch = true; A.webkitPreservesPitch = true;
const urls = {};
function urlOf(key, line) {
  const id = key + '.' + line;
  if (AUDIO.kind === 'none' || !AUDIO.map[id]) return null;
  if (AUDIO.kind === 'src') return AUDIO.map[id];
  if (!urls[id]) { const b = atob(AUDIO.map[id]), u = new Uint8Array(b.length); for (let i = 0; i < b.length; i++) u[i] = b.charCodeAt(i); urls[id] = URL.createObjectURL(new Blob([u], { type: 'audio/mpeg' })); }
  return urls[id];
}
let queue = [], playingKey = null;
function markPlaying(k) { playingKey = k; cards.forEach(c => c.el.classList.toggle('playing', c.v.key === k)); }
function playNext() {
  const n = queue.shift(); if (!n) { markPlaying(null); return; }
  const u = urlOf(n.key, n.line); if (!u) { playNext(); return; }
  const v = BY[n.key];
  A.src = u; A.playbackRate = Math.min(4, Math.max(0.25, (1 + picks[TY].speed / 100) / (1 + pct(v.rate) / 100)));
  markPlaying(n.key);
  A.play().catch(e => { $('copied').textContent = 'Could not play: ' + e.message; markPlaying(null); });
}
A.addEventListener('ended', playNext);
function play(list) { A.pause(); queue = list.slice(); playNext(); }

/* type and line segments */
$('typeseg').innerHTML = TYPES.map(t => '<button type="button"></button>').join('');
$('typeseg').querySelectorAll('button').forEach((b, i) => { b.textContent = TYPES[i]; b.addEventListener('click', () => { TY = TYPES[i]; store.set('type', TY); render(); }); });
$('lineseg').innerHTML = DATA.lines.map(() => '<button type="button"></button>').join('');
$('lineseg').querySelectorAll('button').forEach((b, i) => { b.textContent = 'Pair plays: ' + DATA.lines[i].label; b.addEventListener('click', () => { LINE = DATA.lines[i].id; render(); }); });

/* speed */
function setSpeed(n) { picks[TY].speed = Math.max(-30, Math.min(50, Math.round(+n || 0))); save(); render(); }
$('speed').addEventListener('input', e => setSpeed(e.target.value));
$('speedr').addEventListener('input', e => setSpeed(e.target.value));
$('speedreset').addEventListener('click', () => setSpeed(PRODUCT));

/* pair */
const opts = '<option value="">none</option>' + V.map(v => '<option></option>').join('');
for (const id of ['pairA', 'pairB']) {
  const s = $(id); s.innerHTML = opts;
  s.querySelectorAll('option').forEach((o, i) => { if (i) { o.value = V[i - 1].key; o.textContent = V[i - 1].name + ' (' + (V[i - 1].locale || V[i - 1].engine) + (V[i - 1].gender ? ', ' + V[i - 1].gender : '') + ')'; } });
  s.addEventListener('change', () => { picks[TY][id === 'pairA' ? 'a' : 'b'] = s.value || null; save(); render(); });
}
$('playpair').addEventListener('click', () => { const p = picks[TY]; play([p.a, p.b].filter(Boolean).map(key => ({ key, line: LINE }))); });

/* filters: OR inside a tag, AND across tags */
const DIMS = [['engine', 'Engine'], ['locale', 'Locale'], ['gender', 'Gender'], ['age', 'Age feel'], ['energy', 'Energy'], ['tone', 'Tone'], ['use', 'Jobs'], ['multilingual', 'Multilingual']];
const valsOf = (v, d) => d === 'multilingual' ? [v.multilingual ? 'yes' : 'no'] : d === 'energy' ? (v.energy == null ? [] : [String(v.energy)]) : Array.isArray(v[d]) ? v[d] : v[d] ? [v[d]] : [];
const F = store.get('filters', {}); let Q = '', ONLY = false;
const fbox = $('filters');
for (const [d, label] of DIMS) {
  const count = {}; V.forEach(v => valsOf(v, d).forEach(x => count[x] = (count[x] || 0) + 1));
  const keys = Object.keys(count).sort((a, b) => d === 'energy' ? a - b : count[b] - count[a] || a.localeCompare(b));
  if (!keys.length) continue;
  const row = document.createElement('div'); row.className = 'fdim';
  const h = document.createElement('b'); h.textContent = label; row.appendChild(h);
  for (const k of keys) {
    const b = document.createElement('button'); b.type = 'button'; b.className = 'chip'; b.textContent = k; const i = document.createElement('i'); i.textContent = count[k]; b.appendChild(i);
    b.setAttribute('aria-pressed', String(!!(F[d] && F[d].includes(k))));
    b.addEventListener('click', () => { const s = new Set(F[d] || []); s.has(k) ? s.delete(k) : s.add(k); F[d] = [...s]; b.setAttribute('aria-pressed', String(s.has(k))); store.set('filters', F); render(); });
    row.appendChild(b);
  }
  fbox.appendChild(row);
}
$('q').addEventListener('input', e => { Q = e.target.value.trim().toLowerCase(); render(); });
$('onlypicked').addEventListener('change', e => { ONLY = e.target.checked; render(); });
$('clearf').addEventListener('click', () => { for (const k in F) delete F[k]; fbox.querySelectorAll('.chip').forEach(b => b.setAttribute('aria-pressed', 'false')); $('q').value = ''; Q = ''; store.set('filters', F); render(); });
const shown = v => DIMS.every(([d]) => !(F[d] && F[d].length) || valsOf(v, d).some(x => F[d].includes(x)))
  && (!Q || (v.name + ' ' + v.voice + ' ' + v.accent).toLowerCase().includes(Q)) && (!ONLY || picks[TY].voices.includes(v.key));

/* the cards, grouped by engine then accent */
const groups = $('groups'), cards = [];
const groupOf = v => v.engine === 'openai' ? 'OpenAI (' + DATA.openai.model + ')' : 'Edge: ' + (v.lang === 'en' ? v.accent + ' English' : v.accent);
let gname = '', grid = null;
const heads = [];
V.forEach(v => {
  const g = groupOf(v);
  if (g !== gname) { gname = g; const h = document.createElement('h2'); groups.appendChild(h); grid = document.createElement('div'); grid.className = 'grid'; groups.appendChild(grid); heads.push({ h, grid, g }); }
  const el = document.createElement('article'); el.className = 'card';
  el.innerHTML = '<div class="idl"><strong></strong><span class="badge ' + v.engine + '">' + v.engine + '</span>' + (v.key === DATA.defaultVoice ? '<span class="badge def">default today</span>' : '') + '</div><code class="vid"></code>'
    + '<div class="tags"></div><div class="play">' + DATA.lines.map(l => '<button class="ghost" type="button"></button>').join('') + '</div><p class="note"></p>'
    + '<div class="pick"><div class="types">' + TYPES.map(() => '<button type="button"></button>').join('') + '</div><div class="ab"><span class="abl"></span><button type="button" data-ab="a">A</button><button type="button" data-ab="b">B</button></div></div>';
  el.querySelector('strong').textContent = v.name;
  el.querySelector('.vid').textContent = v.key;
  const tags = el.querySelector('.tags');
  (v.tagged ? [v.locale, v.gender, v.age + ' feel', 'energy ' + v.energy + '/5', ...v.tone, ...v.use.map(u => 'job: ' + u), v.multilingual ? 'multilingual' : ''] : ['no tags in the product yet']).filter(Boolean).forEach(t => { const s = document.createElement('span'); s.textContent = t; tags.appendChild(s); });
  el.querySelectorAll('.play button').forEach((b, i) => {
    const l = DATA.lines[i], a = v.audio[l.id];
    b.textContent = 'Play ' + l.label + (a && a.seconds ? ' · ' + a.seconds.toFixed(1) + ' s' : '');
    if (!urlOf(v.key, l.id)) { b.disabled = true; b.title = AUDIO.kind === 'none' ? 'Audio is not in this copy: play it from the repo copy (docs/galleries/voices.html)' : 'This line failed to render'; }
    b.addEventListener('click', () => play([{ key: v.key, line: l.id }]));
  });
  el.querySelectorAll('.types button').forEach((b, j) => b.addEventListener('click', () => { const p = picks[TYPES[j]], i = p.voices.indexOf(v.key); i >= 0 ? p.voices.splice(i, 1) : p.voices.push(v.key); save(); render(); }));
  el.querySelectorAll('[data-ab]').forEach(b => b.addEventListener('click', () => { const s = b.dataset.ab, p = picks[TY]; p[s] = p[s] === v.key ? null : v.key; save(); render(); }));
  grid.appendChild(el);
  cards.push({ v, el });
});

function save() { store.set('picks', picks); }
function render() {
  const p = picks[TY];
  $('typeseg').querySelectorAll('button').forEach((b, i) => b.setAttribute('aria-pressed', String(TYPES[i] === TY)));
  $('lineseg').querySelectorAll('button').forEach((b, i) => b.setAttribute('aria-pressed', String(DATA.lines[i].id === LINE)));
  $('tyname').textContent = TY; $('speed').value = p.speed; $('speedr').value = p.speed;
  $('speednote').textContent = 'product today ' + DATA.productRate + (p.speed === PRODUCT ? ' (unchanged)' : ', yours ' + sgn(p.speed));
  $('pairA').value = p.a || ''; $('pairB').value = p.b || '';
  let n = 0;
  for (const c of cards) {
    const vis = shown(c.v); c.el.style.display = vis ? '' : 'none'; if (vis) n++;
    c.el.classList.toggle('picked', p.voices.includes(c.v.key));
    c.el.querySelectorAll('.types button').forEach((b, j) => { const on = picks[TYPES[j]].voices.includes(c.v.key); b.className = on ? 'on' : ''; b.textContent = (on ? 'Picked: ' : '') + TYPES[j]; b.setAttribute('aria-pressed', String(on)); });
    c.el.querySelector('.abl').textContent = 'Pair for ' + TY + ':';
    c.el.querySelectorAll('[data-ab]').forEach(b => { const on = p[b.dataset.ab] === c.v.key; b.className = on ? 'on' : ''; b.textContent = (on ? 'Voice ' : '') + b.dataset.ab.toUpperCase(); });
    const nt = c.el.querySelector('.note'); nt.textContent = 'Spoken at ' + c.v.rate + (c.v.engine === 'openai' ? ' (OpenAI takes no rate)' : ' (rateFor, plain brief)') + '; plays at ' + sgn(p.speed) + ' for ' + TY + '.';
  }
  heads.forEach(x => { const k = cards.filter(c => groupOf(c.v) === x.g && c.el.style.display !== 'none').length; x.h.textContent = x.g + ' (' + k + ')'; x.h.style.display = x.grid.style.display = k ? '' : 'none'; });
  $('count').textContent = 'Showing ' + n + ' of ' + V.length + ' voices';
  $('sum').innerHTML = TYPES.map(t => { const q = picks[t]; return '<span' + (!q.voices.length ? ' class="miss"' : '') + '>' + t + ': <b>' + q.voices.length + '</b> voices, <b>' + sgn(q.speed) + '</b>, pair <b>' + (q.a ? BY[q.a].name : '–') + ' / ' + (q.b ? BY[q.b].name : '–') + '</b></span>'; }).join('');
}
render();

$('copy').addEventListener('click', () => {
  const out = { gallery: 'docs/galleries/voices.html', picked: new Date().toISOString().slice(0, 10), engine_note: 'Edge voices: dev and production until Kokoro', sample_lines: DATA.lines.map(l => ({ id: l.id, text: l.text })),
    types: Object.fromEntries(TYPES.map(t => { const q = picks[t]; return [t, { voices: q.voices.slice(), speed: sgn(q.speed), speed_product: DATA.productRate, speed_changed: q.speed !== PRODUCT, pair: { a: q.a, b: q.b } }]; })) };
  const text = JSON.stringify(out, null, 2), box = $('out');
  box.value = text;
  const n = TYPES.reduce((s, t) => s + picks[t].voices.length + (picks[t].a ? 1 : 0) + (picks[t].b ? 1 : 0), 0);
  const fallback = () => { box.style.display = 'block'; box.focus(); box.select(); let ok = false; try { ok = document.execCommand('copy'); } catch {} $('copied').textContent = ok ? 'Copied' : 'Select the text below and copy it'; };
  if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(() => { $('copied').textContent = 'Copied ' + n + ' picks'; box.style.display = 'none'; }, fallback); else fallback();
});
window.__board = { voices: V.length, picks: () => picks };
})();
`;

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, page({ kind: 'src' }, true));
console.log(`wrote ${OUT} (${voices.length} voices: ${voices.filter(v => v.engine === 'edge').length} Edge, ${voices.filter(v => v.engine === 'openai').length} OpenAI${OPENAI ? '' : ' (no OpenAI key: left out)'}; ${LINES.length} lines each; audio ${(totalBytes / 1e6).toFixed(2)} MB; ${failed.length} lines not playable)`);
for (const f of failed) console.log(`  not playable: ${f.key} ${f.line}: ${f.error}`);
const art = arg('artifact');
if (art) {
  const fits = totalBytes * 4 / 3 < 12e6;
  const map = fits ? Object.fromEntries(voices.flatMap(v => LINES.filter(l => have(v, l.id)).map(l => [`${v.key}.${l.id}`, readFileSync(fileOf(v, l.id)).toString('base64')]))) : {};
  writeFileSync(art, page(fits ? { kind: 'b64', map } : { kind: 'none' }, false));
  console.log(`wrote ${art} (${fits ? 'audio inlined' : 'audio left out: over ~12 MB'}, ${(statSync(art).size / 1e6).toFixed(2)} MB)`);
}
