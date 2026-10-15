/**
 * Build Editorial's shipped picture library (packages/library/src/style-4/pictures.json) from this machine's picture
 * cache: only greyscale pictures (Dark Vox's colour props are not Editorial's), no lettering, drawn by a strong model
 * (entries marked strong:false, and anything drawn during a weak-model run, are skipped), and each one passed
 * through the same checker a fresh drawing faces. A new install then starts library-first with hundreds of pictures.
 *   pnpm exec tsx scripts/s4-seed.ts [--skip-after <ISO time>]
 */
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { config } from '../src/config';
import { closePictures, judge, raster, type PictureSpec } from '../src/s4/picture';
import { PERIWINKLE } from '../src/s4/world';
import { SEED, words } from '../src/s4/library-pics';

const args = process.argv.slice(2), at = args.indexOf('--skip-after');
const skipAfter = at >= 0 ? Date.parse(args[at + 1]!) : Infinity;
const dir = join(config.data, 's4', 'cache');
const ix = new Map((JSON.parse(readFileSync(join(dir, 'index.json'), 'utf8')) as { key: string; sentence: string }[]).map(e => [e.key, e.sentence]));
const sat = (h: string) => { const v = [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16)); return Math.max(...v) - Math.min(...v); };
const out: Record<string, unknown>[] = [];
let seen = 0, why: Record<string, number> = {};
const skip = (k: string) => { why[k] = (why[k] ?? 0) + 1; };
for (const f of readdirSync(dir).filter(f => /^[0-9a-f]{16}\.json$/.test(f)).sort()) {
  seen++;
  const p = join(dir, f);
  if (statSync(p).mtimeMs >= skipAfter) { skip('weak-model run'); continue; }
  const s = JSON.parse(readFileSync(p, 'utf8')) as PictureSpec & { strong?: boolean };
  if (s.strong === false) { skip('weak drawer'); continue; }
  if (!s.svg || /<text\b/i.test(s.svg)) { skip('lettering'); continue; }
  if ([...s.svg.matchAll(/#([0-9a-f]{6})\b/gi)].some(m => sat(m[1]!) > 50)) { skip('colour'); continue; }
  const r = await raster(s.svg, PERIWINKLE);
  const st = judge(r);
  if (!st.ok || r.error) { skip('checker'); continue; }
  const key = f.slice(0, 16), sentence = ix.get(key) ?? '';
  out.push({ key, sentence, nouns: words(`${sentence} ${s.idea}`), kind: s.kind, idea: s.idea, keys: s.keys, coined: '', antagonist: s.antagonist, orbit: s.orbit, layers: s.layers, svg: r.svg ?? s.svg, label: s.label ?? '', labelBox: s.labelBox ?? [] });
}
await closePictures();
writeFileSync(SEED, JSON.stringify(out));
console.log(`seed: ${out.length} of ${seen} pictures kept → ${SEED} (${(statSync(SEED).size / 1e6).toFixed(2)} MB); skipped ${JSON.stringify(why)}`);
