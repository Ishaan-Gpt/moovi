import { q } from './q';

/**
 * `craft`: the type registry (Stage 1 W2). A type is one of the seven kinds of film (packages/library/src/types):
 *
 *   (:Type {id, name, i (card order), status, spec (JSON: the whole TypeSpec, taste fields included), src})
 *     -[:LOOK {role, i, name, kind}]->(:Style {id})        a generated style it wears (s1, s4, s5, darkvox, anatomy, launch, clip-moment)
 *     -[:LOOK {role, i, name, kind}]->(:EditStyle {id})    an edit look (base, atlas, handmade, studio-minimal, studio-cut)
 *     -[:REFERENCE {role}]->(:Reference {id})              a reference that teaches it (decision 9), or seeds it (role 'seed')
 *   (:Asset)-[:IN_TYPE {w, when}]->(:Type)                 the type's library slice: its looks' assets and its references'
 *                                                          parts; w carries today's weight, `when` waits for Ishaan's WHEN rule
 *
 * `when` is a Cypher keyword, so the queries write it escaped (`` `when` ``).
 * Seeded from the specs on every library seed (engine/src/library/types.ts); a reseed replaces every edge. `typeKit` is
 * the one read a film of that type needs ("Load the type's kit" in docs/PIPELINE.html).
 */
export const types = {
  seedTypes: q('seedTypes', false, 'Idempotent seed of the seven types: one (:Type) per spec, every field replaced (the specs in code are the truth).', `
UNWIND $rows AS r
MERGE (t:Type {id: r.id})
SET t.name = r.name, t.i = r.i, t.status = r.status, t.spec = r.spec, t.src = r.src
RETURN count(t) AS types`),

  clearTypeLinks: q('clearTypeLinks', false, 'Before re-linking the types: drop every LOOK and REFERENCE edge a type has.', `
MATCH (:Type)-[e:LOOK|REFERENCE]->()
DELETE e
RETURN count(e) AS dropped`),

  linkTypeStyles: q('linkTypeStyles', false, 'A type wears a generated style as a look: (Type)-[:LOOK {role, i, name, kind}]->(Style). A style node that does not exist yet is created with its name only (existing ones keep theirs).', `
UNWIND $rows AS r
MATCH (t:Type {id: r.type})
MERGE (s:Style {id: r.look})
ON CREATE SET s.name = r.name
MERGE (t)-[l:LOOK]->(s)
SET l.role = r.role, l.i = r.i, l.name = r.name, l.kind = 'style'
RETURN count(l) AS looks`),

  linkTypeEditLooks: q('linkTypeEditLooks', false, 'A type wears an edit look: (Type)-[:LOOK {role, i, name, kind}]->(EditStyle).', `
UNWIND $rows AS r
MATCH (t:Type {id: r.type})
MERGE (s:EditStyle {id: r.look})
MERGE (t)-[l:LOOK]->(s)
SET l.role = r.role, l.i = r.i, l.name = r.name, l.kind = 'edit-look'
RETURN count(l) AS looks`),

  linkTypeReferences: q('linkTypeReferences', false, 'A reference belongs to a type (decision 9): (Type)-[:REFERENCE {role}]->(Reference); references not in the graph are skipped.', `
UNWIND $rows AS r
MATCH (t:Type {id: r.type}), (ref:Reference {id: r.ref})
MERGE (t)-[e:REFERENCE]->(ref)
SET e.role = r.role
RETURN count(e) AS refs`),

  clearTypeAssets: q('clearTypeAssets', false, 'Before re-marking the library: drop every IN_TYPE edge (the specs and the catalogue are the truth).', `
MATCH (:Asset)-[e:IN_TYPE]->(:Type)
DELETE e
RETURN count(e) AS dropped`),

  linkAssetTypes: q('linkAssetTypes', false, 'An asset is in a type’s slice: (Asset)-[:IN_TYPE {w, when}]->(Type); rows for assets not in the graph are skipped.', `
UNWIND $rows AS r
MATCH (a:Asset {id: r.id}), (t:Type {id: r.type})
MERGE (a)-[e:IN_TYPE]->(t)
SET e.w = r.w, e.\`when\` = r.\`when\`
RETURN count(e) AS edges`),

  typesAll: q('typesAll', true, 'Every type, in card order, with its status, its looks and how big its library slice is.', `
MATCH (t:Type)
OPTIONAL MATCH (t)-[l:LOOK]->(s)
WITH t, l, s ORDER BY l.i
WITH t, collect(CASE WHEN s IS NULL THEN null ELSE {id: s.id, name: l.name, role: l.role, kind: l.kind} END) AS looks
OPTIONAL MATCH (a:Asset)-[:IN_TYPE]->(t)
WHERE NOT coalesce(a.retired, false)
RETURN t.id AS id, t.i AS i, t.name AS name, t.status AS status, looks, count(a) AS assets
ORDER BY i`),

  typeKit: q('typeKit', true, 'Everything a film of one type needs, in one read: the spec (arcs, beat map, presets, tool rules, floor overrides, motion branch), its looks in order, its references, and its library slice (strongest first, then id).', `
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
       collect(CASE WHEN a IS NULL THEN null ELSE {id: a.id, category: a.category, w: e.w, \`when\`: e.\`when\`, ship: a.ship} END) AS assets`),
};
