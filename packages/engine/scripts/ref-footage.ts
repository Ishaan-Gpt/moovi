// pnpm --filter @moovi/engine exec tsx --env-file-if-exists=../../.env.local scripts/ref-footage.ts <id> <name>="<query>" [<name>="<query>" …] [--seconds 8]
// Real footage for a reference clone. Where the reference cuts to b-roll or a photo (a clip on a card, a video in an
// app, plants behind the words), a drawn stand-in reads as a paused frame, so fetch the real thing instead: each
// query goes through the footage finder (src/footage: Mixkit, Commons, Pixabay, Pexels, NASA, Archive, ranked and
// judged; a slow push-in on a Commons still when nothing moving passes). Clips land in data/refs/<id>/footage/<name>.mp4
// with a poster and a footage.json manifest (source, author, licence, credit) that the kits' footage() plays. Each clip
// is also an (:Asset {category:'insert', vendored:false}) linked to the reference with HAS_PART {role:'footage: <name>'}.
import { copyFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { CRAFT, closeMemory, health, library, run, seedLibrary, type AssetRow } from '@moovi/graph';
import { findClipsOrStill, type Clip } from '../src/footage';
import { ensureDir } from '../src/bench';

interface Entry { file: string; poster: string | null; query: string; provider: string; title: string; page: string | null; author: string | null; licence: string; licenceUrl: string | null; credit: string; sha: string | null; seconds: number; still: boolean; asset: string }

const [id, ...rest] = process.argv.slice(2);
const sIdx = rest.indexOf('--seconds'), seconds = sIdx >= 0 ? Number(rest[sIdx + 1]) : 8;
const asks = rest.filter((a, i) => a.includes('=') && (sIdx < 0 || i !== sIdx + 1)).map(a => { const k = a.indexOf('='); return { name: a.slice(0, k).replace(/[^a-z0-9-]/gi, '-').toLowerCase(), query: a.slice(k + 1) }; });
if (!id || !asks.length) { console.error('usage: ref-footage <id> <name>="<query>" … [--seconds 8]'); process.exit(1); }

const ROOT = join(import.meta.dirname, '../../..'), dir = ensureDir(join(ROOT, 'data/refs', id, 'footage'));
const manifestFile = join(dir, 'footage.json');
const manifest: Record<string, Entry> = existsSync(manifestFile) ? JSON.parse(readFileSync(manifestFile, 'utf8')) : {};
const credit = (c: Clip) => `"${c.title}"${c.author ? ` by ${c.author}` : ''}, ${c.provider}, ${c.licence}`;

for (const a of asks) {
  const t0 = Date.now();
  const r = await findClipsOrStill(a.query, { dir: join(dir, '.search', a.name), want: 1, tries: 5, seconds, log: s => console.log(`  ${a.name}: ${s}`) });
  const c = r.accepted[0];
  if (!c?.path) { console.log(`✗ ${a.name}: nothing passed for "${a.query}" (${r.rejected.length} rejected) — keep a labelled stand-in and ask for the asset`); continue; }
  const file = join(dir, `${a.name}.mp4`), poster = c.poster ? join(dir, `${a.name}.jpg`) : null;
  copyFileSync(c.path, file); if (c.poster && poster) copyFileSync(c.poster, poster);
  manifest[a.name] = { file: `${a.name}.mp4`, poster: poster ? `${a.name}.jpg` : null, query: a.query, provider: c.provider, title: c.title, page: c.page ?? null, author: c.author ?? null,
    licence: c.licence, licenceUrl: c.licenceUrl ?? null, credit: credit(c), sha: c.sha ?? null, seconds: c.duration ?? seconds, still: !!c.still, asset: `insert:${c.id}` };
  console.log(`✓ ${a.name}: ${c.provider} "${c.title}" (${c.licence}${c.still ? ', still push-in' : ''}) in ${((Date.now() - t0) / 1000).toFixed(1)} s`);
}
writeFileSync(manifestFile, JSON.stringify(manifest, null, 1) + '\n');

// the graph: every clip this reference uses, as an insert asset (one seed per reference, so a re-run replaces them)
const h = await health();
if (!h.ok) { console.log(`FalkorDB not reachable (${h.error}); manifest written, graph skipped`); process.exit(0); }
const byAsset = new Map(Object.entries(manifest).map(([name, e]) => [e.asset, { name, e }]));
const rows: AssetRow[] = [...byAsset.values()].map(({ name, e }) => ({
  id: e.asset, category: 'insert', name: e.title.slice(0, 120), about: `${e.still ? 'a slow push-in on a still photo' : 'stock footage'} found for "${e.query}" (reference ${id}, ${name})`,
  runtime: ['browser', 'ffmpeg'], impl: { browser: `data/refs/${id}/footage/${e.file}`, ffmpeg: `data/refs/${id}/footage/${e.file}` },
  licence: e.licence, credit: e.credit, ship: !/unverified|see source|\bNC\b|\bND\b/i.test(e.licence), attribution: /\bBY\b/i.test(e.licence),
  file: `data/refs/${id}/footage/${e.file}`, vendored: false, energy: null, tags: ['footage', 'from-reference', e.provider, ...(e.still ? ['still'] : [])],
  params: { provider: e.provider, page: e.page, author: e.author, licenceUrl: e.licenceUrl, sha256: e.sha, seconds: e.seconds, query: e.query }, src: 'packages/engine/src/footage', needs: [],
}));
await seedLibrary([{ seed: `ref-footage:${id}`, rows }]);
await run(CRAFT, library.addReferenceParts, { ref: `ref:${id}`, rows: [...byAsset.values()].map(({ name, e }) => ({ id: e.asset, role: `footage: ${name}`, at: null, note: e.query })) });
console.log(`graph: ${rows.length} footage asset(s) linked to ref:${id}`);
await closeMemory();
