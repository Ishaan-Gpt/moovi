// Prepare a clip for the edit player with Moovi's own edit job: transcript (words.json), cuts and faces (edl.json),
// the owner's grade / restore (hd.mp4). Usage (from packages/engine):
//   pnpm exec tsx --env-file-if-exists=../../.env.local ../../docs/submission/demo/prep-edit.ts <clip.mp4> <out dir>
import { planEdit } from '../../../packages/engine/src/edit/job';
const [clip, dir] = process.argv.slice(2);
const t0 = Date.now();
const p = await planEdit({ path: clip!, dir: dir!, name: 'src.mp4', brand: { name: 'Moovi', url: 'moovi-three.vercel.app', tagline: 'Your video production team' }, onDone: (s, n) => console.log(`  ${s} ${n}s`), onNote: t => console.log('  note:', t) });
const [v, r, m] = await Promise.all([p.voice, p.restore, p.mix]);
console.log('done in', ((Date.now() - t0) / 1000).toFixed(1), 's · voice', !!v, '· restore', r && { restored: r.restored, graded: r.graded }, '· mix', m);
process.exit(0);
