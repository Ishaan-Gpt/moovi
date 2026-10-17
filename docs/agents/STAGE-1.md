# Stage 1: nail the final pipeline

Owner: Claude 1 (PM) for Ishaan · 2026-10-17 · status: **the plan for now**. Stage 2 (`STAGE-2.md`, the After
Effects-grade prompt editor) starts only after Stage 1 is done.

The target is the final pipeline Ishaan approved on 2026-10-17: `maps/proposed.html` (open it in a browser). Ishaan's
own words behind it are in `ISHAAN-VISION.md`. Today's code before the final merge is in `maps/current.html`; main is
af7ceec and later. This document turns the map into work: what changes, in which files, in what order, who owns it,
and how we know each piece is done.

## 0. The goal, and what "done" means

**Goal 1:** Moovi beats every other video product on the market, for making a video and for editing your own.
**Goal 2:** someone with no editing know-how gives an idea, a link or a video and gets a post-worthy video without
worrying about the prompt. Our output must clearly beat "level 3" (a strong model plus a hand-tuned process prompt).

Stage 1 is done when all of these are true, measured, not assumed:

| # | Check | How it is measured |
|---|---|---|
| D1 | One pipeline: every message goes through the same 8 stages; the 4 lanes of today are gone (the old crew sits behind a flag) | `chat.ts` routes to one job kind; a test sends 7 example briefs and 3 clips and asserts the same stage list |
| D2 | 7 types offered, each with its own skill branch, library slice, script arcs and presets | the type registry test; the studio shows 7 type cards |
| D3 | Every film passes the floor rules | CHECK + film review on 20 benchmark films: 0 floor-rule errors |
| D4 | A blind judge scores each type above the bar | per type: our best film scores at least 7.0 and at least the "level 3" film we make with Opus and a hand-written prompt for the same brief, same round |
| D5 | A chat change patches only what it touches, for edits and generated films, with versions and undo | 10 scripted changes per type: each one changes only the beats it names, in under 3 s, and undo restores the exact film |
| D6 | The same 8 agents in the code and in the studio, one chat line per agent | `events.ts` lists 8; the studio renders 8 desks; a run posts at most one folded line per agent stage |
| D7 | Precise mode on a free model is as good as today's best, and Creative mode is better | the same benchmark on Groq (Precise) and on a connected Claude Code (Creative) |
| D8 | Speed | first live preview: generate under 60 s, edit under 30 s on the 2 GB server (measured, `pnpm --filter @moovi/engine exec tsx scripts/films.ts` timings) |

## 1. Today against the final pipeline

| Area | Today (main af7ceec) | Stage 1 |
|---|---|---|
| Entry | Style menu + Auto + uploads; the router picks one of 4 lanes by checks and regexes | One box; attachments get roles; the type is picked by card, named in words, or inferred and said in one line |
| Types | 8 styles + Auto, each with its own pipeline and player; 5 edit looks | 7 types; each type uses one or two styles as its looks |
| Brains | Your key, else the server's Groq | Precise (open APIs, local, server) and Creative (connected Claude Code wins when online; Tab's bridge) |
| Gather | Site read per style; footage finder; no brand measurement; no image generation | One Researcher with a tools decision tree |
| Write | One free-form brief call per style plus a per-style doctor | One Writer: arc per type, hooks, draft, humanize, watch-through check, one rewrite |
| Voice | A fixed voice per style; 63 Edge voices not shippable | One of the voices cast per film (Kokoro or OpenAI TTS once shippable), or your own |
| Music | One fixed bed for most styles; beat grid only in Launch | By the type's energy, beat grid for every film |
| Sound effects | By event from the graph (`assetsForEvent`) | Every event mapped, more sounds, per-type marks |
| Design | Each style casts from its own code library; kits pass a palette | Theme locked per film; every beat cast from the type's slice and motion branch |
| Checks | CHECK on edits (first plan, chat edits, MP4); film review on style films | Floor rules shared by the Designer (prevent) and Lens (check) on every film and change |
| Chat changes | Edits: rules-based edit by words; generated films: re-made | Every film: a change becomes ops on its plan, only the touched beats re-run, versions and undo |
| Agents | 10 ids in `events.ts`, 9 desks, a busy chat | 8 agents, the same in code and studio, one folded line each |
| Taste | Clones R1–R5 reach users as a palette; Launch refs feed Launch only | Every reference assigned to a type, broken into parts, mapped into the library and the motion branch, blind-tested |

