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
| Never the same clip twice, credits for every clip | `clipSeen`, `useClip`, `clipCredits` | `(:Clip)-[:FROM]->(:Source)-[:UNDER]->(:Licence)`, `(:Clip)-[:USED_IN]->(:Scene)` |
| Every fact has a page and a proof shot | `factProof`, `claimEvidence` | path Claim → Fact → Page / Screenshot |
| One library, cast by need | `seedAssets`, `assetsServing`, `assetsForEvent`, `libraryCounts` | `(:Asset)-[:SERVES]->(:Need)`, `-[:FITS]->(:Event)`, `-[:SUITS]->(:EditStyle)`, `-[:IS_A]->(:Transition)` |
| A look as one re-skinnable unit | `seedKit`, `kitParts`, `kitsServing` | `(:Kit {palette, type, motion})-[:HAS]->(:Asset)`, `(:Reference)-[:TAUGHT]->(:Kit)` |
| A reference becomes parts | `addReference`, `addReferenceParts`, `referenceParts` | `(:Reference)-[:HAS_PART {role, at}]->(:Asset)` |
| A film's type, its looks and its library slice in one read | `typesAll`, `typeKit` | `(:Type)-[:LOOK]->(:Style or :EditStyle)`, `(:Type)-[:REFERENCE]->(:Reference)`, `(:Asset)-[:IN_TYPE {w, when}]->(:Type)` |
| Why this edit? (decision 13) | `recordDecision`, `whyThis`, `assetOrigins` | `(:Decision)-[:BECAUSE]->(:Feedback or :Rule or :Reference or :Asset)`, `(:Rule)-[:LEARNED_FROM]->(:Feedback)`, `(:Asset)-[:FROM]->(:Reference)`, `shortestPath` back to the cause |
| The Launch library, traceable to its films | `launchParts`, `launchPartStory`, `launchReferences`, `launchFilmParts` | `(:Reference {id: 'ref:lNN'})-[:HAS_PART]->(:Asset)` with runtime launch, `(:Film)-[:USED {role, i}]->(:Asset)` |

## craft (style knowledge, shared)

### `seedArtifacts` (write)

Idempotent seed of the artifact library: each artifact and the needs it SERVES (the art director picks by need).

```cypher
UNWIND $rows AS r
MERGE (a:Artifact {id: r.id})
SET a.kind = r.kind, a.name = r.name, a.roles = r.roles, a.wants = r.wants, a.cost = r.cost, a.glyph = r.glyph
WITH a, r
UNWIND r.needs AS nid
MERGE (n:Need {id: nid})
MERGE (a)-[:SERVES]->(n)
RETURN count(DISTINCT a) AS artifacts
```

### `artifactCount` (read-only)

How many artifacts the library holds (the seed runs when it is short).

```cypher
MATCH (a:Artifact) RETURN count(a) AS n
```

### `artifactsServing` (read-only)

Artifacts that serve a scene’s needs, best first: more shared needs wins, cheaper to render breaks ties (kind filter optional).

```cypher
UNWIND $needs AS nid
MATCH (a:Artifact)-[:SERVES]->(:Need {id: nid})
WHERE $kinds IS NULL OR a.kind IN $kinds
WITH a, count(*) AS hits
RETURN a.id AS id, a.kind AS kind, a.wants AS wants, a.cost AS cost, hits
ORDER BY hits DESC, a.cost ASC, a.id
LIMIT $n
```

### `rateArtifacts` (write)

The frame critic scored scenes: each artifact gets its scenes’ scores (summed per artifact: sum, n) folded into its running mean (rating, films).

```cypher
UNWIND $rows AS r
MATCH (a:Artifact {id: r.id})
WITH a, r, coalesce(a.films, 0) AS f, coalesce(a.ratingSum, 0.0) AS sm
SET a.films = f + r.n, a.ratingSum = sm + r.sum, a.rating = (sm + r.sum) / (f + r.n)
RETURN count(a) AS rated
```

### `rateLayouts` (write)

The same for the layouts: a (Layout) node per layout id with its running mean score.

```cypher
UNWIND $rows AS r
MERGE (l:Layout {id: r.id})
WITH l, r, coalesce(l.films, 0) AS f, coalesce(l.ratingSum, 0.0) AS sm
SET l.films = f + r.n, l.ratingSum = sm + r.sum, l.rating = (sm + r.sum) / (f + r.n)
RETURN count(l) AS rated
```

### `artifactRatings` (read-only)

What the critic has scored so far, per artifact: mean 0-10 and how many scenes (the art director prefers the high ones).

```cypher
MATCH (a:Artifact) WHERE a.films > 0
RETURN a.id AS id, a.rating AS mean, a.films AS n
ORDER BY mean DESC
```

### `layoutRatings` (read-only)

The same per layout.

```cypher
MATCH (l:Layout) WHERE l.films > 0
RETURN l.id AS id, l.rating AS mean, l.films AS n
ORDER BY mean DESC
```

### `artifactNeeds` (read-only)

The needs one artifact serves (why the art director may pick it).

```cypher
MATCH (:Artifact {id: $id})-[:SERVES]->(n:Need)
RETURN n.id AS need ORDER BY need
```

### `needsCoverage` (read-only)

Needs no artifact serves yet (gaps in the library), and needs served by only one.

```cypher
MATCH (n:Need)
OPTIONAL MATCH (a:Artifact)-[:SERVES]->(n)
WITH n, count(a) AS served
WHERE served < 2
RETURN n.id AS need, served ORDER BY served, need
```

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

### `cachedPlace` (read-only)

A place name already geocoded: its coordinates and country (so Nominatim is not asked twice).

```cypher
MATCH (p:Place {key: $key})
RETURN p.key AS key, p.name AS name, p.lat AS lat, p.lon AS lon, p.cc AS cc, p.country AS country, p.kind AS kind, p.bbox AS bbox
```

### `cachePlace` (write)

Remember a geocoded place by its normalised name: (:Place {name, lat, lon}).

```cypher
MERGE (p:Place {key: $key})
SET p.name = $name, p.lat = $lat, p.lon = $lon, p.cc = $cc, p.country = $country, p.kind = $kind, p.bbox = $bbox, p.at = $at
RETURN p.key AS key
```

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

### `closeProject` (write)

The owner deletes a project from the dashboard: it is closed (hidden from userProjects); its graph stays, so it can be restored.

```cypher
MATCH (:User {id: $user})-[:OWNS]->(p:Project {id: $id})
SET p.closed = true, p.closed_at = $at
RETURN p.id AS id
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

### `recentPresets` (read-only)

The preset (device) sequences of this user’s recent videos in one style, newest first (the next one never repeats the last).

```cypher
MATCH (v:VideoRef)
WHERE v.style = $style
WITH v ORDER BY v.at DESC LIMIT $n
OPTIONAL MATCH (v)-[:USED]->(p:PresetRef)
RETURN v.id AS video, v.at AS at, v.card AS card, collect(p.id) AS presets
ORDER BY at DESC
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
       t.at AS at, collect(d.id) AS deps
