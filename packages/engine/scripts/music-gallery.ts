// pnpm --filter @moovi/engine exec tsx scripts/music-gallery.ts [--fetch] [--artifact <out.html>]
// The music board (decision 7, docs/agents/DECISIONS.md): every track in the music library (src/library/music-tracks.json)
// sorted by music-lib's own licence gate (musicLicenceOk: product scope, then creator scope, then not usable), each one
// playable, plus the picks per type: tracks and moods, energy, the level under the voice, beat-snap and drop on the
// reveal, each starting at what the product does today. A choosing tool only: nothing here changes a music default.
// Audio comes through music-lib's own fetchMusic into data/galleries/music/ (MOOVI_MUSIC_CACHE pointed there for this
// run; /data is gitignored, so no audio goes in git). Without --fetch only the small trimmed Mixkit beds are fetched
// (about 0.3 MB each); --fetch also fetches the whole viral tracks (NCS and Kevin MacLeod, kept whole as published,
// several MB each). A track not on disk plays from its source URL, marked on the page.
// Loudness (music-lib's lufsOf) and the beat grid (launch/audio.ts gridOf) are measured on every file on disk, so the
// "hear it under the voice" button can set the bed the chosen LU under the Ishaan test clip's voice.
// --artifact also writes a copy without the document skeleton for a claude.ai Artifact: only redistributable tracks
// (licenceTerms().redistributable) are inlined, within ~12 MB; the rest say "play it from the repo copy".
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { color } from '@moovi/brand';
import { licenceTerms } from '@moovi/graph';

const ROOT = join(import.meta.dirname, '..', '..', '..');
const OUT = join(ROOT, 'docs', 'galleries', 'music.html');
const CACHE = join(ROOT, 'data', 'galleries', 'music');
process.env.MOOVI_MUSIC_CACHE = CACHE; // music-lib reads it at call time (musicCacheDir); only this run's cache moves
const CLIP = join(ROOT, 'docs', 'agents', 'ishaan-test', 'ishaan-test.mp4');
const BED_DIR = join(ROOT, 'packages', 'engine', 'assets', 'music');
const arg = (k: string) => { const i = process.argv.indexOf(`--${k}`); return i > 0 ? process.argv[i + 1] : undefined; };
const FETCH_ALL = process.argv.includes('--fetch');

const { MUSIC_TRACKS, MUSIC_MIX, musicLicenceOk, useScopeOf, fetchMusic, musicCacheFile, lufsOf, cacheSeconds } = await import('../src/audio/music-lib');
const { gridOf } = await import('../src/launch/audio');
const { STYLE1 } = await import('../src/audio/style1');
const { FX_MIX } = await import('../src/edit/effects/render');
const { SOUND: DV_SOUND } = await import('../../library/src/dark-vox/tokens');
type Track = (typeof MUSIC_TRACKS)[number];

/* ── 1. the gate, as music-lib decides it ── */
type Lane = 'product' | 'creator' | 'none';
const laneOf = (t: Track): Lane => musicLicenceOk(t, 'product') ? 'product' : musicLicenceOk(t, 'creator') ? 'creator' : 'none';
/** why a track sits where it does: a description of the gate's outcome for the page (the decision itself is musicLicenceOk's) */
function laneWhy(t: Track, lane: Lane): string {
  const L = licenceTerms(t.licence);
  if (lane === 'product') return `product-safe (${useScopeOf(t)}): may ship inside Moovi${t.credit ? ', credit in the video description' : ''}`;
  if (lane === 'creator') return `use_scope ${useScopeOf(t)}: our own YouTube, Instagram and Facebook videos only (credit in the description), never bundled in the product; pickMusic never offers it to a user's film`;
  const why: string[] = [];
  if (L.code === 'unverified' || L.code === 'mixkit-restricted') why.push(`licence code ${L.code}`);
  if (!(t.use.commercial && t.use.youtube && t.use.instagram && t.use.facebook)) why.push('not cleared for commercial use on all of YouTube, Instagram, Facebook');
  if (t.use.onScreen === true) why.push('asks for an on-screen credit');
  if ((L.attribution || t.use.attribution) && !(t.use.attributionPlace === 'description' && t.credit?.trim())) why.push('a credit is due but no description credit text is on the track');
  return why.join('; ') || 'fails musicLicenceOk';
}

/* ── 2. audio on disk, through music-lib's own fetch ── */
const small = (t: Track) => !t.cacheFile; // trimmed to cacheSeconds, 64 kbps AAC: about 0.3 MB
const toFetch = MUSIC_TRACKS.filter(t => laneOf(t) !== 'none' && (FETCH_ALL || small(t)) && !existsSync(musicCacheFile(t)));
const fetchErr = new Map<string, string>();
if (toFetch.length) console.log(`fetching ${toFetch.length} track(s) into ${CACHE}${FETCH_ALL ? ' (--fetch: whole viral tracks too)' : ' (the small Mixkit beds; --fetch for the whole viral tracks)'}`);
for (let i = 0; i < toFetch.length; i += 4) {
  await Promise.all(toFetch.slice(i, i + 4).map(async t => {
    try { await fetchMusic(t, { signal: AbortSignal.timeout(90_000) }); console.log(`  ok   ${t.id}`); }
    catch (e) { fetchErr.set(t.id, String((e as Error).message ?? e).slice(0, 120)); console.log(`  FAIL ${t.id}: ${fetchErr.get(t.id)}`); }
  }));
}

