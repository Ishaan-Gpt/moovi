// Dark Vox: every code-drawn prop on one sheet (data/darkvox/props-sheet.png), to look at them as a set.
import { join } from 'node:path';
import { chromium } from 'playwright-core';
import { config } from '../src/config';
import { darkWorld } from '../src/darkvox/film';
import { dvProps } from '../src/darkvox/props';

const P = darkWorld('demo', process.argv[2] ?? '#2E7D5B').palette;
const { names, draw } = dvProps(P);
const cut = `filter:drop-shadow(3px 0 0 ${P.cream}) drop-shadow(-3px 0 0 ${P.cream}) drop-shadow(0 3px 0 ${P.cream}) drop-shadow(0 -3px 0 ${P.cream}) drop-shadow(0 14px 14px rgba(0,0,0,.6))`;
const html = `<html><body style="margin:0;padding:16px;background:radial-gradient(#1C2740,${P.night});font:13px system-ui;color:#ccc;display:grid;grid-template-columns:repeat(8,170px);gap:14px">${names.map(n => `<div><div style="width:150px;height:150px;${cut}">${draw(n)}</div>${n}</div>`).join('')}</body></html>`;
const b = await chromium.launch({ headless: true, ...(config.chrome.path ? { executablePath: config.chrome.path } : { channel: config.chrome.channel }) });
const p = await b.newPage({ viewport: { width: 8 * 184 + 30, height: 400 } });
await p.setContent(html);
const out = join(config.data, 'darkvox', 'props-sheet.png');
await p.screenshot({ path: out, fullPage: true }); await b.close();
console.log(out, names.length);
