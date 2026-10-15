import { q } from './q';

/**
 * The `styles` graph: what every reel style remembers. A style is a language, not a template; what keeps it from
 * repeating itself is this memory:
 *   (:Film {id, style, at, project})-[:OF]->(:Style {id})
 *   (:Film)-[:CAST {i}]->(:Setup {key, style, id, generated, data, uses})     which set-up played beat i
 *   (:Film)-[:TOLD]->(:Arc {id})                                              the script shape it used
 *   (:Film)-[:ABOUT]->(:Site {host})                                           whose film it was
 *   (:Setup)-[:NEXT_TO {film, i}]->(:Setup)                                    set-ups a film cast back to back
 * Improvised set-ups that were kept are (:Setup {generated: true}) with their spec in `data`: the library grows here.
 * PageRank over NEXT_TO finds the set-ups the style leans on most, so the next film gives them a rest.
 */
export const styles = {
  rememberFilm: q('rememberFilm', false, 'Store a finished film and the set-up that played each beat (CAST {i}).', `
MERGE (st:Style {id: $style})
MERGE (f:Film {id: $id})
SET f.style = $style, f.at = $at, f.project = $project
MERGE (f)-[:OF]->(st)
WITH f
UNWIND range(0, size($setups) - 1) AS i
MERGE (s:Setup {key: $style + ':' + $setups[i]})
  ON CREATE SET s.style = $style, s.id = $setups[i], s.generated = false, s.uses = 0
MERGE (f)-[c:CAST {i: i}]->(s)
  ON CREATE SET s.uses = coalesce(s.uses, 0) + 1
RETURN count(s) AS cast`),

  filmArc: q('filmArc', false, 'The script shape (arc) a film told.', `
MATCH (f:Film {id: $id})
MERGE (a:Arc {id: $arc})
MERGE (f)-[:TOLD]->(a)
RETURN a.id AS arc`),

  filmSite: q('filmSite', false, 'The site a film was about (a site seen again gets a different film).', `
MATCH (f:Film {id: $id})
MERGE (s:Site {host: $host})
MERGE (f)-[:ABOUT]->(s)
RETURN s.host AS host`),

  coCast: q('coCast', false, 'Link set-ups a film cast back to back (one NEXT_TO per film and beat, so re-runs never double count): the graph PageRank reads.', `
UNWIND range(0, size($setups) - 2) AS i
MATCH (a:Setup {key: $style + ':' + $setups[i]}), (b:Setup {key: $style + ':' + $setups[i + 1]})
MERGE (a)-[r:NEXT_TO {film: $id, i: i}]->(b)
RETURN count(r) AS links`),

  recentFilms: q('recentFilms', true, 'A style’s latest films: their set-ups in beat order, arc and site.', `
MATCH (f:Film {style: $style})
WITH f ORDER BY f.at DESC LIMIT $n
OPTIONAL MATCH (f)-[:TOLD]->(a:Arc)
OPTIONAL MATCH (f)-[:ABOUT]->(site:Site)
OPTIONAL MATCH (f)-[c:CAST]->(s:Setup)
WITH f, a, site, c, s ORDER BY c.i
RETURN f.id AS id, f.at AS at, a.id AS arc, site.host AS site, collect(s.id) AS setups
ORDER BY at DESC`),

  grownSetups: q('grownSetups', true, 'The improvised set-ups a style kept: they join its library for every later film.', `
MATCH (s:Setup {style: $style})
WHERE s.generated = true
RETURN s.id AS id, s.data AS data, s.uses AS uses
ORDER BY s.created`),

  growSetup: q('growSetup', false, 'Keep an improvised set-up in the style’s library (deduped by its spec).', `
MERGE (st:Style {id: $style})
MERGE (s:Setup {key: $style + ':' + $id})
  ON CREATE SET s.style = $style, s.id = $id, s.uses = 0
SET s.generated = true, s.data = coalesce(s.data, $data), s.about = coalesce(s.about, $about), s.family = coalesce(s.family, $family), s.created = coalesce(s.created, $at)
MERGE (s)-[:IN]->(st)
RETURN s.id AS id`),

  overUsed: q('overUsed', true, 'Over-use: PageRank over NEXT_TO, the set-ups this style leans on most.', `
CALL algo.pageRank('Setup', 'NEXT_TO')
YIELD node, score
WITH node, score
WHERE node.style = $style
RETURN node.id AS id, score
ORDER BY score DESC
LIMIT $n`),

  filmStory: q('filmStory', true, 'Why a film looks the way it does: its arc, its site and each beat’s set-up (with how often the style used it).', `
MATCH (f:Film {id: $id})-[c:CAST]->(s:Setup)
OPTIONAL MATCH (f)-[:TOLD]->(a:Arc)
OPTIONAL MATCH (f)-[:ABOUT]->(site:Site)
RETURN f.style AS style, a.id AS arc, site.host AS site, c.i AS beat, s.id AS setup, s.generated AS improvised, s.uses AS uses
ORDER BY beat`),

  styleStats: q('styleStats', true, 'Per style: films made, distinct set-ups cast, how many were improvised and kept.', `
MATCH (st:Style)
OPTIONAL MATCH (f:Film)-[:OF]->(st)
WITH st, count(f) AS films
OPTIONAL MATCH (s:Setup {style: st.id})
RETURN st.id AS style, films, count(s) AS setups, sum(CASE WHEN s.generated = true THEN 1 ELSE 0 END) AS kept
ORDER BY style`),
};
