# Backtracking a reference video

The goal is to copy the craft (structure, timing, motion, colour logic) and none of the content.

## Steps
1. **Get the source.** For X posts: `api.fxtwitter.com/status/<id>` (or `/2/thread/<id>` for self-threads) gives the
   video URL. Download the highest bitrate.
2. **Probe it.** `ffprobe` for resolution, fps, duration. `ffmpeg -af ebur128` for loudness (most pro pieces sit near −14 LUFS).
3. **Find the grid.** Detect the BPM (audio peaks, librosa, or tap-and-check). List the cut times with ffmpeg scene
   detection (`select=gt(scene\,0.3),showinfo`). Cuts almost always sit on bars or half-bars.
4. **Sample frames** at fixed timestamps (every 0.5 s plus every cut ±2 frames) and lay them out as a contact sheet.
5. **Write the analysis doc** with these sections:
   - Source + numbers.
   - Feasibility tiers (A: code-native · B: asset + code · C: hand cel animation, out of scope), each with its share of runtime.
   - Global look: frame, palette rhythm, light, type, camera, ease.
   - Transitions, with the times they happen.
   - A shot table (`# | t | shot | motion recipe | tier`).
   - Audio.
   - **A locked prompt**: one paragraph spec that rebuilds it.
   - What we need from the owner: copy, fonts, asset sheet, music.
6. **Measure motion per channel when it matters.** Track x/y/rotation/scale of the moving object frame by frame
   (bounding box, or OpenCV LK optical flow + estimateAffine2D inside a box per object). Plot each channel and read:
   where velocity is zero, how long the settle is, overshoot, phase offsets between objects.
7. **Build, then compare.** Render our stills at the SAME timestamps and put them side by side with the reference.
   Iterate on size and timing until they line up. Then compare motion numbers: correlation ≥ 0.95, motion ratio ~1.0,
   peak offset 0 f.

## Rules
- Never reuse the author's name, their clients' marks or their illustrations. Logos become stylised stand-ins,
  and real media the original used becomes a labelled placeholder slot until the owner supplies their own.
- Be honest about tier C. Offer puppet rigs (layered PNGs on pivots) or supplied clips; never fake it badly.

## Copy it exactly (owner, 2026-10-18, demo film ref D1: "2/10 copy it exactly without missing the camera pacing sfx style everything the cinematography.. what was supposed to be a sphere became a weird idk what")
When the owner sends a reference to absorb, the first build is an **exact copy**, not an interpretation. Re-skinning
(our cards, our words, our cast) is allowed only on top of the reference's own structure.
- **Formation first.** Name the shape the elements make (a sphere of cards, a ring, a wall, a stack, a grid) and its
  numbers (count, radius, spacing, how it turns) before anything else. A sphere stays a sphere: never scatter its
  members into a loose cloud.
- **Measure at 10 fps, not 2.** Sample every 0.1 s around each move, and log per shot: framing (what fills the frame,
  where the subject sits), camera (push, pull, orbit, tilt, speed curve), the elements' paths and timings, the type
  (font class, size as a share of frame height, how each word arrives), the light and grade, and every transition.
- **Pacing is the reference's.** Shot lengths, word arrival times and move durations are copied from the measurements,
  never retimed by taste.
- **Sound style is the reference's.** List every audible event (music hits, whooshes, risers, impacts, silence) and
  copy where and how dense they are; swap only the sound files (the owner's Style 1 pack), never the pattern.
- **Same frame, same time.** Build in the reference's frame (crop letterboxing away and match the live picture's
  aspect) and check with `?grid=` stills beside the reference at the same timestamps before showing it.
