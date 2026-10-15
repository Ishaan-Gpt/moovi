// pnpm s1:preview <dir> [id]: play <dir>/<id>.json live in the browser with its audio. Ctrl+C to stop.
import { basename, resolve } from 'node:path';
import { servePreview } from '../src/s1fast/preview';

const dir = resolve(process.argv[2] ?? '.'), id = process.argv[3] ?? basename(dir);
const port = Number(process.env.PREVIEW_PORT ?? 4791);
const { url } = await servePreview(dir, id, port);
console.log(`preview: ${url}`);
