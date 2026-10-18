# Moovi demo film: script v1 (Ishaan's raw script, refined)

About 3:00, 16:9, Ishaan on camera with his voice throughout (drawn stand-in first, his own shots later), the website
demo in a corner. About 420 spoken words, so the music gets room to breathe. The words are Ishaan's; this version
tightens them and fills the technical middle with facts we can stand behind. `[CHECK]` marks a claim to confirm.

| # | Beat | Time | Spoken (Ishaan) | On screen (proof) |
|---|---|---|---|---|
| 1 | Hook | 0:00–0:12 | **"Building a SaaS is dead in 2026."** … "Not the product. The product is a commodity now. Building it is twenty percent. The other eighty is getting it seen, and that means content. Most founders can't make it. Or just don't want to." | a Moovi film behind him; the name "Moovi" lands by 0:03 |
| 2 | The wave | 0:12–0:30 | "We had AI video generators. Now there's a new wave: videos written in code. Every frame is code, every cut is a decision you can read. After vibe coding comes **vibe editing**. And we're riding it." | code turning into a frame |
| 3 | Meet Moovi | 0:30–0:50 | "This is Moovi, your video production team. A director, Moovi, and a crew of seven agents: Editor, Researcher, Writer, Sound, Designer, Lens and Keeper. Three presets. A **Launch video** to start your brand. A **Showreel** to promote it. And **Edit**, when you want to show your face, cut like a professional editor would." | the 8 desks in the 3D office; the 3 preset cards |
| 4 | Demo | 0:50–1:20 | "Pick a preset. Drop your clip, and choose the part you want edited. Now watch the crew work, each at its own desk. You get a live preview, not a slow render: captions, sound, motion. Don't like something? Just say it. *Make the captions bigger.*" | website in the corner, full screen on upload, the office, the preview, the chat edit |
| 5 | The graph is the core | 1:20–2:05 | "Moovi's memory is FalkorDB. Not a side database: the core. Four graphs on one instance: the craft library, accounts, one graph per user, one per project. Every read is one of **248 named Cypher queries**, tagged with the agent that ran it. As a film is made, watch it write: every decision, time-stamped, linked *because* to the rule or the feedback behind it. So the graph remembers what you said, and when. So when you ask *why these captions?*, Moovi answers with a **shortest path**, from the decision back to what you told it two videos ago. **PageRank** finds what a style leans on too much; **shortest paths** plan the crew's route. That's **Track 1**: agents that act on connected data and explain themselves. And **Track 2**: memory per user, shared by the whole crew." | the live graph (nodes and edges appearing as a film runs), the `whyThis` query, the path lighting up, `algo.pageRank` / `algo.SPpaths`, both track names |
| 6 | Pull the plug | 2:05–2:20 | "Still think the graph is optional? Let's stop it." … "Moovi stops. *Moovi's memory is offline.* No silent fallback. Start it again, and Moovi's back." `[CHECK: does a stopped job resume, or start again?]` | `docker stop falkordb` in a terminal; the studio's offline message; `docker start` |
| 7 | The harness | 2:20–2:38 | "Under the hood, Moovi is an **agent harness**: the loop, the tools, the checks and the memory around the model. Bring one key, and it uses three of that provider's models: a director model plans, a crew model writes, a fast model takes the small calls. Or connect Claude Code over MCP: about four thousand tokens a video. A launch video previews in under thirty seconds. Less cost. Less time." | the harness as a diagram (loop, tools, checks, graph memory); the 3 model tiers for the user's key; the Use Claude Code card; a timer on a launch preview |
| 8 | Taste | 2:38–2:54 | "So how are we different? We go deep on the one thing that matters most right now: **taste**. An ever-growing library in the graph: captions, effects, music beds, voices, camera moves, clips, about **950 pieces**. We feed it references, and it breaks them into fundamentals. One global skill, a skill per style, both getting sharper with every reference." | the library nodes; a reference breaking into its parts; the skill tree |
| 9 | CTA | 2:54–3:02 | "Moovi. Your video production team. Built on FalkorDB." | live link, repo, Graph Hacks × FalkorDB |

## Ishaan's additions (round 2), and what backs them
- **Cost and time:** measured, not guessed. Claude Code over MCP used about 3,800 tokens in and 250 out per video
  (docs/agents/claude-code-bridge/MEASURE.md). The Launch preset previewed linear.app in 19.7–27.4 s on Groq (mastery log).
- **Agent harness:** the scaffolding around a model that makes it an agent: the loop, the tools, state and memory,
  checks and retries. Moovi has all of it: the crew's lanes, the tools, repair turns and the fallback to the other tier
  (docs/MODELS.md), the task board and memory in FalkorDB, and Lens checking every film. So the claim is true.
- **"Temporal graph":** decisions, feedback and films carry a time (, ), and  reads the latest.
  That makes the graph time-aware, but it isn't a temporal graph in the strict sense (facts with valid-from/valid-to
  that the database queries by time). Options:
  (1) the safe line in beat 5: "every decision, time-stamped… the graph remembers what you said, and when";
  (2) "Moovi is an agent harness on a temporal graph." It sounds bigger, but a FalkorDB judge may push back on it.
- **All the models:** real. Each key gets three tiers (director / crew / fast), picked from the models that key can use.

## Hook options (pick one)
- **A** "Building a SaaS is dead in 2026." (yours: the boldest, needs the "not the product" turn right after)
- **B** "In 2026, anyone can build the product. Almost nobody can get it seen."
- **C** "Your product isn't the problem. Your content is."

## What changed from the raw script, and why
- "Hicksfield" → "AI video generators": naming a company invites a comparison we don't need, and it's an ad for them.
- The middle ("here I will show the website, the technicalities, the graph") is written out with real numbers:
  4 graphs, 248 named queries, ~950 library assets, `whyThis`, `algo.pageRank`, `algo.SPpaths`, decision 13.
- Both tracks are named out loud, since you asked to prove the alignment explicitly.
- "skills improving with time" → "sharper with every reference": the skill improves through references and mastery
  rounds, not on its own after each film.
- "MCP for video maxing" is dropped: it reads as slang to judges. Your call if you want it back.
