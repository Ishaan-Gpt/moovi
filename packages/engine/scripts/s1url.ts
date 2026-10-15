// pnpm --filter @contenteasy/engine s1url <https://site> [--freeform] : a Style 1 reel for ANY brand from its website,
// no human step. A thin wrapper over src/styles/s1.ts, the same code the studio's style-reel job runs.
import { runStyle, table } from '../src/styles/run';

const url = process.argv[2]; if (!url) throw new Error('usage: s1url <https://site> [--freeform]');
const r = await runStyle('s1', { url, freeform: process.argv.includes('--freeform'), port: Number(process.env.PREVIEW_PORT ?? 4793) });
console.log(`\n${table({ cli: r.timings })}\nTOTAL ${r.timings.total}s · preview: ${r.preview}`);
console.log(`TIMINGS ${JSON.stringify(r.timings)}`);
