# Moovi baseline (for the OpenDesign comparison)

Read-only map of `C:\Ishaan GPT\hackthons\moovi` at main 5e76a55, plus the live site, 2026-10-17.
Paths are repo-relative. "Measured" means measured in this session; numbers taken from docs are marked as such.
Raw captures: `scratchpad/moovi-raw/` (index.html, 19 assets, hero.png, studio auth HTML).

---

## (a) Landing site: `apps/landing`

**Stack** (`apps/landing/package.json`): Next.js 16.2.9 (Turbopack), React 19.2.4, GSAP 3.15.0 (+ScrollTrigger,
a masked split helper `splitMasked` in `src/lib/gsap.ts`), Lenis 1.3.25, `@moovi/character` (pure WebGL2 SDF, no GLB),
`@moovi/brand`, `@moovi/ui`. No Motion/Framer and no three.js on the landing. Fonts: Manrope, Fraunces (SOFT/WONK
axes), DM Mono via `next/font` (`src/app/layout.tsx:16-18`).

**Concept:** "the landing page is a short film scrubbed by your scroll" (`src/app/page.tsx:13-17`). One fixed WebGL
canvas (`components/film/WorldStage.tsx`) sits behind every chapter. Chapters never touch the renderer: they tween
`world.scene` keyframes and a DOM-side `ui` object (`src/lib/world.ts:20-29`, `animateScene` around :53). Each chapter
is a tall pinned section with a scrubbed 0..1 timeline (`chapterTimeline`, end of `world.ts`).

**Chrome (layout.tsx:36-45):** an inline intro gate script (skips the intro on repeat visits and for reduced motion);
`Intro` (the halo webp pops in and holds up to 8 s until the shaders compile, `components/motion/Intro.tsx:10`); Lenis
`SmoothScroll` driving ScrollTrigger from the GSAP ticker (`SmoothScroll.tsx`); `Reveals`; `Header` (pill nav
Intro/Crew/How/Memory/Styles/Hire + Sign in); `Timeline` (a timecode scrubber rail on the right edge);
`PageTransition`.

**Sections in order** (`src/app/page.tsx:21-33`, copy in `src/lib/content.ts`), with pinned height:

