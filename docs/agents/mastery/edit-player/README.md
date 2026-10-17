# The generic edit player (edit mastery, v7, 2026-10-18)

One player for any clip the pipeline prepared (`words.json`, `edl.json` faces + removed, `hd.mp4`) plus a beat spec.
Every time is a word anchor; every layer is a device (cam, world, cascade, tag, letters, input, sides, pill, wipe);
captions are the approved Premium Caption 1 painted by its own `draw.ts`. Not wired into the product yet: the next
step is the director writing the spec and the studio playing it (edit-fundamentals.md §9 in the ishaan-motion skill).

Run locally (it lives in `data/master-edit/src/`, git-ignored, next to the clips):
1. `node data/master-edit/build-premium.mjs` (transpiles packages/library/src/captions/premium into `premium.js`)
2. `node data/master-edit/serve.mjs . 4600` from the worktree root (byte ranges, so video seeks)
3. open `http://127.0.0.1:4600/data/master-edit/src/player.html?spec=specs/podcast-t2.json`
