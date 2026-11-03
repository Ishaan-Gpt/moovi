#!/usr/bin/env node
// locate.mjs: re-captures real pages (same viewport as capture.mjs) and finds where given texts sit, so a film's camera lands exactly on
// the spoken detail. Writes <out>/<name>.png (+ -full.png) and appends to <out>/rects.json: { name: { text: [x0, y0, x1, y1] } } in capture px.
//   node locate.mjs <out dir> <jobs.json>      jobs: [{ "name": "...", "url": "...", "find": ["4.6M views", ...], "full": true }]
import { createRequire } from 'node:module';
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
const ROOT = 'C:/Ishaan GPT/hackthons/moovi';
const r = createRequire(join(ROOT, 'package.json')); let pw; try { pw = r('playwright-core'); } catch { pw = r(join(ROOT, 'node_modules/.pnpm/playwright-core@1.56.1/node_modules/playwright-core')); }
const out = resolve(process.argv[2]), jobs = JSON.parse(readFileSync(process.argv[3], 'utf8')); mkdirSync(out, { recursive: true });
const RJ = join(out, 'rects.json'), rects = existsSync(RJ) ? JSON.parse(readFileSync(RJ, 'utf8')) : {};
const DPR = 1.5;
const b = await pw.chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
const ctx = await b.newContext({ viewport: { width: 1600, height: 1000 }, deviceScaleFactor: DPR, locale: 'en-US', colorScheme: 'dark' });
for (const j of jobs) {
  const p = await ctx.newPage();
  try {
    await p.goto(j.url, { waitUntil: 'domcontentloaded', timeout: 60000 });
    for (const sel of ['button:has-text("Reject all")', 'button[aria-label^="Reject"]']) { const x = p.locator(sel).first(); if (await x.count()) { await x.click().catch(() => {}); break; } }
    await p.waitForTimeout(j.wait || 4500);
    await p.screenshot({ path: join(out, j.name + '.png') });
    if (j.full) await p.screenshot({ path: join(out, j.name + '-full.png'), fullPage: true });
    rects[j.name] = rects[j.name] || {};
    for (const text of j.find || []) {
      // the smallest visible element whose text contains it; page coords (scroll included), in capture px
      const box = await p.evaluate(text => { let best = null;
        if (/^[#.]|^ytd-/.test(text)) { const el = document.querySelector(text); if (!el) return null; const rc = el.getBoundingClientRect(); return { x: rc.left + scrollX, y: rc.top + scrollY, w: rc.width, h: rc.height }; }
        for (const el of document.querySelectorAll('body *')) { if (!el.textContent || !el.textContent.includes(text)) continue; const rc = el.getBoundingClientRect(); if (rc.width < 2 || rc.height < 2) continue;
          if (!best || rc.width * rc.height < best.a) best = { a: rc.width * rc.height, x: rc.left + scrollX, y: rc.top + scrollY, w: rc.width, h: rc.height }; }
        return best; }, text);
      rects[j.name][text] = box ? [box.x, box.y, box.x + box.w, box.y + box.h].map(v => Math.round(v * DPR)) : null;
    }
    console.log('ok', j.name, JSON.stringify(rects[j.name]));
  } catch (e) { console.log('fail', j.name, String(e).slice(0, 160)); }
  await p.close();
}
writeFileSync(RJ, JSON.stringify(rects, null, 1));
await b.close();