ORDER BY at, id
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
RETURN c.id AS id, c.beat AS beat, c.field AS field, c.text AS text, c.status AS status, c.reason AS reason, c.at AS at, collect(f.id) AS facts
ORDER BY beat, at
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

### `useLook3d` (write)

The art director gives a scene a 3D look: (Scene)-[:USES_3D]->(Look3D), with his reason on the edge.

```cypher
MATCH (r:Run {id: $run})
MERGE (s:Scene {id: $scene})
  ON CREATE SET s.i = $i
MERGE (r)-[:HAS_SCENE]->(s)
MERGE (l:Look3D {id: $look})
  ON CREATE SET l.name = $name
MERGE (s)-[u:USES_3D]->(l)
SET u.why = $why, u.at = $at
RETURN l.id AS look
```

### `looksInRun` (read-only)

Which 3D look each scene of a run uses, in order.

```cypher
MATCH (:Run {id: $run})-[:HAS_SCENE]->(s:Scene)-[u:USES_3D]->(l:Look3D)
RETURN s.i AS i, l.id AS look, u.why AS why
ORDER BY s.i
```

### `look3dUsage` (read-only)

How often each 3D look has been used in this project’s films (the art director varies them).

```cypher
MATCH (s:Scene)-[:USES_3D]->(l:Look3D)
RETURN l.id AS look, count(DISTINCT s) AS scenes
ORDER BY scenes DESC
```

### `showPlace` (write)

A scene shows a real place: (Scene)-[:SHOWS {n}]->(Place), the Place copied from the geocoding cache.

```cypher
MATCH (r:Run {id: $run})
MERGE (s:Scene {id: $scene})
  ON CREATE SET s.i = $i
MERGE (r)-[:HAS_SCENE]->(s)
MERGE (p:Place {key: $key})
  ON CREATE SET p.name = $name, p.lat = $lat, p.lon = $lon, p.cc = $cc, p.country = $country
MERGE (s)-[w:SHOWS]->(p)
SET w.n = $n
RETURN p.key AS key
```

### `placesInRun` (read-only)

The places each scene of a run shows, in scene and visit order (the map camera flies through them).

```cypher
MATCH (:Run {id: $run})-[:HAS_SCENE]->(s:Scene)-[w:SHOWS]->(p:Place)
RETURN s.i AS i, w.n AS n, p.key AS key, p.name AS name, p.lat AS lat, p.lon AS lon, p.cc AS cc, p.country AS country
ORDER BY s.i, w.n
```

### `placeUsage` (read-only)

Places this project has already shown (the art director picks a different map shot than the last film).

```cypher
MATCH (s:Scene)-[:SHOWS]->(p:Place)
RETURN p.name AS name, p.cc AS cc, count(DISTINCT s) AS scenes
ORDER BY scenes DESC
LIMIT $n
```

### `useArtifact` (write)

The art director puts an artifact in a scene’s slot: (Scene)-[:USES_ARTIFACT {slot}]->(Artifact), with the layout it sits in. A live style’s insert borrowed from the library graph is slot `library`, layout = the style.

```cypher
MATCH (r:Run {id: $run})
MERGE (s:Scene {id: $scene})
  ON CREATE SET s.i = $i
MERGE (r)-[:HAS_SCENE]->(s)
MERGE (a:Artifact {id: $art})
  ON CREATE SET a.kind = $kind, a.name = $name
MERGE (s)-[u:USES_ARTIFACT {slot: $slot}]->(a)
SET u.layout = $layout, u.at = $at
RETURN a.id AS id
```

### `clearArtifacts` (write)

A scene is cast again: its old USES_ARTIFACT edges go before the new picks are stored.

```cypher
MATCH (:Scene {id: $scene})-[u:USES_ARTIFACT]->(:Artifact)
DELETE u
```

### `scoreScene` (write)

The frame critic’s verdict on a scene: its score and the parts it is made of (footage, motion, depth, layers, richness, clean).

```cypher
MATCH (s:Scene {id: $scene})
SET s.score = $score, s.footage = $footage, s.motion = $motion, s.depth = $depth, s.layers = $layers, s.richness = $richness, s.clean = $clean, s.scoredAt = $at
RETURN s.id AS id
```

### `weakScenes` (read-only)

The scenes of a run the critic scored below the bar, worst first (they are cast and rendered again, the rest are left alone).

```cypher
MATCH (:Run {id: $run})-[:HAS_SCENE]->(s:Scene)
WHERE s.score IS NOT NULL AND s.score < $below
RETURN s.i AS i, s.score AS score ORDER BY score
```

### `artifactUsage` (read-only)

How often this project’s films used each artifact (the art director varies; a worn-out one is penalised).

```cypher
MATCH (:Scene)-[u:USES_ARTIFACT]->(a:Artifact)
RETURN a.id AS id, a.kind AS kind, count(u) AS n
ORDER BY n DESC
LIMIT $limit
```

### `artifactsInRun` (read-only)

The artifacts of each scene of a run, by scene and slot (what the renderer is told to draw).

```cypher
MATCH (:Run {id: $run})-[:HAS_SCENE]->(s:Scene)-[u:USES_ARTIFACT]->(a:Artifact)
RETURN s.i AS i, u.slot AS slot, u.layout AS layout, a.id AS id, a.kind AS kind
ORDER BY s.i, u.slot
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

## proj_<pid>: footage and research captures

### `writeClips` (write)

Every clip a footage search looked at: the clip, its source page and its licence, kept or rejected with the reason (a clip a scene already uses stays used).

```cypher
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
MERGE (r)-[:SEARCHED]->(k)
```

### `useClip` (write)

A scene uses a clip: the clip is linked to the scene and to the asset it became.

```cypher
MATCH (r:Run {id: $run}), (k:Clip {id: $clip}), (a:Asset {id: $asset})
MERGE (sc:Scene {id: $scene})
ON CREATE SET sc.i = $i
MERGE (r)-[:HAS_SCENE]->(sc)
MERGE (k)-[:USED_IN]->(sc)
MERGE (a)-[:IS_CLIP]->(k)
SET k.status = 'used'
```

### `clipSeen` (read-only)

Has this project already used this clip in a scene, or rejected it before (by the source’s id or the file’s hash)?

```cypher
MATCH (k:Clip)
WHERE k.id = $id OR ($sha IS NOT NULL AND k.sha = $sha)
OPTIONAL MATCH (k)-[:USED_IN]->(sc:Scene)
RETURN k.id AS id, k.status AS status, k.why AS why, collect(sc.id) AS scenes
LIMIT 1
```

### `clipCredits` (read-only)

The footage credits for a run: every clip its scenes use, where it came from, who made it and its licence.

```cypher
MATCH (:Run {id: $run})-[:HAS_SCENE]->(sc:Scene)<-[:USED_IN]-(k:Clip)-[:FROM]->(s:Source)-[:UNDER]->(l:Licence)
RETURN sc.i AS scene, k.title AS title, k.provider AS provider, s.ref AS page, s.author AS author, l.name AS licence, l.url AS licenceUrl
ORDER BY scene
```

### `clipRejects` (read-only)

Why clips were turned down in a run (the footage judge’s reasons, most common first).

```cypher
MATCH (:Run {id: $run})-[:SEARCHED]->(k:Clip {status: 'rejected'})
UNWIND k.why AS reason
RETURN reason, count(*) AS n, collect(k.provider + ': ' + k.title)[0..3] AS examples
ORDER BY n DESC
```

### `licenceMix` (read-only)

Which licences the project’s used footage is under, with how many clips each (what the credits must say).

```cypher
MATCH (k:Clip)-[:USED_IN]->(:Scene)
MATCH (k)-[:FROM]->(:Source)-[:UNDER]->(l:Licence)
RETURN l.name AS licence, l.url AS url, count(DISTINCT k) AS clips
ORDER BY clips DESC
```

### `writePage` (write)

The Researcher read a page in the browser: its address, title, how it answered and how much text it had.

```cypher
MATCH (r:Run {id: $run})
MERGE (p:Page {id: $id})
SET p.url = $url, p.final = $final, p.title = $title, p.description = $description, p.status = $status, p.words = $words,
    p.wall = $wall, p.via = $via, p.at = $at
