import { q } from './q';

/**
 * `craft`: the omnipotent library. Every reusable piece a film or an edit can cast (voices, sfx, music beds,
 * caption styles, transitions, effects, camera moves, UI components, 3D styles, inserts) is one node shape:
 *
 *   (:Asset {id, category, name, about, runtime[], licence, credit, ship, attribution, file, vendored, energy, tags[], params, impl, seed})
 *     -[:SERVES]->(:Need)        what it shows on screen (the same need words as the style libraries)
 *     -[:FITS]->(:Event)         the timeline cue it plays on (card-in, scene, key-word, ...)
 *     -[:SUITS]->(:EditStyle)    the edit styles it belongs to
 *     -[:IS_A]->(:Transition)    a transition implementation and its family (the craft graph's 12)
 *   (:Reference {id, url, title})-[:HAS_PART {role, at, note}]->(:Asset)   a video reference broken into parts
 *
 * Ids are `<category>:<slug>`. `runtime` lists who can play it (style1 canvas, visual compositor, render3d, the
 * styles' live players, edge-tts, ffmpeg, browser); `impl` (JSON) maps each runtime to its own id there, so one node
 * stands for the same idea in two codebases. `params` is JSON (FalkorDB holds flat arrays only). `ship` = the licence
 * is safe for a paid product; `vendored` = the file is in the repo (else it is only catalogued).
 */
