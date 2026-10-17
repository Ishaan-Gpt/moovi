# OpenDesign "directing brain" — reverse-engineering notes for Moovi

Area key: `direct-brain`. Source: OpenDesign (OD) commit 78d5637 (2026-10-16), read-only clone at
`scratchpad/ext/open-design`. Nothing from OD was installed, built or run. Moovi repo read-only at
`C:\Ishaan GPT\hackthons\moovi` (main, 5e76a55).

Paths below are relative to the OD root unless prefixed `moovi:`. Line numbers are from this commit.

---

## 0. The one-paragraph answer

OD's agent does not "have taste"; taste is *composed into the prompt as data* and *checked by code*. A run's system
prompt is a stack of layers with an explicit precedence list (user's current turn > active skill/design system >
memory/custom instructions > charter). The visual direction is never improvised from scratch: it comes from (a) an
active design system's `tokens.css` pasted verbatim, (b) a brand spec extracted from real CSS/screenshots into six
OKLch tokens + fonts + 3–5 posture rules, or (c) a closed 5-entry direction library whose palettes/fonts are bound
verbatim ("never infer colours from the name"). Universal craft rules (`craft/*.md`, concrete numbers: tracking, accent
caps, durations, contrast) are injected only when a skill opts in. A greppy linter (`lint-artifact.ts`) checks the P0
anti-slop list on every saved artifact and feeds findings back as a system reminder. Memory is injected into every run
as an "intent gateway", and memory *rules* (Assertion/Check) are enforced by a self-verify scorecard that the daemon
parses and scores. Two prompt strategies coexist: legacy (plan → build → checklist → 5-dim self-critique) and OD Next
(separate planning turn → host-started production turn; "ship-on-write", post-build checks forbidden by a regex guard,
except one bounded review for video). For small models: seeds/templates instead of writing from scratch, closed
vocabularies, verbatim tokens, full inline libraries when the model has no tools, and an API-mode override that kills
pseudo-tool markup.

---

## 1. Exact prompt layering (legacy path, `apps/daemon/src/prompts/system.ts`)

`composeSystemPrompt` starts at `system.ts:900`. First line of real logic is the fork:

- `system.ts:953` — `if (odNextStrategyRecipe) return composeOdNextStrategyRequestPromptV2(...)`. OD Next runs never
  see anything below. (`docs/prompt-composition.md:7-22` explains; the doc cites line 905, the code is now at 953.)
- Default core is **slim**: `server.ts:10664` sets `promptCoreVariant: 'slim'` unless `OD_PROMPT_CORE=classic`.

Order of `parts.push(...)` for a slim, design-mode, filesystem run (each separated by `\n\n---\n\n`):

