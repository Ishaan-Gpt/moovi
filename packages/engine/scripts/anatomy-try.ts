// Re-stage an Anatomy film without new voice or model calls (for tuning the look): reads <dir>/script.txt, words.json
// and the cached plan (or, with --demo, a built-in script with fake word timings and the rule-based plan), rebuilds
// film.json, serves it and writes a contact sheet (or stills).
//   tsx scripts/anatomy-try.ts --demo [--theme dark] [--setups line-belt,hub-ring,...]   a demo; --setups forces figures in order
//   tsx scripts/anatomy-try.ts <data/anatomy/<id>> [--times 1,4,9] [--theme light|dark] [--offline] [--setups ...]
//   tsx scripts/anatomy-try.ts --all [--theme dark]        every library set-up once (several demo films), sheets only
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { chromium } from 'playwright-core';
import { config } from '../src/config';
import { buildFilm, describe, planFilm, type Word } from '../src/anatomy/plan';
import { contactSheet, serveAnatomy } from '../src/anatomy/player';
import { SETUPS } from '../src/anatomy/library';

const args = process.argv.slice(2), opt = (k: string) => { const i = args.indexOf(`--${k}`); return i >= 0 ? args[i + 1] : undefined; };
const demo = args.includes('--demo') || args.includes('--all');
let theme = (opt('theme') ?? 'light') as 'light' | 'dark';
const DEMO = [
  'Your code goes out the moment you push it.',
  'The build server compiles it, runs the tests, and packs every asset.',
  'Then the edge network copies it to every region at once.',
  'Requests land on the nearest node, and data stays in one database.',
  'A dashboard shows 40 regions answering in milliseconds.',
  'Every change gets its own preview link.',
  'That is the whole machine, at demo.dev.',
];
const fake = (script: string): Word[] => { let t = 0.2; return script.split(/\s+/).filter(Boolean).map(w => { const d = 0.16 + w.length * 0.035; const o = { word: w, t: +t.toFixed(2), end: +(t + d).toFixed(2) }; t += d + (/[.,]$/.test(w) ? 0.3 : 0.05); return o; }); };

async function one(dir: string, lines: string[], words: Word[], brand: string, color: string, line: string, facts: string[], force?: string[], offline = true) {
  mkdirSync(dir, { recursive: true });
  const script = lines.join('\n'), seed = `${dir}:${opt('seed') ?? 'try'}`;
  const plan = await planFilm({ id: 'try', script, lines, facts, brand, line, seed, offline, force, log: console.log });
  const dur = words.at(-1)!.end + 0.3;
  const { film, notes } = buildFilm({ id: dir.split(/[\\/]/).pop()!, plan, script, words, duration: dur, brand, line, brandColor: color, theme, audio: '/v/master.wav', seed });
  console.log(describe(film).join('\n'), '\nnotes', notes);
  writeFileSync(join(dir, 'film.json'), JSON.stringify(film));
  const { url, close } = await serveAnatomy(dir, 0);
  const times = opt('times')?.split(',').map(Number);
  if (times) {
    const b = await chromium.launch({ headless: true, ...(config.chrome.path ? { executablePath: config.chrome.path } : { channel: config.chrome.channel }) });
    const page = await b.newPage({ viewport: { width: 540, height: 960 } }); page.on('pageerror', e => console.log('pageerror', String(e)));
    await page.goto(`${url}?t=0`); await page.waitForFunction('window.__ready || window.__error', null, { timeout: 60_000 }); console.log('err', await page.evaluate('window.__error'));
    for (const t of times) { await page.evaluate(`window.__render(${t})`); await page.screenshot({ path: join(dir, `still-${t}.png`) }); }
    const s = Date.now(); await page.evaluate('(()=>{for(let i=0;i<30;i++) window.__render(5+i*0.1)})()'); console.log('ms/frame', ((Date.now() - s) / 30).toFixed(1));
    await b.close();
  } else console.log(await contactSheet(url, dir, film.duration, join(dir, '..', `${film.id}-sheet.png`), Number(opt('step') ?? 1.5)));
  close();
}

if (args.includes('--all')) {
  const ids = SETUPS.map(s => s.id), per = DEMO.length;
  for (let k = 0; k * per < ids.length; k++) await one(join(config.data, 'anatomy', 'try', `all-${theme}-${k + 1}`), DEMO, fake(DEMO.join(' ')), 'Demo', '#2B67C6', 'demo.dev', [], ids.slice(k * per, k * per + per));
} else if (demo) {
  await one(join(config.data, 'anatomy', 'try', `demo-${theme}`), DEMO, fake(DEMO.join(' ')), 'Demo', '#2B67C6', 'demo.dev', [], opt('setups')?.split(','));
} else {
  const dir = resolve(args[0]!);
  const raw = readFileSync(join(dir, 'script.txt'), 'utf8'); const head = /^# (.*?) \((.*?)\) colour (#[0-9a-f]{6})(?: theme (\w+))?.*?Facts: (.*)$/im.exec(raw);
  let brand = 'Brand', color = '#2B67C6', line = 'brand', facts: string[] = [];
  if (head) { brand = head[1]!; line = new URL(head[2]!).hostname.replace(/^www\./, ''); color = head[3]!; facts = head[5]!.split(' | '); if (!opt('theme') && head[4]) theme = head[4] as 'light' | 'dark'; }
  const lines = raw.split('\n').filter(l => l.trim() && !l.startsWith('#'));
  await one(dir, lines, JSON.parse(readFileSync(join(dir, 'words.json'), 'utf8')), brand, color, line, facts, opt('setups')?.split(','), args.includes('--offline'));
}
