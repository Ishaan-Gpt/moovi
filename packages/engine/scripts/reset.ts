// pnpm graph:reset [--all]
// Resets FalkorDB to the state the product needs: the shared `craft` graph holds style and craft knowledge only
// (no brand, no client, no film of the owner's), every brand-era graph is gone, and the `sys` graph exists.
// --all also drops every user_* and proj_* graph (development only: it deletes every account's work).
import { CRAFT, SYS, closeMemory, craft, dropGraph, ensureSys, health, listGraphs, run, seedCraft, seedSignatures, seedStylePackage } from '@moovi/graph';
import { PACKAGES, SIGNATURES, type StylePackage } from '@moovi/skills';
import { S1_PRESETS, S1_PRESET_FLOWS } from '@moovi/skills';
import { seedLibraryGraph } from '../src/library/seed';

/** Brand and client-film names that must never be in craft (the owner's MotionEasy brands and films). */
const BRAND = /captions ?easy|eegnite|\boped\b|\bce[0-9]?-[0-9]{2}\b|eg-avatar|\bnb-01\b|\beg-01\b|insiderforce/i;

const all = process.argv.includes('--all');
const h = await health();
if (!h.ok) { console.error(`FalkorDB is not reachable at ${process.env.FALKORDB_URL ?? 'falkor://localhost:6379'}: ${h.error}`); process.exit(1); }

const before = await listGraphs();
const drop = before.filter(g => g === CRAFT || g.startsWith('brand_') || (all && (g === SYS || g.startsWith('user_') || g.startsWith('proj_'))));
for (const g of drop) await dropGraph(g);
console.log(`dropped: ${drop.join(', ') || '(nothing)'}`);

const t0 = performance.now();
const c = await seedCraft();
const seedPkg = (p: StylePackage, extra: Partial<Parameters<typeof seedStylePackage>[0]> = {}) => seedStylePackage({
  style: p.style,
  skill: { ...p.skill, sections: p.skill.sections.map(s => ({ id: s.id, title: s.title, roles: s.roles, text: s.text })) },
  laws: p.laws.map(l => ({ ...l, checks: l.checks.map(k => ({ id: k.id, kind: k.kind, about: k.about, params: { ...k.params, owner: k.owner }, blocking: k.blocking })) })),
  stage: p.stage, ...extra,
});
const s1 = await seedPkg(PACKAGES.s1!, { presets: S1_PRESETS.map(p => ({ ...p, roles: [...p.roles], needs: [...p.needs] })), presetFlows: S1_PRESET_FLOWS });
const un = await seedPkg(PACKAGES.unique!);
const sigs = await seedSignatures(SIGNATURES.map(s => ({ ...s, formats: [...s.formats] })));
const lib = await seedLibraryGraph();
await ensureSys();

// the scrub check: every craft node's properties, scanned for brand and client-film names
const rows = await run<{ label: string; id: string; props: Record<string, unknown> }>(CRAFT, craft.allProps);
const leaks = rows.filter(r => BRAND.test(JSON.stringify(r.props)));
const counts = await run<{ label: string; n: number }>(CRAFT, craft.counts);
console.log(JSON.stringify({ craft: c, s1, unique: un, signatures: sigs, library: lib, counts: Object.fromEntries(counts.map(x => [x.label, x.n])) }, null, 1));
console.log(`graphs now: ${(await listGraphs()).join(', ')}`);
console.log(`seeded in ${((performance.now() - t0) / 1000).toFixed(1)} s`);
if (leaks.length) {
  console.error(`BRAND LEAKS in craft (${leaks.length}):`);
  for (const l of leaks.slice(0, 20)) console.error(`  ${l.label} ${l.id}: ${JSON.stringify(l.props).match(BRAND)?.[0]}`);
  await closeMemory();
  process.exit(1);
}
console.log(`scrub check: ${rows.length} craft nodes scanned, 0 brand references`);
await closeMemory();
