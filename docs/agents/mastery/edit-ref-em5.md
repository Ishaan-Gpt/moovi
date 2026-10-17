# Reference em5: a before/after showcase (https://www.instagram.com/p/DdM89KRMPBJ/)

An editor's portfolio reel, 23.8 s, 1080x1920. The raw clip (a two-camera podcast interview, "Before", small card
left) plays in sync beside the editor's version ("After", large card right), on a sunlit cream wall with a
"Comment Edit" call to action. Everything below is what the edit adds to the raw clip, measured on paired crops of
the two cards at the same instants (`data/refs/em5/pairs/`, local only; never commit reference media).

## What the edit does to the raw clip

| Layer | Before (raw) | After (the edit) |
|---|---|---|
| Framing | locked wide, two cameras | reframed about 1.25x tighter, every shot pushing slowly; the closer second angle saved for the payoff (the numbers) |
| Grade | flat, cool | highlights pulled down (top-third luma 136 → 115), blue cut from the image (mean B 82 → 70), saturation up about 20 % (91 → 109): a warm green-teal "cinema" look; a soft dark fall-off toward the bottom where the captions sit |
| Captions | none | two types: a small white lowercase lead line whose letters rise in one by one out of a blur, and the sentence's key phrase large with a yellow glow ("on videos", "filming", "1.5 million in video"); one key phrase per sentence; an orange box marks "in advance"; one caption system for the whole film |
| Full-screen graphics | none | a photoreal tabletop world (cream paper surface, window-blind light falling across it, leaves in the corners, a coffee cup, pencils) for about 6.5 s in the middle (8 to 14.5 s), while the voice explains the process |
| Objects | none | photoreal cut-outs that act out the words: a brain (ideation), a light bulb that switches on (an idea), a clipped storyboard (the plan), a video player with an "UPLOAD" tag (uploaded) |
| Hand-drawn layer | none | doodles that draw themselves on the tabletop: a dashed arrow from plan to video, handwritten "1-2 MONTHS", sketch notes "concept / story / style", a small bulb sketch |
| Transitions | hard cuts between cameras | the tabletop enters as its light sweeps in; objects drop in from above with motion blur and land with a contact shadow; leaves slide in from the corners to frame it; a yellow light leak wipes back to the speaker; blur-to-sharp on cuts |
| Rhythm | one wide shot | speaker (hook) → tabletop world (process) → speaker, tighter (payoff numbers); the world appears once, in the middle, for the part that is hard to picture |

## Fundamentals to take (not its content)
1. **Grade before anything**: compress highlights, pull the blue, lift saturation, darken toward the caption zone.
2. **Reframe tighter than the raw** and keep every shot moving; save the closest angle for the payoff.
3. **One full-screen world, used once, for the abstract middle**: a physical surface with real light on it, photoreal
   objects that act out each noun or verb, and a hand-drawn layer on top (arrows that draw, handwritten labels).
4. **Objects land, they do not appear**: drop with motion blur, a contact shadow on landing, framing props slide in
   from the corners.
5. **Light is the transition**: the world's own light sweeps in; a light leak wipes back to the speaker.
6. **One key phrase per sentence**, lit; the rest small and quiet.

## What it needs that code alone cannot fake (rule 0.1)
Photoreal cut-outs with alpha (brain, bulb, papers, devices, leaves, cup) and a lit surface plate; these must be
fetched or generated, never drawn as flat stand-ins. Sound was not analysed in this pass.
