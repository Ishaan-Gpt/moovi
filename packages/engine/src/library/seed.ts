import { CRAFT, library, run, seedLibrary } from '@moovi/graph';
import { catalogue } from './catalog';
import { X1, eventAliases, styleCast } from './edit-styles';

/**
 * The links that span seeds, run after any seed (catalogue, a reference, the camera layer): the EDL's sfx events as
 * aliases on (:Event), each edit style's cast as SUITS {w, src:'cast'} (ids not in the graph are skipped), and X1
 * numbers on assets other seeds own.
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
  return { cast: cast.length, suits, x1Tagged: tagged };
}

/** Put the whole library (./catalog.ts) into the craft graph. Idempotent; the reset runs it after the craft seed. */
export async function seedLibraryGraph() {
  const seeds = catalogue();
  const r = await seedLibrary(seeds);
  const x = await seedCrossLinks();
  return { ...r, ...x, perCategory: Object.fromEntries(seeds.map(s => [s.seed.replace(/^repo:/, ''), s.rows.length])) };
}
