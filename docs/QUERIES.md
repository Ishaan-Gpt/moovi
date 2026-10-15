# Every Cypher query the engine runs

Generated from `packages/graph/src/queries/` by `pnpm --filter @moovi/graph docs`. Agents never write Cypher of
their own: they call these by name with parameters. Read-only queries run as `GRAPH.RO_QUERY` (the server refuses
writes), every query has a timeout, and every one is timed and attributed to the agent that ran it.

Graphs: `craft` (style knowledge only, shared), `sys` (accounts, sessions, the project index), one `user_<uid>` per user,
one `proj_<pid>` per project.

The ones the product stands on:

| Job | Query | Graph feature |
|---|---|---|
| The scheduler | `promote`, `claim`, `expired`, `reopen` | `DEPENDS_ON` readiness, leases, variable-length downstream |
| Truth guard (no path, no claim) | `truthGuard` | path Claim → Fact → Source |
| Board planning | `boardPaths` | `algo.SPpaths` over the preset lattice |
| Over-use penalty | `overUse` | `algo.pageRank` over the user's own preset sequences |
| Never reuse an asset | `assetUsed` | content hash per user |
| Lessons that persist | `lessonsFor`, `supersedeLesson` | `SUPERSEDES` + `invalid_at` |
| Why this | `why` | variable-length provenance path |
| A style never repeats itself | `recentFilms`, `rememberFilm` | `(:Film)-[:CAST {i}]->(:Setup)`, `-[:TOLD]->(:Arc)`, `-[:ABOUT]->(:Site)` |
| What a style leans on | `overUsed` | `algo.pageRank` over `(:Setup)-[:NEXT_TO]->(:Setup)` |
| The library grows | `growSetup`, `grownSetups` | kept improvisations as `(:Setup {generated: true})` |
| Why this film | `filmStory` | each beat's set-up, arc and site |
| Memory of edits and rejections | `recordFeedback`, `rejectedStyles`, `preferredVoice`, `rewrittenLines`, `rejectedShots`, `styleTaste` | `(:Feedback)-[:ON_FILM]->(:Film)`, `-[:ON_SCENE]->(:Scene)`, `-[:IN_RUN]->(:Run)`, read before the next film |
| What the matcher scores | `signatures` | style signatures |

## craft (style knowledge, shared)

### `seedComponents` (write)

Idempotent seed: components and the slots they can fill.

```cypher
UNWIND $rows AS r
MERGE (c:Component {id: r.id})
SET c.name = r.name, c.category = r.category, c.description = r.description, c.notes = r.notes,
    c.duration = r.duration, c.formats = r.formats
WITH c, r
UNWIND r.slots AS s
MERGE (sl:Slot {id: s.id})
MERGE (c)-[f:FILLS]->(sl)
SET f.rank = s.rank
```

### `seedFlows` (write)

Idempotent seed: how well one component flows into the next (lower w is better).

```cypher
UNWIND $rows AS r
MATCH (a:Component {id: r.from}), (b:Component {id: r.to})
MERGE (a)-[f:FLOWS_INTO]->(b)
SET f.w = r.w
```

### `seedRecipes` (write)

Idempotent seed: post shapes as ordered slot steps (generate from words, or edit around footage).

```cypher
UNWIND $rows AS r
MERGE (re:Recipe {id: r.id})
SET re.slots = r.slots, re.mode = r.mode
WITH re, r
UNWIND range(0, size(r.slots) - 1) AS i
MATCH (s:Slot {id: r.slots[i]})
MERGE (re)-[:STEP {i: i}]->(s)
```

### `seedTransitions` (write)

Idempotent seed: transitions; signature ones are used once per video.

```cypher
UNWIND $rows AS r
MERGE (t:Transition {id: r.id})
SET t.name = r.name, t.description = r.description, t.signature = r.signature
```

### `seedTracks` (write)

Idempotent seed: CC-BY music beds with measured tempo.

```cypher
UNWIND $rows AS r
MERGE (t:Track {id: r.id})
SET t.name = r.name, t.mood = r.mood, t.bpm = r.bpm, t.energy = r.energy, t.feel = r.feel,
    t.offset = r.offset, t.src = r.src, t.credit = r.credit
```

### `seedBeats` (write)

Idempotent seed: the beat grid of each bed (t is seconds into the video).

```cypher
UNWIND $rows AS r
MATCH (t:Track {id: r.track})
MERGE (b:Beat {id: r.id})
SET b.t = r.t, b.i = r.i, b.down = r.down
MERGE (t)-[:HAS_BEAT]->(b)
```

### `seedStyles` (write)

Idempotent seed: the video styles (generate or edit), what each makes and where it renders.

```cypher
UNWIND $rows AS r
MERGE (s:Style {id: r.id})
SET s.name = r.name, s.number = r.number, s.mode = r.mode, s.tagline = r.tagline, s.pitch = r.pitch, s.formats = r.formats,
    s.min = r.min, s.max = r.max, s.renders = r.renders, s.engine = r.engine, s.needs = r.needs, s.skill = r.skill,
    s.source = r.source, s.autonomous = r.autonomous
```

### `seedLaws` (write)

Idempotent seed: each style’s laws, in the order every review checks them.

```cypher
UNWIND $rows AS r
MATCH (s:Style {id: r.style})
MERGE (l:Law {id: r.id})
SET l.title = r.title, l.text = r.text, l.src = r.src
MERGE (s)-[h:HAS_LAW]->(l)
SET h.n = r.n
```

### `seedChecks` (write)

Idempotent seed: the machine checks that test a law (Lens runs every one; a failure names its law).

```cypher
UNWIND $rows AS r
MATCH (l:Law {id: r.law})
MERGE (c:Check {id: r.id})
SET c.kind = r.kind, c.about = r.about, c.params = r.params, c.blocking = r.blocking
MERGE (l)-[:CHECKED_BY]->(c)
```

### `seedSkill` (write)

Idempotent seed: a style’s skill package, in sections; each section says which agents read it.

```cypher
MATCH (s:Style {id: $style})
MERGE (k:Skill {id: $id})
SET k.name = $name, k.version = $version, k.source = $source
MERGE (s)-[:HAS_SKILL]->(k)
WITH k
OPTIONAL MATCH (k)-[old:HAS_SECTION]->(x:SkillSection)
DELETE old, x
WITH DISTINCT k
UNWIND $sections AS r
CREATE (x:SkillSection {id: r.id, title: r.title, roles: r.roles, text: r.text})
CREATE (k)-[:HAS_SECTION {n: r.n}]->(x)
```

### `seedSignatures` (write)

Idempotent seed: what a style is for, as features the deterministic matcher scores a brief against.

```cypher
UNWIND $rows AS r
MATCH (s:Style {id: r.style})
MERGE (g:StyleSignature {id: r.id})
SET g.formats = r.formats, g.min = r.min, g.max = r.max, g.languages = r.languages, g.footage = r.footage,
    g.intents = r.intents, g.avoid = r.avoid, g.threshold = r.threshold, g.autonomous = r.autonomous
MERGE (s)-[:SIGNED]->(g)
```

### `seedDecks` (write)

Idempotent seed: concept decks and their cards. A hand is one card per deck; fingerprint decks decide uniqueness.

