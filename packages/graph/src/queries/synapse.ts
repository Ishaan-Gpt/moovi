import { q } from './q';

/**
 * The synapse view (proj_<pid>): how a run used Moovi's memory. While a run works, every named query a task runs is a
 * small event on a Redis stream (engine/src/synapse.ts). When the run ends the events are kept here, on the run itself,
 * so a finished video replays its whole synapse: (:Run)-[:TRACED]->(:Synapse), and per agent and query
 * (:Agent)-[:CALLED {run, n, rows, ms}]->(:Call {name, graph}). Only names, counts and times: never query text or values.
 */
export const synapse = {
  saveSynapse: q('saveSynapse', false, 'A finished run keeps its synapse: the call events (names, counts, times only) and one CALLED edge per agent and named query.', `
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
RETURN count(e) AS edges`),

  synapseOf: q('synapseOf', true, 'A finished run’s kept synapse (its call events), for the replay.', `
MATCH (:Run {id: $run})-[:TRACED]->(s:Synapse)
RETURN s.events AS events, s.calls AS calls, s.at AS at
LIMIT 1`),

  synapseCalls: q('synapseCalls', true, 'Which agent called which named query in a run, how often, how many rows: the synapse as a graph.', `
MATCH (a:Agent)-[e:CALLED {run: $run}]->(k:Call)
RETURN a.id AS agent, k.name AS name, k.graph AS graph, e.n AS n, e.rows AS rows, e.ms AS ms
ORDER BY n DESC`),

  runsOfChat: q('runsOfChat', true, 'Every run of a chat’s video, newest first (the synapse view’s run picker).', `
MATCH (:Chat {id: $chat})-[:MAKES]->(:Video)-[:BUILT_BY]->(r:Run)
RETURN r.id AS id, r.n AS n, r.status AS status, r.kind AS kind, r.at AS at, r.updated AS updated
ORDER BY r.n DESC
LIMIT 20`),
};