## 2. Rules for the work

1. **Nothing that works today breaks.** Every workstream lands behind a switch or as an addition, then becomes the
   default only when its check in section 0 passes. The old crew path stays behind `MOOVI_DEFAULT_STYLE=crew` until D1.
2. **One owner per file area** (as now): Tab owns the engine spine (`chat.ts`, `router/`, `edit/`, `review/`, `keys.ts`,
   `worker.ts`, `runtime/`, `packages/mcp`). Ishaan's sessions own `styles/`, `packages/library/src/kits/`, `apps/`,
   `packages/brand`, `packages/character`. A change in someone else's area goes through their log first.
3. **Taste lives in data, checks live in code.** Numbers and bans go in the type registry, the motion branches and the
   library; the engine enforces them. No taste words in prompts that code could check instead.
4. **Measured or it did not happen.** Every "done" names its test, its benchmark run and its numbers in the owner's log.
5. **The ratchet holds.** A new version of a type ships only if it beats the best previous film in the same blind round.

## 3. The workstreams

Each has: what, where (files), who, steps, and the check that closes it. W1–W4 are the foundation; the rest build on
them. The phase plan is in section 4.

### W1. One way in and one router

**What.** Replace the 4-lane router with: decide the brain → give each attachment a role → (a video) the Editor's
preparation → pick the type → the shared stages.
**Where.** `engine/src/chat.ts`, `router/job.ts` (Auto), `router/edit.ts`, `commands.ts` (a `type` field and attachment
roles on the brief), `apps/studio` (type cards replace the style menu; attachments get a role chip).
**Who.** Tab (engine), Ishaan's studio session (UI).
**Steps.**
1. `commands.ts`: the brief carries `type?: TypeId` and `attachments: { upload, role: 'footage' | 'reference' | 'asset' }[]`.
2. `router/pipeline.ts` (new): `route(brief)` returns `{ brain, type, prep: boolean, attachments }`. Type: the card, else
   words (`typeFromWords`, one table of phrases per type), else one small model call that must answer from the 7 ids;
   the reason is posted in one line ("A Launch film for cal.com, about 24 s, cut to music"). Ask only when two types
   score within a set margin.
3. Role rules: a video with no "like this" words is footage; "like this", "in this style" make it a reference; images and
   logos are assets unless called references. Unclear: ask once.
4. One job kind `film` runs the stages; today's `style-reel`, `edit-reel` and `combined-reel` become stage implementations
   it calls, so nothing is rewritten on day one.
5. Retire Auto's `urlStyleFor` and `autoStyleFor` regexes once the type pick passes D1; the combined MP4 film goes behind
   `MOOVI_AUTO_RENDER=mp4` as today (too heavy for the server).
**Check.** D1 test: 7 briefs and 3 clips → the expected type and the same stage list; the old router's tests still pass
behind the flag.

### W2. The type registry

**What.** A type is data: which styles it uses as looks, its arcs, beat map, caption preset, grade, music energy, sfx
marks, tool rules, floor overrides and motion branch. Every stage reads it.
**Where.** `packages/library/src/types/` (new): one JSON or TS file per type, `index.ts` with `TypeSpec` and `typeOf(id)`.
Graph: `(:Type {id})-[:LOOK]->(:Style)`, `(:Asset)-[:IN_TYPE {w, when}]->(:Type)`, named queries in
`packages/graph/src/queries/types.ts`.
**Who.** Ishaan's library session (registry, kits), Tab (graph queries, reads in the engine).
**The seven types and their looks (from the map):**