```cypher
UNWIND $rows AS r
MATCH (s:Style {id: r.style})
MERGE (d:Deck {id: r.id})
SET d.name = r.name, d.about = r.about, d.fingerprint = r.fingerprint
MERGE (s)-[:HAS_DECK]->(d)
WITH d, r
UNWIND r.cards AS c
MERGE (k:Card {id: c.id})
SET k.name = c.name, k.line = c.line, k.use = c.use, k.deck = r.name
MERGE (d)-[:HAS_CARD]->(k)
```

### `seedPresets` (write)

Idempotent seed: a style’s shot presets, the beat roles each can play and what content it needs.

```cypher
UNWIND $rows AS r
MATCH (s:Style {id: r.style})
MERGE (p:Preset {id: r.id})
SET p.name = r.name, p.roles = r.roles, p.needs = r.needs, p.props = r.props, p.about = r.about
MERGE (s)-[:HAS_PRESET]->(p)
```

### `seedPresetFlows` (write)

Idempotent seed: how well one preset follows another (lower w is better; never the same twice running).

```cypher
UNWIND $rows AS r
MATCH (a:Preset {id: r.a}), (b:Preset {id: r.b})
MERGE (a)-[f:FLOWS_INTO]->(b)
SET f.w = r.w
```

### `seedDefaultStages` (write)

Idempotent seed: each style’s brand-free default stage (accent, ink, paper, font, glows).

```cypher
UNWIND $rows AS r
MATCH (s:Style {id: r.style})
MERGE (g:Stage {id: r.id})
SET g.accent = r.accent, g.accentDeep = r.accentDeep, g.ink = r.ink, g.stage = r.stage, g.font = r.font,
    g.glows = r.glows, g.grid = r.grid, g.burst = r.burst
MERGE (s)-[:DEFAULT_STAGE]->(g)
```

### `recipes` (read-only)

Post shapes for a mode (generate or edit).

```cypher
MATCH (r:Recipe {mode: $mode})-[s:STEP]->(sl:Slot)
WITH r, s.i AS i, sl.id AS slot ORDER BY i
RETURN r.id AS id, collect(slot) AS slots
```

### `tracksByMood` (read-only)

Every bed, by mood and energy.

```cypher
MATCH (t:Track)
RETURN t.id AS id, t.name AS name, t.mood AS mood, t.bpm AS bpm, t.energy AS energy, t.offset AS offset, t.src AS src, t.credit AS credit
ORDER BY t.mood, t.energy
```

### `tracks` (read-only)

Beds in the wanted moods, nearest in energy and tempo, skipping ones this user used lately.

```cypher
MATCH (t:Track)
WHERE t.mood IN $moods AND NOT t.id IN $avoid
RETURN t.id AS id, t.name AS name, t.mood AS mood, t.bpm AS bpm, t.energy AS energy, t.offset AS offset,
       t.src AS src, t.credit AS credit
ORDER BY abs(t.energy - $energy) + abs(t.bpm - $bpm) / 100.0 ASC
LIMIT 3
```

### `downbeats` (read-only)

Downbeats of a bed inside a time span, to snap cuts to.

```cypher
MATCH (:Track {id: $track})-[:HAS_BEAT]->(b:Beat)
WHERE b.down = true AND b.t >= $from AND b.t <= $to
RETURN b.id AS id, b.t AS t, b.i AS i
ORDER BY b.t
```

### `candidates` (read-only)

Components that can fill a slot in this format.

```cypher
MATCH (c:Component)-[f:FILLS]->(:Slot {id: $slot})
WHERE $format IN c.formats
RETURN c.id AS id, c.name AS name, c.category AS category, c.duration AS duration, c.notes AS notes, f.rank AS rank
ORDER BY f.rank
```

### `signatures` (read-only)

Every style signature, for the deterministic matcher.

```cypher
MATCH (s:Style)-[:SIGNED]->(g:StyleSignature)
RETURN s.id AS style, s.name AS name, s.mode AS mode, g.formats AS formats, g.min AS min, g.max AS max,
       g.languages AS languages, g.footage AS footage, g.intents AS intents, g.avoid AS avoid,
       g.threshold AS threshold, g.autonomous AS autonomous
ORDER BY s.id
```

### `styles` (read-only)

The styles, with their laws and counts.

```cypher
MATCH (s:Style)
OPTIONAL MATCH (s)-[h:HAS_LAW]->(l:Law)
WITH s, h, l ORDER BY h.n
WITH s, [x IN collect({n: h.n, title: l.title, text: l.text}) WHERE x.title IS NOT NULL] AS laws
OPTIONAL MATCH (s)-[:HAS_DECK]->(d:Deck)
RETURN s.id AS id, s.name AS name, s.number AS number, s.mode AS mode, s.tagline AS tagline, s.pitch AS pitch,
       s.formats AS formats, s.min AS min, s.max AS max, s.renders AS renders, s.autonomous AS autonomous,
       laws, count(d) AS decks
ORDER BY mode DESC, number
```

### `skillFor` (read-only)

The skill sections one agent role reads for a style (sections with no roles are for everyone).

```cypher
MATCH (:Style {id: $style})-[:HAS_SKILL]->(k:Skill)-[h:HAS_SECTION]->(x:SkillSection)
WHERE size(x.roles) = 0 OR $role IN x.roles
RETURN k.id AS skill, k.version AS version, x.id AS id, x.title AS title, x.text AS text
ORDER BY h.n
```

### `lawsAndChecks` (read-only)

A style’s laws in review order, each with the machine checks that test it.

```cypher
MATCH (:Style {id: $style})-[h:HAS_LAW]->(l:Law)
OPTIONAL MATCH (l)-[:CHECKED_BY]->(c:Check)
WITH h, l, collect({id: c.id, kind: c.kind, about: c.about, params: c.params, blocking: c.blocking}) AS checks
RETURN l.id AS id, h.n AS n, l.title AS title, l.text AS text, [x IN checks WHERE x.id IS NOT NULL] AS checks
ORDER BY n
```

### `stylePresets` (read-only)

A style’s presets with their roles and needs.

```cypher
MATCH (:Style {id: $style})-[:HAS_PRESET]->(p:Preset)
RETURN p.id AS id, p.name AS name, p.roles AS roles, p.needs AS needs, p.props AS props, p.about AS about
ORDER BY p.id
```

### `presetFlows` (read-only)

Flow weights between a style’s presets.

```cypher
MATCH (:Style {id: $style})-[:HAS_PRESET]->(a:Preset)-[f:FLOWS_INTO]->(b:Preset)
RETURN a.id AS a, b.id AS b, f.w AS w
```

### `defaultStage` (read-only)

A style’s default stage (a user’s own look, when they have one, lives in their graph).

```cypher
MATCH (:Style {id: $style})-[:DEFAULT_STAGE]->(g:Stage)
RETURN g.accent AS accent, g.accentDeep AS accentDeep, g.ink AS ink, g.stage AS stage, g.font AS font,
       g.glows AS glows, g.grid AS grid, g.burst AS burst
```

### `styleDecks` (read-only)

A style’s concept decks with their cards.

```cypher
MATCH (:Style {id: $style})-[:HAS_DECK]->(d:Deck)-[:HAS_CARD]->(k:Card)
WITH d, k ORDER BY k.id
RETURN d.id AS id, d.name AS name, d.about AS about, d.fingerprint AS fingerprint,
       collect({id: k.id, name: k.name, line: k.line, use: k.use}) AS cards
ORDER BY d.id
```

