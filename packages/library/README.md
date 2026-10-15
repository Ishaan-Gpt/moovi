# @contenteasy/library

Style libraries as code. Every value that makes a style look and sound the way it does lives in one constant you can edit; the next render picks it up.

```ts
import { style1 } from '@contenteasy/library';
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
| `camera.ts` | push, roll, punch-in and pull-out presets, plus `cameraAt` and `lintCamera` |
| `ui.ts` | 58 UI components (phone, browser, chat, comment, notification, cursor, price tag, logo grid…) plus placement factories |
| `scenes.ts` | 40 scene recipes and story arcs, with the past videos that use each one |
| `sfx.ts` | 25 sounds with role, gain, peak alignment and "use when", plus `sfxForEvent` for the kit's events |
| `music.ts`, `mix.ts` | the music bed, and the mix/master rules, with line references to `tl_make.py` |
| `backgrounds.ts` | stage backgrounds, overlays and brand assets |
| `videos.ts` | the gold set: all 18 Style 1 videos, with render, build script, script, sounds and music |

## Media

Media files are never committed (the music is copyrighted and the renders are about 500 MB). Copy them from MotionEasy into `data/library/style-1/`:

```bash
pnpm sync:style1
```

To include the past renders as well:

```bash
pnpm sync:style1 --videos
```

`pnpm --filter @contenteasy/library test` checks that every sound reference resolves and that the sync manifests cover every file the catalog names.

## Not wired yet

`packages/skills`' kit still carries its own copies of these numbers. The next step is for the kit to import them from here, so one edit changes every render.
