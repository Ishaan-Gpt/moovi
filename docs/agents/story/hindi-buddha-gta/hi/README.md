# GTA 6 Mein Buddha: the Hindi Short (Empty Coat, Kya Ho Agar series)

One film page, two caption tracks. Built in a cloud session on branch `film/buddha-gta6` from `../BRIEF.md` and
`../SCRIPT.md` (the words are unchanged).

## See it

```
node docs/launch/serve-range.mjs docs/agents/story 4390
```

- Live page: `http://localhost:4390/hindi-buddha-gta/hi/short.html` (Play, scrub, and an HI / EN button).
- English captions on the same picture: add `?cap=en` (the HUD words switch too). `?nocap=1` hides captions,
  `?clean=1` hides the whole overlay, `?t=12.3` opens at a time, `?res=720` is the 3D width (default).
- The 720p preview render: `preview/buddha-hi-720.mp4` (Hindi captions, with sound).
- Contact sheets at 1.25 s steps: `preview/sheet-hi-1.jpg`, `preview/sheet-hi-2.jpg` (and `sheet-en-*.jpg`).

## What is in the film

- **The Buddha** (`buddha.js`) on the hero rig (`../../hindi-gandhi/cast/herorig.js`): half-closed eyes (the
  `serene` face), tight curls with the ushnisha, long earlobes, the urna, a saffron robe with a lighter fold across
  the chest. He falls in standing, gives the keys back, raises the open hand (abhaya), sits cross-legged with his
  hands in his lap (dhyana) and closes his eyes.
- **The owner and the gang** (`cast.js`): the family's plain gentleman re-dressed four ways (own skin, hair, jacket,
  trousers, shoes), with our own beanies, bandanas and shades. Nobody is a real person or a game character.
- **Neon Nagar** (`sets.js`): our own night city. Invented sign names, a lotus-bud tower at the end of the street,
  wet tarmac that mirrors each sign toward the camera, palms, street lamps, cross traffic that brakes when the city
  stops, a searchlight, steam, people on the pavements who gather in a ring at the end. No Rockstar logo, map, font,
  HUD or character is used; the title names the game as commentary.
- **The game screen** (`overlay.js`): our own HUD. A spawn bar, the title, a mini-map, a weapon wheel whose pointer
  stops on the open hand, the mission plate ("YE CAR CHURA LO", struck out in gold when the keys go back), wanted
  stars (one red, turned gold; five gold when the city stops), "HATHIYAAR UTHAO", the choice (BHAAGO / LADO with a
  clock; both struck out), the trigger prompt that goes dead, a comment bubble. Every word on a plate comes from the
  script.
- **Captions** (`captions.js`): the series look (Baloo 2 ExtraBold, warm white, umber stroke, pistachio key word).
  Hindi is word-timed. English is timed line by line to the Hindi voice (phrase by phrase where both lines have the
  same number of comma phrases). Cards stay in the safe area and move to the nearest free line when a face or a plate
  is in the way; close-ups are framed so the whole face stays above y 1230.
- **No blood, nobody hurt, no shot fired.** The leader's jacket was changed from red to near-black because red read
  as blood.
- **Sound** (`audio/score.mjs`, `audio/mix.mjs`): all made in code. Synth bass, pad, arp and drums for lines 0 to 5;
  a drone and singing bowls when he sits; a major lift when the guns come down. Sfx on the picture's cues. Voice
  -18 LUFS, score 9 LU under, master -14.4 LUFS, true peak -1.4.
- **Voice** (`audio/ALIGN.md`): Viraj confirmed as the Hindi take; 1.4x (51.5 s, 3.6 words a second).

## Rebuild

```
node docs/agents/story/hindi-buddha-gta/hi/audio/score.mjs
node docs/agents/story/hindi-buddha-gta/hi/audio/mix.mjs
node docs/agents/story/hindi-buddha-gta/hi/tools/grab.mjs out=out/sheets step=1.25
node docs/agents/story/hindi-buddha-gta/hi/tools/measure.mjs mp4=preview/buddha-hi-720.mp4
node docs/agents/story/hindi-buddha-gta/hi/tools/render.mjs out=out/buddha-hi-720.mp4
node docs/agents/story/hindi-buddha-gta/hi/tools/render.mjs out=out/buddha-en-720.mp4 q=cap=en
```

