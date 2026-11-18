# Layer 5: split a render across machines

## When it pays off

Each cloud session is a separate machine with its own CPU, RAM and disk, and each one also uses the user's Claude usage. Split only when a single machine would take more than about 10–15 minutes; below that, setup (cloning, installing dependencies) eats the gain. Tell the user the usage cost before spawning sessions.

Several agents or background jobs in one session share one machine and do not run faster. Use separate sessions for real parallelism.

## Plan the chunks

Use `scripts/chunk_plan.py`:

```bash
python scripts/chunk_plan.py --duration 30 --fps 24 --chunk-seconds 6
```

It prints each chunk's frame range and start time, and the ffmpeg concat list to use at the end. Chunk boundaries fall on whole frames so no frame is rendered twice or skipped.

## Run the chunks

1. Put the scene code in a GitHub repo the sessions can reach. Every machine needs the same code and dependency versions, or chunks will not match.
2. Spawn one cloud session per chunk (the `create_session` tool) with a prompt that names the repo, the exact frame range, the render command, the encoder settings and the branch or storage location to upload its chunk to.
3. Use identical encoder settings everywhere: codec, profile, pixel format, resolution, frame rate, and a keyframe at the first frame of each chunk. Otherwise the stream-copy join fails or glitches.
4. Each session pushes its chunk (for example `chunks/chunk-03.mp4` on a branch) or uploads it to shared storage, then reports back.

## Join the chunks

With identical settings, join without re-encoding:

```bash
ffmpeg -f concat -safe 0 -i chunks.txt -c copy final.mp4
```

Then check the result: `ffprobe` the frame count (it must equal the total), and look at the frames on both sides of each boundary for jumps in noise, colour or motion. Seeded randomness and a pure function of `t` prevent such jumps.

## Combining with layers 1–4

Each chunk starts cold: it has no previous frame to reuse and must build its own world-space cache. Bake static lighting once, commit or upload the bake, and let all chunks load it. Start each chunk with one full redraw, then reuse as normal. Longer chunks reuse more but parallelize less, so 5–10 s per chunk is the starting point.
