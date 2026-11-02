#!/usr/bin/env node
// preflight.mjs: the speed lab's gate. Fails BEFORE time is spent, never after. No dependencies except Node 24
// (and playwright-core from the repo for `probe`). Read PREFLIGHT.md for what each check is for.
//
//   node docs/agents/speed/preflight.mjs check <filmDir> [stage=plan|build|export] [format=short|long] [mins=<film minutes>]
//   node docs/agents/speed/preflight.mjs ack <filmDir>          after reading the newest rules it printed
//   node docs/agents/speed/preflight.mjs gpu take <filmDir>     before any export or batch capture (one GPU owner)
//   node docs/agents/speed/preflight.mjs gpu free               after it
//   node docs/agents/speed/preflight.mjs probe <page.html|url> secs=<film seconds> [fps=30] [from=<s>]
//
// Exit code 0 = go, 1 = a FAIL line (fix it first), 2 = usage error. WARN lines never block.
import { readFileSync, writeFileSync, existsSync, statSync, readdirSync, statfsSync, unlinkSync, appendFileSync } from 'node:fs';
import { join, resolve, basename } from 'node:path';
import { homedir, freemem, totalmem, tmpdir, cpus } from 'node:os';
import { execSync } from 'node:child_process';

const SKILL = join(homedir(), '.claude', 'skills', 'ishaan-motion');
const GLOBAL_RULES = join(homedir(), '.claude', 'CLAUDE.md');
const LOCK = join(tmpdir(), 'moovi-gpu.lock');
const args = process.argv.slice(2), cmd = args[0];
const kv = Object.fromEntries(args.filter(a => a.includes('=')).map(a => a.split(/=(.*)/s).slice(0, 2)));
const out = [], fails = [];
let FILM = args[1] ? resolve(args[1]) : '';
const ok = m => out.push('  ok    ' + m), warn = m => out.push('  WARN  ' + m), fail = m => { out.push('  FAIL  ' + m); fails.push(m); };
const ver = s => s.split('.').map(Number), newer = (a, b) => { const x = ver(a), y = ver(b); for (let i = 0; i < 3; i++) if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) > (y[i] || 0); return false; };
const read = f => { try { return readFileSync(f, 'utf8'); } catch { return ''; } };
const findAny = (dir, names) => names.find(n => existsSync(join(dir, n)));
const filesIn = (dir, re) => { try { return readdirSync(dir).filter(f => re.test(f)); } catch { return []; } };
const ps = () => { try { return execSync('powershell -NoProfile -Command "Get-CimInstance Win32_Process | ForEach-Object { $_.Name + \'|\' + $_.CommandLine }"', { encoding: 'utf8', timeout: 20000 }); } catch { return ''; } };

// a lease, not a pid lock (pids are unreliable under Git Bash): it lasts until `gpu free` or 4 h, and only its own film can re-take it
function lockInfo() { try { const l = JSON.parse(readFileSync(LOCK, 'utf8')); return Date.now() - Date.parse(l.at) > 4 * 3600e3 ? { ...l, stale: true } : l; } catch { return null; } }

// ---------- machine: disk, RAM, other GPU users ----------
function machine(stage) {
  const s = statfsSync('C:/'), freeGB = s.bavail * s.bsize / 1e9;
  if (freeGB < 10) fail(`C: has ${freeGB.toFixed(1)} GB free (needs 10+; a full disk crashed exports twice). CHECKLIST-PC.md step 2`);
  else if (freeGB < 25) warn(`C: has ${freeGB.toFixed(1)} GB free (25+ is comfortable for a long-form export)`); else ok(`disk ${freeGB.toFixed(0)} GB free`);
  const ramGB = freemem() / 1e9;
  if (ramGB < 1.5) fail(`only ${ramGB.toFixed(1)} GB RAM free of ${(totalmem() / 1e9).toFixed(0)}: close a session or Docker first (CHECKLIST-PC.md step 3)`);
  else if (ramGB < 3) warn(`${ramGB.toFixed(1)} GB RAM free; a capture page needs about 1-1.5 GB`); else ok(`RAM ${ramGB.toFixed(1)} GB free, ${cpus().length} threads`);
  const list = ps();
  if (/vmmem/i.test(list)) warn('Docker/WSL (vmmem) is running and holds RAM; stop it unless FalkorDB is needed now');
  const exporters = list.split(/\r?\n/).filter(l => /^node\.exe\|.*(export|bench-export|render)[^|]*\.(m?js|cjs)/i.test(l) || /^blender\.exe\|.*-b /i.test(l));
  const l = lockInfo();
  if (l && !l.stale && l.film !== FILM) (stage === 'export' ? fail : warn)(`GPU is leased to ${l.film} since ${l.at}; renders now run up to 2x slower (measured 224 vs 417 ms a frame under load). Queue behind it`);
  else if (l && !l.stale) ok(`GPU leased to this film since ${l.at}`);
  else if (exporters.length) warn(`${exporters.length} export/render process(es) already running: ${exporters.map(e => e.split('|')[1].slice(-70)).join(' ; ')}`);
  else ok('no other export holds the GPU');
}

