# Edit mastery: the log (decision 15, 16)

Every kept change to the "Edit my video" type: what changed, where, the blind score before and after (same judge
round), and which reference it moves toward. Ishaan can veto any line; say "veto E-n" and it is reverted.

Clips: `docs/agents/ishaan-test/ishaan-test.mp4` (848x478 landscape WhatsApp clip, 19 s) and `ishaan-retakes` (the same
footage spliced with a false start and a repeated last line). References E1–E6 (R4-references.md). Made with
`packages/engine/scripts/edit-round1.ts make --out edit-r<n>` through planEdit, FalkorDB up; judged blind with
`judge --out edit-r<n> --with <previous round>` (the previous best and the references in the same round).

## Scores (blind judge, mean of Typography, Composition, Craft, Fidelity, Premium)

Each pair of columns is one judge round: the previous best re-scored beside the new outputs.

| Look | clip | r1 → r2 (round A) | r2 → r3 (round B) |
|---|---|---|---|
| Base | test | 5.5 → 5.8 | 5.1 → 5.1 |
| Base | retakes | 5.5 → 5.7 | 4.8 → 4.8 |
| Atlas | test | 5.9 → 5.9 | 5.3 → 5.4 |
| Atlas | retakes | 5.9 → 5.8 | 5.1 → 5.2 |
| Handmade | test | 5.1 → 5.4 | 5.1 → 5.2 |
| Handmade | retakes | 4.7 → 5.0 | 4.2 → 4.5 |
| Studio Minimal | test | 5.0 → 5.5 | 4.9 → 5.0 |
| Studio Minimal | retakes | 4.6 → 5.4 | 4.5 → 4.6 |
| Studio Cut | test | 6.0 → 6.0 | 5.7 → 5.7 |
| Studio Cut | retakes | 5.9 → 6.0 | 5.2 → 5.2 |
| Auto-pick (= Base) | test | 5.5 → 5.8 | 5.1 → 5.1 |
| Auto-pick (= Base) | retakes | 5.5 → 5.7 | 4.8 → 4.8 |
| References E1–E6 | | 8.9 – 9.1 | 7.9 – 8.6 |

Round B's judge was stricter overall (the references dropped too); only same-round pairs count.

## Kept changes

