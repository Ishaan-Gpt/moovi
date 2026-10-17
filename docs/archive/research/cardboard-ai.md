# Cardboard AI: what it does, how, and what Moovi should take

Owner: a side session of Claude 1 · 2026-10-16. Status: done (public surface only). Method: REA (CDP capture and
static bundle analysis) plus the pages Cardboard publishes for agents (`llms.txt`, Markdown versions of each page).
No sign-in, no forms, nothing paid. No Cardboard code or assets are copied here; every "how" below is our reading,
to rebuild in our own code.

## Summary for Ishaan

Cardboard (YC W26, Bengaluru/SF, cardboard.ai, formerly usecardboard.com) is a **browser NLE with an agent on top**:
a real multi-track timeline, a custom WebGL2 compositor and WebCodecs decoder in the browser, a cloud backend for
proxies, analysis and a parallel fan-out export, and a "Director" chat agent (Claude or GPT, user-picked) that calls
timeline tools. Since 2026-09-28 there is also a Mac app where your own Claude Code or Codex drives the edit.

Their edge is **not one clever algorithm**. It's a long list of deterministic editing features (transcript cleanup,
silence closing, beat grid, speaker reframe, captions behind the subject, B-roll timed to words) plus an agent
that checks its own work. It runs a "look at the frames, then fix" pass and an "audit the result against the
request" pass before it reports done.

What Moovi should take, in order: (1) a **verify-then-fix loop** over our EDL (frames + request audit + text
legibility), (2) **cleanup levels** (Light / Balanced / Tight) previewed before commit, with word-boundary
protection, (3) a **music beat grid** (not onset picking) with a "never reuse a moment" montage law, (4)
**chat checkpoints** (every message is a restorable EDL version, and we already keep versions in FalkorDB),
(5) **captions behind the subject** from the person matte we already have, (6) **B-roll timed to the
spoken concept** and sized to how long it stays the subject, (7) **recipes as typed input forms** (named media and
text slots, ratio, length, preview), shown as the face of our styles.

Moovi's gap over them still holds (R2). Cardboard makes a cut, and its own "hard problems" page still lists motion
graphics, style references and memory as unsolved. That's exactly where our styles, library and FalkorDB memory sit.

## What was looked at, and the boundary

