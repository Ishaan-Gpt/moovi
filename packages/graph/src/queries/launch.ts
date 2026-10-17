import { q } from './q';

/**
 * `craft`: the Launch style's library. Every part the Launch player draws is an (:Asset) with runtime 'launch' (its
 * impl.launch names the kit function), taught by a launch reference (:Reference {id: 'ref:lNN'}) through HAS_PART, so
 * every set-up, transition, type treatment, UI widget and camera move in a film can be traced to the film it was learned
 * from. The caster reads the whole library with `launchParts` at the start of every run (FalkorDB is the library: no
 * graph, no film); `launchPartStory` answers "where did this come from".
 */
export const launch = {
  launchParts: q('launchParts', true, 'The Launch library: every asset the Launch player draws (runtime launch, not retired), with the needs it serves (strongest first), its params and the references that taught it. The caster reads this once per film.', `
MATCH (a:Asset)
WHERE 'launch' IN a.runtime AND coalesce(a.retired, false) = false
OPTIONAL MATCH (a)-[s:SERVES]->(n:Need)
WITH a, n, s ORDER BY s.w
WITH a, collect(n.id) AS needs
OPTIONAL MATCH (r:Reference)-[:HAS_PART]->(a)
WITH a, needs, collect(DISTINCT r.id) AS refs
RETURN a.id AS id, a.category AS category, a.name AS name, a.energy AS energy, a.params AS params, a.tags AS tags, needs, refs
ORDER BY a.category, a.id`),

  launchPartStory: q('launchPartStory', true, 'Where a Launch part came from: the references that taught it (with the role and the moment in each), the look kits it belongs to, and the edit styles it suits.', `
MATCH (a:Asset {id: $id})
OPTIONAL MATCH (r:Reference)-[h:HAS_PART]->(a)
OPTIONAL MATCH (k:Kit)-[:HAS]->(a)
OPTIONAL MATCH (a)-[su:SUITS]->(e:EditStyle)
RETURN a.id AS id, a.name AS name, a.about AS about, collect(DISTINCT {ref: r.id, title: r.title, role: h.role, at: h.at}) AS taughtBy, collect(DISTINCT k.id) AS kits, collect(DISTINCT {style: e.id, w: su.w}) AS suits`),

  launchReferences: q('launchReferences', true, 'The launch references and what each gave the library: parts per category, and the look it taught.', `
MATCH (r:Reference) WHERE r.id STARTS WITH 'ref:l'
OPTIONAL MATCH (r)-[:HAS_PART]->(a:Asset)
WITH r, a.category AS category, count(a) AS n
WITH r, collect({category: category, n: n}) AS parts
OPTIONAL MATCH (r)-[:TAUGHT]->(k:Kit)
RETURN r.id AS id, r.title AS title, r.url AS url, parts, collect(k.id) AS kits
ORDER BY r.id`),

  launchServing: q('launchServing', true, 'Launch parts of one category ranked for a beat: how many of the beat needs each serves (rank-weighted), then its energy closeness, then id. The caster calls it when a beat needs a part the plan has no rule for.', `
MATCH (a:Asset {category: $category})-[s:SERVES]->(n:Need)
WHERE 'launch' IN a.runtime AND coalesce(a.retired, false) = false AND n.id IN $needs
WITH a, count(n) AS hits, sum(1.0 / s.w) AS weight
RETURN a.id AS id, a.name AS name, hits, weight, a.energy AS energy
ORDER BY hits DESC, weight DESC, abs(coalesce(a.energy, 3) - $energy), a.id
LIMIT $n`),

  launchFilmParts: q('launchFilmParts', false, 'A Launch film used these parts (set-ups, type treatments, transitions, camera moves, worlds): (:Film)-[:USED {role, i}]->(:Asset) in the craft graph, so the library knows which parts films actually lean on.', `
MERGE (f:Film {id: $film})
SET f.style = 'launch', f.at = $at, f.look = $look, f.site = $site
WITH f
UNWIND $rows AS r
MATCH (a:Asset {id: r.id})
MERGE (f)-[u:USED {role: r.role, i: r.i}]->(a)
RETURN count(u) AS used`),

  launchRecentLooks: q('launchRecentLooks', true, 'The looks the Launch style wore lately (newest first) and the site each film was about: the next film wears another look, and a site seen again never gets its last look.', `
MATCH (f:Film {style: 'launch'})
RETURN f.look AS look, f.site AS site, f.at AS at
ORDER BY f.at DESC
LIMIT $n`),

  launchPartUse: q('launchPartUse', true, 'How often each Launch part has been used across films (the caster rests the busiest ones).', `
MATCH (f:Film {style: 'launch'})-[u:USED]->(a:Asset)
RETURN a.id AS id, count(u) AS uses, max(f.at) AS last
ORDER BY uses DESC, a.id
LIMIT $n`),
};
