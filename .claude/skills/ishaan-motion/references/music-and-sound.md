# Music, the beat grid and sound

## Choosing the bed
- Pick by mood: soft / uplifting / groove / driving (~120–130 BPM, launch films and reels) / dramatic.
- Licences: CC0 or CC-BY only (Kevin MacLeod / incompetech is a solid CC-BY source; credit him on the end card).
  Never commit unlicensed audio.
- Don't reuse the same bed within 3 consecutive posts.

## Measuring
- Measure the BPM and the **first downbeat offset** (seconds to the first kick). Find bar-aligned entries into the strong sections.
- If the track has a lead-in, offset the music so the kick lands on the grid (bloom-reel: offset 0.453 s on a 125 BPM track).

## Editing the track
- Cut only on bar lines. Typical shape: start 2 bars before the climax so the drop lands at about 0:04, then splice to
  the song's real final chord for the end card. (Launch film: song 203.89→239.84 s, spliced to 271.77 s;
  climax at 0:04 = beat 8, final chord at 0:35.95 = beat 72.)

## The grid
- `SPB = fps * 60 / bpm` frames per beat; `B(n) = round(n * SPB)`. At 120.19 BPM and 60 fps, SPB = 29.95.
- Write every shot boundary and accent as a beat number, never as seconds.
- Shot length is usually 4–12 beats; fact rolls run one fact per beat; steps sit about 2.25 beats apart.
- Leave a breath (half a bar of black or a hold) before the end card when the music allows it.

## SFX
- Sparse and recorded (Freesound / Kenney CC0), not synth beeps. Roles:
  - `impact.land` on slams,
  - `whoosh.swipe` on wipes and whips,
  - `ui.click` on cursor clicks,
  - one keystroke per word as it appears (not a typing burst),
  - riser re-timed to END on the hit.
- The music does most of the work. If every frame has a sound, nothing stands out.

## Mastering
- Mix, then limit: **−14 LUFS integrated, true peak ≤ −1 dB, LRA ~11**, 48 kHz.
- `ffmpeg -i in.mp4 -c:v copy -af loudnorm=I=-14:TP=-1:LRA=11 -ar 48000 out.mp4`
- Re-measure after export and read the numbers. Don't assume they are right.
