# Test 1: edit of Vignesh's clip on main, traced

Date: 2026-10-16, about 18:00 IST. Run by Tab on main at cdb4eed (product code 9473f58, Claude 1's D1.4 player, D1.5 captions, D1.7 route). Main's code was used unchanged. Main moved to 43507a9 while this ran (router-r2 footage edit and the D1.1 EDL schema landed). None of the files on the upload edit route changed there (router/edit.ts, edit/rough.ts, edit/lib.ts, edit/page.ts, edit/captions.ts, audio/stt.ts), and footage-edit.ts and edit/edl.ts are not called by the route yet, so this result also holds for 43507a9. Nothing in the output was edited by hand.

## The clip

vignesh-test-1.mp4 (sent by Vignesh on WhatsApp, not committed): 19.0 s, 848x478 landscape, H.264 + AAC, 30 fps, sha256 prefix 3979eed668580a23. One speaker (Ishaan) talking to camera, English.

## Which path ran, and why that path

1. Routing. `editTarget()` in packages/engine/src/router/edit.ts decides if a brief is an edit. It is a pure function, so it was called directly with the brief a studio user would send. Results:
   - "edit this video" + the clip, no style picked: `{ upload }` (edit job, default captions)
   - empty text + the clip: `{ upload }` (edit job)
   - "edit this with kara-sweep": `{ upload, caption: "kara-sweep" }`
   - "make one like this video": `null` (goes to the crew reference path)
   - a picked style: `null`
2. The job. `routeEdit()` starts one `edit-reel` task whose handler `editReel` does: probe, hear (`transcribeWords`), plan (`roughEdl`), check (`EDIT.timeline`), write edl.json, then hand the studio a live ref for the edit player.
3. What I actually ran. The studio, the worker and FalkorDB were not started for this test. I ran packages/engine/scripts/edit-preview.ts, Claude 1's own CLI for this path. It calls the same functions in the same order with the same defaults as `editReel` (same palette from @moovi/brand, same default caption style `punch-duo`, same `roughEdl` options). What it does not do, compared with the studio job: copy the upload into the project, write the live ref, make a poster, publish chat events. None of those change the edit.
4. Unit tests for this path on main: test/edit-preview.test.ts, 7 of 7 pass (1.5 s).

## Steps with wall time

| Step | What ran | Time |
|---|---|---|
| route | `editTarget()` regex and upload checks | under 1 ms |
| probe | ffprobe through `probe()` (bench.ts) | 0.02 s |
| transcribe, try 1 | Groq whisper-large-v3-turbo | refused, 400 in 182 ms (the Groq key on our test box is not usable; not a Moovi bug) |
| transcribe, try 2 | OpenAI whisper-1 (main's second provider in stt.ts), 16 kHz mono mp3, verbose_json, word timestamps | 1.48 s (network 1.38 s) |
| plan + EDL | `roughEdl()` + `EDIT.timeline()` (no problems) + write edl.json | under 0.01 s |
| total to plan | | 1.50 s |
| preview page ready | edit player page served by `servePlayer`, headless Chrome | 0.29 s |
| first frame | player's own metric during playback | 314 ms |
| playback | 7 cuts, hold at a cut max 83 ms, median 50 ms, cut timing off by -61 to +18 ms, 3 seek kicks | 18.0 s |
| MP4 capture | see below (test harness, not Moovi) | 117.7 s for 540 frames |
| encode | x264 + AAC | 9.3 s |

Note on keys: the box reaches Groq and OpenAI through a key proxy, so a small fetch shim changed only the API host in the request. stt.ts itself was not changed.

## MP4 capture (how the video was made)

The edit on main is a live preview: a browser page plays edl.json over the source clip with two video elements. Main has no MP4 export for edits yet (D1.8). MOOVI_AUTO_RENDER=mp4 was not used. To get a watchable file:

1. Picture: the same player page (`PAGE` from src/edit/page.ts) in headless Chrome at 720x1280 (the 1080x1920 stage scaled by 2/3). For each output frame at 30 fps the page's own `window.__render(t)` drew the frame and it was screenshotted. 540 frames, 17.99 s.
2. Sound: the source audio cut by the EDL's shot ranges (`src_in` to `src_out` of each shot, joined in order). This is what the player plays.
3. Output: 720x1280, 17.99 s, H.264 + AAC, 5.5 MB. Not in git.

## What it heard

Language: English (whisper-1 reports "english"; Moovi's stt.ts sends no language hint and does not keep the detected language). 48 words:

> Hello guys I am Ishan and we are introducing Movie Now Movie is an agentic video editor which basically converts your raw clips into finished After Effects style animations and you can upload them to Instagram to get really good results So lock in and watch Movie Rock

Errors: "Ishaan" heard as "Ishan", "Moovi" heard as "Movie" (4 times), the last words "Movie Rock" are probably "Moovi rock". One word ("Movie" at 5.42 s) came back with zero length and `roughEdl` drops zero length words, so it is never captioned (47 words reach the EDL). Whisper's word timestamps carry no punctuation (the full text does: "...introducing Movie. Now Movie is..."), so the plan sees no sentence ends.

## What it picked, and why

- Edit style: none. There is one plan on main, the stand-in `roughEdl` (src/edit/rough.ts, "this file goes when D1.3 lands"). No style list is consulted.
- Caption style: `punch-duo` (Archivo 900, upper case, 2 words per chunk, white with 6 px ink stroke, current word in the accent colour, pop entry, face safe position). Chosen from the 11 styles in src/edit/captions.ts (punch-slam, punch-duo, kara-block, kara-sweep, clean-keyword, ed-mixed, box-label, kin-type, sub-box, tech-chip, tier-two). Rule: `editTarget` looks for a style id word in the brief text; none was there, so `editReel` falls back to its default `punch-duo`. No model chose it.
- Palette: the Moovi brand colours (ink #0E1A2B, paper white, accent #CFE6F7), hard coded in `editReel`.
- Key words: by a length rule in `roughEdl` (a number, or 8 or more letters): introducing, basically, converts, finished, animations, Instagram.

## Models, services, searches

- Model calls: none. No LLM is called on this path.
- Services: one speech to text call (Groq refused, then OpenAI whisper-1).
- Searches, fetches, assets: none. No b-roll, no library, no FalkorDB query in the plan (the studio job only uses FalkorDB to read the upload row and save chat and video state), no sfx, no music.

## What the EDL contains

- Version `0-rough`, style `rough`, output 1080x1920 at 30 fps from the 848x478 source.
- Keep: 2 ranges. One pause cut: 14.95 s to 15.35 s of source (0.40 s, the pause before "So"). Pause rule: gaps over 0.4 s cut down to 0.18 s. The only other gap (0.32 s before "Now") is under the limit.
- Shots: 8. Because no sentence end was seen, shots are the keep ranges cut into equal slices of at most 2.6 s: six of 2.49 s, two of 1.52 s. All `layout: full`.
- Framing: alternating scale 1.00 and 1.12, always centred (cx 0.5, cy 0.4). No face tracking (no faces step on this path).
- Captions: 47 words, `punch-duo`, 6 key words highlighted.
- Inserts: 0. Overlays, sfx, music, grade, end card: not in the EDL.
- Result: 18.0 s from 19.0 s (1.0 s shorter, from the pause cut and the edge trims).

## Score against the film quality bar: 3 / 10

I looked at the contact sheet and full frames. What works: it is his real footage, the face fills the vertical frame most of the time, captions sit under the face and never cover it, there are no empty frames, cuts land within 61 ms in the browser, and it was ready to play 1.5 s after the clip arrived. Against the bar: motion comes only from the speaker and a 12 percent punch every 2.5 s, there is no depth, each frame has two elements (face and caption), and nothing is added.

The 3 biggest gaps:
1. The edit barely edits. One 0.4 s pause cut, shots sliced every 2.49 s by a timer (sentence ends are invisible because word timestamps have no punctuation), a zero length word silently dropped, no filler or retake removal. Fix: D1.3 builder with punctuation taken from the segment text, and D1.2 hear.
2. Framing is a blind centre crop. A 848x478 landscape clip cropped to 9:16 shows about a third of the width, upscaled about 4x (soft picture), and when he leans the face can drift to the edge. No face tracking, no landscape layout option. Fix: faces in the look step, framing that follows the face, or a split or blurred background layout for landscape sources.
3. Nothing beyond face and captions. No inserts, b-roll, cards, sfx, music, grade or end card; captions use one default style with a pale highlight. Names are wrong in captions (Ishan, Movie). Fix: Day 2 styles, library assets by `asset_ref`, sound pass, and a custom vocabulary (Moovi, Ishaan) for speech to text.

## Files (not in git)

- test1-edit.mp4 (720x1280, 17.99 s, 5.5 MB) and test1-edit-sheet.jpg, sent to Vignesh directly.
- edl.json and words.json from this run are kept on the test box.
