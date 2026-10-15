// Anatomy safe-area check at the contact sheet's times, with the player's own frame code: the watched content (the
// whole figure in an overview, the pushed-in part in a push-in) and every callout inside the safe area.
//   tsx scripts/anatomy-safe.ts <data/anatomy/<id>> [...more dirs]
/* eslint-disable @typescript-eslint/no-explicit-any */
import { readFileSync } from 'node:fs';
import { ISO } from '../src/anatomy/iso';
const dirs = process.argv.slice(2);
for (const d of dirs) {
  const F = JSON.parse(readFileSync(`${d}/film.json`, 'utf8')), S = F.tokens.SAFE, W = S.window;
  let bad = 0, n = 0, worst = '', faded = 0;
  for (let t = 0.5; t < F.duration - 0.1; t += 1.5) {
    n++; const fr: any = ISO.frame(F, t);
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9, sx0 = 1e9, sy0 = 1e9, sx1 = -1e9, sy1 = -1e9;
    for (const O of fr.objs) for (const it of O.items) { if (!it.settled) continue; const b = ISO.bboxScreen(ISO.primPts(it.pr, it.o), fr.P) as [number, number, number, number]; x0 = Math.min(x0, b[0]); y0 = Math.min(y0, b[1]); x1 = Math.max(x1, b[2]); y1 = Math.max(y1, b[3]); if (fr.focus < 0 || (O.kind === 'asm' && O.i === fr.focus)) { sx0 = Math.min(sx0, b[0]); sy0 = Math.min(sy0, b[1]); sx1 = Math.max(sx1, b[2]); sy1 = Math.max(sy1, b[3]); } }
    const subjOut = sx1 > sx0 && (sx0 < S.scene.x0 - 6 || sx1 > S.scene.x1 + 6 || sy0 < S.scene.y0 - 6 || sy1 > S.scene.y1 + 6);
    const labOut = fr.labels.some((l: any) => l.x < S.x0 || l.x + l.w > S.x1 || l.y < S.y0 || l.y + l.h > S.y1);
    if (subjOut || labOut) { bad++; worst += ` t=${t.toFixed(1)}(${fr.focus >= 0 ? 'push' : 'overview'} ${sx0.toFixed(0)},${sy0.toFixed(0)}-${sx1.toFixed(0)},${sy1.toFixed(0)}${labOut ? ' label' : ''})`; }
    if (x1 > x0 && (x0 < S.scene.x0 - 6 || x1 > S.scene.x1 + 6 || y0 < S.scene.y0 - 6 || y1 > S.scene.y1 + 6)) faded++;
    void W;
  }
  console.log(`${d.split(/[\/]/).pop()}: ${n - bad}/${n} sheet times with the watched content + callouts inside the safe area; ${faded} with other content running into the window's fade (push-ins)${worst ? ';' + worst : ''}`);
}