// ---------- rules: the newest skill entries must be read before building ----------
function rules(dir) {
  const v = read(join(SKILL, 'VERSION')).trim(), stamp = (() => { try { return JSON.parse(read(join(dir, '.preflight.json'))); } catch { return {}; } })();
  if (!v) return warn('ishaan-motion skill not found at ' + SKILL);
  const log = read(join(SKILL, 'CHANGELOG.md')).split(/\r?\n/).filter(x => /^- \d+\.\d+\.\d+/.test(x));
  const unseen = log.filter(x => !stamp.skill || newer(x.match(/^- ([\d.]+)/)[1], stamp.skill));
  const gm = existsSync(GLOBAL_RULES) ? statSync(GLOBAL_RULES).mtimeMs : 0;
  const globalChanged = !stamp.at || gm > Date.parse(stamp.at);
  if (!unseen.length && !globalChanged) return ok(`rules read: ishaan-motion ${v}, ~/.claude/CLAUDE.md unchanged since ${stamp.at}`);
  fail(`rules changed since this film last read them (skill ${stamp.skill || 'never'} -> ${v}${globalChanged ? ', ~/.claude/CLAUDE.md edited' : ''}). Read these, then run: preflight.mjs ack ${dir}`);
  for (const x of unseen.slice(0, stamp.skill ? 40 : 15)) out.push('        ' + x.slice(0, 260));
  if (!stamp.skill && log.length > 15) out.push(`        (+${log.length - 15} older entries: read SKILL.md and the references the brief names)`);
  if (globalChanged) out.push('        ~/.claude/CLAUDE.md: re-read it whole');
}