### `allProps` (read-only)

Scrub check: every craft node with its properties (scanned for brand or client-film names).

```cypher
MATCH (n)
WHERE NOT n:Beat
RETURN labels(n)[0] AS label, n.id AS id, properties(n) AS props
```

### `counts` (read-only)

How much craft knowledge there is, per label.

```cypher
MATCH (n)
RETURN labels(n)[0] AS label, count(n) AS n
ORDER BY label
```

## sys (accounts and the project index)

### `createUser` (write)

Sign-up: a new account, only if no account has this email.

```cypher
OPTIONAL MATCH (x:User {email: $email})
WITH x WHERE x IS NULL
CREATE (u:User {id: $id, email: $email, name: $name, hash: $hash, salt: $salt, at: $at})
RETURN u.id AS id
```

### `userByEmail` (read-only)

Sign-in: the account for an email, with its password hash.

```cypher
MATCH (u:User {email: $email})
RETURN u.id AS id, u.email AS email, u.name AS name, u.hash AS hash, u.salt AS salt
```

### `userById` (read-only)

An account by id (never its hash).

```cypher
MATCH (u:User {id: $id})
RETURN u.id AS id, u.email AS email, u.name AS name, u.at AS at
```

### `createSession` (write)

A signed-in session for an account (the cookie holds the token; the graph its hash).

```cypher
MATCH (u:User {id: $user})
CREATE (s:Session {hash: $hash, at: $at, expires: $expires})-[:OF]->(u)
```

### `sessionUser` (read-only)

Who a session belongs to, if it has not expired.

```cypher
MATCH (s:Session {hash: $hash})-[:OF]->(u:User)
WHERE s.expires > $now
RETURN u.id AS id, u.email AS email, u.name AS name
```

### `deleteSession` (write)

Sign-out: the session is gone.

```cypher
MATCH (s:Session {hash: $hash})
DELETE s
```

### `pruneSessions` (write)

Expired sessions are removed.

```cypher
MATCH (s:Session)
WHERE s.expires <= $now
DELETE s
```

### `createProject` (write)

A user opens a new project (its own graph is created next to this index row).

```cypher
MATCH (u:User {id: $user})
CREATE (p:Project {id: $id, name: $name, at: $at, updated: $at, chats: 0, videos: 0})
CREATE (u)-[:OWNS]->(p)
RETURN p.id AS id
```

### `userProjects` (read-only)

The dashboard: a user’s projects, most recently used first.

```cypher
MATCH (:User {id: $user})-[:OWNS]->(p:Project)
WHERE p.closed IS NULL OR p.closed = false
RETURN p.id AS id, p.name AS name, p.at AS at, p.updated AS updated, p.chats AS chats, p.videos AS videos, p.poster AS poster
ORDER BY p.updated DESC
```

### `projectOwner` (read-only)

Who owns a project (every project request is checked against it).

```cypher
MATCH (u:User)-[:OWNS]->(p:Project {id: $id})
RETURN u.id AS user, p.name AS name
```

### `touchProject` (write)

The project index follows the project: name, counts, latest poster, last use.

```cypher
MATCH (p:Project {id: $id})
SET p.updated = $at,
    p.name = coalesce($name, p.name),
    p.chats = coalesce($chats, p.chats),
    p.videos = coalesce($videos, p.videos),
    p.poster = coalesce($poster, p.poster)
```

## user_<uid> (one per user)

### `initUser` (write)

The user’s own graph starts with them in it.

```cypher
MERGE (u:User {id: $id})
SET u.name = $name, u.at = coalesce(u.at, $at)
```

### `writeLesson` (write)

Keeper files a lesson from the user’s note: which agents it binds, which law it amends.

```cypher
MATCH (u:User)
CREATE (l:Lesson {id: $id, text: $text, topic: $topic, roles: $roles, law: $law, style: $style, at: $at, valid_from: $at,
                  source: $source, chat: $chat})
CREATE (u)-[:TAUGHT]->(l)
RETURN l.id AS id
```

### `supersedeLesson` (write)

A newer lesson about the same thing replaces the older one, which stops being valid now.

```cypher
MATCH (n:Lesson {id: $id}), (o:Lesson {id: $old})
SET o.invalid_at = $at
MERGE (n)-[:SUPERSEDES]->(o)
```

### `lessonsFor` (read-only)

The current lessons one agent must follow (for this style, or for every style).

```cypher
MATCH (l:Lesson)
WHERE l.invalid_at IS NULL
  AND (size(l.roles) = 0 OR $role IN l.roles)
  AND (l.style IS NULL OR l.style = $style)
RETURN l.id AS id, l.text AS text, l.topic AS topic, l.law AS law, l.at AS at
ORDER BY l.at DESC
```

### `lessonsOnTopic` (read-only)

Current lessons on a topic (Keeper decides whether a new note supersedes one).

```cypher
MATCH (l:Lesson)
WHERE l.invalid_at IS NULL AND l.topic = $topic
RETURN l.id AS id, l.text AS text, l.roles AS roles, l.law AS law, l.at AS at
ORDER BY l.at DESC
```

### `lessonTimeline` (read-only)

Every lesson ever, current or superseded, with what replaced it.

```cypher
MATCH (l:Lesson)
OPTIONAL MATCH (n:Lesson)-[:SUPERSEDES]->(l)
RETURN l.id AS id, l.text AS text, l.topic AS topic, l.at AS at, l.invalid_at AS invalid_at, n.id AS replaced_by
ORDER BY l.at DESC
```

### `setPreference` (write)

A standing preference (voice, bed level, accent …), newest wins.

```cypher
MATCH (u:User)
MERGE (p:Preference {key: $key})
SET p.value = $value, p.at = $at
MERGE (u)-[:PREFERS]->(p)
```

### `preferences` (read-only)

Every standing preference.

```cypher
MATCH (:User)-[:PREFERS]->(p:Preference)
RETURN p.key AS key, p.value AS value, p.at AS at
```

### `assetUsed` (read-only)

Has any of this user’s videos already used this asset (by content hash)?

```cypher
MATCH (a:AssetUse {hash: $hash})
RETURN a.video AS video, a.project AS project, a.at AS at
LIMIT 1
```

### `recordAssets` (write)

A finished video’s assets join the never-again list.

```cypher
UNWIND $rows AS r
MERGE (a:AssetUse {hash: r.hash})
SET a.kind = r.kind, a.video = $video, a.project = $project, a.at = $at
```

### `anglesUsed` (read-only)

Angles and hook forms this user’s recent videos already took.

```cypher
MATCH (v:VideoRef)
WHERE $style IS NULL OR v.style = $style
RETURN v.id AS video, v.angle AS angle, v.hook AS hook, v.title AS title, v.at AS at
ORDER BY v.at DESC
LIMIT $n
```

### `recordVideo` (write)

A finished video is remembered: its style, angle, hook and preset sequence (the next one avoids them).

```cypher
MERGE (v:VideoRef {id: $video})
SET v.project = $project, v.style = $style, v.angle = $angle, v.hook = $hook, v.title = $title, v.at = $at,
    v.bed = $bed, v.card = $card
WITH v
UNWIND $presets AS p
MERGE (x:PresetRef {id: p})
MERGE (v)-[:USED]->(x)
```

