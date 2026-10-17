# Editing a talking head from first principles (learned 2026-10-17/18, boards v1 → v7 of the owner's intro)

**Starting point of this style (owner, 2026-10-18): reference 1, https://www.instagram.com/p/DbS2vcfyQxx/ (em1), with
Premium Caption 1.** The six earlier Moovi looks (Base, Atlas, Handmade, Studio Minimal, Studio Cut, Auto) are retired as
starting points; what was good in them is kept below (§8) as fundamentals, not as looks.

What moved the owner from "0/10" to "better": not a template, a method. Every rule below is about *why* a frame
works, so it applies to any speaker, any script, any brand. Never copy a device from a past film; re-derive it from
this film's brand and words with the steps below.

## 1. The brand world comes from the brand, never from you
- Capture the brand's live site past its loader, read its CSS tokens, fonts and real assets (logo, mascot,
  product UI, imagery). That is the palette, type and graphic material of the film (palette.md). An invented colour
  next to a brand that has its own reads as cheap (owner, 2026-10-18).
- Name the brand's **material** (glass, jelly, paper, metal, ink, neon…) and build every graphic in it, so a
  graphic you invent still looks like the brand made it.
- Use the product's **own UI** as a device wherever the script touches what the product does (its input box,
  its buttons, its result view). Real UI beats drawn UI; drawn UI beats a generic phone mock-up.

## 2. Two worlds, one film
- World A: the speaker's room (graded footage). World B: the brand's world (its material and palette).
- The script decides when to cross: a self-introduction or proof stays in A; naming the product, explaining
  what it is, showing it work crosses to B. Each crossing is motivated (a caption that frosts the frame, an object
  that grows into the next world), never a crossfade.
- The voice never stops: when the speaker leaves the frame, keep them in the frame in B's material (a round
  window, a card) or hand the voice to the graphic that is acting out the sentence.

## 3. Read the script for meaning, then choose devices
For every sentence write: its **function** (who / what it is / how it works / proof / call to act), its **verb**, and
its **one hero word**. Then run the 5-idea drill (ideation.md) per sentence and choose by meaning:
| Function | What the frame must do | Device families (pick by the brand's material and UI) |
|---|---|---|
| who (the speaker) | let the person land | full frame, a framing that settles, the name as the hero word |
| what it is (naming the product) | reveal the brand | cross to world B; the brand's real mark or mascot arrives and acts |
| what it is (a category word, "agentic", "AI", "studio") | make the abstract concrete | the brand's own object becomes the diagram (a logo's parts = the parts of the system) |
| how it works (input → output) | show the transformation | the product's real input receives the user's own material; the output emerges from it |
| proof / result | show it worked | the user's own finished work floats beside them; never invented numbers |
| call to act | one clear action | the product's real input or button performs the action the words name |
The verb is acted out ("drop" → things fall into the input; "upload" → the send is pressed; "lock in" → something
locks). If you cannot name the device's verb, the shot is not designed yet.

### Devices that carry over from creator reels (decoded from em1, DbS2vcfyQxx; re-skin in the brand's material, never copy)
- **Cascade on springs:** one card per spoken item drops in beside the head, alternating sides, a small undershoot,
  then holds; the list builds itself on the words.
- **Dim the room, the product on top:** the footage darkens to about 60%, the product's real input or screen rises
  over it, a touch dot taps the control the words name; the speaker keeps talking underneath.
- **The lit one in a row:** three takes side by side, the middle one live and lit, the others grey: "this one".
- **The post frame:** the speaker's own clip inside the platform's story/post chrome (progress bars, avatar,
  handle) for any "post / upload / share" line.
- **An object wipe:** the brand's own object (logo, mascot, prop) whips across with motion blur as the cut between
  worlds, instead of a crossfade.
- **The comment pill ending:** the speaker's avatar, the keyword typed letter by letter, the send pulses on the
  last word.
- **Captions step aside** wherever a brand graphic already says the words (the world-B reveal).

## 4. One caption system, derived from the brand's type
- Two tiers: the connecting words small, the hero word large; the words arrive on their own stamps.
- The faces come from the brand (its display + text fonts); the hero word may switch to the brand's display face.
- **Contrast follows the backdrop, from the same ramp:** over footage, the light end of the brand ramp with a dark
  tinted shadow; over the brand world, the deep end with no shadow. Never one colour for both (v6 frame 4: light
  frost on ice vanished).
- Never cover the face or the mouth with a caption or a graphic; place by the face box, and move the caption when
  a device owns that zone.

## 5. Rhythm of layouts
Full → world → split → world → card → full …: never the same layout twice in a row, a new framing on every cut,
and at least one beat per 3–4 seconds that changes the frame's structure (not just its zoom).

## 6. Build it as data, not as a one-off
- Every time is a word anchor (`at('lock')`), never a typed second; every layout, device and caption is an entry in
  a beat spec `{ anchor, layout, device, caption: { small, hero }, sfx[], camera }`, and one generic player renders
  any spec. A new video is a new spec, and a new device is a new reusable component in the brand's material.
- If the code only works for this clip (hard-coded seconds, hand-placed boxes for one face), it is a sketch, not
  the deliverable; fold it back into components and rules before calling it done.

## 7. Show it
A storyboard board (frame + labelled side panel) to agree the plan, then a playable preview with voice, SFX and the
music bed, served so the video can seek. Stills alone hide timing, the thing that makes or breaks an edit.

## 8. Kept from the retired looks (fundamentals only)
- Cut every pause over about 0.4 s down to a breath (0.18 s), fillers with their air, never inside a word; a false
  start is cut whole when the line is said again (the takes).
- A new framing on every cut, never two identical framings in a row; a slow push inside long holds.
- Cards beside the head on named things and numbers, never on the face; the caption drops the words a card already says.
- A punch-in on a word edge with a hit under it; a white flash only on motion, never more than every third cut.
- One hero number per section, set big, with a riser into it and a hit on it.
- Sound: one SFX stem by events (min gap by priority, at most two punches), voice at -18 LUFS, the bed 3 LU under it,
  the master at -14 LUFS through a limiter; the typing tick under caption words.
- Grade every upload (the owner's natural-punch LUT); weak sources deblocked and denoised, never a plastic upscale.

## 9. One player, many specs
The preview is one generic player fed a beat spec (`{ clip, palette, caption, music, beats: [{ from: anchor, layers:
[{ t: device, ... }] }], sfx }`); devices: cam (framing, push, punch), world, cascade, tag, letters, input, sides,
pill, wipe. Tested on two unlike clips (a solo product intro, a two-person podcast) without changing the player.
A spec is what the pipeline's director should write; the player is what the studio should play.
