# Moovi demo film: beat skeleton (draft 1, for Ishaan's script)

Ishaan's plan (2026-10-18): a cinematic film covering the problem, the solution, what Moovi is, the technical side,
both tracks with proof, the graph as the core (live data, Cypher, algorithms, the disconnect), the one pipeline, the
decision tree and the library. Each beat gets its own reference reel (Instagram/YouTube). It's built first with the
drawn character, then Ishaan shoots the same shots and his clips replace the stand-ins. The website demo runs in a
corner (picture-in-picture) while he explains.

The words are Ishaan's. This file only fixes the order, the time and the proof that must be on screen.
16:9, 1080p, target **about 3:00**.

| # | Beat | Time | What it must prove on screen (real, not drawn) | Reference grammar (suggested) |
|---|---|---|---|---|
| 0 | Cold open | 0:00–0:08 | a real Moovi film playing; the name "Moovi" lands by second 3 | D1.1 card sphere: Moovi's real films orbit Ishaan |
| 1 | Problem | 0:08–0:25 | an edit is hundreds of small decisions; AI editors are black boxes that forget you | D1.2 words standing in depth as the camera flies past |
| 2 | What Moovi is | 0:25–0:45 | "an AI video employee you hire": 3 presets (Edit, Launch video, Showreel), the 8-agent crew at their desks in the 3D office | D1.3 dive into a film card → into the website |
| 3 | Live demo | 0:45–1:15 | landing → preset → upload with the part picker → crew working → live preview → change by chat (website in the corner, full screen on the key moments) | picture-in-picture over Ishaan talking; need a ref |
| 4 | The two tracks | 1:15–1:30 | Track 01 (agents act on connected data, explainable results) and Track 02 (memory per user, shared state between the crew), each named and mapped to a Moovi feature | R4 type cards in a selection box; need a ref |
| 5 | The graph is the core | 1:30–2:05 | 4 graphs on one FalkorDB (`craft`, `sys`, `user_<uid>`, `proj_<pid>`); 248 named Cypher queries; the library (~950 assets, 2151 craft nodes on the server); **live data**: nodes and edges appear as a film is made (Decision → BECAUSE → Feedback); the `whyThis` shortest-path query on screen; `algo.pageRank` and `algo.SPpaths` | need a ref (a data-flow / node-graph reel) |
| 6 | Pull the plug | 2:05–2:20 | `docker stop falkordb` → the job stops with "Moovi's memory is offline"; start it → it carries on (decision 13) | D1.6 negative flash on the cut |
| 7 | One pipeline, the decision tree | 2:20–2:40 | `docs/PIPELINE.html`: the brain choice (Claude Code over MCP, or your own key), preset, type, look, cast from the library, the ishaan-motion skill read at run time | need a ref |
| 8 | Breadth + CTA | 2:40–3:00 | films montage (Edit, Launch for Resend and Linear, Showreel themes); any model, your key or Claude Code; live link, repo, Graph Hacks × FalkorDB | D1.7 tall words behind the head |

## Open questions for Ishaan

1. **Your script:** paste it (rough is fine) and I'll fit it to these beats with timings.
2. **One reference per beat:** beats 3, 4, 5 and 7 have none yet. Send links, or say "suggest" and I'll find 2 options each.
3. **Live graph view (beat 5):** the studio has no graph view today. Options: (a) record the FalkorDB Browser while a film
   runs, (b) build a motion-graphics graph driven by the real query log (every query is already timed and tagged with
   the agent that ran it), (c) both: (b) in the film, (a) as a 2-second proof cut.
4. **Voice:** you on camera, with your voice as the narration throughout? (Implied by your plan; confirm.)
5. **Music:** one bed for the whole film, or a change at the graph section? I'll bring 3 product-safe options.