/* ── 3. loudness and grid per file on disk (cached beside the audio) ── */
type Measured = { lufs: number | null; grid: { bpm: number; firstBeat: number; drop: number | null; dur: number } | null };
async function measure(t: { id: string; bpm: number; hasDrop: boolean; dropAt: number | null } & Partial<Track>, file: string, withGrid = true): Promise<Measured> {
  const cache = `${file}.gallery.json`;
  if (existsSync(cache)) try { return JSON.parse(readFileSync(cache, 'utf8')) as Measured; } catch { /* re-measure */ }
  let lufs: number | null = null, grid: Measured['grid'] = null;
  try { lufs = await lufsOf(file, { dur: 60 }); } catch (e) { console.warn(`  lufs ${t.id}: ${(e as Error).message}`); }
  if (withGrid) try { grid = gridOf(t as Track, file); } catch (e) { console.warn(`  grid ${t.id}: ${(e as Error).message}`); }
  const m = { lufs, grid };
  if (file.startsWith(CACHE)) writeFileSync(cache, JSON.stringify(m)); // never write beside a tracked file
  return m;
}
const rel = (f: string) => relative(dirname(OUT), f).replace(/\\/g, '/');

interface Row {
  id: string; title: string; artist: string | null; source: string; genre: string; mood: string[]; energy: number; bpm: number;
  hasDrop: boolean; dropAt: number | null; hookAt: number | null; dur: number; needs: string[]; recognizable: boolean; ytViews: number | null;
  licence: string; licenceUrl: string; sourceUrl: string; credit: string | null; scope: string; lane: Lane; why: string;
  audio: { src: string; local: boolean; bytes: number; kept: string; note?: string }; lufs: number | null; grid: Measured['grid'];
}
const rows: Row[] = [];
for (const t of MUSIC_TRACKS) {
  const lane = laneOf(t), file = musicCacheFile(t), local = existsSync(file);
  const m = local ? await measure(t, file) : { lufs: null, grid: null };
  rows.push({ id: t.id, title: t.title, artist: t.artist, source: t.source, genre: t.genre, mood: t.mood, energy: t.energy, bpm: t.bpm,
    hasDrop: t.hasDrop, dropAt: t.dropAt, hookAt: t.hookAt, dur: t.dur, needs: t.needs, recognizable: !!t.recognizable, ytViews: t.ytViews ?? null,
    licence: t.licence, licenceUrl: t.licenceUrl, sourceUrl: t.sourceUrl, credit: t.credit?.trim() || null, scope: useScopeOf(t), lane, why: laneWhy(t, lane),
    audio: local
      ? { src: rel(file), local: true, bytes: statSync(file).size, kept: t.cacheFile ? 'whole track, as published' : `first ${cacheSeconds(t).toFixed(1)} s (music-lib's cache trim)` }
      : { src: t.fileUrl, local: false, bytes: 0, kept: 'source URL', note: fetchErr.get(t.id) ? `fetch failed: ${fetchErr.get(t.id)}` : lane === 'none' ? 'not fetched: fails the gate' : 'not fetched yet (run with --fetch); playing from the source URL' },
    lufs: m.lufs, grid: m.grid });
}
// the bundled bed the styles mix today (assets/music, tracked): not in the library list, shown so its current use is visible
const bedMeta = JSON.parse(readFileSync(join(BED_DIR, 'bed.json'), 'utf8')) as { file: string; start?: number; credit?: string };
const bedFile = join(BED_DIR, bedMeta.file);
const bedM = await measure({ id: 'bundled-bed', bpm: 0, hasDrop: false, dropAt: null }, bedFile, false).catch(() => ({ lufs: null, grid: null }));
const BED = { id: 'bed:bundled', title: (/"([^"]+)"/.exec(bedMeta.credit ?? '') ?? [])[1] ?? 'bundled bed', artist: (/ by (.+?) \(/.exec(bedMeta.credit ?? '') ?? [])[1] ?? null, file: rel(bedFile), bytes: statSync(bedFile).size, start: bedMeta.start ?? 0, credit: bedMeta.credit ?? null, lufs: bedM.lufs };