### `recordSequence` (write)

The video’s preset order joins the usage graph (PageRank over it is the over-use penalty).

```cypher
UNWIND $pairs AS pr
MERGE (a:PresetRef {id: pr.a})
MERGE (b:PresetRef {id: pr.b})
CREATE (a)-[:NEXT_USED {video: $video}]->(b)
```

### `overUse` (read-only)

Over-use penalty: PageRank over this user’s own past preset sequences.

```cypher
CALL algo.pageRank('PresetRef', 'NEXT_USED')
YIELD node, score
RETURN node.id AS id, score
```

### `recentBeds` (read-only)

Beds this user’s recent videos used (the next one picks another).

```cypher
MATCH (v:VideoRef)
WHERE v.bed IS NOT NULL
RETURN v.bed AS bed
ORDER BY v.at DESC
LIMIT $n
```

### `recordFeedback` (write)

A user edit or rejection becomes a Feedback node on its Film and Run (film, run and style are kept as refs so the next film can read them).

```cypher
MERGE (f:Film {id: $film})
  ON CREATE SET f.project = $project, f.style = $style, f.title = $title, f.at = $at
MERGE (r:Run {id: $run})
  ON CREATE SET r.n = $runN, r.at = $at
MERGE (r)-[:OF_FILM]->(f)
MERGE (fb:Feedback {id: $id})
  ON CREATE SET fb.kind = $kind, fb.rejected = $rejected, fb.before = $before, fb.after = $after, fb.value = $value,
                fb.why = $why, fb.source = $source, fb.style = $style, fb.scene = $scene, fb.at = $at
MERGE (fb)-[:ON_FILM]->(f)
MERGE (fb)-[:IN_RUN]->(r)
RETURN fb.id AS id
```

### `linkFeedbackScene` (write)

A shot or line note also points at the Scene it was about (the scene sits in the film).

```cypher
MATCH (fb:Feedback {id: $id})-[:ON_FILM]->(f:Film)
MERGE (s:Scene {id: $scene})
  ON CREATE SET s.i = $i
MERGE (fb)-[:ON_SCENE]->(s)
MERGE (s)-[:IN_FILM]->(f)
```

### `rejectedStyles` (read-only)

Styles this user turned down, most often first, with their reasons (the matcher and the planner steer away).

```cypher
MATCH (fb:Feedback {kind: 'style', rejected: true})
WHERE fb.value IS NOT NULL
RETURN fb.value AS style, count(fb) AS n, max(fb.at) AS last, collect(fb.why) AS reasons
ORDER BY n DESC, last DESC
LIMIT $n
```

### `preferredVoice` (read-only)

The voice this user keeps choosing: picks minus rejections per voice, best first.

```cypher
MATCH (fb:Feedback {kind: 'voice'})
WHERE fb.value IS NOT NULL
WITH fb.value AS voice, sum(CASE WHEN fb.rejected THEN -1 ELSE 1 END) AS score, count(fb) AS n, max(fb.at) AS last
WHERE score > 0
RETURN voice, score, n, last
ORDER BY score DESC, last DESC
LIMIT $n
```

### `rejectedVoices` (read-only)

Voices this user turned down more than they chose (the voice step never picks them).

```cypher
MATCH (fb:Feedback {kind: 'voice'})
WHERE fb.value IS NOT NULL
WITH fb.value AS voice, sum(CASE WHEN fb.rejected THEN -1 ELSE 1 END) AS score, max(fb.at) AS last
WHERE score < 0
RETURN voice, score, last
ORDER BY last DESC
LIMIT $n
```

### `rewrittenLines` (read-only)

Script lines the user rewrote or sent back: what was said, what it became, why, in which film (the planner and Scribe write like the after).

```cypher
MATCH (fb:Feedback {kind: 'script_line'})-[:ON_FILM]->(f:Film)
WHERE fb.before IS NOT NULL AND fb.after IS NOT NULL
RETURN fb.before AS before, fb.after AS after, fb.why AS why, f.title AS film, fb.at AS at
ORDER BY fb.at DESC
LIMIT $n
```

### `rejectedShots` (read-only)

Shots the user sent back: the scene, what it was, why and the style of its film (the Art Director designs another).

```cypher
MATCH (fb:Feedback {kind: 'shot', rejected: true})-[:ON_FILM]->(f:Film)
OPTIONAL MATCH (fb)-[:ON_SCENE]->(s:Scene)
RETURN s.i AS scene, fb.before AS shot, fb.why AS why, f.style AS style, f.title AS film, fb.at AS at
ORDER BY fb.at DESC
LIMIT $n
```

### `captionNotes` (read-only)

What the user said about captions and sound (size, place, level), newest first.

```cypher
MATCH (fb:Feedback)-[:ON_FILM]->(f:Film)
WHERE fb.kind IN ['caption', 'sound']
RETURN fb.kind AS kind, fb.why AS why, fb.value AS value, f.style AS style, fb.at AS at
ORDER BY fb.at DESC
LIMIT $n
```

### `styleTaste` (read-only)

Per style: how many of this user’s films got notes and how many notes were rejections (two hops: Feedback → Film).

```cypher
MATCH (fb:Feedback)-[:ON_FILM]->(f:Film)
WHERE f.style IS NOT NULL
RETURN f.style AS style, count(DISTINCT f) AS films, count(fb) AS notes, sum(CASE WHEN fb.rejected THEN 1 ELSE 0 END) AS rejected
ORDER BY rejected DESC
```

### `feedbackTrail` (read-only)

Why a film changed: every note on it with its scene and run, in order.

```cypher
MATCH (fb:Feedback)-[:ON_FILM]->(f:Film {id: $film})
OPTIONAL MATCH (fb)-[:ON_SCENE]->(s:Scene)
OPTIONAL MATCH (fb)-[:IN_RUN]->(r:Run)
RETURN fb.id AS id, fb.kind AS kind, fb.rejected AS rejected, fb.before AS before, fb.after AS after, fb.value AS value,
       fb.why AS why, s.i AS scene, r.id AS run, fb.at AS at
ORDER BY fb.at
```

## proj_<pid> (one per project)

### `initProject` (write)

The project’s own graph starts with the project and the crew in it.

```cypher
MERGE (p:Project {id: $id})
SET p.name = $name, p.owner = $owner, p.at = coalesce(p.at, $at)
WITH p
UNWIND $agents AS a
MERGE (x:Agent {id: a.id})
SET x.name = a.name, x.role = a.role
```

### `renameProject` (write)

The project takes a name (Moovi names it from the first brief).

```cypher
MATCH (p:Project)
SET p.name = $name
```

### `createChat` (write)

A new chat: one conversation, one video.

```cypher
MATCH (p:Project)
CREATE (c:Chat {id: $id, title: $title, at: $at, updated: $at, status: 'new'})
CREATE (p)-[:HAS_CHAT]->(c)
CREATE (v:Video {id: $video, status: 'none', version: 0, at: $at})
CREATE (c)-[:MAKES]->(v)
RETURN c.id AS id, v.id AS video
```

### `chats` (read-only)

Every chat of the project with its video, newest first.

