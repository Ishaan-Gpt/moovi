# Brief: "GTA 6 Mein Buddha" / "Buddha in GTA 6" Short (two versions: Hindi and English)

Owner: Ishaan. Channel: Empty Coat ("Kya Ho Agar" series). Branch: film/buddha-gta6.

## What Ishaan asked for (2026-11-19, his words, summarised)
- "Since I'm talking of GTA, the visuals and 3D have to be crazy good, like GTA."
- The first 1.5 seconds are very fast. The GTA 6 + Buddha connection is shown within the first second: Buddha
  dropping into GTA 6.
- Speed each voice up a little, between 1.3x and 1.5x, whichever feels right. Keep one continuous read; it must
  still sound natural.
- Motion happens continuously from start to end, so at no point does the viewer get a chance to leave.
- Build it in the cloud. Use render-easy (.claude/skills/render-easy) to render fast. Use the strongest model
  (Fable) for the build.
- No "Kya ho agar" opener: the first spoken words are the hook.

## Inputs on this branch
- Scripts (Hindi Devanagari for the voice, Roman for captions, English): SCRIPT.md
- Voices: audio/take-viraj.mp3 (Viraj, 72.0 s; expected to be the Hindi read) and audio/take-titan.mp3 (Titan,
  77.7 s; expected to be the English read). Confirm which is which by forced alignment
  (docs/agents/story/hindi-azad/short/audio/align.mjs shows the ElevenLabs forced-alignment call; the key
  ELEVENLABS_API_KEY lives only on Ishaan's PC, so if the cloud has no key, align with any local method such as
  whisper word timestamps and map to the script's tokens).

## The film engine to start from (proven on this channel)
- docs/agents/story/hindi-azad/short/ is the latest Kya Ho Agar film: a three.js r128 page with word-keyed
  shots (cues.js, timing.js), a post stack (post.js: DOF, bloom, ACES, grade, and a 'whip' transition), captions.js
  (the series' caption look), overlay.js (cards), and acting.js with the body collision guard. It runs at 720p by
  default (?res=720). The audio is in audio/score.mjs (code-made score and sfx) and audio/mix.mjs.
- docs/agents/story/hindi-azad/short2/ is the same film on the new hero rig: hindi-gandhi/cast/herorig.js,
  acting2.js, cast2.js. The hero rig scored 7.1 vs the old 3.0 in a blind judge. Use it for the Buddha, and build the
  Buddha's look (robes, ushnisha, long earlobes, half-closed eyes) on it.
- docs/agents/speed/ has grab.mjs (contact sheets seeked from the live page), export.mjs (chunked export with a
  1 s pre-roll) and preflight.mjs. docs/launch/serve-range.mjs is the static server.

## Rules (read before building)
- .claude/skills/ishaan-motion/references/lessons.md, the newest entries (1.17.100 to 1.17.137): physics pass
  (stand on surfaces, no interpenetration, props on the hand socket), natural grade numbers and subject separation,
  a fast 2-3 s opening (crash zoom, impact jolt, whip into an orbit), Zack-style camera at story beats, the live page
  in real time (under 33 ms a frame), the hook as the first words.
- .claude/skills/author-english: the script is already written to it; don't rewrite the words.
- Copyright: our own neon open-world city at night with a game-style screen display we design. No Rockstar logo,
  map, font, HUD or characters copied. The title names the game only as commentary.
- No blood, nobody hurt. The gang scene resolves in stillness (a dolly zoom on the seated Buddha, then a pull-back
  as the guns drop).
- Text never covers a face and stays in the Shorts safe area (y 230-1480, x 70-905 on 1080x1920).
- Something new on screen at least 3 times in 2 s (punch-ins, kinetic captions, graphic beats). Measure visible
  changes per second on the render; never under 1.5.

## Picture beats (both versions)
1. 0-1 s: a game-style loading flash, then the Buddha drops into the neon street from the sky (a respawn beam or a
   game "spawn" effect). The words "GTA 6 mein Buddha" / "Buddha in GTA 6" are on screen by about 1 s. Siren,
   bass hit, camera jolt.
2. The first mission card: "steal this car". He returns the keys; the red wanted star turns gold; the owner follows.
3. The gang surrounds him, guns up, and the game says "pick up a weapon". The choice line.
4. He sits cross-legged in the road and closes his eyes; a dolly zoom; nobody pulls the trigger; the guns come down;
   the whole city stops to watch (a pull-back).
5. The dare, on his calm face.
Grade: night neon (magenta and cyan signs as motivated practical lights only), the Buddha keyed warm, natural skin,
separated from the city by value.

## Output
- One live preview link per version, plus a contact sheet of the whole film at 1.25 s steps, then one export per
  version at 720p after Ishaan watches and says export (the export-once rule).
- Give every delivered file with its full path. Commit the work to this branch.
