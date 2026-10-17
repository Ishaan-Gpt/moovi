/**
 * "Edit my video", round 1 (docs/agents/DECISIONS.md decision 14): Ishaan's own raw clips edited with each of the
 * Edit type's 5 looks and the auto-pick, through planEdit exactly as the studio's edit job runs it, then stills,
 * contact sheets, live previews and the review page. Outputs and findings only: it changes no look, law or number.
 *
 *   pnpm --filter @moovi/engine exec tsx --env-file-if-exists=../../.env.local scripts/edit-round1.ts make [--clips a,b] [--looks base,atlas]
 *   ... scripts/edit-round1.ts refs              six frames per reference edit E1–E6 (data/refs/e<n>/ref.mp4, from ref-intake.ts)
 *   ... scripts/edit-round1.ts judge             the blind sheets, lettered (data/edit-round1/judge/, key in key.json)
 *   ... scripts/edit-round1.ts serve [--port 4401]  every output's live preview, one port each (index in serve.json)
 *   ... scripts/edit-round1.ts page [--findings f.json] [--artifact out.html]  docs/galleries/edit-round1.html from findings.json
 *
 * Clips: docs/agents/ishaan-test/ishaan-test.mp4 and every video in data/raw/ishaan/ (git-ignored). Everything else
 * lands in data/edit-round1/ (git-ignored). The committed page embeds our own stills only; reference frames are linked
 * from the local data folder, never embedded (no reference media in git).
 */
import { execFileSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { basename, extname, join, relative, resolve } from 'node:path';
import { chromium } from 'playwright-core';
import { config } from '../src/config';
import { planEdit } from '../src/edit/job';
import { PAGE } from '../src/edit/page';
import { useRestored } from '../src/edit/restore';
import { servePlayer } from '../src/s4/player';

const args = process.argv.slice(2), mode = args[0] ?? 'make', flag = (k: string) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : undefined; };
const REPO = resolve(import.meta.dirname, '..', '..', '..');
const OUT = join(config.data, flag('--out') ?? 'edit-round1'), JUDGE = join(OUT, 'judge'), REFS = join(REPO, 'data', 'refs');
const RAW = join(config.data, 'raw', 'ishaan');
mkdirSync(OUT, { recursive: true }); mkdirSync(RAW, { recursive: true });

/** The 5 looks and the auto-pick, each asked for the way the studio asks (router/edit.ts: style 'auto' + the brief). */
const LOOKS = [
  { id: 'base', name: 'Base', plan: { style: undefined, brief: '' } },
  { id: 'atlas', name: 'Atlas', plan: { style: 'auto', brief: 'edit this in Atlas' } },
  { id: 'handmade', name: 'Handmade', plan: { style: 'auto', brief: 'edit this in Handmade' } },
  { id: 'studio-minimal', name: 'Studio Minimal', plan: { style: 'auto', brief: 'edit this in Studio Minimal' } },
  { id: 'studio-cut', name: 'Studio Cut', plan: { style: 'auto', brief: 'edit this as a Studio Cut' } },
  { id: 'auto', name: 'Auto-pick', plan: { style: 'auto', brief: '' } },
] as const;
/** The reference edits (docs/agents/research/R4-references.md) and the look each one is closest to. */
const REFERENCE = [
  { id: 'e1', name: 'E1 zache.fs, creator intro', url: 'https://www.instagram.com/p/DehkOI3qX6d/', look: 'atlas' },
  { id: 'e2', name: 'E2 jordans.archivess, tutorial', url: 'https://www.instagram.com/p/DZsVuGdx2cE/', look: 'handmade' },
  { id: 'e3', name: 'E3 tharunnaik.0, story with inserts', url: 'https://www.instagram.com/p/Ddtf1lUzljq/', look: 'studio-cut' },
  { id: 'e4', name: 'E4 tharunnaik.0, split explainer', url: 'https://www.instagram.com/p/DeZM3UDTxfF/', look: 'studio-minimal' },
  { id: 'e5', name: 'E5 tharunnaik.0, split explainer', url: 'https://www.instagram.com/p/Dd31rjBznGo/', look: 'base' },
  { id: 'e6', name: 'E6 tharunnaik.0, story with inserts', url: 'https://www.instagram.com/p/DcbCMzoTwhS/', look: 'auto' },
] as const;