/* ── 4. what each type does with music today (read from the code that mixes it; nothing set here) ── */
interface Look { name: string; where: string; level: number | null; levelNote: string }
interface TypeNow { type: string; status: 'live' | 'new'; tracks: string; looks: Look[]; level: number | null; levelNote: string; energy: string; beatSnap: boolean; beatSnapNote: string; drop: boolean; dropNote: string; when: string }
const TYPES: TypeNow[] = [
  { type: 'Edit my video', status: 'live', when: 'music only when asked (decision 3); today the reel-effects version gets a bed (router/edit.ts fxMusic)',
    tracks: 'pickMusic from the library, product scope (edit/effects/music.ts fxMusicPick); the Studio Cut mixes the bundled bed',
    looks: [
      { name: 'Reel effects version', where: 'edit/effects/render.ts FX_MIX', level: FX_MIX.under, levelNote: `voice ${FX_MIX.voice} LUFS, bed ${FX_MIX.under} LU under, ducked ${FX_MIX.duck} dB on words` },
      { name: 'Studio Cut', where: 'edit/job.ts → audio/style1.ts STYLE1', level: STYLE1.bedLuUnder, levelNote: `voice ${STYLE1.voiceLufs} LUFS, bundled bed ${STYLE1.bedLuUnder} LU under, no ducking` }],
    level: FX_MIX.under, levelNote: '', energy: 'from the words per second (musicWant: 3 to 5)',
    beatSnap: false, beatSnapNote: 'no: cuts follow the speech, not a beat grid', drop: false, dropNote: 'no: the pick prefers a drop near 3 s (dropTarget) but the mix starts the track at 0' },
  { type: 'Launch', status: 'live', when: 'always: the music carries the film (no voice)',
    tracks: 'pickLaunchMusic (launch/audio.ts): product scope, 88–140 BPM, needs and energy from the look (LOOK_MOOD)',
    looks: [{ name: 'Launch', where: 'launch/audio.ts mixLaunch', level: null, levelNote: 'no voice: the music sits at -17 LUFS before the sfx stem, master -14 LUFS' }],
    level: null, levelNote: '', energy: 'per look: 2 to 4 (LOOK_MOOD in launch/audio.ts)',
    beatSnap: true, beatSnapNote: 'yes: every beat starts on a bar line of the measured grid (launch/plan.ts)', drop: true, dropNote: 'yes: musicStart cuts the track so its drop lands on the reveal beat' },
  { type: 'Showreel', status: 'live', when: 'always (Clip Moment)',
    tracks: 'pickMusic, product scope (edit/templates/clip-moment-run.ts cmMusicWant)',
    looks: [{ name: 'Clip Moment', where: 'audio/music-lib.ts MUSIC_MIX', level: MUSIC_MIX.underVoiceLu, levelNote: `bed ${MUSIC_MIX.underVoiceLu} LU under the voice, plus a sidechain duck while words play` }],
    level: MUSIC_MIX.underVoiceLu, levelNote: '', energy: 'from the words per second (musicWant: 3 to 5)',
    beatSnap: false, beatSnapNote: 'no: beats follow the voice', drop: true, dropNote: 'yes: musicMixPlan lands the drop on the first 3D moment or the hook word' },
  { type: 'Brand post', status: 'live', when: 'always (the bundled bed)',
    tracks: 'the bundled bed only (assets/music/bed.mp3 via s1make); the library is not read',
    looks: [
      { name: 'Editorial (Style 4)', where: "styles/s4.ts mixAudio '--bed-lu 7.5'", level: 7.5, levelNote: 'voice -18 LUFS, bundled bed 7.5 LU under' },
      { name: 'Dark Vox', where: 'library dark-vox/tokens.ts SOUND.bedUnderVoiceLU', level: DV_SOUND.bedUnderVoiceLU, levelNote: `voice -18 LUFS, bundled bed ${DV_SOUND.bedUnderVoiceLU} LU under` }],
    level: 7.5, levelNote: '', energy: 'none: the bed is fixed',
    beatSnap: false, beatSnapNote: 'no', drop: false, dropNote: `no: the bed starts at ${bedMeta.start ?? 0} s (bed.json start)` },
  { type: 'SaaS explainer', status: 'live', when: 'always (the bundled bed)',
    tracks: 'the bundled bed only (assets/music/bed.mp3 via s1make); the library is not read',
    looks: [
      { name: 'Style 1', where: 'audio/style1.ts STYLE1 (s1make --bed-lu default)', level: STYLE1.bedLuUnder, levelNote: `voice ${STYLE1.voiceLufs} LUFS, bundled bed ${STYLE1.bedLuUnder} LU under` },
      { name: 'Clear Signal (Style 5)', where: "styles/s5.ts mixAudio '--bed-lu 9'", level: 9, levelNote: 'voice -18 LUFS, bundled bed 9 LU under' },
      { name: 'Anatomy', where: "styles/anatomy.ts mixAudio '--bed-lu 9'", level: 9, levelNote: 'voice -18 LUFS, bundled bed 9 LU under' }],
    level: STYLE1.bedLuUnder, levelNote: '', energy: 'none: the bed is fixed',
    beatSnap: false, beatSnapNote: 'no', drop: false, dropNote: `no: the bed starts at ${bedMeta.start ?? 0} s (bed.json start)` },
  { type: 'UI morph', status: 'new', when: 'not built yet (W11)', tracks: 'none yet', looks: [], level: null, levelNote: '', energy: 'none yet', beatSnap: false, beatSnapNote: 'none yet', drop: false, dropNote: 'none yet' },
  { type: 'Kinetic type', status: 'new', when: 'not built yet (W11)', tracks: 'none yet', looks: [], level: null, levelNote: '', energy: 'none yet', beatSnap: false, beatSnapNote: 'none yet', drop: false, dropNote: 'none yet' },
];
for (const t of TYPES) t.levelNote = t.looks.length ? t.looks.map(l => `${l.name}: ${l.level === null ? 'n/a' : l.level + ' LU'} (${l.where})`).join(' · ') : 'no product value';

const MOODS = [...new Set(rows.filter(r => r.lane !== 'none').flatMap(r => r.mood))].sort();
const lane = { product: rows.filter(r => r.lane === 'product').length, creator: rows.filter(r => r.lane === 'creator').length, none: rows.filter(r => r.lane === 'none').length };

