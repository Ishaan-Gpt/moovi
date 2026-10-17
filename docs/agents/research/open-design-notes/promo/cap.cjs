const { chromium } = require('C:/Ishaan GPT/hackthons/moovi/node_modules/.pnpm/playwright-core@1.56.1/node_modules/playwright-core');
const out = process.argv[2];
(async () => {
  const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
  for (const [n, w, h, m] of [['desktop', 1440, 900, false], ['tablet', 1024, 768, false], ['mobile', 390, 844, true]]) {
    const p = await b.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: m ? 2 : 1, isMobile: m, hasTouch: m });
    await p.goto('https://moovi-three.vercel.app/', { waitUntil: 'load', timeout: 60000 });
    await p.waitForTimeout(11000);
    await p.screenshot({ path: `${out}/assets/site-${n}.png` });
    if (n === 'desktop') {
      await p.mouse.wheel(0, 2600);
      await p.waitForTimeout(2500);
      await p.screenshot({ path: `${out}/assets/site-desktop-2.png` });
    }
    await p.close();
  }
  await b.close();
})().catch((e) => { console.error(e.message); process.exit(1); });