const clips = () => {
  // synth/: retake clips spliced from Ishaan's own footage (a false start, a line said twice) until his raw takes land
  const SYNTH = join(config.data, 'edit-round1', 'synth'), vids = (d: string) => existsSync(d) ? readdirSync(d).filter(f => /\.(mp4|mov|m4v|webm|mkv)$/i.test(f)).map(f => join(d, f)) : [];
  const all = [join(REPO, 'docs', 'agents', 'ishaan-test', 'ishaan-test.mp4'), ...vids(SYNTH), ...readdirSync(RAW).filter(f => /\.(mp4|mov|m4v|webm|mkv)$/i.test(f)).map(f => join(RAW, f))];
  const only = flag('--clips')?.split(',');
  return all.map(p => ({ path: p, id: basename(p, extname(p)).replace(/[^a-z0-9]+/gi, '-').toLowerCase().slice(0, 40) })).filter(c => !only || only.includes(c.id));
};
const ff = (a: string[]) => execFileSync(config.ffmpeg, ['-v', 'error', '-y', ...a]);
const sha = () => { try { return execFileSync('git', ['rev-parse', '--short', 'HEAD'], { cwd: REPO }).toString().trim(); } catch { return 'nogit'; } };
const browser = () => chromium.launch({ headless: true, ...(config.chrome.path ? { executablePath: config.chrome.path } : { channel: config.chrome.channel }), args: ['--autoplay-policy=no-user-gesture-required'] });
const times = (d: number) => [0.06, 0.22, 0.38, 0.54, 0.7, 0.9].map(f => +(f * d).toFixed(2));

/** Six stills from the live player (window.__render, the same frame playback shows), tiled into one sheet. */
async function stills(dir: string, duration: number): Promise<string[]> {
  const e = JSON.parse(readFileSync(join(dir, 'edl.json'), 'utf8')) as { output?: { w: number; h: number }; cuts?: { t: number; dur?: number }[] };
  // settled frames (decision 16): a still never lands inside a cut's transition (a 0.24 s blur-zoom read as "a glitch")
  const busy = (t: number) => (e.cuts ?? []).some(c => c.dur && Math.abs(t - c.t) < c.dur + 0.04);
  const settle = (t: number) => [0, 0.15, -0.15, 0.3, -0.3, 0.45, -0.45].map(d => +(t + d).toFixed(2)).find(x => x > 0 && x < duration && !busy(x)) ?? t;
  const land = (e.output?.w ?? 1080) > (e.output?.h ?? 1920);
  const srv = await servePlayer(dir, 0, PAGE), b = await browser();
  const out: string[] = [];
  try {
    const page = await b.newPage({ viewport: land ? { width: 640, height: 360 } : { width: 360, height: 640 } });
    page.on('pageerror', x => console.log('  pageerror:', String(x).slice(0, 160)));
    await page.goto(srv.url); await page.waitForFunction('window.__ready || window.__error', null, { timeout: 90_000 });
    const err = await page.evaluate('window.__error'); if (err) throw new Error(String(err));
    for (const [i, t] of times(duration).map(settle).entries()) {
      await page.evaluate(`window.__render(${t})`);
      const f = join(dir, `still-${i}.jpg`); await page.locator('#frame').screenshot({ path: f, type: 'jpeg', quality: 82 }); out.push(f);
    }
  } finally { await b.close(); srv.close(); }
  return out;
}
const sheet = (frames: string[], out: string) => { ff([...frames.flatMap(f => ['-i', f]), '-filter_complex', `${frames.map((_, i) => `[${i}:v]scale=-2:480[v${i}]`).join(';')};${frames.map((_, i) => `[v${i}]`).join('')}hstack=inputs=${frames.length}`, '-q:v', '4', out]); return out; };

