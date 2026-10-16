# @moovi/library

Style libraries as code. Every value that makes a style look and sound the way it does lives in one constant you can edit; the next render picks it up.

```ts
import { style1 } from '@moovi/library';
style1.SCENES['hook-stack-slam'];      // a scene recipe: looks, ui, effects, transition, camera, sfx, duration
style1.getSfx(style1.sfxForEvent.pop); // the sound a kit event plays
style1.mix.master;                     // loudness / limiter targets (from tl_make.py)
```

## Style 1 (`src/style-1/`)

| File | Holds |
|---|---|
| `tokens.ts` | colours, brand palettes, fonts, type sizes, safe areas, grid, fps and beats, easings, springs, event → sound levels |
| `text.ts` | text looks (ink, accent slam, serif gold, hero word, kicker, stat number, bullets, labels…) as factories with exposed defaults |
| `effects.ts` | 51 effects (word, object, accent, draw, stage, exit), each with params, frames, easing and paired sound |
| `transitions.ts` | scene entries, exits and cuts |
| `camera.ts` | push, roll, punch-in and pull-out presets, plus `cameraAt` and `lintCamera` (the general camera layer is `src/camera/`, below) |
| `ui.ts` | 58 UI components (phone, browser, chat, comment, notification, cursor, price tag, logo grid…) plus placement factories |
| `scenes.ts` | 40 scene recipes and story arcs, with the past videos that use each one |
| `sfx.ts` | 25 sounds with role, gain, peak alignment and "use when", plus `sfxForEvent` for the kit's events |
| `music.ts`, `mix.ts` | the music bed, and the mix/master rules, with line references to `tl_make.py` |
| `backgrounds.ts` | stage backgrounds, overlays and brand assets |
| `videos.ts` | the gold set: all 18 Style 1 videos, with render, build script, script, sounds and music |

## Camera layer (`src/camera/`, `@moovi/library/camera`)

Every camera move as a keyword an AI director can call: 48 moves (the 46 on aicameramovements.com plus the dolly zoom in
and out). One deterministic implementation per move drives the DOM (a real CSS 3D camera), flat 2D runtimes (style-1
`CamKey`, MotionEasy) and three.js, and the same keyword gives the prompt for a gen-AI video model.

```ts
import { parseCamera, cameraTrack, cssCamera, applyToThree, toCamKey, promptFor } from '@moovi/library/camera';
const { calls } = parseCamera('dolly zoom in, ramp up');   // [{ move: 'dolly-zoom-in', ease: 'ramp-up' }]
const s = cameraTrack(calls, t);                           // CamState at t seconds (pos, target, fov, roll, subject, ...)
cssCamera(s, 1920);                                        // { perspective, transform } for the DOM world
applyToThree(threeCamera, s);                              // three.js PerspectiveCamera
toCamKey(s, frame);                                        // [frame, scale, cx, cy, roll] for style-1
promptFor(calls[0]);                                       // "Camera: dolly zoom (vertigo effect), camera moving in. Movement: ..."
```

| File | Holds |
|---|---|
| `core.ts` | `CamState` and `REST`, the ease presets (`linear`, `ramp-up`, `ramp-down`, `smooth`, `snap`, `whip`), deterministic `wobble`, and the adapters `cssCamera`, `frame2d`, `toCamKey`, `applyToThree` |
| `moves.ts` | `CAMERA_MOVES`: id, family, direction, aliases, site ref, how / use / avoid, defaults, amount, prompt parts and `at(base, p, ctx)` |
| `call.ts` | `CameraCall` (move, duration, ease, intensity, amount, seed), `cameraAt`, `cameraTrack` (each call starts where the last ended), `frameAt` (with a motion-blur hint), `promptFor`, `buildPrompt`, `cameraMenu` (one line per move for a director model) |
| `parse.ts` | `parseCamera`: "orbit left slow", "crash zoom then whip pan right", "subtle arc right 2.5s, linear", "orbit right 360 degrees" |

Rules: "in" moves start on the base framing; "out" moves start tight and end on it; lateral moves are centred on it, so a
flat layout never shows its edge at the end. Earth zoom, infinite zoom, pass-through and the tracking family leave the
base on purpose (each says so in `avoid`). See every move play: `pnpm --filter @moovi/playground dev`, then open
`/camera.html`.

## Media

Media files are never committed (the music is copyrighted and the renders are about 500 MB). Copy them from MotionEasy into `data/library/style-1/`:

```bash
pnpm sync:style1
```

To include the past renders as well:

```bash
pnpm sync:style1 --videos
```

`pnpm --filter @moovi/library test` checks that every sound reference resolves and that the sync manifests cover every file the catalog names.

## Not wired yet

`packages/skills`' kit still carries its own copies of these numbers. The next step is for the kit to import them from here, so one edit changes every render.