| # | Chapter | vh | What happens | Copy |
|---|---|---|---|---|
| 1 | Hero (`chapters/Hero.tsx`) | 260 | Moovi (a jelly SDF blob with a ship's-wheel halo) holds the brief box (`PromptBox`) docked under his eyes. His hands are projected onto the box every frame (`WorldStage.tsx:84-105`). The "moovi" letters stream out of his back in jelly. Scrolling drops the box and the camera walks to his face | "Hi. I'm Moovi. I direct videos." Box: "Describe your video, or drop footage…", ratio Auto/16:9/9:16/1:1/4:5, "Suggest a brief" with 4 sample briefs on `.example` brands (content.ts:23-41) |
| 2 | Problem | 340 | Moovi morphs into a screen showing a fake generic generator ("make a 30 second launch video for my café, make it go viral", `final_v7_FINAL.mp4`). The DOM is projected onto the screen quad with matrix3d (`WorldStage.tsx:24-34,107-121`) | "One model. One text box. You type, and hope." then "He doesn't generate. He directs." |
| 3 | Directed | 230 | Big type; hover Moovi and he waves (`WorldStage.tsx:123-128`) | "Directed by AI*", "One director. Five specialists. Zero 'as an AI model'." |
| 4 | Crew | 600 | Moovi splits into 5 crew blobs with projected name tags | Scribe (script: "claim only ships if it traces back to a fact"), Cutter ("walking the graph for the best path"), Beat ("lands every cut on it"), Lens (critic), Keeper (memory) (content.ts:65-72) |
| 5 | How | 480 | A 6-step sample run on `brightcafe.example` | Brief → Script (a claim rejected) → Cut (path.found) → Score ("124 BPM … snaps all twelve cuts to the kick") → Review → Remember; "v1 · 30s · 1080×1920 · ready" (content.ts:75-87) |
| 6 | Memory | 440 | A memory graph drawn inside the halo ring (`ui.halo`); `MemoryToy` lets you add a note | "His halo is his memory." FalkorDB, SUPERSEDES, "Ask any frame why it is there" |
| 7 | Styles | 460 | 4 style cards | Voice-led explainers, Cinematic launch films, Kinetic promos, Premium edits (content.ts:96-103) |
| 8 | Hood (flow) | — | A mock "technical note" paper card, an architecture SVG and a Cypher snippet | "Moovi-1: a director harness on a temporal graph"; "Director on Claude Opus, Specialists on Sonnet, memory on Haiku" (content.ts:111) |
| 9 | Finale | 240 | The whole crew waves | "You bring the idea. Moovi brings the crew." CTA "Hire Moovi" → `/studio`; waitlist |

Total pinned scroll is about 3,050 vh. **Measured** on the live site: `document.scrollHeight` = 25,938 px at an 804 px
viewport, which is about 32 screens.

**CTAs:**
1. The hero brief box. Submitting stores `{prompt, ratio}` in sessionStorage and the files in IndexedDB `ce-brief`,
   then calls `location.assign('/studio/start')` (`components/sections/PromptBox.tsx:76-90,164`).
2. "Hire Moovi" → `/studio` (`Finale.tsx:27`).
3. The waitlist form → `/api/waitlist`, which **does not persist anything** (`app/api/waitlist/route.ts:5-8`:
   "TODO(storage)… does not persist yet").
4. Sign in.

**Performance (measured on the live site in headless Chrome at 1440×900; it used swiftshader, so GPU numbers mean
nothing):**
- HTML 55.6 KB, a Vercel edge cache HIT (bom1), TTFB 0.22–0.70 s, DCL 644 ms, load 1,273 ms, FCP 896 ms.
- 24 resources, 635 KB transferred. Initial JS is 12 chunks, about 272 KB brotli (the largest are 227 KB, 195 KB,
  123 KB and 113 KB raw). CSS 54 KB raw, 14 KB on the wire. Fonts about 312 KB (the two largest files are 121 KB and
  150 KB).
- The WebGL world loads lazily after first paint (`WorldStage.tsx:9-20,49-51`): 2 chunks, 18.7 + 18.1 KB on the wire.
- `halo.webp` (35 KB) is preloaded with high priority. There are no other images; the character is all shader.
- Hero screenshot captured (`scratchpad/moovi-raw/hero.png`); it renders correctly headless.

**Landing weaknesses (blunt):**
1. **The copy promises a product the code doesn't run by default.** The Crew, Cutter, Beat, Lens and How story (graph
   paths, cuts snapped to the beat, a Lens review loop, claim rejection) describes the old crew path. That path only
   runs with `MOOVI_DEFAULT_STYLE=crew` or uploads (see (c)). The default path is one style function with regex
   routing. "Director on Claude Opus, Specialists on Sonnet" (content.ts:111) is false for the live server, which runs
   Groq gpt-oss-120b / 20b (CLAUDE.md, "Models and keys"). `algo.SPpaths` exists
   (`packages/graph/src/queries/project.ts:429`), but only in the crew path's Art Director.
2. **The page shows no real output.** There is no video, no GIF and no sample film from any of the six styles. The
   Styles chapter lists four marketing categories that don't map to the real style ids (s1, s4 Editorial, s5 Clear
   Signal, Dark Vox, Anatomy, Clip Moment). A judge never sees a Moovi film on the landing.
3. The Styles and How sections are sample data on `.example` brands with invented logs ("claim.rejected · 1").
4. `metadataBase: https://moovi.example` (layout.tsx:24): OG URLs resolve to a fake domain.
5. The waitlist does nothing. The page says "Paper and harness code: coming with the studio" (content.ts:118), although
   the studio is live.
6. 32 screens of pinned scroll come before the finale, and about 600 KB loads before the character appears: heavy for
   mobile.
7. The hero box hands off to an auth wall (`/studio` → 307 `/studio/auth?next=…`, measured). There is no
   try-before-sign-up and no "plan card" preview of what Moovi would make (Cardboard has one:
   `research/cardboard-ai.md` row 17).

---

## (b) Studio: `apps/studio` (Next.js, basePath `/studio`, proxied by Vercel to the EC2 box)

About 2,000 lines in total, in `src/components/{start,office,chat,video,dash,auth,settings}`.