```cypher
MATCH (:Project)-[:HAS_CHAT]->(c:Chat)-[:MAKES]->(v:Video)
RETURN c.id AS id, c.title AS title, c.status AS status, c.at AS at, c.updated AS updated,
       v.id AS video, v.status AS videoStatus, v.poster AS poster, v.duration AS duration, v.version AS version
ORDER BY c.updated DESC
```

### `chat` (read-only)

One chat with its video.

```cypher
MATCH (c:Chat {id: $id})-[:MAKES]->(v:Video)
RETURN c.id AS id, c.title AS title, c.status AS status, c.at AS at, v.id AS video, v.status AS videoStatus,
       v.path AS path, v.poster AS poster, v.duration AS duration, v.version AS version, v.style AS style,
       v.format AS format
```

### `setChat` (write)

A chat’s title or status changes.

```cypher
MATCH (c:Chat {id: $id})
SET c.title = coalesce($title, c.title), c.status = coalesce($status, c.status), c.updated = $at
```

### `addMessage` (write)

A message in the chat (the user, Moovi, or an agent answering an @mention).

```cypher
MATCH (c:Chat {id: $chat})
CREATE (m:Message {id: $id, role: $role, agent: $agent, text: $text, kind: $kind, data: $data, at: $at})
CREATE (c)-[:SAID]->(m)
SET c.updated = $at
```

### `messages` (read-only)

The chat’s messages in order.

```cypher
MATCH (:Chat {id: $chat})-[:SAID]->(m:Message)
RETURN m.id AS id, m.role AS role, m.agent AS agent, m.text AS text, m.kind AS kind, m.data AS data, m.at AS at
ORDER BY m.at ASC
LIMIT $n
```

### `addUpload` (write)

A file the user gave the chat (footage, a reference, images, a voice-over).

```cypher
MATCH (c:Chat {id: $chat})
CREATE (u:Upload {id: $id, name: $name, path: $path, mime: $mime, size: $size, sha: $sha, at: $at})
CREATE (c)-[:HAS_UPLOAD]->(u)
```

### `setUploadProbe` (write)

Intake’s measurements of an upload and what it decided it is.

```cypher
MATCH (u:Upload {id: $id})
SET u.probe = $probe, u.role = $role, u.why = $why
```

### `uploads` (read-only)

The chat’s uploads with what intake found.

```cypher
MATCH (:Chat {id: $chat})-[:HAS_UPLOAD]->(u:Upload)
RETURN u.id AS id, u.name AS name, u.path AS path, u.mime AS mime, u.size AS size, u.sha AS sha, u.probe AS probe,
       u.role AS role, u.why AS why
ORDER BY u.at
```

### `setVideo` (write)

The chat’s video changes state (making, ready, failed) or gets a new version.

```cypher
MATCH (v:Video {id: $id})
SET v.status = coalesce($status, v.status), v.path = coalesce($path, v.path), v.poster = coalesce($poster, v.poster),
    v.duration = coalesce($duration, v.duration), v.version = coalesce($version, v.version),
    v.style = coalesce($style, v.style), v.format = coalesce($format, v.format), v.updated = $at
```

### `videos` (read-only)

Every finished video in the project with its style card (for "like the previous one").

```cypher
MATCH (c:Chat)-[:MAKES]->(v:Video)
WHERE v.status = 'ready'
OPTIONAL MATCH (v)-[:BUILT_BY]->(r:Run {status: 'done'})
WITH c, v, r ORDER BY r.n DESC
WITH c, v, collect(r)[0] AS r
RETURN v.id AS video, c.id AS chat, c.title AS title, v.style AS style, v.format AS format, v.duration AS duration,
       v.path AS path, v.poster AS poster, r.id AS run, r.brief AS brief, r.card AS card, r.skill AS skill
ORDER BY v.updated DESC
```

### `createRun` (write)

A run builds one version of a chat’s video.

```cypher
MATCH (v:Video {id: $video})
OPTIONAL MATCH (v)-[:BUILT_BY]->(old:Run)
WITH v, count(old) AS n
CREATE (r:Run {id: $id, n: n + 1, status: 'planned', at: $at, kind: $kind, request: $request, parent: $parent})
CREATE (v)-[:BUILT_BY]->(r)
RETURN r.id AS id, r.n AS n
```

### `setRun` (write)

A run’s state, its typed brief, the style/skill it matched and the style card it used.

```cypher
MATCH (r:Run {id: $id})
SET r.status = coalesce($status, r.status), r.brief = coalesce($brief, r.brief), r.skill = coalesce($skill, r.skill),
    r.card = coalesce($card, r.card), r.match = coalesce($match, r.match), r.error = coalesce($error, r.error),
    r.updated = $at
```

### `run` (read-only)

One run.

```cypher
MATCH (c:Chat)-[:MAKES]->(v:Video)-[:BUILT_BY]->(r:Run {id: $id})
RETURN r.id AS id, r.n AS n, r.status AS status, r.kind AS kind, r.request AS request, r.parent AS parent,
       r.brief AS brief, r.skill AS skill, r.card AS card, r.match AS match, r.error AS error, r.at AS at,
       v.id AS video, c.id AS chat
```

### `latestRun` (read-only)

The chat’s latest run.

```cypher
MATCH (:Chat {id: $chat})-[:MAKES]->(:Video)-[:BUILT_BY]->(r:Run)
RETURN r.id AS id, r.n AS n, r.status AS status, r.skill AS skill, r.card AS card, r.brief AS brief
ORDER BY r.n DESC
LIMIT 1
```

### `activeRuns` (read-only)

Runs still in flight (the worker resumes them after a restart).

```cypher
MATCH (c:Chat)-[:MAKES]->(:Video)-[:BUILT_BY]->(r:Run)
WHERE r.status IN ['planned', 'running']
RETURN r.id AS id, c.id AS chat
```

### `createTasks` (write)

The run’s tasks, each owned by one agent or worker, on one resource, for one scope (copied ones arrive done).

```cypher
MATCH (r:Run {id: $run})
UNWIND $tasks AS t
CREATE (k:Task {id: t.id, kind: t.kind, agent: t.agent, resource: t.resource, scope: t.scope, title: t.title,
                status: coalesce(t.status, 'waiting'), attempts: 0, max: t.max, input: t.input, output: t.output,
                waits: t.waits, optional: t.optional, at: $at})
CREATE (r)-[:HAS_TASK]->(k)
```

### `waitingFor` (read-only)

Tasks that wait for a fan-out stage (they get a dependency on every task the stage spawns).

```cypher
MATCH (:Run {id: $run})-[:HAS_TASK]->(t:Task)
WHERE $kind IN t.waits
RETURN t.id AS id
```

### `tasksOf` (read-only)

A run’s tasks of some kinds, with their scope and state.

```cypher
MATCH (:Run {id: $run})-[:HAS_TASK]->(t:Task)
WHERE t.kind IN $kinds
RETURN t.id AS id, t.kind AS kind, t.scope AS scope, t.status AS status, t.input AS input, t.output AS output
ORDER BY t.id
```

### `park` (write)

The task waits for the user (a question card): it leaves the queue until it is answered.

```cypher
MATCH (t:Task {id: $id})
SET t.status = 'parked', t.parked_at = $at, t.question = $question, t.worker = null
```

### `unpark` (write)

The user answered: the parked task is ready again, with the answer.