| Type | Looks (existing styles) | Seeds and references |
|---|---|---|
| Edit my video | edit Base, Atlas, Handmade, Studio Minimal, Studio Cut | Tab's E1–E6, I1–I6; R8 captions |
| Launch | Launch; Style 1's site capture | l01–l12 |
| Showreel | Clip Moment; reel kits | R2 level-ladder, R5 night-glass |
| Brand post | Editorial; Dark Vox as its story look | R1 crimson-poster, R3 golden-hand, R4 red-table |
| SaaS explainer | Style 1 + Clear Signal; Anatomy for "how it works" | Style 1 plans, Anatomy figures |
| UI morph | new | l09, l06, the 109 library UI pieces |
| Kinetic type | new | l02, the kin-type caption, the visual renderer's kinetic captions |

**Steps.** 1) `TypeSpec` and the seven specs for the five types that have looks today. 2) Seed `(:Type)` and
`[:IN_TYPE]` from the specs in `seedLibrary`. 3) `typeKit(id)`: one graph read that returns everything a film of that
type needs (map box "Load the type's kit"). 4) UI morph and Kinetic get specs with `status: 'new'` until W11 builds them.
**Check.** D2: `typeKit` for each type returns arcs, beat map, presets and a non-empty library slice; a test fails if
any type misses one.

### W3. Two brains

**What.** Precise mode and Creative mode, one pipeline. Lane order decided by Ishaan: Claude Code connected and online →
Creative mode, even with a key; else the key; else sampling; else a linked offline Claude Code parks the job; else ask
for a key or a connection.
**Where.** Tab's bridge plan (`research/mcp-claude-code-bridge-plan.md`): `packages/mcp`, `keys.ts` scope fallback,
`worker.ts` parking, `runtime/index.ts` `brainMode()`.
**Who.** Tab.
**Steps.** As the bridge plan's phases 1–4, plus: `brainMode()` in phase 1; every stage below that behaves differently
reads it (the map's "2 MODES" boxes); a step kind for "write a component" (code back) so the Designer's Creative-mode
box can use it in W7.
**Check.** D7, and the bridge plan's own tests (`lane.test.ts` with key plus online, key plus offline).

### W4. Eight agents, one chat line each

**What.** The same 8 agents in code and studio: Moovi, Editor, Researcher, Writer, Sound, Designer, Lens, Keeper.
Builder becomes code (no desk). Asset Hunter joins Researcher, Scribe becomes Writer, Voice becomes Sound.
**Where.** `engine/src/events.ts` (`AgentId`, `DESK_IDS`, `AGENT_NAMES`), every `publish(... agent ...)`,
`apps/studio` desks and chat panel, `packages/character` if desks are drawn there.
**Who.** Tab (ids, a compatibility map from old ids so old runs still render), Ishaan's studio session (desks, chat).
**Steps.** 1) New ids plus `LEGACY_AGENT` map (scribe → writer, hunter → researcher, voice → sound, builder → code,
director → designer). 2) Chat: each agent posts one line when its stage ends ("Writer · launch arc, hook picked from 3 ·
2.1 s"); details (steps, timings, CHECK findings) fold under it. 3) The bridge's step rows fold under their agent.
**Check.** D6.

### W5. The Writer

**What.** One shared writer every type uses: pick the arc → write hooks, keep the best → draft in the arc → humanize →
watch-through check → rewrite a failing line once. For an edit, it writes only on-screen text; your words stay yours.
**Where.** `engine/src/writer/` (new): `arcs.ts` (from the type registry), `hooks.ts`, `draft.ts`, `humanize.ts`,
`watch.ts`, `index.ts` (`write(brief, type, facts, brain)`). Each style's brief call becomes an adapter: the Writer's
lines fill the style's slots (`styles/*.ts`, `launch/brief.ts`).
**Who.** Ishaan's styles session (adapters), Tab or Claude 1 (the writer core).
**Rules (from the map; all code-checked):** hook under 8 words, concrete, a number or a tension, lands by 1.5 s; one idea
per line, 12 words at most; something new every 2–4 s; an open loop paid off before the CTA; one CTA; 15–35 s unless
asked; banned AI tells (the `review/config.ts` list grows into `writer/banned.ts`, shared); contractions and plain words;
only facts the site or the user gave. Trending formats per type (POV, "3 things", "stop doing X", before/after).
**Brains.** Precise: 3 hooks in one call, slots in one call. Creative: 10 hooks ranked, a free draft cut to the arc.
**Steps.** 1) Core + tests on fixed briefs. 2) Adapters for Launch and Editorial first (the two types with the
weakest copy), then the rest. 3) Blind-judge copy only (text cards side by side) against today's copy.
**Check.** Every script passes humanize and watch-through by code; the copy round beats today's copy for every type.