/* ── 5. the page ── */
type Media = { mode: 'repo' } | { mode: 'artifact'; inline: Record<string, string>; clip: string | null };
function page(media: Media, skeleton: boolean) {
  const DATA = { rows, types: TYPES, moods: MOODS, bed: BED, voiceLufs: STYLE1.voiceLufs, clip: rel(CLIP), clipLufs: CLIP_LUFS, media: media.mode,
    inline: media.mode === 'artifact' ? Object.keys(media.inline) : [] };
  const body = `<title>Music Board</title>
<meta name="claude:viewport-fit-sides" content="cover">
<style>
/* Layout: a sticky control strip, the seven type panels as cards, then the track table: the music is the subject, the chrome stays quiet. */
:root{
  --bg:#0A111C; --panel:#111B2A; --line:#22324A; --fg:${color.iceWhite}; --muted:#93A6BF; --ice:${color.ice}; --flag:#FF7A6B; --ok:#8FD9B6; --warn:#F2C86B;
  --ui:system-ui,sans-serif; --mono:ui-monospace,'JetBrains Mono',monospace; color-scheme:dark;
}
html,body{background:var(--bg);color:var(--fg)}
body{font:14px/1.45 var(--ui);margin:0;padding-left:max(16px,env(safe-area-inset-left,0px));padding-right:max(16px,env(safe-area-inset-right,0px));padding-block:0 48px}
h1{font:600 22px/1.2 var(--ui);margin:0;letter-spacing:-.01em;text-wrap:balance}
h2{font:600 13px var(--ui);text-transform:uppercase;letter-spacing:.08em;color:var(--muted);margin:28px 0 12px}
h3{font:600 15px var(--ui);margin:0}
p{margin:0}
.intro{display:grid;gap:6px;padding-block:20px 12px;max-width:86ch;color:var(--muted)}
.intro h1{color:var(--fg)}
.bar{position:sticky;top:env(safe-area-inset-top,0px);z-index:5;background:color-mix(in srgb,var(--bg) 92%,transparent);backdrop-filter:blur(8px);border-bottom:1px solid var(--line);padding-block:10px;display:grid;gap:8px}
.row{display:flex;flex-wrap:wrap;gap:8px 16px;align-items:center}
.ctl{display:flex;gap:6px;align-items:center;color:var(--muted);font-size:12px}
.seg{display:inline-flex;border:1px solid var(--line);border-radius:8px;overflow:hidden}
.seg button{border:0;border-radius:0;background:transparent;color:var(--muted);padding:5px 9px;font:12px var(--ui);cursor:pointer}
.seg button[aria-pressed=true]{background:var(--ice);color:#0A111C}
button.act{border:1px solid var(--ice);background:var(--ice);color:#0A111C;border-radius:8px;padding:7px 14px;font:600 13px var(--ui);cursor:pointer}
button.ghost{border:1px solid var(--line);background:transparent;color:var(--fg);border-radius:8px;padding:5px 10px;font:12px var(--ui);cursor:pointer}
button.ghost[aria-pressed=true]{border-color:var(--ice);color:var(--ice)}
button:focus-visible,input:focus-visible,select:focus-visible{outline:2px solid var(--ice);outline-offset:2px}
.sum{display:flex;flex-wrap:wrap;gap:6px;font-size:12px}
.sum span{border:1px solid var(--line);border-radius:999px;padding:2px 9px;color:var(--muted)}
.sum span b{color:var(--fg);font-weight:600}
#copied{font-size:12px;color:var(--ok)}
#out{display:none;width:100%;min-height:120px;background:var(--panel);color:var(--fg);border:1px solid var(--line);border-radius:8px;font:12px var(--mono)}
.types{display:grid;grid-template-columns:repeat(auto-fill,minmax(320px,1fr));gap:14px}
.type{background:var(--panel);border:1px solid var(--line);border-radius:12px;padding:14px;display:grid;gap:10px;align-content:start;min-width:0}
.type.new{border-style:dashed}
.type .now{font-size:12px;color:var(--muted)}
.type .now b{color:var(--fg);font-weight:600}
.field{display:grid;gap:5px}
.field > span{font-size:11px;text-transform:uppercase;letter-spacing:.06em;color:var(--muted)}
.chips{display:flex;flex-wrap:wrap;gap:4px}
.chips button{font:11px var(--ui);border:1px solid var(--line);background:transparent;color:var(--muted);border-radius:999px;padding:2px 8px;cursor:pointer}
.chips button[aria-pressed=true]{background:var(--ice);border-color:var(--ice);color:#0A111C;font-weight:600}
.lvl{display:flex;gap:8px;align-items:center;flex-wrap:wrap}
.lvl input[type=range]{flex:1;min-width:140px}
.lvl output{font:600 13px var(--mono);min-width:6ch}
.sw{display:flex;gap:8px;align-items:center;font-size:12px}
.sw input{width:16px;height:16px}
.prod{font-size:11px;color:var(--muted)}
.prod.changed{color:var(--warn)}
.picked{font-size:12px;color:var(--fg)}
.tablewrap{overflow-x:auto;border:1px solid var(--line);border-radius:10px}
table{border-collapse:collapse;width:100%;min-width:1100px;font-size:12px}
th,td{text-align:left;padding:8px 10px;border-bottom:1px solid var(--line);vertical-align:top}
th{font-weight:600;color:var(--muted);position:sticky;top:0;background:var(--panel)}
td.num{font-family:var(--mono);white-space:nowrap}
tr.creator td{opacity:.55}
tr.creator td.keep{opacity:1}
tr.none td{opacity:.45}
.t{font-weight:600;color:var(--fg);font-size:13px}
.by{color:var(--muted)}
.tag{display:inline-block;font:10px var(--ui);text-transform:uppercase;letter-spacing:.05em;border-radius:4px;padding:1px 5px;border:1px solid currentColor;margin-right:4px}
.tag.product{color:var(--ok)}.tag.creator{color:var(--warn)}.tag.none{color:var(--flag)}.tag.remote{color:var(--flag)}.tag.rec{color:var(--ice)}
.cred{font-size:11px;color:var(--muted);max-width:42ch}
.play{display:flex;gap:4px;flex-wrap:wrap}
.tpick{display:flex;flex-wrap:wrap;gap:3px;max-width:230px}
.tpick button{font:10px var(--ui);border:1px solid var(--line);background:transparent;color:var(--muted);border-radius:999px;padding:1px 6px;cursor:pointer}
.tpick button[aria-pressed=true]{background:var(--ice);border-color:var(--ice);color:#0A111C;font-weight:600}
.note{font-size:11px;color:var(--flag)}
details.none-list summary{cursor:pointer;color:var(--flag);margin-top:18px}
.legend{font-size:12px;color:var(--muted)}
@media (prefers-reduced-motion:reduce){.bar{backdrop-filter:none}}
</style>
<div class="intro">
  <h1>Music Board</h1>
  <p>${rows.length} tracks in the music library, sorted by the product's own licence gate (music-lib's musicLicenceOk): ${lane.product} may ship inside Moovi, ${lane.creator} are for our own channel videos only (shown greyed), ${lane.none} fail the gate. Pick, per type, the tracks or moods, an energy, the level under the voice, beat-snap and drop on the reveal. Every control starts at what the product does today, shown beside it; nothing here changes a default. Copy your picks and paste them into chat.</p>
  <p class="legend">Play plays the track. Under the voice plays it beneath the Ishaan test clip's voice at the type's chosen level (both loudness-matched from measured LUFS; ${CLIP_LUFS === null ? 'the clip could not be measured, so the level is approximate' : `clip measured at ${CLIP_LUFS.toFixed(1)} LUFS`}). <span class="tag remote">source URL</span> marks a track not on disk yet: it plays from its source and cannot be level-matched.${media.mode === 'artifact' ? ' This is the artifact copy: only the redistributable tracks are inside it; play the rest from the repo copy (docs/galleries/music.html).' : ''}</p>
</div>
<div class="bar">
  <div class="row">
    <button class="ghost" id="stop">Stop</button>
    <span class="ctl" id="now" aria-live="polite">Nothing playing</span>
    <span style="flex:1"></span>
    <button class="act" id="copy">Copy my picks</button><span id="copied" aria-live="polite"></span>
  </div>
  <div class="sum" id="sum"></div>
  <textarea id="out" readonly aria-label="Picks JSON"></textarea>
</div>
<h2>Picks per type</h2>
<div class="types" id="types"></div>
<h2>Tracks (${lane.product + lane.creator} usable${lane.none ? `, ${lane.none} not usable at the bottom` : ''})</h2>
<div class="tablewrap"><table><thead><tr><th>Track</th><th>Genre</th><th>Mood</th><th>Energy</th><th>BPM (catalogue · measured)</th><th>Drop / hook</th><th>Licence and credit line</th><th>Listen</th><th>Pick for type</th></tr></thead><tbody id="rows"></tbody></table></div>
<details class="none-list" id="none" ${lane.none ? '' : 'hidden'}><summary>Not usable (${lane.none})</summary><div class="tablewrap"><table><tbody id="nonerows"></tbody></table></div></details>
<audio id="music" preload="none"></audio>
<video id="voice" preload="none" playsinline style="display:none"></video>
<script>var DATA = ${JSON.stringify(DATA)};
var INLINE = ${media.mode === 'artifact' ? JSON.stringify({ tracks: media.inline, clip: media.clip }) : 'null'};</script>
<script>${CLIENT}</script>`;
  return skeleton ? `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">\n${body.replace('</style>', '</style></head><body>')}\n</body></html>` : body;
}

