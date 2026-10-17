const { chromium } = require('C:/Ishaan GPT/hackthons/moovi/node_modules/.pnpm/playwright-core@1.56.1/node_modules/playwright-core');
const out = process.argv[2];
const times = (process.argv[3] || '2,4.8,7.6,10.25,12.05,14.6').split(',').map(Number);
(async () => {
  const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
  const p = await b.newPage({ viewport: { width: 1920, height: 1150 } });
  await p.goto('http://127.0.0.1:4377/', { waitUntil: 'networkidle' });
  await p.evaluate(() => document.fonts.ready);
  for (const t of times) {
    await p.evaluate((s) => window.seekTo(s), t);
    await p.waitForTimeout(150);
    await p.locator('#root').screenshot({ path: `${out}/frames/f-${String(t).replace('.', '_')}.jpg`, type: 'jpeg', quality: 70 });
  }
  await b.close();
})().catch((e) => { console.error(e.message); process.exit(1); });
