import { footageEdit } from '../src/router/footage-edit';

/**
 * Edit a raw clip with Moovi's footage-edit mode:
 *   tsx scripts/footage-edit.ts <in.mp4> <out.mp4> [workdir] [names prompt] [fixes json] [captions kinetic|ce04]
 */
const [input, out, dir, prompt, fixes, captions] = process.argv.slice(2);
if (!input || !out) { console.error('usage: footage-edit <in.mp4> <out.mp4> [workdir] [prompt] [fixes json] [kinetic|ce04]'); process.exit(2); }
const r = await footageEdit({
  input, out, dir: dir ?? `${out}.work`, prompt, fixes: fixes ? JSON.parse(fixes) as Record<string, string> : undefined,
  captions: captions === 'ce04' ? 'ce04' : 'kinetic', end: { title: 'Moovi', line: 'the AI video editor' },
  log: s => console.error(`[footage-edit] ${s}`),
});
console.log(JSON.stringify(r));
