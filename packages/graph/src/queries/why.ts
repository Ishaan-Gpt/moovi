import { q } from './q';

/**
 * "Why this edit?" (decision 13; hackathon/graphhacks/docs/PLAN.md Q2), on the project graph (proj_<pid>).
 * Every film decision Moovi makes (the cast, the caption look, the style, the cuts, the voice, a change by words) is a
 * (:Decision) with BECAUSE edges to what caused it: the user's own words (:Feedback), a rule (:Rule), a reference reel
 * (:Reference) or a library asset (:Asset). A cause can lead further back: a rule LEARNED_FROM the feedback it came
 * from, an asset FROM the reference it was cloned from. "Why this caption?" is then a shortest path from the newest
 * decision of that kind back to its causes, the user's words first.
 */
export const why = {
  recordDecision: q('recordDecision', false, 'A film decision and the BECAUSE edges to what caused it (feedback, a rule, a reference, an asset), plus their own links back (LEARNED_FROM, FROM).', `
MERGE (d:Decision {id: $id})
SET d.kind = $kind, d.choice = $choice, d.why = $why, d.at = $at, d.run = $run, d.target = $target, d.agent = $agent
WITH d
OPTIONAL MATCH (r:Run {id: $run})
FOREACH (_ IN CASE WHEN r IS NULL THEN [] ELSE [1] END | MERGE (d)-[:FOR]->(r))
WITH DISTINCT d
UNWIND $causes AS c
FOREACH (_ IN CASE WHEN c.label = 'Feedback' THEN [1] ELSE [] END | MERGE (n:Feedback {id: c.id}) ON CREATE SET n.why = c.text, n.at = $at, n.source = 'words')
FOREACH (_ IN CASE WHEN c.label = 'Rule' THEN [1] ELSE [] END | MERGE (n:Rule {id: c.id}) SET n.text = c.text)
FOREACH (_ IN CASE WHEN c.label = 'Reference' THEN [1] ELSE [] END | MERGE (n:Reference {id: c.id}) SET n.name = c.text)
FOREACH (_ IN CASE WHEN c.label = 'Asset' THEN [1] ELSE [] END | MERGE (n:Asset {id: c.id}) ON CREATE SET n.name = c.text, n.library = true)
WITH d, c WHERE c.direct
MATCH (n {id: c.id}) WHERE n:Feedback OR n:Rule OR n:Reference OR n:Asset
MERGE (d)-[b:BECAUSE]->(n)
SET b.how = c.how
WITH DISTINCT d
UNWIND $links AS l
MATCH (a {id: l.from}), (b {id: l.to})
WHERE (a:Rule OR a:Asset OR a:Decision) AND (b:Feedback OR b:Reference OR b:Rule)
FOREACH (_ IN CASE WHEN l.rel = 'LEARNED_FROM' THEN [1] ELSE [] END | MERGE (a)-[:LEARNED_FROM]->(b))
FOREACH (_ IN CASE WHEN l.rel = 'FROM' THEN [1] ELSE [] END | MERGE (a)-[:FROM]->(b))
RETURN DISTINCT d.id AS id`),

  whyThis: q('whyThis', true, '"Why this caption / voice / cut?": the newest decision of that kind, and the shortest path from it back to each cause, the user\'s words first.', `
MATCH (d:Decision)
WHERE d.kind IN $kinds AND ($run IS NULL OR d.run = $run)
WITH d ORDER BY d.at DESC LIMIT 1
MATCH (d)-[:BECAUSE]->(x)-[:LEARNED_FROM|FROM*0..3]->(c)
WHERE c:Feedback OR c:Rule OR c:Reference OR c:Asset
WITH DISTINCT d, c
WITH d, c, shortestPath((d)-[:BECAUSE|LEARNED_FROM|FROM*]->(c)) AS p
WITH d, c, p, CASE WHEN c:Feedback THEN 0 WHEN c:Reference THEN 1 WHEN c:Rule THEN 2 ELSE 3 END AS rank
RETURN d.id AS decision, d.kind AS kind, d.choice AS choice, d.why AS why, d.at AS at, length(p) AS hops,
       [m IN nodes(p) | {id: m.id, label: labels(m)[0], text: coalesce(m.why, m.text, m.name, m.choice, m.id)}] AS path,
       [r IN relationships(p) | type(r)] AS rels
ORDER BY rank, hops DESC
LIMIT 6`),

  decisionsOfRun: q('decisionsOfRun', true, 'Every recorded film decision of a run with its direct causes (the demo and the studio\'s "why" list).', `
MATCH (d:Decision {run: $run})
OPTIONAL MATCH (d)-[b:BECAUSE]->(c)
RETURN d.id AS id, d.kind AS kind, d.choice AS choice, d.why AS why, d.at AS at,
       collect({label: labels(c)[0], id: c.id, how: b.how}) AS causes
ORDER BY at`),
};

/** The craft-graph half: where a library asset came from (the reference reel it was cloned from), copied into the
 * project graph as (:Asset)-[:FROM]->(:Reference) so the "why" path stays inside one graph. */
export const whyCraft = {
  assetOrigins: q('assetOrigins', true, 'The reference reel each library asset was broken out of (Reference HAS_PART Asset), for the "why" path.', `
MATCH (r:Reference)-[:HAS_PART]->(a:Asset)
WHERE a.id IN $ids
RETURN a.id AS asset, a.name AS name, r.id AS ref, coalesce(r.title, r.id) AS title`),

  kitOrigins: q('kitOrigins', true, 'The reference reel that taught a kit (Reference TAUGHT Kit), for the "why" path of a kit pick.', `
MATCH (r:Reference)-[:TAUGHT]->(k:Kit {id: $kit})
RETURN r.id AS ref, coalesce(r.title, r.id) AS title`),
};
