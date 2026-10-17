# Graph Hacks plan: "Anive Editor Brain" on FalkorDB

Event: Graph Hacks (WeMakeDevs x FalkorDB), Oct 15 12:01 AM to Oct 18 11:59 PM IST.
This is a prep doc only (ideas, data model, queries, plan). No hackathon code is written before Oct 15 (rule 8).

## 1. The idea in one paragraph

A creator drops in a raw talking video. An AI editor agent turns it into a finished video. Every decision it makes
(cut this, cover that with footage, show this fact card, trust this source, show this product photo) is a walk
through a FalkorDB graph: the creator's past feedback, rules learned from it, claims and the sources that back them,
clips already used, and what worked last time. Remove FalkorDB and the agent cannot decide anything: it has no rules,
no memory of the creator, no trusted sources and no way to explain itself. The graph is the editor's brain.

## 2. Honest note on rule 8 (new work only)

- Anive's existing pipeline (the auto edit in remotion-video-maker: transcribe, render, stage, b-roll download)
  was built before the event. Present it as a library Vignesh built earlier, named and linked in the README as
  "pre-existing, used as a library", like any other dependency.
- The hackathon entry is NEW work in a NEW public repo, written Oct 15 to 18: the graph agent (FalkorDB schema,
  ingestion, Cypher tools, the agent loop that queries the graph at each step, MCP server, explain view, demo).
- The old `graph/` folder and the earlier FalkorDB POC in remotion-video-maker are NOT copied. Start the graph code
  from zero during the event. Ideas may be reused; code may not.
- Rule 6: only public, synthetic or own data in the graph. Do NOT load a client's video, transcript or
  decisions. Demo with Vignesh's own recordings (or a public-domain talk), plus public sources (Europe PMC, NIH).
- Rules 11 to 13: disclose AI assistance in the README; Vignesh must be able to explain every query and every module.

## 3. Graph data model (one graph per creator: `anive:creator:<id>`)

