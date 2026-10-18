# Moovi: Graph Hacks submission blog

This file has three parts:

1. What judges look for (a checklist to tick before you publish).
2. Patterns from past winners (with sources).
3. The Dev.to draft, ready to paste. Fill every `[PLACEHOLDER]` and resolve every `[CHECK]` before publishing.

Deadline: submissions close **18 October 2026, 11:59 PM IST**. The blog is its own side prize ("Best blog post", AirPods 5) and it also helps the track entry.

---

## 1. What judges look for (tick before publishing)

From the Graph Hacks page (wemakedevs.org/hackathons/falkordb) and the WeMakeDevs blog guide used at their last hackathon:

- [ ] **FalkorDB is load bearing.** The rules say FalkorDB "must be the primary graph database, and it must support a central part of the product", and "the graph has to shape what the agent does, not sit on the side". The post must show this with a real query, not a sentence.
- [ ] **Show the path behind an answer.** The brief asks for agents that "can show how it got to each answer". Our "Why this edit?" query is exactly that. Show it.
- [ ] **Written from real experience.** The guide's one rule: "Write from real experience". Specific numbers, real errors, real fixes. No generic intro about AI.
- [ ] **The part where it broke.** The winning blog at the last WeMakeDevs hackathon won because it "does not skip the part where things broke". Our "Challenges" section is the heart of the post.
- [ ] **Narrow title with a hook.** The guide: "Narrow beats broad". Put a number or a surprise in the title.
- [ ] **Hook in the first 2 to 3 sentences**, then context, then the work (code, queries, screenshots), then what we learned, then a one line wrap up.
- [ ] **1000 to 1500 words.** The draft below is about 1500 words with code, before media.
- [ ] **Screenshots and a demo video**, not a wall of text. At least: the studio preset screen, the finished edit, a FalkorDB Browser view of a `whyThis` path, the Claude Code card.
- [ ] **Every command and number was really run.** Only claims we can stand behind. "Worked on our setup" is fine.
- [ ] **Not an ad, not raw AI text.** The guide lists "obviously AI-generated filler" as a reason a post is not meaningful.
- [ ] **Published on Dev.to** (not LinkedIn), with tags, cover image, repo and live link, and the link pasted into the submission form.
- [ ] **Track named** in the post. `[CHECK]` which track(s) we entered: Track 02 (Agent Memory and Coordination) fits best (memory per user and project, feedback that becomes rules, shared state between the crew); Track 01 also fits (graph queries and algorithms as agent tools, explainable results).

---

## 2. Patterns from past winners

Graph Hacks results are not out yet (it ends tonight), so these come from the closest past winners: the last WeMakeDevs blog prize, FalkorDB's own write up of the projects it rated highest, and DEV's hackathon writing winners.

1. **Honest, reproducible, "here is where it broke".** The pre event blog winner at WeMakeDevs' Agents of SigNoz hackathon, "How I self-hosted SigNoz on AWS EC2 to monitor Claude, one sneaky IP timeout", won for being an "honest, reproducible, start-to-finish account" that "does not skip the part where things broke". Note the title: specific, with the bug in it.
   Source: https://archive.wemakedevs.org/hackathons/signoz/projects/blogs and the guide at https://archive.wemakedevs.org/hackathons/signoz/blog-guide
2. **Explain the graph-native move: what a table or a vector search cannot do.** FalkorDB's recap of the Memory Meets Motion hackathon (Aug 2026) praised the 1st place project, Atrium, because its "cleverest move is graph-native": grouping students by the wrong mental model, "a two-hop Cypher traversal that a flat table or a vector search simply cannot express". Every project there is described as one sharp idea plus exactly what FalkorDB stores.
   Source: https://www.falkordb.com/blog/memory-meets-motion-the-falkordb-standouts/
3. **Start from a personal frustration, end with lessons.** DEV's World's Largest Hackathon writing winners were praised for "solving personal frustrations through building" and for "the lessons learned, and the human side". Short (3 to 6 minute reads), story first, product second.
   Source: https://dev.to/devteam/congrats-to-the-worlds-largest-hackathon-writing-challenge-winners-4fa3

Shared structure across them: a hook with a number, the problem in a few lines, a demo (gif or video), an architecture picture, exactly how the graph DB is used (with a query), challenges with real errors, what is next, links.

Other Graph Hacks posts already on Dev.to (competitors, for tone, not winners): "AgentMesh: Giving AI Agents Persistent Memory with FalkorDB", "Why I put my agent's memory in a graph", "Recall Desk: three AI support agents that share one memory". Most of them are about memory for chat agents. Our angle (a video editor whose taste and decisions live in a graph) is different; lean on it.

---

## 3. The Dev.to draft (paste from here)

Suggested title (pick one):
- **Every cut has a reason: we gave our AI video editor a graph memory with FalkorDB**
- **Our AI video editor captioned 0 words on its first real edit. Here is what we fixed in 4 days with FalkorDB and Claude Code**

