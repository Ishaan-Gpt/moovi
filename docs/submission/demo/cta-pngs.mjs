// The end card's type layers (beat 9 CTA) as transparent PNGs, one per element, so ffmpeg can stagger them in.
// Usage: node docs/submission/demo/cta-pngs.mjs <outDir>  → cta-line.png, cta-sub.png, cta-pill.png (each 1920 wide, centred)
import { chromium } from '../../../node_modules/.pnpm/playwright-core@1.56.1/node_modules/playwright-core/index.mjs';
import { join } from 'node:path';
const out = process.argv[2];
const css = `<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter+Tight:wght@500;700;800&display=block">
<style>body{margin:0;background:transparent;width:1920px;text-align:center;font-family:'Inter Tight';color:#0E1A2B}div.w{padding:24px 0}</style>`;
const parts = {
  'cta-line': `<div class="w"><span style="font-weight:800;font-size:84px;letter-spacing:-0.025em">Your video production team.</span></div>`,
  'cta-sub': `<div class="w"><span style="font-weight:500;font-size:38px;color:#3B5674;letter-spacing:-0.005em">Built on <b style="font-weight:800;color:#0E1A2B">FalkorDB</b> &nbsp;·&nbsp; any model, your own key</span></div>`,
  'cta-pill': `<div class="w" style="padding:40px 0"><span style="display:inline-block;font-weight:700;font-size:40px;background:#0E1A2B;color:#F7FAFD;padding:24px 48px;border-radius:999px;box-shadow:0 18px 44px rgba(14,26,43,0.28)">Make your first video &nbsp;→&nbsp; moovi-three.vercel.app</span></div>`,
};
const b = await chromium.launch({ channel: 'chrome', headless: true });
const p = await b.newPage({ viewport: { width: 1920, height: 400 } });
for (const [name, html] of Object.entries(parts)) {
  await p.setContent(`<html><head>${css}</head><body>${html}</body></html>`);
  await p.evaluate(() => document.fonts.ready);
  await p.locator('div.w').screenshot({ path: join(out, `${name}.png`), omitBackground: true });
}
await b.close();
