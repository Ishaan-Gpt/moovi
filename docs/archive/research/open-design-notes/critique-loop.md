# OpenDesign: quality control, the critique theater and every judge/verify/repair loop

Area key: `critique-loop`. Source: OpenDesign (OD) at commit 78d5637 (2026-10-16), cloned read-only. All paths below
are relative to the OD repo root unless they start with a Moovi path. Line numbers are from that commit.
Nothing in OD was built or run; everything here comes from reading source, prompts and docs.

---

## 0. TL;DR

1. **The famous "Design Jury / Critique Theater" is retired.** It was a five-persona panel role-played by the *same
   model in the same output stream* (no screenshots, no second model). It was hard-disabled on 2026-08-26
   (`apps/daemon/src/critique/rollout.ts:84-107`, `CRITIQUE_THEATER_RETIRED = true`) because its tag grammar kept
   leaking into the chat. The code, UI, metrics and spec all still exist and are well engineered, so the *mechanisms*
   are worth reading, but OD itself concluded the theatrical panel was not worth it.
2. **What OD actually relies on now** is (a) quality moved *upstream* into the plan (design spec, seed templates,
   layouts, checklists, anti-slop lists in the system prompt), (b) a silent self-check the generating model runs
   before it emits (P0 checklist must pass + a 5-dimension 1–5 radar, fix anything under 3, two passes normal),
   (c) deterministic code checks (an anti-slop HTML linter, DOM checks for CTA hierarchy and deck clipping, export
   assertions for MP4 audio/frames), and (d) for video only, **one bounded review of the rendered film: clock and
   dimensions, captions against factual invariants, at most three representative frames, at most one targeted
   repair and re-render, no acceptance agents, no aesthetic scores** (`plugins/_official/scenarios/od-next-strategy/
   assets/task-profiles/motion-design.md:352-366`).
3. **OD Next actively bans post-build judge/repair loops** in its first-party strategy recipes with 15+ regexes
   (`packages/contracts/src/prompts/od-next-strategy.ts:207-297`). The only exception is the bounded video check.
4. The best *video* QA in the OD tree is not in the daemon but in two bundled skills: `oil-motion` (deterministic
   frame-sequence analysis in Python: blank, near-duplicate, brightness/scale/centre jumps; SSIM seam checks between
   chained segments; a hashed "pilot approval" gate) and `huashu-art-motion` (stills at 0.4/0.6/0.8/1.0 of every
   segment, a numeric qa pass for motion/jumps/frame time/determinism, at least 3 rounds per segment, and a reviewer
   who did not make the film watches only the finished film).
