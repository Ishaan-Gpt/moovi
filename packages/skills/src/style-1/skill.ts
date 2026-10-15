import type { Section } from '../types';

/**
 * Style 1, the owner's VO-led explainer Short, as rules the crew works from. Source: the owner's
 * MotionEasy .claude/skills/style-1/SKILL.md (owner rules, measured in references, corrected on every film);
 * brand specifics are made generic here, the rules are kept.
 */
export const SECTIONS: Section[] = [
  {
    id: 's1:what', title: 'What Style 1 is', roles: [],
    text: `A voice-led explainer Short: 9:16, 1080×1920, 30 fps, about 20–45 seconds. One continuous light stage; the voice drives every visual event, and each one lands on a spoken word. Something new enters every 0.5–1 s; there is never dead air. Scenes change on the voice's beats with cuts on motion, never fades.`,
  },
  {
    id: 's1:script', title: 'The script', roles: ['moovi', 'scribe'],
    text: `- The user's text is input, not copy. Rewrite it into hook → proof → climax → CTA. Cut duplicates. One idea per line.
- Verified facts only. Never a number or a proof word (best, #1, loved by, million…) that a fact doesn't hold.
- Every new video takes a NEW angle and a NEW hook form (a question, a confession, a bold claim, the old way vs the new…). Never one this user's videos already took.
- First person in the brand's voice ("We just…", "I used to…"), short spoken sentences, 2.6–2.9 words a second, at most about 24 words a beat.
- The brand beat says the product's name. The last beat is the ask (comment a keyword, or the call to action).`,
  },
  {
    id: 's1:screen', title: 'What the screen carries', roles: ['scribe', 'director', 'builder', 'lens'],
    text: `- Not every spoken word goes on screen. The screen carries the KEY words: the hook word, the proof word, the climax line. The visuals carry the rest.
- A line is at most ~22 characters, at most 5 words, made of words the voice says in that scene, in the same order.
- One hero word per scene may SLAM in the accent.
- A two-line title is one ink line plus the gold serif-italic line; never two ink lines.
- Every shown word gets a typing note on the frame the voice says it (the kit does this).`,
  },
  {
    id: 's1:stage', title: 'The stage (never change it)', roles: ['director', 'builder', 'lens'],
    text: `- NEVER change the background inside a video: the stage stays the same light paper with slow drifting glows in the palette, a fine dot grid fading to the edges with light parallax, film grain and a soft vignette (the kit draws it).
- Two relatable assets sit half off the frame edge (top-left and bottom-right), rotate in at the start, stay completely still, rotate out at the end. Keep text out of their zones (top-left 20–330 × 60–370, bottom-right 760–1060 × 1560–1860).
- One accent colour. No dark or "night" grades.`,
  },
  {
    id: 's1:type', title: 'Type and its motion', roles: ['director', 'builder', 'lens'],
    text: `- ONE type family for every line, plus at most one serif-italic gold accent line per scene (Instrument Serif italic, gradient #2B2118 → #B97A2C → #7E9F45; the kit's look "serif"). No mixing caption looks (no metal / neon / Anton stacks).
- Centred lines: each word RISES from below inside its own box, small overshoot. Left-aligned lines: each word comes in from the RIGHT with an elastic, damped overshoot. One hero word per scene may slam (scale-in).
- A word arrives light grey, slides into place, holds ~9–14 frames, then turns ink (two-stage reveal).
- Lines sit at their final positions; they don't re-centre as words arrive. Slam words grow away from the previous word, never into it.`,
  },
  {
    id: 's1:objects', title: 'Objects, props and product shots', roles: ['director', 'builder', 'hunter'],
    text: `- Product shots are the REAL product: live captures in a drawn browser window or a phone; the camera dives to the detail; a cursor clicks through the real flow with titles on chips above the moving UI; the payoff is a real output.
- Props are low-key 3D (bevel, extrusion, glass highlight, contact shadow), never flat icons. The kit's drawn props are built this way.
- Objects (phones, cards, props) ENTER on a cubic-bezier (0.16,1,0.3,1) rise + scale + focus pull and EXIT on (0.7,0,0.84,0) before the cut; never a pop and a hard cut (the kit's glide does this).
- Nothing fully stops after landing: idle float, slow spin, breathe.
- Things that get rejected SHATTER (kill + shatter, with a thud + whoosh); no strike-through slash.
- Urgency and proof come from real-life UI (notifications swiped away, a split-flap board, a progress pill), not clock faces or counters. Show the real thing, not a count.
- Micro-details everywhere: sparks on slams, glare sweeps, count-ups, ticks, a paper plane on send.`,
  },
  {
    id: 's1:camera', title: 'Camera and cuts', roles: ['director', 'builder', 'lens'],
    text: `- The camera is never static: every scene zooms, pushes or pans; it is moving on its first frame and still moving on its last.
- Cuts are on motion: the outgoing scene accelerates out, the incoming one enters with an exponential settle that lands on a frame (the kit's enter/exit).
- Opening: a zoom-out from far with a slow tail. One cinematic touch per scene (camera roll, rack focus, a glare, depth).
- QUALITY NEVER DROPS: the last third is as dense as the first. No plain-text-only scene longer than ~1.5 s; dense layering; cuts on motion to the last second.`,
  },
  {
    id: 's1:board', title: 'The storyboard', roles: ['director', 'moovi'],
    text: `- Every video is a NEW storyboard from scratch. Never carry over a previous video's shot ideas, gags or objects.
- NEVER the template choice. Every shot ships the most premium, cinematic and unique design that fits it: the obvious version (centred text fading in, a plain card) is never good enough.
- One hero per shot and one signature move per shot (a dive, a slam, a pull-out reveal, a morph, a shatter). If you can't name the move, the shot isn't designed yet.
- Visualise the verb: what the voice says, the object does.
- Beat 1 is the hook: under 2 s, a bold claim plus one object. Vary layouts: never the same preset twice running. The brand beat comes right before the CTA; the last beat is the CTA.`,
  },
  {
    id: 's1:sound', title: 'Sound', roles: ['builder', 'lens'],
    text: `- A typing note on EVERY shown word, on the frame the voice says it. A whoosh on every cut, a soft landing for cards, pops for small entries (the kit sounds these).
- Risers are complete and end exactly on the cut: at most 1–2 per video, only into the biggest reveals (event "build").
- Never the same accent sound twice running; rotate.
- The bed: upbeat, rising, ~136 BPM, 3 LU under the voice, starting on a strong beat; looped on a bar line. Master −14 LUFS, true peak ≤ −1 dB.`,
  },
  {
    id: 's1:assets', title: 'Assets', roles: ['hunter', 'director', 'builder'],
    text: `- Every video uses NEW assets: never one this user's earlier videos used.
- The product's own website and brand assets are allowed and preferred (live captures, its logo, its real UI).
- Real things come from real sources (the site, its logo, an official icon); generic things are drawn in code (the kit's props). Say plainly where each came from.
- No pixels, voice, music or SFX lifted from someone else's video. Another company's logo only when the user asks for it.`,
  },
  {
    id: 's1:review', title: 'Review', roles: ['lens', 'builder'],
    text: `- Never self-grade by rules alone. Look at the still sheet; a rule-based 20/20 once got a 2/10 from the owner.
- NO overlapping text, ever: text never touches text, never within 8 px of a card, phone, browser or icon, never within 24 px of a corner asset. No clipped text. No empty frames.
- Check the LAST third of the still sheet as hard as the first.
- The scorecard: hook < 2 s · every visual on a spoken word · a key word per scene · objects pop with overshoot and idle drift · no 1.5 s stretch without a new element · the stage never changes · SFX 2–3.5 a second · master −14 LUFS · the CTA tail.`,
  },
];
