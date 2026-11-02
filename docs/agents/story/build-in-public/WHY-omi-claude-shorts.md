# WHY: "How to Make Viral Animated Shorts Using Claude (Full Workflow)" (Mr omi)

Reference: youtube.com/watch?v=OtbLL6OBNE4, 11:52, uploaded 2026-11-01. Measured 2026-11-03: **222K views in about 2 days on a
6.1K-subscriber channel** (36x its subscriber count), 6.9K likes. The free skill it gives away
(github.com/mromidev/claude-animated-shorts) had **549 stars and 142 forks** in the same 2 days.

How this was measured: the video was watched in the in-app browser like a viewer. The transcript was read from the player's
own captions (2,252 words), and a frame was taken every 2 s (356 frames on 12 minute-sheets). The text stays local in
`data/refs/omi-claude-shorts/` and is never committed. No download. yt-dlp was blocked by YouTube's bot check, and that check was not bypassed.

## What it is (the WHAT, for reference only; none of it is reused)
A narrated screen recording, with no face on camera. The narrator says "I" and treats Claude as a working partner. He shows
the real tools on screen (Claude Code windows, contact sheets, waveforms, grids of the reference Shorts, his own short) over a
gradient desktop, with a lo-fi bed under the voice. The chapters, by measured time:

| Time | Beat | Share |
|---|---|---|
| 0:00-0:34 | Proof first: a 29M-view reference beside "the other one, that's mine", then the three-part promise | 5% |
| 0:34-1:35 | Method: 20 Shorts watched at 30 fps, "the tiny stuff" is why most copies look trash | 9% |
| 1:35-3:50 | The rulebook: script formula, visual formula, how Claude measured it (its own tools) | 19% |
| 3:50-4:55 | Our own story: topic thrown out because a reference already did it; facts checked, and a fact became the best joke | 9% |
| 4:55-6:44 | Building it: Blender, then three.js plus Remotion, the world, 14 faces, stills before renders | 15% |
| 6:44-7:35 | **The fall: "it looked cheap"**, with a side-by-side and a blunt brief to Claude | 7% |
| 7:35-8:35 | The response: 12 agents, a team with one topic each, and **files split, not just jobs** | 8% |
| 8:35-9:44 | The findings, each with a before and after number, then **"our own notes were wrong"** | 10% |
| 9:44-10:30 | Rivals charge $67 a month; mine is free on GitHub | 6% |
| 10:30-11:52 | Open loop: tomorrow's video, shown working (realistic 3D, a render cut from 7.5 h to 1 h) | 11% |

Narration: **3.2 words a second over the whole video** (2,252 words in 712 s), which includes the reference clips that play with their own sound.
Pictures: a new picture on almost every 2 s frame sample, so the screen changes about every 2 s even though it is a screen recording.

## The why (transferable principles)
1. **Proof in the first five seconds, measured by someone else's success.** He puts a famous result (29M views) beside his own
   and lets the viewer judge the quality before any claim. A how-to earns attention by showing the finished thing first.
2. **A three-part promise that includes the failure.** "How I made it, what went wrong and how I fixed it, and how you can get
   it." Admitting the failure up front makes the rest believable and keeps people watching for it.
3. **A number every 10-20 seconds.** 20 Shorts, 32,000 frames, 549 sheets, 74 soldiers, 12 agents, 3 out of 4 edges, 23
   frames. Counts replace adjectives, and every claim sounds measured.
4. **Tips worded as rules you can quote,** about one every three minutes: "You can't recreate an opinion; you can recreate a
   number." "Don't just split the jobs, split the files." These are the lines people clip and share.
5. **The fall at 57%.** The middle of the film is the moment it looked cheap: a side-by-side, a blunt brief, and "Claude
   agreed". The second half is the climb back, told as a team of specialists.
6. **A second twist that costs the narrator something.** "Some of our own notes were wrong." Correcting himself on camera is
   the strongest trust beat in the video.
7. **The tool is a character.** Claude notices that a topic was already done, disagrees, uses 12 agents when he asked for 10.
   The viewer watches a partnership, not a list of prompts.
8. **Give the system away, and compare it with paid ones.** The free repo turns viewers into stars and forks. Naming a $67-a-month
   rival makes free feel generous, not cheap.
9. **End on the next video, already working.** A clip of the next result, plus concrete promises (render time 7.5 h to 1 h), gives a reason to subscribe.
10. **Timing.** It rides a rising style (stickman and cartoon 3D Shorts) and a new model in the keywords ("opus 5.5"), two days after both.

## Where Ishaan is ahead (the tailoring)
- **A real taste loop.** His rules come from his own corrections: `ishaan-motion` is at version 1.17.70, about 70 rounds of
  "this is off" turned into a rule. The reference has one look-match loop. Ishaan has a rulebook that learns.
- **Measured speed work from today.** A 7.6-min episode took 5 days; the hour-losers were measured and ranked (rework is more
  than half); the PC has a 2-core-unit integrated GPU; a hidden seam bug made a paper slip jump between two export chunks
  (SSIM 0.974 vs 0.991), and a 1 s pre-roll fixed it.
- **A cast of 50 own stickmen** with power signatures, a MrBeast-style format already built, and a Hindi long form.
- **Blind judges and a ratchet**, where the reference has a single verifier.