Tags: `#falkordb` `#ai` `#hackathon` `#graphdatabase`
Cover image: `[SCREENSHOT: finished edit next to the FalkorDB Browser why path]`

---

*This is our submission for Graph Hacks: Context for AI Agents (WeMakeDevs x FalkorDB), track `[CHECK: track name]`.*

The first time Vignesh ran a real talking head clip through Moovi with no API key, it came back as "16.5 s from 19.0 s, 11 shots, 0 words captioned". The cuts were there. The captions were not. That night we learned more about our own product than in the two days before it.

This post is about Moovi, what FalkorDB does inside it, and the things that broke on the way.

[DEMO VIDEO LINK]

### What Moovi is

Moovi is like Lovable, but for video. You upload a clip, pick one of three presets (**Edit**, **Launch video** or **Showreel**), and get a finished edit back: cut, captioned, with sound and effects. Behind it is a crew of agents (Moovi, Editor, Researcher, Writer, Sound, Designer, Lens and Keeper) that you can watch at work, and it remembers how you like your videos.

- Live: https://moovi-three.vercel.app
- Code: https://github.com/Ishaan-Gpt/moovi

[SCREENSHOT: the three preset cards]

### Why a graph

A video edit is hundreds of small decisions: this caption look, this cut, this sound on this word, this voice. Two questions kept coming back:

1. **What can this video use?** A caption look has to suit the edit style, a sound has to fit an event, a transition has to belong to a family, and an asset from a reference reel should never be reused for the same user.
2. **Why did Moovi do that?** When a user says "why these captions?", the honest answer is a chain: this decision, because of this rule, which was learned from that piece of feedback you gave two videos ago.

Both are questions about connections. In a table they are joins stitched together on every step. In a graph they are one query.

### How FalkorDB is used

FalkorDB is not optional in Moovi. We made it a hard rule (our decision 13): every library read goes through the graph, and if FalkorDB is down, the job stops with **"Moovi's memory is offline"** instead of quietly falling back to a hard coded list. The fallbacks only run in tests and local dev behind a flag.

We keep several graphs on one FalkorDB instance:

- `craft`: the shared library. About 950 assets on 16 October (123 caption looks, 39 transitions, fonts, grades, overlays, end cards, sounds, music) plus references, kits and types. The server seeded 2151 craft nodes on 18 October.
- `sys`: accounts, sessions and the project index.
- `user_<uid>`: one per user, for their own taste and history.
- `proj_<pid>`: one per project, for runs, films, feedback and decisions.

Agents never write Cypher of their own. They call named queries from one library (`packages/graph/src/queries`, documented in `docs/QUERIES.md`), read only queries run as `GRAPH.RO_QUERY`, and every query is timed and attributed to the agent that ran it.

The library shape:

```
(:Asset)-[:SERVES {w}]->(:Need)          what a beat needs: hook, number, list, cta...
(:Asset)-[:FITS]->(:Event)               a sound and the edit event it plays on
(:Asset)-[:SUITS {w}]->(:EditStyle)      how well it suits each edit style
(:Asset)-[:IS_A]->(:Transition)
(:Asset)-[:REPLACED_BY]->(:Asset)        ids never change; old assets are retired, not deleted
(:Reference)-[:HAS_PART {role, at}]->(:Asset)
```

And the part we like most, **"Why this edit?"**. Every decision Moovi makes is stored as a `(:Decision)` with `BECAUSE` edges to its causes: your own words (`:Feedback`), a `:Rule`, a `:Reference` reel or a library `:Asset`. A rule can be `LEARNED_FROM` feedback, an asset can come `FROM` a reference. Then "why this caption?" is a shortest path:

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

(trimmed from `whyThis` in `packages/graph/src/queries/why.ts`; the real one ranks your own words first.)