5. **Moovi already has more real QA than OD in some paths** (Style 1 geometry QA from renderer boxes with
   pixel-precise fix text, the Style 1 vision critic against the owner's gold films, Lens with craft-graph laws and
   scene-scoped reopen, and Vignesh's deterministic frame critic with per-scene scores and partial re-render). The gap
   is that **none of that runs on the live styles that users actually get by default** (Auto, Editorial/s4, Clear
   Signal/s5, Dark Vox, Anatomy, Clip Moment): they serve the preview, take a contact sheet afterwards, log empty
   frames, and stop. Section 10 designs a bounded per-beat critique loop for them.

---

## 1. Inventory: every quality loop in OD and its real status

| Loop | Where | Who judges | Sees | Status at 78d5637 | evidence |
|---|---|---|---|---|---|
| Critique Theater / Design Jury | `apps/daemon/src/critique/**`, `apps/daemon/src/prompts/panel.ts`, `apps/web/src/components/Theater/**` | the generating model, role-playing 5 panelists in one stream | its own HTML source (in-context), brand DESIGN.md | **Retired**: `isCritiqueEnabled` returns false unconditionally | source |
| Pipeline devloop `critique` stage | `plugins/_official/scenarios/od-new-generation/open-design.json` (`until: "critique.score>=4 \|\| iterations>=3"`), `apps/daemon/src/plugins/until.ts`, `pipeline.ts`, `atoms/registry.ts` | regex over a prose summary | n/a | **Mostly scaffold**: permissive default `critique.score: 4` and `preview.ok: true` satisfy `until` immediately | source |
| `critique-theater` atom (prose) | `plugins/_official/atoms/critique-theater/SKILL.md` | generating model | own artifact | Live only when the protocol is injected (gated by `plugins/critique-prompt-gate.ts`), now told to report in plain prose, 3 passes max | source |
| Prompt self-check (P0 checklist + 5-dim radar) | `packages/contracts/src/prompts/discovery.ts:143-176`, `apps/daemon/src/prompts/core-slim.ts:238-272`, `official-system.ts:103-111` | generating model, silently | own file; at most one rendered image via `od export --format image` | **Live** (legacy/default path) | source |
| Anti-slop HTML linter | `apps/daemon/src/lint-artifact.ts` (18 rules), `POST /api/artifacts/save` and `/api/artifacts/lint`, `od lint --fail-on p0` | deterministic code | raw HTML string | **Live** in the daemon and CLI; the web client ignores the `lint` field it gets back (`apps/web/src/providers/daemon.ts:2783-2800`) | source |
| CTA hierarchy QA | `apps/daemon/src/qa/cta-hierarchy.ts` | deterministic (cheerio) | parsed DOM | first version; "HTTP/CLI exposure and auto-repair are explicit follow-ups" | source |
| Deck layout QA | `apps/daemon/src/qa/deck-layout.ts` | deterministic (cheerio) | parsed DOM | hard guard inside brand-system rebuild | source |
| Motion MP4 export assertions | `apps/daemon/src/artifacts/motion-delivery.ts` | deterministic (ffmpeg) | the MP4 and the HTML source | live | source |
| Bounded video check | `od-next-strategy/assets/core-system-prompt.md:131-137`, `task-profiles/motion-design.md:352-366` | generating model | rendered MP4: ≤3 frames + captions + clock | live in OD Next for video-motion only | source (prompt) |
| Memory verified-rules scorecard | `apps/daemon/src/memory-rules.ts`, `memory-verify.ts`, `packages/contracts/src/prompts/system.ts:483-486` | generating model writes scorecard; daemon checks coverage deterministically | own artifact vs the user's rules | prompt live; **`enforceVerify` has no call site in daemon src** (only list/clear routes) | source |
| review-animations / emil-design-eng skills | `skills/review-animations/{SKILL,STANDARDS}.md`, `skills/emil-design-eng/SKILL.md` | the model, as a strict reviewer | motion code | catalogue skills, user-invoked (`disable-model-invocation: true`) | source (prompt) |
| Hallmark slop test | `plugins/community/hallmark/references/slop-test.md` | model self-critique, 6 axes incl. Variety + 60 yes/no gates | own output + `.hallmark/log.json` | community plugin | source (prompt) |
| oil-motion QA gates | `skills/oil-motion/scripts/{motion_pipeline,production_gate}.py`, `references/qa.md` | deterministic Python + human/agent pilot approval | decoded frames | bundled skill scripts | source |
| huashu-art-motion qa | `skills/huashu-art-motion/references/craft-workflow.md:376-385` | `qa.py` (upstream, not in OD tree) + independent reviewer agent | stills + numeric metrics | docs only in OD | docs-claim |
| Adapter conformance + rollout ratchet | `apps/daemon/src/critique/{conformance,ratchet,rollout,adapter-degraded}.ts` | deterministic | parser outcomes per adapter × 10 brief templates | code present, theater retired | source |

---

## 2. Critique Theater in detail (retired, but the mechanics are the reusable part)

### 2.1 Who judges
- Cast is fixed: `PANELIST_ROLES = ['designer','critic','brand','a11y','copy']` (`packages/contracts/src/critique.ts:17`).
- All five are **turns of one CLI session**: the agent itself writes every panelist block
  (`docs/critique-theater.md:32-35, 76-82`; spec `specs/current/critique-theater.md:16-28` explains the choice:
  one context so the critic "sees the actual hierarchy values the designer chose", no cross-process handoff, BYOK kept).
- DESIGNER drafts and does not score; CRITIC, BRAND, A11Y, COPY score (`apps/daemon/src/prompts/panel.ts:97-122`).
- No screenshots, no DOM, no second model. The judge sees the HTML it just wrote plus `<BRAND_SOURCE>` (the brand
  DESIGN.md wrapped as data, close-tags neutralised with a zero-width joiner, `panel.ts:65-78, 129-134`).

### 2.2 Rubric (dimensions and scales)
Scale 0–`scoreScale` (10). From the prompt template (`panel.ts:150-179`):
- critic: hierarchy, type, contrast, rhythm, space
- brand: palette, typography, spacing (against DESIGN.md tokens)
- a11y: contrast, focus, headings, alt_text (WCAG 2.1 AA)
- copy: specificity, voice, length ("absence of AI slop")
Each block: `<PANELIST role score must_fix>` + `<DIM name score>note</DIM>` + `<MUST_FIX>text</MUST_FIX>`.

### 2.3 Composite, threshold, stop conditions
- Weights `designer 0 / critic 0.4 / brand 0.2 / a11y 0.2 / copy 0.2` (`critique.ts:65`).
- Composite = weighted mean over **present** roles, weights renormalised over those present
  (`apps/daemon/src/critique/scoreboard.ts:27-43`).
- Ship rule: `composite >= threshold - 1e-9 && mustFix === 0` (`scoreboard.ts:51-60`). Threshold 8.0 of 10.
- `maxRounds` 3 (range 1–10), per-round timeout 90 s, total 240 s, block cap 256 KiB, max 4 concurrent runs
  (`critique.ts:58-74`); env overrides `OD_CRITIQUE_*` validated at boot with RangeError (`critique/config.ts`).
- Fallback after maxRounds: `ship_best` (highest composite, tie → later round), `ship_last`, or `fail`
  (`scoreboard.ts:69-91`).
- **Daemon-authoritative scoring**: the model also writes `composite=` on `<ROUND_END>` and `<SHIP>`, but the
  orchestrator recomputes from `panelist_close` scores; a divergence > 0.01 raises a `composite_mismatch` warning and
  the daemon number is what persists and decides (`orchestrator.ts:52, 353-397, 437-480`). A SHIP for a round the
  daemon never closed is dropped (`orchestrator.ts:438-448`).
- Score hygiene: out-of-range scores are clamped to `[0, scale]` with a `score_clamped` warning
  (`parsers/v1.ts:714-724`); NaN → 0.

### 2.4 Anti-rubber-stamp mechanisms
- Every scoring panelist **must emit at least one MUST_FIX in every non-final round** (`panel.ts:97-103`).
- "At least two panelists must diverge on a MUST_FIX target subsystem per non-final round. Unanimous agreement on
  every axis is a signal the critique is too shallow" (`panel.ts:124-127`).
- Enforced softly by the parser: if a round closes with `continue` and the critic's normalised must-fix targets are
  not different from the specialists' set, it yields `weak_debate` (`parsers/v1.ts:299-306, 562-580`). It does not
  fail the run; it feeds `parser_errors_total{kind="weak_debate"}` and the conformance gate (any parser warning =
  adapter not protocol-clean, `conformance.ts:23-49`).
- Self-bound budget: "Round n+1 transcript bytes must be strictly less than round n" (`panel.ts:211, 217`; spec
  `critique-theater.md:214-216`). A cheap convergence pressure: later rounds must say less.

### 2.5 Rounds and how feedback becomes edits
- Round 1: designer must emit exactly one `<ARTIFACT>` (missing → `MissingArtifactError` → degraded,
  `parsers/v1.ts:288-297`). Later rounds "may omit ARTIFACT and ship NOTES-only (the designer is iterating in place)".
- The repair is the **same model continuing its own stream** with the must-fix list in context; there is no separate
  patch engine. The final `<SHIP>` carries the full artifact again (CDATA), written to disk by `artifact-writer.ts`.
- The later OD guidance prefers patch over regenerate everywhere: core-slim "change only what is necessary... after
  a fix, recheck only the affected area" (`core-slim.ts:238-240`); refine phase "Change Only What the User Named...
  edit the existing file in place; do not reconstruct it from memory"; `patch-edit` atom "smallest possible localised
  edit", receipts per step.

### 2.6 Failure handling
Typed failures → wire events: `malformed_block`, `oversize_block`, `missing_artifact` → `degraded` and fall through to
legacy single-pass generation with **no retry**; timeouts → `timed_out` + ship best-so-far; SIGTERM/abort →
`interrupted` + best-so-far (`orchestrator.ts:578-709`). Spec targets per failure (e.g. malformed < 0.5 % of runs per
adapter; below-threshold < 5 % at M3, alert > 15 %/24 h) in `specs/current/critique-theater.md:443-462`.

### 2.7 How it was shown (the "theater" UI)
`apps/web/src/components/Theater/`:
- `TheaterStage.tsx`: header + Interrupt button + `ScoreTicker` + a `RoundDivider` per round + five `PanelistLane`s.
- `PanelistLane.tsx`: one row per role, `R1 6.4 · R2 7.9 ...`, cumulative must-fix badge, one dot per dim tinted
  `data-meets-half` when dim ≥ scale/2; role tint through `data-role` CSS (no hex in components).
- `ScoreTicker.tsx`: one bar per closed round (height = composite/scale), a horizontal threshold line; empty until
  the first round closes "so users do not see a misleading 0/threshold baseline".
- `TheaterCollapsed.tsx`: post-run chip "Shipped at round 2, composite 8.6"; variants below_threshold / timed_out /
  interrupted ("Interrupted at round N, best composite X.X") / degraded ("Panel offline this run").
- Replay: every run writes an `.ndjson(.gz)` transcript; Replay mounts a read-only stage; Instant / Live /
  `{intervalMs}` / Paused; J/K jump rounds (`docs/critique-theater.md:162-177`).
- Spec UX rules worth stealing (`specs/current/critique-theater.md:340-413`): "Smart" lane density (only the active
  or lowest-scoring panelist expanded; collapsed lanes show one derived line = most prominent must-fix); a "why this
  matters" rule line under the score ("Ships when composite ≥ 8.0 and open must-fix == 0. Otherwise refine, up to 3
  rounds"); aria-live announces only `round_end` and `ship`; reducer p99 ≤ 2 ms/event; first lane ≤ 200 ms after the
  first SSE event.
- Reducer invariants (`Theater/AGENTS.md`): pure reducer over the contract `PanelEvent` union; terminal phases are
  sticky; **round bookkeeping keyed by round number** so a late event from round 1 cannot corrupt round 2; artifact
  bytes never travel on the wire (ship event carries a ref; bytes fetched over HTTP only after they are on disk).

### 2.8 Cost and latency controls
One process, one transport, one context (no extra calls per panelist); hard per-round and total deadlines;
`parserMaxBlockBytes` cap; max concurrent runs; the "shrinking rounds" rule; fallback to single-pass on any protocol
error; adapters that fail conformance (< 90 % shipped or < 95 % clean parse, two consecutive cycles) get a 24 h
`critique:degraded` mark and are routed to single-pass (`docs/critique-theater.md:212-216`,
`adapter-degraded.ts`). Rollout M0→M3 promoted only after 14 consecutive days ≥ 90 %/95 %, demoted when any day
drops below half the shipped threshold (`critique/ratchet.ts:302-433`).

### 2.9 Why it died (the lesson)
`rollout.ts:84-104` and `packages/contracts/src/critique.ts:406-430` (Chinese comments), plus
`apps/daemon/src/plugins/critique-prompt-gate.ts:1-45`:
- Users repeatedly saw raw `<CRITIQUE_RUN>`, `<PANELIST role="Critic" score="8.4">`, `<ROUND_END/>` in answers.
- The grammar had two prompt entry points (the panel renderer and the `critique-theater` atom body in the default
  scenario's `critique` stage). Retiring one left the atom telling the model to "follow the daemon-injected protocol",
  so the model **invented the wire format from prose** and printed it into chat.
- A stripper had a typo (`MUSTFIX` vs `MUST_FIX`), so must-fix tags still leaked; markdown then rendered it italic,
  which hid the bug.
- Product decision: kill it at the master switch; code kept. The atom was rewritten: "Do not invent a structured
  review transcript, a scored panel, a cast of named reviewer personas, or any tag-based envelope... describe the
  outcome in ordinary prose" (`plugins/_official/atoms/critique-theater/SKILL.md`).
- My reading (inference): the panel added tokens and latency to every generation, its scores were self-assessed by the
  author model with no visual evidence, and the protocol fragility cost more trust than the scores bought.

---

## 3. The live self-check layer (prompt-level, same model)

- **Legacy/default path** (`packages/contracts/src/prompts/discovery.ts:143-176`): plan template step 7 = "run
  references/checklist.md (P0 must all pass)", step 8 = 5-dim radar 1–5: Philosophy, Hierarchy, Execution,
  Specificity, Restraint; "Any dimension under 3/5 is a regression. Go back, fix the weakest, re-score. Two passes is
  normal." Plus the anti-slop list (purple gradients, emoji icons, left-accent cards, sans display, invented metrics,
  filler, icon next to every heading, warm beige canvases, designer chrome in product UI).
- **core-slim** (`apps/daemon/src/prompts/core-slim.ts:238-272`): one ordered pre-delivery pass: completeness →
  skill P0 checklist → visual/interaction quality (overlaps, clipping, empty charts, duplicate primary CTAs, state
  contrast) → imagery provenance (real image for named referents, local files, aspect ratio) → render **at most once
  per task** via the daemon wrapper, only when static reading cannot decide; failures never narrated to the user.
- **official-system** (`apps/daemon/src/prompts/official-system.ts:103-111`): "Verification — converge at the end,
  in one pass"; "One render check is the budget... each such round-trip replays this turn's full context into the
  model and is the single biggest driver of input-token blowup."
- Skill checklists: 14 skills ship `references/checklist.md` with P0/P1/P2 (e.g. video templates:
  `skills/8-bit-orbit-video-template/references/checklist.md`: exactly 3 scenes, each hold < 3 s, seeded randomness
  only, no `repeat: -1`, no sandbox-hostile APIs). `derivePreflight` (`packages/contracts/src/prompts/system.ts:1166-1184`)
  injects a hard "read template, layouts, checklist before any other tool" line when a skill references them.
- **OD Next** (`od-next-strategy/assets/core-system-prompt.md:122-137, 288-323`): ship on write; "Do not add
  post-generation rendering, preview, tests, or acceptance rounds"; quality trade-off order "accessible and readable >
  usable interaction > information hierarchy > stylistic expression > decorative density"; delivery claims must map
  1:1 to written files and must never claim a render/validation that did not happen.
- **The video exception** (`task-profiles/motion-design.md:43-48, 352-366`): factual invariants and exact copy are
  frozen in the beat map at plan time; after the first render, ONE review: clock/dimensions, captions vs invariants,
  ≤ 3 representative frames (opening, key explanation, ending), SVG alignment; "actually view the images; source
  reading alone is not visual evidence"; ≤ 1 targeted repair + re-render, recheck only affected frames; if still
  wrong, report the limitation instead of certifying it; "Do not spawn acceptance agents, score aesthetics, add a
  separate pipeline stage, or repeat an open-ended polish loop." Plus a "defect → better decision" table used while
  composing (slideshow → carry one object through a transformation; everything competes → choose the lead action;
  flicker → seed and cache marks; monotonous → vary shot scale and action/hold rhythm; busy but says little → remove
  decorative motion) and "Do not invent a numeric score to certify aesthetics" (`motion-design.md:368-388`).

---

## 4. Deterministic checks (no model)

### 4.1 `apps/daemon/src/lint-artifact.ts` (anti-slop linter)
Greppy by design ("does NOT parse HTML — false positives are tolerable because each finding includes a snippet").
Finding shape `{severity P0|P1|P2, id, message, fix, snippet}` (contract `packages/contracts/src/api/artifact-lint.ts`).
Rules (11 P0 / 6 P1 / 1 P2 emission sites):
- P0 `purple-gradient` (Tailwind violet/purple/indigo hexes or `purple|violet` inside `linear-gradient`),
  `trust-gradient` (a blue hex/keyword and a cyan hex/keyword in one gradient), `ai-default-indigo` (#6366f1 et al.
  anywhere outside `:root`-style token blocks, so a brand that *declares* indigo passes), `emoji-icon` (17 emoji in
  heading/button/li/icon span), `left-accent-card`, `sans-display` (h1–h3 on Inter/Roboto/Arial/system-ui),
  `invented-metric` (10× faster, 99.x% uptime, zero-downtime...), `filler-copy` (lorem, Feature One...),
  `scroll-into-view` (breaks iframe preview), `slide-theme-missing`.
- P1 `all-caps-no-tracking` (uppercase needs letter-spacing ≥ 0.06em, token-aware, per theme scope),
  `external-image` (unsplash/placehold...), `raw-hex` (> 12 hex values outside `:root`), `accent-overuse`
  (`var(--accent)` > 6 inline uses), `slide-rhythm` (3 same-theme slides in a row).
- P2 `missing-section-anchor`.
- `renderFindingsForAgent` (`:519-537`) sorts P0 first and wraps them in `<artifact-lint>` with the instruction
  "Re-emit a corrected `<artifact>` in your next turn — do not write a separate explanation".
- Wiring: `POST /api/artifacts/save` returns `lint` beside the path; `POST /api/artifacts/lint` returns findings +
  `agentMessage`; `od lint <file> --fail-on p0|p1|p2 --agent-message` (`apps/daemon/src/cli.ts:735-800`). The web save
  path drops `lint` (inference: the auto-splice into the agent's next turn is not wired in the web client).

### 4.2 DOM QA (`apps/daemon/src/qa/`)
- `cta-hierarchy.ts`: cheerio pass, precision-biased ("when the signal is weak, the function says nothing"): kinds
  `multiple-primary` (per container), `ambiguous-weight`, `misleading-prominence`.
- `deck-layout.ts`: **checks the mechanism, not the pixels** ("there is no browser layout engine in the daemon, so the
  pass verifies that the no-clip mechanism is present"): `.slide` exists, frame has `container-type: size`, the
  `od-deck-fit` shrink-to-fit runtime is shipped, every slide body has an `.f-fit` layer, no `clamp-1/2/3` on
  headline/lede slots. Errors block the brand-system rebuild. Robust-by-construction beats detect-and-repair.

### 4.3 Export assertions (`apps/daemon/src/artifacts/motion-delivery.ts`)
Reads the spec from the actual composition, never from the agent plan: MP4 link must be project-relative and match
the requested path; `od-motion-audio` must be `required|silent`; required ⇒ a real local track with volume > 0;
after export: an MP4 exists, ffmpeg can decode a frame, audible audio presence matches the policy.

### 4.4 Video frame QA in bundled skills
- `skills/oil-motion/scripts/motion_pipeline.py analyze` (`:508-686`, defaults `:998-1004`): per frame on a 96×96
  flattened copy: `blank` (no alpha bbox), `near-duplicate` (mean abs diff < 0.004), `brightness-jump` (> 0.12),
  `scale-jump` (subject height ratio change > 0.08), `center-jump` (> 0.08), `canvas-size` mismatch; summary median
  frame difference and subject ranges; `contact` builds a numbered contact sheet.
- `production_gate.py` (`:117-339`): pilot approval file records SHA-256 of the concept contract, first/last frame,
  pilot video and page evidence plus reviewer; any later change invalidates approval. Chained segments: the next
  segment's first-frame input must be byte-identical to the previous accepted tail; output seam must reach SSIM ≥ 0.97
  and normalised MAE ≤ 0.04 between decoded tail and head. `references/qa.md`: fixed order intent → keyframes → master
  → frames → compile → timeline → page runtime; "upstream failure stops; never mask downstream".
- `skills/huashu-art-motion/references/craft-workflow.md:376-385`: `render.py --stills 0.4,0.6,0.8,1.0` per segment;
  `qa.py` measures motion, still/moving frame pairs, jumps, frame time (target ≤ 150 ms with GPU flush) and
  determinism (same t ⇒ identical pixels); "at least 3 rounds per segment"; four questions: recognisable style at a
  glance? character right and merged with the background? visibly alive in the hold window without flicker or stutter?
  any breakage (occlusion, broken lines, misalignment, blanks, overlapping text)? "Before delivering a multi-segment
  film, send an agent that did not take part in making it to review only the finished film." The art-style notes
  record real review numbers (e.g. a still segment frame-difference 0.20 vs the original's 0.46, raised to 0.37; a
  whole-screen reseed every 7–8 frames giving frame-difference 18 = read as flicker).

---

## 5. Memory → verified rules → scorecard

- `apps/daemon/src/memory-rules.ts`: annotations on a delivered artifact (comments, highlights, inspect marks; cap 24)
  are distilled into at most 8 `rule` proposals: a heuristic pass (each note → `Assertion` / `Check: Verify future
  artifacts satisfy: ...` / rationale) plus an optional small-LLM pass with a strict-JSON prompt that groups related
  notes into one general, checkable rule; merged and deduped by normalised assertion; LLM wins on collision. Proposals
  are display-only until the user presses Keep.
- `apps/daemon/src/memory.ts:665-685`: active rules render as `### Verified rules` with their Assertion/Check lines.
- Prompt (`packages/contracts/src/prompts/system.ts:483-486`): after an artifact turn, check every rule, fix in place,
  then emit `<od-card type="verify-scorecard">{status, summary, rows:[{rule, status: pass|fail|fixed, note}]}`.
- `apps/daemon/src/memory-verify.ts:60-140`: pure `enforceVerify`: `missing` if no scorecard; `fail` if any row fails
  or a rule is uncovered; a row covers a rule if it contains the rule name (≥ 5 chars) or check (≥ 8 chars), or shares
  ≥ 2 significant words (≥ 4 chars, stopwords removed). Ring buffer of 20 outcomes over SSE.
- Status: I found no call site of `enforceVerify`/`recordVerify` outside the module and tests at this commit; routes
  only list/remove/clear. The prompt claims "The daemon programmatically checks this scorecard"; that wiring is not in
  the tree (docs-claim for the enforcement, source for the function).

---

## 6. Review skills (method, not code)

- `skills/review-animations/SKILL.md` + `STANDARDS.md`: posture "Default to flagging; approval is earned". Ten
  non-negotiables (justified motion; frequency-appropriate; ease-out not ease-in; UI < 300 ms; origin-aware, never
  `scale(0)`; interruptible; transform/opacity only; reduced-motion and hover gating; asymmetric enter/exit; cohesion).
  Escalation triggers (`transition: all`, `scale(0)`, `ease-in`, layout-property animation, everything-at-once
  entrance where a 30–80 ms stagger belongs). **Remedial hierarchy**: delete → reduce → fix easing → fix origin →
  interruptible → GPU → asymmetric timing → polish → a11y. Output = Before/After/Why table + tiered verdict + explicit
  **Block / Approve** rule.
- `skills/emil-design-eng/SKILL.md:615-706`: review with fresh eyes the next day; slow-motion (2–5×) and
  frame-by-frame inspection checklist (do colours cross-fade or double-expose, does easing start/stop abruptly, is the
  origin right, are properties in sync).
- `plugins/community/hallmark/references/slop-test.md`: pre-emit 6-axis 1–5 (Philosophy, Hierarchy, Execution,
  Specificity, Restraint, **Variety**: structural distance from previous outputs, "colour-swaps don't count"); < 3 on
  any axis → revise before the 60-gate sweep; stamp the scores into the file; "Two passes is normal. Three is a sign
  the brief is wrong." Variety gates read `.hallmark/log.json` and require a different macrostructure or at least one
  different variation knob vs the last output.

---

## 7. Pipeline devloop (`until` DSL)

`apps/daemon/src/plugins/until.ts`: closed vocabulary (`critique.score` 0..5, `iterations`, `user.confirmed`,
`preview.ok`, `build.passing`, `tests.passing`), `||`/`&&` of comparisons; unparsable `until` refuses to schedule;
`repeat: true` without `until` is rejected; `OD_MAX_DEVLOOP_ITERATIONS` default 10; each iteration persisted in
`run_devloop_iterations`. The live stage runner merges worker signals over **permissive defaults**
(`critique.score: 4`, `preview.ok: true`, `user.confirmed: true`, `atoms/registry.ts:85-93`); the critique-theater
worker regex-parses `score=N` from a prose summary (`atoms/built-ins.ts:53-79`). With the default scenario's
`until: "critique.score>=4 || iterations>=3"`, the loop exits after the first pass unless something reports lower.
It is a contract skeleton, not a judge.

---

## 8. What Moovi already has (read-only survey, to avoid re-proposing)

- `packages/engine/src/render/qa.ts`: geometry QA from renderer-reported boxes (empty, clipped, overlap, covered by the
  app UI zone), runs ≥ 0.2 s, fix text with exact pixel deltas. Style 1 only (needs `window.__boxes`).
- `packages/engine/src/s1fast/critic.ts` + `make.ts:66-104`: vision critic (one still per scene at 70 % of its length,
  sheet vs a cached contact sheet of the owner's gold films), keep/fix + severity 1–5, the 3 worst rewritten; then
  QA rounds ≤ 3, last round falls back to a plain title.
- `packages/engine/src/tasks/lens.ts`: Lens on the crew path: craft-graph laws/checks (`lawsAndChecks`), a 16-still
  sheet + `scene` close-up tool + `raise_issue` (refuses spacing claims until the scene was viewed up close),
  `finish(score 0–10)`; blocking issues reopen only `build:<scene>` + downstream chunks, ≤ 2 rounds, then ship with
  notes; issues stored via `raiseIssue/resolveIssue`.
- `packages/engine/src/visual/{qa,critic}.ts`: Vignesh's renderer: `checkPlan` + `motionReport` (STATIC_BELOW 0.35,
  EMPTY_BELOW 3 on grey thumbs), `scoreScenes` six parts (footage, motion, depth, layers, richness, clean) weighted to
  0–10, FAIL_BELOW 7, `replanScenes` recasts only failing scenes with a seed bump and worn-out artifacts, re-renders
  only their frame ranges; ratings fold into FalkorDB running means (`rateArtifacts`, `rateLayouts`,
  `scoreScene`, `weakScenes`).
- Laws exist only for Style 1 (`packages/skills/src/style-1/laws.ts`).
- Live styles: `styles/{s4,s5,darkvox,anatomy}.ts` serve the preview, then take a contact sheet (four separate
  `contactSheet` implementations: `s4/sheet.ts`, `s5/sheet.ts`, `styles/darkvox.ts:186`, `anatomy/player.ts:103`),
  log empty frames from `window.__visible`/`__shown`, and stop. No judge, no repair, no review event.
- Players expose `window.__render(t)` (s4, s5, darkvox, anatomy, s1live, edit page), `__ready/__error`, `__shots`.
- Studio: office with a `lens` desk, status/activity events (`packages/engine/src/events.ts`), `VideoPopup`.
- Memory: `Feedback` nodes, `Lesson` nodes (`writeLesson`, `lessonsFor`) with `law` refs but no machine check.
- The reference-clone quality ratchet (`.claude/skills/ishaan-motion/references/ratchet.md`): blind judge, rubric
  Typography/Composition/Craft & depth/Fidelity/Premium 1–10, strictly above the previous best **in the same round**.
- Runtime: `http.ts` declares `vision: true` for every HTTP provider, but the Groq preset's models are gpt-oss
  (text-only). A critic that sends images on the Groq fallback would fail or be ignored (inference).

---

## 9. Ranked findings (summary; full fields in the structured output)

1. OD retired its same-model five-persona jury; what survived is quality upstream + one bounded video review.
2. The bounded video review recipe (≤ 3 frames, captions vs frozen invariants, ≤ 1 targeted repair) is the right
   budget shape for Groq free tier.
3. Deterministic-first: P0/P1/P2 linter with fix + snippet, rendered to the agent as one block; no model.
4. Daemon-authoritative scoring: model gives parts, code computes composite and the ship decision.
5. Anti-rubber-stamp: mandatory must-fix per non-final round, forced disagreement, weak-debate detection.
6. Protocol hygiene: judge output must be typed events, never text in chat; close every entry point.
7. Patch, don't regenerate: scope repair to the failing unit, recheck only affected frames, shrinking rounds.
8. ship_best fallback, terminal statuses, per-round and total deadlines; preview first.
9. Theater UI patterns: lanes keyed by role and round, score ticker with threshold line, collapsed chip, replay.
10. Robust by construction (deck fit runtime) instead of detect-and-repair for clipping.
11. Frame-sequence anomaly metrics and seam SSIM thresholds (oil-motion), stills at 0.4/0.6/0.8/1.0 (huashu).
12. Feedback → verified rules → scorecard with deterministic coverage check (maps onto Moovi Lessons).
13. Variety as a scored axis with a log of structural fingerprints (Hallmark).
14. Independent reviewer + four questions for multi-segment films (huashu) = Moovi's blind judge, generalised.
15. One-render budget and silent render failures.
16. Remedial hierarchy (delete → reduce → ...) and Block/Approve criteria for motion review.
17. Per-adapter conformance + degraded TTL + measured rollout ratchet (any model, equal quality).
18. Composing-time defect→decision table and per-beat focal/cause/reading-time/exit accounting.
19. `until` DSL with permissive defaults is scaffolding; do not copy that part.

---

## 10. A concrete critique loop for Moovi films ("Lens on the live preview")

Goal: every live style (Auto, s4, s5, darkvox, anatomy, clip-moment) gets a bounded, mostly deterministic per-beat
review after the preview is already playing, with at most one repair pass that re-casts only failing beats, shown in
the studio as Lens's work. It must fit the Groq free tier (8k TPM, 200k tokens/day for gpt-oss-120b, shared).

### 10.1 Placement
```
packages/engine/src/review/
  probe.ts     one Chromium page on the live preview URL; per beat sample t at 0.15 s after entry (skip),
               0.4, 0.7, 0.95 of the beat; window.__render(t); grey thumb 72x128 + DOM boxes + visible count
  checks.ts    deterministic per-beat checks (reuses render/qa.ts geometry(), visual/qa.ts motionReport())
  judge.ts     ONE batched model call (optional): per-beat facts as text; contact sheet only when vision is real
  score.ts     engine-side composite + decision; weak-judge detector
  repair.ts    style adapters: recastBeat(style, beat, notes, attempt) -> new film.json beats; hot reload
  index.ts     reviewFilm({style, pv, dir, film, beats, budget}) -> ReviewResult; emits events; writes review-N.json
```
Call site: in `styles/{s4,s5,darkvox,anatomy,clip-moment}.ts` replace the post-preview `contactSheet(...)` stage
with `reviewFilm(...)` (the sheet becomes a by-product of `probe.ts`, collapsing the four contactSheet copies).
For Auto (`router/film.ts`) review each live segment through its own style adapter.

### 10.2 What the probe extracts per beat (all deterministic)
- `thumbs[]` (grey 72×128) at the sampled times; `energy` = max mean-abs-diff between samples 0.2 s apart
  (`STATIC_BELOW` 0.35 as in `visual/qa.ts`); `spread` per frame (`EMPTY_BELOW` 3).
- `boxes[]`: text nodes and media elements via one injected `__probe()` (getBoundingClientRect, opacity,
  computed font-size, colour and the backdrop colour sampled under the box) → feeds `render/qa.ts geometry()` for
  clipped / overlap / covered (platform zone from the craft graph `safeZone` params).
- `words[]` on screen vs the beat's spoken words (LCS ratio, as `voiceLocked` in `tasks/lens.ts`).
- `setup` id (from `window.__shots()` or the plan), elements count, picture present or not.
- `frameMs`: wall time of `__render(t)` (jank risk if > 150 ms on the server, huashu's budget).
- `determinism`: render the 0.7 sample twice and compare thumbs (flicker from unseeded randomness).
- cut flash: luminance jump > 0.12 between the last sample of beat i and first of beat i+1 when the transition is not
  a deliberate flash (oil-motion threshold).

### 10.3 Per-beat rubric
Hard gates (blocking, deterministic): empty frame; static > 1 s; text clipped/overlapping/covered ≥ 0.2 s; shown
words < 90 % spoken; text under 28 px at 1080 width; render not deterministic; frame time > 250 ms.
Soft dims (0–1, deterministic): motion (energy), fill (non-backdrop area 25–70 %), legibility (contrast ratio of text
boxes vs sampled backdrop, ≥ 4.5 → 1), variety (set-up not used by this film's previous 2 beats and not in the last
3 films for this site; Moovi already stores setups via `remember()`).
Judge dims (1–5, optional model): Shows (the picture shows what the line says), Reads (one focal point, hierarchy),
Alive (motion has a cause, not decoration), Fits (on-style, on-brand) + `must_fix` (one concrete sentence or null).
Composite per beat (engine-computed): `10 * (0.35*motion + 0.15*fill + 0.2*legibility + 0.1*variety + 0.2*judge)`,
where `judge` = mean judge dims / 5 (if the judge is skipped, its weight renormalises over the rest, like OD's
`computeComposite`). Beat ships iff no hard gate fails AND composite ≥ 7 (same bar as `visual/critic.ts FAIL_BELOW`).
Film ships iff every beat ships; otherwise one repair round on the failing beats.

### 10.4 The judge call (Groq-safe)
- Input per beat ≈ 80–120 tokens: `#3 [4.1–6.0 s] "line" · setup paper-fold · 3 elements · words on screen "COINED
  TERM" · fill 0.41 · motion 0.8 · gates: covered(rail)`; plus the style's 6-line rubric and the user's active
  Lessons as checks. 10 beats ≈ 1.5k input + 0.6k output ≈ 2.1k tokens: one call, fits 8k TPM.
- JSON schema (zod, `ask({schema})`): `beats[{i, shows, reads, alive, fits, must_fix|null}], worst_beat, lessons[{id,
  status: pass|fail, note}]`. `worst_beat` is mandatory even when everything passes (OD's must-fix rule, adapted).
- Vision only when the runtime actually supports images for the chosen model (add `visionModels` to `Preset`; on the
  Groq fallback stay text-only); then attach one per-beat sheet (one still at 0.7 per beat, 270×480 cells), as
  `s1fast/critic.ts` does.
- Weak-judge detector: discard the judge's numbers when all dims are 5 and `must_fix` is null everywhere while any
  deterministic soft dim < 0.5, or when the JSON fails schema twice; record `judge: degraded` (provider, model) for
  24 h in Redis/graph and run deterministic-only for that provider (OD's adapter-degraded idea).
- Budget gate: skip the judge (deterministic-only) when the server fallback has spent > 150k tokens today or the user
  key has failed once in this job; tier `fast` (gpt-oss-20b) on the fallback, `crew` on a user key.

### 10.5 Repair
- Max ONE repair round for judge findings (OD Next video rule); deterministic hard-gate failures may get a second
  round (Lens precedent), then the beat falls back to the style's safest set-up (s1fast's "plain title" precedent).
- Repair is a recast, not a regeneration: `recastBeat` picks a different set-up for only that beat with
  `seed + 7919*attempt` and the failing set-up marked worn (exactly `visual/critic.ts replanScenes`), keeps timing,
  voice and neighbours. Only if the note names copy or a picture idea does it make one model call for that beat.
- Rewrite `film.json`, bump a version the player polls (hot reload at the same preview URL), re-probe only the
  repaired beats plus the transition half-second into the next beat.
- ship_best per beat: if the repaired beat scores lower, keep the original.

### 10.6 Memory and the graph (FalkorDB stays load-bearing)
- `(:Run)-[:REVIEWED]->(:Review {round, composite, status, provider, model, tokens, ms})-[:ON_BEAT]->(:BeatScore
  {i, setup, score, gates, must_fix})`; named queries `recordReview`, `rateSetups` (running mean per set-up per
  style, like `rateArtifacts`), `setupRatings` (casting prefers set-ups that pass), `reviewPassRate` (per style,
  per day: the measured ratchet before turning review on by default).
- Lessons become checks: add `check` to `writeLesson` and an edge `(:Lesson)-[:CHECKED_BY]->(:Check)`; `lessonsFor`
  feeds the judge's `lessons[]`; the engine verifies coverage like OD's `enforceVerify` (every active lesson must
  get a row; uncovered → treat as fail).

### 10.7 Studio
- New typed event in `packages/engine/src/events.ts`: `{ type: 'review'; review: { round, threshold, status:
  'running'|'shipped'|'below'|'skipped'|'degraded', beats: { i, score, gate?: string, note?: string, fixed?: boolean }[] } }`.
  Never put judge text into chat messages directly (OD's leak lesson); the Lens activity row says what happened
  ("Lens sent beat 3 back: 'COINED TERM' sits under the like rail, moved up 64 px").
- `apps/studio/src/components/video/VideoPopup.tsx`: a beat strip under the player: one cell per beat, a dot per
  state (pending/ok/fixed/below), a thin threshold line on a score ticker, click a cell to seek; collapsed chip after
  the run ("Checked 9 beats · fixed 2 · 8.1"). `useChat.ts` reducer keyed by round number; terminal state sticky.
- Office: Lens desk status "checking beat 4 of 9", monitor glow, handoff bead to Shot Builder on repair.
- Replay: `review-N.json` already written per round; the popup can step through rounds (J/K).

### 10.8 Latency estimate (inference, to be measured with `moovi.benchmark()`)
Probe: 10 beats × 4 samples × (render + 72×128 grab ≈ 40–80 ms) ≈ 2–4 s on the 2 GB server, reusing the page the
contact sheet already opens. Judge: one Groq call ≈ 3–8 s. Repair: recast is local and seeded (< 1 s per beat) +
re-probe ≈ 1–2 s. Total ≈ 6–15 s after the preview is already visible; no MP4 render involved.

---

## 11. Port candidates (Apache-2.0, with attribution)
- `apps/daemon/src/critique/scoreboard.ts` (composite with renormalised weights, decideRound, ship_best) → small, pure.
- `apps/daemon/src/critique/ratchet.ts` (`evaluateRollout`: windowed promote/hold/demote) → for per-style review
  rollout.
- `apps/daemon/src/memory-verify.ts` (`rowCoversRule`, `enforceVerify`) and `memory-rules.ts` (heuristic + LLM
  distillation, dedupe) → Lessons-as-checks.
- `apps/daemon/src/lint-artifact.ts` structure (`renderFindingsForAgent`, P0-first block) → film lint renderer.
- `skills/oil-motion/scripts/motion_pipeline.py` `analyze_directory` and `production_gate.py` `frame_similarity`
  (port the math to TS: MAE + global SSIM on grey thumbs).
- `apps/web/src/components/Theater/{ScoreTicker,PanelistLane}.tsx` patterns (rewrite in Moovi's own look).

## 12. Unknowns
See the structured output.