**First run:** `/studio` and `/studio/start` redirect (307) to `/studio/auth` (measured). Sign-up and sign-in forms
(`components/auth/AuthForm.tsx`, routes `api/auth/*`); accounts live in FalkorDB. The Settings page has a model form for
bringing your own key (`components/settings/ModelForm.tsx`). With `MOOVI_BYOK=optional`, a user without a key runs on
the server's Groq key. `Starter.tsx` reads the landing hand-off, creates a project and its first chat, uploads the
files, posts the brief and redirects to `/p/<pid>/c/<cid>`. Meanwhile it shows Moovi in the `think` state with progress
lines (Starter.tsx:20-48). A reload resumes the same chat.

**Dashboard:** `app/page.tsx`, "Your projects", a project grid with one poster per project.

**Office (`components/office/Office.tsx`):**
- A full-screen "set" (`Stage.tsx`) with nine desks: researcher, scribe, director, hunter, moovi, builder, lens, editor,
  keeper. Each desk shows a name and one live status line, and its monitor glows while it works.
- A "bead of light" flies between desks on handoffs. The client infers a handoff when one task ends and another starts
  within 4 s (`useChat.ts:42-46`).
- Moovi's state (think, listen, review, celebrate, direct) follows the events (Office.tsx:86-88).
- On a phone the set becomes a 3×3 desk grid (Stage.tsx:29-40).
- Everything is reduced from an SSE stream of the engine's Redis events (`useChat.ts:56-88`), which reconnects after
  45 s of silence.

**Composer (`components/chat/Composer.tsx`):** a textarea; an `@` mention list (Moovi, researcher, scribe, director,
hunter, builder, lens, keeper, `@video`); up to 6 attached video, image or audio files; a Stop button while running.

**Brief overlay and style picker (`components/office/BriefOverlay.tsx`):**
- A new chat shows the same brief box over a blurred set.
- The style strip is a set of radio buttons: none (= Auto) plus `STYLES` (`packages/engine/src/styles/index.ts:26-34`:
  Style 1, Editorial, Clear Signal, Dark Vox, Anatomy, Clip Moment, Auto).
- Picking a style switches the box to URL or script mode (plus a brand name and site).
- A ratio menu (Auto/9:16/16:9/1:1/4:5) and a "Like the last one" chip (BriefOverlay.tsx:89,152).
- **Bug: a picked style always sends `'9:16'`**, whatever the ratio menu says (BriefOverlay.tsx:75). chat.ts:38 and
  router/job.ts:34 also hard-code `ratio: '9:16'`.
- The style cards are text only: no thumbnail or sample per style.

**Crew visibility:** the events are real, but on the default path they are *stage labels of one function*. `STAGES`
maps timing keys (fetch, brief, voice, plan+pictures, compose, audio, sheet…) to desks (`styles/index.ts:43-64`), and
Auto's MP4 mode maps its stages the same way (`router/job.ts:41-48`). The "crew" visualises a pipeline; no agents are
making decisions. Agents do answer `@mentions` through `talk.ts:53-69`, using read-only tools over the graph.

**Live preview (`components/video/VideoPopup.tsx`):**
- Live versions play in an `<iframe>` of the style's own player (`previewUrl`, :54), labelled "Playing live, nothing
  rendered", next to a seconds-per-stage table polled from `ref.json` every 8 s (:28-35,68-72).
- MP4 versions use `<video>`, with Download and "Tweak in chat".
- **Live versions get no Download and no "Tweak in chat" button** (`VideoPopup.tsx:74-83`, both gated on `!live`), and
  live is the default for every style and for Auto.
- The contact sheet ("Lens is still pulling a contact sheet", `tasks/reel.ts:69`) is never shown to anyone as a
  review. It only becomes a poster.

**Iteration loop (the weakest part):** a chat message goes to `talk.ts`. Moovi's turn (`talk.ts:72-103`) is one model
call with the tools `board` and `scenes`. It returns `{reply, edit:{mode: none|scenes|sound|script|remake, …}}`.
`startEdit` (`talk.ts:134-175`) is written for the **crew path's task board** (task kinds build, render, assemble,
sound, mux, script…). On a live-style or Auto run the board holds a single `style-reel` or `combined-reel` task, so:
- `scenes` and `sound` modes: the reel task is not "touched", so it is copied forward as done and **nothing re-runs**.
- `script` mode: the reel task re-runs with its **original input**. The `feedback` is only injected into tasks of kind
  `script` (talk.ts:166), so **the change is dropped** and you get a re-roll (a new seed) of the same brief.
- `remake` mode: restarts **intake → match** (the crew path, talk.ts:139-144), not the style the user was on.
- The `scenes` tool reads the output of a `script` task (talk.ts:81). Live runs have none, so it finds no scenes.