MERGE (r)-[:READ]->(p)
```

### `writeShots` (write)

Screenshots and scroll captures of a page (hero, sections, a smooth scroll video, proof shots).

```cypher
MATCH (p:Page {id: $page})
UNWIND $rows AS s
MERGE (x:Screenshot {id: s.id})
SET x.kind = s.kind, x.path = s.path, x.y = s.y, x.w = s.w, x.h = s.h, x.seconds = s.seconds, x.sha = s.sha, x.video = s.video, x.at = $at
MERGE (p)-[:HAS_SHOT]->(x)
```

### `factOnPage` (write)

A kept fact is linked to the page it was quoted from and, when the quote was found on screen, to its proof shot.

```cypher
MATCH (f:Fact {id: $fact}), (p:Page {id: $page})
MERGE (f)-[:ON]->(p)
WITH f
OPTIONAL MATCH (x:Screenshot {id: $shot})
FOREACH (_ IN CASE WHEN x IS NULL THEN [] ELSE [1] END | MERGE (f)-[:SHOWN_IN]->(x))
```

### `runShots` (read-only)

Every screenshot and scroll capture the research took for a run (what the Asset Hunter and the Art Director can use), with the page and the facts each one proves.

```cypher
MATCH (:Run {id: $run})-[:READ]->(p:Page)-[:HAS_SHOT]->(x:Screenshot)
OPTIONAL MATCH (f:Fact)-[:SHOWN_IN]->(x)
RETURN x.id AS id, x.kind AS kind, x.path AS path, x.video AS video, x.seconds AS seconds, x.w AS w, x.h AS h, x.sha AS sha,
       p.url AS url, p.title AS title, collect(f.text) AS proves
ORDER BY CASE kind WHEN 'proof' THEN 0 WHEN 'scroll' THEN 1 WHEN 'hero' THEN 2 ELSE 3 END, id
```

### `factProof` (read-only)

Fact checking: each fact of a run with the page it came from and its proof shot (no shot = the quote was never seen on screen).

```cypher
MATCH (f:Fact {run: $run})-[:FROM]->(s:Source)
OPTIONAL MATCH (f)-[:ON]->(p:Page)
OPTIONAL MATCH (f)-[:SHOWN_IN]->(x:Screenshot)
RETURN f.id AS fact, f.text AS text, f.status AS status, s.ref AS source, p.title AS page, x.path AS proof
ORDER BY fact
```

### `claimEvidence` (read-only)

For one script line: the facts behind it, the pages they were read on and the screenshots that show them (what the director cuts to when a line states a fact).

```cypher
MATCH (c:Claim {id: $id})-[:SUPPORTED_BY]->(f:Fact)
OPTIONAL MATCH (f)-[:ON]->(p:Page)
OPTIONAL MATCH (f)-[:SHOWN_IN]->(x:Screenshot)
RETURN f.text AS fact, p.url AS url, p.title AS title, collect(DISTINCT x.path) AS shots
```

## craft: the library (every asset a film or an edit can cast)

### `seedAssets` (write)

Idempotent seed of library assets: one (:Asset) per row, every field replaced (the catalogue in code is the truth).

```cypher
UNWIND $rows AS r
MERGE (a:Asset {id: r.id})
SET a.category = r.category, a.name = r.name, a.about = r.about, a.runtime = r.runtime, a.licence = r.licence,
    a.credit = r.credit, a.ship = r.ship, a.attribution = r.attribution, a.file = r.file, a.vendored = r.vendored,
    a.energy = r.energy, a.tags = r.tags, a.params = r.params, a.impl = r.impl, a.seed = r.seed, a.src = r.src,
    a.licenceUrl = r.licenceUrl, a.sourceUrl = r.sourceUrl, a.author = r.author, a.title = r.title,
    a.redistributable = r.redistributable, a.sha256 = r.sha256, a.rev = r.rev, a.retired = false
