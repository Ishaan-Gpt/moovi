# Engine setup notes

Fixes found while building the Still Water showcase in a Claude Code cloud session (Linux, 4 cores, no GPU, outbound traffic through a proxy).

## Headless WebGL without a GPU

Playwright's Chromium gives WebGL2 through SwiftShader with these launch args:

```js
chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
```

Create the WebGL context with `preserveDrawingBuffer: true` if you read pixels back with `toDataURL`. Very heavy raymarch draws can stall; render in horizontal tiles with the scissor test and stitch them.

## Blender without downloading Blender

`download.blender.org` may be blocked by the proxy, but PyPI works:

```bash
uv venv --python 3.13 .venv && uv pip install bpy
```

bpy 5.3 includes Cycles and OIDN denoising. Polyhaven HDRI downloads may also be blocked, so build sky and materials procedurally (the Sky texture node).

## Remotion

- Point Remotion at the preinstalled headless shell instead of letting it download a browser:
  `--browser-executable=/opt/pw-browsers/chromium_headless_shell-<version>/chrome-headless-shell-linux64/chrome-headless-shell`
- Add `--gl=swangle` for WebGL without a GPU.
- Wrap three.js setup in `delayRender` / `continueRender`, and call the scene's `renderFrame(frame / fps)` in an effect that depends on the frame, with its own `delayRender` handle.

## Hyperframes

- Disable telemetry first: `npx hyperframes telemetry disable`.
- WebGL scenes follow the seek protocol: draw in a `window.addEventListener('hf-seek', e => render(e.detail.time))` listener; never run a `requestAnimationFrame` loop. During a render `Date.now()` and `performance.now()` are frozen to the seek time.
- Use `--no-browser-gpu` and a long `--player-ready-timeout` (180000) on SwiftShader.
- A render started from a shell that exits (for example `nohup ... &`) cancels itself with `render_cancelled_parent_exited`. Run it in the foreground or as a tracked background command.
- Bundle local copies of GSAP and the scene; don't rely on CDNs inside the render.

## General

- `/usr/bin/time` may not exist; time runs with `date +%s` before and after.
- Several renders on one 4-core machine slow each other by up to 3x. Run benchmarks alone, or use separate sessions.
