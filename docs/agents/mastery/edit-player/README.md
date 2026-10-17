# The generic edit player (edit mastery, v7, 2026-10-18)

One player for any clip the pipeline prepared (`words.json`, `edl.json` faces + removed, `hd.mp4`) plus a beat spec.
Every time is a word anchor; every layer is a device (cam, world, cascade, tag, letters, input, sides, pill, wipe);
captions are the approved Premium Caption 1 painted by its own `draw.ts`. Not wired into the product yet: the next
step is the director writing the spec and the studio playing it (edit-fundamentals.md §9 in the ishaan-motion skill).

Run locally (it lives in `data/master-edit/src/`, git-ignored, next to the clips):
1. `node data/master-edit/build-premium.mjs` (transpiles packages/library/src/captions/premium into `premium.js`)
2. `node data/master-edit/serve.mjs . 4600` from the worktree root (byte ranges, so video seeks)
3. open `http://127.0.0.1:4600/data/master-edit/src/player.html?spec=specs/podcast-t2.json`

## The desk world's real material (v11, motion-graphics mastery)
The `desk` device uses real cut-outs, never drawn stand-ins (ishaan-motion rule 0.1):
1. `node docs/agents/mastery/edit-player/fetch-world.mjs` fetches CC0 photoscans from Poly Haven (laptop, megaphone,
   bulb, tea set, stationery, notepads, calathea, fern; a paper texture; an HDRI) into `data/world/` (git-ignored, 35 MB).
2. Copy `cutout.html` to `data/master-edit/src/` and `cutouts.mjs` to `data/master-edit/`, start the server, then
   `node data/master-edit/cutouts.mjs` renders each prop once as a PNG with alpha, lit from the desk's top-left window,
   into `data/world/cut/` (`cut.json` keeps sizes and the laptop's screen quad).
3. In a spec, `desk.items[]` takes `{ kind: "cut", src: "laptop", screen: "<clip.mp4>" }` (footage plays inside the
   photographed screen), `{ kind: "cut", src: "bulb-off", srcOn: "bulb-on", on: <anchor> }` (switches on with a
   flicker and a glow), `flip`, `drop` (height), and `doodle` paths as `{ d, at, dash }`; `desk.props[]` are framing
   props nearer the lens `{ src, x, y, w, r, z, from: tl|tr|bl|br, at }` (parallax and depth blur by `z`).
   Example: `specs/interview-t3-v11.json`.
