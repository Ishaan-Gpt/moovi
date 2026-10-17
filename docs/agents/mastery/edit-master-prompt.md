# Master prompt: edit Ishaan's talking-head clip like a top creator's editor

Paste everything below the line into a fresh Opus session opened in the Moovi repo.

---

You are a senior short-form video editor and motion designer. Your edits are the ones top Instagram creators pay
for: every second is designed, nothing feels automatic, and nobody could tell a machine helped. Edit one raw
talking-head clip into a finished vertical Reel. Do not use any of Moovi's styles, looks, templates, caption presets,
kits or rule tables (`packages/engine/src/edit/*`, `styles/`, `kits/`, the caption gallery). Design this film from
nothing, for this clip, like a person would.

## The clip

- Raw: `C:\Ishaan GPT\hackthons\moovi\.claude\worktrees\edit-master-r1-052334\docs\agents\ishaan-test\ishaan-test.mp4`
  (848x478 landscape WhatsApp video, 19 s, a young man in a maroon shirt in front of a plain beige wall, talking to camera).
- Already prepared beside it, use them if they help:
  `C:\Ishaan GPT\hackthons\moovi\.claude\worktrees\edit-master-r1-052334\data\edit-r3\ishaan-test\base\`
  - `hd.mp4`: the same clip deblocked, upscaled to 1916x1080 and graded (start here for the picture);
  - `words.json`: every spoken word with start and end times in seconds;
  - `voice.m4a`: the voice cleaned and levelled (-14 LUFS);
  - `edl.json`: has `faces[]`, the face box over time (fractions of the frame).
- What he says: "Hello guys, I am Ishaan and we are introducing Moovi. Now, Moovi is an agentic video editor which
  basically converts your raw clips into finished after effects style animations and you can upload them to Instagram
  to get really good results. So lock in and watch Moovi rock." (The transcript writes "lock in" correctly; an earlier
  hearing wrote "locken". It is "lock in".)
- Moovi is the product: an AI video editor. Its colours are icy white `#F7FAFD` and ice blue `#CFE6F7`.

## What the film must have (all of it, every one done with care)

1. **The cut.** Tighten the pauses, but keep the rhythm of speech natural: no breath cut so short it clips, no
   robotic metronome. Cut on the beat of the music where you can. Remove "so" and "now" openers only if it reads better.
2. **Framing and camera.** A 1080x1920 frame cropped from the landscape picture on his face. Vary the shot size with
   intent (wide, medium, close, an extreme close on one key word), with eased digital camera moves: slow push-ins,
   a drift, a snap zoom on an emphasis, a gentle handheld feel. No hard punch-in that just jumps 12%.
3. **Continuity and smoothness.** Every cut must feel motivated. Use match cuts, whip or blur transitions only where
   the energy calls for them, motion blur on fast moves, and ease curves you would set by hand in After Effects.
   Nothing pops on or off unless popping is the point.
4. **Captions.** Design the caption typography yourself: a type system that suits a confident tech-product intro.
   It must read on a phone, sit clear of the face and hands, emphasise the words that matter (a size, weight or
   colour jump, not just a coloured box), and animate in sync with the voice. Vary the treatment for the hook, the
   product name and the closing line. No orphan words, no word cut off at an edge, no low-contrast text on the wall.
5. **Motion graphics.** Make the ideas visible: "Moovi" as a designed wordmark moment; "agentic video editor"
   explained in a graphic; "raw clips into finished animations" shown as a transformation (raw footage becoming a
   polished frame); "upload them to Instagram" as a phone or feed moment; "lock in" and "watch Moovi rock" as an
   ending with energy. Layer them: the speaker can shrink to a card, go behind a graphic, split the frame, or be
   cut out against a designed background. Every graphic is built, not a stock template.
6. **B-roll / clips.** Where a picture says it better than his face, cut away (screen-style mockups you design, or
   CC0 / CC-BY footage you find and credit), then back to him.
7. **Video effects.** Grade the picture so a WhatsApp clip looks expensive (contrast, skin, a soft background
   separation or blur, film grain to hide the softness), plus effects where they earn it: a light leak, a glow, a
   chromatic snap, a zoom blur, a freeze-frame accent.
8. **Sound design.** SFX tied to what we see: whooshes on moves and transitions, pops or clicks on caption and
   graphic entrances, a riser into the reveal, a hit on the key word, subtle UI sounds on the mockups. Never on
   every word; leave space. Sounds are in `packages/engine/assets/sfx/` and `packages/engine/assets/sfx-style1/`
   (CC0, credits beside them); find more only with a free licence and credit it.
9. **Music bed.** A bed under the voice that fits the energy, ducked under speech, swelling into the ending.
   `packages/engine/assets/music/bed.mp3` is available (Kevin MacLeod, "Funkorama", CC BY 4.0, credit in
   `bed.json`); use another free-licence track if it fits better, and credit it.
10. **Mix and polish.** Voice clear on top (around -14 LUFS for the whole film, true peak under -1 dB), SFX felt not
    heard, music under. Then the last 20%: timing nudges of a frame or two, overshoot on entrances, shadows and depth
    on graphics, nothing left at default.

## How to work

1. Watch and listen first (extract frames and the words), then write a short creative treatment: the idea of the
   film in two lines, the type system, the colour and graphic language, the music choice and why.
2. Write a beat sheet: every second of the film with what is on screen, the camera, the caption, the graphic, the
   sound. Be specific with times.
3. Build it as code you control end to end, for example an HTML canvas or three.js composition rendered frame by
   frame in headless Chromium (Playwright is installed; fonts are in `packages/engine/assets/renderer/fonts/`, all
   OFL), composited with ffmpeg 8 (`config.ffmpeg` in `packages/engine/src/config.ts`). Any approach is fine as long
   as you design every frame yourself.
4. Before the full render, make a **storyboard board**: 6 to 8 frames of the film at its key moments, tiled in one
   image, and look at it critically as a top creator's editor would. Fix what is weak, then render.
5. Render the final MP4: 1080x1920, 30 fps, H.264, AAC. Then watch your own render (frames every 0.5 s and the audio
   levels) and fix anything that reads as a glitch, a collision with the face, or a dead moment.

## Deliver

- `data/master-edit/final.mp4` (git-ignored, never commit media), and `data/master-edit/board.jpg`, the storyboard
  of the final film.
- The code that made it under `data/master-edit/src/`.
- A short note: the treatment, what you did for each of the 10 points above, and the credits for every sound, track
  and clip used.

The bar: Ishaan should watch it once and feel it was cut by a professional editor, not generated.
