# CLAUDE.md: ContentEasy

ContentEasy is an AI video employee you hire. A 3D Director character leads a visible crew of sub-agents that make and edit videos. It's a subsidiary of MotionEasy.

**Read first:**
- `docs/ARCHITECTURE.md`
- `docs/STUDIO.md`
- `docs/STYLES.md` (styles, not templates) and `docs/MODELS.md` (any model, bring your own key)
- `docs/QUERIES.md` (every Cypher query)
- `docs/CHARACTER.md`
- `docs/BRAND.md`

## Hard rules

- **Hackathon is live** (preponed, 2026-10-12). Everything built here is event work. FalkorDB must stay load-bearing. Log AI use in `AI_USAGE.md` as you go.
- **Moovi (the Director) is one character everywhere.** Landing and studio both use `@contenteasy/character`. Never fork his look or states. He's pure code (a WebGL2 SDF), with no GLB.
- **Palette:** two majors, icy white `#F7FAFD` and ice blue `#CFE6F7`. Everything else is minor. Colours come only from `@contenteasy/brand` tokens.
- **Monorepo:** pnpm workspace. Dependency direction is `brand ← character ← apps`. Packages export TS source, with no build step. Run `pnpm typecheck` after changes, and use `pnpm dev:playground` to see Moovi.
- **Performance claims are measured,** never assumed. Use the playground's Benchmark button, or `moovi.benchmark()`, with alternated A/B runs.
- **Taste.** Use the `ishaan-ui` skill for site work and `ishaan-motion` for motion. No generic AI-site look.
- **Performance.** Director GLB ≤ 3 MB. Lazy-load 3D after LCP. Respect reduced motion.
- **Secrets.** Never commit keys. `.env.local` and `data/` stay local.
- **Platform.** Windows host with spaces in paths, so quote them. Use pnpm workspaces.
