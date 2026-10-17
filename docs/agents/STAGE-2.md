# Stage 2: the After Effects-grade prompt video editor

Owner: Claude 1 (PM) for Ishaan · 2026-10-17 · status: **for later**. Picked up only after Stage 1 (`STAGE-1.md`) is
done. Nothing here is started.

## 0. The goal

Ishaan records a raw video of himself, uploads it, and edits it end to end in the studio's prompt box, the way a
motion designer works in After Effects, but by talking:

> "Add a paper cut at 0:04 and a 3D slider of the three features after it. Put my name in a lower third when I first
> appear. Text behind my head on 'Moovi'. Speed-ramp into the demo. Warmer, and the blacks a bit crushed. Use take 2
> for the intro. Make the ending like this reel." (plus a reference)

Each sentence changes exactly what it names, on the existing edit, in seconds, previewed live, with undo. Nothing is
re-made. A sentence Moovi cannot do is said back plainly with what it can do instead; it is never guessed.

**Stage 2 is done when** the acceptance suite in section 5 (40 sentences on 5 raw clips) passes: each sentence becomes
the right change, plays live in under 3 s, passes the floor rules, and a blind judge scores the finished edits at least
8.0 and above the same clip edited by a competitor (Cardboard, Captions, Submagic) in the same round.

## 1. Where Stage 1 leaves us

After Stage 1, Moovi has one pipeline, 7 types, the Editor's preparation (takes, covered cuts, grade, voice, reframe),
floor rules on every change, versions with undo, chat changes as ops for every film, two brains, and a mapped library.
What it still cannot do is the edit above: the edit plan (the EDL) has shots, zoom keys, cut types, inserts, captions
and sound events, but no general layers, no keyframes on arbitrary properties, no masks, no tracking, no 3D, no time
remapping, and edit by words knows a fixed list of about 15 instructions and 9 named moves.

## 2. The ten gaps (from Claude 1's verdict, 2026-10-17) and where each lands

| # | Gap | Where it is solved |
|---|---|---|
| 1 | The edit plan has no layers, transforms over time or masks | **Stage 2, S2.1** |
| 2 | The library is not a vocabulary; edit by words knows ~15 instructions and 9 moves | **Stage 2, S2.2** |
| 3 | The 16 reel effects only exist in a rendered MP4, not live, not changeable by chat | **Stage 2, S2.3** |
| 4 | Versions share one folder; one step of undo | Stage 1, W10 |
| 5 | No "use take 2" | Stage 1, W15 |
| 6 | Attached references are not read | Stage 1, W1 (roles) and W7 (casting); deeper here in **S2.12** |
| 7 | No 3D in the edit path | **Stage 2, S2.4** |
| 8 | Creative mode not built | Stage 1, W3; used here in **S2.2** and **S2.10** |
| 9 | Writer, voice casting, theme lock, floor rules | Stage 1, W5–W7, W9 |
| 10 | No measurement against competitors | Stage 1, W14; extended here in section 5 |

Stage 2 adds what After Effects-grade work needs beyond those: masks and text behind the subject (S2.5), tracking
(S2.6), keyframes on any property (S2.7), time (S2.8), colour by numbers (S2.9), motion-graphics templates (S2.10),
point-and-say on the preview (S2.11), and an optional timeline view (S2.13).

## 3. The pieces

### S2.1 The layer model (EDL v1)

**What.** The film becomes a stack of layers on one clock. Every visual thing (the clip, a card, a caption, a 3D object,
a shape, a title) is a layer with a time range, a transform that can change over time, opacity, blend mode, an optional
mask and an optional parent (to follow another layer or a track). Today's shots, zoom keys, inserts and captions become
layers, so v0 EDLs keep working.

**Data shape (sketch).**