The tools use the cloud's headless Chromium (software WebGL). On Ishaan's PC, `docs/agents/speed/grab.mjs` and
`export.mjs` work on this page too: it exposes `window.seek`, `window.frameB64`, `window.__ready` and `window.DUR`
like the other films. three.js r128 and the MP4 muxer are in `vendor/` because the cloud cannot reach cdnjs.

## Taste defaults added here (proposals: each needs Ishaan's yes)

Nothing below was approved; all of it is a first proposal so there was a film to look at.

1. Voice speed 1.4x (the brief allowed 1.3 to 1.5).
2. The Buddha's colours: saffron robe `oklch(0.63 0.15 60)`, lighter chest fold, blue-black curls, skin
   `oklch(0.68 0.072 62)`.
3. The cast's colours: owner in a pale teal jacket; gang in dark plum, petrol and near-black oxblood; bandanas in
   magenta, teal, yellow and black.
4. The city palette: sign colours magenta `#ff2e97`, cyan `#19e6ff`, amber `#ffb347`, lime, violet; sodium street
   lamps; navy-to-magenta sky; the invented sign names.
5. The grade: contrast 0.46, saturation 1.1, bloom 0.5, a warm key near the lens, a cyan rim, a warm bounce from the
   road, a soft gold halo behind him on his beats.
6. The HUD: Rajdhani Bold (new font), skewed dark plates with a neon edge, gold / magenta / cyan / red, and its
   wording (all from the script: "YE CAR CHURA LO", "HATHIYAAR UTHAO", "FAISLA AAPKA HAI", "BHAAGO", "LADO",
   "TRIGGER", "MISSION 01", "PLAYER SPAWN"; English: "STEAL THIS CAR", "PICK UP A WEAPON", "THE CHOICE IS YOURS",
   "RUN", "FIGHT").
7. Caption key words per line, for both tracks (the lists at the top of `captions.js`).
8. The score: 100 bpm, D minor to D major, singing bowls; mix levels (score 9 LU and sfx 7 LU under the voice).
9. Camera and motion numbers: every shot's move, the 0.6 s landing, whip transitions of 0.16 to 0.22 s.

## Files

`short.html` the page · `shots.js` 40 word-keyed shots · `sets.js` the city · `buddha.js`, `cast.js` the cast ·
`overlay.js` HUD · `captions.js` both caption tracks · `post.js` the series' post stack (DOF, bloom, ACES, grade, whip)
· `timing.js` word times · `script.js` the three scripts · `cues.js`, `palette.js` from the series ·
`audio/` voice, alignment, score, mix · `tools/` grab, render, measure · `casttest.html` the cast sheet page.

## Measured (2026-11-18, cloud session, 4 CPU cores, no GPU)

- Render: 1,574 frames at 720x1280, 30 fps, in 62 min (2.16 s a frame to draw, 0.012 s to encode); `preview/buddha-hi-720.render.json`.
- Changes per second (`MEASURE.json`): 40 cuts (a shot every 1.29 s), 74 caption cards, 29 HUD beats, 27 in-shot beats.
  Picture and captions together: mean 3.24 a second, lowest 2 s window 1.5 a second (at 6.5 s). Picture alone: mean
  1.78, but it falls to 0 in the held shots around 30 to 37 s (his eyes closing, the dolly zoom), where only captions change.
- First 1.5 s: 10 picture events (spawn bar, cut to the landing at 0.3, title at 0.56 and 0.7, the jolt at 0.6, whip to the orbit at 1.0).
- No black frame in the render. Master -14.4 LUFS, true peak -1.4.

## Known gaps

See the session report; the main ones: nobody has heard the mix or the 1.4x voice, the word timing is a local
alignment (about 0.1 s inside phrases), the far pedestrians and the cars are simple, the sit-down move passes through
an awkward skirt shape, and the choice plate crosses his hair in one close-up.
