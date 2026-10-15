import { q } from './q';

/**
 * `user_<uid>`: what Moovi learns about one person across all their projects: their notes as lessons (with a
 * supersede chain, so only the current one counts), their look and preferences, and what their videos already used
 * (assets, angles, hook forms, preset sequences), so the next video never repeats it.
 * Laws live in `craft`; a lesson names the law it amends by id (`law`), since graphs don't share edges.
 */
export const user = {
  initUser: q('initUser', false, 'The user’s own graph starts with them in it.', `
MERGE (u:User {id: $id})
SET u.name = $name, u.at = coalesce(u.at, $at)`),

  /* ───── lessons (Keeper writes, every agent reads its own) ───── */
  writeLesson: q('writeLesson', false, 'Keeper files a lesson from the user’s note: which agents it binds, which law it amends.', `
MATCH (u:User)
CREATE (l:Lesson {id: $id, text: $text, topic: $topic, roles: $roles, law: $law, style: $style, at: $at, valid_from: $at,
                  source: $source, chat: $chat})
CREATE (u)-[:TAUGHT]->(l)
RETURN l.id AS id`),

  supersedeLesson: q('supersedeLesson', false, 'A newer lesson about the same thing replaces the older one, which stops being valid now.', `
MATCH (n:Lesson {id: $id}), (o:Lesson {id: $old})
SET o.invalid_at = $at
MERGE (n)-[:SUPERSEDES]->(o)`),

  lessonsFor: q('lessonsFor', true, 'The current lessons one agent must follow (for this style, or for every style).', `
MATCH (l:Lesson)
WHERE l.invalid_at IS NULL
  AND (size(l.roles) = 0 OR $role IN l.roles)
  AND (l.style IS NULL OR l.style = $style)
RETURN l.id AS id, l.text AS text, l.topic AS topic, l.law AS law, l.at AS at
ORDER BY l.at DESC`),

  lessonsOnTopic: q('lessonsOnTopic', true, 'Current lessons on a topic (Keeper decides whether a new note supersedes one).', `
MATCH (l:Lesson)
WHERE l.invalid_at IS NULL AND l.topic = $topic
RETURN l.id AS id, l.text AS text, l.roles AS roles, l.law AS law, l.at AS at
ORDER BY l.at DESC`),

  lessonTimeline: q('lessonTimeline', true, 'Every lesson ever, current or superseded, with what replaced it.', `
MATCH (l:Lesson)
OPTIONAL MATCH (n:Lesson)-[:SUPERSEDES]->(l)
RETURN l.id AS id, l.text AS text, l.topic AS topic, l.at AS at, l.invalid_at AS invalid_at, n.id AS replaced_by
ORDER BY l.at DESC`),

  /* ───── look and preferences ───── */
  setPreference: q('setPreference', false, 'A standing preference (voice, bed level, accent …), newest wins.', `
MATCH (u:User)
MERGE (p:Preference {key: $key})
SET p.value = $value, p.at = $at
MERGE (u)-[:PREFERS]->(p)`),

  preferences: q('preferences', true, 'Every standing preference.', `
MATCH (:User)-[:PREFERS]->(p:Preference)
RETURN p.key AS key, p.value AS value, p.at AS at`),

  /* ───── never repeat: assets, angles, hooks, preset sequences ───── */
  assetUsed: q('assetUsed', true, 'Has any of this user’s videos already used this asset (by content hash)?', `
MATCH (a:AssetUse {hash: $hash})
RETURN a.video AS video, a.project AS project, a.at AS at
LIMIT 1`),

  recordAssets: q('recordAssets', false, 'A finished video’s assets join the never-again list.', `
UNWIND $rows AS r
MERGE (a:AssetUse {hash: r.hash})
SET a.kind = r.kind, a.video = $video, a.project = $project, a.at = $at`),

  anglesUsed: q('anglesUsed', true, 'Angles and hook forms this user’s recent videos already took.', `
MATCH (v:VideoRef)
WHERE $style IS NULL OR v.style = $style
RETURN v.id AS video, v.angle AS angle, v.hook AS hook, v.title AS title, v.at AS at
ORDER BY v.at DESC
LIMIT $n`),

  recordVideo: q('recordVideo', false, 'A finished video is remembered: its style, angle, hook and preset sequence (the next one avoids them).', `
MERGE (v:VideoRef {id: $video})
SET v.project = $project, v.style = $style, v.angle = $angle, v.hook = $hook, v.title = $title, v.at = $at,
    v.bed = $bed, v.card = $card
WITH v
UNWIND $presets AS p
MERGE (x:PresetRef {id: p})
MERGE (v)-[:USED]->(x)`),

  recordSequence: q('recordSequence', false, 'The video’s preset order joins the usage graph (PageRank over it is the over-use penalty).', `
UNWIND $pairs AS pr
MERGE (a:PresetRef {id: pr.a})
MERGE (b:PresetRef {id: pr.b})
CREATE (a)-[:NEXT_USED {video: $video}]->(b)`),

  overUse: q('overUse', true, 'Over-use penalty: PageRank over this user’s own past preset sequences.', `
CALL algo.pageRank('PresetRef', 'NEXT_USED')
YIELD node, score
RETURN node.id AS id, score`),

  recentBeds: q('recentBeds', true, 'Beds this user’s recent videos used (the next one picks another).', `
MATCH (v:VideoRef)
WHERE v.bed IS NOT NULL
RETURN v.bed AS bed
ORDER BY v.at DESC
LIMIT $n`),
};