export const library = {
  seedAssets: q('seedAssets', false, 'Idempotent seed of library assets: one (:Asset) per row, every field replaced (the catalogue in code is the truth).', `
UNWIND $rows AS r
MERGE (a:Asset {id: r.id})
SET a.category = r.category, a.name = r.name, a.about = r.about, a.runtime = r.runtime, a.licence = r.licence,
    a.credit = r.credit, a.ship = r.ship, a.attribution = r.attribution, a.file = r.file, a.vendored = r.vendored,
    a.energy = r.energy, a.tags = r.tags, a.params = r.params, a.impl = r.impl, a.seed = r.seed, a.src = r.src
RETURN count(a) AS assets`),

  linkAssetNeeds: q('linkAssetNeeds', false, 'An asset SERVES a need: (Asset)-[:SERVES {w}]->(Need); w is its rank (1 = strongest).', `
UNWIND $rows AS r
MATCH (a:Asset {id: r.id})
MERGE (n:Need {id: r.need})
MERGE (a)-[s:SERVES]->(n)
SET s.w = r.w
RETURN count(s) AS edges`),

  linkAssetEvents: q('linkAssetEvents', false, 'An asset FITS a timeline event (an sfx on card-in, a riser on build): (Asset)-[:FITS {gainDb}]->(Event).', `
UNWIND $rows AS r
MATCH (a:Asset {id: r.id})
MERGE (e:Event {id: r.event})
MERGE (a)-[f:FITS]->(e)
SET f.gainDb = r.gainDb, f.first = r.first
RETURN count(f) AS edges`),

  linkAssetStyles: q('linkAssetStyles', false, 'An asset SUITS an edit style: (Asset)-[:SUITS]->(EditStyle).', `
UNWIND $rows AS r
MATCH (a:Asset {id: r.id})
MERGE (s:EditStyle {id: r.style})
MERGE (a)-[e:SUITS]->(s)
RETURN count(e) AS edges`),

  linkAssetFamilies: q('linkAssetFamilies', false, 'A transition implementation IS_A transition family (the craft graph’s Transition nodes).', `
UNWIND $rows AS r
MATCH (a:Asset {id: r.id})
MERGE (t:Transition {id: r.family})
MERGE (a)-[e:IS_A]->(t)
RETURN count(e) AS edges`),

  clearAssetEdges: q('clearAssetEdges', false, 'Before a reseed: drop the SERVES / FITS / SUITS / IS_A edges of the seeded assets, so removed tags do not linger.', `
MATCH (a:Asset)-[e:SERVES|FITS|SUITS|IS_A]->()
WHERE a.seed IN $seeds
DELETE e
RETURN count(e) AS dropped`),

  retireAssets: q('retireAssets', false, 'Assets a seed no longer lists are removed (a renamed or deleted catalogue entry); assets from a reference breakdown are kept.', `
MATCH (a:Asset)
WHERE a.seed = $seed AND NOT a.id IN $ids
DETACH DELETE a
RETURN count(a) AS retired`),

  libraryCounts: q('libraryCounts', true, 'The library per category: how many, how many safe to ship, how many have their file in the repo.', `
MATCH (a:Asset)
RETURN a.category AS category, count(a) AS n,
       sum(CASE WHEN a.ship THEN 1 ELSE 0 END) AS shippable,
       sum(CASE WHEN a.vendored THEN 1 ELSE 0 END) AS vendored
ORDER BY category`),

  libraryGaps: q('libraryGaps', true, 'Categories still under the target count (the plan’s 50+ of each).', `
MATCH (a:Asset)
WITH a.category AS category, count(a) AS n
WHERE n < $target
RETURN category, n, $target - n AS short
ORDER BY short DESC`),

  assetsByCategory: q('assetsByCategory', true, 'Every asset of one category (optionally only one runtime, only shippable), for a picker or a model’s catalogue.', `
MATCH (a:Asset {category: $category})
WHERE ($runtime IS NULL OR $runtime IN a.runtime) AND (NOT $shipOnly OR a.ship)
RETURN a.id AS id, a.name AS name, a.about AS about, a.runtime AS runtime, a.energy AS energy, a.tags AS tags, a.params AS params
ORDER BY a.id`),

  assetsServing: q('assetsServing', true, 'The deciding agent casts by need: assets of a category that serve the beat’s needs, most needs shared first, stronger rank breaks ties.', `
UNWIND $needs AS nid
MATCH (a:Asset {category: $category})-[s:SERVES]->(:Need {id: nid})
WHERE ($runtime IS NULL OR $runtime IN a.runtime) AND (NOT $shipOnly OR a.ship)
WITH a, count(*) AS hits, sum(s.w) AS rank
RETURN a.id AS id, a.name AS name, a.runtime AS runtime, a.energy AS energy, a.params AS params, hits
ORDER BY hits DESC, rank ASC, a.id
LIMIT $n`),

  assetsForEvent: q('assetsForEvent', true, 'What plays on a timeline event (an sfx for card-in, a riser for build), first choice first.', `
MATCH (a:Asset)-[f:FITS]->(:Event {id: $event})
WHERE ($category IS NULL OR a.category = $category) AND (NOT $shipOnly OR a.ship)
RETURN a.id AS id, a.category AS category, a.file AS file, f.gainDb AS gainDb, f.first AS first, a.params AS params
ORDER BY f.first DESC, a.id`),

  assetsForStyle: q('assetsForStyle', true, 'Everything an edit style may use, per category (its allowed set).', `
MATCH (a:Asset)-[:SUITS]->(:EditStyle {id: $style})
RETURN a.category AS category, collect(a.id) AS ids
ORDER BY category`),

  assetById: q('assetById', true, 'One asset with its needs, events, edit styles and families (why the deciding agent may pick it).', `
MATCH (a:Asset {id: $id})
OPTIONAL MATCH (a)-[:SERVES]->(n:Need)
OPTIONAL MATCH (a)-[:FITS]->(e:Event)
OPTIONAL MATCH (a)-[:SUITS]->(s:EditStyle)
OPTIONAL MATCH (a)-[:IS_A]->(t:Transition)
RETURN a AS asset, collect(DISTINCT n.id) AS needs, collect(DISTINCT e.id) AS events, collect(DISTINCT s.id) AS styles, collect(DISTINCT t.id) AS families`),

  transitionFamily: q('transitionFamily', true, 'Every implementation of one transition family across runtimes (e.g. all the whips).', `
MATCH (a:Asset)-[:IS_A]->(:Transition {id: $family})
RETURN a.id AS id, a.runtime AS runtime, a.impl AS impl, a.params AS params
ORDER BY a.id`),

  assetCredits: q('assetCredits', true, 'The credit lines a film owes for the assets it used (CC BY music, credited footage), for its description.', `
MATCH (a:Asset)
WHERE a.id IN $ids AND a.attribution
RETURN a.id AS id, a.credit AS credit, a.licence AS licence
ORDER BY a.id`),

  unshippable: q('unshippable', true, 'Assets not safe for a paid product, per licence (the "safe only" filter’s other side).', `
MATCH (a:Asset) WHERE NOT a.ship
RETURN a.licence AS licence, a.category AS category, count(a) AS n
ORDER BY n DESC`),

  /* ───── video references, broken into parts ───── */
  addReference: q('addReference', false, 'A video reference the library learned from: (:Reference {id, url, title, kind, seconds, notes}).', `
MERGE (r:Reference {id: $id})
SET r.url = $url, r.title = $title, r.kind = $kind, r.seconds = $seconds, r.notes = $notes, r.added = coalesce(r.added, timestamp())
RETURN r.id AS id`),

  addReferenceParts: q('addReferenceParts', false, 'Each component a reference was broken into: (Reference)-[:HAS_PART {role, at, note}]->(Asset).', `
UNWIND $rows AS p
MATCH (r:Reference {id: $ref}), (a:Asset {id: p.id})
MERGE (r)-[h:HAS_PART {role: p.role}]->(a)
SET h.at = p.at, h.note = p.note
RETURN count(h) AS parts`),

  referenceParts: q('referenceParts', true, 'What one reference is made of, per category (to rebuild it, or to cast "like this one").', `
MATCH (r:Reference {id: $ref})-[h:HAS_PART]->(a:Asset)
RETURN a.category AS category, a.id AS id, h.role AS role, h.at AS at, h.note AS note
ORDER BY category, h.at`),

  references: q('references', true, 'Every reference in the library and how many parts each gave.', `
MATCH (r:Reference)
OPTIONAL MATCH (r)-[:HAS_PART]->(a:Asset)
RETURN r.id AS id, r.title AS title, r.url AS url, count(a) AS parts
ORDER BY r.added`),
};
