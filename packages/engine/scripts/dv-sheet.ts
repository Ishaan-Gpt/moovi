// tsx scripts/dv-sheet.ts <darkvox film dir>: re-shoots a Dark Vox film's contact sheet with the current player (no model calls)
import { join, basename, dirname, resolve } from 'node:path';
import { readFileSync } from 'node:fs';
import { contactSheet } from '../src/styles/darkvox';
import { serveDarkVox } from '../src/darkvox/player';
const dir = resolve(process.argv[2]!), film = JSON.parse(readFileSync(join(dir, 'film.json'), 'utf8'));
const { url, close } = await serveDarkVox(dir, 0);
console.log(await contactSheet(url, dir, film.duration, null, join(dirname(dir), `${basename(dir)}-sheet.png`)));
close();
