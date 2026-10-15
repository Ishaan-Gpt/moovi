// tsx scripts/dv-fit-check.ts <darkvox film dir>: plays every Dark Vox shot in the live player at 24 times each (from its
// first word to its outgoing zoom-through ramp) and measures every on-screen word's box against the frame: prints the
// closest any word comes to the left/right edge as a share of the frame width (the clamp keeps it >= 6 %).
import { chromium } from 'playwright-core';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { config } from '../src/config';
import { serveDarkVox } from '../src/darkvox/player';

const dir = resolve(process.argv[2]!);
const film = JSON.parse(readFileSync(join(dir, 'film.json'), 'utf8')) as { shots: { t0: number; t1: number; toks: { t: number }[] }[] };
const { url, close } = await serveDarkVox(dir, 0);
const b = await chromium.launch({ headless: true, ...(config.chrome.path ? { executablePath: config.chrome.path } : { channel: config.chrome.channel }) });
const page = await b.newPage({ viewport: { width: 540, height: 960 } });
await page.goto(`${url}?t=0`); await page.waitForFunction('window.__ready || window.__error', null, { timeout: 60_000 });
const err = await page.evaluate('window.__error'); if (err) throw new Error(String(err));
let worst = 1, at = '';
for (const [i, s] of film.shots.entries()) {
  if (!s.toks.length) continue;
  const on = Math.min(...s.toks.map(k => k.t)) + 0.14, end = s.t1 - 0.34; // words landed; before the zoom-through ramp
  let shotMin = 1;
  for (let k = 0; k <= 24 && on < end; k++) {
    const t = on + (end - on) * k / 24;
    const m = await page.evaluate(`(() => { window.__render(${t}); const st = document.getElementById('stage').getBoundingClientRect(), sc = st.width / 1080;
      let d = 1; for (const w of document.querySelectorAll('.shot .w')) { if (w.closest('.shot').style.display === 'none' || w.closest('.portal') || +w.style.opacity < 0.99) continue; const r = w.getBoundingClientRect(); if (!r.width) continue;
        d = Math.min(d, (r.left - st.left) / sc / 1080, (st.right - r.right) / sc / 1080); } return d; })()`) as number;
    if (m < shotMin) shotMin = m;
  }
  console.log(`shot ${i}: closest word to an edge ${(shotMin * 100).toFixed(1)} % of the frame width`);
  if (shotMin < worst) { worst = shotMin; at = `shot ${i}`; }
}
console.log(`fit: ${JSON.stringify(await page.evaluate('window.__fit()'))}`);
console.log(`WORST ${(worst * 100).toFixed(1)} % (${at})  ${worst >= 0.0595 ? 'OK >= 6 %' : 'CLIPS / under 6 %'}`);
await b.close(); close();
