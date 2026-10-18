# Intake: the opening conversation

Goal: learn enough to make strong decisions, in one friendly round. People skip questions; that's fine, decide sensibly and say what you chose.

## Opening message (adapt the wording, keep it short)

> Before I start, want to brainstorm the direction together, or should I ask a few quick questions and take it from there? Either way, here's what helps most:

Then ask, grouped and numbered, with a default in brackets for each:

### 1. Which path
- Are we **building a new site**, or **rebuilding an existing one**? If existing: the URL or repo.
- Any **reference sites** you love (and what you love about each: the layout, the motion, the colours, the feel)?

### 2. The brand
- Name, what it does, and who it's for, in a sentence or two.
- The **one thing** a visitor should believe after five seconds.
- Tone: pick a few words (e.g. warm / precise / playful / editorial / technical / luxurious).
- Is there a **character, object or material** that already belongs to the brand (a mascot, the product itself, a signature texture)? [default: I find one in the concept step]
- How much **story** do you want: a scroll-told film with chapters, a calm editorial page, or a fast product page? [default: a story with 5–7 chapters for landings; calm and fast for apps]

### 3. Palette
- Do you have brand colours? Hex values if possible.
- If not: any colours you love or hate? [default: I derive a palette from the brand and references]
- Light, dark, or both? [default: one well-made light theme; dark only if it fits the brand]

### 4. Type
- Brand fonts? [default: I propose a pairing, usually an expressive display face + a quiet grotesk]

### 5. Scope and stack
- Pages: landing, pricing, auth, dashboard/app, tool pages, blog…?
- Stack: framework, styling, animation library [default: whatever the repo already uses; otherwise Next.js + Tailwind + Motion]
- Anything that must keep working exactly as now (forms, auth, payments, URLs)?

### 6. Truth and assets
- Which numbers, logos, testimonials and claims are real and approved to show? (I never invent social proof.)
- Do you have photography or illustration, or should I create custom art (procedural or with image-generation prompts you can run)?

## After answers

Run the concept method (`concept.md`) and reply with the one-screen **concept sheet** in the format of `concept.md` §6 (the single canonical format). Then proceed unless they object. Don't wait for approval on small choices.

## If they say "just go"

Skip the questions. Infer everything from the repo, existing copy and any reference, state your assumptions in two or three lines, and start.

## Missing facts
Never invent prices, specs, batch sizes, numbers, logos, quotes or reviews. Use clearly marked placeholders in the design (`[price]`, `[ships to: …]`, a labelled "sample" curve) styled so they look intentional, keep them in the content module, and list every one in the hand-off as "needs your real data".