// ---------- film folder: the order that prevents rework ----------
function film(dir, stage, format, mins) {
  const has = (...n) => findAny(dir, n);
  const t = read(join(dir, 'TIMINGS.md'));
  if (!t) fail('no TIMINGS.md: write the estimate per stage BEFORE starting (node docs/agents/speed/tlog.mjs start ...)');
  else if (!/estimate/i.test(t)) fail('TIMINGS.md has no Estimate column'); else ok('TIMINGS.md with estimates');
  if (mins) out.push(`  info  budget: 60 min wall for any length (PLAN.md section 3). ${mins > 3 ? `A ${mins}-min film fits only with scenes built in parallel and exported as each passes; run \`probe\` now to see if this PC's render fits (heavy 3D: 6-23 s of render per film second measured)` : ''}`);
  const script = has('script.md', 'SCRIPT.md', 'script.js', 'SCRIPT-v4.md') || filesIn(dir, /^script.*\.(md|js)$/i)[0];
  if (!script) (stage === 'plan' ? warn : fail)('no approved script file (script.md): Ishaan approves the script before any build');
  if (stage === 'plan') return;
  const look = has('LOOK.md', 'look.lock', 'kit.js', 'palette.js', 'kit', 'src/kit') || ['..', '../..'].map(p => existsSync(join(dir, p, 'kit')) && p + '/kit').find(Boolean);
  look ? ok(`look/kit locked: ${look}`) : fail('no locked look or kit (LOOK.md / kit/): lock the look on the real hero from rendered options BEFORE builders start (mid-build look changes cost every builder a round)');
  const voice = has('timing.js', 'words.json', 'lines.json', 'src/words.json') || (existsSync(join(dir, 'audio')) && 'audio/') || (existsSync(join(dir, 'vo')) && 'vo/');
  voice ? ok(`voice/timing first: ${voice}`) : fail('no voice timing (timing.js / words.json): voice and sound come FIRST; shots are keyed to words');
  const contract = has('CONTRACT.md', 'BRIEF.md', 'SHOTS.md', 'shots.js', 'BEATS.md');
  contract ? ok(`contract/shot list: ${contract}`) : fail('no CONTRACT.md / BRIEF.md shot list: every builder needs the band, format, banned list and shared models on minute one');
  // "simple, nailed": staging the rig cannot nail is the measured cause of clip 3's six judge rounds
  const text = [contract, script].filter(Boolean).map(f => read(join(dir, f))).join('\n');
  const banned = /\b(hang(s|ing)? (from|by)|climb(s|ing)? (up|onto|over|a|the)|lift(s|ing)? (him|her|them|a person)|reach(es|ing)? across|crowd of|hundreds of people|stampede|vast)\b/gi;
  const hits = [...new Set((text.match(banned) || []).map(s => s.toLowerCase()))];
  hits.length ? warn(`staging the rig may not nail (RULES-8 B, "simple, nailed"): ${hits.join(', ')}`) : ok('no banned staging words in the shot list/script');
  if (format === 'short' && !/safe/i.test(text)) warn('Short: the contract does not mention the safe area (y 230-1480, x 70-905)');
  const html = filesIn(dir, /\.html$/i).map(f => read(join(dir, f))).join('\n');
  if (html && !/(\.\.\/)+(kit|studio)|kit\//.test(html)) warn('pages load no shared kit: a film built from scratch took 68 min vs 17 min with the kit reused (measured)');
}

if (cmd === 'check' && args[1]) {
  const dir = resolve(args[1]), stage = kv.stage || 'build', format = kv.format || 'long', mins = +(kv.mins || 0);
  if (!existsSync(dir)) { console.log('no such folder', dir); process.exit(2); }
  const t0 = Date.now();
  out.push(`PREFLIGHT ${basename(dir)} stage=${stage} format=${format} ${new Date().toISOString()}`);
  out.push(' machine'); machine(stage);
  out.push(' rules'); rules(dir);
  out.push(' film'); film(dir, stage, format, mins);
  out.push(`${fails.length ? 'STOP: ' + fails.length + ' FAIL' : 'GO'} (${((Date.now() - t0) / 1000).toFixed(1)} s)`);
  console.log(out.join('\n'));
  if (kv.nolog !== '1') try { appendFileSync(join(dir, 'PREFLIGHT.log'), out.join('\n') + '\n\n'); } catch {}
  process.exit(fails.length ? 1 : 0);
} else if (cmd === 'ack' && args[1]) {
  const dir = resolve(args[1]), v = read(join(SKILL, 'VERSION')).trim();
  writeFileSync(join(dir, '.preflight.json'), JSON.stringify({ skill: v, at: new Date().toISOString() }, null, 1));
  console.log(`acknowledged ishaan-motion ${v} for ${basename(dir)}`);
} else if (cmd === 'gpu' && args[1] === 'take') {
  const l = lockInfo(), film = args[2] ? resolve(args[2]) : 'unknown';
  if (l && !l.stale && l.film !== film) { console.log(`BUSY: GPU leased to ${l.film} since ${l.at}. Wait, or ask that session.`); process.exit(1); }
  writeFileSync(LOCK, JSON.stringify({ film, at: new Date().toISOString() }));
  console.log('GPU leased; run `preflight.mjs gpu free` when the export ends');
} else if (cmd === 'gpu' && args[1] === 'free') {
  try { unlinkSync(LOCK); } catch {} console.log('GPU free');
} else if (cmd === 'probe' && args[1]) {
  // measures load and ms per frame with 1 and 3 tabs on the real page, then projects the export and picks the tab count
  const { createRequire } = await import('node:module'); const { pathToFileURL } = await import('node:url');
  const require = createRequire(resolve('package.json'));
  let pw; try { pw = require('playwright-core'); } catch { pw = require(join(process.cwd(), 'node_modules/.pnpm/playwright-core@1.56.1/node_modules/playwright-core')); }
  const url = /^https?:/.test(args[1]) ? args[1] : pathToFileURL(resolve(args[1])).href, fps = +(kv.fps || 30), secs = +(kv.secs || 60), from = +(kv.from || 1), N = 30;
  const browser = await pw.chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
    args: ['--enable-gpu', '--ignore-gpu-blocklist', '--use-angle=d3d11', '--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows'] });
  const grab = (p, t) => p.evaluate(t => window.frameB64 ? window.frameB64(t).length : (window.seek(t), document.getElementById('cv').toDataURL('image/jpeg', 0.94).length), t);
  const open = async () => { const p = await (await browser.newContext({ viewport: { width: 1000, height: 600 } })).newPage();
    await p.goto(url + (url.includes('?') ? '&' : '?') + 'embed=1', { waitUntil: 'load', timeout: 400000 }); await p.waitForFunction(() => window.__ready === true, null, { timeout: 400000 }); await grab(p, from); return p; };
  const res = {};
  for (const tabs of [1, 3]) {
    const t0 = Date.now(); const pages = await Promise.all(Array.from({ length: tabs }, open)); const load = (Date.now() - t0) / 1000;
    const t1 = Date.now(); await Promise.all(pages.map(async (p, i) => { for (let f = 0; f < N; f++) await grab(p, from + (i * N + f) / fps); }));
    const ms = (Date.now() - t1) / (N * tabs); res[tabs] = { load, ms };
    for (const p of pages) await p.context().close();
  }
  await browser.close();
  const best = res[3].ms < res[1].ms * 0.85 ? 3 : 1, frames = secs * fps, mins = (res[best].load + frames * res[best].ms / 1000) / 60;
  console.log(JSON.stringify({ msPerFrame_1tab: Math.round(res[1].ms), msPerFrame_3tabs: Math.round(res[3].ms), load_s: Math.round(res[best].load), use_tabs: best, projected_export_min: +mins.toFixed(1), frames }));
  if (mins > 20) console.log(`WARN: the export alone takes ${mins.toFixed(0)} min on this PC: export each scene the moment it passes (PLAN.md section 4), or use the cloud GPU option`);
} else {
  console.log(readFileSync(new URL(import.meta.url), 'utf8').split('\n').slice(1, 12).join('\n')); process.exit(2);
}
