// pnpm --filter @moovi/engine exec tsx --env-file-if-exists=../../.env.local scripts/ref-intake.ts <id> <url-or-file>
// One command for a new video reference: download (yt-dlp) or copy, probe, scene cuts, 1 fps contact sheets, 2 fps
// frames for side-by-side checks, the voice track, word timings (Whisper via the user's key) and a timed transcript.
// Everything lands in data/refs/<id>/ (gitignored). Prints a summary to read before the shot list.
import { execFileSync, spawnSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { transcribeWords } from '../src/audio/stt';

const [id, src] = process.argv.slice(2);
if (!id || !src) { console.error('usage: ref-intake.ts <id> <url-or-file>'); process.exit(1); }
const dir = join(import.meta.dirname, '../../../data/refs', id);
mkdirSync(join(dir, 'f'), { recursive: true });
const sh = (cmd: string, args: string[]) => execFileSync(cmd, args, { cwd: dir, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 1 << 26 });
const t0 = performance.now(), lap = (l: string) => console.log(`${l}: ${((performance.now() - t0) / 1000).toFixed(1)} s`);

if (!existsSync(join(dir, 'ref.mp4'))) {
  if (/^https?:/.test(src)) sh('yt-dlp', ['-q', '--no-warnings', '-f', 'bv*+ba/b', '--merge-output-format', 'mp4', '-o', 'ref.%(ext)s', '--write-info-json', src]);
  else copyFileSync(src, join(dir, 'ref.mp4'));
}
lap('download');
const probe = JSON.parse(sh('ffprobe', ['-v', 'error', '-show_entries', 'format=duration:stream=width,height,r_frame_rate', '-of', 'json', 'ref.mp4']));
const seconds = +probe.format.duration;
// scene cuts (ffmpeg writes showinfo to stderr)
const cuts = [...spawnSync('ffmpeg', ['-hide_banner', '-i', 'ref.mp4', '-vf', "select='gt(scene,0.25)',showinfo", '-an', '-f', 'null', '-'], { cwd: dir, encoding: 'utf8', maxBuffer: 1 << 26 }).stderr.matchAll(/pts_time:([0-9.]+)/g)].map(m => +(+m[1]!).toFixed(2));
writeFileSync(join(dir, 'cuts.txt'), cuts.join(' '));
lap('cuts');
sh('ffmpeg', ['-v', 'error', '-y', '-i', 'ref.mp4', '-vf', 'fps=1,scale=216:384,tile=6x4', 'sheet%d.png']);
sh('ffmpeg', ['-v', 'error', '-y', '-i', 'ref.mp4', '-vf', 'fps=2,scale=270:480', 'f/%03d.jpg']);
sh('ffmpeg', ['-v', 'error', '-y', '-i', 'ref.mp4', '-vn', '-ac', '1', '-ar', '44100', '-b:a', '128k', 'voice.mp3']);
lap('sheets + voice');
if (!existsSync(join(dir, 'words.json'))) writeFileSync(join(dir, 'words.json'), JSON.stringify(await transcribeWords(join(dir, 'ref.mp4'), dir, { maxSeconds: Math.ceil(seconds) + 5 })));
const words = JSON.parse(readFileSync(join(dir, 'words.json'), 'utf8')) as { word: string; t: number }[];
lap('words');
let line = '', last = -9; const lines: string[] = [];
for (const w of words) { if (w.t - last >= 4) { if (line) lines.push(line); line = `[${w.t.toFixed(1)}] `; last = w.t; } line += `${w.word} `; }
lines.push(line); writeFileSync(join(dir, 'transcript.txt'), lines.join('\n'));
const info = existsSync(join(dir, 'ref.info.json')) ? JSON.parse(readFileSync(join(dir, 'ref.info.json'), 'utf8')) : {};
console.log(JSON.stringify({ id, seconds: +seconds.toFixed(2), size: `${probe.streams[0]?.width}x${probe.streams[0]?.height}`, fps: probe.streams[0]?.r_frame_rate, cuts: cuts.length, perSecond: +(cuts.length / seconds).toFixed(2), words: words.length, by: info.uploader ?? null, sheets: Math.ceil(seconds / 24) }, null, 1));
console.log(lines.join('\n'));

console.log(`\nNext: read the sheets and mark every span that shows real footage (b-roll, a photo, a clip on a card or inside a
device). Fetch each one before building, so nothing is a frozen stand-in:
  pnpm --filter @moovi/engine exec tsx --env-file-if-exists=../../.env.local scripts/ref-footage.ts ${id} name="what it shows" …
and draw it with footage(t, name, …) from kits/motion/footage.js.`);
