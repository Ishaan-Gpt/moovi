# OpenDesign: product experience and growth engine (area: product-ux-growth)

Source: OpenDesign (OD) at commit 78d5637, 2026-10-16, cloned read-only at
`scratchpad/ext/open-design` (Apache-2.0). Package version on that commit: 0.25.1 (`package.json`).
Live site checked on 2026-10-17: https://open-design.ai (home, /llm-arena-for-design/, /pricing/, /alternatives/canva/).
Paths below are relative to the OD repo root unless prefixed with `moovi:`. Nothing was installed, built or run.

---

## 0. The first 60 seconds, as built

1. **Splash** (desktop only): the same pixel-scan logo shader the Home hero runs, ported to raw WebGL so it can show
   before the web sidecar boots (`apps/desktop/src/main/splash-pixel-scan.ts:1-23`). Brand continuity from boot to Home.
2. **Privacy banner** on first run: "Share" or "Don't share" for optional analytics; safety telemetry always on
   (`PRIVACY.md`, "Product analytics are opt-out").
3. **Onboarding step 0** (`apps/web/src/components/EntryShell.tsx:3700-3810`): one screen, title "Welcome to OpenDesign",
   body "Turn your ideas into designs." (`apps/web/src/i18n/locales/en.ts:398-406`). ONE primary button
   ("Sign in / Sign up") with a "Free Credits" corner badge (tooltip: free starter credits on a cheap model). Under a
   divider "Or use your own AI": two subtle buttons, "Local AI" (scans the PATH for coding-agent CLIs, "usually 5-10
   seconds") and "API Key" (BYOK). Both go to step 2 (runtime setup) which auto-tests the runtime inline before
   allowing Continue (`EntryShell.tsx:3016-3093`, `OnboardingRuntimeTestState`).
4. **Onboarding stops there.** Comment at `EntryShell.tsx:574-576`: first-run onboarding intentionally ends after the
   model source; design-system creation is reachable elsewhere. A role/use-case questionnaire and a "Recommended for
   you" strip exist in code (`apps/web/src/onboarding/recommendation.ts`) but the strip's mount point was REMOVED from
   Home (`apps/web/src/components/HomeView.tsx:3265-3273`): the composer already asks for the first request, and a
   third "start here" surface was redundant. Rule they follow: one main guide at a time
   (`FirstArtifactHint.tsx:16-25`, "spec §8.5").
5. **Home composer**: a typewriter placeholder rotates scenario lines ("Mock up a signup flow", "Turn my notes into a
   presentation", ...; `home-hero/placeholderScenarios.ts:58-89`, copy at `en.ts:965-978`). Timing:
   42 ms/char typing, 22 ms/char deleting, 1900 ms hold, 320 ms pause (`placeholderScenarios.ts:177-182`). Each line is
   bound to a creation chip (template). **Pressing Send on an EMPTY composer submits the line currently shown and binds
   its template** (`HomeHero.tsx:615-643`, `carouselSubmittable`), so a brand-new user can create a fully routed
   project in one click without typing.
6. **First-run guide cascade** (`home-hero/firstRunGuide.ts:1-38`): stage `chip` -> `card` -> `done` stored in
   localStorage; sheen pulses the Prototype chip, then the first example card, then Send. Users who already have
   projects never see it.
7. **Chips row** (`home-hero/chips.ts:105-391`): Create Brand Kit, Prototype, Web clone, Deck, Document, Motion design,
   HyperFrames, WebGL, Live artifact, Image, Video, Audio; lower row: Create plugin, Figma, Template. Each chip carries
   an `action` (apply-scenario with a plugin id, or open a flow). Example cards under the composer come from plugins
   ranked by popularity (see section 6).
8. **First artifact**: a one-time, non-modal hint "Your first design is ready - try editing and annotating it directly,
   export or share whenever you're happy" (`en.ts:2773-2775`), shown once per browser ever, burned only on dismiss
   (`onboarding/first-artifact-hint.ts`, `FirstArtifactHint.tsx`). It appears only if the turn produced a previewable
   `.html` (`onboarding/first-generation.ts`).
9. **After the turn**: three model-written follow-up suggestions (section 2).
10. **After the first delivered artifact**: a one-time CSAT/NPS card, 3 s after the artifact lands, armed by delivery
    (not export), retired the moment it is SHOWN (`components/experience-survey-trigger.ts:1-51`). Their own data in
    that comment: over 30 days ~37k users produced an artifact but only ~13k exported.

What this adds up to: one decision (where the AI comes from) before anything else, a free-credit default that needs no
key, an example you can run by pressing Enter, and exactly one hint at a time after that.

## 1. Moovi today (read-only check of the Moovi repo)

- `moovi:apps/landing/src/components/sections/PromptBox.tsx`: brief box in the hero; sparkle button types a sample
  brief (16 ms/3 chars); **empty Send only nudges** (`setNudge`, Moovi squints), it does not run a sample. Brief is
  kept in sessionStorage plus IndexedDB `ce-brief`, then `/studio/start`.
- `moovi:apps/studio/src/lib/session.ts:17-22`: `requireUser` sends you to `/auth` first; with `MOOVI_BYOK=required`
  a new user is sent to Settings ("One thing first: your model") before the studio. The live server runs
  `MOOVI_BYOK=optional`, so that gate is off there.
- `moovi:apps/studio/src/components/video/VideoPopup.tsx`: versions as `v1..vN` tabs; **Download and "Tweak in chat"
  render only when `!live`** (lines 74 and 79). Every live-preview style (the default output, "Preview, don't render")
  therefore has no Tweak, no Download and no Share button. Stage timings are shown for live versions.
- `moovi:apps/studio/src/components/office/BriefOverlay.tsx`: style strip ("Moovi picks" + every style) with CSS
  swatches only, no motion preview; "Like the last one" seeds a lead sentence.
- `moovi:apps/studio/src/components/chat/ChatPanel.tsx`: questions with buttons, the crew's work folded into one row,
  @mentions. No follow-up suggestions after a version lands.
- `moovi:apps/studio/src/components/settings/ModelForm.tsx` + `moovi:packages/engine/src/keys.ts`: provider radio list
  (12 providers), server-side key check against the live model list, three tiers, AES-256-GCM sealing, last-4 display,
  `withServerFallback` (OD has no equivalent fallback: `docs/agent-adapters.md` section 8).
- `moovi:apps/studio/src/app/api/projects/[pid]/preview/[cid]/[v]/[[...path]]/route.ts`: the live player is served
  owner-only (`apiProject`), `x-frame-options: SAMEORIGIN`. No public link exists for any film.
- `moovi:apps/landing/src/lib/content.ts`: the landing tells the story with sample data only (no real films), the
  Finale has "Hire Moovi" plus a waitlist although the studio is live; the "Hood" chapter says "Director on Claude
  Opus, specialists on Sonnet, memory on Haiku", which reads against the any-model / BYOK promise.
- Aside (not this area): `ce-brief` (IndexedDB), `ce:chat-open` (localStorage), `ce:cmd` (Redis stream) are `ce`
  prefixes; CLAUDE.md forbids reintroducing ContentEasy/CE_ names, so a rename may be due.

---

## 2. Model-written next steps (three suggestions, nonce-keyed)

Contract: `packages/contracts/src/api/next-step-marker.ts:1-139`.
- The agent ends a delivered turn with three self-closing markers `<od-next key="<turn nonce>" value="..."/>`.
  Written by the model, in the conversation's language, about what was just built (not a fixed catalogue).
- The key is the per-run nonce the daemon already mints for `<od-done>`. Reason (lines 20-30): clicking a suggestion
  puts that sentence in the user's composer, so an un-keyed marker would let any text the agent read (a cloned page,
  a document) plant a sentence dressed as product UI. The model cannot reproduce a nonce it was never shown.
- Stripping is unconditional (a wrong or missing key is still removed from the visible text); the client only gets
  parsed suggestions on a typed `next_steps` SSE event (`apps/daemon/src/server.ts:15088-15090`).
- Parser: one per line, bullets/quotes/markdown emphasis removed, dedupe case-insensitively, max 3
  (`MAX_NEXT_STEP_SUGGESTIONS`), each at most 120 chars (`NEXT_STEP_SUGGESTION_MAX_LENGTH`), anything over is dropped.
- UI (`apps/web/src/components/NextStepActions.tsx:225-245, 720-750`): three rows with one identical arrow icon.
  **Clicking seeds the composer; it never sends or starts a run by itself.** If a turn has no suggestions, nothing
  renders: they deleted the old generic toolbox fallback because "a generic row ... would be a worse answer than
  silence".
- Special variants: incomplete turn -> "Continue" / "Generate the missing artifact" with fixed prompts
  (`NextStepActions.tsx:57-77`).

Moovi transfer: the Director's delivery message ends with three suggestions ("Cut the intro to 2 s", "Swap the end card
to the app icon", "Make a 16:9 version") parsed by the engine with the run's nonce and sent as a `next` event; the
studio shows them under the version card; clicking fills `@video ...` in the composer. Moovi researches URLs (scraped
site text reaches the Scribe), so the nonce rule matters here too.

## 3. Comments pinned on the preview, sent as hard-scoped attachments

`apps/web/src/comments.ts`.
- A comment snapshot stores file, elementId, CSS selector, label, text (trimmed to 160 chars), position box, htmlHint
  (180 chars), computed style, selection kind (element / pod of several / visual stroke) and slide index (lines 15-30,
  83-106, 601-609).
- Anchor drift ladder (`resolveCommentAnchor`, 257-273): exact element id -> `anchored` (or `reanchored` if the file
  version changed); pin-only comment -> ghost at stored position; else content-based fuzzy match with scores
  selector +4, htmlHint +3, text +2, position proximity as tie-break, accepted only at score >= 2 (322-347) ->
  `stale`; else `lost`, with the last good position written back once (idempotent, 291-303).
- When sent, the comments become an `<attached-preview-comments>` block appended to the user message
  (611-673). First line is a hard scope rule (line 616): change ONLY the listed elements; do not touch siblings,
  layout, global CSS or tokens; mention other issues as a follow-up note; ask before going out of scope. Each item
  lists targetKind, file, selector, label, position, currentText, htmlHint, computedStyle, the comment, and for visual
  marks a screenshot path plus an intent sentence ("red strokes identify the region").
- 0.9.0 notes: comment mode supports attachments and live preview updates (CHANGELOG.md:30).

Moovi transfer: "Pin a note" on the live player captures `{version, t (s), beat id, scene id, layer id under the
pointer, frame thumbnail}` and the composer sends an `<attached-notes>` block with the same hard-scope sentence
("change only beat 4 at 6.2 s; keep voice, music, other beats"). The engine already scopes edits ("rebuild these
scenes, keep the voice", docs/STUDIO.md "Talking to the crew"), so the pin gives it the exact beat for free.

## 4. Versions with provenance, restore as a new version

`packages/contracts/src/api/files.ts:59-115`.
- `ProjectFileVersion`: id, version number, label, createdAt, `source` ('ai' | 'manual' | 'restore' | 'sync'), the
  `prompt` that produced it and `promptSource`, `restoreFromVersionId`, `parentVersionId`, SHA-256 `contentDigest`,
  and a bounded `origin` (entry surface ui/cli/mcp, plugin workflow id, run id; never prompts or credentials).
- UI strings (`en.ts:3124-3154`): "Version history", "AI edit / Manual edit / Restored", "Restored from v{n}",
  "Prompt" with "Copy prompt", fullscreen, open in new window, and "Switch to this version" which "restores this HTML
  as a new current version" (non-destructive).
- `apps/web/src/artifacts/version-origin.ts`: export events check the digest so analytics can tell which run and
  which plugin produced the thing that was exported.

Moovi transfer: the version tabs in VideoPopup show, per version, the message that caused it, who changed what
(Scribe/Builder/Lens) and the model used; "Use this version" makes v(n+1) from v(k)'s ref; store
`(:Video {v})-[:FROM]->(:Video)` and `(:Message)-[:MADE]->(:Video)` in the project graph (FalkorDB stays load-bearing).

## 5. Design Jury: the critique made visible

`docs/critique-theater.md`, `apps/web/src/components/Theater/*`.
- Five panelists (Designer, Critic, Brand, Accessibility, Copy) score each round; composite =
  designer 0 + critic 0.4 + brand 0.2 + a11y 0.2 + copy 0.2; threshold 8.0/10; up to 3 rounds; fallback `ship_best`.
- UI: one lane per panelist with per-round scores R1..Rn and a must-fix counter (`PanelistLane.tsx`), a score ticker
  with a threshold line, then it collapses to a chip "Shipped at round 2, composite 8.6"; status variants
  Below threshold / Timed out / Interrupted / Degraded. An Interrupt button. Every run writes an `.ndjson`
  transcript; "Replay" plays it (instant, paced, paused; J/K jump rounds).
- All panelists are turns in the same agent session (no extra processes).

Moovi transfer: Lens already runs machine checks and an eye pass (docs/STUDIO.md "Quality gates"). Show them: a chip on
each version ("Lens: 14/15 checks, safe zone fixed in round 2") that opens a list of laws with pass/fail and which
crew member fixed what. The office replay (the Redis `ce:chat:<id>` stream already persists every event) becomes a
"Watch the crew make it" button, and the public share page can play it next to the film. Nobody else has a visible
crew; replay turns it into content people share.

## 6. Gallery, "Try it", Remix and the template flywheel

- A plugin is a folder: `open-design.json` + `SKILL.md` + optional `preview/` and `examples/`
  (README.md:480-500, `plugins/README.md`). Video templates carry `preview.poster` and `preview.video` (mp4 on the
  jsDelivr CDN), a localized `useCase.query`, and typed `inputs` (aspect, format, durationSec)
  (`plugins/_official/video-templates/frame-kinetic-type/open-design.json`). 64 video templates ship.
- Detail modal CTAs (`en.ts:2817-2823`): **Use** (load the example prompt and recreate the preview), **Use without
  prompt** (keep the plugin structure only), **Remix** (copy the example into a new editable project; allowed when
  the plugin has an HTML preview/asset/example output, `plugins-home/duplicate.ts`).
- The seed that lands in the composer is short and human; the full build spec rides along as plugin context
  (SKILL.md + example.html) "so the output still faithfully recreates the reference"
  (`plugins-home/presetSeedPrompt.ts:1-14`). Meta-instruction queries ("follow the en field verbatim") are detected
  and replaced by a friendly description (`isMetaInstructionSeed`), and attribution tails are stripped.
- Ordering: visual-appeal score (`plugins-home/visualScore.ts:9-31`): featured +1000, video preview +700, poster
  +500, both +200, image/video surface +400, example outputs +320, deck +280, ... Popularity
  (`pluginPopularity.RUNBOOK.md:45-62`): score = 0.6 x norm(log1p(distinct users)) + 0.4 x norm(log1p(runs)),
  trailing 28 days of `run_finished`, min 20 distinct users else no score; default blank seeds and no-preview tiles
  sink to the bottom; the Prototype facet keeps editorial order.
- Flywheel close: "Share to OpenDesign" after a project
  (`components/share-to-community/shareToCommunityPrompt.ts`) asks the agent to package the finished project as a
  plugin (SKILL.md + manifest, copy the latest artifact into examples/), validate, pack, install locally, then
  buttons do "Publish repo" and "OpenDesign PR". Registry is a federated JSON (`plugins/registry/*/open-design-marketplace.json`,
  official ~420 entries, community 7). One plugin repo is listable in anthropics/skills, awesome-agent-skills,
  clawhub and skills.sh (`docs/plugins-spec.md:1525-1548`). The public marketplace is static pages on the same site
  with a deep link `od://plugins/<id>?apply=1` (spec section 13).
- README counts at this commit: 277 official plugins + 183 remixable examples, 151 design systems, 100+ skills,
  93 prompt templates. Live site: 458+ plugins, 152+ design systems.

Moovi transfer: a Showcase of real Moovi films (live players are cheap to host) on the landing and a "Make one like
this" action that seeds "A film like this for <your link>" and passes the source film's ref (style id, kit id, beat
plan, palette) as hidden context to a new chat. Styles in `moovi:packages/engine/src/styles/index.ts` gain
`preview: { poster, video }` and `samples: string[]`. Kits in `moovi:packages/library/src/kits/` gain a small manifest
so a user's finished film can be "Saved as a kit" ((:Kit)-[:FROM]->(:Video) in the user graph).

## 7. BYOK and any-model

- Product framing (README "Why OpenDesign"): "We don't ship an agent." The user's coding agent CLI is the engine
  (27 runtime definitions, 26 executables, `docs/agent-adapters.md`), plus a BYOK proxy
  `POST /api/proxy/{anthropic,openai,azure,google,ollama,senseaudio}/stream` with SSRF guard.
- Onboarding puts the hosted cloud first ("Free Credits"), BYOK and local agents second.
- Key hygiene (`apps/web/src/components/byok/validation.ts`): strip zero-width chars, newlines and tabs from pasted
  keys (72-77); normalize base URL (add `https://`, drop trailing slash, add `/v1` for api.openai.com, 79-120);
  detect the key's family from its prefix (`sk-ant-` Anthropic, `sk-` OpenAI, `AIza`/`AQ.` Google, 321-335) and
  return "This looks like an OpenAI key, not an Anthropic key" with an action to switch provider (262-316); model
  preference resolution (explicit > provider-preferred > single enabled > empty). Preflight block reasons are typed
  (`byok/preflight.ts`).
- Inline model switcher in the composer (`InlineModelSwitcher.tsx`, strings `inlineSwitcher.*` at `en.ts:2122-2125`).
- Headless BYOK over REST: provider config is sent per run; MCP deliberately rejects raw keys (`docs/headless-byok.md`).
- No cross-agent fallback (`docs/agent-adapters.md` section 8). Moovi is ahead here.
- Arena (live, /llm-arena-for-design/): 19 models on OD's private benchmark, five axes (requirement /30, design
  quality /70, delivery rate, completion time, cost per artifact). Headline: the cheap model reaches 91% of the top
  model's score at 5% of its cost ($0.018 vs $0.382 per artifact). A preference slider (Balanced = quality 50 /
  cost 30 / speed 20) re-ranks. Per-scenario rankings (web app, mobile, dashboard, landing). It is both SEO and the
  answer to "which model should I bring".

