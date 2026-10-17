// pnpm --filter @moovi/engine exec tsx scripts/ref-gallery.ts [--artifact <out.html>]
// The reference parts checklist (decision 9, docs/agents/DECISIONS.md): one section per reference (R1–R5 clones and the
// twelve Launch references l01–l12), each with its type, its clone playing live where one exists, its kit or look
// (palette, type, motion), and every part from its parts.json as a row (role, timing, numbers). A choosing tool only:
// Ishaan ticks which parts become rules or defaults for the reference's type, which reference is a type's judge bar,
// and whether a type's look offers the kit's palette or type, with notes, then copies his picks as JSON.
// Nothing here changes a kit, a look, the library or any default; every number is read from the repo's own files.
// Writes docs/galleries/references.html (clones by relative path: no reference media goes in git).
// --artifact also writes a copy without the document skeleton and without iframes, for a claude.ai Artifact.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { color } from '@moovi/brand';

const ROOT = join(import.meta.dirname, '..', '..', '..');
const OUT = join(ROOT, 'docs', 'galleries', 'references.html');
const arg = (k: string) => { const i = process.argv.indexOf(`--${k}`); return i > 0 ? process.argv[i + 1] : undefined; };
const json = (p: string) => JSON.parse(readFileSync(join(ROOT, p), 'utf8'));

const TYPES = ['Edit my video', 'Launch', 'Showreel', 'Brand post', 'SaaS explainer', 'UI morph', 'Kinetic type'];
/** decision 9 (docs/agents/DECISIONS.md): which type each reference belongs to; the first is its home type, the rest it seeds */
const TYPE_OF: Record<string, string[]> = {
  r1: ['Brand post'], r3: ['Brand post'], r4: ['Brand post'], r2: ['Showreel'], r5: ['Showreel'],
  l02: ['Launch', 'Kinetic type'], l06: ['Launch', 'UI morph'], l09: ['Launch', 'UI morph'],
};
const IDS = ['r1', 'r2', 'r3', 'r4', 'r5', ...Array.from({ length: 12 }, (_, i) => `l${String(i + 1).padStart(2, '0')}`)];
for (const id of IDS) if (id.startsWith('l')) TYPE_OF[id] ??= ['Launch'];

type Part = { id: string; category: string; role?: string; at?: number | null; name?: string; energy?: number; about?: string;
  params?: unknown; needs?: string[]; tags?: string[]; events?: unknown; family?: string; impl?: Record<string, string>; runtime?: string[]; licence?: string; styles?: { style: string; w: number }[] };

/** params → "path = value" leaves, so every number shows */
function leaves(v: unknown, path = '', out: [string, string][] = []): [string, string][] {
  if (v === null || v === undefined) return out;
  if (Array.isArray(v)) {
    if (v.every(x => x === null || typeof x !== 'object')) out.push([path, v.map(x => String(x)).join(', ')]);
    else v.forEach((x, i) => leaves(x, `${path}[${i}]`, out));
  } else if (typeof v === 'object') for (const [k, x] of Object.entries(v as object)) leaves(x, path ? `${path}.${k}` : k, out);
  else out.push([path, String(v)]);
  return out;
}