```cypher
MATCH (:Run {id: $run})-[:HAS_TASK]->(t:Task {status: 'parked'})
WHERE t.question = $question
SET t.status = 'ready', t.answer = $answer, t.attempts = 0
RETURN t.id AS id, t.resource AS resource
```

### `reopenIds` (write)

Scoped send-back: exactly these tasks go back to waiting (with the note that sent them back).

```cypher
UNWIND $rows AS r
MATCH (:Run {id: $run})-[:HAS_TASK]->(t:Task {id: r.id})
SET t.status = 'waiting', t.attempts = 0, t.error = null, t.reopened = coalesce(t.reopened, 0) + 1,
    t.feedback = coalesce(r.feedback, t.feedback)
RETURN t.id AS id
```

### `runOpen` (read-only)

How much of a run is still to do (a run is done when nothing is waiting, ready, running or parked).

```cypher
MATCH (:Run {id: $run})-[:HAS_TASK]->(t:Task)
RETURN sum(CASE WHEN t.status IN ['waiting', 'ready', 'running', 'parked'] THEN 1 ELSE 0 END) AS open,
       sum(CASE WHEN t.status = 'failed' AND (t.optional IS NULL OR t.optional = false) THEN 1 ELSE 0 END) AS failed,
       count(t) AS total
```

### `taskDeps` (write)

A task waits on the tasks it depends on.

```cypher
UNWIND $deps AS d
MATCH (a:Task {id: d.task}), (b:Task {id: d.on})
MERGE (a)-[:DEPENDS_ON]->(b)
```

### `promote` (write)

Every waiting task whose dependencies are all done becomes ready (returned so the worker can queue it).

```cypher
MATCH (:Run {id: $run})-[:HAS_TASK]->(t:Task {status: 'waiting'})
OPTIONAL MATCH (t)-[:DEPENDS_ON]->(d:Task)
WITH t, collect(d.status) AS deps
WHERE all(s IN deps WHERE s = 'done')
SET t.status = 'ready', t.ready_at = $at
RETURN t.id AS id, t.kind AS kind, t.resource AS resource
```

### `claim` (write)

A worker takes a ready task with a lease (only one worker can win it).

```cypher
MATCH (t:Task {id: $id})
WHERE t.status = 'ready'
SET t.status = 'running', t.worker = $worker, t.lease_until = $lease, t.started_at = $at, t.attempts = t.attempts + 1
RETURN t.id AS id, t.kind AS kind, t.agent AS agent, t.resource AS resource, t.scope AS scope, t.title AS title,
       t.input AS input, t.attempts AS attempts, t.max AS max, t.feedback AS feedback, t.answer AS answer, t.reopened AS reopened
```

### `heartbeat` (write)

The worker still holds its task.

```cypher
MATCH (t:Task {id: $id, worker: $worker})
WHERE t.status = 'running'
SET t.lease_until = $lease, t.note = coalesce($note, t.note)
```

### `finish` (write)

The task is done; its output is kept for the tasks that depend on it.

```cypher
MATCH (t:Task {id: $id})
SET t.status = 'done', t.output = $output, t.ended_at = $at, t.ms = $at - t.started_at, t.note = $note
```

### `fail` (write)

The task failed: back to ready while it has attempts left, else failed for good.

```cypher
MATCH (t:Task {id: $id})
SET t.error = $error, t.ended_at = $at,
    t.status = CASE WHEN t.attempts < t.max THEN 'ready' ELSE 'failed' END
RETURN t.status AS status, t.attempts AS attempts, t.max AS max
```

### `expired` (write)

Leases that ran out (a worker died): those tasks are ready again.

```cypher
MATCH (:Run {id: $run})-[:HAS_TASK]->(t:Task {status: 'running'})
WHERE t.lease_until < $now
SET t.status = 'ready', t.worker = null
RETURN t.id AS id, t.kind AS kind, t.resource AS resource
```

### `readyTasks` (read-only)

Ready tasks of a run (re-queued after a restart).

```cypher
MATCH (:Run {id: $run})-[:HAS_TASK]->(t:Task {status: 'ready'})
RETURN t.id AS id, t.kind AS kind, t.resource AS resource
```

### `task` (read-only)

One task with its run.

```cypher
MATCH (r:Run)-[:HAS_TASK]->(t:Task {id: $id})
RETURN t.id AS id, t.kind AS kind, t.agent AS agent, t.scope AS scope, t.status AS status, t.input AS input,
       t.output AS output, t.attempts AS attempts, r.id AS run
```

### `outputs` (read-only)

Outputs of a run’s done tasks (what a task reads from the ones before it).

```cypher
MATCH (:Run {id: $run})-[:HAS_TASK]->(t:Task {status: 'done'})
RETURN t.id AS id, t.kind AS kind, t.scope AS scope, t.output AS output
```

### `board` (read-only)

The run’s task board: every task, its state, timing and dependencies.

```cypher
MATCH (:Run {id: $run})-[:HAS_TASK]->(t:Task)
OPTIONAL MATCH (t)-[:DEPENDS_ON]->(d:Task)
RETURN t.id AS id, t.kind AS kind, t.agent AS agent, t.scope AS scope, t.title AS title, t.status AS status,
       t.attempts AS attempts, t.started_at AS started, t.ended_at AS ended, t.ms AS ms, t.note AS note, t.error AS error,
       collect(d.id) AS deps
ORDER BY t.at, t.id
```

### `reopen` (write)

Send-back: these tasks and everything downstream of them go back to waiting (attempt budgets reset).

```cypher
MATCH (:Run {id: $run})-[:HAS_TASK]->(t:Task)
WHERE t.id IN $ids
OPTIONAL MATCH (down:Task)-[:DEPENDS_ON*1..12]->(t)
WITH collect(DISTINCT t) + collect(DISTINCT down) AS all
UNWIND all AS x
WITH DISTINCT x WHERE x IS NOT NULL
SET x.status = 'waiting', x.attempts = 0, x.output = null, x.error = null, x.reopened = coalesce(x.reopened, 0) + 1
RETURN x.id AS id
```

### `addTasks` (write)

New tasks join a running run (fan-out: research questions, assets, scenes, render chunks).

```cypher
MATCH (r:Run {id: $run})
UNWIND $tasks AS t
CREATE (k:Task {id: t.id, kind: t.kind, agent: t.agent, resource: t.resource, scope: t.scope, title: t.title,
                status: 'waiting', attempts: 0, max: t.max, input: t.input, waits: t.waits, optional: t.optional, at: $at})
CREATE (r)-[:HAS_TASK]->(k)
```

### `cancelRun` (write)

Stop a run: everything not done is cancelled.

```cypher
MATCH (r:Run {id: $run})-[:HAS_TASK]->(t:Task)
WHERE t.status IN ['waiting', 'ready', 'running']
SET t.status = 'cancelled'
WITH r
SET r.status = 'cancelled'
```

### `writeSources` (write)

Where facts come from: a page, an upload, the user’s own words.

```cypher
UNWIND $rows AS r
MERGE (s:Source {id: r.id})
SET s.kind = r.kind, s.ref = r.ref, s.title = r.title, s.at = $at
```

### `writeFacts` (write)

Facts the video may say, each FROM a source.