### W6. Sound: voice, music, sound effects

**What.** Cast a voice per film; music by energy on a measured beat grid; every sound event mapped.
**Where.** `engine/src/audio/voices.ts` (tags), `audio/local-tts.ts` (Kokoro, Tab's bridge phase 3) or `openai-tts.ts`,
`audio/sounds.ts`, `launch/audio.ts` (its grid becomes `audio/grid.ts`, shared), `library/music-tracks.json`,
`assets/sfx/map.json`.
**Who.** Tab (audio spine), Ishaan's library session (the sound and music catalogue).
**Steps.**
1. Voices: every voice tagged (language, accent, gender, age, tone, types it suits) in the graph; `castVoice(type,
   brand tone, script language, memory)`; Hinglish → Indian English or Hindi; two speakers → a contrasting pair; your
   own video → your voice. Ship only voices with a shippable licence (Kokoro, OpenAI TTS); Edge stays dev-only.
2. Music: each track tagged with energy, measured tempo and grid, types, licence; the cut lands on bars, the drop on
   the reveal; music 18 dB under the voice.
3. Sound effects: every event the players emit has a mapped sound (typing → keys, click → click, card in → pop, cut →
   air cut, reveal → riser then hit, number → tick); a test fails on an unmapped event; grow the vendored kit past 22.
**Check.** Every benchmark film: −14 LUFS, voice intelligible (music under the voice), no unmapped event, no repeated
voice across the last 3 films of a project unless pinned.

### W7. The Designer: one theme, every beat cast

**What.** Lock the film's theme (one palette, one type pair, one grade, one motion feel); re-skin any borrowed piece to
it; cast every beat from the type's slice and motion branch, inside the floor rules; improvise when nothing fits; in
Creative mode, write a new piece in code and keep it if it wins.
**Where.** `engine/src/design/` (new): `theme.ts` (`themeFor(brand, type)`), `cast.ts` (generalizes
`styles/kit/library.ts cast()` and `edit/cast.ts` over the type slice), `compose.ts` (today's improvisation). Players
read a `theme` block (each style's player maps it onto its own tokens).
**Who.** Ishaan's styles session (players read the theme), Tab (the shared casting over the graph).
**Steps.** 1) `Theme` type and `themeFor`: the brand measured from CSS (W8) else the type's palette.
2) Players accept `theme`; the borrow layer (`styles/kit/borrow.ts`) and edit inserts draw in theme tokens. 3) Shared
casting over `[:IN_TYPE]`, minus recent repeats, plus a seed. 4) Creative mode: "write a new piece" through the bridge's
code step; floor rules decide; a winner is saved to the library with its type marks.
**Check.** On the benchmark, a mixed-look film uses one palette and one type pair throughout (code check on the film's
data); D3.