const CLIENT = String.raw`
(() => {
const $ = id => document.getElementById(id), R = DATA.rows, TY = DATA.types;
const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const store = { get(k, d) { try { const v = localStorage.getItem('moovi-mg-' + k); return v ? JSON.parse(v) : d; } catch { return d; } }, set(k, v) { try { localStorage.setItem('moovi-mg-' + k, JSON.stringify(v)); } catch {} } };
const fresh = t => ({ tracks: [], moods: [], energy: null, level: t.level, levelSet: t.level !== null, beatSnap: t.beatSnap, drop: t.drop });
const saved = store.get('picks', {});
const P = Object.fromEntries(TY.map(t => [t.type, Object.assign(fresh(t), saved[t.type] || {})]));
const save = () => store.set('picks', P);

/* audio sources: the repo copy by relative path, or inlined (artifact) as object URLs */
const blobs = {};
const b64url = (b64, type) => { const b = atob(b64), u = new Uint8Array(b.length); for (let i = 0; i < b.length; i++) u[i] = b.charCodeAt(i); return URL.createObjectURL(new Blob([u], { type })); };
function srcOf(r) {
  if (!INLINE) return r.audio ? r.audio.src : r.file;
  const id = r.id; if (!INLINE.tracks[id]) return null;
  return blobs[id] || (blobs[id] = b64url(INLINE.tracks[id], /\.mp3$/.test((r.audio && r.audio.src) || r.file || '') ? 'audio/mpeg' : 'audio/mp4'));
}
const clipSrc = () => !INLINE ? DATA.clip : INLINE.clip ? (blobs.__clip || (blobs.__clip = b64url(INLINE.clip, 'video/mp4'))) : null;

const M = $('music'), V = $('voice');
let playing = null;
function stop() { M.pause(); V.pause(); playing = null; $('now').textContent = 'Nothing playing'; document.querySelectorAll('[data-play]').forEach(b => b.setAttribute('aria-pressed', 'false')); }
$('stop').addEventListener('click', stop);
/** gain (dB) for the music so it sits lv LU under a voice at DATA.voiceLufs; voice gain likewise; both shifted so neither exceeds 0 dB */
function gains(r, lv) {
  const lufs = r.lufs, gv = DATA.clipLufs == null ? 0 : DATA.voiceLufs - DATA.clipLufs;
  const gm = lufs == null ? -lv : DATA.voiceLufs - lv - lufs, top = Math.max(gv, gm, 0);
  return { v: Math.pow(10, (gv - top) / 20), m: Math.pow(10, (gm - top) / 20), approx: lufs == null || DATA.clipLufs == null };
}
function play(r, mode, lv, btn) {
  const key = r.id + '|' + mode + '|' + lv;
  if (playing === key) { stop(); return; }
  stop();
  const src = srcOf(r);
  if (!src) { $('now').textContent = r.title + ': not inside this artifact; play it from the repo copy (docs/galleries/music.html)'; return; }
  M.src = src; M.currentTime = 0;
  const start = r.start || 0;
  const go = () => { try { M.currentTime = start; } catch {} M.play().catch(e => { $('now').textContent = r.title + ': could not play (' + e.message + ')'; }); };
  if (mode === 'voice') {
    const cs = clipSrc();
    if (!cs) { $('now').textContent = 'The test clip is not inside this artifact; play it from the repo copy'; return; }
    const g = gains(r, lv); M.volume = g.m; V.src = cs; V.currentTime = 0; V.volume = g.v; V.muted = false;
    V.play().catch(() => {}); M.addEventListener('loadedmetadata', go, { once: true }); M.load();
    V.onended = () => stop();
    $('now').textContent = 'Playing ' + r.title + ' ' + lv + ' LU under the test clip\'s voice' + (g.approx ? ' (approximate: loudness not measured)' : '');
  } else {
    M.volume = 1; M.addEventListener('loadedmetadata', go, { once: true }); M.load();
    $('now').textContent = 'Playing ' + r.title + (r.audio && !r.audio.local ? ' (from its source URL)' : '');
  }
  playing = key; if (btn) btn.setAttribute('aria-pressed', 'true');
}
M.addEventListener('error', () => { if (playing) $('now').textContent = 'This track did not load (' + (M.error && M.error.code) + '): ' + M.src.slice(0, 80); });

/* the type panels */
const typesEl = $('types');
TY.forEach((t, ti) => {
  const el = document.createElement('article'); el.className = 'type' + (t.status === 'new' ? ' new' : '');
  el.innerHTML = '<h3></h3><p class="now"></p>'
    + '<div class="field"><span>Tracks</span><p class="picked" data-k="tracks"></p><p class="prod"></p></div>'
    + '<div class="field"><span>Moods</span><div class="chips" data-k="moods"></div></div>'
    + '<div class="field"><span>Energy</span><div class="seg" data-k="energy"></div><p class="prod"></p></div>'
    + '<div class="field"><span>Level under the voice (LU)</span><div class="lvl"><label class="sw"><input type="checkbox" data-k="levelSet"> set</label><input type="range" min="0" max="24" step="0.5" data-k="level" aria-label="LU under the voice"><output></output><button class="ghost" data-k="hear">Hear it</button></div><p class="prod" data-k="levelprod"></p></div>'
    + '<label class="sw"><input type="checkbox" data-k="beatSnap"> Beat-snap (cuts on the music\'s grid)</label><p class="prod" data-k="bsprod"></p>'
    + '<label class="sw"><input type="checkbox" data-k="drop"> Drop on the reveal</label><p class="prod" data-k="dprod"></p>';
  el.querySelector('h3').textContent = t.type + (t.status === 'new' ? ' (new type)' : '');
  el.querySelector('.now').innerHTML = '<b>Today:</b> ' + esc(t.when) + '.';
  el.querySelectorAll('.prod')[0].textContent = 'Today: ' + t.tracks;
  el.querySelectorAll('.prod')[1].textContent = 'Today: ' + t.energy;
  const moods = el.querySelector('[data-k=moods]');
  DATA.moods.forEach(m => { const b = document.createElement('button'); b.type = 'button'; b.textContent = m; b.dataset.mood = m; moods.appendChild(b); b.addEventListener('click', () => { const p = P[t.type], i = p.moods.indexOf(m); if (i < 0) p.moods.push(m); else p.moods.splice(i, 1); render(); }); });
  const en = el.querySelector('[data-k=energy]');
  [null, 1, 2, 3, 4, 5].forEach(v => { const b = document.createElement('button'); b.type = 'button'; b.textContent = v == null ? 'as today' : String(v); b.dataset.v = v == null ? '' : v; en.appendChild(b); b.addEventListener('click', () => { P[t.type].energy = v; render(); }); });
  const set = el.querySelector('[data-k=levelSet]'), rng = el.querySelector('[data-k=level]');
  set.addEventListener('change', () => { const p = P[t.type]; p.levelSet = set.checked; if (p.levelSet && p.level == null) p.level = 12; render(); });
  rng.addEventListener('input', () => { const p = P[t.type]; p.level = +rng.value; p.levelSet = true; render(); });
  el.querySelector('[data-k=hear]').addEventListener('click', e => {
    const p = P[t.type], id = p.tracks[0], r = id === 'bed:bundled' ? Object.assign({ audio: null }, DATA.bed) : R.find(x => x.id === id);
    const pick = r || (t.tracks.indexOf('bundled bed') >= 0 ? Object.assign({ audio: null }, DATA.bed) : R.find(x => x.lane === 'product' && x.audio.local));
    if (!pick) { $('now').textContent = 'No track on disk to play'; return; }
    play(pick, 'voice', p.levelSet && p.level != null ? p.level : 12, e.currentTarget);
  });
  el.querySelector('[data-k=beatSnap]').addEventListener('change', e => { P[t.type].beatSnap = e.target.checked; render(); });
  el.querySelector('[data-k=drop]').addEventListener('change', e => { P[t.type].drop = e.target.checked; render(); });
  el.querySelector('[data-k=hear]').dataset.play = '1';
  typesEl.appendChild(el); t.el = el;
});

/* the track table */
const name = r => '<div class="t">' + esc(r.title) + '</div><div class="by">' + esc(r.artist || r.source) + ' · ' + esc(r.source) + '</div>';
function rowHtml(r) {
  const g = r.grid, lt = r.lane === 'product' ? '<span class="tag product">product-safe</span>' : r.lane === 'creator' ? '<span class="tag creator">creator-use only</span>' : '<span class="tag none">not usable</span>';
  const remote = !r.audio.local ? '<span class="tag remote">source URL</span>' : '';
  return '<td class="keep">' + name(r) + (r.recognizable ? '<span class="tag rec">recognisable' + (r.ytViews ? ' · ' + (r.ytViews / 1e6).toFixed(0) + 'M views' : '') + '</span>' : '') + '<div class="cred">' + esc(r.why) + '</div></td>'
    + '<td>' + esc(r.genre) + '</td><td>' + esc(r.mood.join(', ')) + '</td><td class="num">' + r.energy + '</td>'
    + '<td class="num">' + r.bpm + (g ? ' · ' + g.bpm + '<br><span class="by">grid: 1st beat ' + g.firstBeat + ' s</span>' : '<br><span class="by">grid: not measured</span>') + (r.lufs != null ? '<br><span class="by">' + r.lufs.toFixed(1) + ' LUFS</span>' : '') + '</td>'
    + '<td class="num">' + (r.hasDrop && r.dropAt != null ? 'drop ' + r.dropAt + ' s' : 'no drop') + (r.hookAt != null ? '<br>hook ' + r.hookAt + ' s' : '') + '<br><span class="by">' + r.dur.toFixed(0) + ' s long</span></td>'
    + '<td class="keep">' + lt + '<div><a href="' + esc(r.licenceUrl) + '" target="_blank" rel="noopener" style="color:var(--ice)">' + esc(r.licence) + '</a></div>'
    + '<div class="cred">' + (r.credit ? 'Credit (video description, never on screen): ' + esc(r.credit) : 'No credit asked') + '</div><div class="cred">scope: ' + esc(r.scope) + ' · <a href="' + esc(r.sourceUrl) + '" target="_blank" rel="noopener" style="color:var(--muted)">source page</a></div></td>'
    + '<td class="keep"><div class="play"><button class="ghost" data-play="m">Play</button>' + (r.audio.local || INLINE ? '<button class="ghost" data-play="v">Under the voice</button>' : '') + '</div>' + remote
    + '<div class="cred">' + esc(r.audio.kept) + (r.audio.bytes ? ', ' + (r.audio.bytes / 1e6).toFixed(1) + ' MB' : '') + '</div>' + (r.audio.note ? '<div class="note">' + esc(r.audio.note) + '</div>' : '')
    + (INLINE && !INLINE.tracks[r.id] ? '<div class="note">Not inside this artifact: play it from the repo copy.</div>' : '') + '</td>'
    + '<td class="keep">' + (r.lane === 'none' ? '' : '<div class="tpick">' + TY.map(t => '<button type="button" data-ty="' + esc(t.type) + '"' + (r.lane === 'creator' ? ' title="creator-use only: never in a user\'s film"' : '') + '>' + esc(t.type) + '</button>').join('') + '</div>') + '</td>';
}
const order = { product: 0, creator: 1, none: 2 };
const sorted = R.slice().sort((a, b) => order[a.lane] - order[b.lane]);
const bedRow = Object.assign({ lane: 'product', genre: 'funk (bundled)', mood: [], energy: '–', bpm: '–', grid: null, hasDrop: false, dropAt: null, hookAt: null, dur: 0, recognizable: false,
  licence: 'CC-BY-4.0', licenceUrl: 'https://creativecommons.org/licenses/by/4.0/', sourceUrl: 'https://incompetech.com', scope: 'product-safe',
  why: 'the bundled bed the Style 1 mixer uses today (assets/music/bed.json; starts at ' + DATA.bed.start + ' s). Not in the library list.',
  audio: { src: DATA.bed.file, local: true, bytes: DATA.bed.bytes, kept: 'tracked in the repo' }, source: 'assets/music' }, DATA.bed);
const trs = [bedRow].concat(sorted).map(r => {
  const tr = document.createElement('tr'); tr.className = r.lane; tr.innerHTML = rowHtml(r);
  (r.lane === 'none' ? $('nonerows') : $('rows')).appendChild(tr);
  // Under the voice plays at the level of the first type that picked this track with a level set (else 12 LU)
  const lvOf = () => { const t = TY.find(t => P[t.type].tracks.includes(r.id) && P[t.type].levelSet); return t ? P[t.type].level : 12; };
  tr.querySelectorAll('[data-play]').forEach(b => b.addEventListener('click', () => play(r, b.dataset.play === 'v' ? 'voice' : 'music', b.dataset.play === 'v' ? lvOf() : 0, b)));
  tr.querySelectorAll('[data-ty]').forEach(b => b.addEventListener('click', () => { const p = P[b.dataset.ty], i = p.tracks.indexOf(r.id); if (i < 0) p.tracks.push(r.id); else p.tracks.splice(i, 1); render(); }));
  return { r, tr };
});

const titleOf = id => id === 'bed:bundled' ? DATA.bed.title + ' (bundled bed)' : (R.find(r => r.id === id) || { title: id }).title;
function render() {
  TY.forEach(t => {
    const p = P[t.type], el = t.el;
    el.querySelector('[data-k=tracks]').textContent = p.tracks.length ? p.tracks.map(titleOf).join(', ') : 'none picked (pick in the table below)';
    el.querySelectorAll('[data-k=moods] button').forEach(b => b.setAttribute('aria-pressed', String(p.moods.includes(b.dataset.mood))));
    el.querySelectorAll('[data-k=energy] button').forEach(b => b.setAttribute('aria-pressed', String((b.dataset.v === '' ? null : +b.dataset.v) === p.energy)));
    const set = el.querySelector('[data-k=levelSet]'), rng = el.querySelector('[data-k=level]'), o = el.querySelector('output');
    set.checked = p.levelSet; rng.disabled = !p.levelSet; rng.value = p.level == null ? 12 : p.level; o.textContent = p.levelSet && p.level != null ? p.level + ' LU' : 'not set';
    const lp = el.querySelector('[data-k=levelprod]'); lp.textContent = 'Today: ' + t.levelNote + (t.looks.length ? ' — ' + t.looks.map(l => l.levelNote).join('; ') : ''); lp.classList.toggle('changed', p.levelSet !== (t.level !== null) || (p.levelSet && p.level !== t.level));
    el.querySelector('[data-k=beatSnap]').checked = p.beatSnap; const bp = el.querySelector('[data-k=bsprod]'); bp.textContent = 'Today: ' + t.beatSnapNote; bp.classList.toggle('changed', p.beatSnap !== t.beatSnap);
    el.querySelector('[data-k=drop]').checked = p.drop; const dp = el.querySelector('[data-k=dprod]'); dp.textContent = 'Today: ' + t.dropNote; dp.classList.toggle('changed', p.drop !== t.drop);
  });
  trs.forEach(({ r, tr }) => tr.querySelectorAll('[data-ty]').forEach(b => b.setAttribute('aria-pressed', String(P[b.dataset.ty].tracks.includes(r.id)))));
  $('sum').innerHTML = TY.map(t => { const p = P[t.type]; return '<span>' + esc(t.type) + ': <b>' + p.tracks.length + '</b> tracks, <b>' + p.moods.length + '</b> moods, ' + (p.levelSet ? p.level + ' LU' : 'no level') + ', snap ' + (p.beatSnap ? 'on' : 'off') + ', drop ' + (p.drop ? 'on' : 'off') + '</span>'; }).join('');
  save();
}
render();

$('copy').addEventListener('click', () => {
  const out = { gallery: 'docs/galleries/music.html', decision: 7, picked: new Date().toISOString().slice(0, 10),
    types: Object.fromEntries(TY.map(t => { const p = P[t.type]; return [t.type, {
      tracks: p.tracks, moods: p.moods, energy: p.energy,
      level_lu_under_voice: p.levelSet ? p.level : null, beat_snap: p.beatSnap, drop_on_reveal: p.drop,
      today: { level_lu_under_voice: t.level, looks: t.looks.map(l => ({ look: l.name, level_lu_under_voice: l.level, where: l.where })), beat_snap: t.beatSnap, drop_on_reveal: t.drop },
      changed: { level: p.levelSet !== (t.level !== null) || (p.levelSet && p.level !== t.level), beat_snap: p.beatSnap !== t.beatSnap, drop_on_reveal: p.drop !== t.drop },
      creator_use_tracks_picked: p.tracks.filter(id => (R.find(r => r.id === id) || {}).lane === 'creator') }]; })) };
  const text = JSON.stringify(out, null, 2), box = $('out');
  box.value = text;
  const fallback = () => { box.style.display = 'block'; box.focus(); box.select(); let ok = false; try { ok = document.execCommand('copy'); } catch {} $('copied').textContent = ok ? 'Copied' : 'Select the text below and copy it'; };
  if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(() => { $('copied').textContent = 'Copied picks for ' + TY.length + ' types'; box.style.display = 'none'; }, fallback); else fallback();
});
window.__gallery = { rows: R.length, P };
})();
`;