```cypher
UNWIND $rows AS r
MATCH (s:Source {id: r.source})
MERGE (f:Fact {id: r.id})
SET f.text = r.text, f.status = r.status, f.run = $run, f.at = $at
MERGE (f)-[:FROM]->(s)
```

### `facts` (read-only)

Every fact with its source.

```cypher
MATCH (f:Fact)-[:FROM]->(s:Source)
WHERE f.status IN ['verified', 'user_stated']
RETURN f.id AS id, f.text AS text, f.status AS status, s.kind AS kind, s.ref AS source
ORDER BY f.at
```

### `factSearch` (read-only)

Full text: facts that mention a line’s words.

```cypher
CALL db.idx.fulltext.queryNodes('Fact', $q) YIELD node, score
MATCH (node)-[:FROM]->(s:Source)
WHERE node.status IN ['verified', 'user_stated']
RETURN node.id AS id, node.text AS text, s.ref AS source, score
ORDER BY score DESC LIMIT 5
```

### `writeClaim` (write)

A line the video says, linked to the facts it rests on.

```cypher
MATCH (r:Run {id: $run}), (a:Agent {id: $agent})
CREATE (c:Claim {id: $id, beat: $beat, field: $field, text: $text, status: 'pending', at: $at})
CREATE (a)-[:WROTE]->(c)
CREATE (r)-[:HAS_CLAIM]->(c)
WITH c
UNWIND $facts AS fid
MATCH (f:Fact {id: fid})
CREATE (c)-[:SUPPORTED_BY]->(f)
```

### `truthGuard` (read-only)

Truth guard: a claim ships only with a path to a fact the project stands behind. No path, no claim.

```cypher
MATCH (c:Claim {id: $id})-[:SUPPORTED_BY]->(f:Fact)-[:FROM]->(s:Source)
WHERE f.status IN ['verified', 'user_stated']
RETURN f.id AS fact, f.text AS text, s.ref AS source
```

### `judgeClaim` (write)

The verdict on a claim.

```cypher
MATCH (c:Claim {id: $id})
SET c.status = $status, c.reason = $reason
```

### `supersedeClaims` (write)

A new draft of the script is judged: the claims of earlier drafts are superseded (kept, not counted).

```cypher
MATCH (:Run {id: $run})-[:HAS_CLAIM]->(c:Claim {field: $field})
WHERE c.status <> 'superseded'
SET c.status = 'superseded', c.supersededAt = $at
RETURN count(c) AS n
```

### `claims` (read-only)

A run’s claims and their verdicts (the shipped script’s, not superseded drafts’).

```cypher
MATCH (:Run {id: $run})-[:HAS_CLAIM]->(c:Claim)
WHERE coalesce(c.status, '') <> 'superseded'
OPTIONAL MATCH (c)-[:SUPPORTED_BY]->(f:Fact)
RETURN c.id AS id, c.beat AS beat, c.field AS field, c.text AS text, c.status AS status, c.reason AS reason, collect(f.id) AS facts
ORDER BY c.beat, c.at
```

### `saveScene` (write)

A Shot Builder’s scene program (a new version each write; the latest one counts).

```cypher
MATCH (r:Run {id: $run})
MERGE (s:Scene {id: $id})
SET s.i = $i, s.program = $program, s.version = coalesce(s.version, 0) + 1, s.by = $agent, s.at = $at, s.qa = $qa
MERGE (r)-[:HAS_SCENE]->(s)
RETURN s.version AS version
```

### `scenes` (read-only)

A run’s scene programs in order.

```cypher
MATCH (:Run {id: $run})-[:HAS_SCENE]->(s:Scene)
RETURN s.id AS id, s.i AS i, s.program AS program, s.version AS version, s.qa AS qa
ORDER BY s.i
```

### `writeAsset` (write)

An asset for the video: where it came from, its file, its hash and the judge’s score.

```cypher
MATCH (r:Run {id: $run})
MERGE (a:Asset {id: $id})
SET a.kind = $kind, a.path = $path, a.sha = $sha, a.source = $source, a.about = $about, a.score = $score,
    a.w = $w, a.h = $h, a.request = $request, a.at = $at
MERGE (r)-[:HAS_ASSET]->(a)
```

### `assets` (read-only)

A run’s assets.

```cypher
MATCH (:Run {id: $run})-[:HAS_ASSET]->(a:Asset)
RETURN a.id AS id, a.kind AS kind, a.path AS path, a.sha AS sha, a.source AS source, a.about AS about, a.score AS score,
       a.w AS w, a.h AS h, a.request AS request
```

### `latticeNodes` (write)

The preset lattice for one board: one node per (beat, preset).

```cypher
UNWIND $nodes AS n
CREATE (:Lattice {id: n.id, run: $run, slot: n.slot, preset: n.preset, penalty: n.penalty})
```

### `latticeEdges` (write)

Lattice edges: w = how well a flows into b + b’s over-use penalty.

```cypher
UNWIND $edges AS e
MATCH (a:Lattice {id: e.from}), (b:Lattice {id: e.to})
CREATE (a)-[:NEXT {w: e.w}]->(b)
```

### `boardPaths` (read-only)

The k cheapest preset sequences through the lattice (algo.SPpaths).

```cypher
MATCH (s:Lattice {id: $start}), (t:Lattice {id: $end})
CALL algo.SPpaths({sourceNode: s, targetNode: t, relTypes: ['NEXT'], weightProp: 'w', pathCount: $k, maxLen: $maxLen})
YIELD path, pathWeight
RETURN [n IN nodes(path) | n.preset] AS presets, pathWeight AS cost
ORDER BY cost ASC
```

### `clearLattice` (write)

The lattice is scratch space: gone once the board is chosen.

```cypher
MATCH (n:Lattice {run: $run})
DETACH DELETE n
```

### `decide` (write)

Provenance: an agent decided something about a target (a run, a scene, a claim, an asset).

```cypher
MATCH (a:Agent {id: $agent})
OPTIONAL MATCH (x) WHERE x.id = $target AND (x:Run OR x:Scene OR x:Claim OR x:Asset OR x:Video)
WITH a, x
CREATE (a)-[:MADE]->(d:Decision {id: $id, kind: $kind, why: $why, at: $at, lessons: $lessons, laws: $laws, target: $target})
FOREACH (_ IN CASE WHEN x IS NULL THEN [] ELSE [1] END | CREATE (d)-[:CHOSE]->(x))
WITH d
UNWIND $because AS b
MATCH (n) WHERE n.id = b AND (n:Fact OR n:Source OR n:Claim OR n:Asset OR n:Issue OR n:Upload OR n:Message)
MERGE (d)-[:BECAUSE]->(n)
RETURN DISTINCT d.id AS id
```

### `raiseIssue` (write)

Lens raises an issue on part of the run and returns it to the agent who owns that part.

```cypher
MATCH (r:Run {id: $run}), (lens:Agent {id: 'lens'}), (owner:Agent {id: $owner})
CREATE (lens)-[:RAISED]->(i:Issue {id: $id, kind: $kind, law: $law, scope: $scope, text: $text, at: $at, status: 'open', blocking: $blocking})
CREATE (i)-[:ON]->(r)
CREATE (i)-[:RETURNED_TO]->(owner)
```

### `openIssues` (read-only)

Open issues on a run.

