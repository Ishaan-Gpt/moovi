import { mkdirSync, readFileSync, writeFileSync, copyFileSync } from 'node:fs';
import { basename, extname, join, resolve } from 'node:path';
import { hear } from '../src/edit/hear';
import { planEdit } from '../src/edit/plan';
import type { Word } from '../src/edit/cut';

/**
 * Plan an edit of one clip from the terminal and print the stage seconds, the gate and the EDL metrics:
 *   tsx scripts/edit-plan.ts <clip> [--out dir] [--words words.json] [--lang en] [--brief "text"] [--names A,B] [--tag] [--copy]
 * Writes <out>/edl.json and <out>/words.json; --copy also puts the clip beside them as src.<ext> so the preview
 * player (scripts/edit-preview.ts) can play the folder.
 */
const args = process.argv.slice(2), flag = (k: string) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : undefined; };
const clip = resolve(args[0] ?? ''); if (!args[0]) { console.error('usage: edit-plan.ts <clip> [--out dir] [--words f] [--lang xx] [--brief text] [--tag] [--copy]'); process.exit(2); }
const out = resolve(flag('--out') ?? join('.bench', 'edit', basename(clip, extname(clip))));
mkdirSync(out, { recursive: true });
const wf = flag('--words'), lang = flag('--lang'), brief = flag('--brief') ?? '', names = (flag('--names') ?? '').split(',').map(x => x.trim()).filter(Boolean);
const file = `src${extname(clip).toLowerCase() || '.mp4'}`;
if (args.includes('--copy')) copyFileSync(clip, join(out, file));
let heardInfo: unknown = null;
const plan = await planEdit({
  input: clip, dir: out, file, tag: args.includes('--tag'),
  palette: { ink: '#0b0b0f', paper: '#f4f1ea', accent: '#e8c547', accent2: '#7aa7ff', deep: '#15151c', pop: '#ffffff' },
  ...(wf ? { words: JSON.parse(readFileSync(wf, 'utf8')) as Word[] } : { hear: async (audio: string, dir: string) => { const h = await hear(audio, dir, { ...(lang ? { lang } : {}), brief, names }); heardInfo = { by: h.by, lang: h.lang, language: h.language, prompt: h.prompt, detected: h.detected, gate: h.gate, pieces: h.pieces, timings: h.timings }; return h.words; } }),
});
writeFileSync(join(out, 'edl.json'), JSON.stringify(plan.edl, null, 1));
writeFileSync(join(out, 'words.json'), JSON.stringify(plan.words, null, 1));
console.log(JSON.stringify({ clip: basename(clip), timings: plan.timings, heard: heardInfo, problems: plan.problems, faces: plan.faces, layouts: plan.edl.shots.map(s => s.layout).join(' '), shots: plan.edl.shots.length, removed: plan.edl.removed?.map(r => `${r.reason} ${r.src_in.toFixed(2)}-${r.src_out.toFixed(2)}${r.text ? ' "' + r.text + '"' : ''}`), metrics: plan.edl.metrics, transcript: plan.words.map(w => w.word).join(' ') }, null, 1));
