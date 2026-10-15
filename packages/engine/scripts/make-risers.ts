/** Synthesize the kit's three risers into assets/sfx (deterministic: the same files every run). */
import { join } from 'node:path';
import { config } from '../src/config';
import { SR, synthRiser } from '../src/audio/mix';
import { writeWav } from '../src/audio/wav';

for (const [file, s, bright] of [['riser.wav', 3.0, false], ['riser-short.wav', 1.4, false], ['ui-riser.wav', 0.9, true]] as const) {
  writeWav(join(config.assets, 'sfx', file), { sr: SR, ch: [synthRiser(s, { bright })] });
  console.log(`${file} ${s}s`);
}
