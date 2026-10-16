# R1 clone, rebuilt with ishaan-motion

Files: `core.js` (eases, springs, seeded noise, drift, shutter), `type.js` (word-by-word lines, slams, typed lines),
`world.js` (room + speaker stand-in, crimson paper, keys, hand), `posters.js` (hero ring, chapter cards, 8 panels),
`edit.js` (timeline, camera, captions, big words, transitions, sfx, transport, `?grid=` check mode).
`?grid=t1,t2,...` renders our frames above the reference frames (`../f`, 2 fps) for side-by-side checks.

## Shot list (timing grid = the voice's word stamps; there is no music bed)

| # | time | shot | key move |
|---|---|---|---|
| 1 | 0–3.17 | hook on the speaker | progress bar already moving; "1:06" lands with "66 seconds"; 66 SECONDS rolls into 5 SECRETS like a slot counter; 5 dots pop on "secrets" and get sucked to centre; accelerating push into the cut |
| 2 | 3.17–6.0 | hero poster | log-space pull-out (2.6x → 1) from the FORGET close-up; FORGET ignites like a sign on "forget"; the five keys spring open on the ring with jittered stagger |
| 3 | 6.57–8.97 | panel: names / numbers / read | wipe down with velocity ghosts; icons pop on springs as each is said; connectors draw themselves |
| 4 | 10.49 | card 1 | flash on motion, then key lands in log space; poster defocused (DOF) |
| 5 | 12.9–16 | VIDEO / WASTE | slams in log space with a scale smear; camera punches 7%; WASTE sits behind the head |
| 6 | 16–19.7 | panel: ritual | pixel-block dissolve; the stopwatch sweeps 5 minutes in ticks; the notebook draws its own rough diagram on "draw" |
| 7 | 21.5–23.87 | panel: notes | papers drop on firm springs and write themselves |
| 8 | 23.87 / 36.9 / 45.9 / 61.57 | cards 2–5 | rack focus / whip / dive into the ring / rack focus: each card is the poster's own ring, dived into |
| 9 | 28–31.4 | panel: PURE | bar wipe; each letter is pressed like a key and lights as its word is said |
| 10 | 32.23–36.9 | panel: examples | header lands as the PURE lockup condensed; example 1 typed word by word; on "say" it is struck through and steps back |
| 11 | 42.57–45.9 | panel: garden | the can tilts and pours; the plant grows a stage per watering word; "Information" travels from short- to long-term memory |
| 12 | 49.37–52.63 | panel: brain | head rises; the front lobe floods blue across "improve … memory"; callout draws; 0→6 rolls like an odometer |
| 13 | 57.07–61.57 | panel: product | stand-in tin springs up; bullets typed one per keystroke |
| 14 | 66–80 | type on the speaker | 5-10 / MINUTES (behind); HEADINGS, CHAPTER + NAMES, KEYWORDS stack; IMAGINARY; MEMORABLE behind the head |
| 15 | 86.2–88.6 | CTA | "comment", the word slams, quotes arrive on springs from each side, a continuous push-in to the end; the only fade is the last 0.35 s |

## Ideas drill (picked 4/5)
- Hook title: 1 fade-in · 2 word blur-in · 3 the reference's cut swap · 4 **slot-counter roll 66→5, SECONDS→SECRETS letter by letter** · 5 dots become the poster's keys. Picked 4.
- Chapter cards: 1 crossfade · 2 zoom-blur · 3 the reference's blurred-poster card · 4 rack focus · 5 **dive into that chapter's own key on the hero ring**. Picked 5 + 4.
- PURE: 1 letters fade · 2 letters colour in · 3 the reference's one-lit letter · 4 **letters pressed like keys** · 5 the lockup becomes the next header. Picked 4, and 5 for the berlin header.
- Berlin examples: 1 lines fade · 2 typed · 3 the reference's typed lines · 4 caret + keystrokes · 5 **"instead of saying" strikes example 1**. Picked 4 + 5.
- Garden: 1 static labels · 2 plant pops · 3 the reference's growing plant · 4 drops under gravity · 5 **"Information" travels short→long while watered**. Picked 4 + 5.

## Assets that would beat the code (rule 0.1, not asked for in this pass)
1. The speaker footage (or any talking-head plate, 1080x1920, 30/60 fps) and a person matte: needed for real words-behind-head.
2. A cut-out photo of a hand holding a key ring (PNG with alpha, ~1200 px tall): the code hand is the weakest prop.
3. A brain render (PNG with alpha, side view, ~1000 px) and a mint-tin product shot.
4. A music bed (CC0/CC-BY) if the edit should have a beat grid; right now the voice is the grid.
5. Recorded keystroke and tick sounds; the library has none, so keys/ticks are pitched-up `pop.wav`.