| # | Layer | Where | Gate |
|---|---|---|---|
| 1 | (plain/BYOK only) `API_MODE_OVERRIDE` — "no tools; don't emit pseudo-tool markup" | `system.ts:1022-1030`, text `1631-1655` | `streamFormat === 'plain'` |
| 2 | **Slim charter** (role, task types, instruction priority, security, clarification phase, design phase, refinement phase, delivery, design craft, technical contract, conduct) | `core-slim.ts:89-405` | slim + not ask + not media |
| 3 | Runtime plan-tool note (TodoWrite vs update_plan vs todowrite) | `system.ts:1057-1060`, `1571-1630` | slim charter head |
| 4 | Session mode override (Plan mode / Ask mode) | `system.ts:1103-1110` | sessionMode |
| 5 | Example-prompt or skip-discovery override | `system.ts:1119-1125` | metadata |
| 6 | UI locale prompt | `system.ts:1127-1133` | locale |
| 7 | (classic only) DISCOVERY_AND_PHILOSOPHY (~3k tokens) | `system.ts:1136-1138`, `discovery.ts:25-249` | not media, not ask, classic |
| 8 | **Direction library**: full specs inline, or slim index + pull command | `system.ts:1146-1160`, `directions.ts:291-322` | only when NO active design system |
| 9 | Shared device frames | `system.ts:1170-1176` | multi-target only |
| 10 | Platform delivery contracts | `system.ts:1183-1191`, `core-slim.ts:414-418` | metadata platform |
| 11 | (classic) designer charter `official-system.ts` | `system.ts:1197-1208` | classic |
| 12 | **Personal memory** + memory-applied chip + **self-verify scorecard** instructions | slim `system.ts:1210-1231`; classic `1233-1259` | memory present |
| 13 | Custom instructions user-level, then project-level (project wins) | `system.ts:1261-1271` | present |
| 14 | Design system: USAGE → DESIGN.md → import mode → tokens.css → component manifest (or fixture) → pull-layer index | `system.ts:1273-1324` | active DS |
| 15 | **Craft references** (concatenated `craft/<slug>.md`) | `system.ts:1326-1334` | slugs resolved |
| 16 | **Active skill** body + derived preflight list of files to read | `system.ts:1336-1341`, `2221-2238` | skill |
| 17 | Semantic output filenames | `system.ts:1343-1345` | not ask |
| 18 | Plugin block, then per-stage atom blocks | `system.ts:1347-1363` | plugin |
| 19 | Project metadata block (facts mode in slim) | `system.ts:1365-1373`, `1751-2125` | metadata |
| 20 | Deck framework skeleton pinned late | `system.ts:1395-1416` | deck |
| 21 | Media generation contract or dispatch hint | `system.ts:1418-1443` | media / signal |
| 22 | Critique Theater panel protocol | `system.ts:1455-1458`, `panel.ts` | `OD_CRITIQUE_ENABLED` (default off) |
| 23 | Turn-variable blocks (platform/deck/media signals flipped mid-chat) | `system.ts:1474` | slim |
| 24 | Skill write boundary | `system.ts:1492-1494` | filesystem |
| 25 | Question-form + "how your turn is rendered" (classic/ask only) | `system.ts:1500-1527` | |
| 26 | Role-marker guard, pinned LAST "so recency bias reinforces" it | `system.ts:1531-1547` | always |

Ordering principle (comment `system.ts:1005-1021`): **stable content first** for prompt-cache prefix reuse; turn-varying
signals at the end so a mid-chat flip only invalidates the suffix. `stable-sections.ts:1-60` hashes each named input
group (memory, intent, mode, design-system, …) to attribute which input moved the cached prefix (memory churn is the
dominant cause).

Precedence written into the charter (`core-slim.ts:113-124`): (1) user's explicit current-turn request; (2) active
skill (workflow) and design system (visual tokens), each authoritative in its scope; (3) memory + custom instructions;
(4) the charter. Plus a "factual-integrity invariant" no skill can override (no generated look-alike for a named real
referent). The craft block states its own tie rule (`system.ts:1332`): brand wins token values, craft wins everything
the brand doesn't specify (tracking, accent caps, anti-slop).

Skill → craft selection (`craft.ts:45-69`): slugs = skill `od.craft.requires` ∪ design-system `applies` ∪ (`typography`
forced for any deck), minus design-system exemptions; web-clone runs get none. Loader `craft.ts:78-103` concatenates
`### <slug>` sections, silently skipping missing files (repo lint `pnpm lint:craft` catches typos, `craft/README.md:46-62`).

Token budgeting is by **gating and indexing**, not counting:
- media surfaces drop the ~3,000-token discovery layer (comment `system.ts:1112-1118`);
- the ~6.7 KB direction library becomes a one-line-per-direction index + `od tools directions --id` on filesystem runs,
  but stays inline for BYOK text-artifact runs that cannot call tools (`system.ts:1146-1160`, `directions.ts:304-322`);
- design-system rich files are a "pull-layer index", read on demand through an allowlisted CLI (`system.ts:1320-1324`);
- shared frames only for multi-target (`discovery.ts:273-283`: "~490 dead tokens");
- Ask mode drops the whole charter (`system.ts:1094-1101`).

