# Layer 4: encode straight from the canvas

## Goal

Remove the screenshot, PNG and disk round trip. Encode each frame from the canvas with WebCodecs `VideoEncoder` and mux it into an MP4 inside the page. Return the finished file as bytes.

## Recipe (browser side)

1. Load an MP4 muxer as a script. `mp4-muxer` (UMD build) works, and so does its successor `mediabunny`. Serve it locally or bundle it, since the render page may not have internet access.
2. Create the muxer with an `ArrayBufferTarget`, `video: { codec: 'avc', width, height }` and `fastStart: 'in-memory'`.
3. Create a `VideoEncoder` whose `output` callback passes chunks to `muxer.addVideoChunk(chunk, meta)`. Configure it with `codec: 'avc1.640028'` (H.264 High, level 4.0), `width`, `height`, `bitrate` (about 8 Mbps for 720p), `framerate`, and `latencyMode: 'quality'`.
4. For each frame `i`: render `t = i / fps`, then `new VideoFrame(canvas, { timestamp: i * 1e6 / fps, duration: 1e6 / fps })`, then `encoder.encode(frame, { keyFrame: i % (fps * 2) === 0 })`, then `frame.close()`.
5. `await encoder.flush()`, `muxer.finalize()`, and return `muxer.target.buffer`.
6. From Playwright, transfer the buffer as base64 (or in chunks for long clips) and write it to disk.

## Checks before trusting it

- Call `VideoEncoder.isConfigSupported(config)` first. Headless Chromium on Linux usually has a software H.264 encoder (OpenH264), but if `avc` is unsupported, fall back to VP9 (`vp09.00.10.08`) in WebM, or to raw RGBA frames piped into ffmpeg (`-f rawvideo -pix_fmt rgba -s WxH -r FPS -i -`). Raw piping still avoids PNG compression and disk writes.
- Verify the output with `ffprobe` (frame count, resolution, duration) and compare a few frames to the baseline with `scripts/quality.sh`.
- Keep timestamps exact (integer microseconds derived from the frame index). Never use wall-clock time.

## Where the time goes

Measure separately: render time, readback or `VideoFrame` creation time, and encode time. If encoding dominates after layers 1–3 are in place, consider hardware encoders on a GPU machine, or feeding known motion vectors to an encoder that accepts motion hints.
