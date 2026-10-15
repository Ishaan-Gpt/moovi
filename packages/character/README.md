# @moovi/character

**Moovi**, the Moovi director. He's a jelly creature generated entirely in code: a signed-distance field, raymarched in a WebGL2 fragment shader. There's no model file, no rig and no textures, and the shader is about 15 KB.

```ts
// vanilla
import { MooviRenderer } from '@moovi/character';
const moovi = new MooviRenderer(canvas, { quality: 'auto' });
moovi.setState('think');            // idle · greet · listen · think · direct · frame · review · celebrate · play
moovi.lookAt([0.6, -0.2]);          // look at something (-1..1 in his box); null to follow the pointer

// React (Next.js: add the package to transpilePackages)
import { Moovi } from '@moovi/character/react';
<Moovi state="direct" lookAt={[1, 0]} className="h-[420px] w-[420px]" />
```

## Layout

| File | Job |
|---|---|
| `src/moovi/shaders.ts` | The SDF and the jelly shading. Compile-time knobs (`STEPS`, `THICK_N`, `EYE_STEPS`, `IRIDESCENCE`, `TRANSPARENT`, `MORPH`). |
| `src/moovi/MooviRenderer.ts` | GL setup, the per-frame pose (computed on the CPU and sent as uniforms), the frame loop, adaptive quality, pause and resume, context-loss recovery. |
| `src/moovi/states.ts` | The state list and each state's blend targets. The same names drive the landing page and the studio crew events. |
| `src/moovi/quality.ts` | The `high` / `medium` / `low` tiers, and the starting tier for `auto`. |
| `src/moovi/math.ts` | Small mat3 and vector helpers. |
| `src/react/Moovi.tsx` | The React wrapper. |

## Performance

Measured on an AMD Radeon integrated laptop GPU, roughly a good phone's level. Cost is GPU time per frame at each render size, best of 5 alternated runs.

| Tier | 360² | 540² | 720² |
|---|---|---|---|
| high | 1.8 ms | 3.6 ms | 6.0 ms |
| medium | 1.7 ms | 3.3 ms | 5.5 ms |
| low | 1.6 ms | 3.2 ms | 5.5 ms |

- **The cost is mostly the surface march,** so render size is the main lever: cost scales with pixel count.
- **The morph to a play button uses a separately compiled program,** and only runs while he's morphing. Keeping it out of the normal program makes ordinary frames 15–18% cheaper.
- **The renderer pauses** when Moovi is off-screen (IntersectionObserver) or the tab is hidden.
- **Frame-rate cap:** 60 fps on the high and medium tiers, 30 fps on low.
- **Pixel density:** device pixel ratio is capped per tier (1.5 / 1.25 / 1).
- **When frames run slow,** it lowers render resolution first (down to 0.6×) and then drops a quality tier.
- **`prefers-reduced-motion` freezes time.** States still ease, but he no longer bounces, spins or blinks.

**Todo:** pre-rendered video loops of each state, made from this same shader, as a fallback for very weak phones and battery-saver mode.

## Look tuning

All colours come from the brand palette (icy white, ice blue, navy ink, iris blue), defined in `shaders.ts`. The jelly look is controlled by:
- absorption `vec3(1.05, .52, .22)`: red is absorbed first, so thin parts glow blue
- scattering `1.2`: the milky core
- the iridescence term
