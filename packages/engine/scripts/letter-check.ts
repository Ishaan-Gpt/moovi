// tsx scripts/letter-check.ts <a.svg> [b.svg …]: the no-lettering check on saved pictures (letters drawn as shapes, <text>)
import { readFileSync } from 'node:fs';
import { closePictures, raster } from '../src/s4/picture';
import { STAGE } from '../src/darkvox/film';
for (const f of process.argv.slice(2)) {
  const r = await raster(readFileSync(f, 'utf8'), STAGE.hero, false, true);
  console.log(`${f.split(/[\/]/).slice(-3).join('/')}: glyphs ${r.glyphs} texts ${r.texts} ${r.glyphErr ?? ""}${r.error ? ` error ${r.error}` : ''}`);
}
await closePictures();