## 8. Distribution and growth tactics

- **Positioning**: CHANGELOG 0.1.0 (2026-05-01) calls it "a local-first, open-source alternative to Anthropic's
  Claude Design". Live home title: "OpenDesign - Best Open Source Claude Design Alternative".
- **Alternative pages** (live): /alternatives/{claude-design, figma, lovable, bolt, v0, framer, stitch, penpot,
  cursor, canva, webflow, replit}. The Canva page is honest: "keep / replace / combine", "a successful test has four
  proofs", FAQ ("Is OpenDesign a full Canva replacement? No."), with BreadcrumbList, WebPage and FAQPage JSON-LD.
- **Keyword pages**: /solutions/ai-wireframe-generator, ai-ui-generator, ai-prototype-generator,
  ai-landing-page-generator; /agents/<agent>-design (claude-code, codex, cursor, gemini, opencode); /codex-plugin.
- **Proof row** (live home): 101.7K+ GitHub stars, 443 contributors, 458+ plugins, 152+ design systems, 21 coding
  agents. Countdown campaign banner at the top ("Max free, Pro 90% off"). Showcase, Stories, Contributors,
  Ambassadors, Events, 11 locale paths.
- **README** (735 lines): hero image, UTM-tagged links (`utm_source=github&utm_medium=referral&utm_content=readme_*`),
  badges (release, license, Discord live count, "quickstart-3 commands"), a 14-language switcher, product tour
  screenshots, a platform compatibility table with one-line install per agent, "Star us" section ("If this saved you
  thirty minutes, give it a star ... One click, three seconds, a real signal"), star-history chart, contributors wall
  (contrib.rocks), a daily-regenerated metrics SVG, a Fellow program ($1,000 per MR, free LLM credits), and a
  "Contributing as an agent" block with gh commands.
- **i18n**: 14 README translations in `docs/i18n/`, QUICKSTART in 8, CONTRIBUTING/MAINTAINERS in 7; 19 UI locales
  (`apps/web/src/i18n/locales/`); `TRANSLATIONS.md` (843 lines) says a new language takes ~2 h with its checklist,
  and the most forgotten step is updating every README's language switcher.
- **In-product loops**: live star pill in the top bar (`GithubStarBadge.tsx`, cached `useGithubStars`), Discord
  online/member counts via a daemon proxy with a 5 min cache (`useDiscordPresence.ts`), share text on every shared
  artifact "Built with OpenDesign: {title}. View the deployed artifact and star the repo: {repo}"
  (`en.ts:2108-2109`), share grid for X, LinkedIn, Facebook, Reddit, Telegram, WhatsApp, Weibo, LINE (intent URLs) and
  Instagram/Xiaohongshu (copy text then open) (`packages/contracts/src/api/social-share.ts`, `SocialShareGrid.tsx`).
  "Deploy then share" deploys the artifact to Vercel or Cloudflare Pages with the user's token
  (`FileViewer.tsx:664-689`).
- **What's-new card** (`docs/whats-new.md`, `docs/whats-new.json`): one hosted JSON, shown once per `id` (content
  identity, not app version), locale overrides, fail-safe parser checked in CI. The current card is OD's own
  hackathon: share a design made with OD on X, the 10 entries with the most likes win up to $1,000 in tokens, and the
  first 50 people who share in Discord get $5 each.