if (mode === 'make') {
  const only = flag('--looks')?.split(',');
  const log: unknown[] = existsSync(join(OUT, 'runs.json')) ? JSON.parse(readFileSync(join(OUT, 'runs.json'), 'utf8')) : [];
  for (const c of clips()) for (const L of LOOKS.filter(l => !only || only.includes(l.id))) {
    const dir = join(OUT, c.id, L.id); rmSync(dir, { recursive: true, force: true });
    console.log(`${c.id} · ${L.name}`);
    const notes: string[] = [], t0 = Date.now();
    // the picture pass is the same for every look of a clip (same source, same grade): run once per clip, then copied
    // (--fresh runs it every time, as the studio does)
    const CACHE = join(OUT, '_cache', c.id), cached = !args.includes('--fresh') && existsSync(join(CACHE, 'restore.json'));
    const p = await planEdit({ path: c.path, dir, name: basename(c.path), onNote: t => { notes.push(t); }, ...(L.plan.style ? { style: L.plan.style } : {}), brief: L.plan.brief, ...(cached ? { restore: false } : {}) });
    const toPlan = (Date.now() - t0) / 1000;
    const [voice, restore0, mix] = await Promise.all([p.voice, p.restore, p.mix]);
    let restore = restore0;
    if (cached) { restore = { ...JSON.parse(readFileSync(join(CACHE, 'restore.json'), 'utf8')), file: join(dir, 'hd.mp4') }; copyFileSync(join(CACHE, 'hd.mp4'), join(dir, 'hd.mp4')); useRestored(dir, restore!); writeFileSync(join(dir, 'restore.json'), JSON.stringify(restore, null, 1)); }
    else if (restore) { mkdirSync(CACHE, { recursive: true }); copyFileSync(restore.file, join(CACHE, 'hd.mp4')); writeFileSync(join(CACHE, 'restore.json'), JSON.stringify(restore, null, 1)); }
    const e = JSON.parse(readFileSync(join(dir, 'edl.json'), 'utf8'));
    const fr = await stills(dir, p.duration);
    sheet(fr, join(dir, 'sheet.jpg'));
    const row = { clip: c.id, look: L.id, name: L.name, brief: L.plan.brief, dir, ran: { style: p.style, template: e.template?.id ?? null, caption: e.caption_style_id, rough: p.rough }, source: p.source, duration: +p.duration.toFixed(2), shots: e.shots.length, inserts: (e.inserts ?? []).length, overlays: (e.overlays ?? []).length, sfx: (e.sfx ?? []).length, moves: p.moves, effects: p.effects ? (p.effects as { items?: unknown[] }).items?.length ?? null : null, faces: p.faces, language: p.language ?? null, words: p.words.length, metrics: e.metrics ?? null, check: existsSync(join(dir, 'check.json')) ? JSON.parse(readFileSync(join(dir, 'check.json'), 'utf8')) : null, lap: p.lap, to_plan_s: +toPlan.toFixed(1), voice: voice ? { lufs: voice.after?.lufs } : null, restored: restore ? { restored: restore.restored, to: restore.to } : null, mix: mix ? { lufs: +mix.lufs.toFixed(1) } : null, notes, stills: fr.map(f => relative(OUT, f)), commit: sha() };
    writeFileSync(join(dir, 'run.json'), JSON.stringify(row, null, 1));
    const i = (log as { clip: string; look: string }[]).findIndex(r => r.clip === c.id && r.look === L.id); if (i >= 0) log.splice(i, 1, row); else log.push(row);
    writeFileSync(join(OUT, 'runs.json'), JSON.stringify(log, null, 1));
    console.log(`  ${row.ran.style.id ?? 'base'}${row.ran.template ? ` + ${row.ran.template}` : ''} · ${row.duration} s · ${row.shots} shots · caption ${row.ran.caption} · plan ${row.to_plan_s} s${notes.length ? ` · ${notes.join(' | ')}` : ''}`);
  }
  process.exit(0);
}

if (mode === 'stills') {
  // the player changed, the plans did not: new stills and sheets for every output already made
  const runs = JSON.parse(readFileSync(join(OUT, 'runs.json'), 'utf8')) as { clip: string; look: string; dir: string; duration: number }[];
  for (const r of runs) { const fr = await stills(r.dir, r.duration); sheet(fr, join(r.dir, 'sheet.jpg')); console.log(`${r.clip} · ${r.look}: sheet`); }
  process.exit(0);
}

if (mode === 'refs') {
  for (const r of REFERENCE) {
    const v = join(REFS, r.id, 'ref.mp4'); if (!existsSync(v)) { console.log(`${r.id}: no ref.mp4 (run ref-intake.ts ${r.id} ${r.url})`); continue; }
    const d = +execFileSync(config.ffprobe ?? 'ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', v]).toString().trim();
    const dir = join(OUT, 'refs', r.id); mkdirSync(dir, { recursive: true });
    const fr = times(d).map((t, i) => { const f = join(dir, `still-${i}.jpg`); ff(['-ss', String(t), '-i', v, '-frames:v', '1', '-vf', 'scale=-2:640', '-q:v', '3', f]); return f; });
    sheet(fr, join(dir, 'sheet.jpg')); console.log(`${r.id}: ${d.toFixed(1)} s, sheet`);
  }
  process.exit(0);
}

