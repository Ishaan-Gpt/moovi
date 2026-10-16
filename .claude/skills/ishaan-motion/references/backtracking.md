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
