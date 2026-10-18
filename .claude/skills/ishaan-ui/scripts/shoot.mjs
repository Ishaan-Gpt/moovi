#!/usr/bin/env node
// Ishaan UI — headless screenshots of a running site, including scroll-driven states.
//
// Drives a local Chrome/Edge over the DevTools protocol (no puppeteer/playwright install needed; Node 22+
// for the built-in WebSocket). Use it to verify loaders, scroll-scrubbed sections and phone layouts when a
// visible browser isn't available, or to capture a reference site's sections.
//
// Usage:
//   node shoot.mjs <url> <outDir> [--size 1440x900] [--wait 4000] [--shots '<json>'] [--browser <path>]
//
// --shots is a JSON array of [label, scrollExpression|null, waitMs]. The expression runs in the page, e.g.
//   '[["hero",null,6000],["story-40","scrollTo(0, innerHeight*1.6)",2200],["pricing","document.querySelector(\"#pricing\").scrollIntoView()",1500]]'
// Without --shots it takes one shot after --wait.
//
// It prints the page's frames-per-second (rAF rate over 1.5s) and any console errors / uncaught exceptions,
// so a broken page shows up even if the screenshot looks fine.
//
// Notes
// - Scroll-scrubbed sections lag the scroll a little (smooth scroll + scrub): wait ~2s after each scroll.
// - Sticky sections are measured in viewport heights; use a real viewport size, not a tall full-page capture.
// - Width < 600 also turns on mobile emulation (touch, mobile UA-dependent CSS).
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';

const args = process.argv.slice(2);
const opt = (name, d) => { const i = args.indexOf(`--${name}`); return i >= 0 ? args[i + 1] : d; };
const [url, outArg] = args.filter((a, i) => !a.startsWith('--') && !args[i - 1]?.startsWith('--'));
if (!url || !outArg) { console.error('usage: node shoot.mjs <url> <outDir> [--size WxH] [--wait ms] [--shots json] [--browser path]'); process.exit(1); }
const outDir = resolve(outArg);
const [W, H] = opt('size', '1440x900').split('x').map(Number);
const shots = JSON.parse(opt('shots', 'null') ?? 'null') ?? [['shot', null, 0]];
const firstWait = Number(opt('wait', '4000'));

const candidates = [
  opt('browser'),
  process.env.CHROME_PATH,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser',
].filter(Boolean);
const browser = candidates.find(p => existsSync(p));
if (!browser) { console.error('No Chrome/Edge found; pass --browser <path> or set CHROME_PATH.'); process.exit(1); }

mkdirSync(outDir, { recursive: true });
const profile = join(tmpdir(), `ishaan-ui-shoot-${process.pid}`);
const port = 9300 + Math.floor(Math.random() * 600);
const proc = spawn(browser, [
  '--headless=new', `--remote-debugging-port=${port}`, `--window-size=${W},${H}`, '--enable-gpu', '--ignore-gpu-blocklist',
  // on Windows, use the same D3D11 backend real Chrome uses (headless otherwise falls back to slow software GL)
  ...(process.platform === 'win32' ? ['--use-angle=d3d11'] : []),
  '--no-first-run', '--no-default-browser-check', '--hide-scrollbars', `--user-data-dir=${profile}`, 'about:blank',
], { stdio: 'ignore' });
const sleep = ms => new Promise(r => setTimeout(r, ms));

let ws;
for (let i = 0; i < 60 && !ws; i++) {
  try {
    const page = (await (await fetch(`http://127.0.0.1:${port}/json`)).json()).find(t => t.type === 'page');
    if (page) ws = new WebSocket(page.webSocketDebuggerUrl);
  } catch { /* not up yet */ }
  if (!ws) await sleep(200);
}
if (!ws) { console.error('Could not reach the browser.'); proc.kill(); process.exit(1); }
await new Promise(r => ws.addEventListener('open', r));

let id = 0; const pending = new Map(); const problems = [];
ws.addEventListener('message', e => {
  const m = JSON.parse(e.data);
  if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
  if (m.method === 'Runtime.exceptionThrown') problems.push(`exception: ${(m.params.exceptionDetails.exception?.description ?? m.params.exceptionDetails.text).slice(0, 300)}`);
  if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') problems.push(`console.error: ${m.params.args.map(a => a.value ?? a.description).join(' ').slice(0, 300)}`);
});
const send = (method, params = {}) => new Promise(r => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });

await send('Runtime.enable');
await send('Page.enable');
await send('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: 1, mobile: W < 600 });
if (W < 600) await send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
await send('Page.navigate', { url });
await sleep(firstWait);

for (const [label, expr, wait] of shots) {
  if (expr) await send('Runtime.evaluate', { expression: expr, awaitPromise: true });
  await sleep(wait ?? 0);
  const r = await send('Page.captureScreenshot', { format: 'jpeg', quality: 80 });
  const file = join(outDir, `${label}-${W}x${H}.jpg`);
  writeFileSync(file, Buffer.from(r.result.data, 'base64'));
  console.log('saved', file);
}

const fps = await send('Runtime.evaluate', {
  expression: 'new Promise(r=>{let n=0,t=performance.now();const f=()=>{n++;performance.now()-t<1500?requestAnimationFrame(f):r(Math.round(n/1.5))};requestAnimationFrame(f)})',
  awaitPromise: true,
});
console.log('frames per second (headless, indicative only):', fps.result?.result?.value);
console.log(problems.length ? `problems:\n- ${problems.slice(0, 20).join('\n- ')}` : 'no console errors or exceptions');
ws.close(); proc.kill();
await sleep(300);
try { rmSync(profile, { recursive: true, force: true }); } catch { /* browser may still hold files */ }
process.exit(0);