RETURN count(a) AS assets
```

### `linkAssetNeeds` (write)

An asset SERVES a need: (Asset)-[:SERVES {w}]->(Need); w is its rank (1 = strongest).

```cypher
UNWIND $rows AS r
MATCH (a:Asset {id: r.id})
MERGE (n:Need {id: r.need})
MERGE (a)-[s:SERVES]->(n)
SET s.w = r.w
RETURN count(s) AS edges
```

### `linkAssetEvents` (write)

An asset FITS a timeline event (an sfx on card-in, a riser on build): (Asset)-[:FITS {gainDb, first, rank, then, align, slices, sliceLen}]->(Event); `rank` = its place in the event’s rotation, `then` = it only follows the event’s sound, never stands in for it; align / slices = how this event cuts the file.

```cypher
UNWIND $rows AS r
MATCH (a:Asset {id: r.id})
MERGE (e:Event {id: r.event})
MERGE (a)-[f:FITS]->(e)
SET f.gainDb = r.gainDb, f.first = r.first, f.rank = r.rank, f.then = r.then, f.align = r.align, f.slices = r.slices, f.sliceLen = r.sliceLen
RETURN count(f) AS edges
```

### `linkAssetStyles` (write)

An asset SUITS an edit style with a weight: (Asset)-[:SUITS {w, src}]->(EditStyle). src is "row" (the asset’s own) or "cast" (a style’s cast list); rows for assets not in the graph are skipped.

```cypher
UNWIND $rows AS r
MATCH (a:Asset {id: r.id})
MERGE (s:EditStyle {id: r.style})
MERGE (a)-[e:SUITS]->(s)
SET e.w = r.w, e.src = r.src
RETURN count(e) AS edges
```

### `clearStyleCast` (write)

Before re-casting the edit styles: drop every SUITS edge a cast list made.

```cypher
MATCH (:Asset)-[e:SUITS {src: 'cast'}]->(:EditStyle)
DELETE e
RETURN count(e) AS dropped
```

### `linkReplaced` (write)

A replaced asset points at its replacement: (old)-[:REPLACED_BY]->(new). The old node is kept (retired) so saved EDLs resolve.

```cypher
UNWIND $rows AS r
MATCH (n:Asset {id: r.id})
MERGE (o:Asset {id: r.old})
ON CREATE SET o.retired = true, o.category = n.category
MERGE (o)-[e:REPLACED_BY]->(n)
RETURN count(e) AS edges
```

### `linkFallbacks` (write)

What to play in a runtime an asset does not run in: (Asset)-[:FALLBACK {runtime}]->(Asset).

```cypher
UNWIND $rows AS r
MATCH (a:Asset {id: r.id}), (b:Asset {id: r.to})
MERGE (a)-[e:FALLBACK {runtime: r.runtime}]->(b)
RETURN count(e) AS edges
```

### `resolveAsset` (read-only)

An EDL asset_ref → the asset to play now: itself, or the end of its REPLACED_BY chain; then, for a runtime it lacks, its FALLBACK there.

```cypher
MATCH (a:Asset {id: $id})
OPTIONAL MATCH p = (a)-[:REPLACED_BY*1..5]->(n:Asset)
WITH a, n, p ORDER BY length(p) DESC
WITH a, collect(n)[0] AS newest
WITH a, coalesce(newest, a) AS cur
OPTIONAL MATCH (cur)-[f:FALLBACK {runtime: $runtime}]->(fb:Asset)
WITH a, cur, fb, ($runtime IS NULL OR $runtime IN cur.runtime) AS runs
RETURN a.id AS asked, cur.id AS id, CASE WHEN runs OR fb IS NULL THEN cur.id ELSE fb.id END AS play, runs, cur.sha256 AS sha256, cur.rev AS rev
```

### `linkEventAliases` (write)

The EDL’s sfx event names as aliases on the library’s (:Event) nodes (the names stay; the EDL’s resolve to them).

```cypher
UNWIND $rows AS r
MERGE (e:Event {id: r.event})
SET e.aliases = r.aliases
RETURN count(e) AS events
```

### `transitionForCut` (read-only)

An EDL cut type (Cut.type: hard, jump, punch, flash, …) → its transition asset, its family and every other implementation of that family.

```cypher
MATCH (a:Asset {category: 'transition'})-[:IS_A]->(t:Transition)
WHERE ('edl-cut:' + $type) IN a.tags AND NOT coalesce(a.retired, false)
OPTIONAL MATCH (o:Asset)-[:IS_A]->(t)
WHERE o.id <> a.id AND NOT coalesce(o.retired, false)
WITH a, t, o ORDER BY o.id
RETURN a.id AS id, t.id AS family, a.params AS params, collect(o.id) AS alternatives
```

### `addAssetTags` (write)

Add a tag to assets another seed owns (an X1 number on a camera-layer move); idempotent, missing ids skipped.

```cypher
UNWIND $rows AS r
MATCH (a:Asset {id: r.id})
SET a.tags = CASE WHEN r.tag IN a.tags THEN a.tags ELSE a.tags + r.tag END
RETURN count(a) AS tagged
```

### `assetsByX1` (read-only)

The assets that implement one of R4’s X1 moves (01 orbit … 17 glass type), by its two-digit number.

```cypher
MATCH (a:Asset)
WHERE ('x1:' + $n) IN a.tags AND NOT coalesce(a.retired, false)
RETURN a.id AS id, a.category AS category, a.runtime AS runtime, a.params AS params
ORDER BY a.category, a.id
```

### `upsertClipAssets` (write)

Stock clips fetched at run time as (:Asset {category: insert, vendored: false}) with source, author and licence, so an EDL insert and the film credits take one path. Never retired by a catalogue reseed.

```cypher
UNWIND $rows AS r
MERGE (a:Asset {id: r.id})
SET a.category = 'insert', a.name = r.name, a.about = r.about, a.runtime = ['browser', 'ffmpeg'], a.licence = r.licence,
    a.licenceUrl = r.licenceUrl, a.sourceUrl = r.sourceUrl, a.author = r.author, a.title = r.name, a.credit = r.credit,
    a.ship = r.ship, a.attribution = r.attribution, a.redistributable = r.redistributable, a.file = null, a.vendored = false,
    a.sha256 = r.sha256, a.rev = r.rev, a.retired = false, a.energy = null, a.tags = r.tags, a.params = r.params,
    a.impl = r.impl, a.seed = 'footage', a.src = 'packages/engine/src/footage'
RETURN count(a) AS clips
```

### `linkAssetFamilies` (write)

A transition implementation IS_A transition family (the craft graph’s Transition nodes).

```cypher
UNWIND $rows AS r
MATCH (a:Asset {id: r.id})
MERGE (t:Transition {id: r.family})
MERGE (a)-[e:IS_A]->(t)
RETURN count(e) AS edges
```

### `clearAssetEdges` (write)

Before a reseed: drop the SERVES / FITS / SUITS / IS_A edges of the seeded assets, so removed tags do not linger.

```cypher
MATCH (a:Asset)-[e:SERVES|FITS|SUITS|IS_A|FALLBACK]->()
WHERE a.seed IN $seeds
DELETE e
RETURN count(e) AS dropped
```

### `retireAssets` (write)

Assets a seed no longer lists are marked retired, never deleted: an EDL that names one still resolves (resolveAsset follows REPLACED_BY). Casting queries skip retired assets.

```cypher
MATCH (a:Asset)
WHERE a.seed = $seed AND NOT a.id IN $ids AND NOT coalesce(a.retired, false)
SET a.retired = true
RETURN count(a) AS retired
```

### `libraryCounts` (read-only)

The library per category: how many, how many safe to ship, how many have their file in the repo.

```cypher
MATCH (a:Asset) WHERE NOT coalesce(a.retired, false)
RETURN a.category AS category, count(a) AS n,
       sum(CASE WHEN a.ship THEN 1 ELSE 0 END) AS shippable,
       sum(CASE WHEN a.vendored THEN 1 ELSE 0 END) AS vendored
