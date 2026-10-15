import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { ensureDir, sh } from '../bench';
import { config } from '../config';
import { still } from './host';

/**
 * A contact sheet: stills at fixed times, tiled (the owner's review step: "one still sheet per pass"). Returns the
 * sheet's path and each still's path; the stills go to Lens and the Shot Builders as images.
 */
export async function sheet(spec: unknown, times: number[], dir: string, o: { scale?: number; cols?: number; name?: string } = {}): Promise<{ sheet: string; stills: string[] }> {
  ensureDir(dir);
  const scale = o.scale ?? 0.25, cols = o.cols ?? Math.min(8, times.length);
  const stills: string[] = [];
  for (const [i, t] of times.entries()) {
    const s = await still(spec, t, scale);
    const f = join(dir, `${o.name ?? 'still'}-${String(i).padStart(2, '0')}.png`);
    writeFileSync(f, Buffer.from(s.png, 'base64'));
    stills.push(f);
  }
  const rows = Math.ceil(stills.length / cols);
  const layout = stills.map((_, i) => { const c = i % cols, r = Math.floor(i / cols); return `${c ? Array.from({ length: c }, (_, k) => `w${k}`).join('+') : '0'}_${r ? Array.from({ length: r }, (_, k) => `h${k * cols}`).join('+') : '0'}`; }).join('|');
  const out = join(dir, `${o.name ?? 'sheet'}.png`);
  if (stills.length === 1) { writeFileSync(out, Buffer.from(await import('node:fs').then(fs => fs.readFileSync(stills[0]!)))); return { sheet: out, stills }; }
  await sh(config.ffmpeg, ['-v', 'error', '-y', ...stills.flatMap(s => ['-i', s]), '-filter_complex', `${stills.map((_, i) => `[${i}]`).join('')}xstack=inputs=${stills.length}:layout=${layout}:fill=white`, out], { timeout: 120_000 });
  void rows;
  return { sheet: out, stills };
}
