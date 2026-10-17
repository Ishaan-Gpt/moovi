import { chromium } from 'playwright-core';
import { config } from '../src/config';
const b = await chromium.launch({ headless: true, ...(config.chrome.path ? { executablePath: config.chrome.path } : { channel: config.chrome.channel }), args: ['--autoplay-policy=no-user-gesture-required', '--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] });
const p = await b.newPage({ viewport: { width: 540, height: 1030 } });
p.on('pageerror', e => console.log('pageerror', String(e)));
await p.goto('http://127.0.0.1:4600/data/master-edit/src/' + (process.env.PAGE ?? 'player.html'));
await p.waitForFunction('window.__ready', null, { timeout: 60000 });
const r: any = await p.evaluate(`(async () => {
  const v = document.getElementById('v'), m = { gaps: [], waits: 0, seeks: [], tl: [], cost: [] };
  v.addEventListener('waiting', () => m.waits++);
  let sk = 0; v.addEventListener('seeking', () => { sk = performance.now(); }); v.addEventListener('seeked', () => m.seeks.push(performance.now() - sk));
  let last = performance.now(); const t0 = last;
  await new Promise(res => { const f = () => { const n = performance.now(); m.gaps.push(n - last); m.tl.push([n - t0, v.currentTime]); last = n; if (n - t0 < 15000) requestAnimationFrame(f); else res(); }; f(); document.getElementById('gate').click(); });
  return m;
})()`);
const g = (r.gaps as number[]).slice(5).sort((a, b) => a - b), q = (x: number) => g[Math.floor(g.length * x)]!.toFixed(1);
console.log(`frames ${g.length} · median ${q(.5)} ms · p95 ${q(.95)} · max ${g.at(-1)!.toFixed(0)} · over 50 ms: ${g.filter(x => x > 50).length} · fps ${(g.length / 15).toFixed(1)}`);
console.log(`waiting events ${r.waits} · seeks ${r.seeks.length} · seek ms: ${(r.seeks as number[]).map(x => x.toFixed(0)).join(' ')}`);
let st = 0, worst = 0, at = 0; const tl = r.tl as [number, number][];
for (let i = 1; i < tl.length; i++) { if (tl[i]![1] === tl[i - 1]![1] && tl[i]![1] > 0) st += tl[i]![0] - tl[i - 1]![0]; else { if (st > worst) { worst = st; at = tl[i]![1]; } st = 0; } }
console.log(`longest frozen video clock: ${worst.toFixed(0)} ms (ending at clip ${at.toFixed(2)} s)`);
await b.close(); process.exit(0);