ORDER BY category
```

### `libraryGaps` (read-only)

Categories still under the target count (the plan’s 50+ of each).

```cypher
MATCH (a:Asset) WHERE NOT coalesce(a.retired, false)
WITH a.category AS category, count(a) AS n
WHERE n < $target
RETURN category, n, $target - n AS short
ORDER BY short DESC
```

### `assetsByCategory` (read-only)

Every asset of one category (optionally only one runtime, only shippable), for a picker or a model’s catalogue.

```cypher
MATCH (a:Asset {category: $category})
WHERE ($runtime IS NULL OR $runtime IN a.runtime) AND (NOT $shipOnly OR a.ship) AND NOT coalesce(a.retired, false)
RETURN a.id AS id, a.name AS name, a.about AS about, a.runtime AS runtime, a.energy AS energy, a.tags AS tags, a.params AS params, a.impl AS impl, a.file AS file
ORDER BY a.id
```

### `assetsServing` (read-only)

The deciding agent casts by need: assets of a category that serve the beat’s needs, most needs shared first, stronger rank breaks ties.

```cypher
UNWIND $needs AS nid
MATCH (a:Asset {category: $category})-[s:SERVES]->(:Need {id: nid})
WHERE ($runtime IS NULL OR $runtime IN a.runtime) AND (NOT $shipOnly OR a.ship) AND NOT coalesce(a.retired, false)
WITH a, count(*) AS hits, sum(s.w) AS rank
RETURN a.id AS id, a.name AS name, a.runtime AS runtime, a.energy AS energy, a.params AS params, a.impl AS impl, hits
ORDER BY hits DESC, rank ASC, a.id
LIMIT $n
```

### `assetsForEvent` (read-only)

What plays on a timeline event (an sfx for card-in, a riser for build), first choice first; `then` rows are the follow-up sound, not a choice. The mixer casts every film’s sfx with this. The event may be the library’s name or the EDL’s alias (cut → scene, insert_in → card-in, …).

```cypher
MATCH (a:Asset)-[f:FITS]->(e:Event)
WHERE (e.id = $event OR $event IN coalesce(e.aliases, [])) AND ($category IS NULL OR a.category = $category) AND (NOT $shipOnly OR a.ship) AND NOT coalesce(a.retired, false)
RETURN a.id AS id, a.category AS category, a.file AS file, f.gainDb AS gainDb, f.first AS first, coalesce(f.then, false) AS then, f.align AS align, f.slices AS slices, f.sliceLen AS sliceLen, a.impl AS impl, a.params AS params
ORDER BY f.first DESC, coalesce(f.rank, 99), a.id
```

### `assetsForStyle` (read-only)

Everything an edit style may use, per category (its allowed set), strongest weight first, then id.

```cypher
MATCH (a:Asset)-[s:SUITS]->(:EditStyle {id: $style})
WHERE NOT coalesce(a.retired, false)
WITH a, s ORDER BY s.w DESC, a.id
RETURN a.category AS category, collect(a.id) AS ids, collect(s.w) AS weights
ORDER BY category
```

### `styleCast` (read-only)

An edit style’s picks in one category, strongest first (weight, then id): what the EDL builder casts from.

```cypher
MATCH (a:Asset {category: $category})-[s:SUITS]->(:EditStyle {id: $style})
WHERE NOT coalesce(a.retired, false) AND ($runtime IS NULL OR $runtime IN a.runtime)
RETURN a.id AS id, a.name AS name, s.w AS w, a.runtime AS runtime, a.params AS params
ORDER BY s.w DESC, a.id
LIMIT $n
```

### `assetById` (read-only)

One asset with its needs, events, edit styles and families (why the deciding agent may pick it).

```cypher
MATCH (a:Asset {id: $id})
OPTIONAL MATCH (a)-[:SERVES]->(n:Need)
OPTIONAL MATCH (a)-[:FITS]->(e:Event)
OPTIONAL MATCH (a)-[:SUITS]->(s:EditStyle)
OPTIONAL MATCH (a)-[:IS_A]->(t:Transition)
RETURN a AS asset, collect(DISTINCT n.id) AS needs, collect(DISTINCT e.id) AS events, collect(DISTINCT s.id) AS styles, collect(DISTINCT t.id) AS families
```

### `transitionFamily` (read-only)

Every implementation of one transition family across runtimes (e.g. all the whips).

```cypher
MATCH (a:Asset)-[:IS_A]->(:Transition {id: $family})
RETURN a.id AS id, a.runtime AS runtime, a.impl AS impl, a.params AS params
ORDER BY a.id
```

### `assetCredits` (read-only)

The credit lines a film owes for the assets it used (CC BY music, credited footage), for its description.

```cypher
MATCH (a:Asset)
WHERE a.id IN $ids AND a.attribution
RETURN a.id AS id, a.credit AS credit, a.licence AS licence
ORDER BY a.id
```

### `unshippable` (read-only)

Assets not safe for a paid product, per licence (the "safe only" filter’s other side).

```cypher
MATCH (a:Asset) WHERE NOT a.ship
RETURN a.licence AS licence, a.category AS category, count(a) AS n
ORDER BY n DESC
```

### `clearEditRegistry` (write)

Before re-linking the edit registry: drop every (:Asset)-[:SERVES]->(:Fn|:Verb) edge and every asset’s edit entry.

```cypher
MATCH (a:Asset)-[e:SERVES]->(x)
WHERE x:Fn OR x:Verb
DELETE e
WITH count(e) AS dropped
MATCH (a:Asset) WHERE a.edit IS NOT NULL
SET a.edit = null, a.editBuilt = null, a.editAuto = null
RETURN dropped, count(a) AS cleared
```

### `linkEditRegistry` (write)

The edit registry on its assets: a.edit (JSON: device, layer, face rule, sfx, min, max, aka), a.editBuilt (the one player draws it), a.editAuto (cast unasked); missing ids skipped.

```cypher
UNWIND $rows AS r
MATCH (a:Asset {id: r.id})
SET a.edit = r.edit, a.editBuilt = r.built, a.editAuto = r.auto
RETURN count(a) AS entries
```

### `linkEditFns` (write)

An edit entry SERVES a sentence function: (Asset)-[:SERVES {w}]->(:Fn {id}); w is its rank (1 = strongest).

```cypher
UNWIND $rows AS r
MATCH (a:Asset {id: r.id})
MERGE (f:Fn {id: r.fn})
MERGE (a)-[s:SERVES]->(f)
SET s.w = r.w
RETURN count(s) AS edges
```

### `linkEditVerbs` (write)

An edit entry SERVES a spoken verb it acts out: (Asset)-[:SERVES {w}]->(:Verb {id}).

```cypher
UNWIND $rows AS r
MATCH (a:Asset {id: r.id})
MERGE (v:Verb {id: r.verb})
MERGE (a)-[s:SERVES]->(v)
SET s.w = r.w
RETURN count(s) AS edges
```

### `editCast` (read-only)

The director casts one sentence: registry entries serving its function and/or its verbs (a verb match outranks a function match, both = best), drawn by the player ($built), cast unasked ($auto), not in $recent (the last beats’ picks), only $layers when given; ranked, then id.

```cypher
MATCH (a:Asset)-[s:SERVES]->(x)
WHERE ((x:Fn AND x.id = $fn) OR (x:Verb AND x.id IN $verbs))
  AND a.edit IS NOT NULL AND NOT coalesce(a.retired, false) AND NOT a.id IN $recent
  AND (NOT $built OR a.editBuilt) AND (NOT $auto OR a.editAuto)