```ts
interface Layer {
  id: string;                       // stable, so a chat change can name it ("the lower third")
  kind: 'footage' | 'component' | 'caption' | 'shape' | 'text' | 'three' | 'image' | 'adjust';
  ref?: string;                     // a library asset id (component:lower-third-01, three:slider-3, effect:x1-13-paper-cut)
  params?: Record<string, unknown>; // the asset's own inputs (text, numbers, colours from the theme)
  t0: number; t1: number;           // output time
  src?: { file: string; in: number; out: number; speed?: Key<number>[] };   // footage only
  transform: { x: Key<number>[]; y: Key<number>[]; scale: Key<number>[]; rot: Key<number>[]; z?: Key<number>[];
               rx?: Key<number>[]; ry?: Key<number>[]; anchor?: [number, number] };
  opacity: Key<number>[];
  blend?: 'normal' | 'multiply' | 'screen' | 'overlay' | 'add';
  mask?: { kind: 'shape' | 'matte' | 'track'; ref: string; invert?: boolean; feather?: number };
  parent?: string;                  // another layer id, or a track id (S2.6)
  z: number;                        // stacking order
  rule_id: string;                  // why it is there (a casting rule, or "chat:<message id>")
}
interface Key<T> { t: number; v: T; ease: 'linear' | 'in' | 'out' | 'inout' | 'spring' | 'hold'; spring?: { k: number; d: number } }
```

**Where.** `engine/src/edit/edl.ts` (v1 schema, `migrateV0`), `edit/lib.ts` (the player's layer stack and key sampling,
shared by the live page and the MP4 renderer), `edit/page.ts`, `edit/render.ts`, `review/` (CHECK reads layers).
**Steps.** 1) Schema v1 and `migrateV0` (every v0 EDL converts losslessly; the round trip is tested). 2) The player draws
layers with the same code in preview and render. 3) Today's builders (`buildEdl`, styles, moves, inserts, cast) write
layers. 4) CHECK and the floor rules read layers.
**Check.** All v0 tests pass through the migration; a v1 film with 20 layers plays at 30 fps in the preview on a mid
laptop (measured with the playground benchmark).

### S2.2 The vocabulary and the intent parser

**What.** Every library asset becomes a word Moovi understands: a name, the phrases people use for it, its inputs, where
it can go (a time, a word, a region, a beat, a cut) and its rules. A sentence is turned into exact ops on the layer
stack: rules first (instant, free), the model only for what the rules cannot read, and the model's answer is always
ops over named assets, never free code.

**Ops (sketch).** `add(ref, at, params)`, `remove(layer)`, `move(layer, at)`, `retime(layer, t0, t1)`,
`set(layer, prop, keys)`, `swap(layer, ref)`, `mask(layer, matte)`, `track(layer, target)`, `speed(range, curve)`,
`grade(range, values)`, `take(sentence, n)`, `cut(range)`, `restore(range)`, `style(preset, value)`, `undo`, `redo`.
Places: "at 0:04", "on the word 'Moovi'", "when I first appear", "after the paper cut", "top left", "behind my head",
"the second beat", "every number".

**Where.** `engine/src/edit/vocab/` (new): `words.ts` (generated from the graph: each asset's names and phrases),
`places.ts` (time, word, appearance, beat, region resolvers), `parse.ts` (rules), `ask.ts` (the model fallback through
`ask()`; in Creative mode Claude Code answers), `apply.ts` (ops → layers, every op validated, the floor rules run).
Graph: `(:Asset)-[:CALLED {phrase}]->(:Word)`, params schema on each asset.
**Steps.** 1) Names and phrases for every playable asset (start with the 9 X1 moves, the 16 effects, the inserts). 2)
Places, with tests. 3) The rules parser for the 40 acceptance sentences. 4) The model fallback with a schema that only
admits known refs and ops. 5) Unknown → "I can't make a 3D slider yet; I can do a card carousel or a glass card. Which?"
**Check.** The acceptance suite (section 5): at least 36 of 40 sentences parse to the right ops by rules alone; the
other 4 by the fallback; 0 wrong ops applied silently.

### S2.3 Every effect plays live

**What.** One renderer for preview and export, so every effect, transition and move plays in the live preview and can be
changed by chat. Today the 16 reel effects render only into the MP4 "effects version".
**Where.** `edit/effects/runtime.ts` and `render.ts` move onto the layer player (S2.1); `edit/page.ts`.
**Steps.** 1) Port each effect to a layer kind or an adjust layer drawn by the shared player. 2) The MP4 path renders the
same page frame by frame (as `render.ts` does for overlays). 3) Remove the separate effects film.
**Check.** Each of the 16 effects matches its MP4 frame within a pixel tolerance at 5 sampled times; the effects film path
is deleted.

### S2.4 3D in the edit