const refs = IDS.map(id => {
  const pj = json(`data/refs/${id}/parts.json`);
  const kitFile: string | undefined = pj.kit?.file;
  const kit = kitFile && existsSync(join(ROOT, kitFile)) ? json(kitFile) : null;
  const launch = id.startsWith('l');
  const cloneDir = `data/refs/${id}/clone-motion`;
  const clone = existsSync(join(ROOT, cloneDir, 'index.html')) ? cloneDir : null;
  const cloneSrc = clone ? readFileSync(join(ROOT, cloneDir, 'index.html'), 'utf8') : '';
  const media = clone ? [...new Set([...cloneSrc.matchAll(/"\.\.\/([\w.-]+\.(?:mp4|mp3|wav|json))"/g)].map(m => m[1]!)), 'words.json'].filter((x, i, a) => a.indexOf(x) === i) : [];
  const rooted = /src="\/packages\//.test(cloneSrc);
  const parts = (pj.parts as Part[]).map(p => ({
    id: p.id, category: p.category, role: p.role ?? '', at: p.at ?? null, name: p.name ?? '', energy: p.energy ?? null, about: p.about ?? '',
    family: p.family ?? '', needs: p.needs ?? [], tags: p.tags ?? [], licence: p.licence ?? '',
    nums: leaves(p.params), events: p.events ? leaves(p.events) : [],
    impl: Object.values(p.impl ?? {}).join(' · '), suits: (p.styles ?? []).map(s => `${s.style} ${s.w}`).join(', '),
  }));
  return {
    id, types: TYPE_OF[id]!, title: pj.reference.title, url: pj.reference.url, kind: pj.reference.kind, seconds: pj.reference.seconds,
    notes: pj.reference.notes, styles: pj.styles ?? [], kitFile: kitFile ?? null,
    kit: kit ? { id: kit.id, name: kit.name, about: kit.about, palette: kit.palette ?? {}, type: kit.type ?? {}, motion: kit.motion ?? null, frame: kit.frame ?? null,
      worlds: kit.worlds ?? null, prefer: kit.prefer ?? null, post: kit.post ?? null, sound: kit.sound ?? null } : null,
    clone: clone ? { path: `${clone}/index.html`, media, rooted } : null, launch,
    uses: (pj.uses ?? []).map((u: { id: string; role?: string; at?: number | null }) => ({ id: u.id, role: u.role ?? '', at: u.at ?? null })),
    parts,
  };
});

const DATA = { types: TYPES, refs };