if (mode === 'judge') {
  // every output and every reference sheet in one round, shuffled and lettered; the key stays out of the judge folder
  rmSync(JUDGE, { recursive: true, force: true }); mkdirSync(JUDGE, { recursive: true });
  const runs = JSON.parse(readFileSync(join(OUT, 'runs.json'), 'utf8')) as { clip: string; look: string; dir: string }[];
  // --with a,b: the previous rounds' outputs (data/<a>/runs.json) in the same blind round, for the ratchet
  const prev = (flag('--with')?.split(',') ?? []).flatMap(o => (JSON.parse(readFileSync(resolve(config.data, o, 'runs.json'), 'utf8')) as { clip: string; look: string; dir: string }[]).map(r => ({ kind: 'ours', id: `${o}:${r.clip}/${r.look}`, sheet: join(r.dir, 'sheet.jpg') })));
  const items = [...prev, ...runs.map(r => ({ kind: 'ours', id: `${r.clip}/${r.look}`, sheet: join(r.dir, 'sheet.jpg') })), ...REFERENCE.filter(r => existsSync(join(OUT, 'refs', r.id, 'sheet.jpg'))).map(r => ({ kind: 'ref', id: r.id, sheet: join(OUT, 'refs', r.id, 'sheet.jpg') }))];
  let seed = Number(flag('--seed') ?? 20261017); const rnd = () => (seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31;
  for (let i = items.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [items[i], items[j]] = [items[j]!, items[i]!]; }
  const key = items.map((it, i) => { const letter = i < 26 ? String.fromCharCode(65 + i) : 'A' + String.fromCharCode(65 + i - 26); ff(['-i', it.sheet, '-q:v', '4', join(JUDGE, `${letter}.jpg`)]); return { letter, ...it }; });
  writeFileSync(join(OUT, 'key.json'), JSON.stringify(key, null, 1));
  console.log(`${key.length} sheets in ${JUDGE}; key in ${join(OUT, 'key.json')}`);
  process.exit(0);
}

if (mode === 'serve') {
  const runs = JSON.parse(readFileSync(join(OUT, 'runs.json'), 'utf8')) as { clip: string; look: string; dir: string }[];
  let port = Number(flag('--port') ?? 4401); const idx: { clip: string; look: string; url: string }[] = [];
  for (const r of runs) { const s = await servePlayer(r.dir, port++, PAGE); idx.push({ clip: r.clip, look: r.look, url: s.url }); console.log(`${r.clip} · ${r.look}: ${s.url}`); }
  writeFileSync(join(OUT, 'serve.json'), JSON.stringify(idx, null, 1));
  console.log('serving; Ctrl+C to stop');
}

if (mode === 'page') {
  // findings.json (written from the judge's scores and the frame-by-frame misses): { commit, judge, outputs[], refs[], proposals[] }
  const F = JSON.parse(readFileSync(flag('--findings') ?? join(OUT, 'findings.json'), 'utf8')) as Findings;
  const runs = JSON.parse(readFileSync(join(OUT, 'runs.json'), 'utf8')) as Run[];
  const art = flag('--artifact');
  const b64 = (f: string) => `data:image/jpeg;base64,${readFileSync(f).toString('base64')}`;
  const thumb = (f: string) => { const t = f.replace(/\.jpg$/, '.thumb.jpg'); ff(['-i', f, '-vf', 'scale=-2:300', '-q:v', '5', t]); return b64(t); };
  const html = renderPage(F, runs, { sheet: r => thumb(join(r.dir, 'sheet.jpg')), refSheet: id => art ? null : `../../data/edit-round1/refs/${id}/sheet.jpg`, artifact: !!art });
  const out = art ?? join(REPO, 'docs', 'galleries', 'edit-round1.html');
  writeFileSync(out, html); console.log(`wrote ${out} (${(html.length / 1024).toFixed(0)} KB)`);
  process.exit(0);
}

interface Run { clip: string; look: string; name: string; dir: string; duration: number; shots: number; ran: { style: { id: string | null; why: string }; template: string | null; caption: string }; source: { w: number; h: number; duration: number } }
interface Miss { t: string; what: string; points: string }
interface Output { clip: string; look: string; letter: string; scores: Record<string, number>; mean: number; misses: Miss[]; ref: string; port?: number }
interface Proposal { id: string; miss: string; field: string; where: string; current: string; options: string[] }
interface Findings { commit: string; date: string; graph: string; judge: { rubric: string[]; note: string }; outputs: Output[]; refs: { id: string; letter: string; mean: number; scores: Record<string, number> }[]; proposals: Proposal[]; notes: string[]; takes?: TakesFinding; strings?: { where: string; text: string }[] }
/** The retakes check (edit/takes.ts): which take was kept per repeated line, and whether the blind take judge agrees. */
interface TakesFinding { clip: string; made: string; found: string; confidence: string; rows: { line: string; takes: string; kept: string; judge: string; with_fix: string; cause: string }[] }

function esc(s: unknown): string { return String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!)); }
function renderPage(F: Findings, runs: Run[], o: { sheet: (r: Run) => string; refSheet: (id: string) => string | null; artifact: boolean }): string {
  const ref = (id: string) => REFERENCE.find(r => r.id === id)!;
  const refScore = (id: string) => F.refs.find(r => r.id === id);
  const card = (out: Output) => {
    const r = runs.find(x => x.clip === out.clip && x.look === out.look)!, R = ref(out.ref), rs = refScore(out.ref), rimg = o.refSheet(out.ref);
    return `<article class="card" id="${esc(out.clip)}-${esc(out.look)}">
<header><h3>${esc(r.name)}</h3><span class="score">${out.mean.toFixed(1)}</span></header>
<p class="meta">${esc(out.clip)} · ran as <b>${esc(r.ran.style.id ?? 'base')}${r.ran.template ? ` + ${r.ran.template}` : ''}</b> · captions ${esc(r.ran.caption)} · ${r.duration.toFixed(1)} s, ${r.shots} shots${out.port ? ` · <a href="http://127.0.0.1:${out.port}/" target="_blank">live preview (local)</a>` : ''}</p>
<p class="why">${esc(r.ran.style.why)}</p>
<img class="sheet" src="${o.sheet(r)}" alt="${esc(r.name)}, six frames">
<p class="rub">${Object.entries(out.scores).map(([k, v]) => `${esc(k)} <b>${v}</b>`).join(' · ')}</p>
<ol class="miss">${out.misses.map(m => `<li><span class="t">${esc(m.t)}</span> ${esc(m.what)} <span class="pt">→ ${esc(m.points)}</span></li>`).join('')}</ol>
<div class="ref"><p>Closest reference: <a href="${R.url}" target="_blank" rel="noopener">${esc(R.name)}</a>${rs ? `, scored ${rs.mean.toFixed(1)} in the same round` : ', not fetched'}</p>${rimg ? `<img class="sheet" src="${rimg}" alt="" onerror="this.remove()">` : ''}</div>
</article>`;
  };
  const looks = [...new Set(F.outputs.map(x => x.look))];
  const table = `<table><thead><tr><th>Look</th>${[...new Set(F.outputs.map(x => x.clip))].map(c => `<th>${esc(c)}</th>`).join('')}</tr></thead><tbody>${looks.map(l => `<tr><td>${esc(runs.find(r => r.look === l)?.name ?? l)}</td>${[...new Set(F.outputs.map(x => x.clip))].map(c => { const x = F.outputs.find(y => y.look === l && y.clip === c); return `<td>${x ? x.mean.toFixed(1) : '-'}</td>`; }).join('')}</tr>`).join('')}${F.refs.map(r => `<tr class="refrow"><td>${esc(ref(r.id).name)}</td><td colspan="9">${r.mean.toFixed(1)}</td></tr>`).join('')}</tbody></table>`;
  const props = F.proposals.map(p => `<li><b>${esc(p.id)}</b> ${esc(p.miss)}<br><code>${esc(p.where)}</code> · ${esc(p.field)}: now <b>${esc(p.current)}</b><ul>${p.options.map(x => `<li>${esc(x)}</li>`).join('')}</ul></li>`).join('');
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Edit round 1</title>
<style>
:root{--bg:#F7FAFD;--ink:#0E1620;--mute:#5B6B7A;--line:#DCE7F1;--ice:#CFE6F7;--card:#FFFFFF}
@media (prefers-color-scheme:dark){:root:not([data-theme="light"]){--bg:#0B1118;--ink:#EAF2F9;--mute:#8FA2B4;--line:#1E2A36;--ice:#2A4A63;--card:#111A23}}
:root[data-theme="dark"]{--bg:#0B1118;--ink:#EAF2F9;--mute:#8FA2B4;--line:#1E2A36;--ice:#2A4A63;--card:#111A23}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font:15px/1.55 system-ui,-apple-system,"Segoe UI",sans-serif}
main{max-width:1180px;margin:0 auto;padding:32px 16px 80px}h1{font-size:30px;margin:0 0 4px;letter-spacing:-.01em}h2{margin:40px 0 12px;font-size:20px}
.lede{color:var(--mute);max-width:72ch}table{border-collapse:collapse;margin:8px 0;min-width:320px}td,th{border-bottom:1px solid var(--line);padding:6px 14px 6px 0;text-align:left}.refrow td{color:var(--mute)}
.card{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:18px;margin:18px 0}.card header{display:flex;justify-content:space-between;align-items:baseline}.card h3{margin:0;font-size:19px}
.score{font-size:26px;font-weight:700}.meta,.why,.rub{color:var(--mute);margin:4px 0;font-size:13.5px}.why{font-style:italic}
.sheet{display:block;width:100%;height:auto;border-radius:8px;margin:10px 0;background:var(--line)}
.miss{padding-left:20px}.miss li{margin:6px 0}.t{font-variant-numeric:tabular-nums;font-weight:600;background:var(--ice);border-radius:6px;padding:0 6px;margin-right:4px}.pt{color:var(--mute);font-size:13px}
.ref{border-top:1px dashed var(--line);margin-top:10px;padding-top:6px;font-size:13.5px}a{color:inherit}code{font-size:12.5px;background:var(--ice);padding:1px 5px;border-radius:5px;word-break:break-word}
.props>li{margin:14px 0}.scroll{overflow-x:auto}.takes td{vertical-align:top;font-size:13.5px;min-width:140px}.strings li{margin:6px 0}
.notes li{color:var(--mute)}
</style></head><body><main>
<h1>Edit my video, round 1</h1>
<p class="lede">Your own footage, edited with each of the Edit type's five looks and the auto-pick, exactly as the studio runs it (planEdit at main ${esc(F.commit)}, ${esc(F.date)}). A blind judge scored every output and the reference edits in one round without knowing which is which (${esc(F.judge.rubric.join(', '))}, 1–10). Nothing here changes a look yet: the proposals at the end are yours to pick.</p>
<h2>Scores</h2>${table}
<p class="lede">${esc(F.judge.note)}</p>
${F.takes ? `<h2>Retakes</h2><p class="lede">${esc(F.takes.made)}</p><p class="lede"><b>${esc(F.takes.found)}</b></p>
<div class="scroll"><table class="takes"><thead><tr><th>Line</th><th>Takes</th><th>Kept</th><th>Blind take judge</th><th>Kept once the bug is fixed</th><th>Why</th></tr></thead><tbody>${F.takes.rows.map(r => `<tr><td>${esc(r.line)}</td><td>${esc(r.takes)}</td><td>${esc(r.kept)}</td><td>${esc(r.judge)}</td><td>${esc(r.with_fix)}</td><td>${esc(r.cause)}</td></tr>`).join('')}</tbody></table></div>
<p class="lede">${esc(F.takes.confidence)}</p>` : ''}
${F.strings?.length ? `<h2>New wording for your yes</h2><p class="lede">What Moovi says about takes (it is shown in chat as is; nothing changes until you say so).</p><ul class="strings">${F.strings.map(s => `<li><q>${esc(s.text)}</q> <span class="pt">${esc(s.where)}</span></li>`).join('')}</ul>` : ''}
<h2>Each output</h2>${F.outputs.slice().sort((a, b) => b.mean - a.mean).map(card).join('\n')}
<h2>Proposed changes (not applied)</h2><ol class="props">${props}</ol>
<h2>Notes</h2><ul class="notes">${F.notes.map(n => `<li>${esc(n)}</li>`).join('')}<li>Graph: ${esc(F.graph)}</li>${o.artifact ? '<li>Reference frames are not on this page (reference media stays local); open the Instagram links, or the committed page from your checkout, which shows them from data/edit-round1/refs/.</li>' : '<li>Reference frames load from data/edit-round1/refs/ in your checkout (git-ignored); live previews need <code>edit-round1.ts serve</code> running.</li>'}</ul>
</main></body></html>`;
}
