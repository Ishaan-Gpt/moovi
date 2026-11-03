# Study: the stickman What If channels' cold opens (step 2, 2026-11-03)

Material: the first 90 s of each target's top video, downloaded as short excerpts with yt-dlp (Ishaan's yes, 2026-11-03) into
`data/refs/stickman-whatif/clips/`. Contact sheets at 1 fps and a faster-whisper transcript go in `study/`. All of it stays
local and is never committed. Only the measured why is written here.

## Ifverse, "What If Your Reaction Time Was 10x Faster?" (4.6M views, 7:13)

**Medium: 2D that feels 3D.** Flat vector shapes, with no 3D anywhere. The depth comes from:
- **Planes:** a foreground blurred and dark, the subject sharp, the background soft (a city skyline, a glowing café front).
- **Light:** a purple-to-amber sunset gradient sky, a low sun with god-rays, and windows that glow warm.
- **A warm rim line** on every black head and limb, so the matte silhouette separates from a dark background.
- **Bokeh** discs in close-ups, and a slight push-in on most shots.
This is exactly the case for the medium rule (ishaan-motion 1.17.74).

**Cast design:**
- A matte black ball head; the face is only white crescent eyes and a smile line.
- One hero colour: a red hoodie.
- The second character is told apart by a single prop: a yellow cap, or a lab coat.
- Hands are mitten silhouettes.

**The cold open (0:00-0:35) shows the power twice before naming it:**

| Time | What happens |
|---|---|
| 0:00 | A wide establishing shot of a café at sunset |
| 0:03 | A fly in macro |
| 0:05 | The catch |
| 0:11 | The friend's coffee falls; the hand is already under the cup (a slow-motion stopwatch HUD) |
| 0:20 | The friend's "How?" |
| 0:27 | The number: a normal human reacts in 0.25 s, "you" in 0.025 s (a stopwatch readout on screen) |
| 0:35 | The title card, "WHAT IF YOUR REACTION TIME WAS 10x FASTER?", over the café wide |

**After the title, the explanation (0:40-1:05).**
- A lab, with a scientist in a lab coat and a step diagram labelled over the frame: EYES → BRAIN → MUSCLES.
- A ×10 label on the glowing brain.
- A race diagram on a chalk-green board.
- The ruler test: normal 30 cm, you 3 mm, shown in a magnified lens readout.
- Then the world: the street in slow motion, and a falling flower pot caught.

**Script numbers:**
- About 1.6 words a second, calm second person ("you"), short lines with silence between them.
- About 140 words in the first 90 s.
- The pictures carry the story; the narration only adds the number and the why.
- Cuts land about every 1-2 s, often two angles of one moment (macro, then medium, then wide).

**The why (for our "1,000 Words Left"):**
1. Show the rule working twice on small everyday moments before naming it; the title comes after the proof (at about 35 s).
2. One number contrast on screen: normal against you (0.25 s against 0.025 s).
3. One friend who reacts ("How?") is the audience's stand-in.
4. A calm, slow read; the silence is part of the hook.
5. Science as simple labelled diagrams, never paragraphs.
6. Warm light against cool shadow, and a rim on every silhouette: that's the "3D feel" in 2D.

## All seven openings, measured (first 90 s; transcripts from faster-whisper, sheets at 0.5 fps)
| Channel (views) | Medium | First line | Title lands | The number on screen | The reaction line |
|---|---|---|---|---|---|
| Ifverse, reaction (4.6M) | 2D with depth: sunset, rim, blur | "A fly buzzes past your face." | 0:35 | stopwatch 0.25 s against 0.025 s | "How? How did you do that?" |
| Minute Zero (2.2M) | low-poly 3D, first person, no narrator at first | serif subtitle "You can't slow down." | 0:06 | speed HUD climbing, 5.8 to 104 km/h | none: the HUD is the story |
| Ifinite (1.7M) | 2D with depth: rainy city, glowing outline rims | "The man at the bus stop has 12 seconds left to live." | 0:32 | a timer over every head (red when near zero, green in years) | "Hey, what's your problem?" |
| Ifverse, 500 IQ (1.4M) | 2D with depth | "Your phone battery lasts a month…" | 0:48 | IQ 100 against 500 | "When did you put that there?" |
| FunNotSoFun (985K) | 3D toon | "This is you on day 15." | 0:23 | the balance, and a day counter | "Bro, is this a glitch?" |
| IFOLOGY (889K) | real low-poly 3D | "You wake up late…" | 0:11 | ×10 labels, km/h comparisons | "Did you just leave? I'm already here." |
| Miko (690K) | 2D with soft depth, white heads | "I love you." | 0:28 | a red stamped count over the face (9,316 to 9,317) | "I'm going to my sister's." |

### The rulebook (what all seven share)
**Script**
1. Second person ("you"), present tense, calm. Ifverse reads at about 1.6 words a second, with silence between lines.
2. Line 1 is a concrete everyday moment with the power already working, or a number that contradicts the words.
   The title comes after the proof (median about 0:30).
3. Another character says one short line of disbelief: the viewer's stand-in.
4. One number contrast, said and shown: normal against you.
5. After the title, a plain-words "how it works", then a spine of days or rules, and a cost ("every day takes something").

**Look**
6. **The top three are 2D that feels 3D** (Ifverse twice, Ifinite). The real-3D channels sit lower (IFOLOGY 889K, FunNotSoFun 985K).
   Minute Zero's 3D works because it is first person with a HUD, not a character film. This confirms Ishaan's medium rule.
7. Matte black ball heads; the face is only eyes and a mouth line. One colour per character (hoodie, cap, scarf).
   Every silhouette has a rim of light (warm gold in Ifverse, cool blue in Ifinite), so it reads against a dark ground.
8. Depth from planes: a blurred foreground, a sharp subject, a soft background with glowing windows. Weather or haze for air.
   One light mood per film (sunset, rain).
9. The number is a designed object over the head: a pill or a stamp, coloured by meaning, and it changes on the beat.
10. A shot every 1-2 s, often two angles of one moment. Science is shown as a simple labelled diagram.

### What this means for "What If You Only Had 1,000 Words Left?"
- **Medium:** 2D with depth in canvas: layered planes, rim light, blur by depth, one light mood. No three.js.
- **The counter:** a pill over every head that ticks down on each spoken word, with a colour by meaning: plenty, careful, last few.
- **Cold open** (our own, not Miko's): an everyday moment where a few words matter, and the counter makes the viewer feel each word's cost.
  The title comes at about 0:30. Written in step 3, in author's English.
