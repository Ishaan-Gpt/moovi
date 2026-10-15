import { q } from './q';

/**
 * `proj_<pid>`: who voices each film and why. The Voice Director's pick is an edge, (:Film)-[:VOICED_BY]->(:Voice),
 * carrying the reason, the shortlist, who picked (a model or the ranking), the engine asked for and the engine that
 * actually spoke. The next film of the project reads it back (a brand keeps its voice; a voice the user turned down
 * is never cast again in that chat).
 */
export const voice = {
  castVoice: q('castVoice', false, 'The Voice Director casts a voice for a film: the Voice (with its tags), the Film, and the VOICED_BY edge with the reason.', `
MERGE (v:Voice {id: $voice})
SET v.name = $name, v.locale = $locale, v.lang = $lang, v.accent = $accent, v.gender = $gender, v.age = $age, v.energy = $energy
MERGE (f:Film {id: $film})
SET f.chat = $chat, f.video = $video, f.at = coalesce(f.at, $at)
WITH f, v
OPTIONAL MATCH (f)-[old:VOICED_BY]->(:Voice)
DELETE old
WITH DISTINCT f, v
CREATE (f)-[e:VOICED_BY {reason: $reason, by: $by, score: $score, shortlist: $shortlist, rate: $rate, picked: $engine, at: $at}]->(v)
RETURN v.id AS voice`),

  voiceSpoken: q('voiceSpoken', false, 'After the voice is recorded: which engine really spoke, how many lines came from the cache, and the time per line.', `
MATCH (:Film {id: $film})-[e:VOICED_BY]->(:Voice {id: $voice})
SET e.spokenBy = $spokenBy, e.lines = $lines, e.cached = $cached, e.msPerLine = $msPerLine, e.seconds = $seconds, e.fallback = $fallback`),

  voiceHistory: q('voiceHistory', true, 'The voices this project’s films were cast with, newest first (keep a brand’s voice; never recast a turned-down one).', `
MATCH (f:Film)-[e:VOICED_BY]->(v:Voice)
RETURN v.id AS voice, f.chat AS chat, e.rejected AS rejected, e.at AS at
ORDER BY e.at DESC
LIMIT $n`),

  rejectVoice: q('rejectVoice', false, 'The user turned the voice down: every film of the chat that used it marks the edge rejected, with the words.', `
MATCH (f:Film {chat: $chat})-[e:VOICED_BY]->(:Voice {id: $voice})
SET e.rejected = true, e.rejectedWhy = $why, e.rejectedAt = $at
RETURN count(e) AS n`),

  whyVoice: q('whyVoice', true, 'Why this film sounds the way it does: the voice, its tags, the reason, the shortlist, who picked it and which engine spoke.', `
MATCH (:Film {id: $film})-[e:VOICED_BY]->(v:Voice)
RETURN v.id AS voice, v.name AS name, v.accent AS accent, v.gender AS gender, v.age AS age, v.energy AS energy,
       e.reason AS reason, e.shortlist AS shortlist, e.by AS by, e.picked AS picked, e.spokenBy AS spokenBy,
       e.lines AS lines, e.cached AS cached, e.msPerLine AS msPerLine`),

  voiceMix: q('voiceMix', true, 'How often each voice voiced this project’s films (turned-down ones left out), and the accents that won.', `
MATCH (f:Film)-[e:VOICED_BY]->(v:Voice)
WHERE coalesce(e.rejected, false) = false
RETURN v.id AS voice, v.accent AS accent, count(f) AS films
ORDER BY films DESC, voice`),
};
