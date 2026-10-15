import { q } from './q';

/**
 * Also on `proj_<pid>`: the footage the Asset Hunter searched for and the pages the Researcher read, as a graph the
 * crew asks questions of.
 *
 *   (Run)-[:SEARCHED]->(Clip)-[:FROM]->(Source {kind: 'footage'})-[:UNDER]->(Licence)
 *   (Clip)-[:USED_IN]->(Scene)        a clip a scene actually uses (and the Asset it became: (Asset)-[:IS_CLIP]->(Clip))
 *   (Run)-[:READ]->(Page)-[:HAS_SHOT]->(Screenshot {kind: 'hero' | 'section' | 'scroll' | 'proof'})
 *   (Fact)-[:ON]->(Page)              the page a quoted fact was read on
 *   (Fact)-[:SHOWN_IN]->(Screenshot)  the proof shot: the page scrolled to the quote, the quote highlighted
 *
 * A Clip keeps every candidate, rejected ones too, with the reason (black bars, pale, static, already used, …), so
 * "why not that clip" has an answer and a clip that failed once is not downloaded again.
 */
export const media = {
  writeClips: q('writeClips', false, 'Every clip a footage search looked at: the clip, its source page and its licence, kept or rejected with the reason (a clip a scene already uses stays used).', `
MATCH (r:Run {id: $run})
UNWIND $rows AS c
MERGE (k:Clip {id: c.id})
SET k.provider = c.provider, k.ref = c.ref, k.title = c.title, k.url = c.url, k.query = c.query, k.relevance = c.relevance,
    k.status = CASE WHEN k.status = 'used' THEN 'used' ELSE c.status END, k.why = c.why,
    k.path = coalesce(c.path, k.path), k.sha = coalesce(c.sha, k.sha), k.w = c.w, k.h = c.h, k.seconds = coalesce(c.seconds, k.seconds),
    k.still = c.still, k.at = $at
MERGE (s:Source {id: c.source})
SET s.kind = 'footage', s.ref = c.page, s.title = c.title, s.provider = c.provider, s.author = c.author, s.at = $at
MERGE (l:Licence {name: c.licence})
SET l.url = coalesce(c.licenceUrl, l.url)
MERGE (k)-[:FROM]->(s)
MERGE (s)-[:UNDER]->(l)
MERGE (r)-[:SEARCHED]->(k)`),

  useClip: q('useClip', false, 'A scene uses a clip: the clip is linked to the scene and to the asset it became.', `
MATCH (r:Run {id: $run}), (k:Clip {id: $clip}), (a:Asset {id: $asset})
MERGE (sc:Scene {id: $scene})
ON CREATE SET sc.i = $i
MERGE (r)-[:HAS_SCENE]->(sc)
MERGE (k)-[:USED_IN]->(sc)
MERGE (a)-[:IS_CLIP]->(k)
SET k.status = 'used'`),

  clipSeen: q('clipSeen', true, 'Has this project already used this clip in a scene, or rejected it before (by the source’s id or the file’s hash)?', `
MATCH (k:Clip)
WHERE k.id = $id OR ($sha IS NOT NULL AND k.sha = $sha)
OPTIONAL MATCH (k)-[:USED_IN]->(sc:Scene)
RETURN k.id AS id, k.status AS status, k.why AS why, collect(sc.id) AS scenes
LIMIT 1`),

  clipCredits: q('clipCredits', true, 'The footage credits for a run: every clip its scenes use, where it came from, who made it and its licence.', `
MATCH (:Run {id: $run})-[:HAS_SCENE]->(sc:Scene)<-[:USED_IN]-(k:Clip)-[:FROM]->(s:Source)-[:UNDER]->(l:Licence)
RETURN sc.i AS scene, k.title AS title, k.provider AS provider, s.ref AS page, s.author AS author, l.name AS licence, l.url AS licenceUrl
ORDER BY scene`),

  clipRejects: q('clipRejects', true, 'Why clips were turned down in a run (the footage judge’s reasons, most common first).', `
MATCH (:Run {id: $run})-[:SEARCHED]->(k:Clip {status: 'rejected'})
UNWIND k.why AS reason
RETURN reason, count(*) AS n, collect(k.provider + ': ' + k.title)[0..3] AS examples
ORDER BY n DESC`),

  licenceMix: q('licenceMix', true, 'Which licences the project’s used footage is under, with how many clips each (what the credits must say).', `
MATCH (k:Clip)-[:USED_IN]->(:Scene)
MATCH (k)-[:FROM]->(:Source)-[:UNDER]->(l:Licence)
RETURN l.name AS licence, l.url AS url, count(DISTINCT k) AS clips
ORDER BY clips DESC`),

  writePage: q('writePage', false, 'The Researcher read a page in the browser: its address, title, how it answered and how much text it had.', `
MATCH (r:Run {id: $run})
MERGE (p:Page {id: $id})
SET p.url = $url, p.final = $final, p.title = $title, p.description = $description, p.status = $status, p.words = $words,
    p.wall = $wall, p.via = $via, p.at = $at
MERGE (r)-[:READ]->(p)`),

  writeShots: q('writeShots', false, 'Screenshots and scroll captures of a page (hero, sections, a smooth scroll video, proof shots).', `
MATCH (p:Page {id: $page})
UNWIND $rows AS s
MERGE (x:Screenshot {id: s.id})
SET x.kind = s.kind, x.path = s.path, x.y = s.y, x.w = s.w, x.h = s.h, x.seconds = s.seconds, x.sha = s.sha, x.video = s.video, x.at = $at
MERGE (p)-[:HAS_SHOT]->(x)`),

  factOnPage: q('factOnPage', false, 'A kept fact is linked to the page it was quoted from and, when the quote was found on screen, to its proof shot.', `
MATCH (f:Fact {id: $fact}), (p:Page {id: $page})
MERGE (f)-[:ON]->(p)
WITH f
OPTIONAL MATCH (x:Screenshot {id: $shot})
FOREACH (_ IN CASE WHEN x IS NULL THEN [] ELSE [1] END | MERGE (f)-[:SHOWN_IN]->(x))`),

  runShots: q('runShots', true, 'Every screenshot and scroll capture the research took for a run (what the Asset Hunter and the Art Director can use), with the page and the facts each one proves.', `
MATCH (:Run {id: $run})-[:READ]->(p:Page)-[:HAS_SHOT]->(x:Screenshot)
OPTIONAL MATCH (f:Fact)-[:SHOWN_IN]->(x)
RETURN x.id AS id, x.kind AS kind, x.path AS path, x.video AS video, x.seconds AS seconds, x.w AS w, x.h AS h, x.sha AS sha,
       p.url AS url, p.title AS title, collect(f.text) AS proves
ORDER BY CASE kind WHEN 'proof' THEN 0 WHEN 'scroll' THEN 1 WHEN 'hero' THEN 2 ELSE 3 END, id`),

  factProof: q('factProof', true, 'Fact checking: each fact of a run with the page it came from and its proof shot (no shot = the quote was never seen on screen).', `
MATCH (f:Fact {run: $run})-[:FROM]->(s:Source)
OPTIONAL MATCH (f)-[:ON]->(p:Page)
OPTIONAL MATCH (f)-[:SHOWN_IN]->(x:Screenshot)
RETURN f.id AS fact, f.text AS text, f.status AS status, s.ref AS source, p.title AS page, x.path AS proof
ORDER BY fact`),

  claimEvidence: q('claimEvidence', true, 'For one script line: the facts behind it, the pages they were read on and the screenshots that show them (what the director cuts to when a line states a fact).', `
MATCH (c:Claim {id: $id})-[:SUPPORTED_BY]->(f:Fact)
OPTIONAL MATCH (f)-[:ON]->(p:Page)
OPTIONAL MATCH (f)-[:SHOWN_IN]->(x:Screenshot)
RETURN f.text AS fact, p.url AS url, p.title AS title, collect(DISTINCT x.path) AS shots`),
};
