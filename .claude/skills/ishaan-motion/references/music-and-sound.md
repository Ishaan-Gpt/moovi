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

## Voice delivery (Ishaan, 2026-10-21: monotonic, then "different voices sound weird, keep 1 voice only, fast paced")
- One voice, one continuous read of the whole script in a single synthesis call, faster (about +25-30% rate for Andrew Multilingual, about 3.8-3.9 words a second). Never speak lines separately with different pitch/rate/volume offsets: it sounds like different people. Tighten silences by cutting the middle of gaps over 0.2 s; keep the voice itself untouched. Tone comes from the writing and the voice's own intonation.

## Sound is built WITH the picture, never last (Ishaan, 2026-10-22: coat film 1, first 43 s: "animation storytelling 9/10, voice captions sfx music 2/10")
The picture had four builders and three review rounds; the sound was one lead's side job (WebAudio beeps, a drone for music, no
captions, a fast flat read). So the sound got none of the craft the picture got, and it showed.
- **A sound lead from minute one,** with the same weight as a shot builder: the score, the sfx and the caption system are designed
  from the script and the story beats before the shots land, then re-keyed to the shots' word times.
- **A composed score, not a drone:** themes, a key, instruments that belong to the world (for 1347: plucked strings, a bowed drone,
  frame drum, bronze), entering at the title, moving 4-6 dB with the story, sub weight at the turns (the Ifology measure), never silent.
- **Designed sfx in families from what is on screen** (straw, wood, bronze, cloth, brass, ink), layered on hero beats, pitched per hit,
  a room/reverb per set; never generic tones (see the AirPods SOUND-WHY).
- **Captions are always on** (the series system, adapted to the frame), and the shots keep their caption band calm in the contract.
- **The voice is chosen per film from rendered candidates,** delivered as a storyteller (one voice, one continuous read).
- **Mixed and measured offline** (voice -18 LUFS, bed 3 LU under, master -14 LUFS, TP < -1 dBTP); the player plays the measured mix.

## Trailer and Short sound (2026-10-25, Ishaan 4/10: "weird song in the back", "the sounds could have been so much better")
- No tone-generator melodies (sine/additive "guitars" read as weird). Plucked instruments come from a string model (Karplus-Strong with a
  wooden body) or real samples; the bed is a dark pad + a rhythm that IS the subject (a clock speeding up for a film about time).
- Trailer grammar: pre-roll motif, a rhythm that tightens with the stakes, a dead stop for the reveal, silence, a riser through the black,
  one braam + boom on the title, key clicks for typed letters, a bright change for the end card, a slam on the CTA's spoken word.
- Measure stems, not the mix: in every spoken line the bed sits 6-9 LU under the voice; in the gaps the bed carries at about -17 LUFS
  (a bed 19 LU under the voice made the first line sound empty and odd). Master -14 LUFS, TP -1.2.
- **Level riding by line (2026-10-26, film 3):** a cue sheet written by hand landed 10-28 LU under the voice on most lines (too empty).
  Mix once with stems, measure voice vs bed per spoken line, write a gain per line (clamped -8..+14 dB) so the bed sits ~7.5 LU under,
  ramp 0.4 s between lines, re-mix (2-3 passes converge). Keep deliberately sparse beats (a comic wait, a 3 a.m. silence) sparse.
  Code: Moovi `docs/agents/story/ai-disappeared/film-unfinished/audio/ride.mjs`.

## Voice and bed for explainer Shorts (Ishaan, 2026-10-26, on the voice-cloning Short v1)
- **"Use the voice of a young man, realistic."** Cast a young, natural male read: Edge `en-US-BrianMultilingualNeural` (casual, sincere) won
  his A/B against William (AU), Liam (CA) and the old Andrew (warmer, older). Still one continuous read at about +25%; the closing lines may
  be read a little slower (TAIL). Offer the A/B as one audio file of whole reads, never single words.
- **"Have a music bed behind the video."** A bed he cannot hear is the same as no bed: it sits about 7.5-8.5 LU under the voice (bed
  level = voice - 7.5 dB before the ride, ~1 dB lower under speech), never -10 or below. When asked, send the bed choices as one file with
  the real voice over each bed (he kept Funkorama, louder).

## Hindi narration (Ishaan, 2026-10-28, on the Dandi Short: "Hate them all")
- He rejected every Edge Hindi voice (Madhur, Swara, normal and fast). Hindi films use a real ElevenLabs Hindi narrator from the voice
  library; his pick, made on the website: **Viraj - Energetic, Clear Narrator** (model v4, speed ~0.93, stability ~41%, similarity ~75%).
- His ElevenLabs account is on the free plan, which cannot call library voices through the API (402 paid_plan_required). So the
  voice is generated on the website from a Devanagari text file Claude writes (numbers spelled as words), and word timing comes
  from ElevenLabs forced alignment (`/v1/forced-alignment`, works on free), mapped token for token to the Roman caption script.
  Moovi code: `docs/agents/story/hindi-dandi/short/audio/align.mjs`.
- The world's own instruments in code for an Indian story: tanpura drone and sitar (Karplus-Strong with a jawari buzz), santoor
  plucks, keherwa theka on modal tabla (dayan/bayan with the bayan's pitch glide), not tone generators.
