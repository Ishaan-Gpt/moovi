# Concept: the fifth-idea rule

Read this before designing anything. The concept is the single decision that makes a site feel authored instead of assembled. Everything else in the skill (palette, type, loader, transitions, icons, sections, copy) is derived from it.

## Contents
1. Why the first idea loses
2. The method: five concepts, build the fifth
3. What a concept is (and what it isn't)
4. The derivation table: one concept, every surface
5. Worked examples
6. The concept sheet you show the person

---

## 1. Why the first idea loses

The first idea anyone has for a brief is the most common one, and for a language model it is the statistical average of every site it has seen: a centred hero with a product screenshot, a three-column feature grid, a gradient, a logo strip, testimonials, pricing. That is exactly the "AI-made" look people can smell. The ideas that feel premium come later, after the obvious ones are written down and set aside.

So don't fight the first idea; *use it up*. Write it down, along with the next few, so they stop pulling on you.

## 2. The method: five concepts, build the fifth

1. Write **five** concepts for the brand, one or two sentences each, in the shape described in §3.
2. Expect concepts 1–3 to be obvious (screenshot hero; dark gradient + glow; the category's usual aesthetic). Write them anyway, quickly.
3. Push 4 and 5 further: borrow from a different medium (film, print, theatre, games, instruments, architecture, nature), give the product a body (a character, a material, an object), or turn the site's own mechanics (scroll, cursor, loading) into the story. Often the strongest idea is hiding in the product's own process (a roast, a print run, a launch countdown, a night outdoors).
4. **Choose by the tests below, not by the number.** "Five" is a forcing function to get past the obvious: the winner is usually the fifth or a fusion of the fourth and fifth, and never one of the first three. If the strongest idea arrived early, keep writing until five anyway; sometimes number five beats it.
5. Say which one you chose and why in one line, and name the rejected ones in a line each, so the person can redirect early.

Tests a concept must pass:
- **Only-this-brand**: could a competitor use it unchanged? If yes, push further.
- **Carries the whole site**: you can derive the loader, the page transition, the scroll device, the icons, the empty states and the footer from it (§4). If it only styles the hero, it's a look, not a concept.
- **Teaches the product**: the metaphor explains what the product does, so the story and the sales pitch are the same thing.
- **Buildable** with the time and stack available. A great concept you can't finish beats nothing; a finished good one beats an unfinished great one.
- **Survives subtraction**: with the copy removed, the page still says something.

**Does it need 3D?** Only if the protagonist must turn in depth, be lit from moving angles, morph between volumes, or merge and split. A bean that changes colour, a sheet that folds, a sky, a dial, a product shot: SVG, CSS, canvas 2D or an image sequence do it lighter and often better. If unsure, start 2D; `3d.md` is opt-in.

## 3. What a concept is (and what it isn't)

A concept has five parts. Write each concept as one sentence that touches most of them:
- **World**: the environment everything lives in (a painted sky, a film set, a print shop, an ice cave, an instrument panel).
- **Protagonist**: one thing that persists and changes across the page: a character, an object, a material (a jelly mascot, a lens, a sheet of paper, a drop of ink, a single product shot).
- **Signature move**: the one interaction or transformation people will remember (the lens opens, the paper folds into the next section, the mascot swallows the competitor's output).
- **Motion personality**: how things move (slow and eased with soft blur; springy and jelly; mechanical and precise; paper-like with weight).
- **Palette seed**: two majors and the minors, derived from the world (icy white + ice blue; cream + ink; dusk rose + indigo).

Not concepts: "clean and modern", "glassmorphism", "dark mode with neon", "minimal". Those are finishes. A concept tells you what to *build*.

## 4. The derivation table: one concept, every surface

Once chosen, fill this in before writing code. Every row should be traceable to the concept; if a row can't be derived, the concept is too thin.

| Surface | Derived from the concept |
|---|---|
| Palette | two majors from the world, minors only where needed, one accent |
| Type | display face whose shape matches the world (soft/rounded, engraved serif, tight grotesk); a quiet body face |
| Intro loader | the world or protagonist "arriving" (a lens opening, film leader counting down, ink pouring) |
| Page transition | the same vocabulary, different shape (a sheet rising, a shutter, a page turn) |
| Scroll device | how the story advances (pinned chapters, a camera move, a material unfolding) |
| Cursor / hover | small echoes of the protagonist (a bead, a magnet, a jelly wobble) |
| Icons | drawn in the world's hand (engraved, rounded tube, hairline) |
| Art | environment art in the world's medium (procedural paint, 3D, paper texture) |
| Chrome | header/rails that belong to the world (a timecode rail for a film, a bezel for an instrument) |
| Empty / loading / error | the protagonist in a small state (asleep, searching, a passing cloud) |
| Footer | the final scene: the protagonist saying goodbye, the world at dusk |
| Imagery | photography direction (light, angle, props, colour grade) or art medium; what stands in until real photos exist |
| Commerce (if selling) | product cards, product page, cart and checkout surfaces in the world's language; shipping and trust info stated plainly |
| Copy voice | how the protagonist would speak; short, specific, human, in the world's own units |

## 5. Worked examples

These show the shape of the thinking, across very different worlds. Don't reuse any of them (no mascot, halo, jelly or star sky unless *this* brand's fifth idea genuinely is that); derive your own.

**An AI video studio with a mascot director (built: a jelly character called Moovi).**
1. Product-screenshot hero, feature grid, logo strip. *(obvious)*
2. Dark gradient with a glowing orb "AI brain". *(obvious, and every AI site)*
3. A video-editor timeline aesthetic: tracks, playheads, waveforms. *(category look)*
4. The crew as an org chart of agents with cards and arrows. *(explains, doesn't enchant)*
5. **The landing page is a short film starring the director, scrubbed by your scroll.** He holds out the prompt box in the hero; the wordmark is poured from his own jelly; he melts into a screen to show what a generic tool outputs, splits into his crew, passes the task down the line, and waves goodbye with everyone at the end. → loader = film leader with timecode; chrome = a timecode rail; sections = chapters; palette = icy white + ice blue (his material); hover = he waves only where the page invites it.

**A stargazing app (built: Luna, "the sky is still there").**
1. Space-photo hero with a phone mockup. 2. Purple nebula gradient with glowing text. 3. Dark dashboard of planet cards. 4. A 3D globe.
5. **An editorial night: the real sky above the reader's own horizon, set like a magazine cover.** A giant condensed serif "LUNA" crossed by a handwritten "after dark"; real catalogue stars and the Milky Way drawn on a canvas; layered mountain ridges; the corners carry true data (tonight's time, the place, the coordinates) as quiet captions; the CTA is a circle like a moon ("Get Luna tonight"). No 3D needed: the truth of the data is the luxury.

**An SEO audit tool (built: painted skies + glass + a lens).**
1. Dashboard screenshot hero. 2. Dark data-viz with charts. 3. Green "growth" arrows. 4. Search-bar-first minimalism.
5. **"See your site clearly": a lens over painted pastoral skies.** → loader = the lens mark draws and the page is revealed through its opening; transition = a scanning sheet with a travelling loupe; icons engraved; footer set inside a landscape.

## 6. The concept sheet you show the person

This is the one canonical format (intake and SKILL.md point here). Before building, post one screen:
```
Assumptions: <only if they said "just go": two or three lines>
Concept: <one sentence, the chosen idea>
Why: <one line: why it fits the brand's promise and passes the tests>
Rejected: 1 <…>  2 <…>  3 <…>  4 <…>
World · Protagonist · Signature move · Motion personality
Palette: two majors + accent (+ minors and where they appear), hex
Type: display / body / mono or captions
Derivation: the §4 table, filled
Story beats: the 5–9 chapters, one line each on what happens on screen (see storytelling.md)
Pages: the page list
Placeholders: facts you need from them (prices, specs, logos…)
```
Then proceed unless they object. Small choices don't need approval.