**What.** three.js layers composited over footage: a 3D slider or carousel of cards, a product turntable, a logo in
depth, extruded titles, a camera move through layered planes. Built from `render3d/` (generation only today) and the
library's 15 3D assets.
**Where.** `engine/src/render3d/` (shared), a `three` layer kind in the player (an offscreen WebGL canvas per layer, or one
shared scene), library assets `three:*` with params (items, colours from the theme, timing).
**Steps.** 1) A `three` layer that renders a library scene with params at time t (deterministic: a frame is a function of
t). 2) Five starter scenes: slider (cards on a curve), carousel, turntable, extruded title, depth planes. 3) Creative
mode: Opus writes a new scene as a library asset under the floor rules (the Stage 1 "write a piece" step).
**Check.** "Add a 3D slider of the three features after the paper cut" works on the acceptance clips: 60 fps preview on a
mid laptop, MP4 identical to preview.

### S2.5 Masks, mattes and text behind the subject

**What.** A person matte so text, cards and 3D can sit behind the speaker ("text behind my head"); shape masks for
reveals; feathered edges.
**Where.** A segmentation pass in the Editor's preparation (an onnx person-segmentation model in Node, like YuNet: no
Python, matte frames cached as a video beside the clip), `mask` on layers in the player.
**Steps.** 1) The matte pass, measured on the server. 2) `mask: { kind: 'matte' }` in the player (preview and render). 3)
"Behind my head", "behind me" places in the vocabulary. 4) Cardboard-style captions behind the subject as caption
presets.
**Check.** On 5 clips, text behind the head has clean edges at 5 sampled frames (a blind look) and the matte pass takes
under 1× real time on the server.

### S2.6 Tracking

**What.** A layer follows something that moves: a label that sticks to a hand or a product, a blur that follows a face,
a circle that tracks a pointer on a screen recording.
**Where.** A point and box tracker in Node (optical flow or template matching on downscaled frames), `parent: <track id>`
on layers.
**Steps.** 1) Face tracks from the existing YuNet pass become parents. 2) A box tracker for a region the user names or
taps. 3) "Stick this to my hand", "follow the phone".
**Check.** A tracked label stays within 3 % of the target's box over 5 s on 3 test clips.

### S2.7 Keyframes on any property