[SCREENSHOT: FalkorDB Browser showing a whyThis path from a caption decision back to the user's feedback]

We also use graph algorithms as tools: `algo.pageRank` over a user's own sequence of choices to spot what a style leans on too much, and `algo.SPpaths` over the preset lattice for board planning. A content hash per user means the same clip is never reused. Feedback is stored as `(:Feedback)-[:ON_FILM]->(:Film)` and read before the next film, so "you used that voice last time and I hated it" sticks.

### Architecture

[ARCHITECTURE DIAGRAM: export or screenshot from docs/PIPELINE.html]

- **Studio** (Next.js): pick a preset, upload, watch the crew, get the edit. The landing page is on Vercel.
- **Worker** (Node): the engine that hears, cuts, captions, adds sound and effects, and renders. It runs on one AWS server with the studio and FalkorDB 6.0.2 in Docker.
- **Two brains.** With Claude Code connected, Moovi runs in Creative mode and Claude Code is its brain. Without it, your own API key (Gemini, Groq, OpenAI and others) runs a compact version of the same skill. Models only fill slots and pick from lists; casting, layout, timing and checks are deterministic, so a weaker model makes a less sharp film, never a broken one.
- **Mastery sessions.** Taste (looks, captions, motion) is not guessed. Each preset gets its own mastery session that makes an output, gets it judged against references, changes one thing and goes again, aiming at 9.8/10 per type.

**Claude Code as the brain, through MCP.** `packages/mcp` is an MCP server. You open the **Use Claude Code** card in Settings, click **Make my connect command**, paste the command into Claude Code, upload a clip and type `/mcp__moovi__run`. Claude Code then calls `moovi_next` to get a step and `moovi_answer` to answer it. It only makes the top level calls (1 to 3 per video); the server does the rest. We measured about 3,800 tokens in and 250 out per video.

`[CHECK: if the one prompt setup and the studio "Claude Code connected" pill from branch claude-code-bridge are merged and deployed before submission, add one line here: paste one prompt into Claude Code, it connects and edits with no further questions. If not merged, leave it out.]`

[SCREENSHOT: the Use Claude Code card showing "Claude Code connected"]

### Challenges we faced

**1. Zero words captioned.** Vignesh's first no key edit captioned 0 words. The edit job simply skipped the hearing step when there was no speech API key. We added local speech in Node (Whisper through transformers.js, no Python): a 20 s clip is heard in 4.6 s, and a 20 s talking clip with no key now gets 64 words captioned. A clip with no speech at all now says so plainly instead of failing.

**2. A fresh database broke the first run.** On a new, unseeded FalkorDB the first edit failed with `ERR Invalid graph operation on empty key`. A read only query on a graph that does not exist yet errors, while a read write one returns no rows. We now treat that case as "no rows", and a real outage is still "Moovi's memory is offline".

**3. Words cut off at the cuts.** Cuts snapped exactly onto word edges with no air, and one take opened 60 ms into "Hello". We added padding around kept words and a check that every kept word is still heard in full. `[CHECK: this padding was later reverted to the earlier behaviour (commit 9c3eeee) and handed to the Edit mastery session. Say which version is live.]`

**4. Effects that never rendered on Windows.** On Vignesh's Windows PC the effects step needed Python with OpenCV, built `file://` URLs that are invalid for `C:\` paths, and called ffmpeg by bare name. We moved face detection and the person cutout to Node, fixed the paths, and read the ffmpeg location from config.

**5. A 2 GB server.** Everything (studio, worker, FalkorDB, Chromium for rendering, ffmpeg) runs on one EC2 t3.small: 2 vCPU, 2 GB RAM plus 4 GB swap. We estimated one film edit at about 1.8 to 2.0 GB peak (2.24 GB measured on an 8 GB machine with the bigger speech model), so we use the small Whisper base model on the server, free the speech model before rendering, drop scenes that are off screen, and run one render at a time. A deploy also taught us that a running Caddy container keeps the old Caddyfile after a git pull; it has to be recreated.

**6. Who owns taste.** With several agents and people working at once, taste tweaks started landing from sessions that should not set it. We reverted them (9c3eeee) and wrote a rule: each preset's look is set only by its own mastery session. One owner per decision kept the product consistent.

**7. Setup with zero manual steps, on Windows too.** Connecting Claude Code had to be one paste. The setup script had to handle Windows PowerShell 5.1 (which needs TLS 1.2 turned on), user names and paths with spaces, running twice, an expired code, and no curl. The secret token never appears in the output or logs, and the run reports a clear state: DONE, FAILED or IDLE. A background Claude Code that dies is reported as FAILED within seconds instead of hanging. `[CHECK: this one paste setup is on branch claude-code-bridge (e33ca6f); keep this paragraph only if it is merged before submission, and add the real Windows test result.]`

### What we learned

- Put the "why" in the graph from day one. Once every decision had `BECAUSE` edges, debugging a bad edit became a query instead of a guess.
- Failing loudly beats a silent fallback. "Moovi's memory is offline" is a better message than a film made from the wrong list.
- Test on the machine your users have. Half our bugs only existed on Windows or with no API key.

### What is next

- `[CHECK]` Show the "why" path inside the studio, not only in FalkorDB Browser.
- Finish mastery for all three presets.
- `[CHECK]` Anything else you want to promise.

### Team

- **Vignesh B S** ([GitHub](https://github.com/vigneshbs33)): AI/ML, the Claude Code bridge.
- **Ishaan** ([GitHub](https://github.com/Ishaan-Gpt)): UI and product.

Over four days (15 to 18 October) we made 659 commits to main.

Try it: https://moovi-three.vercel.app · Code: https://github.com/Ishaan-Gpt/moovi

Thanks to WeMakeDevs and FalkorDB for running Graph Hacks.