- **Time-boxed campaigns** in-app (`apps/web/src/campaigns/go-plan.ts`: a 2-week window; DeepSeek V4 Flash unlimited
  for a week in 0.18.1) with server-granted display windows (`touchpoint-lifecycle.ts`).
- **Release cadence** (CHANGELOG.md, docs/CHANGELOG/): 0.1.0 2026-05-01, 0.2.0 05-02, 0.3.0 05-03, 0.4.0 05-05,
  0.4.1 05-06, 0.5.0 05-07, 0.6.0 05-09, 0.7.0 05-12, 0.8.0 05-20, 0.9.0 05-29: 10 releases in 29 days. Then
  0.10 to 0.25.1 by 2026-10-16 (about one minor every 9 days). Notes lead with a codename and a line like
  "310 PRs, 88 contributors, 7 days" (0.9.0) or "115 PRs, 22 contributors, 2 days" (0.18.0), thank contributors by
  handle, and quote measured gains (0.15.0: time to first token -49.5%, end-to-end -21.2%, input tokens -25.1%).
- **Launch post voice** (`docs/v0.8.0-announcement.md`): a movement (#DeFigma; "the designer becomes the director"),
  "This is not a release. It's a starting gun.", "40k stars in and accelerating", then "We need you. Three ways to
  enlist": break it, write a plugin, tell one person; Discord is "the war room".
- **Use everywhere**: `od mcp install <agent>` for 16+ agents, a Codex plugin, a "copy guide for an agent" modal
  (`UseEverywhereModal.tsx`).
- **Pricing** (live): Free = full desktop app with your local agent or own key, no account. Go $7/mo, Plus $14,
  Pro $60, Max $98 (first-period discounts), each with monthly credits on a "Design Plan" of cheap models; paid plans
  include "publish artifacts online and share them", API access, 10-30 concurrent tasks.
- **Privacy** (`PRIVACY.md`): analytics opt-out with a first-run banner, never artifact contents or keys, masked
  session replay, "Delete my data" rotates the anonymous id.
- **Funnel instrumentation**: `onboarding_first_prompt_sent`, `onboarding_first_generation_completed` (only when a
  previewable artifact was produced), `onboarding_completed` when the loop closes with export/share, with
  `completed_steps` ledger and `has_prefilled_prompt` computed by comparing the sent text with the seed
  (`onboarding/onboarding-entry.ts:149-166`, `onboarding/first-loop.ts:73-113`).

---

## 9. Ranked transfers for Moovi (summary; details in the structured findings)

1. Public share page for every film (live preview included) + share intents + "Made with Moovi" + replay of the crew.
2. Three Director-written next steps after each version (nonce-keyed, seed the composer).
3. Pin a note on the live player at a time/beat -> hard-scoped edit.
4. Empty Send runs the sample on show; rotating per-style sample briefs; one guide at a time; first-film hint.
5. Showcase + "Make one like this" passing the source film's ref as context; style previews in the brief overlay.
6. Lens scorecard chip per version + "Watch the crew make it" replay.
7. Version provenance (prompt, crew, model per version; restore as new version) in FalkorDB.
8. Moovi Arena: measured model table from moovi.benchmark (Groq free vs Gemini free vs Claude) on the landing.
9. BYOK: detect provider from the key prefix, clean pasted keys, inline model chip, honest landing copy.
10. #MadeWithMoovi contest during Graph Hacks, announced in a what's-new card and on X/Discord.
11. README/landing proof row, star pill, Discord, alternatives pages, i18n README stubs.
12. Daily release notes with codename + measured numbers + thanks.
13. Funnel and one-time rating stored as FalkorDB nodes (Keeper learns from it).
14. Save a finished film as a kit; publish the ishaan-motion skill to skills.sh.

## 10. Hackathon-feasible growth moves (hours, not weeks)

- Share page `/studio/s/<token>` (public, read-only, live player + "Made with Moovi" + "Make one like this") and an
  X intent prefilled with `#MadeWithMoovi @WeMakeDevs @FalkorDB` and the link. (S)
- "Watch the crew make it": replay the stored event stream on the share page at 4x. (S-M)
- Landing: replace the waitlist with "Open the studio", add a 6-film Showcase strip using live players, a proof row
  (films made, styles, models supported, measured seconds to preview), GitHub star pill, Discord. (S)
- One `whats-new.json` in `apps/landing/public/` read by the studio dashboard, show-once per id. (S)
- `/alternatives/{invideo, capcut, pictory, synthesia, runway}` and `/arena` static pages with FAQ JSON-LD. (S each)
- Daily X thread: "Moovi day N: <codename>", one measured number, one film, thanks to contributors. (S)
- README: hero GIF of the office, "Try it" link, star history, contributors, translated READMEs (machine draft,
  marked as such) in hi, es, pt-BR, zh-CN. (S)