WITH a, sum(CASE WHEN x:Verb THEN 3 ELSE 2 END) AS score, min(s.w) AS w
RETURN a.id AS id, a.name AS name, a.category AS category, a.edit AS edit, score, w
ORDER BY score DESC, w ASC, a.id
LIMIT $n
```

### `addReference` (write)

A video reference the library learned from: (:Reference {id, url, title, kind, seconds, notes}).

```cypher
MERGE (r:Reference {id: $id})
SET r.url = $url, r.title = $title, r.kind = $kind, r.seconds = $seconds, r.notes = $notes, r.added = coalesce(r.added, timestamp())
RETURN r.id AS id
```

### `addReferenceParts` (write)

Each component a reference was broken into: (Reference)-[:HAS_PART {role, at, note}]->(Asset).

```cypher
UNWIND $rows AS p
MATCH (r:Reference {id: $ref}), (a:Asset {id: p.id})
MERGE (r)-[h:HAS_PART {role: p.role}]->(a)
SET h.at = p.at, h.note = p.note
RETURN count(h) AS parts
```

### `referenceParts` (read-only)

What one reference is made of, per category (to rebuild it, or to cast "like this one").

```cypher
MATCH (r:Reference {id: $ref})-[h:HAS_PART]->(a:Asset)
RETURN a.category AS category, a.id AS id, h.role AS role, h.at AS at, h.note AS note
ORDER BY category, h.at
```

### `references` (read-only)

Every reference in the library and how many parts each gave.

```cypher
MATCH (r:Reference)
OPTIONAL MATCH (r)-[:HAS_PART]->(a:Asset)
RETURN r.id AS id, r.title AS title, r.url AS url, count(a) AS parts
ORDER BY r.added
```

### `seedKit` (write)

A kit: one look as a unit. Palette, type and motion are JSON tokens; every part reads only these roles, so a brand palette re-skins the whole kit.

```cypher
MERGE (k:Kit {id: $id})
SET k.name = $name, k.about = $about, k.palette = $palette, k.type = $type, k.motion = $motion, k.frame = $frame, k.src = $src
RETURN k.id AS id
```

### `linkKitParts` (write)

The parts of a kit: (Kit)-[:HAS {role}]->(Asset). Re-linking replaces the role.

```cypher
UNWIND $rows AS r
MATCH (k:Kit {id: $kit}), (a:Asset {id: r.id})
MERGE (k)-[h:HAS]->(a)
SET h.role = r.role
RETURN count(h) AS parts
```

### `linkKitStyles` (write)

A kit SUITS an edit style.

```cypher
UNWIND $styles AS sid
MATCH (k:Kit {id: $kit})
MERGE (s:EditStyle {id: sid})
MERGE (k)-[e:SUITS]->(s)
RETURN count(e) AS edges
```

### `referenceTaught` (write)

A reference taught a kit: (Reference)-[:TAUGHT]->(Kit).

```cypher
MATCH (r:Reference {id: $ref}), (k:Kit {id: $kit})
MERGE (r)-[t:TAUGHT]->(k)
RETURN count(t) AS taught
```

### `kits` (read-only)

Every kit, how many parts it has and the edit styles it suits.

```cypher
MATCH (k:Kit)
OPTIONAL MATCH (k)-[:HAS]->(a:Asset)
OPTIONAL MATCH (k)-[:SUITS]->(s:EditStyle)
RETURN k.id AS id, k.name AS name, k.about AS about, count(DISTINCT a) AS parts, collect(DISTINCT s.id) AS styles
ORDER BY k.id
```

### `kitParts` (read-only)

A kit with its tokens and every part (to render with it, or re-skin it with a brand palette).

```cypher
MATCH (k:Kit {id: $kit})
OPTIONAL MATCH (k)-[h:HAS]->(a:Asset)
RETURN k.palette AS palette, k.type AS type, k.motion AS motion, k.frame AS frame, k.src AS src,
       collect({id: a.id, category: a.category, role: h.role, impl: a.impl, params: a.params}) AS parts