This is from reading the code; I did not run it end to end. One measured test is worth doing before the comparison
leans on it.

Feedback notes are still written to FalkorDB (`keepNotes`, talk.ts:106-119), and Keeper learns standing preferences
(`talk.ts:39-41`). But only the crew path reads them back into a film (`tasks/script.ts withFeedback`, TAB.md).

**Versions:** each run bumps `chat.version`, and the popup shows v1…vN tabs (VideoPopup.tsx:63-67). There is no diff,
no checkpoint restore, no side-by-side view, no per-beat edit UI and no timeline. One chat makes one video
(BriefOverlay comment, Office.tsx:120).

---

## (c) How Moovi directs today (engine, `packages/engine/src`)

### Routing a brief (`chat.ts:29-51`)
1. `routeCombined` (`router/job.ts:28-38`) takes a brief when Auto is picked, or when there is no style, no upload and
   `MOOVI_DEFAULT_STYLE` is unset. It starts one `combined-reel` task. **This is the default for every plain brief.**
2. Uploads go to `routeEdit` (the EDL edit path, `router/edit.ts`, `edit/*`).
3. A picked style starts one `style-reel` task (`tasks/reel.ts:25`), which calls `runStyle` (`styles/run.ts:6-33`).
4. Otherwise (only with `MOOVI_DEFAULT_STYLE=crew`) the multi-agent crew runs: intake → match → playbook (director,
   scribe, hunter, builder, lens, keeper in `tasks/*`), scheduled on a FalkorDB task board with leases
   (`worker.ts:93-170`).

### Auto in live mode (the default; `router/job.ts:79-104`)
- **A link in the brief:** the style comes from a **keyword regex**, `urlStyleFor` (job.ts:71-78):
  story/fable/founder → Dark Vox; "how it works|architecture|system|product" → Anatomy; essay/idea/why/calm →
  Editorial; list/steps/explain → Clear Signal; anything else → Style 1. No model looks at the site to choose.
- **Plain words:** one director call, `direct()` (`router/film.ts:85-117`), writes 6–8 beats. Then `autoPickFor`
  (job.ts:65-70) picks: a regex for story/fable → Dark Vox; else `pickClipMoment` (noun-overlap score ≥ 0.5,
  `edit/templates/clip-moment-plan.ts:260-270`) → Clip Moment; else Anatomy.
- The beats' `kind` and `family` labels are then **thrown away**: only the `say` lines are joined into a script for
  one style (job.ts:90). The per-beat mix exists only in MP4 mode, which is too heavy for the 2 GB server (CLAUDE.md:
  over 12 min, and the segments time out).
- `matchKit` (job.ts:93-98, `styles/kit/kits.ts:20`) checks need overlap with the reference kits. A match only passes
  the kit's **palette** to the style's inserts.

### The director prompt (`router/film.ts:84-117`)
- **System:** "director of Moovi… plain words, concrete nouns, true facts only… no em dashes".
- **Prompt:** BRIEF; LENGTH (2.55 words/s); THE PALETTE (each family with its look and what it fits); 9 numbered
  RULES:
  1. The hook is footage.
  2. Exactly one quote beat, in voice 2.
  3. A place beat naming 2–4 places.
  4. A process beat.
  5. A stat beat under 9 words.
  6. 2–3 footage searches and some `see` nouns on every beat.
  7. An optional Poly Haven 3D object.
  8. Stat/list → s1, process → anatomy, quote → darkvox.
  9. The payoff comes last.
- **Output:** the zod schema `DirectorOut` (:69-82).
- **Validation:** `validate` bounces word count outside ±10 %, a beat count outside 5–9, anything but exactly one
  quote, dashes, places on non-place beats, and beats without footage (:107-115). maxTurns 4, 60 s deadline.
- No critique, no rewrite pass and no taste memory input.

### The style router (MP4 mode only; `router/route.ts:67-119`)
Pure deterministic rules: quote → Dark Vox; the director's wish if that family `fits` the kind; places → map; beat 0 →
footage; story → Dark Vox; process → Anatomy; stat/list → Style 1; idea → Clear Signal or Editorial; anything else →
footage. Then: each house style at most once per film; Style 1 capped at 8 s; beats too short for their style →
footage; footage kept at ≥ 35 % of the film by demoting the least specific beats first (`KIND_RANK`); neighbouring beats
grouped into segments.

