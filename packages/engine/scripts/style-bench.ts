// tsx scripts/style-bench.ts <s1|s4|s5|darkvox|anatomy> <https://site> [--only cli|job] [--first job]
// The same style, the same URL, two ways, one after the other (never at once: this machine has 4 cores):
//   cli  the terminal script as a child process (scripts/s1url.ts, s4.ts, s5.ts, darkvox.ts), timings from its TIMINGS line
//   job  the studio's path: sign in to the local studio's API with the test account, new project + chat, a brief with
//        the style (exactly what the brief box sends), the engine worker runs the style-reel job; timings from the run
// Prints both timing tables side by side and writes data/bench/style-<style>-<host>-<time>.json.
// Needs the studio (pnpm --dir apps/studio dev) and the worker (pnpm dev:engine) for the job half.
import { execFileSync, spawn } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { history } from '../src/bus';
import { config } from '../src/config';
import { styleOf, type StyleId } from '../src/styles';
import { hostSlug, TSX } from '../src/styles/common';
import { table } from '../src/styles/run';

const args = process.argv.slice(2), opt = (k: string) => { const i = args.indexOf(`--${k}`); return i >= 0 ? args[i + 1] : undefined; };
const [style, url] = args as [StyleId, string];
if (!styleOf(style) || !url) throw new Error('usage: style-bench <s1|s4|s5|darkvox|anatomy> <https://site> [--only cli|job] [--first job]');
const only = opt('only'), jobFirst = opt('first') === 'job';
const base = process.env.STUDIO_URL ?? 'http://localhost:3100';

/** tsx runs the script in a child of its own: stop the whole tree (the preview server lives in it). */
const stop = (pid?: number) => { if (!pid) return; try { if (process.platform === 'win32') execFileSync('taskkill', ['/pid', String(pid), '/T', '/F'], { stdio: 'ignore' }); else process.kill(pid); } catch { /* already gone */ } };

/** The terminal script, as a child process; resolves its timing table, then stops its preview server. */
function cli(): Promise<{ timings: Record<string, number>; wall: number }> {
  const script = ({ s1: 's1url.ts', s4: 's4.ts', s5: 's5.ts', darkvox: 'darkvox.ts', anatomy: 'anatomy.ts', launch: 'launch.ts', combined: 'combined.ts', 'clip-moment': 'clip-moment.ts' } satisfies Record<StyleId, string>)[style];
  const a = style === 's1' ? [url] : ['--url', url];
  const t0 = Date.now();
  return new Promise((res, rej) => {
    const p = spawn(process.execPath, ['--env-file-if-exists=../../.env.local', TSX, join('scripts', script), ...a], { cwd: join(import.meta.dirname, '..'), env: { ...process.env, PREVIEW_PORT: '0' }, stdio: ['ignore', 'pipe', 'inherit'], windowsHide: true });
    let buf = '';
    p.stdout.on('data', (d: Buffer) => {
      process.stdout.write(d); buf += d.toString();
      const m = /^TIMINGS (\{.*\})$/m.exec(buf);
      if (m) { const timings = JSON.parse(m[1]!) as Record<string, number>; stop(p.pid); res({ timings, wall: +((Date.now() - t0) / 1000).toFixed(1) }); }
    });
    p.on('exit', code => rej(new Error(`the ${script} run ended (${code}) without a timing table`)));
  });
}

/** The studio's path: the HTTP API the brief box uses → command → worker → style-reel job. */
async function job(): Promise<{ timings: Record<string, number>; wall: number; office: string; ui: { previewReady: number | null } }> {
  const acct = readFileSync(join(config.data, 'checks', 'studio-test-account.txt'), 'utf8');
  const email = acct.match(/email: (.+)/)![1]!.trim(), password = acct.match(/password: (.+)/)![1]!.trim();
  let cookie = '';
  const call = async <T>(path: string, init: RequestInit = {}): Promise<T> => {
    const r = await fetch(`${base}/studio/api${path}`, { ...init, headers: { origin: base, cookie, ...(init.headers ?? {}) } });
    const set = r.headers.get('set-cookie'); if (set) cookie = set.split(';')[0]!;
    const j = await r.json().catch(() => ({})) as T & { error?: string };
    if (!r.ok) throw new Error(`${path}: ${r.status} ${j.error ?? ''}`);
    return j;
  };
  const json = (b: unknown) => ({ method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(b) });
  await call('/auth/signin', json({ email, password }));
  const { project, chat } = await call<{ project: { id: string }; chat: { id: string } }>('/projects', json({}));
  const t0 = Date.now();
  await call(`/projects/${project.id}/chats/${chat.id}/messages`, json({ kind: 'brief', text: '', style: { id: style, url } }));
  const office = `${base}/studio/p/${project.id}/c/${chat.id}`;
  console.log(`job: ${office}`);
  let previewReady: number | null = null;
  for (;;) {
    await new Promise(r => setTimeout(r, 2000));
    const ev = await history(chat.id);
    const v = ev.find(e => e.type === 'video' && e.video.status === 'ready');
    if (v && previewReady === null) previewReady = +((v.at - t0) / 1000).toFixed(1);
    const end = ev.find(e => e.type === 'run' && ['done', 'failed', 'cancelled'].includes(e.run.status));
    if (end && end.type === 'run' && end.run.status !== 'done') throw new Error(`the job's run ${end.run.status}: see ${office}`);
    if (end) {
      const ref = await call<{ timings: Record<string, number> }>(`/projects/${project.id}/preview/${chat.id}/1/ref.json`);
      return { timings: ref.timings, wall: +((Date.now() - t0) / 1000).toFixed(1), office, ui: { previewReady } };
    }
    if (Date.now() - t0 > 15 * 60_000) throw new Error('the job took over 15 minutes');
  }
}

const out: Record<string, unknown> = { style, url, at: new Date().toISOString() };
const cols: Record<string, Record<string, number>> = {};
const order = jobFirst ? (['job', 'cli'] as const) : (['cli', 'job'] as const);
for (const k of order) {
  if (only && only !== k) continue;
  console.log(`\n── ${k} ──`);
  const r = k === 'cli' ? await cli() : await job();
  cols[k] = r.timings; out[k] = r;
}
console.log(`\n${style} · ${url}\n${table(cols)}`);
if (cols.cli && cols.job) {
  const keys = Object.keys(cols.cli).filter(k => cols.job![k] !== undefined);
  console.log(`\ndelta (job − cli): ${keys.map(k => `${k} ${(cols.job![k]! - cols.cli![k]!).toFixed(1)}s`).join(' · ')}`);
}
mkdirSync(join(config.data, 'bench'), { recursive: true });
const f = join(config.data, 'bench', `style-${style}-${hostSlug(url)}-${Date.now()}.json`);
writeFileSync(f, JSON.stringify(out, null, 1));
console.log(`\nwrote ${f}`);
if (existsSync(f)) process.exit(0);
