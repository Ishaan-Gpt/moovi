// Fetches the tabletop world's real assets (Poly Haven, CC0: photoscanned models, a surface, an HDRI) into
// data/world/ (git-ignored). Run from the worktree root: node docs/agents/mastery/edit-player/fetch-world.mjs [ids...]
import { mkdirSync, writeFileSync, existsSync } from 'node:fs'; import { dirname, join } from 'node:path';
const ROOT = 'data/world';
const MODELS = ['classic_laptop', 'lightbulb_01', 'Megaphone_01', 'stationery_supplies', 'calathea_orbifolia_01', 'tea_set_01', 'office_notepads', 'postcard_set_01', 'fern_02', 'SchoolDesk_01'];
const TEXTURES = ['beige_wall_001', 'white_plaster_rough_02', 'rough_linen'];
const HDRIS = ['photo_studio_loft_hall'];
const want = process.argv.slice(2);
const get = async u => { const r = await fetch(u); if (!r.ok) throw new Error(`${r.status} ${u}`); return Buffer.from(await r.arrayBuffer()); };
const save = async (u, f) => { if (existsSync(f)) return; mkdirSync(dirname(f), { recursive: true }); writeFileSync(f, await get(u)); console.log('  ', f); };
const credits = [];
for (const id of MODELS.filter(x => !want.length || want.includes(x))) {
  const f = JSON.parse(await get(`https://api.polyhaven.com/files/${id}`)), g = f.gltf['1k'].gltf;
  await save(g.url, join(ROOT, id, `${id}.gltf`)); for (const [p, v] of Object.entries(g.include || {})) await save(v.url, join(ROOT, id, p));
  credits.push(`${id}: https://polyhaven.com/a/${id} (CC0)`);
}
for (const id of TEXTURES.filter(x => !want.length || want.includes(x))) {
  const f = JSON.parse(await get(`https://api.polyhaven.com/files/${id}`));
  for (const [k, n] of [['Diffuse', 'diff'], ['nor_gl', 'nor'], ['Rough', 'rough']]) { const m = f[k]?.['2k']?.jpg; if (m) await save(m.url, join(ROOT, 'tex', `${id}_${n}.jpg`)); }
  credits.push(`${id}: https://polyhaven.com/a/${id} (CC0)`);
}
for (const id of HDRIS.filter(x => !want.length || want.includes(x))) {
  const f = JSON.parse(await get(`https://api.polyhaven.com/files/${id}`)); await save(f.hdri['1k'].hdr.url, join(ROOT, 'hdri', `${id}_1k.hdr`));
  credits.push(`${id}: https://polyhaven.com/a/${id} (CC0)`);
}
writeFileSync(join(ROOT, 'CREDITS.txt'), 'All assets from Poly Haven, CC0 (public domain, no attribution required).\n' + credits.join('\n') + '\n');
