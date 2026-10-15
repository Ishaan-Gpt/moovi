import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { chromium } from 'playwright-core';
import { config } from '../src/config';

/** tsx scripts/gallery.ts out.jpg cols height image.png ...  : tiles frames into one small JPEG (no ffmpeg needed) */
const [out, colsArg, hArg, ...imgs] = process.argv.slice(2);
const cols = Number(colsArg), h = Number(hArg), w = Math.round(h * (Number(process.env.ASPECT) || 9 / 16));
const rows = Math.ceil(imgs.length / cols);
const uri = (f: string) => `data:image/${f.endsWith('.jpg') ? 'jpeg' : 'png'};base64,${readFileSync(f).toString('base64')}`;
const html = `<body style="margin:0;background:#F7FAFD"><div style="display:grid;grid-template-columns:repeat(${cols},${w}px);gap:6px;padding:6px">${imgs.map(f => `<img src="${uri(f)}" style="width:${w}px;height:${h}px;object-fit:cover;border-radius:8px">`).join('')}</div></body>`;
const b = await chromium.launch({ headless: true, ...(config.chrome.path ? { executablePath: config.chrome.path } : { channel: config.chrome.channel }) });
const p = await b.newPage({ viewport: { width: cols * (w + 6) + 6, height: rows * (h + 6) + 6 } });
await p.setContent(html);
await p.waitForTimeout(500);
mkdirSync(dirname(out!), { recursive: true });
writeFileSync(out!, await p.screenshot({ type: 'jpeg', quality: 80 }));
await b.close();
