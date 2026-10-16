// The owner's grades as 3D LUTs (.cube): the exact grade shader (kits/motion/grade.js) run in Chrome over an identity
// lattice, with the spatial controls (sharpen, clarity, vignette, grain) off. ffmpeg's lut3d then applies the colour part
// exactly; restore.ts adds the spatial part with ffmpeg's own filters.
//   pnpm --filter @moovi/engine exec tsx scripts/grade-lut.ts            → packages/library/src/kits/motion/luts/<id>.cube
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { chromium } from 'playwright-core';
import { config } from '../src/config';

const KITS = join(import.meta.dirname, '..', '..', 'library', 'src', 'kits', 'motion');
const N = 33;
const presets = JSON.parse(readFileSync(join(KITS, 'grade-presets.json'), 'utf8')) as Record<string, { settings: Record<string, number> }>;
const gradeJs = readFileSync(join(KITS, 'grade.js'), 'utf8');
const b = await chromium.launch({ headless: true, ...(config.chrome.path ? { executablePath: config.chrome.path } : { channel: config.chrome.channel }), args: ['--use-gl=angle', '--ignore-gpu-blocklist'] });
try {
  const page = await b.newPage();
  await page.setContent(`<script>${gradeJs}</script>`);
  mkdirSync(join(KITS, 'luts'), { recursive: true });
  for (const [id, p] of Object.entries(presets)) {
    const s = { ...p.settings, sharpen: 0, clarity: 0, vignette: 0, grain: 0 };
    const px: number[] = await page.evaluate(`(() => {
      const N = ${N}, W = N * N, src = document.createElement('canvas'); src.width = W; src.height = N;
      const sx = src.getContext('2d'), im = sx.createImageData(W, N);
      for (let g = 0; g < N; g++) for (let b = 0; b < N; b++) for (let r = 0; r < N; r++) { const i = (g * W + b * N + r) * 4; im.data[i] = Math.round(r * 255 / (N - 1)); im.data[i + 1] = Math.round(g * 255 / (N - 1)); im.data[i + 2] = Math.round(b * 255 / (N - 1)); im.data[i + 3] = 255; }
      sx.putImageData(im, 0, 0);
      const out = makeGrader(W, N)(src, ${JSON.stringify(s)}, 0, W, N);
      const c = document.createElement('canvas'); c.width = W; c.height = N; const cx = c.getContext('2d'); cx.drawImage(out, 0, 0);
      return Array.from(cx.getImageData(0, 0, W, N).data);
    })()`);
    const lines = [`TITLE "moovi ${id}"`, `LUT_3D_SIZE ${N}`, 'DOMAIN_MIN 0 0 0', 'DOMAIN_MAX 1 1 1'];
    for (let bb = 0; bb < N; bb++) for (let g = 0; g < N; g++) for (let r = 0; r < N; r++) {
      const i = (g * N * N + bb * N + r) * 4; lines.push(`${(px[i]! / 255).toFixed(5)} ${(px[i + 1]! / 255).toFixed(5)} ${(px[i + 2]! / 255).toFixed(5)}`);
    }
    writeFileSync(join(KITS, 'luts', `${id}.cube`), lines.join('\n') + '\n');
    console.log(`${id}: ${N}^3 LUT written`);
  }
} finally { await b.close(); }