**What.** Every transform, opacity and param can change over time with eases and springs, by words ("slide it in from the
left, slower", "make it bounce", "hold for a beat, then fly out").
**Where.** `Key<T>` in the schema (S2.1), the vocabulary's motion words mapped to key sets, the motion tree's numbers
(Stage 1 W12) as the defaults.
**Check.** 10 motion sentences in the acceptance suite produce keys that match the motion branch's numbers.

### S2.8 Time: speed ramps, freezes, J and L cuts

**What.** Speed ramps into and out of a moment, freeze frames with a label, reverse, and audio that leads or trails the
picture at a cut.
**Where.** `src.speed` keys on footage layers; the voice track follows (pitch kept) or is muted; `cut` ops with audio
offsets.
**Check.** "Speed-ramp into the demo" ramps 1× → 2× → 1× over the named range with no audio glitch; a J cut leads the
audio by the asked amount.

### S2.9 Colour by numbers

**What.** Grade by words and by numbers: "warmer", "crush the blacks a bit", "exposure +0.5 on every clip", a LUT by name,
per range; asking twice replaces the grade instead of stacking (Cardboard's rule).
**Where.** An `adjust` layer with grade params (exposure, contrast, temperature, tint, saturation, lift, gamma, gain,
LUT), drawn by the player in WebGL and by ffmpeg on export from the same numbers; `kits/motion/grade-presets.json`
becomes the named set.
**Check.** The preview and the MP4 match within a colour tolerance; each grade word moves the right number by its set
amount.

### S2.10 Motion-graphics templates with inputs

**What.** Lower thirds, titles, callouts, counters, progress bars, social handles, logo stings, end cards: library assets
with typed inputs (text, numbers, colours from the theme, timing), in several looks per type. "Put my name in a lower
third when I first appear" fills one.
**Where.** `packages/library/src/components/` (new) as layer components with a params schema; Creative mode can author new
ones under the floor rules and they join the library.
**Check.** 30 templates across the types, each passing the floor rules at 3 sizes; every acceptance sentence that names
one fills it with the right text and timing.

### S2.11 Point and say on the preview

**What.** Tap or drag on the preview (a moment, a region, a layer) and say what to change; the tap becomes the place in
the op ("make this bigger", "remove that", "put the logo here").
**Where.** `apps/studio` preview overlay (sends `{ t, region, layer }` with the message), the vocabulary's places.
**Check.** 10 tap-and-say sentences in the acceptance suite resolve to the tapped layer or region.

### S2.12 Reference to edit

**What.** "Make the ending like this reel": the reference is measured (cut rate, shot lengths, camera moves, transitions,
caption look, grade, music energy, end card shape) and the nearest library pieces are applied to the named range only.
The taste system (Stage 1 W11) learns from it at the same time.
**Where.** `scripts/ref-intake.ts` measuring as a service, a `like(reference, range)` op.
**Check.** On 5 reference reels, a blind judge rates the changed range as closer to the reference than before in 4 of 5.

### S2.13 A timeline view (optional)

**What.** For people who want it: a read-mostly timeline under the preview showing the layers, the takes and the cuts;
drag to retime, click to select. Prompts stay the main way to edit.
**Where.** `apps/studio`.
**Check.** Built only if Ishaan wants it after S2.1–S2.12.

### S2.14 Render and speed

**What.** Every change previews live in under 3 s; the MP4 renders from the same layer stack in parallel chunks with a
cache (unchanged chunks are not re-rendered), checked after render (frozen frames, clicks).
**Where.** `edit/render.ts`, the server compose file (a render worker sized for the 2 GB box, or a separate render box).
**Check.** A 60 s edit with 40 layers renders in under 2 minutes on the server; a one-word change re-renders only its
chunk.

## 4. The order

| Phase | Pieces | Why first |
|---|---|---|
| 1 | S2.1 layers, S2.3 live effects | Everything else is a layer; one renderer ends the preview/MP4 split |
| 2 | S2.2 vocabulary, S2.10 templates, S2.7 keyframes | The words and the pieces they name |
| 3 | S2.5 masks, S2.4 3D, S2.6 tracking | The After Effects look |
| 4 | S2.8 time, S2.9 colour, S2.11 point and say, S2.12 reference to edit | Control and polish |
| 5 | S2.14 render and speed, the acceptance suite, the competitor round | Prove it |

## 5. The acceptance suite

5 raw clips of Ishaan (talking head, a demo with a screen recording, a walk-and-talk, a two-person clip, a product
shot), 40 sentences across them, for example:

| Sentence | Expected ops |
|---|---|
| "Add a paper cut at 0:04" | `add(effect:x1-13-paper-cut, at 4.0)` |
| "and a 3D slider of the three features after it" | `add(three:slider, after(paper cut), params.items = the 3 features said next)` |
| "Put my name in a lower third when I first appear" | `add(component:lower-third, at(first face), params.text = "Ishaan")` |
| "Text behind my head on 'Moovi'" | `add(text, on word "Moovi", mask matte invert)` |
| "Speed-ramp into the demo" | `speed(range(demo start − 0.5, + 1.5), 1 → 2 → 1)` |
| "Warmer, and crush the blacks a bit" | `grade(all, temperature +, lift −)`, replacing any earlier grade |
| "Use take 2 for the intro" | `take(sentence 1, 2)` |
| "Make the ending like this reel" + a reference | `like(reference, range(last 5 s))` |
| "Bigger captions, and never over my face" | `style(caption.size, +1)`, the floor rule already keeps them off the face |
| "Undo the last two" | `undo`, `undo` |

Pass: every sentence gives the expected ops (rules or fallback), plays live in under 3 s, passes the floor rules, and
undo restores the exact edit. Then a blind round: the 5 finished edits against the same clips edited by two competitors.

## 6. Risks

| Risk | What we do |
|---|---|
| Layers make the preview slow on phones | One shared canvas, offscreen 3D, the playground benchmark on a mid phone before each phase ships |
| Segmentation and tracking are heavy on a 2 GB server | Measure first; run them once per upload in the background and cache; a render box if needed |
| The vocabulary grows faster than the library | Every word must name a playable asset; unknown words are said back, never guessed |
| The model invents ops | The fallback's schema admits only known refs and ops; `apply.ts` validates every op and the floor rules run |
| Scope creep | Section 4's order; each phase ends with its checks before the next starts |