### W8. The Researcher: the tools decision tree

**What.** One agent runs only the tools the film needs: site and brand kit; screens and a scroll video; your own assets
first; stock footage; a generated image or drawn set-up; a map; a 3D prop; a chart.
**Where.** `research/capture.ts`, `footage/`, `maps/`, `render3d/`, new `research/brand.ts` (colours scored from CSS and
computed styles, logo, fonts, no model), new `research/image.ts` (image generation through the user's key, e.g. Gemini,
or SVG drawn by Opus in Creative mode).
**Who.** Tab (engine tools), Vignesh's footage and maps work stays where it is.
**Steps.** 1) `brand.ts` and its test on 10 known sites. 2) The decision tree as a table of rules (`research/tools.ts`)
with a trace of why each tool ran. 3) Asset roles from W1: your logos, photos, clips placed before any stock. 4) Image
generation behind a key check, never required.
**Check.** Brand colours match the site on 9 of 10 test sites; every film's trace names a reason for each tool used.

### W9. Floor rules and Lens on every film

**What.** The minimums no film ships without, as numbers in one module, used twice: the Designer avoids them, Lens
checks them, on every film and every change, in both modes.
**Where.** `engine/src/review/floor.ts` (new) read by `review/lint.ts` (CHECK, edits) and `review/film/` (style films),
and by `design/cast.ts`.
**Who.** Tab.
**The rules (from the map):**

| Area | Rule |
|---|---|
| Captions | at least 0.8 s on screen and 0.3 s per word; 2 lines and 7 words at most; never on the face; no change mid-word (today CHECK flags under 0.45 s; raise it as the players are fixed) |
| Transitions | 0.25–0.6 s, one direction, eased; never during a key word; the new frame holds 0.6 s before anything else moves |
| Text | headline at least 6 % of frame height, body at least 3.5 %; no beat with only text |
| Components | an image slot with no image swaps the component; real numbers and names only; at least 40 % of frame width |
| Theme | one palette, one type pair, one grade per film |
| Pacing | a visual change every 1.5–4 s; at most 1 effect per 5 s; no frame held over 4 s without motion |
| Sound | music 18 dB under the voice; no sfx on a key word unless it is the accent; −14 LUFS, no clicks |

**Steps.** 1) `floor.ts` with the numbers and a pure checker over a film's data (the EDL or a style's film.json). 2) CHECK
and the film review both call it. 3) The Designer refuses a cast that breaks it. 4) One fix: the Designer re-casts the
failing beat once, then ships the best and says what is off.
**Check.** D3.

### W10. Change it by chat, for every film

**What.** A chat change becomes ops on the film's plan; only the beats it touches change; each change is a version with
undo; any version downloads as MP4.
**Where.** Edits: `edit/reedit.ts` (exists; studio-wired in af7ceec). Generated films: `engine/src/change/` (new) with
ops over each style's film data: change a line, re-cast a beat, swap the voice or the music, change a preset value,
add a reference for taste. `talk.ts` sends every message on a film to the change parser first, Moovi's model call only
for what it cannot read.
**Who.** Tab (parser, versions), Ishaan's styles session (each style's ops on its film data).
**Steps.**
1. Versions: each change writes a new version folder that copies the plan files and hard-links the media (today versions
   share one folder, so going back shows the newest edit, and undo is one step). Undo and redo walk the list.
2. Ops for generated films, one style at a time, starting with Launch and Editorial.
3. "Moovi says what it understood in one line before it changes anything."
4. Download: each version renders the MP4 from the same clock on request.
**Check.** D5.

### W11. The taste system, and building UI morph and Kinetic

