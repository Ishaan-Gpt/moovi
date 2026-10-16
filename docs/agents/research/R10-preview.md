# R10: can the browser play an edit live?

Owner: Claude 1 · 2026-10-16. **Answer: yes.** A source `<video>` plus an EDL overlay plays a cut, zoomed, captioned edit
at 30 fps, with its first frame in about half a second, and no encode at all. Measured with a throwaway prototype in
Claude 1's scratchpad (not the repo); its design notes are below so D1.4 can build the real one.

## The prototype

- Source: `data/visual/film.mp4` (1080x1920, H.264, 26.7 s; a stand-in, not a talking head; decode cost is the same).
- EDL: 9 keep ranges (8 cuts) making a 19.6 s output; a punch-in to 1.18 on every other range (eased 0.25 s); a
  2-word caption chunk with a pop on every word (a word every 0.33 s, a yellow key word every fifth); an insert card
  sliding in twice.
- Player: **two `<video>` elements, A and B, swapping at each cut.** The hidden one is pre-seeked to the next range;
  the output clock is the wall clock (`requestAnimationFrame`); zoom is a CSS `transform` on the visible element;
  captions and inserts are DOM with CSS transitions. Cuts are measured with `requestVideoFrameCallback`.
- Run in Chrome via Playwright (the engine's own `playwright-core` 1.56.1, channel `chrome`), headless, on Ishaan's PC
  (8 threads). CPU throttling via CDP for a slow device.

## Measured

Each row is one run; alternated A/B runs as the root CLAUDE.md asks.

| CPU | Pre-roll | First frame (ms) | Video fps | Longest hold at a cut (ms) | Typical hold (ms) | Cut lands vs EDL time (ms) | Dropped frames |
|---|---|---|---|---|---|---|---|
| 1x | none | 1067, 487, 436 | 30.0 | 67, 83, 83 | 50 | not measured | 0–5 |
| 4x slower | none | 659, 492, 522 | 29.3–29.5 | **83, 183, 150** | 83 | **+33 to +167 late** | 6–12 |
| 4x slower | 0.15 s | 627, 529, 512 | 31.1–31.5 | **67, 67, 83** | 17–33 | **−67 to +100, mostly 0 to +33** | 6–15 |

The `requestAnimationFrame` loop ran at 58–59.5 fps in every run, so captions, zooms and inserts never fell behind.

## What this means for the plan

1. **The preview costs the server nothing.** It runs in the viewer's browser; the server only serves the source clip
   with byte ranges and the EDL JSON. The 2 GB t3.small is not the limit for watching an edit, only for the MP4.
2. **Time to watch = time to build the EDL + about 0.5 s.** With R3's numbers (hear 1.9 s, cuts under 0.1 s, one model
   call 5–20 s), a 30 s clip can be playing as an edit in **10–25 s**, well under the 60 s Day 1 bar. Assets that need
   precompute (stock fetch, masks) can stream into the insert slots after playback starts.
3. **Cuts are frame-accurate enough to watch, not to export.** A cut can land one or two frames off and hold a frame
   for 17–83 ms on a slow device. That's fine for a preview; the MP4 (D1.8) is exact.
4. **Pre-roll is required.** Start the next element 0.15 s early and swap visibility at the cut. It halves the worst
   hold on a slow CPU and puts cuts on time.

## Build rules for D1.4

- Two (or three, for J/L cuts and b-roll) video elements; never seek the visible one.
- **A paused element can go idle and never finish a seek** (`networkState` 1, stuck at `readyState` 1). Kick it with a
  muted `play()` if `seeked` hasn't fired in 150 ms, then pause. Give each element its own URL (`?b`).
- Seek only after `loadedmetadata`; a seek before it is dropped.
- The server must answer byte ranges (Python's `http.server` doesn't, so the video wasn't seekable at all).
- Drive the overlay from one output clock; derive source time from the EDL, never from `video.currentTime`.
- A hidden pane or background tab stops `requestAnimationFrame`. Pause the preview when hidden, and never benchmark
  in a hidden pane.

## Not tested yet

A real talking-head clip; network latency (the server was local); Safari and iOS (`requestVideoFrameCallback` needs
Safari 15.4+); the WebGL grade and person matte running at the same time (Afterglow says they run live; worth one
combined run in D1.4); audio sync across cuts (the prototype was muted).
