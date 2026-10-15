// tsx scripts/studio-stop-ui.ts <style> <https://site> [stage] : Stop through the real UI. Signs in, starts a style reel
// from the brief box, waits until <stage> (default: the brief, i.e. right after the first stage) is running, presses
// Stop in the composer, then checks the chat says so, the run's task is cancelled, and the worker has no child process
// left from it (voice python, s1make, the model CLI). Writes data/studio-proof/stop.json + stop.png. Local only.
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { chromium } from 'playwright-core';
import { config } from '../src/config';
import { styleOf, type StyleId } from '../src/styles';

const [style, url, stage = 'brief'] = process.argv.slice(2) as [StyleId, string, string?];
const info = styleOf(style);
if (!info || !url) throw new Error('usage: studio-stop-ui <s1|s4|s5|darkvox|anatomy> <https://site> [stage]');
const acct = readFileSync(join(config.data, 'checks', 'studio-test-account.txt'), 'utf8');
const email = acct.match(/email: (.+)/)![1]!.trim(), password = acct.match(/password: (.+)/)![1]!.trim();
const base = process.env.STUDIO_URL ?? 'http://localhost:3100';
const out = join(config.data, 'studio-proof'); mkdirSync(out, { recursive: true });

/** the engine worker's process tree (Windows): every descendant's pid and command line */
function workerTree(): { pid: number; cmd: string }[] {
  const ps = `$all = Get-CimInstance Win32_Process | Select-Object ProcessId,ParentProcessId,CommandLine; $w = $all | Where-Object { $_.CommandLine -like '*studio-styles*' -and $_.CommandLine -like '*scripts/worker.ts*' -and $_.CommandLine -notlike '*pnpm*' }; $ids = @($w | ForEach-Object { $_.ProcessId }); $out = @(); do { $kids = @($all | Where-Object { $ids -contains $_.ParentProcessId -and -not ($out.ProcessId -contains $_.ProcessId) }); $out += $kids; $ids = @($kids | ForEach-Object { $_.ProcessId }) } while ($kids.Count); $out | ForEach-Object { "$($_.ProcessId)|$($_.CommandLine)" }`;
  return execFileSync('powershell', ['-NoProfile', '-Command', ps], { encoding: 'utf8' }).split(/\r?\n/).filter(Boolean).map(l => { const i = l.indexOf('|'); return { pid: Number(l.slice(0, i)), cmd: l.slice(i + 1) }; });
}
const children = <T extends { cmd: string }>(t: T[]) => t.filter(p => !/esbuild.exe/i.test(p.cmd)); // tsx keeps one esbuild service for the worker's whole life

const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' })).newPage();
await page.goto(`${base}/studio/auth`, { waitUntil: 'networkidle', timeout: 120_000 });
await page.waitForTimeout(1000);
await page.fill('input[type=email]', email);
await page.fill('input[type=password]', password);
await page.click('button.door__go');
await page.waitForURL(u => !u.pathname.endsWith('/auth'), { timeout: 180_000, waitUntil: 'commit' });
await page.goto(`${base}/studio`, { waitUntil: 'networkidle', timeout: 120_000 });
await page.waitForTimeout(800);
await page.click('button.card--new');
await page.waitForURL(/\/studio\/p\/[^/]+\/c\//, { timeout: 120_000 });
await page.waitForSelector('.nb__styles', { timeout: 120_000 });
await page.waitForTimeout(800);
await page.getByRole('radio', { name: new RegExp(info.name) }).click();
await page.fill('input.nb__url', url);
await page.addStyleTag({ content: 'canvas{display:none!important}*{backdrop-filter:none!important;animation-play-state:paused!important}' }); // see studio-style-ui
await page.click('button.nb__send');
const t0 = Date.now();
console.log(`sent ${info.name} for ${url} → ${page.url()}`);
// the stage is running: the worker has started it (its log line is the only place the start is exact) …
const log = join(config.data, 'worker.log'), size0 = readFileSync(log, 'utf8').length;
const prev = stage === 'brief' ? '(site|fetch)' : ({ voice: 'brief', audio: 'plan' } as Record<string, string>)[stage] ?? stage;
const startedRe = new RegExp(String.raw`\] ${prev} [\d.]+s`);
while (!startedRe.test(readFileSync(log, 'utf8').slice(size0))) { if (Date.now() - t0 > 600_000) throw new Error('the stage never started'); await page.waitForTimeout(500); }
await page.waitForTimeout(stage === 'brief' ? 4000 : 6000); // well inside the stage (the model call / the voice process is up)
const before = children(workerTree());
console.log(`${stage} running at ${((Date.now() - t0) / 1000).toFixed(1)}s; worker children: ${before.map(p => `${p.pid} ${p.cmd.slice(0, 80)}`).join(' || ') || 'none'}`);
const tStop = Date.now();
await page.click('button.composer__stop');
await page.waitForFunction(() => /Stopped/.test(document.body.innerText), null, { timeout: 60_000, polling: 500 });
const said = ((Date.now() - tStop) / 1000).toFixed(1);
await page.waitForTimeout(5000); // taskkill /T and the CLI's own exit
const after = children(workerTree()), lines = readFileSync(log, 'utf8').slice(size0).split(/\r?\n/).filter(l => /cancelled|stopped|reel/i.test(l)).slice(-6);
await page.screenshot({ path: join(out, 'stop.png') });
const chat = await page.evaluate(() => document.body.innerText.split('\n').filter(l => /Stopped|stopped|cancel/i.test(l)).slice(0, 5));
const res = { style, url, stage, stoppedAfter: +((tStop - t0) / 1000).toFixed(1), chatSaidStoppedIn: +said, before: before.map(p => p.cmd.slice(0, 160)), after: after.map(p => p.cmd.slice(0, 160)), worker: lines, chat };
console.log(JSON.stringify(res, null, 1));
writeFileSync(join(out, 'stop.json'), JSON.stringify(res, null, 1));
await browser.close();
