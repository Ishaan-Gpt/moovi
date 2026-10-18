// Render caption pills (the proof beat's chip: ink on icy white, Inter Tight 700) to transparent PNGs for ffmpeg overlays.
// Usage: node docs/submission/demo/caption-pngs.mjs <outDir> "line 1" "line 2" ...   → <outDir>/cap0.png, cap1.png, …
import { chromium } from '../../../node_modules/.pnpm/playwright-core@1.56.1/node_modules/playwright-core/index.mjs';
import { join } from 'node:path';
const [out, ...lines] = process.argv.slice(2);
const b = await chromium.launch({ channel: 'chrome', headless: true });
const p = await b.newPage({ viewport: { width: 1920, height: 300 }, deviceScaleFactor: 1 });
for (const [i, s] of lines.entries()) {
  await p.setContent(`<html><head><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter+Tight:wght@700&display=block"></head>
  <body style="margin:0;background:transparent"><div style="display:inline-block;padding:60px">
  <div id="c" style="font:700 44px 'Inter Tight';color:#0E1A2B;background:rgba(247,250,253,0.94);padding:20px 40px;border-radius:999px;
  box-shadow:0 14px 40px rgba(14,26,43,0.22),inset 0 0 0 1.5px rgba(14,26,43,0.07);letter-spacing:-0.01em;white-space:nowrap">${s}</div></div></body></html>`);
  await p.evaluate(() => document.fonts.ready);
  await p.locator('body > div').screenshot({ path: join(out, `cap${i}.png`), omitBackground: true });
}
await b.close();
