# Moovi: the goal and the two-day plan

Owner: Claude 1. Status: **research phase.** The day-by-day plan is written after the research in `research/` lands.

## What Moovi is

Lovable, for video. You type, or you give a video plus words, and you get a finished, polished film back. You never
open a timeline. Moovi creates and edits with AI and with **code**: every frame is rendered by code, so it is exact,
repeatable and editable by words.

Two jobs:
1. **Generate**: words (and a link) to a finished film: launch films, explainers, short-form hooks, and more.
   Several generation styles already exist; more will come later.
2. **Edit** (the focus now): the user's own video plus words to a finished edit, in one of **5 to 6
   deterministic editing styles**. Ishaan will post reference links for each style.

## The bar

- Quality: it should read as a senior After Effects editor with five years' experience made it. Every Opus video
  skill, workflow folder and copy-this-prompt site on the market should look weak next to it. A single prompt
  should not be able to reproduce it.
- Speed: a finished edit in **under 2 minutes**, measured, not guessed.
- Not the Higgsfield direction (generated footage). Moovi edits and composes with code.

## The omnipotent library

One library, stored in FalkorDB, that both generation and editing draw from. Target: 50+ of each.

voices · sfx · music beds · caption styles · video effects · camera moves and angles · UI components ·
three.js 3D styles · transitions · (more to be proposed in research).

The graph picks from it. A **research agent** reads the prompt or the source video. A **deciding agent** chooses
what to use, how, and what to keep, inside the rules of the chosen style. The style stays deterministic; the
choices inside it change per film.

## Research phase (now)

Topics and owners are on `BOARD.md`. Each topic lands as `research/<topic>.md`. When all are in, Claude 1 writes
the two-day plan below, both masters approve it, and building starts.

## Day 1

(after research)

## Day 2

(after research)
