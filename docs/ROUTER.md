# The combined film (style router)

`packages/engine/src/router/` makes one finished 9:16 film from a one-line brief by mixing Ishaan's styles with the engine's own looks. It runs as the engine job `combined-reel`: the studio's brief box lists it as the style **Auto**, and a brief sent with no style and no uploads runs it by default (`MOOVI_DEFAULT_STYLE=crew` keeps the old crew path). Ishaan's four styles stay selectable and run their own `style-reel` job unchanged.

## Pipeline

1. **Director** (`film.ts`, one model call): 6 to 8 beats, each with its kind (hook, quote, place, process, stat, scene, cta), two or three stock searches, the nouns a clip must show, places, the voice (narrator or second) and an optional family.
2. **Router** (`route.ts`, pure and tested): quote to Dark Vox in the second voice, process to Anatomy, stat or list to Style 1 templates, places to the globe map, one hand-sized object to a 3D prop, the hook and the rest to full screen real footage; each of Ishaan's styles once per film; real footage keeps at least 40 percent of the film.
3. **Voice** (all lines at once): the film's clock is known before any frame is drawn.
4. **Footage casting** (`cast.ts`): every beat's searches go to every free source at once (Mixkit, Pixabay with a key, Wikimedia Commons, NASA, Internet Archive); one model call reads each line beside the candidates' own titles and tags and keeps only clips that show it. A beat with no matching clip gets a Commons photo of the subject as a push-in.
5. **Segments** in parallel: Style 1 (`s1live.ts`: Ishaan's fill planner, off-topic app props removed by `s1props.ts`, captured frame by frame), Dark Vox and Anatomy (Ishaan's `runStyle`, captured from the live player), globe map, Poly Haven 3D prop (`model3d.ts`), footage push-ins. A failed segment becomes footage.
6. **Captions** (`captions-kit.ts`): Ishaan's MotionEasy `caption-pop` component on our word timings, drawn beside the segments (only the caption band, over black and over white, matted to alpha) and skipped where a style writes its own words (Style 1, Anatomy).
7. **Cut**: picture joined, voices padded to their segments, Style 1's music bed and whooshes at each cut, captions laid over, one encode (CRF 20, capped at 3.8 Mb/s).

## Capture

`capture.ts` has two modes. `exact` (default) seeks the player to every frame and screenshots it. `recorder` (`MOOVI_CAPTURE=recorder`) records the player in real time with the CDP screencast. Measured on this box (5 s of each player, uncontended):

| Player | exact | recorder | recorder duplicated frames | SSIM recorder vs exact |
|---|---|---|---|---|
| Anatomy | 12.9 s (86 ms/frame, 0 dup) | 6.9 s | 7 of 151 | 0.953 |
| Dark Vox | 38.6 s (257 ms/frame, 19 held frames) | 8.4 s | 33 of 151 | 0.873 |
| Style 1 (MotionEasy) | 65.9 s for 135 frames | not usable | 127 of 135 | n/a |

The recorder is about 2 to 4 times faster but drops and repeats frames whenever the page renders slower than real time, so exact stays the default.

## Assets

- Stock footage: Mixkit, Pixabay (Pixabay Content License), Wikimedia Commons, NASA, Internet Archive; licences are kept on every clip.
- 3D models and HDRIs: [Poly Haven](https://polyhaven.com), CC0, fetched at render time into `<data>/cache/polyhaven/` (1k files, never committed). Thanks to Poly Haven and its artists.

## Footage edit (the user's own clip)

`src/router/footage-edit.ts` edits a raw talking clip into a reel (CLI: `pnpm --filter @moovi/engine exec tsx scripts/footage-edit.ts <in.mp4> <out.mp4> [workdir] [names] [fixes json] [kinetic|ce04]`).
Stages, timed in `report.json`: hear (whisper-1 per pause-split piece, gpt-4o-transcribe on the whole clip for the words, aligned), cut (take window after the slate, pauses from the loudness envelope), captions (`kinetic.ts`, or Ishaan's I'm your caption with `ce04`), cards and the list for the phone pull-back (one model call, clips from the free footage sources), text behind the speaker (`MOOVI_VISION_PY`: a python with onnxruntime and opencv; the U2-Net-p mask model is fetched into `~/.cache/moovi`), end card, one encode. Environment: `OPENAI_API_KEY` (and `MOOVI_OPENAI_BASE` for a proxy), the engine's usual model key for the card planner. Text is drawn in the browser, so an ffmpeg without `drawtext` works.