**What.** Ishaan's only ongoing job is sending references. Each reference: assigned to a type (or a new type proposed) →
broken into measured parts → each part mapped into the library (asset with `IN_TYPE` and a WHEN rule) and into the
type's motion branch (a law or a number) → coverage check (fewer than 5 references, or a gap: Moovi asks for N more and
says what is missing) → the type rebuilt → blind cross-test (new film, previous best, the reference, one round) → ships
only if better.
**Where.** `scripts/ref-intake.ts`, `scripts/ref-footage.ts` (exist), new `scripts/ref-map.ts` (parts → library rows and
motion laws), new `library/coverage.ts`, the blind judge harness (exists).
**Who.** Ishaan's library session with the `ishaan-motion` skill; Claude 1 runs the judge rounds.
**Steps.** 1) Map R1–R5 and l01–l12 parts into their types (today R1–R5 reach users only as a palette). 2) Coverage per
type on the board. 3) UI morph and Kinetic built from their seeds through this loop.
**Check.** D4 for every type; the coverage table shows at least 5 references per type.

### W12. The ishaan-motion tree

**What.** The skill becomes a tree: shared laws at the root (taste, feel, look, sound, shots), one branch per type
(camera, transitions, type and captions, sound, timing, bans). The Designer reads the branch of the type it casts; the
numbers in a branch are enforced by code.
**Where.** `.claude/skills/ishaan-motion/` (root plus `branches/<type>.md`), and a data mirror the engine reads:
`packages/library/src/types/<type>/motion.json`.
**Who.** Ishaan (the taste), Ishaan's library session (the data mirror).
**Check.** Every number in a branch exists in its `motion.json` and is used by a floor rule or the casting score (a
test lists any that is unused).

### W13. One library, every piece mapped

**What.** Every asset knows its types, when to use it, what it pairs with and its licence. Captions become one global
preset set; effects grow from about 20 to 40, each with a rule; unused queries are wired in or removed.
**Where.** `engine/src/library/catalog.ts`, `packages/graph/src/queries/library.ts`, `edit/captions.ts`, `edit/looks.ts`,
`edit/effects/catalog.ts`, `edit/moves.ts`.
**Who.** Ishaan's library session, Tab for the edit-side catalogues.
**Steps.** 1) `IN_TYPE {w, when}` on every shipped asset; an asset no type uses is flagged. 2) Captions: 8–12 premium
presets drawn from captionseasy and the 11 player styles; per type 1 default and 2 alternates; picked by type, speech
pace and face on screen. 3) Effects: each with when it fires, the maximum per film and its types; grow the set to 40.
4) The 9 read queries no code calls (styleCast, assetsForStyle, transitionForCut, resolveAsset, assetCredits,
assetKits, referenceParts, references, assetById): wire in or delete. 5) On-screen credits from `assetCredits`.
**Check.** A test fails if a shipped asset has no type or no WHEN rule; every caption on the benchmark comes from the
preset set.

### W14. The benchmark and the ratchet

**What.** One fixed benchmark per type, run the same way every time, scored blind.
**Where.** `docs/agents/research/R9-benchmark-set.md` (the edit set exists), new `bench/briefs.json` (5 briefs per
generated type), the judge scripts.
**Who.** Claude 1.
**Steps.** 1) 5 briefs per generated type and 5 clips for Edit, fixed. 2) The "level 3" film per brief: Opus with a
hand-written process prompt, made once, kept. 3) A round after each workstream lands: our film, the previous best,
level 3, blind. 4) Results in `STATUS.md`.
**Check.** D4, D7, D8 numbers exist for every type.

### W15. The Editor's preparation: takes and covered cuts

