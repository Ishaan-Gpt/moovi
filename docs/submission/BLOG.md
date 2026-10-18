---
title: "Moovi: 700+ commits, 3 days, one FalkorDB graph"
published: false
tags: falkordb, ai, mcp, showdev
cover_image: https://moovi-blog-preview.sites.tab.bot/img/cover-v4.jpg
---

*Built for Graph Hacks: Context for AI Agents, by WeMakeDevs x FalkorDB. Tracks: Track 01, Agents That Act on Connected Data, and Track 02, Agent Memory and Coordination.*

![Moovi's cover: Vignesh, Moovi's mascot and Ishaan, with the line Moovi. 3 days. 700+ commits. One graph.](https://moovi-blog-preview.sites.tab.bot/img/cover-v4.jpg)

![Bar chart of commits per hour over 68 hours, split by author, with the bug fixes from this post marked](https://moovi-blog-preview.sites.tab.bot/img/commit-timeline.png)
*713 commits to main in 68 hours. Every bar is one hour of commits; the yellow dots are the first twelve bugs in this post, placed at the minute the fix landed.*

Between Thursday 15 and Sunday 18 October, our team of four (Ishaan, Keshav, Srujan and I) built Moovi.

Moovi is an AI video editor. You give it a clip, it gives you back a finished vertical video: cut, captioned, with sound and effects. The part I care about is under the hood. Every choice it makes is a node in a FalkorDB graph, with an edge back to the reason. So when you ask "why did you cut there?", the answer is a Cypher query, not a guess.

This post is the honest version of those three days: how the graph is wired, what it is used for, seventeen things that broke and how we fixed them (some with photos of the real errors), and how our graph grew, and the calls we had to make on the last morning. Every commit below links to the real diff.

## What Moovi is

Moovi is like Lovable, but for video. On the first screen you pick one of three presets: **Edit** (your clip, cut and captioned), **Launch video** or **Showreel**. Then a crew of agents works on it in the studio: Moovi, Editor, Researcher, Writer, Sound, Designer, Lens and Keeper. Ishaan built the studio, the landing page and the product calls. I built the AI side: the graph memory, the edit engine pieces and the Claude Code bridge.

![The crew of eight on Moovi's landing page, with the eight steps from brief to remember](https://moovi-blog-preview.sites.tab.bot/img/crew.jpg)
*The landing page (a Three.js scene). Each crew member owns one step, from BRIEF to REMEMBER.*

Here is one Edit run on our test clip. The studio said this after 29 seconds:

> Here's your edit, playing live: 16.2 s from 19.0 s (2.8 s of pauses cut), 10 shots, 48 words captioned.

![Raw landscape clip on the left, the 9:16 captioned edit on the right](https://moovi-blog-preview.sites.tab.bot/img/before-after.jpg)
*Real frames from our 18 October end to end test. Left: the raw clip. Right: Moovi's Edit, about one second in.*

![Six frames from the finished Edit](https://moovi-blog-preview.sites.tab.bot/img/edit-contact-sheet.jpg)
*Six frames from the same finished Edit: punch ins, word by word captions, the end card.*

## TL;DR

- **FalkorDB is the only memory.** One shared library graph, one graph per user, one graph per project. 248 named Cypher queries. If FalkorDB goes down, the job stops with "Moovi's memory is offline". No silent fallback.
- **Every decision has a `BECAUSE` edge.** "Why this caption?" is a shortest path query that answers in milliseconds.
- **The task board is in the graph too.** Agents claim tasks with a lease, so two workers never take the same one.
- **A crew, not one agent.** Seven specialists plus Moovi, each with its own named queries and its own lessons, handing work over through a task board that lives in the graph.
- **Exactly three graph algorithms:** `shortestPath` for "why this?", `algo.SPpaths` and `algo.pageRank` to plan a film from a written brief. Code below, copied from our GitHub repo.
- **Moovi is not a closed app.** Plug it into your own Claude Code over MCP with two commands, and Claude Code becomes the brain.
- **My favourite bug:** a render queue that waited on itself. No error, no log line, just "working" forever. One line to fix.

## The demo

{% embed https://www.youtube.com/watch?v=9QYmooX4ffA %}

- Live: https://moovi-three.vercel.app
- Code: https://github.com/Ishaan-Gpt/moovi

## Why a crew and not one agent

We never shipped Moovi as one agent. The engine was a crew from its second commit, one minute into the hackathon ([`c617a55`](https://github.com/Ishaan-Gpt/moovi/commit/c617a55), 15 Oct 18:31 IST). Our reasoning: one agent with one prompt has to know captions, sound, fonts, facts and pacing all at once. Every new rule makes the prompt longer and the other rules weaker, and when a film comes out wrong you cannot tell which part of the prompt did it. A real edit room splits that work, so we did too.

The crew is Moovi (the one you talk to) plus seven specialists: Editor, Researcher, Writer, Sound, Designer, Lens and Keeper ([`033796a`](https://github.com/Ishaan-Gpt/moovi/commit/033796a)). This is how it is wired, all in the graph:

- **Work is a task board, not a conversation.** A film becomes `Task` nodes with `DEPENDS_ON` edges. A task becomes ready only when everything it depends on is done, and each task names its `agent`. The worker claims it with the `claim` query above, so nothing runs twice. That commit's title says it: "the crew: DAG scheduler on FalkorDB".
- **Each member has its own queries.** The Designer casts with `assetsServing` and `assetsForEvent`. The Writer's lines go through `truthGuard`. The Director plans with `boardPaths` and `overUse`. The Keeper writes your reactions with `recordFeedback`. No member sees the whole 248.
- **Each member has its own memory.** `lessonsFor` reads "the current lessons one agent must follow", so a lesson for Sound never clutters the Writer.
- **Every member signs its work.** Decisions are written with the agent that made them (`decide`), which is what makes "why this?" answerable per choice.
- **Handoffs are edges.** When a task finishes, `finish` keeps "its output for the tasks that depend on it". Nobody passes a giant chat history along.

The win is boring and real: when a film looks wrong, we can see which task, which agent and which query made it, and fix that one piece.

## How the graph is used

This is the part the hackathon is about, so I will go slowly.

### One FalkorDB, many graphs

FalkorDB can hold thousands of separate graphs in one instance, so we gave each kind of memory its own:

- **`craft`**: the shared library. Caption looks, sounds, camera moves, transitions, effects, fonts and the reference reels they came from. Nothing about any user ever goes in here.
- **`sys`**: accounts, sessions and who owns which project.
- **`user_<uid>`**: one per user. Their lessons, preferences and what their past videos used.
- **`proj_<pid>`**: one per project. Chats, videos, runs, the task board, facts, claims and every decision.

![Diagram of Moovi's graphs: craft, sys, user and project, with their node labels and relationship types](https://moovi-blog-preview.sites.tab.bot/img/graph-schema.png)
*Every label and edge here is read from the queries in `packages/graph/src/queries`. The counts in the craft panel come from our local FalkorDB on 18 October: 1,429 nodes and 5,215 edges.*

Agents never write Cypher. They call one of 248 named queries (125 read only, 123 writes), and the read only ones go through `GRAPH.RO_QUERY`, so the server itself refuses a write. Every call has a timeout and is timed, and the studio can show the real Cypher behind each step.

### The Cypher the crew calls

The 248 named queries live in eleven files under `packages/graph/src/queries`: craft (39), launch (7), library (44), media (12), project (78), styles (10), sys (13), types (9), user (25), voice (6) and why (5). Each one is a `q(name, readOnly, meaning, cypher)` call, so the plain English meaning sits next to the Cypher. Here are three the crew runs on every film, verbatim.

**The worker claims a task with a lease** (`project.ts`, `claim`, called from `packages/engine/src/worker.ts`). The `WHERE t.status = 'ready'` makes it atomic: two workers can race, only one wins.

```cypher
MATCH (t:Task {id: $id})
WHERE t.status = 'ready'
SET t.status = 'running', t.worker = $worker, t.lease_until = $lease, t.started_at = $at, t.attempts = t.attempts + 1
RETURN t.id AS id, t.kind AS kind, t.agent AS agent, t.resource AS resource, t.scope AS scope, t.title AS title,
       t.input AS input, t.attempts AS attempts, t.max AS max, t.feedback AS feedback, t.answer AS answer, t.reopened AS reopened
```

**The Designer casts an asset by what the beat needs** (`library.ts`, `assetsServing`, called from `edit/cast.ts`, `edit/inserts.ts` and `edit/effects/auto.ts`). Assets `SERVE` needs; the one that serves the most needs of this beat wins.

```cypher
UNWIND $needs AS nid
MATCH (a:Asset {category: $category})-[s:SERVES]->(:Need {id: nid})
WHERE ($runtime IS NULL OR $runtime IN a.runtime) AND (NOT $shipOnly OR a.ship) AND NOT coalesce(a.retired, false)
WITH a, count(*) AS hits, sum(s.w) AS rank
RETURN a.id AS id, a.name AS name, a.runtime AS runtime, a.energy AS energy, a.params AS params, a.impl AS impl, hits
ORDER BY hits DESC, rank ASC, a.id
LIMIT $n
```

**The Writer may not state a fact without a path to a source** (`project.ts`, `truthGuard`, called from `tasks/script.ts`). No path, no claim.

```cypher
MATCH (c:Claim {id: $id})-[:SUPPORTED_BY]->(f:Fact)-[:FROM]->(s:Source)
WHERE f.status IN ['verified', 'user_stated']
RETURN f.id AS fact, f.text AS text, s.ref AS source
```

With `whyThis` and `boardPaths` above, that is five of the 248, copied as they are.

### Why a graph and not a table

The questions Moovi asks on every step are about connections:

1. **What can this beat use?** An insert has to serve what the line needs (a before and after, a list, a number) *and* suit the edit style. That is two hops from the asset.
2. **Is this claim allowed?** A line in a script ships only if there is a path to a fact we stand behind, and from the fact to its source. That is three hops.
3. **Why did Moovi do that?** A decision, because of a rule, which was learned from something you said two videos ago. That is a path of unknown length.

With tables, each of these is a join, then another join, on every step of an agent loop. In FalkorDB each one is a single query. Here is the first one, run for real:

![Terminal output of a casting query on the craft graph, returning five assets in about 2 ms](https://moovi-blog-preview.sites.tab.bot/img/query-casting.png)
*Real output from our local FalkorDB. Five inserts that serve "before-after" or "compare" and suit the night-desk style, ranked by how many needs they hit.*

The full version is `assetsServing` in `packages/graph/src/queries/library.ts`. Assets are never deleted, only retired, so an old project can still explain itself.

### The truth guard

When the Writer drafts a script, each claim goes into the project graph linked to the facts it cites. The claim ships only if this query finds a path from it to a fact and from the fact to its source. No path, no claim:

```cypher
MATCH (c:Claim {id: $id})-[:SUPPORTED_BY]->(f:Fact)-[:FROM]->(s:Source)
WHERE f.status IN ['verified', 'user_stated']
RETURN f.id AS fact, f.text AS text, s.ref AS source
```

### Memory that changes over time

When you give Moovi a note about your taste, Keeper files it as a `(:Lesson)` in your own user graph, with the agent roles it binds. A newer lesson on the same topic does not delete the old one. It supersedes it:

```cypher
MATCH (n:Lesson {id: $id}), (o:Lesson {id: $old})
SET o.invalid_at = $at
MERGE (n)-[:SUPERSEDES]->(o)
```

Before it works, every agent reads only the lessons that are still valid for its role (`lessonsFor`). So the memory updates, but the history stays, and `lessonTimeline` can show you everything you ever told it.

### The task board is a graph

Each run is a set of `(:Task)` nodes with `DEPENDS_ON` edges. When every dependency of a waiting task is done, it becomes ready. A worker then claims it with a lease, and only one worker can win:

```cypher
MATCH (t:Task {id: $id})
WHERE t.status = 'ready'
SET t.status = 'running', t.worker = $worker, t.lease_until = $lease,
    t.started_at = $at, t.attempts = t.attempts + 1
RETURN t.id AS id, t.kind AS kind, t.agent AS agent
```

If a worker dies, its lease runs out and the task is ready again (`expired`). If a review sends work back, `reopen` puts that task and everything downstream of it back to waiting. The handoff between agents is just state in the graph that every agent can read.

### The three graph algorithms we really use

People ask "which graph algorithms?" so here is the honest list. There are exactly three, and each one is copied from our GitHub repo as it is on `main`. No vector search, no embeddings, no community detection.

**1. `shortestPath`: "why did you pick this?"** Every choice the crew makes (a caption, a voice, a cut) is saved as a `Decision` node with `BECAUSE` edges to what caused it. When you ask why, this query walks back to the cause, your own words first (`packages/graph/src/queries/why.ts`, `whyThis`):

```cypher
MATCH (d:Decision)
WHERE d.kind IN $kinds AND ($run IS NULL OR d.run = $run)
WITH d ORDER BY d.at DESC LIMIT 1
MATCH (d)-[:BECAUSE]->(x)-[:LEARNED_FROM|FROM*0..3]->(c)
WHERE c:Feedback OR c:Rule OR c:Reference OR c:Asset
WITH DISTINCT d, c
WITH d, c, shortestPath((d)-[:BECAUSE|LEARNED_FROM|FROM*]->(c)) AS p
WITH d, c, p, CASE WHEN c:Feedback THEN 0 WHEN c:Reference THEN 1 WHEN c:Rule THEN 2 ELSE 3 END AS rank
```

The `rank` line is the product decision: if you told us something, that is the reason we show first. A rule comes after, and a library asset last.

**2. `algo.SPpaths`: the cheapest order of looks.** When Moovi makes a film from a written brief instead of your own clip, the Director builds a small scratch lattice: one column per beat, one node per candidate preset, and `NEXT` edges whose weight `w` is how badly one look flows into the next. Then FalkorDB returns the k cheapest paths through it (`packages/graph/src/queries/project.ts`, `boardPaths`):

```cypher
MATCH (s:Lattice {id: $start}), (t:Lattice {id: $end})
CALL algo.SPpaths({sourceNode: s, targetNode: t, relTypes: ['NEXT'], weightProp: 'w', pathCount: $k, maxLen: $maxLen})
YIELD path, pathWeight
RETURN [n IN nodes(path) | n.preset] AS presets, pathWeight AS cost
ORDER BY cost ASC
```

The Director gets these as a tool called `suggest_sequence` ("a starting point, not an order", in `packages/engine/src/tasks/director.ts`). Once the board is chosen, `clearLattice` deletes the scratch nodes.

**3. `algo.pageRank`: what you lean on too much.** Each user graph keeps the order of presets your past films used, as `PresetRef` nodes joined by `NEXT_USED`. PageRank over that tells us which looks sit at the centre of your habits, and that score is added to the lattice weights above, so the next film leans away from them (`packages/graph/src/queries/user.ts`, `overUse`):

```cypher
CALL algo.pageRank('PresetRef', 'NEXT_USED')
YIELD node, score
RETURN node.id AS id, score
```

To be exact about scope: `SPpaths` and `pageRank` run only on the written brief path. When you upload your own clip for an Edit, the graph still picks every camera move, sound and transition, but by plain Cypher matching (next section), not by these two algorithms.

### "Why this edit?"

Every decision in a run (style, caption look, cuts, cast, effects, voice) is a `(:Decision)` with `BECAUSE` edges to its causes: your words (`:Feedback`), a `:Rule`, a `:Reference` reel or a library `:Asset`. A rule can be `LEARNED_FROM` your feedback, and an asset can come `FROM` a reference.

![Five decisions from one test run and the causes each points to](https://moovi-blog-preview.sites.tab.bot/img/why-graph.png)
*Drawn from a real query on the project graph of one local test run. Every arrow is a BECAUSE edge.*

```cypher
MATCH (d:Decision)
WHERE d.kind IN $kinds AND ($run IS NULL OR d.run = $run)
WITH d ORDER BY d.at DESC LIMIT 1
MATCH (d)-[:BECAUSE]->(x)-[:LEARNED_FROM|FROM*0..3]->(c)
WHERE c:Feedback OR c:Rule OR c:Reference OR c:Asset
WITH DISTINCT d, c
WITH d, c, shortestPath((d)-[:BECAUSE|LEARNED_FROM|FROM*]->(c)) AS p
RETURN d.choice, length(p) AS hops, [m IN nodes(p) | m.id] AS path
```

(Trimmed from `whyThis` in `packages/graph/src/queries/why.ts`. The real one ranks your own words first.)

![Terminal output of the whyThis query for caption and cut decisions](https://moovi-blog-preview.sites.tab.bot/img/why-query-output.png)
*Real output from FalkorDB. The cut came from the brief plus the cut rule. The caption look came from a rule plus one library asset.*

### Pulling the plug

Rule 3 of Graph Hacks says that if the product still works with FalkorDB taken out, the graph is decoration. On Saturday evening we checked our own code and found about 63 places in the engine where a local list quietly stood in for the graph when it was down. Ishaan wrote it down as decision 13 ([`ef95004`](https://github.com/Ishaan-Gpt/moovi/commit/ef950041a1a289a1a82b2f6b584558660e344b19)), and the same night every one of those fallbacks went behind a test only flag ([`3e1bae9`](https://github.com/Ishaan-Gpt/moovi/commit/3e1bae94cccfc6f57c9f332c52d34095a84bc5fa)). The server never sets it.

Then we built the demo for it ([`ca5cafd`](https://github.com/Ishaan-Gpt/moovi/commit/ca5cafd2c05198df426c43ac17008250e89a2dd6)): run the graph half of an edit, `docker stop` FalkorDB, watch the job refuse with "Moovi's memory is offline", `docker start`, watch it work again. Measured on Ishaan's PC: the refusal comes in under 0.01 s, Moovi answers again 0.6 to 0.8 s after the restart, and `whyThis` takes 4 to 18 ms.

### How the graph grew: our learning path

We did not plan the whole graph on day one. It grew as each problem showed up. Here is the path, one commit at a time.

1. **Thu 15 Oct, 18:30** · [`2bebe4a`](https://github.com/Ishaan-Gpt/moovi/commit/2bebe4ae67cace3007fd31b34e3d7458df9a2b35). Day one: the graph comes first. Before any video code, Ishaan built the FalkorDB layer: one client with read only guards, separate graphs for the system, each user, each project and the styles, and 129 named Cypher queries. The crew's task board went into the graph the same minute (`c617a55`).
2. **Thu 15 Oct, 20:05** · [`2c6b994`](https://github.com/Ishaan-Gpt/moovi/commit/2c6b994902f929aa1ad400f3c84214e6d5d0da5e). Media becomes nodes. I added Clip, Source, Licence, Page and Screenshot nodes, so every piece of footage carries where it came from and what licence it has.
3. **Fri 16 Oct, 01:41** · [`de8be84`](https://github.com/Ishaan-Gpt/moovi/commit/de8be84c25f832ad9b127355a7c1ddd98d6e925e). Memory. Your feedback became Feedback nodes with their own queries. This is where Moovi starts to remember your taste.
4. **Fri 16 Oct, 03:32** · [`b42f5be`](https://github.com/Ishaan-Gpt/moovi/commit/b42f5be62338cbc3f868eb389afc8f8d1ff5b967). The graph starts making choices. The visual library moved into FalkorDB, and what worked before became a prior for casting the next scene, with every pick stored per scene.
5. **Fri 16 Oct, 15:08** · [`f1c9d17`](https://github.com/Ishaan-Gpt/moovi/commit/f1c9d17efdaa27617b9de63c31596b093294ec54). Everything is an asset. The whole library (looks, sounds, kits) became Asset nodes, so styles could borrow pieces from it by query.
6. **Sat 17 Oct, 21:24** · [`3e1bae9`](https://github.com/Ishaan-Gpt/moovi/commit/3e1bae94cccfc6f57c9f332c52d34095a84bc5fa). No graph, no Moovi. We removed the quiet fallbacks and made FalkorDB required (bug 12 above).
7. **Sat 17 Oct, 22:09** · [`76fc270`](https://github.com/Ishaan-Gpt/moovi/commit/76fc27026d841cbeb59b6d48839bdc713abe3713). Explaining itself. "Why this edit?" became a shortest path from the edit back to the reasons behind it.
8. **Sun 18 Oct, 05:05** · [`26613cf`](https://github.com/Ishaan-Gpt/moovi/commit/26613cf8463c1324de3daf4092a95d6a14a2a78c). One edit registry. Every effect, camera move and UI piece became one registry in the graph, read by a single named query, `editCast`.
9. **Sun 18 Oct, 19:31** · [`0753733`](https://github.com/Ishaan-Gpt/moovi/commit/0753733ba6dd614a6680a47cce9c4aff8b301aac). Watching the crew. Every named graph call each agent makes is now recorded (names, counts and times only) and kept in FalkorDB at the end of a run.

By Sunday evening that was 248 named queries. The lesson for me: put a thing in the graph the moment you need to ask "why" or "what else is like this" about it.

## Moovi is not a closed app: plug it into Claude Code

Moovi has two brains: your own API key (Gemini, Groq, OpenAI and others), or your own Claude Code. Either way the model only fills slots and picks from lists the graph gives it. Casting, timing and checks are plain code, so a weaker model makes a plainer film, never a broken one.

![Diagram of Moovi's parts: studio, worker, FalkorDB, MCP server and Claude Code](https://moovi-blog-preview.sites.tab.bot/img/architecture.png)
*How the parts talk. Claude Code asks for one step at a time and sends back the answer.*

`packages/mcp` is an MCP server. It gives Claude Code three tools, `moovi_next` (give me the next step), `moovi_answer` (here is my answer) and `moovi_status`, plus our editing skill as read only MCP resources ([`f5a3a20`](https://github.com/Ishaan-Gpt/moovi/commit/f5a3a20)).

**Setup is two commands.** In Moovi's Settings you copy two lines and run them in Claude Code, each starting with `!` so Claude Code runs them as your own shell commands ([`d2abfe3`](https://github.com/Ishaan-Gpt/moovi/commit/d2abfe3)):

1. **Connect.** Claims your setup code and runs `claude mcp add` with Moovi's URL and your token. Nothing starts yet.
2. **Start.** Gets a fresh run ticket and starts a background `claude -p` session that can only call Moovi's tools.

**How a job reaches Claude Code.** Every brain step of a video is a job on the bridge's board. When your Claude Code is online, the job is leased to it first. If it does not pick the job up within 2 minutes, the job falls back to your key or Moovi's server model, so a video never hangs. A video you started before command 2 now waits for your Claude Code too ([`20e4bec`](https://github.com/Ishaan-Gpt/moovi/commit/20e4bec)). The worker log prints which brain took each decision.

![The Claude Code status pill in three states](https://moovi-blog-preview.sites.tab.bot/img/claude-code-pill.png)
*The studio's Claude Code pill in its three states.*

On 18 October I ran each preset end to end through the MCP path on a local box, with a scripted MCP client standing in for Claude Code:

![Bar chart: Edit live preview 29 s and final render 5.3 min, Launch video done in 49 s, Showreel done in 51 s](https://moovi-blog-preview.sites.tab.bot/img/preset-times.png)
*Chart of our own test logs. Edit plays a live preview first, then renders the final film.*

![Six frames of the Showreel made through the MCP path](https://moovi-blog-preview.sites.tab.bot/img/showreel-contact-sheet.jpg)
*Frames from the Showreel run (28.9 s video, done in 51 s).*

## What broke, and how we fixed it

This is the part I would have wanted to read before I started.

### 1. The render queue that waited on itself
**Sun 18 Oct, 13:28 IST** · [`df6c9a8`](https://github.com/Ishaan-Gpt/moovi/commit/df6c9a8db232cba87b4f9b48a5748d1077c58b33), merged in [`63c9eef`](https://github.com/Ishaan-Gpt/moovi/commit/63c9eefe376332af0f80bedb21e1db2c39091cc2)

Every Edit did the same thing in our last test round. The live preview played, then the status sat at "working" forever, and Claude Code never heard DONE. The final film renders through a queue, one at a time, because our server has 2 GB of RAM. The queue is a promise chain in `router/edit.ts`:

```ts
const job = Promise.all([graded, directed])
  .then(() => filmQueue)                 // read later, when .then runs
  .then(() => renderMasteryFilm(dir, file));
filmQueue = job.catch(() => undefined);  // ...but replaced right now
```

The arrow function reads `filmQueue` only when it runs. By then `filmQueue` already points at `job`. So the job waits for itself. No error, no timeout, no log line. The fix is to read the old queue first:

```ts
const prev = filmQueue;
const job = Promise.all([graded, directed]).then(() => prev).then(() => renderMasteryFilm(dir, file));
```

It came with a test (`film-queue.test.ts`) so it cannot come back quietly. After the fix, the same Edit reached DONE in 352 s.

### 2. Press Stop, and Claude Code never hears DONE again
**Sun 18 Oct, 13:17 IST** · [`1a9493d`](https://github.com/Ishaan-Gpt/moovi/commit/1a9493d266a1de4c95e6291a08f80319c11e4af0)

A Stop on the website ended the run in the engine, but nobody told the MCP job board. It kept the job as "running" for 24 hours, so every later video for that user looked busy. Now the board settles a running job from the engine's own `Run.status`, read from the graph. The same commit fixed a second bug: for a user with no API key, every model tier was the literal string `'server'`, and that string went to the provider as a model id. The Launch writer got a 404 for a model called "server".

### 3. A brand new FalkorDB broke the first edit
**Sun 18 Oct, 00:08 IST** · [`55e6c50`](https://github.com/Ishaan-Gpt/moovi/commit/55e6c50acc36d41764da7893f6bc81d971e395da)

On a fresh database, the first edit failed with `ERR Invalid graph operation on empty key`. A read only query on a graph that does not exist yet is an error in FalkorDB, while the same read as a normal query just returns no rows. We now treat that one case as "no rows". A real outage is still "Moovi's memory is offline".

### 4. Hindi captions: 72.92% to 89.41% words right
**Fri 16 Oct, 22:40 IST** · [`d21fd0f`](https://github.com/Ishaan-Gpt/moovi/commit/d21fd0f19dac0f7bf260c1a2466238f2a91ded78)

Our test clip in Hindi kept failing the caption gate. The cause was one helper that made a "bare" key for each word by stripping every combining mark. In Devanagari that removes the vowel signs, so "है", "हैं" and "हूँ" all became the same key, and the aligner anchored captions on the wrong words. The new key keeps the marks and only folds the spellings Hindi writes two ways. We also found our reference subtitle had 192 words for the real 171. Words right went from 72.92% to 89.41%, and the gate passed.

### 5. Every scene was big text
**Fri 16 Oct, 04:32 IST** · [`01fabe5`](https://github.com/Ishaan-Gpt/moovi/commit/01fabe522e157ebef16e38fabab4da25a01c09db)

Looking at a contact sheet of a whole film, almost every scene was a giant word and nothing else. Two regexes in the planner had lost their backslashes: `/s+/` instead of `/\s+/`. It split sentences on the letter "s", so every line counted as "short", and short lines become big type. We only saw it because we looked at the frames, not the logs.

### 6. The same query, a stricter FalkorDB
**Fri 16 Oct, 02:06 IST** · [`0ba231a`](https://github.com/Ishaan-Gpt/moovi/commit/0ba231a970ab64ae71f65b3f42b741e904cc052f)

The first full test film stopped at the review step with `ORDER BY cannot reference variables not projected or grouped in this scope`. The query sorted by `c.at` after a `collect()`. Newer FalkorDB is stricter about that. We now return the field and sort by its projected name, which runs on FalkorDB 4.x and 6.x alike.

### 7. Two Claude Code windows, one video
**Sun 18 Oct, 03:35 IST** · [`da8dc75`](https://github.com/Ishaan-Gpt/moovi/commit/da8dc75d6bf549610af7fcba155ed235eb224664)

Open the setup prompt in two Claude Code windows and the second one used to stop. Now it waits, and takes the video over if the first window's lease runs out.

### 8. Everything on a 2 GB server
**Sun 18 Oct, 03:07 IST** · [`89b2da9`](https://github.com/Ishaan-Gpt/moovi/commit/89b2da95d2f152ec65ee867bca1985c86624fba2)

The studio, the worker, FalkorDB, Chromium and ffmpeg all share one small cloud server. The fix was a pile of small ones: swap only when needed, the small speech model, one video at a time under 3.5 GB, a capped build heap, and the worker stopped during builds. That one-film-at-a-time rule is why the queue in bug 1 exists at all.

### 9. Claude Code refused to run our setup
**Sun 18 Oct, 15:30 IST** · [`a66b5c1`](https://github.com/Ishaan-Gpt/moovi/commit/a66b5c1f481da1d0590298b0477c27edfeaeb591) · **16:10 IST** · [`d2abfe3`](https://github.com/Ishaan-Gpt/moovi/commit/d2abfe364378b1e3c73a3246f2f7e61306faf552)

Our first setup was one pasted prompt that downloaded a script and ran it (`curl ... | sh`, or `irm ... | iex` on Windows). Claude Code's permission check blocked it, because it runs code fetched from outside the session. We spelled out plain commands instead. Then Claude Code refused again: a prompt that has Claude Code start a background Claude Code of its own was flagged as "Create Unsafe Agents". Both times it was Claude Code being right. The fix was to stop asking it to do the risky part: setup became the two `!` commands above, which you run yourself.

### 10. "Connected", but the video never reached Claude Code
**Sun 18 Oct, 17:28 to 17:47 IST (live test) · fixed 18:08 IST** · [`20e4bec`](https://github.com/Ishaan-Gpt/moovi/commit/20e4bec7d127ea7ab3bb1de2315565ce2df60803) · merged [`4a26683`](https://github.com/Ishaan-Gpt/moovi/commit/4a266835c48ceb2e4e403b9086f4fc9c76d6257f)

This one happened to me on Windows, a few hours before the deadline. I ran both commands, uploaded a clip, and the studio sat at "Editor planning the cuts" for over 5 minutes. The setup status said "connected; waiting for a video". The local log had nothing in it after the background session started.

![Claude Code printing the setup status: Moovi is connected and idle, connected; waiting for a video, and the log is empty](https://moovi-blog-preview.sites.tab.bot/img/err-status-connected.jpg)
*Real photo of my screen, 18 Oct about 17:40 IST: the status says connected, the log is empty, the video is not moving.*

![Claude Code saying it still has not received the video while the server status says working on your video](https://moovi-blog-preview.sites.tab.bot/img/err-not-received.jpg)
*Same test about 40 minutes in: the server says it is working on the video, Claude Code says it never got it.*

![Claude Code reporting nothing has changed: still connected and waiting, the background session never received a video job](https://moovi-blog-preview.sites.tab.bot/img/err-still-same.jpg)
*Claude Code's own summary: still connected and waiting, no video job ever arrived.*

Three things were wrong at once, and the commit fixes all three:

- **The status lied.** It said "connected" if the background Claude Code had called Moovi even once. Now it says connected only while it is really calling; otherwise "quiet for N s", then "FAILED: stopped calling Moovi, run command 2 again".
- **An early video was skipped.** My clip was uploaded before command 2, and only videos started after the setup were offered to Claude Code. Now a running video, whenever it started, is offered to the starting Claude Code first for up to 2 minutes, then falls back to the server so nothing hangs.
- **The tools were gated behind a slash command.** Claude Code told me the Moovi tools were "set to run only after you type /mcp_moovi_run", so it never called them. We removed that wording from everything Claude Code reads. We also stopped telling an idle session it could stop after 2 minutes; that is our best guess for why it went quiet, not a proven cause.

8 new tests cover it (`test/pending-jobs.test.ts`), and the worker log now prints one line per brain decision with the brain that took it.

### 11. Windows could not find localhost
**Sun 18 Oct, 13:26 IST** · [`02b5c27`](https://github.com/Ishaan-Gpt/moovi/commit/02b5c27195ce8dfc09a4b93bd52fff2141d2f948)

The bridge printed `localhost` but listened only on `127.0.0.1`. Windows (and Node 17+) try the IPv6 `::1` first, so the connection failed. The bridge now also listens on `::1`. The same commit fixed a video that failed in 0.4 s: it started and ended between two looks, so Claude Code never saw it and gave up silently.

### 12. "Moovi's memory is offline" on purpose
**Sat 17 Oct, 21:25 IST** · [`3e1bae9`](https://github.com/Ishaan-Gpt/moovi/commit/3e1bae94cccfc6f57c9f332c52d34095a84bc5fa)

Not a crash, a choice. About 63 places in the engine had a quiet fallback that made a plainer film when FalkorDB was down. That hid real graph bugs. We made FalkorDB required on the product path: if it is down, the job stops and the chat says "Moovi's memory is offline". The fallbacks now run only in tests and local dev, behind `MOOVI_GRAPH_OPTIONAL=1`.

### 13. Sign in on a brand new server failed
**Thu 15 Oct, 22:20 IST** · [`a20a3da`](https://github.com/Ishaan-Gpt/moovi/commit/a20a3daf9a365a40192313a2b1e09e86b493ac5c)

Our first deploy to a clean server could not sign anyone in. Accounts live in the `sys` graph, and on a fresh FalkorDB that graph does not exist until the first sign up. Sign in read from it first, and the read failed. The fix is one line, `await ensureSys()` before the lookup, plus a one shot `seed` service in `docker-compose.yml` that builds the shared graphs on every deploy. Bug 3 is the same lesson, met again two days later: in FalkorDB, a graph you never wrote to is not empty, it is missing.

### 14. Captions that skipped words
**Fri 16 Oct, 19:51 IST** · [`b17d224`](https://github.com/Ishaan-Gpt/moovi/commit/b17d22487563a7ee1addbbd5b65b0b14a9aea286)

A caption read "it will your in 5 minutes". The words "edit" and "videos" were heard right, but the speech step gave them no length: their start and end time were the same. Our edit list dropped every zero length word, so they vanished. Now a run of such words and its two neighbours share the time around them, split by letter count, before anything is filtered. A test (`edit-zero-words.test.ts`) keeps it fixed.

### 15. The MP4 lost its punch ins and its end card
**Fri 16 Oct, 19:42 IST** · [`22b0b5d`](https://github.com/Ishaan-Gpt/moovi/commit/22b0b5d26866ff81da96f838f4f07161e3f80e3e)

Three render bugs in one sample. First, ffmpeg's scale filter keeps its first size, so a 1.35x punch in mid shot was drawn at 1x and shifted 408 px up over a black band. We now split each shot into runs of one size. Second, the black logo end card was a fully opaque frame, it came out as rgb24 among rgba PNGs, ffmpeg rebuilt its graph on that change and lost 39 frames: the film stopped 1.3 s before the voice and the end card never showed. `-reinit_filter 0` fixed it. Third, every run is now padded to its exact frame count, so the final film has exactly N frames.

### 16. A phone video edited sideways
**Sun 18 Oct, 08:02 IST** · [`90a8c66`](https://github.com/Ishaan-Gpt/moovi/commit/90a8c66ebd5887b3892e5acfeb823f9c1f8c022d)

Phones often store a video portrait and add a 90 degree rotation flag. ffmpeg plays it the right way, but our probe read the stored size, so the edit framed a landscape clip as portrait. The probe now reads the rotation flag and reports the size you actually see.

### 17. The chat promised a Whip Spin the video did not have
**Sun 18 Oct, 00:03 IST** · [`85fd0fd`](https://github.com/Ishaan-Gpt/moovi/commit/85fd0fd927e3f892520d873b4b5981a7f649aba8)

In a live run the chat announced a Whip Spin transition, and the finished video had none. The picker put the transition in the longest pause, but another effect was on screen at that moment, and the render drops a transition under an effect. Now the transition goes in the longest pause that is clear of every overlay, and a test checks that no transition ever sits under one.

### Early render vs current render

Same FalkorDB ad prompt, two builds of our agent branch, 16 October. Left: the build at 2:14 AM, before that night's fixes. Right: the build after the second round of fixes.

![Contact sheet of the early render, before fixes](https://moovi-blog-preview.sites.tab.bot/img/render-before-fixes-falkordb-sheet.jpg)
*Early render (16 Oct, 2:14 AM build, before fixes). We scored it 4.5 out of 10 ourselves.*

![Contact sheet of the later render, after the second round of fixes](https://moovi-blog-preview.sites.tab.bot/img/render-fixes-falkordb-round2-sheet.jpg)
*Same prompt after the second round of fixes the same night.*

![QA frames from an early render where the panels came out blank](https://moovi-blog-preview.sites.tab.bot/img/blank-panels-w1-top-w3-bottom-f190-390-450.jpg)
*From our own QA of an early render on 16 October: panels that should hold content came out blank.*

[Watch the two renders side by side (8 seconds, early on the left, later on the right)](https://moovi-blog-preview.sites.tab.bot/img/early-vs-later.mp4)

Smaller ones I still remember: an edit with no speech key came back with 0 words captioned until we added local Whisper in Node ([`9e0b66e`](https://github.com/Ishaan-Gpt/moovi/commit/9e0b66e3c9021257bb6de23452cbe46ed18f112e)), and 5 of 11 shots in one render started on a black frame until a `setpts` fix ([`e806e4d`](https://github.com/Ishaan-Gpt/moovi/commit/e806e4d16217f8c73ce4597507a68f2a07b90f42)). That same commit moved face detection from Python to Node (its boxes match OpenCV within 0.3 px), so the effects step no longer needs Python, which was one of the things that broke on my Windows laptop.

## The calls we made on the last morning

Not everything was a bug. Some of the most useful commits were decisions, written down on our agent board (`docs/agents/DECISIONS.md`) before anyone wrote code:

- **Decision 13, FalkorDB is required** ([`ef95004`](https://github.com/Ishaan-Gpt/moovi/commit/ef950041a1a289a1a82b2f6b584558660e344b19)). Covered above. It cost us a night and made the product honest.
- **Decision 18, replace, don't merge** ([`744a4fc`](https://github.com/Ishaan-Gpt/moovi/commit/744a4fcc5a414030979f1afd0b3ab8c1f3963370)). When a preset gets a better pipeline, the new one replaces the old one. No blending with old looks, and no silent fallback to the old path.
- **Decision 19, three presets** ([`492ec6a`](https://github.com/Ishaan-Gpt/moovi/commit/492ec6acc8600811b8db4f985f58780b48ffe9db), built in [`19ccdb1`](https://github.com/Ishaan-Gpt/moovi/commit/19ccdb107c6472c5bf83c076bbebbb4060d42b6a) and [`6dcec5e`](https://github.com/Ishaan-Gpt/moovi/commit/6dcec5e38260a8a8c330630d37485d241b0e8395)). We had many styles and a generic prompt box. On Sunday morning we cut it to Edit, Launch video and Showreel, and the first screen became that choice. Every preset still casts from the whole craft graph.

## How we worked

We worked with several AI agents on one board: tasks, decisions and notes in `docs/agents`, one file per agent. Claude Code co-wrote many of our commits (each has a `Co-Authored-By` line), and `AI_USAGE.md` in the repo lists what the AI did and what we did, as the rules ask.

## What I would tell you

- **Put the "why" in the graph on day one.** Once every decision had `BECAUSE` edges, debugging a bad edit became a query instead of a guess.
- **Fail loudly.** "Moovi's memory is offline" beats a film made from the wrong list.
- **Give every agent loop an end state.** DONE, FAILED or IDLE. A loop that can only say "working" will one day say it forever.
- **Look at the frames.** Bug 5 was invisible in the logs and obvious on a contact sheet.
- **Test on the machine your users have.** Half our bugs only lived on Windows, on a fresh database, or with no API key.

## Things it does not do yet

- The "why" path is answered in the studio chat ("why this caption?"), but there is no visual graph view of it yet.
- In the Launch video preset, the writing step still runs on the server model even when Claude Code is linked.
- The end to end runs in the MCP section used a scripted MCP client in place of Claude Code. My live test with real Claude Code on Windows is bug 10: it found that bug, and the fix went live on our server the same evening. A full rerun of that live test after the fix is not in this post.

## Team

- **Vignesh B S** ([GitHub](https://github.com/vigneshbs33)): AI side, FalkorDB memory, the Claude Code bridge.
- **Ishaan** ([GitHub](https://github.com/Ishaan-Gpt)): the studio, the landing page and the product.
- **Keshav Kumar Agarwal**
- **Srujan N Hiremath**

One graph remembers everything.

Try it: https://moovi-three.vercel.app · Code: https://github.com/Ishaan-Gpt/moovi

Thanks to WeMakeDevs and [FalkorDB](https://www.falkordb.com) for running [Graph Hacks](https://www.wemakedevs.org/hackathons/falkordb).
