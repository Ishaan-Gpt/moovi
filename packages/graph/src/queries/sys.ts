import { q } from './q';

/**
 * `sys`: accounts, sign-in sessions and the index of projects (who owns what, and the summary the dashboard shows).
 * Passwords are stored only as scrypt hashes; session tokens only as SHA-256 hashes.
 */
export const sys = {
  /* ───── places: the shared geocoding cache (Nominatim allows one request a second, so a name is asked for once) ───── */
  cachedPlace: q('cachedPlace', true, 'A place name already geocoded: its coordinates and country (so Nominatim is not asked twice).', `
MATCH (p:Place {key: $key})
RETURN p.key AS key, p.name AS name, p.lat AS lat, p.lon AS lon, p.cc AS cc, p.country AS country, p.kind AS kind, p.bbox AS bbox`),

  cachePlace: q('cachePlace', false, 'Remember a geocoded place by its normalised name: (:Place {name, lat, lon}).', `
MERGE (p:Place {key: $key})
SET p.name = $name, p.lat = $lat, p.lon = $lon, p.cc = $cc, p.country = $country, p.kind = $kind, p.bbox = $bbox, p.at = $at
RETURN p.key AS key`),

  createUser: q('createUser', false, 'Sign-up: a new account, only if no account has this email.', `
OPTIONAL MATCH (x:User {email: $email})
WITH x WHERE x IS NULL
CREATE (u:User {id: $id, email: $email, name: $name, hash: $hash, salt: $salt, at: $at})
RETURN u.id AS id`),

  userByEmail: q('userByEmail', true, 'Sign-in: the account for an email, with its password hash.', `
MATCH (u:User {email: $email})
RETURN u.id AS id, u.email AS email, u.name AS name, u.hash AS hash, u.salt AS salt`),

  userById: q('userById', true, 'An account by id (never its hash).', `
MATCH (u:User {id: $id})
RETURN u.id AS id, u.email AS email, u.name AS name, u.at AS at`),

  createSession: q('createSession', false, 'A signed-in session for an account (the cookie holds the token; the graph its hash).', `
MATCH (u:User {id: $user})
CREATE (s:Session {hash: $hash, at: $at, expires: $expires})-[:OF]->(u)`),

  sessionUser: q('sessionUser', true, 'Who a session belongs to, if it has not expired.', `
MATCH (s:Session {hash: $hash})-[:OF]->(u:User)
WHERE s.expires > $now
RETURN u.id AS id, u.email AS email, u.name AS name`),

  deleteSession: q('deleteSession', false, 'Sign-out: the session is gone.', `
MATCH (s:Session {hash: $hash})
DELETE s`),

  pruneSessions: q('pruneSessions', false, 'Expired sessions are removed.', `
MATCH (s:Session)
WHERE s.expires <= $now
DELETE s`),

  createProject: q('createProject', false, 'A user opens a new project (its own graph is created next to this index row).', `
MATCH (u:User {id: $user})
CREATE (p:Project {id: $id, name: $name, at: $at, updated: $at, chats: 0, videos: 0})
CREATE (u)-[:OWNS]->(p)
RETURN p.id AS id`),

  userProjects: q('userProjects', true, 'The dashboard: a user’s projects, most recently used first.', `
MATCH (:User {id: $user})-[:OWNS]->(p:Project)
WHERE p.closed IS NULL OR p.closed = false
RETURN p.id AS id, p.name AS name, p.at AS at, p.updated AS updated, p.chats AS chats, p.videos AS videos, p.poster AS poster
ORDER BY p.updated DESC`),

  closeProject: q('closeProject', false, 'The owner deletes a project from the dashboard: it is closed (hidden from userProjects); its graph stays, so it can be restored.', `
MATCH (:User {id: $user})-[:OWNS]->(p:Project {id: $id})
SET p.closed = true, p.closed_at = $at
RETURN p.id AS id`),

  projectOwner: q('projectOwner', true, 'Who owns a project (every project request is checked against it).', `
MATCH (u:User)-[:OWNS]->(p:Project {id: $id})
RETURN u.id AS user, p.name AS name`),

  touchProject: q('touchProject', false, 'The project index follows the project: name, counts, latest poster, last use.', `
MATCH (p:Project {id: $id})
SET p.updated = $at,
    p.name = coalesce($name, p.name),
    p.chats = coalesce($chats, p.chats),
    p.videos = coalesce($videos, p.videos),
    p.poster = coalesce($poster, p.poster)`),
};
