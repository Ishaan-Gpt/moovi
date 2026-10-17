// Renders the desk world's real cut-outs (PNG with alpha) from the CC0 scans in data/world, once, into data/world/cut/.
// Needs the player server running: node data/master-edit/serve.mjs . 4610; then node data/master-edit/cutouts.mjs
import { chromium } from '../../packages/engine/node_modules/playwright-core/index.mjs';
import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
const SHOTS = {
  laptop: { m: 'classic_laptop', tilt: 28, screen: true },
  megaphone: { m: 'Megaphone_01', tilt: 90, yaw: 30 },
  'bulb-off': { m: 'lightbulb_01', tilt: 12, emissive: .22 },
  'bulb-on': { m: 'lightbulb_01', tilt: 12, emissive: 2.4 },
  cup: { m: 'tea_set_01', nodes: ['tea_set_01_cup_small_01'], tilt: 80 },
  teapot: { m: 'tea_set_01', nodes: ['tea_set_01_teapot_01'], tilt: 84 },
  pencils: { m: 'stationery_supplies', nodes: ['stationery_supplies_pencil_new_a', 'stationery_supplies_pencil_used', 'stationery_supplies_pen_fancy'], tilt: 90 },
  pencil: { m: 'stationery_supplies', nodes: ['stationery_supplies_pencil_new_b'], tilt: 90 },
  sticky: { m: 'office_notepads', nodes: ['office_notepads_sticky_sheet'], tilt: 90 },
  a4: { m: 'office_notepads', nodes: ['office_notepads_a4_a'], tilt: 90 },
  'leaf-a': { m: 'calathea_orbifolia_01', nodes: ['calathea_orbifolia_01_b'], tilt: 90 },
  'leaf-b': { m: 'calathea_orbifolia_01', nodes: ['calathea_orbifolia_01_d'], tilt: 90, yaw: 70 },
  'fern': { m: 'fern_02', nodes: ['fern_02_a'], tilt: 90 },
};
const want = process.argv.slice(2), port = process.env.PORT || 4610;
const b = await chromium.launch({ headless: true, channel: 'chrome', args: ['--ignore-gpu-blocklist'] });
const p = await b.newPage(); p.on('console', m => console.log('page:', m.text())); p.on('pageerror', e => console.log('err:', e.message));
await p.goto(`http://127.0.0.1:${port}/data/master-edit/src/cutout.html`); await p.waitForFunction(() => window.__ready, null, { timeout: 60000 });
mkdirSync('data/world/cut', { recursive: true }); const meta = existsSync('data/world/cut/cut.json') ? JSON.parse(readFileSync('data/world/cut/cut.json', 'utf8')) : {};
for (const [k, s] of Object.entries(SHOTS)) { if (want.length && !want.includes(k)) continue;
  const r = await p.evaluate(s => window.__shot(s), s); writeFileSync(`data/world/cut/${k}.png`, Buffer.from(r.png.split(',')[1], 'base64')); meta[k] = { w: r.w, h: r.h, quad: r.quad, from: s.m }; console.log(k, r.w, 'x', r.h); }
writeFileSync('data/world/cut/cut.json', JSON.stringify(meta, null, 1)); await b.close();
