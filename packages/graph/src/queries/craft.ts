import { q } from './q';

/**
 * `craft`: what every video can draw on, and nothing about anyone. Components and how they flow, recipes,
 * transitions, CC-BY beds and their beat grids, the video styles with their laws, skills, signatures (for
 * matching a brief to a style), presets, concept decks and each style's default stage.
 */
export const craft = {
  /* ───── seeds ───── */
  seedComponents: q('seedComponents', false, 'Idempotent seed: components and the slots they can fill.', `
UNWIND $rows AS r
MERGE (c:Component {id: r.id})
SET c.name = r.name, c.category = r.category, c.description = r.description, c.notes = r.notes,
    c.duration = r.duration, c.formats = r.formats
WITH c, r
UNWIND r.slots AS s
MERGE (sl:Slot {id: s.id})
MERGE (c)-[f:FILLS]->(sl)
SET f.rank = s.rank`),

  seedFlows: q('seedFlows', false, 'Idempotent seed: how well one component flows into the next (lower w is better).', `
UNWIND $rows AS r
MATCH (a:Component {id: r.from}), (b:Component {id: r.to})
MERGE (a)-[f:FLOWS_INTO]->(b)
SET f.w = r.w`),

  seedRecipes: q('seedRecipes', false, 'Idempotent seed: post shapes as ordered slot steps (generate from words, or edit around footage).', `
UNWIND $rows AS r
MERGE (re:Recipe {id: r.id})
SET re.slots = r.slots, re.mode = r.mode
WITH re, r
UNWIND range(0, size(r.slots) - 1) AS i
MATCH (s:Slot {id: r.slots[i]})
MERGE (re)-[:STEP {i: i}]->(s)`),

  seedTransitions: q('seedTransitions', false, 'Idempotent seed: transitions; signature ones are used once per video.', `
UNWIND $rows AS r
MERGE (t:Transition {id: r.id})
SET t.name = r.name, t.description = r.description, t.signature = r.signature`),

  seedTracks: q('seedTracks', false, 'Idempotent seed: CC-BY music beds with measured tempo.', `
UNWIND $rows AS r
MERGE (t:Track {id: r.id})
SET t.name = r.name, t.mood = r.mood, t.bpm = r.bpm, t.energy = r.energy, t.feel = r.feel,
    t.offset = r.offset, t.src = r.src, t.credit = r.credit`),

  seedBeats: q('seedBeats', false, 'Idempotent seed: the beat grid of each bed (t is seconds into the video).', `
UNWIND $rows AS r
MATCH (t:Track {id: r.track})
MERGE (b:Beat {id: r.id})
SET b.t = r.t, b.i = r.i, b.down = r.down
MERGE (t)-[:HAS_BEAT]->(b)`),

  seedStyles: q('seedStyles', false, 'Idempotent seed: the video styles (generate or edit), what each makes and where it renders.', `
UNWIND $rows AS r
MERGE (s:Style {id: r.id})
SET s.name = r.name, s.number = r.number, s.mode = r.mode, s.tagline = r.tagline, s.pitch = r.pitch, s.formats = r.formats,
    s.min = r.min, s.max = r.max, s.renders = r.renders, s.engine = r.engine, s.needs = r.needs, s.skill = r.skill,
    s.source = r.source, s.autonomous = r.autonomous`),

  seedLaws: q('seedLaws', false, 'Idempotent seed: each style’s laws, in the order every review checks them.', `
UNWIND $rows AS r
MATCH (s:Style {id: r.style})
MERGE (l:Law {id: r.id})
SET l.title = r.title, l.text = r.text, l.src = r.src
MERGE (s)-[h:HAS_LAW]->(l)
SET h.n = r.n`),

  seedChecks: q('seedChecks', false, 'Idempotent seed: the machine checks that test a law (Lens runs every one; a failure names its law).', `
UNWIND $rows AS r
MATCH (l:Law {id: r.law})
MERGE (c:Check {id: r.id})
SET c.kind = r.kind, c.about = r.about, c.params = r.params, c.blocking = r.blocking
MERGE (l)-[:CHECKED_BY]->(c)`),

  seedSkill: q('seedSkill', false, 'Idempotent seed: a style’s skill package, in sections; each section says which agents read it.', `
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
CREATE (k)-[:HAS_SECTION {n: r.n}]->(x)`),

  seedSignatures: q('seedSignatures', false, 'Idempotent seed: what a style is for, as features the deterministic matcher scores a brief against.', `
UNWIND $rows AS r
MATCH (s:Style {id: r.style})
MERGE (g:StyleSignature {id: r.id})
SET g.formats = r.formats, g.min = r.min, g.max = r.max, g.languages = r.languages, g.footage = r.footage,
    g.intents = r.intents, g.avoid = r.avoid, g.threshold = r.threshold, g.autonomous = r.autonomous
MERGE (s)-[:SIGNED]->(g)`),

  seedDecks: q('seedDecks', false, 'Idempotent seed: concept decks and their cards. A hand is one card per deck; fingerprint decks decide uniqueness.', `
UNWIND $rows AS r
MATCH (s:Style {id: r.style})
MERGE (d:Deck {id: r.id})
SET d.name = r.name, d.about = r.about, d.fingerprint = r.fingerprint
MERGE (s)-[:HAS_DECK]->(d)
WITH d, r
UNWIND r.cards AS c
MERGE (k:Card {id: c.id})
SET k.name = c.name, k.line = c.line, k.use = c.use, k.deck = r.name
MERGE (d)-[:HAS_CARD]->(k)`),

  seedPresets: q('seedPresets', false, 'Idempotent seed: a style’s shot presets, the beat roles each can play and what content it needs.', `
UNWIND $rows AS r
MATCH (s:Style {id: r.style})
MERGE (p:Preset {id: r.id})
SET p.name = r.name, p.roles = r.roles, p.needs = r.needs, p.props = r.props, p.about = r.about
MERGE (s)-[:HAS_PRESET]->(p)`),

  seedPresetFlows: q('seedPresetFlows', false, 'Idempotent seed: how well one preset follows another (lower w is better; never the same twice running).', `
UNWIND $rows AS r
MATCH (a:Preset {id: r.a}), (b:Preset {id: r.b})
MERGE (a)-[f:FLOWS_INTO]->(b)
SET f.w = r.w`),

  seedDefaultStages: q('seedDefaultStages', false, 'Idempotent seed: each style’s brand-free default stage (accent, ink, paper, font, glows).', `
UNWIND $rows AS r
MATCH (s:Style {id: r.style})
MERGE (g:Stage {id: r.id})
SET g.accent = r.accent, g.accentDeep = r.accentDeep, g.ink = r.ink, g.stage = r.stage, g.font = r.font,
    g.glows = r.glows, g.grid = r.grid, g.burst = r.burst
MERGE (s)-[:DEFAULT_STAGE]->(g)`),

  /* ───── reads ───── */
  recipes: q('recipes', true, 'Post shapes for a mode (generate or edit).', `
MATCH (r:Recipe {mode: $mode})-[s:STEP]->(sl:Slot)
WITH r, s.i AS i, sl.id AS slot ORDER BY i
RETURN r.id AS id, collect(slot) AS slots`),

  tracksByMood: q('tracksByMood', true, 'Every bed, by mood and energy.', `
MATCH (t:Track)
RETURN t.id AS id, t.name AS name, t.mood AS mood, t.bpm AS bpm, t.energy AS energy, t.offset AS offset, t.src AS src, t.credit AS credit
ORDER BY t.mood, t.energy`),

  tracks: q('tracks', true, 'Beds in the wanted moods, nearest in energy and tempo, skipping ones this user used lately.', `
MATCH (t:Track)
WHERE t.mood IN $moods AND NOT t.id IN $avoid
RETURN t.id AS id, t.name AS name, t.mood AS mood, t.bpm AS bpm, t.energy AS energy, t.offset AS offset,
       t.src AS src, t.credit AS credit
ORDER BY abs(t.energy - $energy) + abs(t.bpm - $bpm) / 100.0 ASC
LIMIT 3`),

  downbeats: q('downbeats', true, 'Downbeats of a bed inside a time span, to snap cuts to.', `
MATCH (:Track {id: $track})-[:HAS_BEAT]->(b:Beat)
WHERE b.down = true AND b.t >= $from AND b.t <= $to
RETURN b.id AS id, b.t AS t, b.i AS i
ORDER BY b.t`),

  candidates: q('candidates', true, 'Components that can fill a slot in this format.', `
MATCH (c:Component)-[f:FILLS]->(:Slot {id: $slot})
WHERE $format IN c.formats
RETURN c.id AS id, c.name AS name, c.category AS category, c.duration AS duration, c.notes AS notes, f.rank AS rank
ORDER BY f.rank`),

  signatures: q('signatures', true, 'Every style signature, for the deterministic matcher.', `
MATCH (s:Style)-[:SIGNED]->(g:StyleSignature)
RETURN s.id AS style, s.name AS name, s.mode AS mode, g.formats AS formats, g.min AS min, g.max AS max,
       g.languages AS languages, g.footage AS footage, g.intents AS intents, g.avoid AS avoid,
       g.threshold AS threshold, g.autonomous AS autonomous
ORDER BY s.id`),

  styles: q('styles', true, 'The styles, with their laws and counts.', `
MATCH (s:Style)
OPTIONAL MATCH (s)-[h:HAS_LAW]->(l:Law)
WITH s, h, l ORDER BY h.n
WITH s, [x IN collect({n: h.n, title: l.title, text: l.text}) WHERE x.title IS NOT NULL] AS laws
OPTIONAL MATCH (s)-[:HAS_DECK]->(d:Deck)
RETURN s.id AS id, s.name AS name, s.number AS number, s.mode AS mode, s.tagline AS tagline, s.pitch AS pitch,
       s.formats AS formats, s.min AS min, s.max AS max, s.renders AS renders, s.autonomous AS autonomous,
       laws, count(d) AS decks
ORDER BY mode DESC, number`),

  skillFor: q('skillFor', true, 'The skill sections one agent role reads for a style (sections with no roles are for everyone).', `
MATCH (:Style {id: $style})-[:HAS_SKILL]->(k:Skill)-[h:HAS_SECTION]->(x:SkillSection)
WHERE size(x.roles) = 0 OR $role IN x.roles
RETURN k.id AS skill, k.version AS version, x.id AS id, x.title AS title, x.text AS text
ORDER BY h.n`),

  lawsAndChecks: q('lawsAndChecks', true, 'A style’s laws in review order, each with the machine checks that test it.', `
MATCH (:Style {id: $style})-[h:HAS_LAW]->(l:Law)
OPTIONAL MATCH (l)-[:CHECKED_BY]->(c:Check)
WITH h, l, collect({id: c.id, kind: c.kind, about: c.about, params: c.params, blocking: c.blocking}) AS checks
RETURN l.id AS id, h.n AS n, l.title AS title, l.text AS text, [x IN checks WHERE x.id IS NOT NULL] AS checks
ORDER BY n`),

  stylePresets: q('stylePresets', true, 'A style’s presets with their roles and needs.', `
MATCH (:Style {id: $style})-[:HAS_PRESET]->(p:Preset)
RETURN p.id AS id, p.name AS name, p.roles AS roles, p.needs AS needs, p.props AS props, p.about AS about
ORDER BY p.id`),

  presetFlows: q('presetFlows', true, 'Flow weights between a style’s presets.', `
MATCH (:Style {id: $style})-[:HAS_PRESET]->(a:Preset)-[f:FLOWS_INTO]->(b:Preset)
RETURN a.id AS a, b.id AS b, f.w AS w`),

  defaultStage: q('defaultStage', true, 'A style’s default stage (a user’s own look, when they have one, lives in their graph).', `
MATCH (:Style {id: $style})-[:DEFAULT_STAGE]->(g:Stage)
RETURN g.accent AS accent, g.accentDeep AS accentDeep, g.ink AS ink, g.stage AS stage, g.font AS font,
       g.glows AS glows, g.grid AS grid, g.burst AS burst`),

  styleDecks: q('styleDecks', true, 'A style’s concept decks with their cards.', `
MATCH (:Style {id: $style})-[:HAS_DECK]->(d:Deck)-[:HAS_CARD]->(k:Card)
WITH d, k ORDER BY k.id
RETURN d.id AS id, d.name AS name, d.about AS about, d.fingerprint AS fingerprint,
       collect({id: k.id, name: k.name, line: k.line, use: k.use}) AS cards
ORDER BY d.id`),

  /** The scrub check reads every node's properties; the brand pattern is matched in code (see engine reset). */
  allProps: q('allProps', true, 'Scrub check: every craft node with its properties (scanned for brand or client-film names).', `
MATCH (n)
WHERE NOT n:Beat
RETURN labels(n)[0] AS label, n.id AS id, properties(n) AS props`),

  counts: q('counts', true, 'How much craft knowledge there is, per label.', `
MATCH (n)
RETURN labels(n)[0] AS label, count(n) AS n
ORDER BY label`),
};
