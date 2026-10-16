import { q } from './q';

/**
 * `craft`: the omnipotent library. Every reusable piece a film or an edit can cast (voices, sfx, music beds,
 * caption styles, transitions, effects, camera moves, UI components, 3D styles, inserts) is one node shape:
 *
 *   (:Asset {id, category, name, about, runtime[], licence (a code, licence.ts), licenceUrl, sourceUrl, author, title, credit,
 *          ship, attribution, redistributable (all three derived from the licence), file, vendored, sha256, rev, retired,
 *          energy, tags[], params, impl, seed})
 *     -[:SERVES]->(:Need)        what it shows on screen (the same need words as the style libraries)
 *     -[:FITS]->(:Event)         the timeline cue it plays on (card-in, scene, key-word, ...)
 *     -[:SUITS {w, src}]->(:EditStyle)  the edit styles it belongs to, w in 0..1 (R4's six: atlas, night-desk, handmade,
 *                                crimson-cutout, brand-promo, studio-minimal)
 *     -[:IS_A]->(:Transition)    a transition implementation and its family (the craft graph’s 12)
 *     -[:FALLBACK {runtime}]->(:Asset)  what to play in a runtime this asset does not run in
 *   (:Asset)-[:REPLACED_BY]->(:Asset)   ids never change once shipped; a replacement is a new id (old ones are retired, kept)
 *   (:Event {id, aliases[]})   the engine sfx map's event names; aliases are the EDL's sfx events (edl.ts SFX_EVENT_TO_MAP)
 *   (:Reference {id, url, title})-[:HAS_PART {role, at, note}]->(:Asset)   a video reference broken into parts
 *
 * Ids are `<category>:<slug>`. `runtime` lists who can play it (style1 canvas, visual compositor, render3d, the
 * styles' live players, edge-tts, ffmpeg, browser); `impl` (JSON) maps each runtime to its own id there, so one node
 * stands for the same idea in two codebases. `params` is JSON (FalkorDB holds flat arrays only). `ship` = the licence
 * is safe for a paid product; `vendored` = the file is in the repo (else it is only catalogued).
 * Determinism: every list query orders totally (weight or rank, then id), so the same graph gives the same picks; a
 * caller that rotates through a list does it with its own seed.
 */