function page(artifact: boolean) {
  const total = refs.reduce((n, r) => n + r.parts.length, 0);
  const body = `<title>Reference Parts Checklist</title>
<meta name="claude:viewport-fit-sides" content="cover">
<style>
/* Layout: a sticky control strip, a jump list, then one section per reference: its clone (or look), its kit, and a table of its parts with ticks and notes. */
:root{
  --bg:#0A111C; --panel:#111B2A; --line:#22324A; --fg:${color.iceWhite}; --muted:#93A6BF; --ice:${color.ice}; --flag:#FF7A6B; --ok:#8FD9B6; --warn:#F2C86B;
  --ui:'Geist',system-ui,sans-serif; --mono:'JetBrains Mono',ui-monospace,monospace; color-scheme:dark;
}
html,body{background:var(--bg);color:var(--fg)}
body{font:14px/1.45 var(--ui);margin:0;padding-left:max(16px,env(safe-area-inset-left,0px));padding-right:max(16px,env(safe-area-inset-right,0px));padding-block:0 48px}
h1{font:600 22px/1.2 var(--ui);margin:0;letter-spacing:-.01em;text-wrap:balance}
h2{font:600 18px/1.25 var(--ui);margin:0;text-wrap:balance}
h3{font:600 12px var(--ui);text-transform:uppercase;letter-spacing:.08em;color:var(--muted);margin:14px 0 8px}
p{margin:0}
a{color:var(--ice)}
.intro{display:grid;gap:6px;padding-block:20px 12px;max-width:84ch;color:var(--muted)}
.intro h1{color:var(--fg)}
.bar{position:sticky;top:env(safe-area-inset-top,0px);z-index:5;background:color-mix(in srgb,var(--bg) 92%,transparent);backdrop-filter:blur(8px);border-bottom:1px solid var(--line);padding-block:10px;display:grid;gap:8px}
.row{display:flex;flex-wrap:wrap;gap:8px 14px;align-items:center}
.ctl{display:flex;gap:6px;align-items:center;color:var(--muted);font-size:12px}
.ctl input[type=search],.ctl select{background:var(--panel);color:var(--fg);border:1px solid var(--line);border-radius:6px;padding:4px 8px;font:13px var(--ui)}
button.act{border:1px solid var(--ice);background:var(--ice);color:#0A111C;border-radius:8px;padding:7px 14px;font:600 13px var(--ui);cursor:pointer}
button.ghost,a.ghost{border:1px solid var(--line);background:transparent;color:var(--fg);border-radius:8px;padding:5px 11px;font:12px var(--ui);cursor:pointer;text-decoration:none;display:inline-block}
button:focus-visible,input:focus-visible,select:focus-visible,textarea:focus-visible,a:focus-visible{outline:2px solid var(--ice);outline-offset:2px}
.sum{display:flex;flex-wrap:wrap;gap:6px;font-size:12px}
.sum span{border:1px solid var(--line);border-radius:999px;padding:2px 9px;color:var(--muted)}
.sum span b{color:var(--fg);font-weight:600}
.sum span.miss{border-style:dashed}
#copied{font-size:12px;color:var(--ok)}
#out{display:none;width:100%;min-height:140px;background:var(--panel);color:var(--fg);border:1px solid var(--line);border-radius:8px;font:12px var(--mono)}
.jump{display:flex;flex-wrap:wrap;gap:4px;font-size:12px}
.jump a{border:1px solid var(--line);border-radius:6px;padding:2px 7px;text-decoration:none;color:var(--muted)}
.jump a.done{border-color:var(--ice);color:var(--ice)}
section.ref{border-top:1px solid var(--line);padding-block:22px 6px;display:grid;gap:10px;scroll-margin-top:120px}
.head{display:flex;flex-wrap:wrap;gap:6px 12px;align-items:baseline}
.head code{font:600 15px var(--mono);color:var(--ice)}
.chip{font:11px var(--ui);border-radius:999px;padding:2px 8px;border:1px solid var(--ice);color:var(--ice)}
.chip.seed{border-style:dashed}
.muted{color:var(--muted);font-size:12px}
.top{display:grid;grid-template-columns:minmax(0,300px) minmax(0,1fr);gap:16px;align-items:start}
@media (max-width:760px){.top{grid-template-columns:minmax(0,1fr)}}
.player{display:grid;gap:6px;min-width:0}
.frame{position:relative;aspect-ratio:9/16;width:100%;max-width:300px;border-radius:10px;overflow:hidden;background:#000;outline:1px solid var(--line);display:grid;place-items:center;text-align:center;color:var(--muted);font-size:12px;padding:0}
.frame.wide{aspect-ratio:16/9}
.frame iframe{position:absolute;inset:0;width:100%;height:100%;border:0;background:#000}
.frame .ph{padding:16px;display:grid;gap:8px;justify-items:center}
.status{font-size:12px}
.status .miss{color:var(--warn)} .status .ok{color:var(--ok)}
.kit{display:grid;gap:6px;min-width:0}
.sw{display:flex;flex-wrap:wrap;gap:6px}
.sw span{display:inline-flex;gap:5px;align-items:center;font:11px var(--mono);color:var(--muted);border:1px solid var(--line);border-radius:6px;padding:2px 6px 2px 2px}
.sw i{width:18px;height:18px;border-radius:4px;display:inline-block;outline:1px solid #ffffff22}
dl.kv{display:grid;grid-template-columns:max-content minmax(0,1fr);gap:2px 10px;margin:0;font-size:12px}
dl.kv dt{color:var(--muted)} dl.kv dd{margin:0;font-family:var(--mono);font-size:11px;overflow-wrap:anywhere}
.refpick{display:grid;gap:6px;background:var(--panel);border:1px solid var(--line);border-radius:10px;padding:10px 12px}
.refpick table{border-collapse:collapse;font-size:12px}
.refpick td,.refpick th{padding:3px 10px 3px 0;text-align:left;vertical-align:top}
.refpick th{color:var(--muted);font-weight:500}
.refpick label{display:flex;gap:6px;align-items:center;cursor:pointer}
.today{color:var(--muted);font-size:11px}
textarea.note{width:100%;min-height:30px;box-sizing:border-box;background:var(--bg);color:var(--fg);border:1px solid var(--line);border-radius:6px;padding:4px 6px;font:12px var(--ui);resize:vertical}
.tbl{overflow-x:auto;border:1px solid var(--line);border-radius:10px}
table.parts{border-collapse:collapse;width:100%;min-width:900px;font-size:12px}
table.parts th{position:sticky;top:0;background:var(--panel);color:var(--muted);font-weight:500;text-align:left;padding:6px 8px;border-bottom:1px solid var(--line)}
table.parts td{padding:7px 8px;border-bottom:1px solid var(--line);vertical-align:top}
table.parts tr.on td{background:color-mix(in srgb,var(--ice) 8%,transparent)}
table.parts td.id code{font:600 11px var(--mono);overflow-wrap:anywhere}
.cat{font:10px var(--ui);text-transform:uppercase;letter-spacing:.06em;color:var(--muted)}
.nums{display:flex;flex-wrap:wrap;gap:3px}
.nums span{font:11px var(--mono);border:1px solid var(--line);border-radius:4px;padding:0 4px;color:var(--muted)}
.nums span b{color:var(--fg);font-weight:500}
.ticks{display:grid;gap:4px;min-width:150px}
.ticks label{display:flex;gap:6px;align-items:flex-start;cursor:pointer}
.uses{font-size:12px;color:var(--muted)}
.uses code{font:11px var(--mono);color:var(--fg)}
.hidden{display:none}
@media (prefers-reduced-motion:reduce){.bar{backdrop-filter:none}}
</style>
<div class="intro">
  <h1>Reference Parts Checklist</h1>
  <p>${refs.length} references and every one of their ${total} parts, read from <code>data/refs/*/parts.json</code>, the kits in <code>packages/library/src/kits/</code> and the Launch looks. For each part, tick "make this a rule or default" for the reference's type and leave a note. For each reference, tick whether it is the type's judge bar and whether the type's look offers its palette or its type. Nothing starts ticked, and nothing here changes a kit, a look or the library. Copy your picks and paste them into chat.</p>
  <p class="muted">Today, for every control: parts are library assets with no per-type rule yet (types arrive in Stage 1); the judge bar is the quality ratchet against the best previous clone, not per type; Auto's palette-only kit match (<code>styles/kit/kits.ts</code>) can dress inserts in an R kit's palette, and the Launch style casts the twelve Launch looks.</p>
  ${artifact
    ? '<p class="muted"><b>This is the artifact copy: clones do not play here.</b> Open the repo copy (<code>docs/galleries/references.html</code>, served from the repo root) to play clones.</p>'
    : '<p class="muted">Clones play in place from <code>data/refs/rN/clone-motion/</code>. Serve the repo root over http (R3 to R5 load <code>/packages/…</code> by absolute path). Their voice, word timings and original video are not in git, and a clone cannot start without them: fetch them with <code>scripts/ref-intake.ts &lt;id&gt; &lt;url&gt;</code>; the page checks for each file.</p>'}
</div>
<div class="bar">
  <div class="row">
    <span class="ctl"><label for="q">Find</label><input id="q" type="search" placeholder="part id, role, number"></span>
    <span class="ctl"><label for="cat">Category</label><select id="cat"><option value="">all</option></select></span>
    <span class="ctl"><label for="only">Show</label><select id="only"><option value="">every part</option><option value="picked">ticked or noted only</option></select></span>
    <button class="act" id="copy">Copy my picks</button><span id="copied" aria-live="polite"></span>
  </div>
  <div class="sum" id="sum"></div>
  <div class="jump" id="jump"></div>
  <textarea id="out" readonly aria-label="Picks JSON"></textarea>
</div>
<div id="refs"></div>
<script>var DATA = ${JSON.stringify(DATA).replace(/</g, '\\u003c')}; var ARTIFACT = ${artifact};</script>
<script>${CLIENT}</script>`;
  return artifact ? body : `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">\n${body.replace('</style>', '</style></head><body>')}\n</body></html>`;
}

