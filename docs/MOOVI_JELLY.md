# Moovi v3: jelly goo, eyes only (decided 2026-10-12)

**Direction:** Moovi is a squishy, morphable **jelly blob**. He has **eyes only**: no mouth, no nose. He has no separate limbs; little gooey nubs stretch **out of his body** when he needs hands or feet. His halo is made of **the same jelly**.

**Production route: pure code, no Meshy, no rig.** Moovi is a signed-distance field, raymarched in a shader. Body, pseudopods, feet and halo are blended with smooth-union, which is exactly what makes jelly merge. That gives him:
- **Arms that grow out of the body,** wave, frame and sink back in. No skeleton needed.
- **Morphing into anything** (play button, scissors, waveform, clapperboard), so Moovi *becomes* the tool his crew is using.
- **Eyes that follow the cursor, plus blinking.** All states are animated uniforms driven by the same state machine as the crew events.

The prototype is in `apps/moovi-lab/index.html` (one file, WebGL2, no dependencies). Its states are idle, wave, frame, think and morph-to-play.

GPT images are now only a **look reference** (material, light, colour) and marketing stills. The shader is tuned to match whichever image you love.

---

## Prompt J1: hero concept (eyes only, pseudopods, jelly halo)
```
3D character render of "Moovi", the god of video editing: a squishy, round, morphable jelly-goo creature, softly squashed like a mochi dumpling where he sits, irresistibly cute, Pixar-meets-collectible quality. Material: translucent soft gummy jelly, like glossy silicone slime, milky snow-white core with gentle subsurface glow, turning a soft ice-blue (#CFE6F7) where the jelly is thin, at his edges and on top of his head, wet glossy highlights, a faint iridescent mint-to-lilac sheen on the rim. Face: ONLY two big glossy dark-navy (#0E1A2B) oval eyes set low and wide apart, each with one white sparkle; NO mouth, NO nose, NO blush. No separate arms or legs: two little gooey nubs stretch out of the sides of his body like jelly reaching out, and two tiny jelly drops underneath act as feet, all flowing seamlessly from one continuous body. Above his head floats a thin halo ring made of the SAME translucent ice-blue jelly, with tiny bumps like video-editing timeline ticks and one bigger bead as the playhead. Happy little bounce pose, slightly tilted, one nub waving. Soft bright studio key light, gentle blue-white rim light glowing through the jelly, soft contact shadow, seamless icy-white (#F7FAFD) background, front three-quarter view, full body, shallow depth of field, high-end 3D render, no text, no logo.
```

## Prompt J2: morph sheet (the brand's superpower)
```
Character sheet of the same jelly creature "Moovi" (same translucent milky-white and ice-blue jelly, same two glossy dark-navy eyes, no mouth, no nose), shown four times side by side as he morphs his whole gooey body into video-editing tools while keeping his eyes: 1) a soft rounded play button, 2) a pair of scissors with jelly blades, 3) a bouncy audio waveform of jelly bars, 4) a little film clapperboard. Each form looks squishy, glossy and alive, mid-wobble, with his jelly halo floating above. Soft bright studio lighting, seamless icy-white (#F7FAFD) background, evenly spaced, high-end 3D render, no text, no labels.
```

## Prompt J3: the crew line-up
```
Group render of "Moovi", a round translucent milky-white and ice-blue jelly creature with only two glossy dark-navy eyes and a floating jelly halo, standing in the centre, with his crew of five smaller jelly blobs around him, same material and same eyes-only faces, each with a very subtle tint and one tiny gooey prop formed from its own body: a pen (writer), tiny scissors (editor), headphones (sound), a magnifying loupe (critic), a glowing memory orb (archivist). They hold their gooey nubs together like a little team. Soft bright studio lighting, gentle rim light through the jelly, soft contact shadows, seamless icy-white (#F7FAFD) background, front view, high-end 3D render, no text, no logo.
```
