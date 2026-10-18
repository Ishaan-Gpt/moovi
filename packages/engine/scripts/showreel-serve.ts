// Serve finished Showreel films on their own theme players (no model calls, no rendering), one process for all of them.
//   tsx scripts/showreel-serve.ts <theme>=<film dir> ... [--port 4321]   (themes: editorial, real-footage, night-stage, blueprint)
// Each film gets the next port up from --port.
import { resolve } from 'node:path';
import { servePlayer } from '../src/s4/player';
import { serveDarkVox } from '../src/darkvox/player';
import { serveAnatomy } from '../src/anatomy/player';
import { PAGE as EDIT_PAGE } from '../src/edit/page';

const args = process.argv.slice(2), i = args.indexOf('--port'), base = i >= 0 ? Number(args[i + 1]) : 4321;
const serve: Record<string, (dir: string, port: number) => Promise<{ url: string }>> = {
  editorial: (d, p) => servePlayer(d, p), 'real-footage': (d, p) => servePlayer(d, p, EDIT_PAGE), 'night-stage': serveDarkVox, blueprint: serveAnatomy,
};
let port = base;
for (const a of args.filter(x => x.includes('='))) {
  const [theme, dir] = a.split('=') as [string, string];
  if (!serve[theme]) throw new Error(`unknown theme ${theme}`);
  const { url } = await serve[theme](resolve(dir), port++);
  console.log(`${theme.padEnd(13)} ${url}`);
}
