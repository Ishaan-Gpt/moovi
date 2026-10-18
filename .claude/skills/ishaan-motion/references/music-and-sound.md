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

## Launch films: a real bed, the owner's pack, cuts on the beat (f14–f15, 2026-10-18)
- **The bed comes from the library** (product-safe Mixkit tracks in `engine/src/library/music-tracks.json`, fetched by
  `fetchMusic`). Its drop or lift lands on the film's big reveal: offset the track so that beat meets the reveal.
  Which bed is the owner's call; offer two or three with the film.
- **Beat phase when the track has no grid:** decode to mono 11 kHz, take an onset envelope (10 ms energy rises) and
  pick the phase that maximises onsets on the beat positions (Close Up: 103.0 BPM, phase 0.08 s).
- **Cuts on the beat without re-cutting the film:** map film time to audio time piecewise-linearly between the cuts,
  each cut snapped to its nearest beat (floor or ceil, whichever keeps the shot's speed nearest 1×, ±15 % at most).
  Speed then changes only on a cut, where no one can see it. Schedule every cue through the same map.
- **The owner's Style 1 pack, by its own rules** (`engine/assets/sfx-style1/map.json`): card-in = a woosh peaking on
  arrival + a soft land; word = a 60 ms typing slice from an onset + a click; cascade = a pop on every 2nd item,
  fading; scene = an air cut; at most 2 punches; a 60 ms minimum gap by priority; risers end on the cut; no ducking.
  Level each sample by its RMS around the peak to the map's target, SFX stem +6 dB.
- Master through a compressor and a tanh soft clip; peaks under -1 dBFS. Render the score while the page loads.