### OD Next path (`packages/contracts/src/prompts/od-next-strategy.ts:668-725`)

Sections joined by `---`: execution+security boundary → filesystem/text execution → recipe identity (hashes) →
discovery/planning surface (`:413-437`) → **stable request context** as `<od-next-context kind="fact|instruction"
name="…">` blocks (runtime selection, plan-tool note, deck framework, project metadata, template, device frame, memory,
custom instructions, design system identity/design/usage/tokens/components/fixture/pull-index, craft sections + craft
body; `:493-625`) → core strategy markdown (`plugins/_official/scenarios/od-next-strategy/assets/core-system-prompt.md`)
→ general orchestration markdown (`assets/general-orchestration.md`) → exactly one task profile (`assets/task-profiles/
<type>.md`, mapping in `references/task-profile-mapping.md`) → active stage atom blocks → output contract.
Facts vs instructions are typed; instruction blocks pass a guard (below).

---

## 2. How a brief is expanded

### 2.1 Clarify only when it changes the result
`core-slim.ts:128-196` (slim) / `discovery.ts:39-96` (classic):
- Decide per brief whether clarification is needed, using request + conversation + metadata + plugin inputs + skill +
  design system. Missing field ≠ reason to ask.
- If needed: one short sentence + one `<question-form>` (JSON body), then **end the turn**. Max one form per turn.
- 1–3 questions usually, **hard cap 5** (`discovery.ts:90`: count and delete least build-critical).
- Priority of what to ask: task type → audience → primary goal → platform → content scale → constraints
  (`core-slim.ts:157`).
- Default question bank for minimal briefs: `output`, `platform` (≤4 options), `audience`, `brand` with fixed branch
  values `pick_direction | brand_spec | reference_match`, `scale`, `constraints` (`core-slim.ts:163-172`).
- Every non-visual question is **prefilled with a recommended default** so the form can be submitted unchanged; the
  `default` key is placed before `options` because the host renders token-by-token (`discovery.ts:83`).
- With an active design system, never ask brand/style/theme/palette (`core-slim.ts:159`).
- Skip on "just build", local revisions, and `[form answers — …]` replies (answers become locked).
- Options ≤6–7, labels in the user's words ("Magazine-style layout", not "Editorial"), ≤40 chars (`core-slim.ts:179-183`).

### 2.2 Route first (task type)
`plugins/_official/scenarios/od-default/SKILL.md`: infer the task type; emit the `task-type` form only when two or more
routes remain materially plausible and the wrong one changes the delivery format; preselect the inferred route;
never follow with a second discovery form.

### 2.3 Visual direction: decided by the agent, not asked
- Atom `plugins/_official/atoms/direction-picker/SKILL.md`: resolve direction in order DS → user brand source → infer
  from domain/audience/tone; "Do not ask the user to choose a visual direction"; a stated direction must be a defensible
  standalone bet; never infer palette from a direction's name.
- Brand source present (Branch A, `discovery.ts:109-124`, slim `core-slim.ts:206-214`): locate source → download CSS /
  guide / screenshots → `grep` real hex values ("Never guess colors") → write `brand-spec.md` with six OKLch tokens
  (`--bg --surface --fg --muted --border --accent`), display/body/mono stacks, 3–5 observed posture rules → **vocalise
  the system in one sentence** so the user can redirect cheaply.
- No source: pick from the direction library (`directions.ts:59-190`): 5 directions (editorial-monocle, modern-minimal,
  human-approachable, tech-utility, brutalist-experimental), each = `{id, label, mood, references[], displayFont,
  bodyFont, monoFont?, palette{6 OKLch}, posture[]}`. Rendered as a CSS-ready `:root` block + posture bullets
  (`renderDirectionSpec`, `:260-289`) and bound **verbatim**. Purpose comment `:11-19`: "One radio click → a
  deterministic palette + type stack, no model improvisation." The user-facing picker form is dormant (`:192-209`);
  only the inference path is live.