export const library = {
  seedAssets: q('seedAssets', false, 'Idempotent seed of library assets: one (:Asset) per row, every field replaced (the catalogue in code is the truth).', `
UNWIND $rows AS r
MERGE (a:Asset {id: r.id})
SET a.category = r.category, a.name = r.name, a.about = r.about, a.runtime = r.runtime, a.licence = r.licence,
    a.credit = r.credit, a.ship = r.ship, a.attribution = r.attribution, a.file = r.file, a.vendored = r.vendored,
    a.energy = r.energy, a.tags = r.tags, a.params = r.params, a.impl = r.impl, a.seed = r.seed, a.src = r.src,
    a.licenceUrl = r.licenceUrl, a.sourceUrl = r.sourceUrl, a.author = r.author, a.title = r.title,
    a.redistributable = r.redistributable, a.sha256 = r.sha256, a.rev = r.rev, a.retired = false
RETURN count(a) AS assets`),

  linkAssetNeeds: q('linkAssetNeeds', false, 'An asset SERVES a need: (Asset)-[:SERVES {w}]->(Need); w is its rank (1 = strongest).', `
UNWIND $rows AS r
MATCH (a:Asset {id: r.id})
MERGE (n:Need {id: r.need})
MERGE (a)-[s:SERVES]->(n)
SET s.w = r.w
RETURN count(s) AS edges`),

  linkAssetEvents: q('linkAssetEvents', false, 'An asset FITS a timeline event (an sfx on card-in, a riser on build): (Asset)-[:FITS {gainDb, first, rank, then, align, slices, sliceLen}]->(Event); `rank` = its place in the event’s rotation, `then` = it only follows the event’s sound, never stands in for it; align / slices = how this event cuts the file.', `
UNWIND $rows AS r
MATCH (a:Asset {id: r.id})
MERGE (e:Event {id: r.event})
MERGE (a)-[f:FITS]->(e)
SET f.gainDb = r.gainDb, f.first = r.first, f.rank = r.rank, f.then = r.then, f.align = r.align, f.slices = r.slices, f.sliceLen = r.sliceLen
RETURN count(f) AS edges`),

  linkAssetStyles: q('linkAssetStyles', false, 'An asset SUITS an edit style with a weight: (Asset)-[:SUITS {w, src}]->(EditStyle). src is "row" (the asset’s own) or "cast" (a style’s cast list); rows for assets not in the graph are skipped.', `
UNWIND $rows AS r
MATCH (a:Asset {id: r.id})
MERGE (s:EditStyle {id: r.style})
MERGE (a)-[e:SUITS]->(s)
SET e.w = r.w, e.src = r.src
RETURN count(e) AS edges`),

  clearStyleCast: q('clearStyleCast', false, 'Before re-casting the edit styles: drop every SUITS edge a cast list made.', `
MATCH (:Asset)-[e:SUITS {src: 'cast'}]->(:EditStyle)
DELETE e
RETURN count(e) AS dropped`),

  linkReplaced: q('linkReplaced', false, 'A replaced asset points at its replacement: (old)-[:REPLACED_BY]->(new). The old node is kept (retired) so saved EDLs resolve.', `
UNWIND $rows AS r
MATCH (n:Asset {id: r.id})
MERGE (o:Asset {id: r.old})
ON CREATE SET o.retired = true, o.category = n.category
MERGE (o)-[e:REPLACED_BY]->(n)
RETURN count(e) AS edges`),

  linkFallbacks: q('linkFallbacks', false, 'What to play in a runtime an asset does not run in: (Asset)-[:FALLBACK {runtime}]->(Asset).', `
UNWIND $rows AS r
MATCH (a:Asset {id: r.id}), (b:Asset {id: r.to})
MERGE (a)-[e:FALLBACK {runtime: r.runtime}]->(b)
RETURN count(e) AS edges`),

  resolveAsset: q('resolveAsset', true, 'An EDL asset_ref → the asset to play now: itself, or the end of its REPLACED_BY chain; then, for a runtime it lacks, its FALLBACK there.', `
MATCH (a:Asset {id: $id})
OPTIONAL MATCH p = (a)-[:REPLACED_BY*1..5]->(n:Asset)
WITH a, n, p ORDER BY length(p) DESC
WITH a, collect(n)[0] AS newest
WITH a, coalesce(newest, a) AS cur
OPTIONAL MATCH (cur)-[f:FALLBACK {runtime: $runtime}]->(fb:Asset)
WITH a, cur, fb, ($runtime IS NULL OR $runtime IN cur.runtime) AS runs
RETURN a.id AS asked, cur.id AS id, CASE WHEN runs OR fb IS NULL THEN cur.id ELSE fb.id END AS play, runs, cur.sha256 AS sha256, cur.rev AS rev`),

  linkEventAliases: q('linkEventAliases', false, 'The EDL’s sfx event names as aliases on the library’s (:Event) nodes (the names stay; the EDL’s resolve to them).', `
UNWIND $rows AS r
MERGE (e:Event {id: r.event})
SET e.aliases = r.aliases
RETURN count(e) AS events`),

  transitionForCut: q('transitionForCut', true, 'An EDL cut type (Cut.type: hard, jump, punch, flash, …) → its transition asset, its family and every other implementation of that family.', `
MATCH (a:Asset {category: 'transition'})-[:IS_A]->(t:Transition)
WHERE ('edl-cut:' + $type) IN a.tags AND NOT coalesce(a.retired, false)
OPTIONAL MATCH (o:Asset)-[:IS_A]->(t)
WHERE o.id <> a.id AND NOT coalesce(o.retired, false)
WITH a, t, o ORDER BY o.id
RETURN a.id AS id, t.id AS family, a.params AS params, collect(o.id) AS alternatives`),

  addAssetTags: q('addAssetTags', false, 'Add a tag to assets another seed owns (an X1 number on a camera-layer move); idempotent, missing ids skipped.', `
UNWIND $rows AS r
MATCH (a:Asset {id: r.id})
SET a.tags = CASE WHEN r.tag IN a.tags THEN a.tags ELSE a.tags + r.tag END
RETURN count(a) AS tagged`),

  assetsByX1: q('assetsByX1', true, 'The assets that implement one of R4’s X1 moves (01 orbit … 17 glass type), by its two-digit number.', `
MATCH (a:Asset)
WHERE ('x1:' + $n) IN a.tags AND NOT coalesce(a.retired, false)
RETURN a.id AS id, a.category AS category, a.runtime AS runtime, a.params AS params
ORDER BY a.category, a.id`),

  upsertClipAssets: q('upsertClipAssets', false, 'Stock clips fetched at run time as (:Asset {category: insert, vendored: false}) with source, author and licence, so an EDL insert and the film credits take one path. Never retired by a catalogue reseed.', `
UNWIND $rows AS r
MERGE (a:Asset {id: r.id})
SET a.category = 'insert', a.name = r.name, a.about = r.about, a.runtime = ['browser', 'ffmpeg'], a.licence = r.licence,
    a.licenceUrl = r.licenceUrl, a.sourceUrl = r.sourceUrl, a.author = r.author, a.title = r.name, a.credit = r.credit,
    a.ship = r.ship, a.attribution = r.attribution, a.redistributable = r.redistributable, a.file = null, a.vendored = false,
    a.sha256 = r.sha256, a.rev = r.rev, a.retired = false, a.energy = null, a.tags = r.tags, a.params = r.params,
    a.impl = r.impl, a.seed = 'footage', a.src = 'packages/engine/src/footage'
RETURN count(a) AS clips`),

  linkAssetFamilies: q('linkAssetFamilies', false, 'A transition implementation IS_A transition family (the craft graph’s Transition nodes).', `
UNWIND $rows AS r
MATCH (a:Asset {id: r.id})
MERGE (t:Transition {id: r.family})
MERGE (a)-[e:IS_A]->(t)
RETURN count(e) AS edges`),

  clearAssetEdges: q('clearAssetEdges', false, 'Before a reseed: drop the SERVES / FITS / SUITS / IS_A edges of the seeded assets, so removed tags do not linger.', `
MATCH (a:Asset)-[e:SERVES|FITS|SUITS|IS_A|FALLBACK]->()
WHERE a.seed IN $seeds
DELETE e
RETURN count(e) AS dropped`),

  retireAssets: q('retireAssets', false, 'Assets a seed no longer lists are marked retired, never deleted: an EDL that names one still resolves (resolveAsset follows REPLACED_BY). Casting queries skip retired assets.', `
MATCH (a:Asset)
WHERE a.seed = $seed AND NOT a.id IN $ids AND NOT coalesce(a.retired, false)
SET a.retired = true
RETURN count(a) AS retired`),

  libraryCounts: q('libraryCounts', true, 'The library per category: how many, how many safe to ship, how many have their file in the repo.', `
MATCH (a:Asset) WHERE NOT coalesce(a.retired, false)
RETURN a.category AS category, count(a) AS n,
       sum(CASE WHEN a.ship THEN 1 ELSE 0 END) AS shippable,
       sum(CASE WHEN a.vendored THEN 1 ELSE 0 END) AS vendored
ORDER BY category`),

  libraryGaps: q('libraryGaps', true, 'Categories still under the target count (the plan’s 50+ of each).', `
MATCH (a:Asset) WHERE NOT coalesce(a.retired, false)
WITH a.category AS category, count(a) AS n
WHERE n < $target
RETURN category, n, $target - n AS short
ORDER BY short DESC`),

  assetsByCategory: q('assetsByCategory', true, 'Every asset of one category (optionally only one runtime, only shippable), for a picker or a model’s catalogue.', `
MATCH (a:Asset {category: $category})
WHERE ($runtime IS NULL OR $runtime IN a.runtime) AND (NOT $shipOnly OR a.ship) AND NOT coalesce(a.retired, false)
RETURN a.id AS id, a.name AS name, a.about AS about, a.runtime AS runtime, a.energy AS energy, a.tags AS tags, a.params AS params, a.impl AS impl, a.file AS file
ORDER BY a.id`),

  assetsServing: q('assetsServing', true, 'The deciding agent casts by need: assets of a category that serve the beat’s needs, most needs shared first, stronger rank breaks ties.', `
UNWIND $needs AS nid
MATCH (a:Asset {category: $category})-[s:SERVES]->(:Need {id: nid})
WHERE ($runtime IS NULL OR $runtime IN a.runtime) AND (NOT $shipOnly OR a.ship) AND NOT coalesce(a.retired, false)
WITH a, count(*) AS hits, sum(s.w) AS rank
RETURN a.id AS id, a.name AS name, a.runtime AS runtime, a.energy AS energy, a.params AS params, a.impl AS impl, hits
ORDER BY hits DESC, rank ASC, a.id
LIMIT $n`),

  assetsForEvent: q('assetsForEvent', true, 'What plays on a timeline event (an sfx for card-in, a riser for build), first choice first; `then` rows are the follow-up sound, not a choice. The mixer casts every film’s sfx with this. The event may be the library’s name or the EDL’s alias (cut → scene, insert_in → card-in, …).', `
MATCH (a:Asset)-[f:FITS]->(e:Event)
WHERE (e.id = $event OR $event IN coalesce(e.aliases, [])) AND ($category IS NULL OR a.category = $category) AND (NOT $shipOnly OR a.ship) AND NOT coalesce(a.retired, false)
RETURN a.id AS id, a.category AS category, a.file AS file, f.gainDb AS gainDb, f.first AS first, coalesce(f.then, false) AS then, f.align AS align, f.slices AS slices, f.sliceLen AS sliceLen, a.impl AS impl, a.params AS params
ORDER BY f.first DESC, coalesce(f.rank, 99), a.id`),

  assetsForStyle: q('assetsForStyle', true, 'Everything an edit style may use, per category (its allowed set), strongest weight first, then id.', `
MATCH (a:Asset)-[s:SUITS]->(:EditStyle {id: $style})
WHERE NOT coalesce(a.retired, false)
WITH a, s ORDER BY s.w DESC, a.id
RETURN a.category AS category, collect(a.id) AS ids, collect(s.w) AS weights
ORDER BY category`),

  styleCast: q('styleCast', true, 'An edit style’s picks in one category, strongest first (weight, then id): what the EDL builder casts from.', `
MATCH (a:Asset {category: $category})-[s:SUITS]->(:EditStyle {id: $style})
WHERE NOT coalesce(a.retired, false) AND ($runtime IS NULL OR $runtime IN a.runtime)
RETURN a.id AS id, a.name AS name, s.w AS w, a.runtime AS runtime, a.params AS params
ORDER BY s.w DESC, a.id
LIMIT $n`),

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

  /* ───── kits: a look as one unit (palette roles, type roles, motion tokens) and the parts that make it ───── */
  seedKit: q('seedKit', false, 'A kit: one look as a unit. Palette, type and motion are JSON tokens; every part reads only these roles, so a brand palette re-skins the whole kit.', `
MERGE (k:Kit {id: $id})
SET k.name = $name, k.about = $about, k.palette = $palette, k.type = $type, k.motion = $motion, k.frame = $frame, k.src = $src
RETURN k.id AS id`),

  linkKitParts: q('linkKitParts', false, 'The parts of a kit: (Kit)-[:HAS {role}]->(Asset). Re-linking replaces the role.', `
UNWIND $rows AS r
MATCH (k:Kit {id: $kit}), (a:Asset {id: r.id})
MERGE (k)-[h:HAS]->(a)
SET h.role = r.role
RETURN count(h) AS parts`),

  linkKitStyles: q('linkKitStyles', false, 'A kit SUITS an edit style.', `
UNWIND $styles AS sid
MATCH (k:Kit {id: $kit})
MERGE (s:EditStyle {id: sid})
MERGE (k)-[e:SUITS]->(s)
RETURN count(e) AS edges`),

  referenceTaught: q('referenceTaught', false, 'A reference taught a kit: (Reference)-[:TAUGHT]->(Kit).', `
MATCH (r:Reference {id: $ref}), (k:Kit {id: $kit})
MERGE (r)-[t:TAUGHT]->(k)
RETURN count(t) AS taught`),

  kits: q('kits', true, 'Every kit, how many parts it has and the edit styles it suits.', `
MATCH (k:Kit)
OPTIONAL MATCH (k)-[:HAS]->(a:Asset)
OPTIONAL MATCH (k)-[:SUITS]->(s:EditStyle)
RETURN k.id AS id, k.name AS name, k.about AS about, count(DISTINCT a) AS parts, collect(DISTINCT s.id) AS styles
ORDER BY k.id`),

  kitParts: q('kitParts', true, 'A kit with its tokens and every part (to render with it, or re-skin it with a brand palette).', `
MATCH (k:Kit {id: $kit})
OPTIONAL MATCH (k)-[h:HAS]->(a:Asset)
RETURN k.palette AS palette, k.type AS type, k.motion AS motion, k.frame AS frame, k.src AS src,
       collect({id: a.id, category: a.category, role: h.role, impl: a.impl, params: a.params}) AS parts`),

  kitsServing: q('kitsServing', true, 'Kits ranked for a brief: how many of the beat needs their parts serve (distinct needs first, then part hits).', `
UNWIND $needs AS nid
MATCH (k:Kit)-[:HAS]->(a:Asset)-[:SERVES]->(n:Need {id: nid})
WITH k, count(DISTINCT n) AS covered, count(*) AS hits
RETURN k.id AS id, k.name AS name, covered, hits
ORDER BY covered DESC, hits DESC, k.id
LIMIT $n`),

  assetKits: q('assetKits', true, 'The kits an asset belongs to (where its palette and type come from).', `
MATCH (k:Kit)-[h:HAS]->(:Asset {id: $id})
RETURN k.id AS kit, h.role AS role
ORDER BY k.id`),
};