```cypher
MATCH (i:Issue {status: 'open'})-[:ON]->(:Run {id: $run})
MATCH (i)-[:RETURNED_TO]->(o:Agent)
RETURN i.id AS id, i.kind AS kind, i.law AS law, i.scope AS scope, i.text AS text, i.blocking AS blocking, o.id AS owner
ORDER BY i.at
```

### `resolveIssue` (write)

The owner fixed it.

```cypher
MATCH (i:Issue {id: $id})
SET i.status = 'resolved', i.resolved_at = $at, i.how = $how
```

### `why` (read-only)

Why this: the decisions about a target, who made them, and what they rest on, down to sources.

```cypher
MATCH (a:Agent)-[:MADE]->(d:Decision)
WHERE d.target = $target
OPTIONAL MATCH p = (d)-[:BECAUSE|FROM|SUPPORTED_BY*1..3]->(n)
RETURN a.id AS agent, d.id AS decision, d.kind AS kind, d.why AS why, d.at AS at, d.lessons AS lessons, d.laws AS laws,
       [m IN nodes(p) | {id: m.id, label: labels(m)[0], text: coalesce(m.text, m.ref, m.name, m.title, m.id)}] AS path
ORDER BY at DESC
LIMIT 20
```

### `agentWork` (read-only)

What one agent did in a run: its tasks and decisions (for @mention questions).

```cypher
MATCH (:Run {id: $run})-[:HAS_TASK]->(t:Task {agent: $agent})
RETURN t.id AS id, t.kind AS kind, t.scope AS scope, t.status AS status, t.note AS note, t.output AS output, t.ms AS ms
ORDER BY t.started_at
```

### `agentDecisions` (read-only)

One agent’s decisions in this project, newest first.

```cypher
MATCH (:Agent {id: $agent})-[:MADE]->(d:Decision)
RETURN d.id AS id, d.kind AS kind, d.why AS why, d.target AS target, d.at AS at
ORDER BY d.at DESC
LIMIT $n
```

### `noteFeedback` (write)

A user edit or rejection is kept on the real Run and Video (the film) it was about, so “why” can show it.

```cypher
MATCH (r:Run {id: $run})<-[:BUILT_BY]-(v:Video)
MERGE (fb:Feedback {id: $id})
  ON CREATE SET fb.kind = $kind, fb.rejected = $rejected, fb.before = $before, fb.after = $after, fb.value = $value,
                fb.why = $why, fb.source = $source, fb.scene = $scene, fb.at = $at
MERGE (fb)-[:IN_RUN]->(r)
MERGE (fb)-[:ON_FILM]->(v)
RETURN fb.id AS id
```

### `noteFeedbackScene` (write)

The note also points at the real Scene it was about.

```cypher
MATCH (fb:Feedback {id: $id}), (s:Scene {id: $scene})
MERGE (fb)-[:ON_SCENE]->(s)
```

### `feedbackOnRun` (read-only)

The notes the user gave on a run, with the scene each was about.

```cypher
MATCH (fb:Feedback)-[:IN_RUN]->(:Run {id: $run})
OPTIONAL MATCH (fb)-[:ON_SCENE]->(s:Scene)
RETURN fb.id AS id, fb.kind AS kind, fb.rejected AS rejected, fb.before AS before, fb.after AS after, fb.value AS value,
       fb.why AS why, s.i AS scene
ORDER BY fb.at
```

## styles (what every reel style remembers)

### `rememberFilm` (write)

Store a finished film and the set-up that played each beat (CAST {i}).

```cypher
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
RETURN count(s) AS cast
```

### `filmArc` (write)

The script shape (arc) a film told.

```cypher
MATCH (f:Film {id: $id})
MERGE (a:Arc {id: $arc})
MERGE (f)-[:TOLD]->(a)
RETURN a.id AS arc
```

### `filmSite` (write)

The site a film was about (a site seen again gets a different film).

```cypher
MATCH (f:Film {id: $id})
MERGE (s:Site {host: $host})
MERGE (f)-[:ABOUT]->(s)
RETURN s.host AS host
```

### `coCast` (write)

Link set-ups a film cast back to back (one NEXT_TO per film and beat, so re-runs never double count): the graph PageRank reads.

```cypher
UNWIND range(0, size($setups) - 2) AS i
MATCH (a:Setup {key: $style + ':' + $setups[i]}), (b:Setup {key: $style + ':' + $setups[i + 1]})
MERGE (a)-[r:NEXT_TO {film: $id, i: i}]->(b)
RETURN count(r) AS links
```

### `recentFilms` (read-only)

A style’s latest films: their set-ups in beat order, arc and site.

```cypher
MATCH (f:Film {style: $style})
WITH f ORDER BY f.at DESC LIMIT $n
OPTIONAL MATCH (f)-[:TOLD]->(a:Arc)
OPTIONAL MATCH (f)-[:ABOUT]->(site:Site)
OPTIONAL MATCH (f)-[c:CAST]->(s:Setup)
WITH f, a, site, c, s ORDER BY c.i
RETURN f.id AS id, f.at AS at, a.id AS arc, site.host AS site, collect(s.id) AS setups
ORDER BY at DESC
```

### `grownSetups` (read-only)

The improvised set-ups a style kept: they join its library for every later film.

```cypher
MATCH (s:Setup {style: $style})
WHERE s.generated = true
RETURN s.id AS id, s.data AS data, s.uses AS uses
ORDER BY s.created
```

### `growSetup` (write)

Keep an improvised set-up in the style’s library (deduped by its spec).

```cypher
MERGE (st:Style {id: $style})
MERGE (s:Setup {key: $style + ':' + $id})
  ON CREATE SET s.style = $style, s.id = $id, s.uses = 0
SET s.generated = true, s.data = coalesce(s.data, $data), s.about = coalesce(s.about, $about), s.family = coalesce(s.family, $family), s.created = coalesce(s.created, $at)
MERGE (s)-[:IN]->(st)
RETURN s.id AS id
```

### `overUsed` (read-only)

Over-use: PageRank over NEXT_TO, the set-ups this style leans on most.

```cypher
CALL algo.pageRank('Setup', 'NEXT_TO')
YIELD node, score
WITH node, score
WHERE node.style = $style
RETURN node.id AS id, score
ORDER BY score DESC
LIMIT $n
```

### `filmStory` (read-only)

Why a film looks the way it does: its arc, its site and each beat’s set-up (with how often the style used it).

```cypher
MATCH (f:Film {id: $id})-[c:CAST]->(s:Setup)
OPTIONAL MATCH (f)-[:TOLD]->(a:Arc)
OPTIONAL MATCH (f)-[:ABOUT]->(site:Site)
RETURN f.style AS style, a.id AS arc, site.host AS site, c.i AS beat, s.id AS setup, s.generated AS improvised, s.uses AS uses
ORDER BY beat
```

### `styleStats` (read-only)

Per style: films made, distinct set-ups cast, how many were improvised and kept.

```cypher
MATCH (st:Style)
OPTIONAL MATCH (f:Film)-[:OF]->(st)
WITH st, count(f) AS films
OPTIONAL MATCH (s:Setup {style: st.id})
RETURN st.id AS style, films, count(s) AS setups, sum(CASE WHEN s.generated = true THEN 1 ELSE 0 END) AS kept
ORDER BY style
```