```

### `kitsServing` (read-only)

Kits ranked for a brief: how many of the beat needs their parts serve (distinct needs first, then part hits).

```cypher
UNWIND $needs AS nid
MATCH (k:Kit)-[:HAS]->(a:Asset)-[:SERVES]->(n:Need {id: nid})
WITH k, count(DISTINCT n) AS covered, count(*) AS hits
RETURN k.id AS id, k.name AS name, covered, hits
ORDER BY covered DESC, hits DESC, k.id
LIMIT $n
```

### `assetKits` (read-only)

The kits an asset belongs to (where its palette and type come from).

```cypher
MATCH (k:Kit)-[h:HAS]->(:Asset {id: $id})
RETURN k.id AS kit, h.role AS role
ORDER BY k.id
```

## craft: the Launch style (its library, where each part came from, what films used)

### `launchParts` (read-only)

The Launch library: every asset the Launch player draws (runtime launch, not retired), with the needs it serves (strongest first), its params and the references that taught it. The caster reads this once per film.

```cypher
MATCH (a:Asset)
WHERE 'launch' IN a.runtime AND coalesce(a.retired, false) = false
OPTIONAL MATCH (a)-[s:SERVES]->(n:Need)
WITH a, n, s ORDER BY s.w
WITH a, collect(n.id) AS needs
OPTIONAL MATCH (r:Reference)-[:HAS_PART]->(a)
WITH a, needs, collect(DISTINCT r.id) AS refs
RETURN a.id AS id, a.category AS category, a.name AS name, a.energy AS energy, a.params AS params, a.tags AS tags, needs, refs
ORDER BY a.category, a.id
```

### `launchPartStory` (read-only)

Where a Launch part came from: the references that taught it (with the role and the moment in each), the look kits it belongs to, and the edit styles it suits.

```cypher
MATCH (a:Asset {id: $id})
OPTIONAL MATCH (r:Reference)-[h:HAS_PART]->(a)
OPTIONAL MATCH (k:Kit)-[:HAS]->(a)
OPTIONAL MATCH (a)-[su:SUITS]->(e:EditStyle)
RETURN a.id AS id, a.name AS name, a.about AS about, collect(DISTINCT {ref: r.id, title: r.title, role: h.role, at: h.at}) AS taughtBy, collect(DISTINCT k.id) AS kits, collect(DISTINCT {style: e.id, w: su.w}) AS suits
```

### `launchReferences` (read-only)

The launch references and what each gave the library: parts per category, and the look it taught.

```cypher
MATCH (r:Reference) WHERE r.id STARTS WITH 'ref:l'
OPTIONAL MATCH (r)-[:HAS_PART]->(a:Asset)
WITH r, a.category AS category, count(a) AS n
WITH r, collect({category: category, n: n}) AS parts
OPTIONAL MATCH (r)-[:TAUGHT]->(k:Kit)
RETURN r.id AS id, r.title AS title, r.url AS url, parts, collect(k.id) AS kits
ORDER BY r.id
```

### `launchServing` (read-only)

Launch parts of one category ranked for a beat: how many of the beat needs each serves (rank-weighted), then its energy closeness, then id. The caster calls it when a beat needs a part the plan has no rule for.

```cypher
MATCH (a:Asset {category: $category})-[s:SERVES]->(n:Need)
WHERE 'launch' IN a.runtime AND coalesce(a.retired, false) = false AND n.id IN $needs
WITH a, count(n) AS hits, sum(1.0 / s.w) AS weight
RETURN a.id AS id, a.name AS name, hits, weight, a.energy AS energy
ORDER BY hits DESC, weight DESC, abs(coalesce(a.energy, 3) - $energy), a.id
LIMIT $n
```

### `launchFilmParts` (write)

A Launch film used these parts (set-ups, type treatments, transitions, camera moves, worlds): (:Film)-[:USED {role, i}]->(:Asset) in the craft graph, so the library knows which parts films actually lean on.

```cypher
MERGE (f:Film {id: $film})
SET f.style = 'launch', f.at = $at, f.look = $look, f.site = $site
WITH f
UNWIND $rows AS r
MATCH (a:Asset {id: r.id})
MERGE (f)-[u:USED {role: r.role, i: r.i}]->(a)
RETURN count(u) AS used
```

### `launchRecentLooks` (read-only)

The looks the Launch style wore lately (newest first) and the site each film was about: the next film wears another look, and a site seen again never gets its last look.

```cypher
MATCH (f:Film {style: 'launch'})
RETURN f.look AS look, f.site AS site, f.at AS at
ORDER BY f.at DESC
LIMIT $n
```

### `launchPartUse` (read-only)

How often each Launch part has been used across films (the caster rests the busiest ones).

```cypher
MATCH (f:Film {style: 'launch'})-[u:USED]->(a:Asset)
RETURN a.id AS id, count(u) AS uses, max(f.at) AS last
ORDER BY uses DESC, a.id
LIMIT $n
```

## craft: the type registry (the seven types, their looks and library slices)

### `seedTypes` (write)

Idempotent seed of the seven types: one (:Type) per spec, every field replaced (the specs in code are the truth).

```cypher
UNWIND $rows AS r
MERGE (t:Type {id: r.id})
SET t.name = r.name, t.i = r.i, t.status = r.status, t.spec = r.spec, t.src = r.src
RETURN count(t) AS types
```

### `clearTypeLinks` (write)

Before re-linking the types: drop every LOOK and REFERENCE edge a type has.

```cypher
MATCH (:Type)-[e:LOOK|REFERENCE]->()
DELETE e
RETURN count(e) AS dropped
```

### `linkTypeStyles` (write)

A type wears a generated style as a look: (Type)-[:LOOK {role, i, name, kind}]->(Style). A style node that does not exist yet is created with its name only (existing ones keep theirs).

```cypher
UNWIND $rows AS r
MATCH (t:Type {id: r.type})
MERGE (s:Style {id: r.look})
ON CREATE SET s.name = r.name
MERGE (t)-[l:LOOK]->(s)
SET l.role = r.role, l.i = r.i, l.name = r.name, l.kind = 'style'
RETURN count(l) AS looks
```

### `linkTypeEditLooks` (write)

A type wears an edit look: (Type)-[:LOOK {role, i, name, kind}]->(EditStyle).

```cypher
UNWIND $rows AS r
MATCH (t:Type {id: r.type})
MERGE (s:EditStyle {id: r.look})
MERGE (t)-[l:LOOK]->(s)
SET l.role = r.role, l.i = r.i, l.name = r.name, l.kind = 'edit-look'
RETURN count(l) AS looks
```

### `linkTypeReferences` (write)

A reference belongs to a type (decision 9): (Type)-[:REFERENCE {role}]->(Reference); references not in the graph are skipped.

```cypher
UNWIND $rows AS r
MATCH (t:Type {id: r.type}), (ref:Reference {id: r.ref})
MERGE (t)-[e:REFERENCE]->(ref)
SET e.role = r.role
RETURN count(e) AS refs
```

### `clearTypeAssets` (write)

Before re-marking the library: drop every IN_TYPE edge (the specs and the catalogue are the truth).

```cypher
MATCH (:Asset)-[e:IN_TYPE]->(:Type)
DELETE e
RETURN count(e) AS dropped
```

### `linkAssetTypes` (write)

An asset is in a type’s slice: (Asset)-[:IN_TYPE {w, when}]->(Type); rows for assets not in the graph are skipped.

```cypher
UNWIND $rows AS r
MATCH (a:Asset {id: r.id}), (t:Type {id: r.type})
MERGE (a)-[e:IN_TYPE]->(t)
SET e.w = r.w, e.`when` = r.`when`
RETURN count(e) AS edges
```

### `typesAll` (read-only)

Every type, in card order, with its status, its looks and how big its library slice is.

```cypher
MATCH (t:Type)
OPTIONAL MATCH (t)-[l:LOOK]->(s)
WITH t, l, s ORDER BY l.i
WITH t, collect(CASE WHEN s IS NULL THEN null ELSE {id: s.id, name: l.name, role: l.role, kind: l.kind} END) AS looks
OPTIONAL MATCH (a:Asset)-[:IN_TYPE]->(t)
WHERE NOT coalesce(a.retired, false)
RETURN t.id AS id, t.i AS i, t.name AS name, t.status AS status, looks, count(a) AS assets
ORDER BY i
```

### `typeKit` (read-only)

Everything a film of one type needs, in one read: the spec (arcs, beat map, presets, tool rules, floor overrides, motion branch), its looks in order, its references, and its library slice (strongest first, then id).

```cypher
MATCH (t:Type {id: $id})
OPTIONAL MATCH (t)-[l:LOOK]->(s)
WITH t, l, s ORDER BY l.i
WITH t, collect(CASE WHEN s IS NULL THEN null ELSE {id: s.id, name: l.name, role: l.role, kind: l.kind} END) AS looks
OPTIONAL MATCH (t)-[rl:REFERENCE]->(ref:Reference)
WITH t, looks, rl, ref ORDER BY ref.id
WITH t, looks, collect(CASE WHEN ref IS NULL THEN null ELSE {id: ref.id, role: rl.role, title: ref.title} END) AS refs
OPTIONAL MATCH (a:Asset)-[e:IN_TYPE]->(t)
WHERE NOT coalesce(a.retired, false)
WITH t, looks, refs, a, e ORDER BY e.w DESC, a.id
RETURN t.id AS id, t.name AS name, t.status AS status, t.spec AS spec, looks, refs,
       collect(CASE WHEN a IS NULL THEN null ELSE {id: a.id, category: a.category, w: e.w, `when`: e.`when`, ship: a.ship} END) AS assets
```

## proj_<pid>: why this edit? (each film decision and the shortest path back to its cause)

### `recordDecision` (write)

A film decision and the BECAUSE edges to what caused it (feedback, a rule, a reference, an asset), plus their own links back (LEARNED_FROM, FROM).

```cypher
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
RETURN DISTINCT d.id AS id
```

### `whyThis` (read-only)

"Why this caption / voice / cut?": the newest decision of that kind, and the shortest path from it back to each cause, the user's words first.

```cypher
MATCH (d:Decision)
WHERE d.kind IN $kinds AND ($run IS NULL OR d.run = $run)
WITH d ORDER BY d.at DESC LIMIT 1
MATCH (d)-[:BECAUSE]->(x)-[:LEARNED_FROM|FROM*0..3]->(c)
WHERE c:Feedback OR c:Rule OR c:Reference OR c:Asset
WITH DISTINCT d, c
WITH d, c, shortestPath((d)-[:BECAUSE|LEARNED_FROM|FROM*]->(c)) AS p
WITH d, c, p, CASE WHEN c:Feedback THEN 0 WHEN c:Reference THEN 1 WHEN c:Rule THEN 2 ELSE 3 END AS rank
RETURN d.id AS decision, d.kind AS kind, d.choice AS choice, d.why AS why, d.at AS at, length(p) AS hops,
       [m IN nodes(p) | {id: m.id, label: labels(m)[0], text: CASE WHEN m:Decision THEN m.choice ELSE coalesce(m.why, m.text, m.name, m.id) END}] AS path,
       [r IN relationships(p) | type(r)] AS rels