| Surface | Result | Evidence |
|---|---|---|
| `www.cardboard.ai` landing (CDP target, 40 scripts, Next.js + Turbopack, React, Sentry, PostHog, Stripe, Vercel) | captured and statically analysed; source maps **HTTP 403** | REA `ev_c0299db7545079fdf240cf764909b55c5dc077cedd640d51db1637c6e9d89a41` |
| Browser target list (Chrome 155, loopback CDP) | 2 page targets, both cardboard.ai | REA `ev_cb7d53da7e61b2debedf1a8ffa72bbe3d4a2fc46ec13a9dcf3447b398b7a3ed5` |
| `/share/L8BxE6Gl8l6O` (the public watch page linked from their changelog) | **404** today; the CDP capture landed back on the landing page | REA `ev_67362886b19a5daf1b7883828430f1474e362f437684d951ab22fc718dbdf640` |
| `app.cardboard.sh/quick-check`, `demo.usecardboard.com` | both now redirect to cardboard.ai (domain migration); the no-login demo from Launch HN is gone | REA `ev_f5ee24cdec37feffb98c86627934c5a6a12331433c33543eb6ff050697b099e3`, curl 308 |
| Editor (`/home`) | **307 to /** without a session | curl |
| Mac app (`/desktop/download` → `/api/desktop/download`) | **401**, needs an account | curl |
| `llms.txt`, `/changelog` (45 releases, 2025-11-09 → 2026-10-05), `/hard-problems`, `/recipes` (82 recipes), 5 guides, 6 job posts | read in full (Markdown via `Accept: text/markdown`) | local copies in the session scratchpad |
| Launch HN 47170174 (2026-02-26), founders' comments | read via the HN API | [Launch HN](https://news.ycombinator.com/item?id=47170174) |

The full REA evidence bundle (4 records, 1.2 MB) is in this session group's shared notes folder:
`side-session-notes/local_59f0e690…/cardboard-rea-evidence.json`.

**Not observed** (needs a signed-in session): the editor's JS (timeline model, compositor shaders, decoder, agent
tool list), its network calls, and the Mac app bundle. Everything below about the editor's internals is
**inferred** from what Cardboard says publicly, marked as such. If you want that layer, sign in yourself in the CDP
Chrome (started with `--remote-debugging-port=9333`) and I can observe the editor passively.

## Observed in shipped code (landing bundles)

1. **Landing "plan card"** (`0_t53yixo-_8g.js`, `/api/landing-plan`, 12.5 s timeout). Before sign-up, a prompt
   becomes a zod-validated plan: `{reply ≤120, title ≤48, kind ≤24, ratio, seconds 5–600, steps[3..4] of
   {kind: footage|generate|soundtrack|edit|text|voiceover, detail ≤96}, soundtrack {song, artist}?, palette [3 hex],
   coverQuery, cover {url}?}`. If the call fails, a **regex fallback** classifies the prompt
   (`reel|tiktok|shorts` → "Social reel" 15 s, `documentary|history` → 120 s, `explainer|tutorial|demo` → 60 s,
   `launch|product|app` → "Launch Film" 30 s) and picks one of 5 fixed 3-colour palettes. The plan is stored in
   `sessionStorage` (`cardboard:landing-plan`) and carried into sign-up.
2. **Improve prompt** (`/api/landing-improve`, 9 s timeout): rewrites a rough prompt (≤600 chars on the landing,
   50k in the app per the changelog).
3. **Model picker** (shipped list): `gpt-6-astra`, `gpt-6-sol` (provider `codex`), `claude-opus-5-5`,
   `claude-fable-5-1` (provider `claude`), with effort levels Low / Medium / High / Extra high. **Generative models by
   plan:** Starter "Hailuo, Kling 2.5, image gen"; Creator "Kling 3, Seed Dance 2.5, Omni, Veo".
4. **Recipe record** (from the recipe page's server payload): `{slug, name, description, category, isTrending,
   highlights[], inputs[{id, kind: media|text, accept[], min, max, prompt, hint} | {id, kind: text, label,
   placeholder, optional, maxLength}], aspectRatio, length, posterUrl, previewUrl, videoUrl, onWeb, onMac}`. The
   recipe's actual instructions are **not** shipped to the page; they stay on the server.

## Their architecture (as stated publicly; editor internals not observed)

- **Client:** custom WebGL2 compositor + WebCodecs decode/encode, "no server-side rendering" at launch (HN). Local
  footage through the File System Access API (the reason Firefox is unsupported); OPFS and Cache Storage for media
  caching (design-engineer post). Proxies for 4K; "what sits near the playhead loads first".
- **Server:** proxy transcodes, analysis workers on GPUs, an agent service ("natural language into timeline
  operations"), and a **fan-out export that renders chunks in parallel** (backend post). Server export as a fallback
  when the browser export fails a check (2026-09-21).
- **Understanding:** "a series of cloud VLMs + traditional ML models" (HN). Shot detection, face detection and
  grouping, segmentation, speaker activity, transcription with one language locked per video, scene/speech/object
  search over "hybrid + agentic RAG" (founder: closer to how Claude Code searches than a vector DB).
- **Agent:** tools, not a fixed workflow ("the bitter lesson"); an internal benchmark for precise edits; a
  plan/agent mode; an eval team being hired (production failures → eval cases → release gates).
- **Exports:** MP4/MOV/GIF, HDR, adaptive frame rate, ProRes; AAF and FCPXML/XML to Premiere, Resolve, Avid,
  FCP with relinking and camera timecode.

## Feature list, how it seems to work, and the Moovi mapping

Effort: S ≤ half a day, M 1–2 days, L more than the hackathon.

| # | Cardboard feature | How it seems to work (evidence) | Moovi today | What to add | Effort |
|---|---|---|---|---|---|
| 1 | **Transcript cleanup**: retakes, false starts, fillers, stutters, repeats; **Light / Balanced / Tight**, each previewed before commit; "word boundaries protected, nothing clipped mid-word" | word-level transcript → candidate cut spans by class (filler, repeat, retake) → a threshold per level; cuts snap to word edges (changelog 2026-04-20, 06-08) | R4 laws: pause trim 0.18 s, cut snap 100 ms, slates/false starts cut; D1.3 builds the EDL | expose the three levels as presets over R4's `pause_max` / `pause_keep` and the retake detector; preview each in the R10 player (free, no encode) | S |
| 2 | **Silence and gap closing** done in the same pass as cleanup ("the dead air goes with the bad takes") | after removing a take, re-run the gap pass on the joined timeline so no holes are left (2026-08-24) | pause trim exists | run pause trim **after** retake removal, not before; test: no gap > `pause_keep` in the output EDL | S |
| 3 | **Beat grid** over the music, up to 20 min; cuts land on beats "even through quiet stretches with no percussion" | moved from percussion onsets (HN, 2026-02) to a tracked tempo grid (2026-06-15): estimate tempo, then phase-lock a regular grid, so beats exist where no drum hits | no music beat detection on main (Moovi "beats" are script beats) | onset envelope (spectral flux from the decoded PCM) → tempo by autocorrelation → dynamic-programming beat tracker (Ellis 2007) → grid; snap cut candidates to the nearest grid line within a tolerance. Pure TS, no Python | M |
| 4 | **Montage law: every moment used once**; if the music wants more cuts than footage allows, hold shots longer; refuse "a cut on every beat" if there's too little footage | a constraint in the cut planner: a used-range set; cuts per beat fall back from 1 to 2 or 4 beats (2026-08-24) | n/a | in the EDL builder: track used source ranges; choose beat stride = smallest of {1, 2, 4} that fits the footage; surface "not enough footage" instead of padding | S |
| 5 | **Verify-then-fix: "the agent got eyes"**: after an edit it looks at real frames (caption off screen, cut a beat early) and fixes before handing back; a **request audit** holds the timeline up against the ask; it **listens to the mix** before calling audio done; overlap and too-small-text checks | sample frames at each event → VLM critique → targeted fix; separate LLM check of request vs EDL diff; audio check on the mix (2026-07-13, 07-20, 08-24, 08-31) | Lens reviews whole films (crew path); `render/qa.ts` has platform zones; R4 safe zones | an **EDL linter** first (code, no model): text inside safe zones, no caption over the face box, min text size, no overlaps, no gap or black frame, LUFS in band. Then one VLM pass on 4–6 frames from the R10 player for what code can't see. Then a request-vs-EDL audit (one small model call) | M |
| 6 | **Chat checkpoints**: every message is a save point; roll back restores the timeline exactly | snapshot the timeline per agent turn (2026-03-02) | FalkorDB project graph; edit-by-words is D2.8 | store each EDL version as a node linked to the chat message that made it (`(:Message)-[:PRODUCED]->(:EdlVersion)`); "undo to here" replays the stored EDL in the player. Cheap, and a strong graph story for the judges | S |
| 7 | **Captions behind the subject** (9 of 21 styles); per-clip person detection; words stay in front when nobody is in the shot; no one-frame flicker at cuts | person matte per clip; text layer drawn between background and matte; fallback when no person (2026-08-31) | R8 `kin-behind` spec; Afterglow has a live WebGL person matte | draw the caption layer under the matte in the R10 player; gate per range on "person present"; hold the matte state across a cut for one frame to stop flicker | M |
| 8 | **Caption presets**: Word Pop (keyword big on its own line), Rapid Reveal (one word at a time), Stacked (line by line), Beast Mode, Pulse Cut; captions go quiet in long silences; edit in place; regenerate keeps style; captions resync after retiming | word timings + style parameters; a silence rule hides captions in gaps (2026-07-06) | R8: 50 styles as parameter sets, word timing | add the **silence rule** (hide after `gap > x` s) and **style survives regenerate** to the R8 renderer; Word Pop ≈ R8 `tier-two` | S |
| 9 | **Speaker-aware reframe**: cut or punch to whoever is speaking; split / grid / hero / PIP layouts that fill each slot with a detected person; stays on the right person through shot changes; one pass across all clips | face detection + grouping (identity across clips) + speaker activity (who's talking) → a smoothed crop path; layouts as slot templates (2026-04-20 → 06-15) | footage-edit tracks a face box (YuNet); R4 has `split_top` | add **face grouping** (embed each face, cluster across the clip) and **active speaker** = face group whose mouth motion or audio-visual correlation peaks while words are spoken; smooth the crop with a critically damped spring and a dead zone | L (multi-speaker); S for single-speaker smoothing |
| 10 | **B-roll timed to the spoken concept**, "sized to how long it stays the subject"; start point picked by **watching the clip**, not a dozen frames; no letterboxed clips; no duplicates of what's in the project; every clip carries its credit; archival sourcing for documentaries | transcript → concept spans (start, end) → stock/archive search → VLM picks the in-point inside the candidate → rejects letterbox (black-bar detection) and duplicates (2026-06-29, 09-07, 09-14) | footage search and licences in FalkorDB (`footage/`), R4 insert slots | concept spans from the word transcript (one model call, already planned as beat tags); in-point = the highest-scoring sampled window, not frame 0; letterbox check with ffmpeg `cropdetect`; dedupe by source id in the graph; credits from the licence node | M |
| 11 | **Black-bar / framing repair** on request | detect bars and exposed canvas, scale to fill (2026-08-10) | none | `cropdetect` on intake, store the active area, scale to cover in the EDL | S |
| 12 | **Reference matching**: attach a video or image; agent studies colour, pacing, fonts and can lift its audio | VLM + measured cut rate and colour stats on the reference (2026-07-27); their hard-problems page still calls it unsolved | R4 measured reference reels by hand (cut rate, median shot, sfx dB) | turn R4's measuring into a tool: cut rate, median/p90 shot, words/s, pause stats, caption density, mean colour → nearest Moovi style + parameter overrides. It's our "styles as grammar" made automatic | M |
| 13 | **Exact colour by number**: "exposure +0.8, temperature -20, every clip" moves real sliders across 10 controls; asking twice replaces the grade instead of stacking | the agent writes parameters, not a preset name; grade is one slot per clip (2026-08-03) | grade per style in R4 | make `grade` in the EDL a fixed parameter set (exposure, temperature, tint, contrast, saturation, lift/gamma/gain…) with replace semantics | S |
| 14 | **Multicam sync** by audio | cross-correlate audio envelopes to find offsets (llms.txt) | none | only if multi-take uploads matter for the demo | M |
| 15 | **Platform presets** (TikTok, Reels, Shorts, YouTube, LinkedIn): format, pacing and caption constraints | constraint table per platform | `platformZone` in `render/qa.ts` | extend it with pacing bands and caption size floors | S |
| 16 | **Recipes**: 82 named workflows (UGC, podcast, launch, travel, trend effects) with typed inputs, ratio, length, a preview, web/Mac availability; the instructions stay server-side | form + hidden prompt template | styles as data in `packages/skills`; an edit-style picker is D1.7 | show each Moovi edit style as a recipe card: named input slots (`video` min 1 max 1, `names to spell right`), ratio, length, a preview reel. Their "names to spell right" input is worth copying as an idea: it feeds STT biasing and caption spelling | S |
| 17 | **Landing plan card** before sign-up (observed, §1 above) | one model call into a strict schema, with a regex fallback | landing has a waitlist | a "what Moovi would make" card on the landing: one Groq call into a zod schema + our own regex fallback so it never fails | S |
| 18 | **Motion graphics, 3D, editable graphics** (props panel lists words, numbers, colours; edits collapse into one undo) | code-generated graphics with exposed parameters (2026-09-14, 10-05) | our core: styles, set-ups, library, three.js | already ahead; take only "expose a graphic's text/number/colour params for edit-by-words" | — |
| 19 | **Export**: parallel chunked render, verify every export (frozen frames, audio clicks) and fall back to cloud; cache an unchanged export; untouched single clip copies without re-encode; adaptive fps | backend post + changelog | chunked render exists in the crew path; MP4 is D1.8 | add an **export check** (ffprobe duration, freeze detection, silence/clipping) and a content hash so an unchanged EDL returns the cached MP4 | S |
| 20 | **NLE handoff** (AAF, FCPXML, XML) | timeline → interchange XML | not planned for the hackathon | later; the EDL already has what FCPXML needs | M, later |
| 21 | **Share link + frame-pinned comments**, Mac app, BYO agent, live collaboration | product surface | studio, BYOK | out of scope for the hackathon | — |

## Ranked: what to adopt

Ranked by judge impact per hour, given the Day 1–2 plan (EDL, R10 player, R4 laws, R8 captions, FalkorDB library).

1. **EDL linter + one VLM frame pass + request audit** (row 5). Turns "the AI says it's done" into a measured check,
   fits our "performance claims are measured" rule, and every style benefits. Hook it after D1.3 and before the
   player. M.
2. **Chat checkpoints as graph versions** (row 6). Almost free on FalkorDB, demo-able in 10 seconds ("undo to this
   message"), and it gives D2.8 (edit by words) its safety net. S.
3. **Cleanup levels with live preview** (rows 1, 2). Three presets over R4's laws, previewed in the R10 player with no
   encode. S.
4. **Beat grid + montage law** (rows 3, 4). Needed for D2.6 "cuts on the beat"; build the tracker in TS. M.
5. **Captions behind the subject + silence rule** (rows 7, 8). We already have the matte; R8's `kin-behind` becomes
   real. M.
6. **B-roll on the spoken concept, in-point by looking** (row 10). Feeds R4b inserts. M.
7. **Recipe cards with typed inputs, "names to spell right"** (row 16) and the **landing plan card** (row 17). S each.
8. **Reference → style parameters** (row 12). The automatic version of R4. After the hackathon unless time allows.
9. Small ones as they come: black bars (11), grade by number with replace semantics (13), export check and cache
   (19), platform pacing bands (15).

## Don't copy

- **A full browser NLE** (timeline UI, WebCodecs export, keyframe lanes). PLAN says the user never opens a timeline;
  R10 already shows the preview needs no encode. Their own HN thread and changelog show the cost (canvas text jitter,
  WebCodecs differences between browsers, months of export-reliability fixes).
- **Generated-footage tiers** (Kling, Veo, Seedance). PLAN: not the Higgsfield direction.
- **Per-turn frontier models only.** Their picker is Claude and GPT; ours must run on Groq's free tier, so most of the
  checks above are code first and one small model call second.

## Open questions

- The editor's actual timeline schema and agent tool list (needs a signed-in capture; your call).
- Whether their beat tracker and speaker detection run in the browser or on the server (the changelog says cloud-only
  tools like Auto Reframe stay out of the Mac app, so reframe at least is server-side).
- Exact caption style parameters (only names are public).

Sources: [cardboard.ai](https://www.cardboard.ai), [llms.txt](https://www.cardboard.ai/llms.txt),
[changelog](https://www.cardboard.ai/changelog), [hard problems](https://www.cardboard.ai/hard-problems),
[recipes](https://www.cardboard.ai/recipes), [careers](https://www.cardboard.ai/careers),
[Launch HN](https://news.ycombinator.com/item?id=47170174), [outlierkit review](https://outlierkit.com/resources/cardboard-review/).