- OD Next (`general-orchestration.md:119-127`): when no style is specified, infer a direction from scenario, audience
  and "content temperament" (colour mood, type personality, density, decorative weight), write it into the Design Spec,
  vocalise it in one sentence.

### 2.4 Memory as an "intent gateway"
`system.ts:1235` (classic) / `1216` (slim): short asks are silently expanded into a full internal brief (task type,
profile, project context, delivery prefs, known feedback meanings, constraints, finish line) from memory; never re-ask
what memory holds; doesn't skip planning or the self-check.

### 2.5 The "creative-director" family of skills
`skills/creative-director/SKILL.md` is a catalogue stub pointing to upstream (smixs); OD only adds a 6-step "orchestration
mode" (`:25-48`: define "good-looking" first incl. explicit anti-patterns, inspect target, search every resource, map into
lanes critique/style/assets/motion/proof/polish/verification, guided choice set with recommended default when ambiguous).
`enhance-prompt`, `brainstorming`, `design-consultation`, `frontend-skill` are pure stubs (no workflow body in OD).
Real content lives in: `design-brief` (closed-vocabulary resolver), `frontend-design` (Anthropic's, workflow + self-review),
`gpt-tasteskill`, `brutalist-skill`, `emil-design-eng`, and `motion-design` (OD original).

---

## 3. How taste is encoded

### 3.1 Banned patterns (three copies, same list)
- `core-slim.ts:295-310`: purple gradient wash / gradients everywhere; emoji as icons; left-colour-bar rounded callout;
  hover that greys text; hand-drawn SVG people; duplicate solid CTAs / icon by every heading; Inter/Roboto/Arial/
  Fraunces as display; invented metrics / filler; warm beige/cream default grounds; designer-only control panels.
- `core-system-prompt.md:217-234` (OD Next) — same list, "a selected visual style never exempts it".
- `craft/anti-ai-slop.md:14-41` "seven cardinal sins" (P0, auto-linted), P1 soft tells `:43-56` (Hero→Features→Pricing→
  FAQ→CTA with no variation; placeholder CDNs; >12 raw hex outside :root; `var(--accent)` 6+ times), P2 `:58-65`.
- "Soul" rule `anti-ai-slop.md:67-84`: ~80% proven patterns + ~20% distinctive choice (one bold move, specific
  microcopy, one memorable micro-interaction, one product-insider detail). Test: could an outsider tell which product it
  is from a screenshot?

### 3.2 Concrete numbers
- Type scale ×1.2/×1.25, ≤6–8 sizes; display 48–72, H1 32–48, body 15–18, caption 11–12 (`typography.md:10-22`).
- Tracking: ALL CAPS **+0.06–0.1em required**; 32px+ −0.01/−0.02em; display 48+ −0.02/−0.03em (`typography.md:63-87`).
- Leading Latin display 1.0–1.2, body 1.5–1.6; CJK display 1.3–1.4, body 1.7–1.8 (`typography.md:24-61`).
- 3 weights (400/510/590); measure 50–75ch (`typography.md:98-111`).
- Palette shares: neutrals 70–90%, one accent 5–10%, semantic 0–5%, effects <1%; accent ≤2 visible uses per screen
  (`color.md:11-32`); contrast 4.5:1 body, 3:1 large/UI (`color.md:34-46`); dark bg #0f0f0f not #000.
- Hover moves bg ±0.06–0.12 OKLch L; never lower text contrast in any state (`core-slim.ts:326-333`).
- One decisive flourish; three is noise (`core-slim.ts:318`, `discovery.ts:236-237`).
- Motion (UI): 50–100 ms instant feedback, 150 ms default, 200–300 entering, 300–500 cross-screen; frequent hovers
  ≤200 ms; mobile 20–30% shorter; M3 standard easing `cubic-bezier(0.2,0,0,1)`; ≤3 flashes/s
  (`animation-discipline.md:36-57,108-116`).
- OD Next baseline (`core-system-prompt.md:193-237`): spacing multiples of 4/8; small interactions 150–300 ms, larger
  ≤400 ms; **exits at 60–70% of entrance duration**; ease-out enter / ease-in exit; list stagger 30–50 ms; key content in
  central 70–80% of canvas, ≥50 px from edges; on 1080 canvas titles ≥48 px, body ≥24 px. Trade-off order when they
  conflict (`:294-296`): accessible/readable > usable > hierarchy > stylistic expression > decorative density.
- Marketing profile: on a 1080 canvas headline 48, subhead 32, body 24, captions 18, CTA 28 px; text ≤20% of an ad
  frame; one CTA starting with a verb, ≥44 px tall; readable at 50% scale.
- Motion film (`motion-design.md:116-121`): accent 120–220 ms; main arrival 350–650; meaningful transformation
  600–1200; large reveal/camera 900–1800.
- HyperFrames video (`hyperframes.md:104-115`): short titles on screen ≥1.5 s; full sentences ~1 s per 4 Chinese chars
  plus headroom; vertical platforms keep key text out of top 15% and bottom 20%; horizontal 5% padding; contrast ≥4.5:1;
  "with the sound off, the picture alone must still carry the main message" (`:126`).

### 3.3 Hierarchy as contracts (not just sizes)
`typography-hierarchy.md:15-27`: one dominant entry point; rhythm = contrast between levels; recoverable information flow.
Five vectors (scale, weight, spacing, tracking, alignment), ≥2 active on the dominant element; lint list `:156-165`
(adjacent levels ≥1.25× apart or compensated). Editorial variant: display/deck jump 3–5×, pull quote 28–40 px, ≤2 per
article, bold ≤2 per 400 words (`typography-hierarchy-editorial.md:24-36,162-182`).

### 3.4 Checkers that run on output
`apps/daemon/src/lint-artifact.ts` (1000 lines), greppy and deterministic:
- P0: purple/indigo gradient, blue→cyan trust gradient, solid Tailwind-indigo accent (7 hexes `:78-81`), slop emoji
  (`:83-86`), left-accent rounded card, sans display (`:109-110` regex), invented-metric phrases (`:90-96`), filler
  (`:98-104`), `scrollIntoView`, slide missing light/dark theme class.
- P1: ALL CAPS without ≥0.06em tracking (resolves CSS vars and font-size), external placeholder images, raw hex outside
  :root, `var(--accent)` >6 inline uses (`:431-447`), **slide rhythm: three same-theme slides in a row** (`:483-509`).
- `renderFindingsForAgent` (`:519-536`) wraps findings in `<artifact-lint>` with severity counts, fix and snippet, and
  tells the agent to re-emit a corrected artifact without explanation. Wired into artifact save + lint routes
  (`routes/project/index.ts:5756-5781`). Not a hard block (`craft/README.md:69-76`).

### 3.5 Variety / anti-first-choice
`skills/gpt-tasteskill/SKILL.md:124-131,178-185`: makes the model "simulate" a seeded Python RNG (seed from prompt char
count) to pick 1 hero architecture, 1 type stack, 3 component architectures, 2 GSAP paradigms, then a mandatory
`<design_plan>` with RNG output, structure check, "hero math" (H1 ≤2–3 lines via max-width), bento density proof, label
sweep. Legacy discovery (`discovery.ts:211-212`) also defaults to 2–3 differentiated directions when exploring.

### 3.6 Closed vocabulary → concrete tokens
`skills/design-brief/SKILL.md:102-163`: 8 dimensions with a closed value set; each symbolic value maps to concrete
hex/fonts/spacing; unknown values must trigger a clarification; defaults chosen by mood rules; at the end report every
defaulted dimension and the rule that chose it (`:248-259`). (Its own token table uses Inter/electric blue — it predates
the anti-slop rules; a contradiction inside OD.)

---

## 4. Modes

- `docs/modes.md`: UI tabs (Prototype, Live Artifact, Deck, Template, Media{Image,Video,Audio}, Other) vs skill
  registry modes (`prototype|deck|template|design-system|image|video|audio`, plus `utility`). A selected template
  replaces the tab's default skill (no stacking).
- Prototype: platform contracts (breakpoints 360…1920, iPhone frame + 44 px targets, Pixel + 48 dp; domain modules by
  default) `core-slim.ts:414-418`, `discovery.ts:180-186,224-234`.
- Deck: canonical framework scaffold pinned late and copied verbatim (nav, scale-to-fit, counter, print) —
  `discovery.ts:154`: never write your own; `data-od-deck-protocol="1"` host contract from a single source
  (`packages/contracts/src/prompts/deck-framework.ts`); typography craft forced (`craft.ts:65`); titles ≥36 px / body
  ≥24 px at 1920×1080; theme rhythm linted.
- Image/Video/Audio media: discovery and charter skipped; the media generation contract is the sole authority
  (`system.ts:1094-1118, 1418-1443`; `media-contract.ts`). `hyperframes-html` video model = local HTML→MP4 renderer:
  "ask at most one clarifying question", scaffold, author, dispatch (`system.ts:1922-1926`).
- OD Next video: `task-profiles/motion-design.md` (identical to `skills/motion-design/SKILL.md`, synced by script) and
  `task-profiles/hyperframes.md`. Video is the ONE exception to ship-on-write (bounded review, §6).

---

## 5. Keeping weak/small models good

1. **Seed + layouts instead of writing from scratch** — `discovery.ts:188-194` ("the single biggest reason guizang-ppt
   outputs look better…: the agent isn't re-deriving good defaults each time"); `core-slim.ts:229-241` (read template,
   reuse CSS, fill placeholders, keep runtime bindings).
2. **Verbatim tokens** from DS `tokens.css` ("Do not invent tokens… no raw hex outside :root", `system.ts:1304-1308`) or
   from the direction library.
3. **Full inline libraries when no tools**: BYOK text-artifact runs keep the full direction spec (`system.ts:1150-1159`).
4. **API-mode override at the top** (`system.ts:1631-1655`) to stop `<todo-list>`/`[reading X]` pseudo-tool prose
   (issue #313). Placed first because a later-placed override lost the "precedence war".
5. **Closed vocabularies** (design-brief, direction ids, brand branch values, form `value`s stay English).
6. **Deterministic checks** (linter) instead of asking the model to self-judge taste.
7. **Small model for memory extraction** with strict-JSON prompts and fallbacks (`memory-llm.ts:81-147`, provider
   defaults haiku/gpt-4o-mini); heuristic pass first for rule distillation (`memory-rules.ts:1-16`).
8. **Gating** irrelevant layers so small context windows hold the relevant ones.

---

## 6. Plan → build → self-check

### Legacy
`discovery.ts:134-174`: first tool call is TodoWrite with a standard 9-step plan (read DESIGN.md + skill assets → bind
tokens → plan section/slide list aloud → copy seed → fill layouts → replace placeholders with real copy → **checklist
P0 must pass** → **5-dim critique** → summarise). Live todo updates. Critique dims: Philosophy, Hierarchy, Execution,
Specificity, Restraint, 1–5; anything <3 is a regression; fix the weakest, re-score; "Two passes is normal".
Slim (`core-slim.ts:243-269`): one ordered pre-delivery check (completeness → skill P0 checklist → visual quality incl.
overlaps/overflow/state contrast → imagery provenance → render **at most once** via `od export --format image`, only if
static review can't decide; never launch own browser). Memory rules: craft self-check → verify scorecard → handoff
(`system.ts:1223-1227`).

### OD Next
- Planning turn writes a prose plan (goal, deliverables, direction, steps, assumptions) + host marker
  `<od-production-ready key=…/>` as the last line; host starts production next turn automatically; no plan approval
  asked (`general-orchestration.md:79-107`).
- Production turn: "ship-on-write" — writing the files IS delivery; no screenshots, renders, previews, validation
  scripts, acceptance agents or fix rounds after write (`general-orchestration.md:13-46,184-190`). Quality must come
  from generation-time discipline.
- Enforced by code: `FORBIDDEN_POST_BUILD_SEMANTICS` regexes (`od-next-strategy.ts:207-286`) reject any instruction text
  (core, orchestration, task skill, stable-context instruction blocks) mentioning checklist/verification/critique/judge/
  render-and-inspect/screenshot-review loops; `assertOdNextPlanningBuildOnlyV2` throws (`:289-301`).
- **Video exception** (`core-system-prompt.md:131-138`, `motion-design.md:350-366`): after the first render, one review
  of source + MP4: clock/dimensions, captions vs factual invariants, **at most three frames (opening, key explanation,
  ending)**, audio track present; **at most one targeted repair + re-render**; no aesthetic scores, no acceptance agents.

### Critique Theater (opt-in)
`panel.ts:45-226`, defaults `packages/contracts/src/critique.ts:57-71`: designer drafts; critic (hierarchy, type,
contrast, rhythm, space), brand, a11y, copy score 0–10; weights critic .4, brand .2, a11y .2, copy .2; ship when
composite ≥8.0 AND open MUST_FIX = 0; maxRounds 3; each scoring panelist must declare ≥1 MUST_FIX per non-final round;
≥2 panelists must diverge; round n+1 transcript must be shorter; daemon recomputes composite (`composite_mismatch`),
fallback `ship_best`. Default pipeline `od-new-generation`: discovery → plan → generate → critique repeat until
`critique.score>=4 || iterations>=3` (scale mismatch with the 0–10 panel is unresolved).

---

## 7. Memory loop (relevant to "remembers how you like them")

- Extraction prompt `memory-llm.ts:81-111`: remember only if about the user/prefs/tools/ongoing work/stable references,
  still true in a week, and would change a later unrelated chat; types user|feedback|project|reference; strict JSON.
- Annotation distiller `memory-llm.ts:119-147` and `memory-rules.ts:44-67`: turns review annotations on artifacts into
  `feedback` or `rule`; a rule body is exactly `Assertion: …` / `Check: …` (+ `Verified by:`); "make THIS button green"
  is one-off, "always brand green for primary" is durable; ≤24 annotations → ≤8 proposals; surfaced through a Keep gate,
  never written silently.
- Rendering `memory.ts:620-700`: Profile FIRST (key/value lines), Verified rules LAST (rubric with Assertion/Check).
- Enforcement `memory-verify.ts:82-138`: after an artifact turn with active rules, parse the `verify-scorecard` card;
  missing card → `missing`; each rule must be covered by a row (substring of name/check or ≥2 shared significant words,
  `:60-80`); any `fail` row or uncovered rule → `fail`; results ring-buffered and SSE-emitted.

---

## 8. Mapping onto Moovi (what exists, what doesn't)

Moovi's directing pieces (read-only survey):
- **Auto (default) live path**: `moovi:packages/engine/src/router/job.ts:79-98` `autoLive` — link → `urlStyleFor` regex
  (`:71-78`); plain words → `direct()` (one call, families darkvox/anatomy) → `autoPickFor` (`:65-70`, regex
  `autoStyleFor` `:56-60` then `pickClipMoment`) → `matchKit` palette → `styleReel`. Pick reasons only `console.log`
  (`:88,96`). No user feedback memory, no lessons, no craft graph.
- **Auto MP4 film**: `moovi:router/film.ts:85-118` `direct()` — schema `DirectorOut` (`:69-82`) with `accent` = free
  "one hex colour that suits the topic" (`:71`, fallback `#C8102E` at `:229`); S1 segments get fixed secondary/tertiary
  `#1F6F4A/#E0A33A` (`:198`). Rules 1–9 in prompt; validate word count ±8–10%, 5–9 beats, exactly one quote, no dashes.
  Router `moovi:router/route.ts` is deterministic (rules 1–7, footage share ≥35–40%, each house style once).
- **Style kit** (the strongest part): `moovi:styles/kit/script.ts` (arc slots as named fields, script doctor, invented-
  number filter, grounded() share, one quality bounce), `arcs.ts` (17 arcs, `Signals`), `library.ts` cast with jitter and
  graph memory, `compose.ts` enum-only improvisation. `docs/MODELS.md` "Why a weak model still makes a good film" lists 8
  mechanisms already in place (narrow asks, constrained decoding, coercion, repair turns, tools-as-words, doctor, trust
  merge, pacing). **Don't re-propose these.**
- **Crew path** (uploads / `MOOVI_DEFAULT_STYLE=crew`): `tasks/plan.ts` (Brief with angle/hookForm, clash check vs used
  angles), `tasks/director.ts` (style card with contrast gates 7:1 / 2.2:1 / 4.5:1, board with many validators, rejected-
  shot memory, PageRank over-use), `tasks/lens.ts` (law-driven machine checks + 16-frame sheet, ≤2 rounds),
  `tasks/keeper.ts` (`learn()` → imperative lesson + topic supersede), `tasks/agent.ts` (`knowledge()` from craft graph,
  `systemFor`). `memory.ts` (Feedback nodes; `memoryBlock`, `steerStyle`, `voiceFor`).
- **Edit path**: `moovi:edit/plan.ts` one fast call for beat tags, deterministic EDL; `edit/score.ts` R9 score.
- **Taste source for humans**: `moovi:.claude/skills/ishaan-motion/SKILL.md` (five non-negotiables, never-the-first-idea,
  motion laws with numbers, banned effects §7, ratchet judge). It is not consumed by any runtime prompt.

Gaps vs OD, in order of payoff (detailed transfers in the structured findings):
1. Default Auto/live path ignores the user's memory and lessons → OD injects memory everywhere and verifies rules.
2. Lessons are prose; no checkable rules, no verification → OD Assertion/Check + scorecard + coverage.
3. Style routing is regex → OD infers route/direction from signals, vocalises it, asks only if materially ambiguous.
4. Free-hex accent and fixed secondaries → OD closed direction library bound verbatim.
5. No film-level art direction (premise, motif, poster frame, per-beat takeaway/focal/transformation) → OD motion-design
   beat map and "one strong representative frame first".
6. No pre-render lint on the plan for Auto/live → OD linter P0/P1 fed back as one repair.
7. House rules duplicated across prompts; ishaan-motion not in runtime → OD craft files with opt-in slugs, single source.
8. No layered composer / precedence / cache-stable order / token gating → OD composeSystemPrompt.
9. Plain-words Auto script is ungrounded (model memory) → OD factual-integrity invariant + research contract.
10. Pick reasons and defaulted dimensions not told to the user → OD vocalise + attribute defaults.
11. Lens is 16 frames × 2 rounds; Auto has no review → OD bounded 3-frame / 1-repair video review.
12. Ratchet judge is prose → OD panel protocol (parseable, recomputed composite, MUST_FIX gate).

---

## 9. Things not established
- Whether OD Next's "ship-on-write" measurably beats the legacy self-critique loop (no eval data found in repo).
- The default-pipeline `critique.score>=4` threshold vs panel's 0–10 scale: which applies at runtime was not traced.
- Live behaviour on https://open-design.ai was not observed (no browsing done for this area).
- Whether craft bodies containing words like "Lint"/"checklist" would trip OD Next's forbidden-semantics guard when
  injected as `active-craft-guidance` (guard regex includes `\bchecklist\b`); not tested.
- Exact token sizes of each layer (only the comments' estimates: discovery ~3k tokens, direction library ~6.7 KB,
  shared frames ~490 tokens).