Nodes
- `Creator {id, name, channel}`
- `Video {id, title, topic, duration, created_at, score}`
- `Segment {id, start, end, text, mode, weak_score}` (a few seconds of the talk)
- `Claim {id, text, verdict}`
- `Source {url, name, domain, kind (paper/page), trust}`
- `Product {name, kind, page, price, price_seen_at}`
- `BrollClip {id, provider, url, licence, tags}`
- `Rule {id, text, scope (cut/look/truth/sound), weight}`
- `Feedback {id, text, at, rating}` (the creator's own words, e.g. "don't show how long the video is")
- `Decision {id, kind (mode/card/clip/cut), choice, at}`
- `Topic {name}`

Edges
- `(Creator)-[:MADE]->(Video)`, `(Video)-[:HAS]->(Segment)`
- `(Segment)-[:MAKES_CLAIM]->(Claim)`, `(Claim)-[:SUPPORTED_BY {quote}]->(Source)`, `(Claim)-[:CONTRADICTED_BY {quote}]->(Source)`
- `(Segment)-[:MENTIONS]->(Product)`, `(Product)-[:SOLD_AT]->(Source)`
- `(Segment)-[:COVERED_BY]->(BrollClip)`, `(BrollClip)-[:SHOWS]->(Topic)`
- `(Creator)-[:GAVE]->(Feedback)`, `(Rule)-[:LEARNED_FROM]->(Feedback)`
- `(Decision)-[:FOR]->(Segment)`, `(Decision)-[:BECAUSE]->(Rule)`, `(Decision)-[:VIOLATES]->(Rule)` (found by the self-check)
- `(Video)-[:ABOUT]->(Topic)`, `(Source)-[:CITES]->(Source)` (from paper reference lists, for PageRank)

## 4. Where the agent asks the graph (each step depends on it)

1. Before editing: load the creator's rules (feedback -> rule -> weight). No rules, no edit style.
2. Cut: has this creator rejected a kind of cut before (feedback linked to a cut decision)?
3. Mode per segment: rules for "hook", "weak delivery", "facts on stage"; plus how similar segments were decided in
   the creator's past videos (multi-hop: Segment -> Decision -> Rule and Segment -> Claim -> Topic).
4. Fact-check: claim -> already-verified claim with the same meaning -> its source -> verdict (reuse, no new search);
   new sources ranked by trust (PageRank over CITES + domain prior).
5. B-roll: never reuse a clip this creator already used (Creator -> Video -> Segment -> BrollClip).
6. Products: a product seen before with a price and date; re-check the price if it is old.
7. Self-check: write VIOLATES edges; the next run reads them and avoids the same mistake.
8. "Why this edit?": shortest path from a Decision to the Feedback it came from, shown in the UI.

## 5. Cypher queries the agent depends on (draft)

```cypher
// Q1 rules for this creator, strongest first
MATCH (c:Creator {id:$cid})-[:GAVE]->(f:Feedback)<-[:LEARNED_FROM]-(r:Rule)
RETURN r.text, r.scope, r.weight ORDER BY r.weight DESC

// Q2 why was segment X shown this way (path back to the creator's words)
MATCH p = shortestPath((d:Decision)-[:FOR|BECAUSE|LEARNED_FROM*..4]-(f:Feedback))
WHERE (d)-[:FOR]->(:Segment {id:$sid}) RETURN p

// Q3 reuse a verdict: same claim verified before
MATCH (cl:Claim)-[s:SUPPORTED_BY]->(src:Source) WHERE cl.text CONTAINS $key
RETURN cl.verdict, s.quote, src.name, src.url ORDER BY src.trust DESC LIMIT 3

// Q4 clips this creator already used (never again)
MATCH (:Creator {id:$cid})-[:MADE]->(:Video)-[:HAS]->(:Segment)-[:COVERED_BY]->(b:BrollClip) RETURN b.id

// Q5 how past segments like this were shown (mode votes)
MATCH (:Creator {id:$cid})-[:MADE]->(:Video)-[:HAS]->(s:Segment)-[:MAKES_CLAIM]->(:Claim)-[:ABOUT]->(t:Topic {name:$topic})
MATCH (d:Decision {kind:'mode'})-[:FOR]->(s) RETURN d.choice, count(*) AS n ORDER BY n DESC

// Q6 most trusted sources for a topic (PageRank over CITES)
CALL algo.pageRank('Source', 'CITES') YIELD node, score
MATCH (node)<-[:SUPPORTED_BY]-(:Claim)-[:ABOUT]->(:Topic {name:$topic})
RETURN node.name, node.url, score ORDER BY score DESC LIMIT 5

// Q7 rules this video broke (from the self-check), to fix before export
MATCH (:Video {id:$vid})-[:HAS]->(s:Segment)<-[:FOR]-(d:Decision)-[:VIOLATES]->(r:Rule) RETURN s.start, d.choice, r.text

// Q8 product price seen before, and when
MATCH (p:Product {name:$name})-[:SOLD_AT]->(src:Source) RETURN p.price, p.price_seen_at, src.url

// Q9 topic clusters across the creator's videos (community detection) -> chapter and series ideas
CALL algo.labelPropagation() YIELD node, communityId WHERE node:Topic RETURN communityId, collect(node.name)

// Q10 feedback that no rule covers yet (the agent proposes a new rule)
MATCH (c:Creator {id:$cid})-[:GAVE]->(f:Feedback) WHERE NOT (f)<-[:LEARNED_FROM]-(:Rule) RETURN f.text
```
(Check the exact FalkorDB procedure names on Oct 15: shortest path, PageRank, label propagation / WCC are listed in
its docs; adjust syntax then.)

## 6. Graph algorithms and what they do here

- Shortest path: the "why this edit" view, from any decision back to the creator's feedback.
- PageRank / centrality over Source CITES: which sources to trust most for a topic.
- Community detection over Topic and Claim: topic clusters across videos (series ideas, consistent looks).
- WCC: find duplicate claims said in different words across videos (reuse verdicts).

## 7. The "remove FalkorDB and it breaks" test

- The agent loop gets its rules, past decisions, trusted sources and used clips ONLY from Cypher queries.
- Demo it live: stop the FalkorDB container, run the edit, it stops at step 1 with "no editor brain".
- Show run 1 vs run 2: after the creator gives feedback once ("no timeline bar"), run 2 follows it with no prompt
  change, and "why" shows the path to that feedback.

### 7a. As built in Moovi (decision 13, 2026-10-17)

The product path needs FalkorDB. Every local stand-in for the graph in `packages/engine/src` (the catalogue, map.json,
"no kit", swallowed graph errors) runs only with `MOOVI_GRAPH_OPTIONAL=1`, which the engine tests and local dev set and
the server never does. Without it, an outage stops the job with **"Moovi's memory is offline"**, and the studio shows
that in the chat (one gate: `requireGraph` / `graphOr` / `needGraph` in `packages/graph/src/client.ts`).

"Why this edit?" is real too. The live edit (style, caption look, cuts, library cast, effects), Auto's kit, voice casting
and edit-by-words write `(:Decision)-[:BECAUSE]->(:Feedback|:Rule|:Reference|:Asset)`, plus `(:Rule)-[:LEARNED_FROM]->(:Feedback)`
and `(:Asset)-[:FROM]->(:Reference)`. Ask Moovi "why this caption?" or "why this voice?" in the chat and it answers from
`whyThis`: a `shortestPath` from the newest decision of that kind back to each cause, the user's own words first
(`packages/graph/src/queries/why.ts`, `packages/engine/src/why.ts`).

**The demo** (needs Docker and the local FalkorDB from `pnpm falkordb`, library seeded with `pnpm --filter @moovi/engine library`):

```
pnpm --filter @moovi/engine demo:graph-stop --docker moovi-falkordb
```

Run 1 has FalkorDB up: the graph half of a live edit, in product order, through the product's own functions (style
memory, type kit, library cast, sound cast, Auto's kit match, the decision written with its causes), then "why this
caption?". The script then runs `docker stop`, and run 2 refuses at its first graph read. Then `docker start`, and run 3
works again. Without `--docker` it asks the presenter to stop and start FalkorDB and waits for it.

The output, cut down, from one run:

```
── 1. FalkorDB up ──            → done in 0.23 s
  Moovi: I chose karaoke captions because of the rule "karaoke captions on every video", learned from your words
  "always use karaoke captions on my videos". Also: the library asset "Karaoke captions", from the reference reel "R8".
    path (2 hops): (:Decision) -[:BECAUSE]-> (:Rule) -[:LEARNED_FROM]-> (:Feedback)
    path (2 hops): (:Decision) -[:BECAUSE]-> (:Asset) -[:FROM]-> (:Reference)
── 2. FalkorDB stopped ──       → STOPPED after 0.00 s: Moovi's memory is offline: FalkorDB is unreachable (ECONNREFUSED)
── 3. FalkorDB up again ──      → done in 0.17 s
PASS
```

Measured on Ishaan's PC (Windows, Docker Desktop, FalkorDB 6.0.2), 4 runs on 2026-10-17:

| Step | Time |
|---|---|
| Run 1, FalkorDB up (all graph steps + the "why" answer) | 0.23 to 0.56 s (the first, cold run is slowest) |
| `whyThis` (the shortest-path query) | 4 to 18 ms |
| `docker stop moovi-falkordb` | 0.9 to 2.2 s |
| Run 2, FalkorDB stopped, until the refusal | under 0.01 s (the connection is refused at once) |
| `docker start`, then FalkorDB answering again | 0.8 to 1.4 s, plus 0.6 to 0.8 s |
| Run 3, FalkorDB up again | 0.17 to 0.42 s |

The same refusal is covered by `packages/engine/test/graph-required.test.ts`: with the flag unset and FalkorDB down,
the sound cast, kit match, library, effects, inserts, type kit, a style job and a clip-moment job all stop with that
message.

## 8. Track choice

- Recommend Track 1 "Agents That Act on Connected Data" (the iPhone 18 Pro): the agent acts (edits a video) by
  multi-hop reasoning over connected data, uses graph queries and algorithms as tools, explains every action.
- Also eligible for Track 2 "Agent Memory and Coordination": memory per creator across sessions, and shared state
  between agents (cutter, fact-checker, director, critic) through the graph. Enter both if the rules allow (they did
  on Oct 10: each track has its own prize).

## 9. Submission checklist (rule 10)

- [ ] Public repo (new), MIT, README: what it is, setup in 3 commands, the graph data model (diagram), the Cypher
      queries with one line each on why, track(s) named, AI-use disclosure, "pre-existing library" note.
- [ ] docker compose: falkordb (with --appendonly yes) + the agent.
- [ ] Demo video (2 to 3 min): raw clip in, edit out, the "why" path, FalkorDB stopped = agent stops, run 1 vs run 2.
- [ ] Deployment or local setup steps that work on a clean machine.
- [ ] Only own/public data in the graph.
- [ ] Blog post (side prize) on the last day.
- [ ] Register on WeMakeDevs before Oct 15.

## 10. Day by day

- Oct 15 (day 1): new repo, docker falkordb, schema + ingestion of one run's results (segments, claims, sources,
  products, clips, decisions); Q1, Q4, Q3 working; tests.
- Oct 16 (day 2): agent loop that queries the graph at each step (rules -> modes -> fact reuse -> clip exclusion);
  feedback -> rule learning; MCP server exposing the queries as tools.
- Oct 17 (day 3): "why this edit" view (shortest path), PageRank trust, self-check writes VIOLATES; run 1 vs run 2
  demo; remove-FalkorDB test.
- Oct 18 (day 4): polish README + diagram, record the demo video, deploy or verify local setup on a clean box,
  blog post, submit before 11:59 PM IST with buffer (aim 8 PM).
