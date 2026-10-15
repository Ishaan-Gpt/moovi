import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { config } from '../src/config';
import { capturePage, closeRender } from '../src/render/host';
import { close3d, openLook, renderLook, type LookParams } from '../src/render3d/capture';
import { LOOK_IDS, isLook, type LookId } from '../src/render3d/looks';

/**
 * Render the 3D looks headless and time them.
 *   tsx scripts/look3d.ts bench [seconds] [WxH]     every look: render seconds per second of film
 *   tsx scripts/look3d.ts stills [WxH]              frames 0, middle and last of every look as PNGs (to look at)
 *   tsx scripts/look3d.ts <look> [seconds] [out]    one look to PNG frames (and an mp4 if ffmpeg is there and out ends in .mp4)
 */
const [cmd = 'bench', a, b] = process.argv.slice(2);
const dir = join(config.data, 'look3d');
const size = (s?: string): Pick<LookParams, 'width' | 'height'> => { const m = s?.match(/^(\d+)x(\d+)$/); return m ? { width: +m[1]!, height: +m[2]! } : { width: 540, height: 960 }; };
const has = (f: string) => existsSync(join(dir, f));
const demo = (id: LookId): LookParams => ({ values: [3, 5, 4, 8, 6, 10, 9], seed: 7, ...(id === 'turntable' ? { texture: join(dir, process.env.SITE && has('site.png') ? 'site.png' : 'texture.png') } : id === 'orbit' ? { texture: join(dir, process.env.LOGO && has('logo.svg') ? 'logo.svg' : 'texture.png') } : {}) });

/**
 * Textures. SITE=https://… makes the turntable show a real capture of that site; LOGO=<simple-icons slug> makes the orbit
 * circle that brand's real mark. Otherwise a generated stand-in (nothing downloaded, nothing committed).
 */
async function makeTextures() {
  if (process.env.SITE) await capturePage(process.env.SITE, join(dir, 'site.png'), { width: 1440, height: 900, scale: 1, settleMs: 2500, minDetail: 0.3 });
  if (process.env.LOGO) {
    const r = await fetch(`https://cdn.simpleicons.org/${encodeURIComponent(process.env.LOGO)}/2B67C6`);
    if (r.ok) writeFileSync(join(dir, 'logo.svg'), (await r.text()).replace('<svg ', '<svg width="512" height="512" '));
  }
  const s = await openLook('particles', { width: 640, height: 400, seconds: 1, fps: 1 });
  writeFileSync(join(dir, 'texture.png'), await s.frame(0)); await s.close();
}

mkdirSync(dir, { recursive: true });
await makeTextures();
if (cmd === 'bench') {
  const seconds = Number(a) || 2, sz = size(b);
  console.log(`3D looks, ${sz.width}x${sz.height}, ${seconds}s at 30 fps, software GL (SwiftShader unless MOOVI_3D_GPU=1)`);
  for (const id of LOOK_IDS) {
    const r = await renderLook(id, { ...demo(id), ...sz, seconds });
    console.log(`${id.padEnd(10)} ${r.frames} frames  ${(r.captureMs / r.frames).toFixed(0).padStart(5)} ms/frame  ${r.secPerSec.toFixed(2)} s per second of film  [${r.renderer.slice(0, 60)}]`);
  }
} else if (cmd === 'stills') {
  const sz = size(a);
  for (const id of LOOK_IDS) {
    const s = await openLook(id, { ...demo(id), ...sz, seconds: 3 });
    for (const [name, n] of [['a', 0], ['b', Math.floor(s.info.frames / 2)], ['c', s.info.frames - 1]] as const) writeFileSync(join(dir, `${id}-${name}.png`), await s.frame(n));
    await s.close();
  }
  console.log(`stills in ${dir}`);
} else if (isLook(cmd)) {
  const r = await renderLook(cmd, { ...demo(cmd), ...size(), seconds: Number(a) || 2 }, b?.endsWith('.mp4') ? { out: b } : { framesDir: join(dir, cmd) });
  console.log(r);
} else { console.error('bench | stills | ' + LOOK_IDS.join(' | ')); process.exitCode = 1; }
await close3d(); await closeRender();
