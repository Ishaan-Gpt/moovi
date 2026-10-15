import { join } from 'node:path';
import { config } from '../src/config';
import { closeVisual, recordTestClip } from '../src/visual/capture';
/** two small WebM clips in data/visual-test (recorded in the browser, no ffmpeg): tsx scripts/test-clips.ts */
for (const n of ['clipA', 'clipB']) console.log(await recordTestClip(join(config.data, 'visual-test', `${n}.webm`), 3, [320, 568]));
await closeVisual();
