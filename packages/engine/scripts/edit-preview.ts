/**
 * An edit of your own clip, playing live in the browser (the edit preview player, src/edit). Until D1.3 lands, the
 * plan is the stand-in from src/edit/rough.ts (pause trim, a shot per sentence, alternating punch-ins).
 *
 *   pnpm --filter @moovi/engine exec tsx --env-file-if-exists=../../.env.local scripts/edit-preview.ts <clip.mp4>
 *     [--words words.json | --edl plan.json] [--caption punch-duo] [--port 4310] [--measure] [--no-serve]
 *
 * --words takes [{word, t | start, end}] (skips transcription); otherwise the clip is transcribed with the key in
 * .env.local. --edl plays a given EDL (validated with validateEdl; its source.file is replaced by the clip).
 * --measure plays the edit once in headless Chrome and prints the player's own numbers.
 */
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, extname, join, resolve } from 'node:path';
import { color } from '@moovi/brand';
import { chromium } from 'playwright-core';
import { transcribeWords } from '../src/audio/stt';
import { probe } from '../src/bench';
import { config } from '../src/config';
import { CAPTION_STYLES } from '../src/edit/captions';
import { validateEdl } from '../src/edit/edl';
import { EDIT, type PlayerEdl } from '../src/edit/lib';
import { PAGE } from '../src/edit/page';
import { roughEdl, type Word } from '../src/edit/rough';
import { servePlayer } from '../src/s4/player';

const args = process.argv.slice(2), flag = (k: string) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : undefined; };
const clip = args.find(a => !a.startsWith('--') && !args[args.indexOf(a) - 1]?.startsWith('--'));
if (!clip || !existsSync(clip)) { console.error('usage: edit-preview.ts <clip.mp4> [--words words.json] [--caption id] [--port n] [--measure] [--no-serve]'); process.exit(2); }
const caption = flag('--caption') ?? 'punch-duo';
if (!CAPTION_STYLES.some(s => s.id === caption.replace(/^caption:/, ''))) { console.error(`unknown caption style "${caption}"; one of: ${CAPTION_STYLES.map(s => s.id).join(', ')}`); process.exit(2); }

const lap: Record<string, number> = {}; let t0 = Date.now();
const mark = (k: string) => { lap[k] = +((Date.now() - t0) / 1000).toFixed(2); t0 = Date.now(); };

const slug = basename(clip, extname(clip)).replace(/[^a-z0-9]+/gi, '-').toLowerCase().slice(0, 40);
const dir = join(config.data, 'edit', slug); mkdirSync(dir, { recursive: true });
const file = `src${extname(clip).toLowerCase() || '.mp4'}`;
copyFileSync(clip, join(dir, file));
const pr = await probe(clip);
if (!pr.hasVideo) throw new Error('that file has no video stream');
mark('probe');

let words: Word[] = [], edl: PlayerEdl;
const ef = flag('--edl'), wf = flag('--words');
if (ef) {
  const raw = JSON.parse(readFileSync(ef, 'utf8')) as Record<string, unknown> & { source: Record<string, unknown> };
  raw.source = { ...raw.source, file };
  const v = validateEdl(raw);
  if (!v.edl || v.problems.length) throw new Error(`EDL problems: ${v.problems.join('; ')}`);
  if (v.edl.source.duration > pr.duration + 0.05) throw new Error(`the EDL needs ${v.edl.source.duration} s of source; the clip has ${pr.duration.toFixed(2)} s`);
  edl = v.edl; mark('edl(file)');
} else {
  if (wf) words = (JSON.parse(readFileSync(wf, 'utf8')) as { word: string; t?: number; start?: number; end: number }[]).map(w => ({ word: w.word, t: w.t ?? w.start ?? 0, end: w.end }));
  else words = pr.hasAudio ? await transcribeWords(clip, dir) : [];
  writeFileSync(join(dir, 'words.json'), JSON.stringify(words, null, 1));
  mark(wf ? 'words(file)' : 'transcribe');
  // the default palette is the brand's; each edit style brings its own on Day 2 (packages/library, like the gen styles)
  const palette = { ink: color.ink, paper: color.surface, accent: color.ice, accent2: color.frostMid, deep: color.ink, pop: color.iceWhite };
  edl = roughEdl({ file, duration: pr.duration, w: pr.width ?? 1080, h: pr.height ?? 1920, fps: pr.fps ?? 30 }, words, { palette, captionStyle: caption });
}
const tl = EDIT.timeline(edl);
if (tl.problems.length) throw new Error(`EDL problems: ${tl.problems.join('; ')}`);
writeFileSync(join(dir, 'edl.json'), JSON.stringify(edl, null, 1));
mark('plan');

console.log(`source ${pr.duration.toFixed(1)} s ${pr.width}x${pr.height} → edit ${tl.duration.toFixed(1)} s, ${edl.shots.length} shots, ${edl.words.length} words, captions ${edl.caption_style_id}`);
console.log(`stages (s): ${Object.entries(lap).map(([k, v]) => `${k} ${v}`).join(' · ')} · to plan ${Object.values(lap).reduce((a, b) => a + b, 0).toFixed(2)}`);
console.log(`files: ${resolve(dir)}`);
if (args.includes('--no-serve')) process.exit(0);

const srv = await servePlayer(dir, Number(flag('--port') ?? 0), PAGE);
console.log(`preview: ${srv.url}`);

if (args.includes('--measure')) {
  const b = await chromium.launch({ headless: true, ...(config.chrome.path ? { executablePath: config.chrome.path } : { channel: config.chrome.channel }), args: ['--autoplay-policy=no-user-gesture-required'] });
  try {
    const page = await b.newPage({ viewport: { width: 405, height: 776 } });
    page.on('pageerror', e => console.log('pageerror:', String(e)));
    const s = Date.now();
    await page.goto(srv.url); await page.waitForFunction('window.__ready || window.__error', null, { timeout: 60_000 });
    const err = await page.evaluate('window.__error'); if (err) throw new Error(String(err));
    const ready = (Date.now() - s) / 1000;
    await page.evaluate('window.__play()');
    await page.waitForFunction('window.__metrics().done', null, { timeout: (tl.duration + 30) * 1000 });
    const m = await page.evaluate('window.__metrics()') as { cuts: { hold: number; off: number }[]; kicks: number; firstFrame: number };
    const holds = m.cuts.map(c => c.hold), offs = m.cuts.map(c => c.off);
    console.log(JSON.stringify({ page_ready_s: +ready.toFixed(2), first_frame_ms: m.firstFrame, cuts: m.cuts.length, hold_ms_max: Math.max(0, ...holds), hold_ms_median: holds.sort((x, y) => x - y)[holds.length >> 1] ?? 0, cut_off_ms: [Math.min(0, ...offs), Math.max(0, ...offs)], seek_kicks: m.kicks }));
    await page.evaluate(`window.__render(${(tl.duration / 2).toFixed(2)})`);
    await page.screenshot({ path: join(dir, 'mid.png') }); console.log(`still: ${join(dir, 'mid.png')}`);
  } finally { await b.close(); }
  srv.close(); process.exit(0);
}