### How a URL becomes beats (per style; Dark Vox shown, `styles/darkvox.ts:36-182`)
1. `readSite(url)` returns the page text, meta and colours.
2. Arc choice: `chooseArc(DV_ARCS, signals(site.text), recent arcs, seed)` (:75-76), from 11 arcs, avoiding recent
   ones.
3. `writeBrief` (`styles/kit/script.ts:133-172`):
   - The system prompt is the style's voice (`DV_VOICE`, darkvox.ts:34) plus hard rules: facts only from the page, no
     hype, no exclamation marks.
   - The prompt is the site text plus the arc's slots (one line per slot, each with a word range).
   - `validate` bounces once only, for empty lines, **numbers not on the page**, stock phrases (`GENERIC`), over-long
     lines, or groundedness below 0.3 against the page's words.
   - `briefChain` then falls back to a deterministic `fallbackBrief`, `doctor()` repairs the lines, and the brand
     colour is forced to a saturated one.
4. Voice (Edge TTS) → word timings → `pieces()` splits them into shots of about 2.4 s (darkvox.ts:99-101).
5. `planLines` (`darkvox/film.ts:83-103`) is one `fast`-tier call that tags each line with 2–4 need words, a set-up
   hint, a "show" word and a prop. **If the model tags at random, its tags are ignored** and a regex need detector
   decides (`styles/kit/needs.ts`, `mergeNeeds`).

### Casting set-ups per beat (`styles/kit/library.ts:79-124`)
- **Scoring:** `fit()` scores a set-up against a beat on need overlap (weighted by order), role, item count, whether a
  number is required or optional, and seconds and word ranges. A model hint adds +2, and the total is multiplied by the
  set-up's weight.
- **Casting:** `cast()` is **greedy, in beat order**, with variety laws:
  - never the same family twice in a row;
  - each set-up used at most `maxUse` times;
  - type-only set-ups capped at 30 % of beats;
  - set-ups from recent films get −2.5;
  - a seeded per-film jitter (×1.6) so "two films never cast identically".
- **Improvisation:** a beat whose best score is below the 2.5 floor goes to `improvise()` in the style's grammar, as
  either a model-made spec or a rule-based sketch layout (darkvox.ts:120-143). A kept model improvisation is `grow()`n
  into the library.
- **Memory:** `loadMemory`/`flushMemory` in the FalkorDB `styles` graph (library.ts:126-140; run.ts:12-14), with
  PageRank over set-ups cast back to back.
- **Library sizes:** Dark Vox 53 set-ups, Editorial 258 pictures, plus the Anatomy figures (CLAUDE.md).

### Reading the shared library (the FalkorDB craft graph, about 950 `:Asset` nodes)
- sfx per event: `assetsForEvent` (`audio/sounds.ts:62`, `edit/cast.ts:57`).
- Weak beats (no set-up, or a score below 5.5) get a shared-library `ui` insert drawn by `libLayer`
  (darkvox.ts:153-157; `s4/player.ts:14`; `styles/kit/borrow.ts`).
- Auto: the kit palette (above). The camera layer (63 moves) is used by the edit path, not by the generation styles.

### Critique, judges and the quality ratchet in code
- **Generation styles: none.** A contact sheet is rendered after the preview (`darkvox.ts:174-176`, `s4/sheet.ts:12`,
  `s5/sheet.ts:33`, `anatomy/player.ts:103`), but **no model or rule scores it** and nothing loops back. The only
  gates are the text validators above.
- Crew path only: `tasks/lens.ts` runs the craft graph's law checks plus an LLM look at a 16-frame contact sheet. It
  sends blocking scenes back to that scene's builder, for at most 2 rounds (lens.ts:17-21). The default path never
  reaches it.
- Footage: pixel heuristics per candidate clip (`footage/quality.ts:66 judgeFrames`), no vision model.
- The "quality ratchet" (a blind subagent judge; R3 7.6, R4 6.6 vs 6.4) is a **human/agent process** for reference
  clones (CLAUDE.md), not code in the product.

### Models
- Each provider has director, crew and fast tiers (`runtime/providers.ts:25-36`).
- The live server runs Groq gpt-oss-120b: 8k TPM and 200k tokens a day shared by every fallback user, after which it
  drops to gpt-oss-20b.
