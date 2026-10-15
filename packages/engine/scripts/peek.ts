import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { config } from '../src/config';
import { closeVisual, openFilm } from '../src/visual/capture';
import { planFilm } from '../src/visual/plan';
/** tsx scripts/peek.ts t1 t2 ... : the visual sample film (vertical, light) at those seconds, to data/visual/peek-N.jpg */
const SCRIPT = ['Most small teams lose hours every week to messy spreadsheets.', 'Meet Bluetoki: one place for your orders, stock and customers.', 'We grew 40% in 6 months, with 1,200 happy customers.', 'It connects your shop, your phone and your team, everywhere.', 'Set it up in minutes, track every order, and never miss a sale.', 'Try Bluetoki free today.'];
let t = 0; const beats = SCRIPT.map(text => { const n = text.split(/\s+/).length, d = Math.max(3.2, n / 2.6 + 0.6), b = { text, start: t, end: t + d }; t += d; return b; });
const plan = planFilm(beats, { format: (process.env.FORMAT as 'vertical') || 'vertical', theme: (process.env.THEME as 'light') || 'light', seed: 7, brand: 'Bluetoki' });
const s = await openFilm(plan, { scale: 0.5 });
for (const [i, sec] of process.argv.slice(2).entries()) writeFileSync(join(config.data, 'visual', `peek-${i}.jpg`), await s.frame(Math.round(Number(sec) * 30)));
await s.close(); await closeVisual();
