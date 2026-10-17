import { CRAFT, library, run, seedLibrary } from '@moovi/graph';
import { catalogue } from './catalog';
import { X1, eventAliases, styleCast } from './edit-styles';
import { linkReferenceUses, referenceFiles, seedReference } from './reference';
import { seedTypes } from './types';

/**
 * The links that span seeds, run after any seed (catalogue, a reference, the camera layer): the EDL's sfx events as
 * aliases on (:Event), each edit style's cast as SUITS {w, src:'cast'} (ids not in the graph are skipped), X1
 * numbers on assets other seeds own, and the type registry: (:Type), its looks and references, IN_TYPE (./types.ts).
 */
export async function seedCrossLinks() {
  const rows = catalogue().flatMap(s => s.rows);
  await run(CRAFT, library.linkEventAliases, { rows: eventAliases() });
  await run(CRAFT, library.clearStyleCast, {});
  const cast = styleCast(rows);
  let suits = 0;
  for (let i = 0; i < cast.length; i += 500) suits += (await run<{ edges: number }>(CRAFT, library.linkAssetStyles, { rows: cast.slice(i, i + 500) }))[0]?.edges ?? 0;
  const tags = Object.entries(X1).flatMap(([n, [, , ids]]) => ids.map(id => ({ id, tag: `x1:${n}` })));
  const tagged = (await run<{ tagged: number }>(CRAFT, library.addAssetTags, { rows: tags }))[0]?.tagged ?? 0;
  // the type registry is new (W2) and nothing reads it yet: a failure here is reported, never fails the library seed
  const typed = await seedTypes().catch((e: unknown) => { console.warn(`seedTypes: ${String(e)}`); return { typesError: String(e) }; });
  return { cast: cast.length, suits, x1Tagged: tagged, ...typed };
}

/**
 * Put the whole library into the craft graph: the catalogue (./catalog.ts, the camera layer included), then every
 * reference in the repo (data/refs/<id>/parts.json, with its kit), then the cross-seed links. Idempotent; the reset
 * and the server's seed container run it, so the live graph matches the repo.
 */
export async function seedLibraryGraph() {
  const seeds = catalogue();
  const r = await seedLibrary(seeds);
  const refs = [];
  for (const f of referenceFiles()) refs.push((await seedReference(f)).ref);
  // a reference may use a part a later reference taught: link every reference's uses once all parts exist
  for (const f of referenceFiles()) await linkReferenceUses(f);
  const x = await seedCrossLinks();
  return { ...r, ...x, references: refs, perCategory: Object.fromEntries(seeds.map(s => [s.seed.replace(/^repo:/, ''), s.rows.length])) };
}
