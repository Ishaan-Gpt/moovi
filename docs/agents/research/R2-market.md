# R2: market scan

Owner: Claude 1 · 2026-10-16. Web research. **Pricing comes mostly from third-party aggregators that disagree; treat
dollar figures as rough.** Items marked *(unverified)* rest on background knowledge, not a source checked today.

## The one-line read

Everyone is one of three things: **(a)** an agent on a timeline that makes a plain cut (Cardboard, CapCut EditPilot,
Descript), **(b)** a captions + zoom + stock b-roll layer (Submagic, Opus Clip, Captions, VEED), or **(c)** generated
footage (InVideo, Higgsfield, HeyGen). **Nobody ships a designed, motion-graphics film built around the user's own
footage.** That gap is Moovi's.

## Competitors

| Tool | What it is | Price (rough) | Weak point we exploit |
|---|---|---|---|
| **Cardboard** (YC W26), **the closest threat** | Footage + plain-English brief → first cut on a browser NLE; XML to Premiere/Resolve; "under 5 min" | ~$60 / ~$150 a month, flat | A cut, not a designed film; motion graphics only "on the roadmap". HN: canvas text jitter, "hard to verify it looks good". [outlierkit](https://outlierkit.com/resources/cardboard-review/) · [Launch HN](https://hn.nuxt.dev/item/47170174) |
| **InVideo AI** | Prompt → stock + generative clips + VO + captions | $25–200 | Stock look, brand drift, credit drain. [fast.io](https://fast.io/resources/invideo-ai-review-2026/) |
| **Higgsfield** | Generated clips, 7,000+ camera/VFX presets | $15–129, credits | Doesn't edit your footage; billing anger (Trustpilot ~3.2). [ucstrategies](https://ucstrategies.com/news/higgsfield-ai-review-2026-pros-cons-pricing-features/) |
| **HeyGen** | Avatars, translation, Video Agent | $29–149 | Avatar-centric, not an editor. [arcade](https://www.arcade.software/post/heygen-pricing) |
| **CapCut** | Timeline + templates + EditPilot; "CapCut × Codex" copy-a-prompt rough cut | ~$8–20 | Template sameness. [capcut×codex](https://www.capcut.com/tools/capcut-x-codex) |
| **Descript** (Underlord) | Edit by transcript; filler removal; Studio Sound | $16–65 / user | Design is template-level. [sonix](https://sonix.ai/resources/fr/descript-pricing/) |
| **Opus Clip** | Long → vertical clips + virality score | $15–29 | Misses context and humour, caption errors, silent failures. [eesel](https://www.eesel.ai/blog/opusclip-reviews) |
| **Submagic** | Captions + Storyblocks b-roll | $12–69 | A captions-and-stock layer. [costbench](https://costbench.com/changelog/submagic-plan-removed-2026-10/) |
| **Captions / Mirage** | Mobile captioned edits, generative | $10–70+ | Generative is expensive. [hooked](https://www.hooked.so/compare/captions-ai-pricing) |
| **VEED** | Browser editor, subtitles, avatars | $9–39 | Wide and shallow, upsells. [magichour](https://magichour.ai/blog/veed-pricing) |

Credit traps are the top complaint across Higgsfield, InVideo, Opus, HeyGen, Captions and VEED.

## The code-video wave (the "Opus skills" we must make look lame)

- **Remotion agent skills** (official, ~9–12 skills: captions, maps, render…). [docs](https://www.remotion.dev/docs/ai/skills)
- **HyperFrames** (HeyGen, Apache-2.0): HTML compositions → headless Chrome + FFmpeg, "the video editor built for
  agents", with skills and a Claude connector. [site](https://hyperframes.heygen.com)
- **video-use** (browser-use team), **the most direct skill threat**: point Claude Code at raw footage; it cuts filler
  and dead air, grades, fades audio, burns subtitles, and spawns overlay sub-agents (HyperFrames/Remotion/Manim).
  Needs ffmpeg + ElevenLabs Scribe. [menonlab](https://themenonlab.blog/blog/video-use-ai-video-editing-claude-code)
- Smaller: OpenMontage (AGPL, Python heavy), AutoAE (paid clips), an 8-skill talking-head kit
  ([learnwithhasan](https://learnwithhasan.com/guide/claude-code-video-editing/)). Little is actually *sold*: one
  $39 Gumroad pack (scripts and slides, not editing). Sold Opus edit skills on Whop/X: *not verified*.

**Where they all fall down:** a flat "web page" look ([autoae](https://autoae.online/blog/claude-remotion-videos-look-flat));
slow screenshot-per-frame renders ([openreplay](https://blog.openreplay.com/making-videos-claude-code-remotion/));
footage cut by ffmpeg with graphics bolted on top; a dev setup and an expensive agent session per video;
non-deterministic, no taste memory, animation code written from scratch each time.

## Copy-a-prompt / copy-a-style sites

- **Choppity "Re-create editing style"**: Hormozi, Leila Hormozi, Ali Abdaal, Tom Noske, Codie Sanchez presets, "analysed
  from real videos". Captions + reframing + cuts. [choppity](https://www.choppity.com/tools/recreate-video-editing-style/)
- CapCut × Codex prompt; Higgsfield presets + God of Prompt's library; Seedance/Dreamina prompt guides; Fiverr gigs
  selling "Gadzhi / Abdaal / Johnny Harris style" (proof people pay for named styles).
- All of them are a caption preset or a generation prompt. **None reproduces a style's grammar on your footage.**

## Trending edit styles: candidate seeds for R4 (until Ishaan's references land)

| Style | Grammar in one line |
|---|---|
| Hormozi | Heavy caps sans, one word at a time, active word yellow; jump cut every 1–3 s alternating medium/close; silence cut; punch-in on key lines, head locked across cuts; emphasis sfx. [vidpros](https://vidpros.com/how-to-edit-videos-like-alex-hormozi/) |
| Iman Gadzhi | Accent colours pulled from the footage in fixed ratios; animated text, icons, UI mock-ups, camera-move animations; heavy whoosh/riser design. [sozai](https://sozai.app/transcript/ai-edit-iman-gadzhi-videos/) |
| Johnny Harris / Vox doc | Paper and vellum textures; photos slide in with blur-to-sharp and a projector sfx; match-cut on text; masked map reveals; a chart or map every 8–10 s. [motionarray](https://blog.motionarray.com/learn/premiere-pro/edit-documentary-in-premiere-pro/) |
| Ali Abdaal | Bright clean set, selective colour on greyscale, hand-drawn annotations, calm pace. |
| Tom Noske Reels | Bold 3D-shadow captions, cinematic b-roll hook, shallow-focus close-ups. |
| Greenscreen explain | Context visual swapped every 4–6 s in the opposite third. [opus](https://www.opus.pro/blog/editing-aesthetics-dominating-short-form-2026) |
| Brainrot stack | Cuts every 0.6–0.8 s, three-colour phrase captions, gameplay under the talking head. |
| Apple launch *(unverified)* | Void, huge type, product macro moves, 1–2 words on the beat, spring motion. |
| 3D tracked text *(unverified)* | Type behind or around the subject via segmentation or depth. |
| Split podcast *(unverified)* | Stacked speakers, active-speaker highlight, waveform, captions. |

## Where Moovi wins (the wedges, ranked by what we can ship in 2 days)

1. **Your footage inside a designed film.** We already composite into designed set-ups (visual renderer, Dark Vox,
   Anatomy); Cardboard can't, and the skills bolt graphics on. *This is the pitch.*
2. **Styles as grammar, not presets.** Each edit style = laws over the EDL plus a library cast per beat; two edits never
   match. Choppity sells a caption look; we sell the editor's hand.
3. **Live preview, then MP4.** Watch the finished edit in about 30 s; screenshot render loops and 5-minute first cuts
   lose. Measure it on the live server.
4. **Instant, exact re-edits by words.** The plan is data; "punchier intro" re-casts only those beats, same output
   every time. Skills regenerate code and drift.
5. **Word-level timing drives every decision.** Captions, punch-ins, sfx and b-roll land on the syllable; transcript
   words become graph nodes linked to beats.
6. **Content-made b-roll, not stock.** Maps, charts, isometric figures, UI mock-ups and 3D from what is said.
7. **Taste memory in FalkorDB.** Edit 10 is better than edit 1; no competitor shows cross-project memory.
8. **Visible quality gates.** Critic agents check frames against measured rules before you see anything, shown through
   the Director. That answers HN's "hard to verify it looks good".
9. **Free models, BYOK, no credit trap.** Code rendering costs almost nothing per edit, so a flat price works.
10. **Craft details:** motion blur, springs, grain, one consistent LUT, crisp text (vs canvas jitter complaints).
11. **Hand-off:** export the edit as an editable project (later, XML for Premiere/Resolve).

## Not verified

Sold Opus edit skills on Whop/X; PromptBase edit prompts; Submagic's Hormozi or auto-zoom presets; independent reviews
of Descript Underlord; official 2026 pricing pages; Remotion's exact current skill count.