const CLIENT = String.raw`
(() => {
const $ = id => document.getElementById(id), R = DATA.refs, TYPES = DATA.types;
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const store = { get(k, d) { try { const v = localStorage.getItem('moovi-rg-' + k); return v ? JSON.parse(v) : d; } catch { return d; } }, set(k, v) { try { localStorage.setItem('moovi-rg-' + k, JSON.stringify(v)); } catch {} } };
// picks[refId] = { judge: {type: true}, palette: {type: true}, type: {type: true}, note: '', parts: { partId: { rule: {type: true}, note: '' } } }
const picks = store.get('picks', {});
const P = id => picks[id] || (picks[id] = { judge: {}, palette: {}, type: {}, note: '', parts: {} });
const PP = (id, pid) => { const p = P(id); return p.parts[pid] || (p.parts[pid] = { rule: {}, note: '' }); };
const isHex = v => typeof v === 'string' && /^(#[0-9a-f]{3,8}|rgba?\()/i.test(v.trim());
const fmtAt = a => a == null ? '<span class="muted">whole film</span>' : (+a).toFixed(2) + ' s';
const fam = t => !t ? '' : typeof t === 'string' ? t : [t.family, t.weight, t.style || (t.italic ? 'italic' : ''), t.case, t.stretch, t.tracking != null ? 'track ' + t.tracking : ''].filter(Boolean).join(' ');

const cats = new Set(); R.forEach(r => r.parts.forEach(p => cats.add(p.category)));
[...cats].sort().forEach(c => { const o = document.createElement('option'); o.value = c; o.textContent = c; $('cat').appendChild(o); });

const host = $('refs');
R.forEach(r => {
  const s = document.createElement('section'); s.className = 'ref'; s.id = 'ref-' + r.id;
  const k = r.kit;
  const pal = k ? Object.entries(k.palette).flatMap(([n, v]) => (Array.isArray(v) ? v : String(v).split(/\s+/).filter(isHex).length > 1 ? String(v).split(/\s+/) : [v]).map((x, i, a) => [a.length > 1 ? n + i : n, x])) : [];
  let player = '';
  if (r.clone) {
    const rel = '../../' + r.clone.path;
    player = ARTIFACT
      ? '<div class="frame"><div class="ph"><b>Clone ' + r.id.toUpperCase() + '</b><span>Open the repo copy to play clones.</span><code>' + esc(r.clone.path) + '</code></div></div>'
      : '<div class="frame" id="fr-' + r.id + '"><div class="ph"><b>Clone ' + r.id.toUpperCase() + '</b><button class="ghost" data-load="' + r.id + '">Play the clone here</button></div></div>'
        + '<div class="row"><a class="ghost" href="' + esc(rel) + '" target="_blank" rel="noopener">Open full size</a></div>'
        + '<div class="status" id="st-' + r.id + '">Checking media…</div>';
  } else {
    player = '<div class="frame wide"><div class="ph"><b>No clone film</b><span>' + (r.launch ? 'The Launch kit draws this look live from a site: <code>pnpm --filter @moovi/engine launch --url &lt;site&gt;</code>. No film of it is in git.' : 'No clone in data/refs/' + r.id + '.') + '</span></div></div>';
  }
  const kv = [];
  if (k) {
    kv.push(['kit', esc(k.id) + ' · ' + esc(k.name)], ['file', esc(r.kitFile)]);
    Object.entries(k.type || {}).forEach(([role, t]) => kv.push(['type ' + role, esc(fam(t))]));
    if (k.worlds) kv.push(['worlds', esc(k.worlds.join(' → '))]);
    if (k.motion) kv.push(['motion', esc(JSON.stringify(k.motion))]);
    if (k.post) kv.push(['post', esc(JSON.stringify(k.post))]);
    if (k.frame) kv.push(['frame', esc(JSON.stringify(k.frame))]);
    if (k.prefer) Object.entries(k.prefer).forEach(([n, v]) => kv.push(['prefers ' + n, esc([].concat(v).join(', '))]));
    if (k.sound) kv.push(['sound', esc(JSON.stringify(k.sound))]);
  }
  kv.push(['styles', esc(r.styles.join(', '))]);
  const refRows = r.types.map(ty => '<tr><th scope="row">' + esc(ty) + (ty === r.types[0] ? '' : ' (seeds)') + '</th>'
    + '<td><label><input type="checkbox" data-ref="' + r.id + '" data-k="judge" data-ty="' + esc(ty) + '"> use as this type\'s judge bar</label></td>'
    + '<td><label><input type="checkbox" data-ref="' + r.id + '" data-k="palette" data-ty="' + esc(ty) + '"> offer its palette as a look option</label></td>'
    + '<td><label><input type="checkbox" data-ref="' + r.id + '" data-k="type" data-ty="' + esc(ty) + '"> offer its type as a look option</label></td></tr>').join('');
  const today = r.launch ? 'Today: the Launch style casts this look (' + esc(r.kitFile) + '); no per-type judge bar.' : 'Today: Auto\'s palette-only kit match can dress inserts in this palette; the type stays the style\'s own; no per-type judge bar.';
  const rows = r.parts.map((p, i) => '<tr data-i="' + i + '" data-cat="' + esc(p.category) + '">'
    + '<td class="id"><div class="cat">' + esc(p.category) + (p.family ? ' · ' + esc(p.family) : '') + '</div><code>' + esc(p.id) + '</code><div>' + esc(p.name) + '</div></td>'
    + '<td><div>' + esc(p.role) + '</div><div class="muted">' + esc(p.about) + '</div>' + (p.needs.length ? '<div class="muted">needs: ' + esc(p.needs.join(', ')) + '</div>' : '') + (p.tags.length ? '<div class="muted">tags: ' + esc(p.tags.join(', ')) + '</div>' : '') + '</td>'
    + '<td style="white-space:nowrap">' + fmtAt(p.at) + (p.energy != null ? '<div class="muted">energy ' + p.energy + '</div>' : '') + '</td>'
    + '<td><div class="nums">' + (p.nums.length ? p.nums.map(([a, b]) => '<span>' + esc(a) + ' <b>' + esc(b) + '</b></span>').join('') : '<span>no params</span>') + '</div>'
    + (p.events.length ? '<div class="nums" style="margin-top:3px">' + p.events.map(([a, b]) => '<span>event ' + esc(a) + ' <b>' + esc(b) + '</b></span>').join('') + '</div>' : '')
    + '<div class="muted" style="margin-top:3px">' + esc(p.impl) + (p.licence ? ' · ' + esc(p.licence) : '') + (p.suits ? ' · suits ' + esc(p.suits) : '') + '</div></td>'
    + '<td><div class="ticks">' + r.types.map(ty => '<label><input type="checkbox" data-part="' + i + '" data-ty="' + esc(ty) + '"> rule or default for ' + esc(ty) + '</label>').join('')
    + '<span class="today">today: library asset, no type rule</span><textarea class="note" data-pnote="' + i + '" aria-label="Note on ' + esc(p.id) + '" placeholder="note"></textarea></div></td></tr>').join('');
  s.innerHTML = '<div class="head"><code>' + r.id.toUpperCase() + '</code><h2>' + esc(k ? k.name : r.title) + '</h2>' + r.types.map((ty, j) => '<span class="chip' + (j ? ' seed' : '') + '">' + esc(ty) + (j ? ' (seeds)' : '') + '</span>').join('') + '</div>'
    + '<p>' + esc(r.title) + ' · <span class="muted">' + esc(r.kind) + ', ' + r.seconds + ' s · <a href="' + esc(r.url) + '" target="_blank" rel="noopener">original</a></span></p>'
    + '<p class="muted">' + esc(r.notes) + '</p>'
    + '<div class="top"><div class="player">' + player + '</div><div class="kit">'
    + (k ? '<p class="muted">' + esc(k.about) + '</p>' : '<p class="muted">No kit file.</p>')
    + (pal.length ? '<h3>Palette</h3><div class="sw">' + pal.map(([n, v]) => '<span><i style="background:' + esc(v) + '"></i>' + esc(n) + ' ' + esc(v) + '</span>').join('') + '</div>' : '')
    + '<h3>Kit and look</h3><dl class="kv">' + kv.map(([a, b]) => '<dt>' + esc(a) + '</dt><dd>' + b + '</dd>').join('') + '</dl>'
    + '<div class="refpick"><table><tbody>' + refRows + '</tbody></table><span class="today">' + today + '</span><textarea class="note" data-rnote="' + r.id + '" aria-label="Note on ' + r.id + '" placeholder="note on this reference"></textarea></div>'
    + '</div></div>'
    + '<h3>Parts (' + r.parts.length + ')</h3><div class="tbl"><table class="parts"><thead><tr><th>Part</th><th>Role</th><th>Timing</th><th>Numbers</th><th>Pick</th></tr></thead><tbody>' + rows + '</tbody></table></div>'
    + (r.uses.length ? '<h3>Library assets it uses (' + r.uses.length + ')</h3><p class="uses">' + r.uses.map(u => '<code>' + esc(u.id) + '</code> ' + esc(u.role) + (u.at != null ? ' @' + u.at + ' s' : '')).join(' · ') + '</p>' : '');
  host.appendChild(s);
  s.querySelectorAll('[data-k]').forEach(c => { c.checked = !!(picks[r.id] && picks[r.id][c.dataset.k][c.dataset.ty]); c.addEventListener('change', () => { const p = P(r.id); if (c.checked) p[c.dataset.k][c.dataset.ty] = true; else delete p[c.dataset.k][c.dataset.ty]; save(); }); });
  const rn = s.querySelector('[data-rnote]'); rn.value = (picks[r.id] && picks[r.id].note) || ''; rn.addEventListener('input', () => { P(r.id).note = rn.value; save(); });
  s.querySelectorAll('[data-part]').forEach(c => { const pid = r.parts[+c.dataset.part].id, q = picks[r.id] && picks[r.id].parts[pid]; c.checked = !!(q && q.rule[c.dataset.ty]); c.addEventListener('change', () => { const q = PP(r.id, pid); if (c.checked) q.rule[c.dataset.ty] = true; else delete q.rule[c.dataset.ty]; save(); }); });
  s.querySelectorAll('[data-pnote]').forEach(t => { const pid = r.parts[+t.dataset.pnote].id, q = picks[r.id] && picks[r.id].parts[pid]; t.value = (q && q.note) || ''; t.addEventListener('input', () => { PP(r.id, pid).note = t.value; save(); }); });
  const lb = s.querySelector('[data-load]');
  if (lb) lb.addEventListener('click', () => { const f = $('fr-' + r.id); f.innerHTML = '<iframe title="Clone ' + r.id + '" src="../../' + r.clone.path + '" allow="autoplay"></iframe>'; });
});

/* the clones' fetched media: present or not (only the repo copy) */
if (!ARTIFACT) R.filter(r => r.clone).forEach(async r => {
  const st = $('st-' + r.id), base = '../../data/refs/' + r.id + '/';
  if (location.protocol === 'file:') { st.innerHTML = '<span class="miss">Opened from a file: serve the repo root over http to play clones' + (r.clone.rooted ? ' (this one loads /packages/… by absolute path)' : '') + '.</span>'; return; }
  const got = await Promise.all(r.clone.media.map(f => fetch(base + f, { method: 'HEAD' }).then(x => x.ok, () => false)));
  const miss = r.clone.media.filter((_, i) => !got[i]);
  st.innerHTML = miss.length
    ? '<span class="miss">Media missing: ' + esc(miss.join(', ')) + '. The clone needs them to play (without words.json it stops at load and stays black). Fetch them (and the word timings, Whisper on your key) with <code>pnpm --filter @moovi/engine exec tsx scripts/ref-intake.ts ' + r.id + ' ' + esc(r.url) + '</code>.</span>'
    : '<span class="ok">Media present (' + esc(r.clone.media.join(', ')) + ').</span>';
});

/* filters (ordering stays; the viewer hides only what they ask to hide) */
function filter() {
  const q = $('q').value.trim().toLowerCase(), cat = $('cat').value, only = $('only').value;
  R.forEach(r => document.querySelectorAll('#ref-' + r.id + ' tbody tr[data-i]').forEach(tr => {
    const p = r.parts[+tr.dataset.i], pk = picks[r.id] && picks[r.id].parts[p.id], on = !!(pk && (Object.keys(pk.rule).length || pk.note.trim()));
    tr.classList.toggle('on', on);
    const hay = (p.id + ' ' + p.name + ' ' + p.role + ' ' + p.about + ' ' + p.nums.map(x => x.join(' ')).join(' ')).toLowerCase();
    tr.classList.toggle('hidden', (q && !hay.includes(q)) || (cat && p.category !== cat) || (only === 'picked' && !on));
  }));
}
['q', 'cat', 'only'].forEach(id => $(id).addEventListener('input', filter));

function counts(r) { const p = picks[r.id]; if (!p) return { rules: 0, notes: 0, ref: 0 }; const ps = Object.values(p.parts); return { rules: ps.filter(x => Object.keys(x.rule).length).length, notes: ps.filter(x => x.note.trim()).length, ref: Object.keys(p.judge).length + Object.keys(p.palette).length + Object.keys(p.type).length }; }
function summary() {
  $('jump').innerHTML = R.map(r => { const c = counts(r); return '<a href="#ref-' + r.id + '"' + (c.rules || c.ref ? ' class="done"' : '') + '>' + r.id.toUpperCase() + ' ' + c.rules + '/' + r.parts.length + '</a>'; }).join('');
  const judges = Object.fromEntries(TYPES.map(ty => [ty, R.filter(r => picks[r.id] && picks[r.id].judge[ty]).map(r => r.id)]));
  const owned = TYPES.filter(ty => R.some(r => r.types.includes(ty)));
  const rules = R.reduce((n, r) => n + counts(r).rules, 0), notes = R.reduce((n, r) => n + counts(r).notes, 0);
  $('sum').innerHTML = '<span>Parts ticked <b>' + rules + '</b> of ' + R.reduce((n, r) => n + r.parts.length, 0) + '</span><span>Part notes <b>' + notes + '</b></span>'
    + owned.map(ty => '<span' + (judges[ty].length === 1 ? '' : ' class="miss"') + '>' + esc(ty) + ' judge bar: <b>' + (judges[ty].length ? judges[ty].join(', ').toUpperCase() : 'none') + '</b></span>').join('');
}
function save() { store.set('picks', picks); summary(); filter(); }
summary(); filter();

$('copy').addEventListener('click', () => {
  const out = { gallery: 'docs/galleries/references.html', decision: 9, picked: new Date().toISOString().slice(0, 10),
    judge_bar: Object.fromEntries(TYPES.map(ty => [ty, R.filter(r => picks[r.id] && picks[r.id].judge[ty]).map(r => r.id)]).filter(([, v]) => v.length)),
    references: Object.fromEntries(R.map(r => {
      const p = picks[r.id] || { judge: {}, palette: {}, type: {}, note: '', parts: {} };
      const parts = r.parts.map(x => ({ id: x.id, q: p.parts[x.id] })).filter(x => x.q && (Object.keys(x.q.rule).length || x.q.note.trim()))
        .map(x => ({ id: x.id, rule_or_default_for: Object.keys(x.q.rule), ...(x.q.note.trim() ? { note: x.q.note.trim() } : {}) }));
      return [r.id, { types: r.types, kit: r.kit ? r.kit.id : null, judge_bar_for: Object.keys(p.judge), offer_palette_for: Object.keys(p.palette), offer_type_for: Object.keys(p.type),
        ...(p.note.trim() ? { note: p.note.trim() } : {}), parts_total: r.parts.length, parts }];
    })) };
  const text = JSON.stringify(out, null, 2), box = $('out');
  box.value = text;
  const fallback = () => { box.style.display = 'block'; box.focus(); box.select(); let ok = false; try { ok = document.execCommand('copy'); } catch {} $('copied').textContent = ok ? 'Copied' : 'Select the text below and copy it'; };
  const n = Object.values(out.references).reduce((a, r) => a + r.parts.length, 0);
  if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(() => { $('copied').textContent = 'Copied picks on ' + n + ' parts'; box.style.display = 'none'; }, fallback); else fallback();
});
window.__gallery = { refs: R.length, parts: R.reduce((n, r) => n + r.parts.length, 0) };
})();
`;

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, page(false));
console.log(`wrote ${OUT} (${refs.length} references, ${refs.reduce((n, r) => n + r.parts.length, 0)} parts)`);
for (const r of refs) console.log(`  ${r.id.padEnd(4)} ${r.types.join(' + ').padEnd(22)} ${String(r.parts.length).padStart(3)} parts  kit ${r.kit?.id ?? '-'}  ${r.clone ? `clone (needs ${r.clone.media.join(', ')}${r.clone.rooted ? '; repo-rooted server' : ''})` : 'no clone'}`);
const art = arg('artifact');
if (art) { writeFileSync(art, page(true)); console.log(`wrote ${art}`); }
