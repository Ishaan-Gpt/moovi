# ContentEasy: architecture (draft v1, 2026-10-12)

## Product in one line

You hire **the Director**, a 3D AI video employee. He briefs his crew of sub-agents, they make or edit your video, and you watch them work and see why each choice was made.

## Two surfaces, one character

| | Landing (`apps/landing`) | Studio (`apps/studio`) |
|---|---|---|
| Job | Make people want to hire the Director | Where the Director and crew actually work |
| When | **Now**, as a startup asset made before the hackathon | **Oct 15–18**, the hackathon submission |
| Hero | The Director in 3D: introduces himself, reacts to scroll and cursor, shows his crew | The Director "at his desk": takes your brief, assigns the crew, reacts to their events |
| Data | Static plus a waitlist ("Hire him") | FalkorDB graph, agent orchestrator, render engine |
| Stack | Next.js (static-friendly), R3F + drei, Motion/GSAP, Lenis | Next.js with API routes + SSE, R3F, FalkorDB, Anthropic SDK |
| Hosting | Vercel | Vercel (UI and API) + Railway (FalkorDB) |

```
contenteasy/
├─ apps/
│  ├─ landing/     marketing site (built first)
│  └─ studio/      the app: brief → crew → video (studio)
├─ packages/
│  ├─ brand/       design tokens: palette, radii, easing (shared, built)
│  ├─ character/   Moovi: code-generated jelly character (WebGL2 SDF), state machine, React wrapper (shared, built)
│  ├─ crew/        orchestrator, agent roster, tools, event bus           (studio)
│  └─ graph/       FalkorDB client wrapper, schema, seeds, query library  (studio)
├─ assets/character/   source concept art, Blender files (work/ is git-ignored), exports
└─ docs/           context, architecture, character, brand, hackathon
```

The shared `packages/character` is the key piece. The landing and the studio render **the same Director with the same states**, so he feels like one person across the product.

## Moovi's state machine (shared by landing and studio; implemented in packages/character/src/moovi/states.ts)

| State | Landing trigger | Studio trigger (crew event) |
|---|---|---|
| `idle` | default | no active tasks |
| `greet` | first view | session start |
| `lookAt` | cursor, done in code by rotating the head bone | the active agent's card |
| `listen` | hover on CTA | user typing a brief |
| `think` | — | `agent.started` (Director) / planning. The halo spins faster. |
| `direct` (point) | crew section scrolls in | `task.assigned` / `handoff` |
| `review` | — | `issue.raised` by the Critic |
| `celebrate` | CTA click | `done` (video ready) |

Eye expressions are drawn on the visor (a shader or texture swap), so changing emotion needs no facial rig.

## Studio and engine (built 2026-10-13/14)

The full description is in `docs/STUDIO.md`. In short:

- `apps/studio` (Next 16, a zone under the landing at `/studio`) is the UI and a thin API. It never runs agents.
- `packages/engine` is the long-running worker: a task graph in each project's FalkorDB graph (leases, fan-out,
  scoped re-opens, restart recovery), the agents (Moovi, Researcher, Scribe, Art Director, Asset Hunter, Shot
  Builders one per scene, Lens, Keeper) and the workers (voice, assembly, render pool, sound, mux).
- `packages/skills` holds the styles as data and code: Style 1 (the owner's kit ported to TypeScript, its laws as
  machine checks), the unique-style card, and the deterministic matcher that picks a style before any model runs.
- `packages/graph` holds the graphs: `craft` (style knowledge only), `sys` (users, sessions, project index),
  `user_<id>` and `proj_<id>`, with every query named and documented in `docs/QUERIES.md`.
- Events go engine → Redis stream → SSE → the office; commands go studio → Redis stream → engine.
- One tool definition runs on two runtimes: the Claude Agent SDK (this machine's Claude Code login) and our own HTTP
  loop for Anthropic, OpenAI-compatible and Gemini APIs. The engine re-runs every done-check itself and has a
  deterministic fallback for every agent output, so a run ships on any model.

## Landing page outline (to refine with the owner's inspiration)

1. **Hero.** The Director materialises: the halo draws on, the visor lights up, a wave. Headline + "Hire him" CTA.
2. **"Meet your Director."** What he does, in one line, with idle and look-at behaviour.
3. **The crew.** The Director points; each sub-agent pops in with its role.
4. **How it works.** Brief → crew → video. A live-looking simulation of the crew handing off.
5. **"He remembers."** Brand memory and feedback, shown as a soft graph visual.
6. **Work.** Before/after edits, the MotionEasy and CaptionsEasy lineage.
7. **Pricing / waitlist.**
8. **Footer.** The Director waves goodbye.

## Performance budget

- Director GLB **≤ 3 MB** (meshopt + KTX2/WebP textures, ≤ 30k triangles). Each crew GLB ≤ 1 MB, sharing one rig.
- Lazy-load the 3D scene after LCP. Show a poster frame first. Respect `prefers-reduced-motion`.
- Cap DPR at 2 and pause rendering off-screen.
