// pnpm s1:fast <dir> [--brand captionseasy] [--brief "..."] [--no-qa] [--plan-only]
// <dir> holds vo.wav + words.json (the voice and its word timings). Plans the video with the fast planner, builds it
// with the exact s1kit copy, checks it with the owner's QA, then renders, mixes and masters (s1make). Every stage timed.
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';
import { closeRender } from '../src/render/host';
import { makePlan } from '../src/s1fast/make';
import { motionEasyDir } from '../src/s1fast/planner';
import { servePreview } from '../src/s1fast/preview';

const args = process.argv.slice(2), flag = (k: string) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : undefined; };
const dir = resolve(args.find(a => !a.startsWith('--') && !['--brand', '--brief'].includes(args[args.indexOf(a) - 1] ?? '')) ?? '');
const id = basename(dir), brand = flag('--brand') ?? 'captionseasy';
const words = JSON.parse(readFileSync(join(dir, 'words.json'), 'utf8'));
const t0 = Date.now(), sec = (ms: number) => `${(ms / 1000).toFixed(1)}s`;

const { times } = await makePlan({ dir, id, brand, words, brief: flag('--brief'), qa: !args.includes('--no-qa'), resume: args.includes('--resume') });
await closeRender();
const planMs = Date.now() - t0;
let renderMs = 0;
// Default is PREVIEW: mix the audio and open the live player. A frame-by-frame MP4 only with --render (owner rule).
if (!args.includes('--plan-only')) {
  const tr = Date.now();
  execFileSync(process.execPath, [join(import.meta.dirname, '..', 'node_modules', 'tsx', 'dist', 'cli.mjs'), join(import.meta.dirname, 's1make.ts'), dir, ...(args.includes('--render') ? [] : ['--audio-only'])], { stdio: 'inherit', env: { ...process.env, MOTIONEASY_DIR: motionEasyDir() } });
  renderMs = Date.now() - tr;
}
const report = { id, brand, plan_s: planMs / 1000, render_mix_s: renderMs / 1000, total_s: (Date.now() - t0) / 1000, stages_ms: times };
writeFileSync(join(dir, 'fast-report.json'), JSON.stringify(report, null, 1));
console.log(`\nplan ${sec(planMs)} (storyboard ${sec(times.storyboard ?? 0)}, scenes ${sec((times.scenes ?? 0) - (times.storyboard ?? 0))}, qa ${sec(times.qaTotal ?? 0)}) · ${args.includes('--render') ? 'render+mix' : 'audio'} ${sec(renderMs)} · TOTAL ${sec(Date.now() - t0)}`);
if (!args.includes('--render')) {
  const { url } = await servePreview(dir, id, Number(process.env.PREVIEW_PORT ?? 4792));
  console.log(`preview: ${url}  (Ctrl+C to stop)`);
} else process.exit(0);
