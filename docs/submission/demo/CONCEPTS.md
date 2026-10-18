# Moovi demo film: research and concepts

Step 1 and 2 of the demo plan. Ishaan picks one concept; the script and storyboard follow from it.

## What the rules ask (checked 2026-10-18, 09:40 IST)

- Rule 10 (wemakedevs.org/hackathons/falkordb/rules): every submission includes "a demo video showing the working
  project", plus the public repo, a README with the graph data model, the Cypher queries, a live deployment and the track.
- **No length limit and no host named.** No judging criteria or weights are published; the only judged thing is
  "the original work completed during the hackathon".
- FalkorDB "must be the primary graph database, and it must support a central part of the product".
- Tracks: 01 Agents That Act on Connected Data (multi-hop, graph queries as agent tools, MCP, **explainable results**);
  02 Agent Memory and Coordination (memory per user, shared state and handoffs). Moovi fits both.
- So the film's job: in the first seconds, a real working product; then proof the graph is the core (a query, a path,
  the outage), in a length judges watch to the end. **Target 2:20–2:40.** YouTube (unlisted is fine), 1080p 16:9.
  A vertical cut is not required; optional 45 s teaser for socials if time allows.

## What judges must see (the must-show list)

1. The working product, live: landing → pick a preset → upload with the part picker → the 3D office with the crew at
   work → a live preview playing → a chat edit.
2. The 3 presets: Edit, Launch video, Showreel, each with a real film Moovi made (Edit lab vlog / v10, Launch v14 and
   v15, Showreel v3–v5).
3. The 8-agent crew: Moovi, Editor, Researcher, Writer, Sound, Designer, Lens, Keeper.
4. FalkorDB load-bearing: accounts, the task board, style memory, the craft graph (~950 assets, 2151 nodes seeded on the
   server), feedback memory, **"Why this edit?"** (the `whyThis` shortest path from a decision back to the user's words),
   and **the graph-stopped moment** (decision 13: "Moovi's memory is offline").
5. Claude Code as the brain over MCP (`moovi_next` / `moovi_answer`, 1–3 calls a film), and any model with your own key.

## Three concepts

### A. "Every cut has a reason" (2:30) — recommended
**One line:** a finished Moovi edit freezes on a caption and asks "why this?", and the film answers by walking the
FalkorDB path back to the user's own words.

| Beat | Time | What happens |
|---|---|---|
| Hook | 0:00–0:08 | A real Moovi edit plays full frame, cut on the beat. It freezes on one caption. Type: "Why this caption?" Moovi's name lands by second 3 (the owner's rule: a promo is about the brand and understood by second 3). |
| Problem | 0:08–0:22 | AI video tools are black boxes that forget you: every video starts from zero, nobody can say why a cut happened. Short kinetic type over a cold, empty timeline. |
| Solution | 0:22–1:20 | The real studio: three presets, upload with the part picker, the 3D office with 8 desks lighting up, the live preview, a chat edit ("make the captions bigger"). Each crew member's line pops as they work. Claude Code connected over MCP; or any key. |
| Climax | 1:20–1:55 | We ask "why this caption?" and dive into the graph: the `whyThis` path lights node by node, Decision → Rule → Feedback ("too small last time", two videos ago). Then we stop FalkorDB live: the job halts, "Moovi's memory is offline". Restart, it carries on. That is load-bearing, shown, not said. |
| Breadth | 1:55–2:15 | Proof montage on the beat: Edit, Launch (Resend, Linear), Showreel themes, each tagged with the graph nodes it cast (a sound, a caption look, a camera move). |
| CTA | 2:15–2:30 | "Moovi. The video editor that remembers why." Live link, repo, Graph Hacks × FalkorDB. |

**Why it wins:** the graph is the climax, not a slide. It lands Track 01's "explainable results" and Track 02's memory
in one moment, and the outage proves FalkorDB is central the way Rule 3 asks. The hook is a real film, so the first
frame already shows a working product.

### B. "Hire Moovi" (2:45)
**One line:** Moovi is framed as an employee: the job ad, day one, day two, and the day its memory is unplugged.

Hook: a job post types itself ("Wanted: video editor. Remembers your taste. Never sleeps.") and Moovi, the 3D Director,
answers. Day one: three tasks (Edit, Launch, Showreel), the crew at their desks; the user's feedback ("hated that
voice") is written into the graph. Day two: Moovi remembers (the voice is never cast again, shown as the graph rule).
Climax: we pull its memory (FalkorDB stopped): "my memory is offline", the employee stops working. Back on. CTA: "Hire
Moovi."

**Why it wins:** the most memorable story, character-led, and it matches the product line "an AI video employee you
hire". **Cost:** more drawn animation of the character (pure-code WebGL, no GLB), so more build time; the why-path is
shown more briefly.

### C. "Edited by the product it's about" (2:00)
**One line:** the demo film is assembled on screen, and every element carries a live tag tracing it to the graph node
that cast it.

Hook: "This video was edited by Moovi." A split frame: the film on the left, the craft graph on the right; as each beat
plays, the sound, caption look, camera move and transition that Moovi cast light up as `(:Asset)` nodes with their
SUITS and SERVES edges. Midway the user gives feedback and the next beat changes, with the new `(:Feedback)` node in the
graph. Climax: the outage. CTA.

**Why it wins:** clever and self-proving, shortest. **Risk:** it is only honest if Moovi really cast those beats. We can
make it true by building the opening around Showreel v3 (made by Moovi for moovi-three.vercel.app, Ishaan: "cool") and
reading its real `film.json` picks, but the full film cannot be Moovi-made by tonight.

## Options Ishaan picks after the concept (no silent defaults)

- **Voice:** (1) Ishaan's own voice over (real experience, the strongest for judges); (2) a cast TTS voice from the voice
  library (Kokoro or Edge); (3) no voice, kinetic type and captions only, on music.
- **Pacing:** (1) calm-to-drop (quiet first 20 s, music lifts on the studio reveal, drop on the graph dive);
  (2) fast throughout, cut every beat (a hype trailer).
- **Music:** two or three product-safe beds from the Mixkit menu Launch uses (licence gate in `audio/music-lib.ts`),
  measured for tempo, played as options.
- **Colour:** Moovi brand icy white `#F7FAFD` and ice blue `#CFE6F7` as the mark, the world around it built from the
  subject; two palettes proposed with frames at the storyboard step.

## Capture: what needs Ishaan

The studio is behind sign-in. Either Ishaan screen-records the flows on his account (I send a shot list with exact
clicks), or I run the studio on localhost with a test account and record it there (the graph-stopped moment is safest
locally: `docker stop` on a local FalkorDB, never the server).

## Timeline (IST)

- 10:30 concept picked → 12:00 script + storyboard approved → 14:00 captures done → 17:00 first full cut (preview with
  sound) → 20:00 cut approved → polish → 22:00 final MP4 1080p, title, description, credits → submit before 23:00.