- Several prompts are tuned to survive weak models: "a weak model often names the page's white" (script.ts:163); "a
  model that tags at random… is ignored" (darkvox/film.ts:102).

---

## (d) Known weaknesses (docs/agents and CLAUDE.md)

**`research/R1-audit.md`** (2026-10-16, main b5fef82):
- Positioning scored **3/10**. Generate about 6/10 (an explainer from a URL that is "good, not unbeatable"); Edit about
  2/10 at that time.
- The crew path took 1,020–1,355 s for 30 s on MotionEasy; the visual renderer 203–381 s (`docs/SPEED.md:11-17`).
- "A judge or buyer judges the output video first."
- There was no edit engine (partly fixed since, below).

**`STATUS.md`** (the PM view, 2026-10-16 20:51):
- Day 1 edit gate: speed passes on 3/3 R9 clips (preview 3.8–26.9 s, MP4 17–54 s), but **quality passes on 1/3**
  (silence holes on B2 and B4; Hindi words 72.4 % right).
- The EDL builder self-scored **4/10** (was 3).
- "A lot is being built and very little of it reaches an edit… each stop one wire short."
- One agent (Tab) carries almost all of Day 2 alone.
- Server disk: 7 GB free and shrinking with each rebuild.
- Face detection briefly broke the no-Python rule (fixed in e806e4d).

**`PLAN.md`:**
- Pivot to "Lovable for video": **editing is the focus**, generation styles out of scope.
- Day 2 owes six edit styles (Atlas, Night Desk, Handmade, Crimson Cutout, Brand Promo, Studio Minimal), a sound pass
  and **edit by words (D2.8)**. STATUS doesn't show D2.8 as done.
- Risks: the 2 GB server and the Groq quota.

**`research/R2-market.md`:**
- Nobody ships "a designed, motion-graphics film built around the user's own footage".
- The code-video skills (Remotion skills, HyperFrames, video-use) look flat and regenerate code.
- Moovi's wedges are styles as grammar, live preview, exact edit by words, taste memory and **visible quality gates**.
  The last three are mostly not built for generation.

**`research/cardboard-ai.md`:**
- Cardboard's edge is a **verify-then-fix loop**: frames → vision-model critique → fix, plus a request audit and a
  listen to the mix.
- It also has chat checkpoints, cleanup levels, a beat grid, recipes with typed inputs, and a plan card before
  sign-up.
- Recommended adoptions: #1 the EDL linter + one vision pass over frames + a request audit; #2 checkpoints as graph
  versions.

**CLAUDE.md open items:**
- The visual renderer is not a studio style yet.
- On-screen credits (OSM, CC-BY footage, the MacLeod bed) are missing.
- **Rotate the server's Groq key** (it leaked in a process list).
- Dark Vox repeats props; Anatomy has near-empty frames.
- Bedrock is blocked on the Free plan.
- Server updates are manual (about 10 min).
- No AWS budget alert.

---

## Top gaps, ranked (what OpenDesign should be compared against)

1. **No self-critique on the default path.** The generation styles render a contact sheet and stop: no frame judge,
   no request audit, no fix loop. Lens exists only on the crew path, which is off by default. Severity: critical.
2. **Iteration is broken for live previews.** `startEdit` targets crew task kinds. On style and Auto runs a change is
   ignored, re-rolled or rerouted to the crew, and live versions have no Tweak or Download button. Severity: critical.
3. **Auto's "direction" is regex.** For links, the style comes from keyword matching. For plain briefs, one of 3 styles
   is chosen by regex and noun overlap. In live mode the director's per-beat families are discarded. Severity: high.
4. **The landing over-claims and shows no output.** It claims a crew, Opus, beat-snapped cuts and Lens; the reality is
   a single pipeline on Groq. There are no sample films, the waitlist doesn't save, and the OG domain is fake.
   Severity: high.
5. **No editable artifact.** Live previews can't be downloaded. There is no per-beat or per-element edit UI and no
   checkpoints or diff, and styles ignore the ratio (forced to 9:16). Severity: high.
6. **Quality not proven.** The ratchet scores are 6.4–7.6/10 on reference clones; edit quality passes 1/3 on R9; Dark
   Vox repeats props and Anatomy has near-empty frames. Severity: medium-high.
7. **Infrastructure ceiling.** A 2 GB t3.small, a shared Groq budget of 200k tokens a day, and manual deploys. The
   mixed MP4 film can't run there. Severity: medium.
