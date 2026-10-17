// The edit's jump cuts baked into one file (cut.mp4) so the preview plays straight through: no seek at a cut, no stall.
// cut.json maps the cut file's clock back to the clip's own (source) clock: [[srcStart, srcEnd, outStart], ...].
// usage: node build-cut.mjs <clip dir with hd.mp4 + edl.json> [--grade "<ffmpeg filter chain>"] (a grade baked in: no canvas filter at play time)
import { readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
const dir = process.argv[2], gi = process.argv.indexOf('--grade'), grade = gi > 0 ? process.argv[gi + 1] : '', edl = JSON.parse(readFileSync(join(dir, 'edl.json'), 'utf8')), D = edl.source.duration;
const cuts = (edl.removed || []).map(r => [r.src_in, r.src_out]).sort((a, b) => a[0] - b[0]);
const keep = []; let cur = 0;
for (const [a, b] of cuts) { if (a > cur + 0.02) keep.push([cur, a]); cur = Math.max(cur, b); }
if (D > cur + 0.02) keep.push([cur, D]);
let o = 0; const map = keep.map(([a, b]) => { const r = [+a.toFixed(3), +b.toFixed(3), +o.toFixed(3)]; o += b - a; return r; });
const v = keep.map(([a, b], i) => `[0:v]trim=${a.toFixed(3)}:${b.toFixed(3)},setpts=PTS-STARTPTS[v${i}];[0:a]atrim=${a.toFixed(3)}:${b.toFixed(3)},asetpts=PTS-STARTPTS,afade=t=in:d=0.012,afade=t=out:st=${Math.max(0, b - a - 0.012).toFixed(3)}:d=0.012[a${i}]`).join(';');
const cat = keep.map((_, i) => `[v${i}][a${i}]`).join('') + `concat=n=${keep.length}:v=1:a=1[vc][a];[vc]${grade || 'null'}[v]`;
execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', join(dir, 'hd.mp4'), '-filter_complex', `${v};${cat}`, '-map', '[v]', '-map', '[a]', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '17', '-g', '15', '-c:a', 'aac', '-b:a', '192k', '-movflags', '+faststart', join(dir, 'cut.mp4')]);
writeFileSync(join(dir, 'cut.json'), JSON.stringify({ map }, null, 1));
console.log(`cut.mp4: ${keep.length} pieces, ${o.toFixed(2)} s`);