ORDER BY rank, hops DESC
LIMIT 6
```

### `decisionsOfRun` (read-only)

Every recorded film decision of a run with its direct causes (the demo and the studio's "why" list).

```cypher
MATCH (d:Decision {run: $run})
OPTIONAL MATCH (d)-[b:BECAUSE]->(c)
RETURN d.id AS id, d.kind AS kind, d.choice AS choice, d.why AS why, d.at AS at,
       collect({label: labels(c)[0], id: c.id, how: b.how}) AS causes
ORDER BY at
```

## craft: where a library asset came from (for the why path)

### `assetOrigins` (read-only)

The reference reel each library asset was broken out of (Reference HAS_PART Asset), for the "why" path.

```cypher
MATCH (r:Reference)-[:HAS_PART]->(a:Asset)
WHERE a.id IN $ids
RETURN a.id AS asset, a.name AS name, r.id AS ref, coalesce(r.title, r.id) AS title
```

### `kitOrigins` (read-only)

The reference reel that taught a kit (Reference TAUGHT Kit), for the "why" path of a kit pick.

```cypher
MATCH (r:Reference)-[:TAUGHT]->(k:Kit {id: $kit})
RETURN r.id AS ref, coalesce(r.title, r.id) AS title
```

## proj_<pid>: the synapse (how a run used the memory: agents, named queries, rows; never query text or values)

### `saveSynapse` (write)

A finished run keeps its synapse: the call events (names, counts, times only) and one CALLED edge per agent and named query.

```cypher
MATCH (r:Run {id: $run})
MERGE (s:Synapse {run: $run})
SET s.events = $events, s.calls = $n, s.at = $at
MERGE (r)-[:TRACED]->(s)
WITH r
UNWIND $calls AS c
MERGE (a:Agent {id: c.agent})
MERGE (k:Call {name: c.name, graph: c.graph})
MERGE (a)-[e:CALLED {run: $run}]->(k)
SET e.n = c.n, e.rows = c.rows, e.ms = c.ms
RETURN count(e) AS edges
```

### `synapseOf` (read-only)

A finished run’s kept synapse (its call events), for the replay.

```cypher
MATCH (:Run {id: $run})-[:TRACED]->(s:Synapse)
RETURN s.events AS events, s.calls AS calls, s.at AS at
LIMIT 1
```

### `synapseCalls` (read-only)

Which agent called which named query in a run, how often, how many rows: the synapse as a graph.

```cypher
MATCH (a:Agent)-[e:CALLED {run: $run}]->(k:Call)
RETURN a.id AS agent, k.name AS name, k.graph AS graph, e.n AS n, e.rows AS rows, e.ms AS ms
ORDER BY n DESC
```

### `runsOfChat` (read-only)

Every run of a chat’s video, newest first (the synapse view’s run picker).

```cypher
MATCH (:Chat {id: $chat})-[:MAKES]->(:Video)-[:BUILT_BY]->(r:Run)
RETURN r.id AS id, r.n AS n, r.status AS status, r.kind AS kind, r.at AS at, r.updated AS updated
ORDER BY r.n DESC
LIMIT 20
```


## proj_<pid>: who voices each film

| Job | Query | Graph feature |
|---|---|---|
| The Voice Director's pick, with its reason | `castVoice`, `whyVoice` | `(:Film)-[:VOICED_BY {reason, shortlist, picked, spokenBy}]->(:Voice)` |
| A brand keeps its voice; a turned-down voice is never recast | `voiceHistory`, `rejectVoice` | `VOICED_BY.rejected` per chat |
| Which engine really spoke (never ElevenLabs when Edge did) | `voiceSpoken` | `VOICED_BY.spokenBy` |

### `castVoice` (write)

The Voice Director casts a voice for a film: the Voice (with its tags), the Film, and the VOICED_BY edge with the reason.

```cypher
MERGE (v:Voice {id: $voice})
SET v.name = $name, v.locale = $locale, v.lang = $lang, v.accent = $accent, v.gender = $gender, v.age = $age, v.energy = $energy
MERGE (f:Film {id: $film})
SET f.chat = $chat, f.video = $video, f.at = coalesce(f.at, $at)
WITH f, v
OPTIONAL MATCH (f)-[old:VOICED_BY]->(:Voice)
DELETE old
WITH DISTINCT f, v
CREATE (f)-[e:VOICED_BY {reason: $reason, by: $by, score: $score, shortlist: $shortlist, rate: $rate, picked: $engine, at: $at}]->(v)
RETURN v.id AS voice
```

### `voiceSpoken` (write)

After the voice is recorded: which engine really spoke, how many lines came from the cache, and the time per line.

```cypher
MATCH (:Film {id: $film})-[e:VOICED_BY]->(:Voice {id: $voice})
SET e.spokenBy = $spokenBy, e.lines = $lines, e.cached = $cached, e.msPerLine = $msPerLine, e.seconds = $seconds, e.fallback = $fallback
```

### `voiceHistory` (read-only)

The voices this project’s films were cast with, newest first (keep a brand’s voice; never recast a turned-down one).

```cypher
MATCH (f:Film)-[e:VOICED_BY]->(v:Voice)
RETURN v.id AS voice, f.chat AS chat, e.rejected AS rejected, e.at AS at
ORDER BY e.at DESC
LIMIT $n
```

### `rejectVoice` (write)

The user turned the voice down: every film of the chat that used it marks the edge rejected, with the words.

```cypher
MATCH (f:Film {chat: $chat})-[e:VOICED_BY]->(:Voice {id: $voice})
SET e.rejected = true, e.rejectedWhy = $why, e.rejectedAt = $at
RETURN count(e) AS n
```

### `whyVoice` (read-only)

Why this film sounds the way it does: the voice, its tags, the reason, the shortlist, who picked it and which engine spoke.

```cypher
MATCH (:Film {id: $film})-[e:VOICED_BY]->(v:Voice)
RETURN v.id AS voice, v.name AS name, v.accent AS accent, v.gender AS gender, v.age AS age, v.energy AS energy,
       e.reason AS reason, e.shortlist AS shortlist, e.by AS by, e.picked AS picked, e.spokenBy AS spokenBy,
       e.lines AS lines, e.cached AS cached, e.msPerLine AS msPerLine
```

### `voiceMix` (read-only)

How often each voice voiced this project’s films (turned-down ones left out), and the accents that won.

```cypher
MATCH (f:Film)-[e:VOICED_BY]->(v:Voice)
WHERE coalesce(e.rejected, false) = false
RETURN v.id AS voice, v.accent AS accent, count(f) AS films
ORDER BY films DESC, voice
```