| # | Change | File | Before → after | Toward |
|---|---|---|---|---|
| E-1 | A landscape clip with a face is cropped full-frame on the face, every shot (punch-ins alternate); the blurred-fill fit only when no face is found (P1 A) | `edit/build.ts` | round A: Base 5.5 → 5.8, Studio Minimal 5.0 → 5.5, Handmade 5.1 → 5.4 | E4, E5, E6 (always a full-frame speaker) |
| E-2 | X1 16 "cover story" is no longer an auto move (only when asked by name) (P2 A) | `edit/moves.ts` AUTO_MOVE_ORDER | round A (with E-1): the clipped masthead and "MOOVI MOOVI MOOVI" tabs gone from every look | all |
| E-3 | Bug: the caption was drawn over a full-frame card (the logo-end line reset the insert layer's hide) | `edit/page.ts` draw() | round A | E5 (a card alone on screen) |
| E-4 | Bug: in Atlas, Handmade and Studio Minimal a library insert was drawn by the style's card with the whole 80-character line (a tall card of 15 words over the face, a red wall of text); now its headline, at most 5 words, sized to fit | `edit/page.ts` styleInsert | round A: Studio Minimal retakes 4.6 → 5.4, Handmade retakes 4.7 → 5.0 | E3, E6 |
| E-5 | A card's headline ends where a phrase ends ("Now MOOVI is an agentic" → "AGENTIC video editor"); "now" counts as padding | `edit/inserts.ts` headlineOf | round A | E5 |
| E-6 | Bug: a cut word overlapping a kept word's edge by a few ms was still captioned ("now now, Moovi is") | `edit/lib.ts` outWords | round B: Handmade retakes 4.2 → 4.5 | all |
| E-7 | Atlas sunburst only around a boxed (fit) shot, never across a full-frame face (P4 B) | `edit/styles.ts` | round B: Atlas 5.3 → 5.4, 5.1 → 5.2 | E1 |
| E-8 | Handmade term card and Studio Minimal hero card move clear of the face (lower third when a full-frame face leaves no room above) | `edit/page.ts` styleInsert | round B: Studio Minimal 4.9 → 5.0, 4.5 → 4.6 | E2, E4 |
| E-9 | The `soft` caption shadow gets a tight dark edge (white connector words read on a bright wall). Was `0 4px 22px rgba(0,0,0,.5)` | `edit/page.ts` SHADOW | round B (with E-6 to E-8) | E1, E4 |

Also confirmed: the takes bug from round 1 (a trailing "..." read as a full stop) is fixed on main; the retake clip now
keeps take 2 in every look.

## Open misses (what the judge still names)

- "locken" for "lock in" (the hearing), shown as the hero word: for the hearing, not taste.
- Base / Auto: one frame fully blurred mid-transition; single-word green chips read small and template-like.
- Studio Cut: a landscape clip stays a 16:9 film (a Studio Cut rule, b70cfd3); the judge marks every frame "not 9:16".
- Atlas: the "MOOVI" card sits on the hairline; an "IN" card half off the right edge.
- Handmade: the caption drops the name while the term card shows it ("hello guys, i am and"); stray dash and arrow doodles.
- The source itself (848x478, soft): Fidelity cannot pass about 5.5 on this clip, whatever the edit does.

## Ishaan's verdict, 2026-10-18 (binding for this session)

- The pipeline's edits scored 0/10 by Ishaan: no SFX on captions, no music bed, no continuity, abrupt cuts, no motion
  graphics, no clips, no camera moves, no effects, no polish.
- Board v2 (`edit-master-prompt.md` alone, no Moovi styles or templates) was better than the pipeline. Board v3 (the
  same prompt plus the ishaan-motion skill) was a little better again, still about 2/10 of the way.
- So the saved looks, templates, kits and rule tables are themselves weak. Do not use them blindly. Expect to scrap
  about 90% of them; keep only what earns its place against fresh, prompt-led designs.
- Method from here: design each edit from the prompt and the ishaan-motion laws, one storyboard image board per
  iteration (under 2 minutes), Ishaan's references as the taste. Boards and their source: `data/master-edit/`
  (git-ignored): `board.jpg` (v2), `board-v3.jpg` (v3), `src/board-v3.html`.

## 2026-10-18: Ref 1 is the starting point; the six looks are retired

- Ishaan: "don't refer to the previous 6 styles anymore, just ensure their good parts are in the skill". Their good
  parts are fundamentals now (ishaan-motion `edit-fundamentals.md` §8). The starting point of this style is reference 1
  (https://www.instagram.com/p/DbS2vcfyQxx/) with Premium Caption 1.
- v7 (playable): em1's devices in Moovi's brand, Premium Caption 1 with its typing tick, the pauses cut.
- Generality test: the same player, fed only a spec, edits the first 15 s of a two-person podcast Ishaan sent
  (360x640, through planEdit with FalkorDB up): name tags on the right speaker, the question card, letters on their
  words, the caption accent read from the footage. Player and spec: `docs/agents/mastery/edit-player/`.

## The beat spec (what the director should write; the player at docs/agents/mastery/edit-player/ renders it)

```jsonc
{
  "clip": "<dir planEdit wrote: words.json, edl.json (faces, removed), hd.mp4; cut.mp4 + cut.json from build-cut.mjs>",
  "palette": { "<css var>": "<value>" },            // the brand's own tokens, else derived from the footage
  "theme": { "ground": [[0, "#hex"], [1, "#hex"]], "grid": "rgba(...)", "bloom": [x, y, r, "rgba(...)"], "ring": "rgba(...)" },
  "caption": { "variant": "1.1", "accent": "video" | "#hex" },   // Premium Caption 1; hidden whenever a text graphic shows
  "music": { "file": "music/bed.mp3", "start": 2, "gain": 0.06 },
  "beats": [ { "from": <anchor>, "noCaption": false, "layers": [ <layer>, ... ] } ],
  "sfx": [ { "at": <anchor>, "k": "whoosh|pop|hit|click|snap|chime|riser|drop|notify|typing", "g": 0.4 } ]
}
```
- **anchor**: `{ "w": "word", "after": <anchor or seconds>, "n": 1, "dt": 0, "end": false }`, the n-th match of the
  normalised word at or after `after`; never a typed second for an event.
- **layers** (drawn in order; every one enters on a spring at its anchor):
  - `cam` `{ form: full|split|card|corner-br|corner-tl|corner-tr, z, Y, push, punch: <anchor>, by, dim, ground: world|room, looks: [{ at, f: <css filter> }] }`. The form morphs from the previous beat's.
  - `mg` (full-screen in the theme) `{ chars, scroll, area: [x, y, w, h], row, gap, dimOthers, lit: [{ ch, at, spot: [x, y, scale] }], headline: { html, at, y } }`
  - `stat` `{ from, to, label, splitAt: <anchor>, toAt: <anchor>, y }`: a number that splits and rolls
  - `burn` (glass widgets over the picture) `{ items: [{ kind: badge|glass, text, icon: <svg path>, at, x, y, r }] }`
  - `filters` `{ at, y }`: a burned-in filter carousel landing on its word
  - `compare` `{ still: <s>, labels: [a, b], look: <css filter>, at, at2, y }`: the clip's frame raw vs a named look
  - `cascade` `{ items: [{ title, sub, at }], y }` · `tag` `{ name, role, at, hold, x, y }` · `letters` `{ items: [{ ch, at, x, y, size, r }] }`
  - `input` `{ placeholder | typed, from, to, y }` · `sides` `{ stills: [s1, s2], at, y }` · `pill` `{ keyword, at, avatar, y }`
  - `desk` (one tabletop world for the film) `{ focus: [x, y, scale], pip }` with the spec's top-level `desk: { w, h, items: [{ src, at, x, y, w, h, r, doodle: [svg paths], dx, dy, dw, dh, label, lx, ly, lr }] }`: real clips printed and taped, landing on their words; the camera pans to each
  - `leak` `{ at }`: a warm light leak sweeping across on its word
  - spec-level `start` (an anchor: the edit begins on a word) and `theme.fall` (the dark fall-off under the captions); the grade is baked by `build-cut.mjs --grade "<ffmpeg chain>"`
  - `world` (a brand world) `{ stops, img: [{ src, x, y, w, h, enter, at, mask }], text: [{ html, y, at }], pip }` · `wipe` `{ src, at, dur }`
- Rules the player enforces: text never covers a face (every drawn picture projects its face box; text graphics move
  below it with a 44 px margin, the caption below or else above it); one text layer per frame (the caption hides under any text graphic); jump cuts are
  baked (no seeks); stills for cards come from the clip itself.

## The director's interface (edit wiring step 2, `packages/engine/src/edit/beatspec.ts`)

The beat spec is written from ONE registry (`edit/registry.ts`, in the graph as `(:Asset {edit})-[:SERVES]->(:Fn|:Verb)`,
cast with the named query `editCast`): X1 moves, reel effects, footage camera moves, UI rows and this player's devices.
Three steps; the Claude Code bridge's `direct:edit` (Creative mode) may fill any of them and hand the rest to the code:

```ts
readSentences(words: Word[]): SentenceRead[]          // pure: per sentence { i, t0, t1, text, words, fn, verbs[], hero, heroT }
castBeats(reads, caster, { asks?, recentN?, brandMark?, footage? }): Promise<{ picks: BeatPick[]; missed }>
                                                       // one registry pick per sentence that needs one (graph: openCaster())
beatSpecOf(reads, picks, { brandMark?, stills? }): BeatSpec   // pure: the spec below, same in = same out
directBeats(words, { askText?, asks?, caster? })       // all three in one call
parseAsks("add a crash zoom on 'crore'. orbit on the hook"): Ask[]   // a chat keyword overrides that sentence's pick
```
- **fn** is one of `hook who what how proof number list name compare cta show claim transition`; **verbs** are
  registry verbs the sentence says ("comment", "type", "grow", "drop"); **hero** is the one word the frame is about.
- A model in Creative mode returns `reads` with its own `fn` / `verbs` / `hero` (same shape), or `picks`
  (`{ i, id: <registry asset id> }`, e.g. `effect:reel-comment-cta`, `camera:crash-zoom-in`, `insert:s1-stat-reveal`);
  `beatSpecOf` then writes the spec, so the same answer always gives the same film.
- A pick the player cannot draw yet (orbit, freeze label, strike tags, timeline UI, the UI rows) is refused with a
  reason in `missed`, never silently swapped.
- `BeatSpec` = `{ version: 1, beats: [{ from, i, fn, hero, pick, layers }], sfx: [{ at, k, g }], picks: [{ i, id, why }] }`
  with the layers of the format above plus three the registry adds: `cam.move` + `keys` (a footage camera move sampled
  from the camera layer: `[dt, scale, cx, cy, roll]`), `cut` (`{ type, at, dur }`, lowered onto the EDL's cut at that
  word) and `x1` (`{ n, at, dur }`, lowered through `applyMove`).

### Where the spec goes (step 3, one film)
- `planEdit` writes the spec on `edl.spec`: from the bridge's direction when it carries `spec` (`specOfDirection`, its
  reads and picks; also saved as `beatspec.json`), else from the rules' director with the person's chat asks. Its cuts,
  X1 moves and sounds are lowered onto the EDL (`edit/beatlower.ts`); `beats.json` says what was picked and why.
- The studio's edit page draws it (`edit/beats-draw.ts`, the devices above ported from this player), and the delivered
  MP4 is that page captured frame by frame (`edit/film.ts`) over one soundtrack (`mix.m4a`: voice, bed, the sounds) the
  preview plays too. What the server owns stays the server's: the clip, the cut, the grade, the music file.
- Anchors are words (`w`, `n`, `after`), resolved on the clip's own words and mapped through the cut; a word the cut
  removed lands on the next kept frame.
- Not in the product page yet: `desk` (the tabletop world, its cut-out assets), `theme` / `palette` from the spec (the
  page uses the EDL palette), `caption.variant` (the page keeps its caption styles; Premium Caption 1 is Caption
  mastery's), and the player's Manrope / Russo One fonts (Inter Tight and Anton stand in until they are vendored).

## 2026-10-18: v10 "better" (em5's grammar on a new interview take)
- Kept: the baked grade, one tabletop world with real printed clips that land, self-drawing doodles, a warm light
  leak back to the speaker (Ishaan noticed and liked it), starting on the speaker's own line.
- The recipe for every edit is in ishaan-motion `edit-fundamentals.md` §12; the known gap (full-screen motion
  graphics, "1/10 compared to the reference") is §13, proposed as its own mastery.

## 2026-10-18: v11, the world from real cut-outs (motion-graphics mastery, waiting for Ishaan's verdict)
- Owner's direction: no three.js world built from scratch; use the existing tools (the player's `desk`, the kit motion
  curves in `kits/motion/core.js`) and make it look premium fast.
- The `desk` device now places real photo cut-outs (CC0 scans rendered once to PNG with alpha): a laptop playing the
  lecture clip on its own screen, a megaphone, a bulb that flickers on with a glow, framing leaves, a cup, a teapot and
  pencils sliding in from the corners at a nearer depth (parallax and depth blur). Drops fall under gravity and bounce
  twice; the contact shadow follows the cut-out's alpha. A window gobo with real leaf silhouettes lights the paper and
  sweeps in on every visit. Ink draws on its own words and labels write on from the left.
- Measured with perf.ts (2 runs each, same machine): v10 31 fps, p95 35 ms; v11 35–37 fps, p95 43–48 ms, worst frame
  149 ms, no frozen video clock over 100 ms (the world is warmed once at load).
- Ishaan on v11: "better" (2026-10-18).

## 2026-10-18: v12 (toward em5: camera and focus)
- Whip pans between the desk's stations blur with the camera's own speed (180-degree shutter, `E.hard` pan).
- A rack focus: an item with `rise` lifts toward the lens on its word (the bulb on "3D"), grows, and the table behind it
  goes soft (a backdrop blur); its own ink and label stay sharp with it.
- Real paper sheets (the a4 cut-out) stacked under each print (`stack`); a dashed ink trail that draws itself across the
  pan from the laptop to the megaphone (`kind: "ink"`, dashed lines now draw on through a mask).
- Corner leaves are sharp, the nearest pencils most blurred (per-prop `blur`), as in em5.
- Perf this round is not trustworthy: the PC was at 100% CPU from other sessions (v10 itself failed to load in time).
- Ishaan on v12: "better" (2026-10-18).

## 2026-10-18: v13 (the speaker inside the world; the world sounds itself)
- `pip: "print"`: during desk beats the speaker plays inside a taped photo print on the desk (drops in on the first
  visit with the same physics and shadow), instead of a ringed UI window; em5's world has no UI box. The face box is
  still projected, so text keeps clear of it.
- The desk generates its own foley from the kit (rule 0.3, a sound on every arrival): card-shuffle paper on each print
  landing, a soft hit on each cut-out landing, marker scratch under every ink stroke, a paper swipe for each corner prop,
  a click when the bulb switches on. `desk.sound: false` turns it off; the spec keeps only whooshes, the punch hit and
  the chime.
- Perf (same round, PC at 100% CPU from other sessions): v12 26 fps, v13 40–49 fps; video stalls appear before the
  world in every version this round, so they are load, not the desk.
- Ishaan on v13: "better, keep going toward em5" (2026-10-18).

## 2026-10-18: v14 (em5's focus pulls and warm light)
- The world enters soft and racks sharp (0.42 s, `E.out`), on top of the whip blur; the speaker comes back soft and racks
  sharp after a desk beat (`b.afterDesk`), with the leak over it. em5 cuts world ↔ speaker on focus, not on a hard cut.
- Warm window light: a second gobo layer tints only the lit panes toward sun (soft-light); the shade is lighter and
  warmer, so the paper reads cream like em5's, not grey.
- The dashed trail has a hand-drawn loop (em5's curly arrow).
- Perf (same round, PC at 21–54% CPU): v13 31 fps, p95 62 ms; v14 30 fps, p95 67 ms; worst frozen video clock 55 ms.
  Slower than v11 (35–37 fps): the rack backdrop blur, whip blur and the blended light layers cost frames.