/* the test clip's loudness, for the under-the-voice preview */
const CLIP_LUFS = existsSync(CLIP) ? await lufsOf(CLIP).catch(() => null) : null;

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, page({ mode: 'repo' }, true));
const local = rows.filter(r => r.audio.local);
console.log(`wrote ${OUT}: ${rows.length} tracks (${lane.product} product-safe, ${lane.creator} creator-use, ${lane.none} not usable); ${local.length} on disk (${(local.reduce((s, r) => s + r.audio.bytes, 0) / 1e6).toFixed(1)} MB), ${rows.length - local.length} from the source URL`);
for (const r of rows) console.log(`  ${r.id.padEnd(40)} ${r.lane.padEnd(8)} ${r.audio.local ? `${(r.audio.bytes / 1e6).toFixed(2)} MB` : 'remote '}  ${r.lufs?.toFixed(1) ?? '-'} LUFS  grid ${r.grid ? `${r.grid.bpm} bpm` : '-'}`);

const art = arg('artifact');
if (art) {
  // inline only what the licence lets us re-host (redistributable), smallest first, within the budget; never the creator-use tracks
  const BUDGET = 12e6; let used = 0; const inline: Record<string, string> = {};
  const add = (id: string, file: string) => { const n = Math.ceil(statSync(file).size / 3) * 4; if (used + n > BUDGET) return false; inline[id] = readFileSync(file).toString('base64'); used += n; return true; };
  const clipN = existsSync(CLIP) ? Math.ceil(statSync(CLIP).size / 3) * 4 : Infinity;
  const clip = clipN <= BUDGET ? readFileSync(CLIP).toString('base64') : null; // the voice for "under the voice" comes first
  if (clip) used += clipN;
  add(BED.id, bedFile);
  for (const r of rows.filter(r => r.audio.local && r.lane === 'product' && licenceTerms(r.licence).redistributable).sort((a, b) => a.audio.bytes - b.audio.bytes)) add(r.id, join(dirname(OUT), r.audio.src));
  writeFileSync(art, page({ mode: 'artifact', inline, clip }, false));
  console.log(`wrote ${art} (${(statSync(art).size / 1e6).toFixed(1)} MB; inlined ${Object.keys(inline).length} tracks${clip ? ' + the test clip' : ''})`);
}
