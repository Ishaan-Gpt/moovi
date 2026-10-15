// pnpm --filter @moovi/engine exec tsx --env-file-if-exists=../../.env.local scripts/render-check.ts
// M0 check: the kit's timeline renders in the pool; a frame-range chunk matches the same frames of a full render.
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { Kit, kit, type SceneProgram } from '@moovi/skills';
import { ensureDir, sh, probe } from '../src/bench';
import { config } from '../src/config';
import { boxes, chunk, closeRender, still } from '../src/render/host';
import { describe, geometry } from '../src/render/qa';

const out = ensureDir(join(config.data, 'checks'));
const beats = [
  { say: 'Your to-do list lies to you every morning.' },
  { say: 'Voice notes pile up, ideas get lost, nothing gets done.' },
  { say: 'Notely listens and writes the list for you.' },
  { say: 'Comment notely and I will send you the link.' },
];
const k = new Kit({ beats, words: kit.readingPace(beats), stage: kit.stageFrom({ accent: '#E8735A' }), format: 'vertical', assets: r => r });
const progs: SceneProgram[] = [
  { name: 'hook', preset: { id: 'stack_slam', lines: ['Your to-do list', '*LIES*'] }, layers: [{ kind: 'image', draw: 'note', p: { title: 'To-do', items: [['Plan the week', true], ['Ship it', false]], pulseAt: { w: 'lies' } }, cx: 540, cy: 1250, w: 560, h: 370, rot: -3, enter: 'rise', at: 6 }] },
  { name: 'pile', preset: { id: 'notif', lines: ['Ideas get', '~lost'], cards: [{ app: 'Notes', title: 'Voice note 14', body: 'remember the thing' }, { app: 'Notes', title: 'Voice note 15', body: 'the other thing' }] } },
  { name: 'answer', preset: { id: 'flip', lines: ['Notely writes', 'the list'], word: 'NOTELY' } },
  { name: 'cta', preset: { id: 'cta_comment', keyword: 'notely', bubble: 'Sent! Check your DMs' } },
];
const a = k.assemble(progs.map((p, i) => k.compile(i, p)));
writeFileSync(join(out, 'timeline.json'), JSON.stringify(a.spec, null, 1));
console.log(`timeline: ${k.frames} frames, scenes ${JSON.stringify(a.report.scenes)}, words matched ${a.report.matched}/${a.report.tokens}`);

let t0 = performance.now();
const s = await still(a.spec, 1.5, 0.5);
writeFileSync(join(out, 'still.png'), Buffer.from(s.png, 'base64'));
console.log(`still: ${(performance.now() - t0).toFixed(0)} ms (first, incl. page load), ${s.boxes?.length ?? 0} boxes`);

t0 = performance.now();
const fr = await boxes(a.spec, Array.from({ length: Math.ceil(k.frames / 2) }, (_, i) => i * 2), 30);
const issues = geometry(fr, { fps: 30, every: 2, format: 'vertical', entering: f => a.timeline.scenes.some(sc => sc.enter && f >= sc.f0 && f < sc.f0 + 24) });
console.log(`geometry QA: ${fr.length} frames in ${(performance.now() - t0).toFixed(0)} ms → ${issues.length} issue(s)\n${describe(issues)}`);

t0 = performance.now();
const c = await chunk(a.spec, 100, 160, join(out, 'chunk-100-160.mp4'));
const tc = performance.now() - t0;
t0 = performance.now();
await chunk(a.spec, 0, k.frames, join(out, 'full.mp4'));
const tf = performance.now() - t0;
console.log(`chunk 100–160: ${c.frames} frames, ${c.codec}, ${(tc / c.frames).toFixed(0)} ms/frame · full: ${k.frames} frames, ${(tf / k.frames).toFixed(0)} ms/frame`);
const pc = await probe(join(out, 'chunk-100-160.mp4')), pf = await probe(join(out, 'full.mp4'));
console.log(`probe: chunk ${pc.duration}s ${pc.width}x${pc.height}, full ${pf.duration}s`);

// frame 130 of the film = frame 30 of the chunk
for (const [file, n, name] of [[join(out, 'chunk-100-160.mp4'), 30, 'a'], [join(out, 'full.mp4'), 130, 'b']] as const) {
  await sh(config.ffmpeg, ['-v', 'error', '-y', '-i', file, '-vf', `select=eq(n\\,${n})`, '-vsync', '0', '-frames:v', '1', join(out, `f130-${name}.png`)]);
}
const { stderr } = await sh(config.ffmpeg, ['-hide_banner', '-i', join(out, 'f130-a.png'), '-i', join(out, 'f130-b.png'), '-lavfi', 'ssim;[0:v][1:v]psnr', '-f', 'null', '-']);
console.log(`frame 130, chunk vs full: ${stderr.match(/SSIM [^\n]*/)?.[0]} | ${stderr.match(/PSNR [^\n]*/)?.[0]}`);
await closeRender();