**What.** The map's Editor boxes for a raw recording of yourself: hear and look (exists), **find the takes** (the same
line said twice or more: keep the best, or the one you name), **clean cut, never a bare jump** (every cut gets a cover:
punch-in, transition, motion graphic or B-roll), Light / Balanced / Tight (exists since af7ceec), upscale and grade
(exists), clean the voice (exists), reframe on the speaker (face crop exists; speaker-aware across people is new).
**Where.** `edit/hear.ts`, `edit/cut.ts`, new `edit/takes.ts`, `edit/build.ts`, `edit/cast.ts`, `edit/reedit.ts` (a "use
take 2" op).
**Who.** Tab.
**Steps.** 1) `takes.ts`: group sentences by text similarity on the word timings; score fluency (fillers, restarts,
stumbles), pace and energy (loudness); keep one per group; `takes.json` records the choice and the others. 2) "use the
second take", "keep this one" in `parseEdit`. 3) The cover rule in the Designer's casting: no cut without a cover; a
cover is chosen from the type's slice. 4) Speaker-aware reframe when two faces alternate.
**Check.** On 5 raw clips with deliberate retakes: the kept take matches a person's pick in at least 4 of 5 groups; no
bare jump cut in any benchmark edit (code check on the EDL).

## 4. The order

| Phase | Workstreams | Why this order | Leaves |
|---|---|---|---|
| A. Foundation | W2 type registry, W4 agents, W9 floor rules, W10 step 1 (versions), W14 step 1–2 (benchmark and level 3), W15 takes | Everything else reads the type and is checked by the floor; versions make every later change safe to try | A measured baseline per type |
| B. One way in | W1 router, W3 brains (Tab's bridge phases 1–4) | The pipeline exists end to end on today's styles | D1, part of D7 |
| C. Craft | W5 Writer, W6 Sound, W7 Designer, W8 Researcher | The four stages the judges will see most | D3, most of D4 |
| D. Change and taste | W10 steps 2–4, W11, W12, W13 | Chat changes for every film; the types learn from references; UI morph and Kinetic built | D2, D4, D5 |
| E. Prove it | W14 rounds, D7 and D8 | The numbers that say Stage 1 is done | All checks in section 0 |

Phases A and B can run side by side (different owners and files). Each workstream lands on main as soon as its check
passes; a type keeps today's behaviour until its own check passes.

## 5. What gets retired

- The 4-lane router, Auto's keyword regexes (`urlStyleFor`, `autoStyleFor`) and the style menu, once W1 passes.
- The old crew path (`intake → match → playbook`, about 20 minutes a film), behind `MOOVI_DEFAULT_STYLE=crew` until D1,
  then removed. Its useful parts live on: Lens, Keeper, the Researcher.
- The combined MP4 film as a default (stays behind `MOOVI_AUTO_RENDER=mp4`).
- Per-style brief calls, once each style's Writer adapter passes its copy round.
- The 63 Edge voices in production (dev-only until a shippable engine replaces them).

## 6. Risks

| Risk | What we do |
|---|---|
| A rewrite stalls the event | Adapters, not rewrites: today's styles become the looks of the types; nothing is switched on until its check passes |
| Two owners in one file | The ownership in section 2; shared files (`review/config.ts`, `edit/job.ts`, `talk.ts`) change only after a log entry |
| The 2 GB server | Live previews only by default; MP4 on request; measure D8 on the server itself |
| Groq free tier (8k TPM, 200k tokens a day shared) | The Writer and type pick stay small in Precise mode; batch calls; the bridge moves heavy users to their own Claude |
| Creative mode terms | Tab's bridge rules: per job, user-triggered, no background runs |
| Taste drifts | The ratchet: nothing ships without beating the previous best blind |

## 7. Where things are

- The final pipeline: `docs/agents/maps/proposed.html`. Ishaan's words: `docs/agents/ISHAAN-VISION.md`.
- Today before the final merge: `docs/agents/maps/current.html`. The merge itself: main af7ceec (see `CLAUDE1.md`).
- The bridge: `docs/agents/research/mcp-claude-code-bridge-plan.md` (Tab).
- Teardowns: `research/opendesign-inspiration.md`, `cardboard-inspiration.md`, `promptsmotion-inspiration.md`.
- After Stage 1: `docs/agents/STAGE-2.md`.
