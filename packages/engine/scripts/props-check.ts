// tsx scripts/props-check.ts: draw every corner prop as a transparent PNG (data/checks/props), then a sheet on the stage.
import { join } from 'node:path';
import { config } from '../src/config';
import { closeRender } from '../src/render/host';
import { CORNER_PROPS, drawProp, pickCorners } from '../src/render/prop';

const dir = join(config.data, 'checks', 'props');
for (const p of CORNER_PROPS) {
  const t = Date.now();
  const r = await drawProp(p, join(dir, `${p.id}.png`));
  console.log(`${p.id}: ${r.w}×${r.h} (${Date.now() - t} ms)`);
}
console.log('voice-notes app →', pickCorners('Ramble into your phone, voice memos become a clean to-do list. Save ideas before they vanish.').map(p => p.id));
console.log('café promo →', pickCorners('A 15-second promo for a winter menu, warm and quick.').map(p => p.id));
await closeRender();
