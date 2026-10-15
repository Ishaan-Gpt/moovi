import { q } from './q';

/**
 * `proj_<pid>`: one project, one office. Its chats (each makes one video), their messages and uploads, the runs that
 * built each version of the video, the task graph the scheduler works through, the facts and sources behind every
 * claim, the scene programs, the assets, the decisions (with BECAUSE edges) and Lens's issues.
 *
 * Task states: waiting (deps not done) → ready (queued) → running (leased by a worker) → done | failed.
 * A task's `scope` (e.g. "scene:3") lets a send-back re-open just that part of a run.
 */
export const project = {
  initProject: q('initProject', false, 'The project’s own graph starts with the project and the crew in it.', `
MERGE (p:Project {id: $id})
SET p.name = $name, p.owner = $owner, p.at = coalesce(p.at, $at)
WITH p
UNWIND $agents AS a
MERGE (x:Agent {id: a.id})
SET x.name = a.name, x.role = a.role`),

  renameProject: q('renameProject', false, 'The project takes a name (Moovi names it from the first brief).', `
MATCH (p:Project)
SET p.name = $name`),

  /* ───── chats, messages, uploads, videos ───── */
  createChat: q('createChat', false, 'A new chat: one conversation, one video.', `
MATCH (p:Project)
CREATE (c:Chat {id: $id, title: $title, at: $at, updated: $at, status: 'new'})
CREATE (p)-[:HAS_CHAT]->(c)
CREATE (v:Video {id: $video, status: 'none', version: 0, at: $at})
CREATE (c)-[:MAKES]->(v)
RETURN c.id AS id, v.id AS video`),

  chats: q('chats', true, 'Every chat of the project with its video, newest first.', `
MATCH (:Project)-[:HAS_CHAT]->(c:Chat)-[:MAKES]->(v:Video)
RETURN c.id AS id, c.title AS title, c.status AS status, c.at AS at, c.updated AS updated,
       v.id AS video, v.status AS videoStatus, v.poster AS poster, v.duration AS duration, v.version AS version
ORDER BY c.updated DESC`),

  chat: q('chat', true, 'One chat with its video.', `
MATCH (c:Chat {id: $id})-[:MAKES]->(v:Video)
RETURN c.id AS id, c.title AS title, c.status AS status, c.at AS at, v.id AS video, v.status AS videoStatus,
       v.path AS path, v.poster AS poster, v.duration AS duration, v.version AS version, v.style AS style,
       v.format AS format`),

  setChat: q('setChat', false, 'A chat’s title or status changes.', `
MATCH (c:Chat {id: $id})
SET c.title = coalesce($title, c.title), c.status = coalesce($status, c.status), c.updated = $at`),

  addMessage: q('addMessage', false, 'A message in the chat (the user, Moovi, or an agent answering an @mention).', `
MATCH (c:Chat {id: $chat})
CREATE (m:Message {id: $id, role: $role, agent: $agent, text: $text, kind: $kind, data: $data, at: $at})
CREATE (c)-[:SAID]->(m)
SET c.updated = $at`),

  messages: q('messages', true, 'The chat’s messages in order.', `
MATCH (:Chat {id: $chat})-[:SAID]->(m:Message)
RETURN m.id AS id, m.role AS role, m.agent AS agent, m.text AS text, m.kind AS kind, m.data AS data, m.at AS at
ORDER BY m.at ASC
LIMIT $n`),

  addUpload: q('addUpload', false, 'A file the user gave the chat (footage, a reference, images, a voice-over).', `
MATCH (c:Chat {id: $chat})
CREATE (u:Upload {id: $id, name: $name, path: $path, mime: $mime, size: $size, sha: $sha, at: $at})
CREATE (c)-[:HAS_UPLOAD]->(u)`),

  setUploadProbe: q('setUploadProbe', false, 'Intake’s measurements of an upload and what it decided it is.', `
MATCH (u:Upload {id: $id})
SET u.probe = $probe, u.role = $role, u.why = $why`),

  uploads: q('uploads', true, 'The chat’s uploads with what intake found.', `
MATCH (:Chat {id: $chat})-[:HAS_UPLOAD]->(u:Upload)
RETURN u.id AS id, u.name AS name, u.path AS path, u.mime AS mime, u.size AS size, u.sha AS sha, u.probe AS probe,
       u.role AS role, u.why AS why
ORDER BY u.at`),

  setVideo: q('setVideo', false, 'The chat’s video changes state (making, ready, failed) or gets a new version.', `
MATCH (v:Video {id: $id})
SET v.status = coalesce($status, v.status), v.path = coalesce($path, v.path), v.poster = coalesce($poster, v.poster),
    v.duration = coalesce($duration, v.duration), v.version = coalesce($version, v.version),
    v.style = coalesce($style, v.style), v.format = coalesce($format, v.format), v.updated = $at`),

  videos: q('videos', true, 'Every finished video in the project with its style card (for "like the previous one").', `
MATCH (c:Chat)-[:MAKES]->(v:Video)
WHERE v.status = 'ready'
OPTIONAL MATCH (v)-[:BUILT_BY]->(r:Run {status: 'done'})
WITH c, v, r ORDER BY r.n DESC
WITH c, v, collect(r)[0] AS r
RETURN v.id AS video, c.id AS chat, c.title AS title, v.style AS style, v.format AS format, v.duration AS duration,
       v.path AS path, v.poster AS poster, r.id AS run, r.brief AS brief, r.card AS card, r.skill AS skill
ORDER BY v.updated DESC`),

  /* ───── runs ───── */
  createRun: q('createRun', false, 'A run builds one version of a chat’s video.', `
MATCH (v:Video {id: $video})
OPTIONAL MATCH (v)-[:BUILT_BY]->(old:Run)
WITH v, count(old) AS n
CREATE (r:Run {id: $id, n: n + 1, status: 'planned', at: $at, kind: $kind, request: $request, parent: $parent})
CREATE (v)-[:BUILT_BY]->(r)
RETURN r.id AS id, r.n AS n`),

  setRun: q('setRun', false, 'A run’s state, its typed brief, the style/skill it matched and the style card it used.', `
MATCH (r:Run {id: $id})
SET r.status = coalesce($status, r.status), r.brief = coalesce($brief, r.brief), r.skill = coalesce($skill, r.skill),
    r.card = coalesce($card, r.card), r.match = coalesce($match, r.match), r.error = coalesce($error, r.error),
    r.updated = $at`),

  run: q('run', true, 'One run.', `
MATCH (c:Chat)-[:MAKES]->(v:Video)-[:BUILT_BY]->(r:Run {id: $id})
RETURN r.id AS id, r.n AS n, r.status AS status, r.kind AS kind, r.request AS request, r.parent AS parent,
       r.brief AS brief, r.skill AS skill, r.card AS card, r.match AS match, r.error AS error, r.at AS at,
       v.id AS video, c.id AS chat`),

  latestRun: q('latestRun', true, 'The chat’s latest run.', `
MATCH (:Chat {id: $chat})-[:MAKES]->(:Video)-[:BUILT_BY]->(r:Run)
RETURN r.id AS id, r.n AS n, r.status AS status, r.skill AS skill, r.card AS card, r.brief AS brief
ORDER BY r.n DESC
LIMIT 1`),

  activeRuns: q('activeRuns', true, 'Runs still in flight (the worker resumes them after a restart).', `
MATCH (c:Chat)-[:MAKES]->(:Video)-[:BUILT_BY]->(r:Run)
WHERE r.status IN ['planned', 'running']
RETURN r.id AS id, c.id AS chat`),

  /* ───── the task graph (the scheduler) ───── */
  createTasks: q('createTasks', false, 'The run’s tasks, each owned by one agent or worker, on one resource, for one scope (copied ones arrive done).', `
MATCH (r:Run {id: $run})
UNWIND $tasks AS t
CREATE (k:Task {id: t.id, kind: t.kind, agent: t.agent, resource: t.resource, scope: t.scope, title: t.title,
                status: coalesce(t.status, 'waiting'), attempts: 0, max: t.max, input: t.input, output: t.output,
                waits: t.waits, optional: t.optional, at: $at})
CREATE (r)-[:HAS_TASK]->(k)`),

  waitingFor: q('waitingFor', true, 'Tasks that wait for a fan-out stage (they get a dependency on every task the stage spawns).', `
MATCH (:Run {id: $run})-[:HAS_TASK]->(t:Task)
WHERE $kind IN t.waits
RETURN t.id AS id`),

  tasksOf: q('tasksOf', true, 'A run’s tasks of some kinds, with their scope and state.', `
MATCH (:Run {id: $run})-[:HAS_TASK]->(t:Task)
WHERE t.kind IN $kinds
RETURN t.id AS id, t.kind AS kind, t.scope AS scope, t.status AS status, t.input AS input, t.output AS output
ORDER BY t.id`),

  park: q('park', false, 'The task waits for the user (a question card): it leaves the queue until it is answered.', `
MATCH (t:Task {id: $id})
SET t.status = 'parked', t.parked_at = $at, t.question = $question, t.worker = null`),

  unpark: q('unpark', false, 'The user answered: the parked task is ready again, with the answer.', `
MATCH (:Run {id: $run})-[:HAS_TASK]->(t:Task {status: 'parked'})
WHERE t.question = $question
SET t.status = 'ready', t.answer = $answer, t.attempts = 0
RETURN t.id AS id, t.resource AS resource`),

  reopenIds: q('reopenIds', false, 'Scoped send-back: exactly these tasks go back to waiting (with the note that sent them back).', `
UNWIND $rows AS r
MATCH (:Run {id: $run})-[:HAS_TASK]->(t:Task {id: r.id})
SET t.status = 'waiting', t.attempts = 0, t.error = null, t.reopened = coalesce(t.reopened, 0) + 1,
    t.feedback = coalesce(r.feedback, t.feedback)
RETURN t.id AS id`),

  runOpen: q('runOpen', true, 'How much of a run is still to do (a run is done when nothing is waiting, ready, running or parked).', `
MATCH (:Run {id: $run})-[:HAS_TASK]->(t:Task)
RETURN sum(CASE WHEN t.status IN ['waiting', 'ready', 'running', 'parked'] THEN 1 ELSE 0 END) AS open,
       sum(CASE WHEN t.status = 'failed' AND (t.optional IS NULL OR t.optional = false) THEN 1 ELSE 0 END) AS failed,
       count(t) AS total`),

  taskDeps: q('taskDeps', false, 'A task waits on the tasks it depends on.', `
UNWIND $deps AS d
MATCH (a:Task {id: d.task}), (b:Task {id: d.on})
MERGE (a)-[:DEPENDS_ON]->(b)`),

  promote: q('promote', false, 'Every waiting task whose dependencies are all done becomes ready (returned so the worker can queue it).', `
MATCH (:Run {id: $run})-[:HAS_TASK]->(t:Task {status: 'waiting'})
OPTIONAL MATCH (t)-[:DEPENDS_ON]->(d:Task)
WITH t, collect(d.status) AS deps
WHERE all(s IN deps WHERE s = 'done')
SET t.status = 'ready', t.ready_at = $at
RETURN t.id AS id, t.kind AS kind, t.resource AS resource`),

  claim: q('claim', false, 'A worker takes a ready task with a lease (only one worker can win it).', `
MATCH (t:Task {id: $id})
WHERE t.status = 'ready'
SET t.status = 'running', t.worker = $worker, t.lease_until = $lease, t.started_at = $at, t.attempts = t.attempts + 1
RETURN t.id AS id, t.kind AS kind, t.agent AS agent, t.resource AS resource, t.scope AS scope, t.title AS title,
       t.input AS input, t.attempts AS attempts, t.max AS max, t.feedback AS feedback, t.answer AS answer, t.reopened AS reopened`),

  heartbeat: q('heartbeat', false, 'The worker still holds its task.', `
MATCH (t:Task {id: $id, worker: $worker})
WHERE t.status = 'running'
SET t.lease_until = $lease, t.note = coalesce($note, t.note)`),

  finish: q('finish', false, 'The task is done; its output is kept for the tasks that depend on it.', `
MATCH (t:Task {id: $id})
SET t.status = 'done', t.output = $output, t.ended_at = $at, t.ms = $at - t.started_at, t.note = $note`),

  fail: q('fail', false, 'The task failed: back to ready while it has attempts left, else failed for good.', `
MATCH (t:Task {id: $id})
SET t.error = $error, t.ended_at = $at,
    t.status = CASE WHEN t.attempts < t.max THEN 'ready' ELSE 'failed' END
RETURN t.status AS status, t.attempts AS attempts, t.max AS max`),

  expired: q('expired', false, 'Leases that ran out (a worker died): those tasks are ready again.', `
MATCH (:Run {id: $run})-[:HAS_TASK]->(t:Task {status: 'running'})
WHERE t.lease_until < $now
SET t.status = 'ready', t.worker = null
RETURN t.id AS id, t.kind AS kind, t.resource AS resource`),

  readyTasks: q('readyTasks', true, 'Ready tasks of a run (re-queued after a restart).', `
MATCH (:Run {id: $run})-[:HAS_TASK]->(t:Task {status: 'ready'})
RETURN t.id AS id, t.kind AS kind, t.resource AS resource`),

  task: q('task', true, 'One task with its run.', `
MATCH (r:Run)-[:HAS_TASK]->(t:Task {id: $id})
RETURN t.id AS id, t.kind AS kind, t.agent AS agent, t.scope AS scope, t.status AS status, t.input AS input,
       t.output AS output, t.attempts AS attempts, r.id AS run`),

  outputs: q('outputs', true, 'Outputs of a run’s done tasks (what a task reads from the ones before it).', `
MATCH (:Run {id: $run})-[:HAS_TASK]->(t:Task {status: 'done'})
RETURN t.id AS id, t.kind AS kind, t.scope AS scope, t.output AS output`),

  board: q('board', true, 'The run’s task board: every task, its state, timing and dependencies.', `
MATCH (:Run {id: $run})-[:HAS_TASK]->(t:Task)
OPTIONAL MATCH (t)-[:DEPENDS_ON]->(d:Task)
RETURN t.id AS id, t.kind AS kind, t.agent AS agent, t.scope AS scope, t.title AS title, t.status AS status,
       t.attempts AS attempts, t.started_at AS started, t.ended_at AS ended, t.ms AS ms, t.note AS note, t.error AS error,
       t.at AS at, collect(d.id) AS deps
ORDER BY at, id`),

  reopen: q('reopen', false, 'Send-back: these tasks and everything downstream of them go back to waiting (attempt budgets reset).', `
MATCH (:Run {id: $run})-[:HAS_TASK]->(t:Task)
WHERE t.id IN $ids
OPTIONAL MATCH (down:Task)-[:DEPENDS_ON*1..12]->(t)
WITH collect(DISTINCT t) + collect(DISTINCT down) AS all
UNWIND all AS x
WITH DISTINCT x WHERE x IS NOT NULL
SET x.status = 'waiting', x.attempts = 0, x.output = null, x.error = null, x.reopened = coalesce(x.reopened, 0) + 1
RETURN x.id AS id`),

  addTasks: q('addTasks', false, 'New tasks join a running run (fan-out: research questions, assets, scenes, render chunks).', `
MATCH (r:Run {id: $run})
UNWIND $tasks AS t
CREATE (k:Task {id: t.id, kind: t.kind, agent: t.agent, resource: t.resource, scope: t.scope, title: t.title,
                status: 'waiting', attempts: 0, max: t.max, input: t.input, waits: t.waits, optional: t.optional, at: $at})
CREATE (r)-[:HAS_TASK]->(k)`),

  cancelRun: q('cancelRun', false, 'Stop a run: everything not done is cancelled.', `
MATCH (r:Run {id: $run})-[:HAS_TASK]->(t:Task)
WHERE t.status IN ['waiting', 'ready', 'running']
SET t.status = 'cancelled'
WITH r
SET r.status = 'cancelled'`),

  /* ───── facts, sources, claims: the truth guard ───── */
  writeSources: q('writeSources', false, 'Where facts come from: a page, an upload, the user’s own words.', `
UNWIND $rows AS r
MERGE (s:Source {id: r.id})
SET s.kind = r.kind, s.ref = r.ref, s.title = r.title, s.at = $at`),

  writeFacts: q('writeFacts', false, 'Facts the video may say, each FROM a source.', `
UNWIND $rows AS r
MATCH (s:Source {id: r.source})
MERGE (f:Fact {id: r.id})
SET f.text = r.text, f.status = r.status, f.run = $run, f.at = $at
MERGE (f)-[:FROM]->(s)`),

  facts: q('facts', true, 'Every fact with its source.', `
MATCH (f:Fact)-[:FROM]->(s:Source)
WHERE f.status IN ['verified', 'user_stated']
RETURN f.id AS id, f.text AS text, f.status AS status, s.kind AS kind, s.ref AS source
ORDER BY f.at`),

  factSearch: q('factSearch', true, 'Full text: facts that mention a line’s words.', `
CALL db.idx.fulltext.queryNodes('Fact', $q) YIELD node, score
MATCH (node)-[:FROM]->(s:Source)
WHERE node.status IN ['verified', 'user_stated']
RETURN node.id AS id, node.text AS text, s.ref AS source, score
ORDER BY score DESC LIMIT 5`),

  writeClaim: q('writeClaim', false, 'A line the video says, linked to the facts it rests on.', `
MATCH (r:Run {id: $run}), (a:Agent {id: $agent})
CREATE (c:Claim {id: $id, beat: $beat, field: $field, text: $text, status: 'pending', at: $at})
CREATE (a)-[:WROTE]->(c)
CREATE (r)-[:HAS_CLAIM]->(c)
WITH c
UNWIND $facts AS fid
MATCH (f:Fact {id: fid})
CREATE (c)-[:SUPPORTED_BY]->(f)`),

  truthGuard: q('truthGuard', true, 'Truth guard: a claim ships only with a path to a fact the project stands behind. No path, no claim.', `
MATCH (c:Claim {id: $id})-[:SUPPORTED_BY]->(f:Fact)-[:FROM]->(s:Source)
WHERE f.status IN ['verified', 'user_stated']
RETURN f.id AS fact, f.text AS text, s.ref AS source`),

  judgeClaim: q('judgeClaim', false, 'The verdict on a claim.', `
MATCH (c:Claim {id: $id})
SET c.status = $status, c.reason = $reason`),

  supersedeClaims: q('supersedeClaims', false, 'A new draft of the script is judged: the claims of earlier drafts are superseded (kept, not counted).', `
MATCH (:Run {id: $run})-[:HAS_CLAIM]->(c:Claim {field: $field})
WHERE c.status <> 'superseded'
SET c.status = 'superseded', c.supersededAt = $at
RETURN count(c) AS n`),

  claims: q('claims', true, 'A run’s claims and their verdicts (the shipped script’s, not superseded drafts’).', `
MATCH (:Run {id: $run})-[:HAS_CLAIM]->(c:Claim)
WHERE coalesce(c.status, '') <> 'superseded'
OPTIONAL MATCH (c)-[:SUPPORTED_BY]->(f:Fact)
RETURN c.id AS id, c.beat AS beat, c.field AS field, c.text AS text, c.status AS status, c.reason AS reason, collect(f.id) AS facts
ORDER BY c.beat, c.at`),

  /* ───── scenes and assets ───── */
  saveScene: q('saveScene', false, 'A Shot Builder’s scene program (a new version each write; the latest one counts).', `
MATCH (r:Run {id: $run})
MERGE (s:Scene {id: $id})
SET s.i = $i, s.program = $program, s.version = coalesce(s.version, 0) + 1, s.by = $agent, s.at = $at, s.qa = $qa
MERGE (r)-[:HAS_SCENE]->(s)
RETURN s.version AS version`),

  /* ───── 3D looks: the art director's pick per scene ───── */
  useLook3d: q('useLook3d', false, 'The art director gives a scene a 3D look: (Scene)-[:USES_3D]->(Look3D), with his reason on the edge.', `
MATCH (r:Run {id: $run})
MERGE (s:Scene {id: $scene})
  ON CREATE SET s.i = $i
MERGE (r)-[:HAS_SCENE]->(s)
MERGE (l:Look3D {id: $look})
  ON CREATE SET l.name = $name
MERGE (s)-[u:USES_3D]->(l)
SET u.why = $why, u.at = $at
RETURN l.id AS look`),

  looksInRun: q('looksInRun', true, 'Which 3D look each scene of a run uses, in order.', `
MATCH (:Run {id: $run})-[:HAS_SCENE]->(s:Scene)-[u:USES_3D]->(l:Look3D)
RETURN s.i AS i, l.id AS look, u.why AS why
ORDER BY s.i`),

  look3dUsage: q('look3dUsage', true, 'How often each 3D look has been used in this project’s films (the art director varies them).', `
MATCH (s:Scene)-[:USES_3D]->(l:Look3D)
RETURN l.id AS look, count(DISTINCT s) AS scenes
ORDER BY scenes DESC`),

  /* ───── maps: the real places a scene shows ───── */
  showPlace: q('showPlace', false, 'A scene shows a real place: (Scene)-[:SHOWS {n}]->(Place), the Place copied from the geocoding cache.', `
MATCH (r:Run {id: $run})
MERGE (s:Scene {id: $scene})
  ON CREATE SET s.i = $i
MERGE (r)-[:HAS_SCENE]->(s)
MERGE (p:Place {key: $key})
  ON CREATE SET p.name = $name, p.lat = $lat, p.lon = $lon, p.cc = $cc, p.country = $country
MERGE (s)-[w:SHOWS]->(p)
SET w.n = $n
RETURN p.key AS key`),

  placesInRun: q('placesInRun', true, 'The places each scene of a run shows, in scene and visit order (the map camera flies through them).', `
MATCH (:Run {id: $run})-[:HAS_SCENE]->(s:Scene)-[w:SHOWS]->(p:Place)
RETURN s.i AS i, w.n AS n, p.key AS key, p.name AS name, p.lat AS lat, p.lon AS lon, p.cc AS cc, p.country AS country
ORDER BY s.i, w.n`),

  placeUsage: q('placeUsage', true, 'Places this project has already shown (the art director picks a different map shot than the last film).', `
MATCH (s:Scene)-[:SHOWS]->(p:Place)
RETURN p.name AS name, p.cc AS cc, count(DISTINCT s) AS scenes
ORDER BY scenes DESC
LIMIT $n`),

  scenes: q('scenes', true, 'A run’s scene programs in order.', `
MATCH (:Run {id: $run})-[:HAS_SCENE]->(s:Scene)
RETURN s.id AS id, s.i AS i, s.program AS program, s.version AS version, s.qa AS qa
ORDER BY s.i`),

  writeAsset: q('writeAsset', false, 'An asset for the video: where it came from, its file, its hash and the judge’s score.', `
MATCH (r:Run {id: $run})
MERGE (a:Asset {id: $id})
SET a.kind = $kind, a.path = $path, a.sha = $sha, a.source = $source, a.about = $about, a.score = $score,
    a.w = $w, a.h = $h, a.request = $request, a.at = $at
MERGE (r)-[:HAS_ASSET]->(a)`),

  assets: q('assets', true, 'A run’s assets.', `
MATCH (:Run {id: $run})-[:HAS_ASSET]->(a:Asset)
RETURN a.id AS id, a.kind AS kind, a.path AS path, a.sha AS sha, a.source AS source, a.about AS about, a.score AS score,
       a.w AS w, a.h AS h, a.request AS request`),

  /* ───── the edit lattice (Art Director's kit.suggest: algo.SPpaths) ───── */
  latticeNodes: q('latticeNodes', false, 'The preset lattice for one board: one node per (beat, preset).', `
UNWIND $nodes AS n
CREATE (:Lattice {id: n.id, run: $run, slot: n.slot, preset: n.preset, penalty: n.penalty})`),

  latticeEdges: q('latticeEdges', false, 'Lattice edges: w = how well a flows into b + b’s over-use penalty.', `
UNWIND $edges AS e
MATCH (a:Lattice {id: e.from}), (b:Lattice {id: e.to})
CREATE (a)-[:NEXT {w: e.w}]->(b)`),

  boardPaths: q('boardPaths', true, 'The k cheapest preset sequences through the lattice (algo.SPpaths).', `
MATCH (s:Lattice {id: $start}), (t:Lattice {id: $end})
CALL algo.SPpaths({sourceNode: s, targetNode: t, relTypes: ['NEXT'], weightProp: 'w', pathCount: $k, maxLen: $maxLen})
YIELD path, pathWeight
RETURN [n IN nodes(path) | n.preset] AS presets, pathWeight AS cost
ORDER BY cost ASC`),

  clearLattice: q('clearLattice', false, 'The lattice is scratch space: gone once the board is chosen.', `
MATCH (n:Lattice {run: $run})
DETACH DELETE n`),

  /* ───── decisions, issues, provenance ───── */
  decide: q('decide', false, 'Provenance: an agent decided something about a target (a run, a scene, a claim, an asset).', `
MATCH (a:Agent {id: $agent})
OPTIONAL MATCH (x) WHERE x.id = $target AND (x:Run OR x:Scene OR x:Claim OR x:Asset OR x:Video)
WITH a, x
CREATE (a)-[:MADE]->(d:Decision {id: $id, kind: $kind, why: $why, at: $at, lessons: $lessons, laws: $laws, target: $target})
FOREACH (_ IN CASE WHEN x IS NULL THEN [] ELSE [1] END | CREATE (d)-[:CHOSE]->(x))
WITH d
UNWIND $because AS b
MATCH (n) WHERE n.id = b AND (n:Fact OR n:Source OR n:Claim OR n:Asset OR n:Issue OR n:Upload OR n:Message)
MERGE (d)-[:BECAUSE]->(n)
RETURN DISTINCT d.id AS id`),

  raiseIssue: q('raiseIssue', false, 'Lens raises an issue on part of the run and returns it to the agent who owns that part.', `
MATCH (r:Run {id: $run}), (lens:Agent {id: 'lens'}), (owner:Agent {id: $owner})
CREATE (lens)-[:RAISED]->(i:Issue {id: $id, kind: $kind, law: $law, scope: $scope, text: $text, at: $at, status: 'open', blocking: $blocking})
CREATE (i)-[:ON]->(r)
CREATE (i)-[:RETURNED_TO]->(owner)`),

  openIssues: q('openIssues', true, 'Open issues on a run.', `
MATCH (i:Issue {status: 'open'})-[:ON]->(:Run {id: $run})
MATCH (i)-[:RETURNED_TO]->(o:Agent)
RETURN i.id AS id, i.kind AS kind, i.law AS law, i.scope AS scope, i.text AS text, i.blocking AS blocking, o.id AS owner
ORDER BY i.at`),

  resolveIssue: q('resolveIssue', false, 'The owner fixed it.', `
MATCH (i:Issue {id: $id})
SET i.status = 'resolved', i.resolved_at = $at, i.how = $how`),

  why: q('why', true, 'Why this: the decisions about a target, who made them, and what they rest on, down to sources.', `
MATCH (a:Agent)-[:MADE]->(d:Decision)
WHERE d.target = $target
OPTIONAL MATCH p = (d)-[:BECAUSE|FROM|SUPPORTED_BY*1..3]->(n)
RETURN a.id AS agent, d.id AS decision, d.kind AS kind, d.why AS why, d.at AS at, d.lessons AS lessons, d.laws AS laws,
       [m IN nodes(p) | {id: m.id, label: labels(m)[0], text: coalesce(m.text, m.ref, m.name, m.title, m.id)}] AS path
ORDER BY at DESC
LIMIT 20`),

  agentWork: q('agentWork', true, 'What one agent did in a run: its tasks and decisions (for @mention questions).', `
MATCH (:Run {id: $run})-[:HAS_TASK]->(t:Task {agent: $agent})
RETURN t.id AS id, t.kind AS kind, t.scope AS scope, t.status AS status, t.note AS note, t.output AS output, t.ms AS ms
ORDER BY t.started_at`),

  agentDecisions: q('agentDecisions', true, 'One agent’s decisions in this project, newest first.', `
MATCH (:Agent {id: $agent})-[:MADE]->(d:Decision)
RETURN d.id AS id, d.kind AS kind, d.why AS why, d.target AS target, d.at AS at
ORDER BY d.at DESC
LIMIT $n`),

  /* ───── feedback on this project's films (the user-graph copy is what later films read) ───── */
  noteFeedback: q('noteFeedback', false, 'A user edit or rejection is kept on the real Run and Video (the film) it was about, so “why” can show it.', `
MATCH (r:Run {id: $run})<-[:BUILT_BY]-(v:Video)
MERGE (fb:Feedback {id: $id})
  ON CREATE SET fb.kind = $kind, fb.rejected = $rejected, fb.before = $before, fb.after = $after, fb.value = $value,
                fb.why = $why, fb.source = $source, fb.scene = $scene, fb.at = $at
MERGE (fb)-[:IN_RUN]->(r)
MERGE (fb)-[:ON_FILM]->(v)
RETURN fb.id AS id`),

  noteFeedbackScene: q('noteFeedbackScene', false, 'The note also points at the real Scene it was about.', `
MATCH (fb:Feedback {id: $id}), (s:Scene {id: $scene})
MERGE (fb)-[:ON_SCENE]->(s)`),

  feedbackOnRun: q('feedbackOnRun', true, 'The notes the user gave on a run, with the scene each was about.', `
MATCH (fb:Feedback)-[:IN_RUN]->(:Run {id: $run})
OPTIONAL MATCH (fb)-[:ON_SCENE]->(s:Scene)
RETURN fb.id AS id, fb.kind AS kind, fb.rejected AS rejected, fb.before AS before, fb.after AS after, fb.value AS value,
       fb.why AS why, s.i AS scene
ORDER BY fb.at`),
};
