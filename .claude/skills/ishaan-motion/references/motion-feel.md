# Motion feel: why motion looks "AI" even when the layout is right

Review notes on finished videos are almost never about layout. They are about motion that doesn't feel natural.

## The mistakes
1. **Stopping between keys** (the most common one). Easing every key in and out makes the object stop and restart.
   Real motion flows through interior keys and only eases at the very start and end.
2. **Everything in lockstep.** Separate objects start, peak and stop on the same frames. Give each one its own
   timing: one arrives late, one counter-rotates, one settles slower. A single object moves all its own channels together.
3. **Settling too fast.** Premium motion has a long soft tail (Raycast: 30–33 f at 30 fps). The last 5% of the travel
   takes a third of the time.
4. **Linear scale.** 8× → 1× linear spends most of its time big, then lurches. Use log space: `s = S0 ** ((1 - t) ** 4)`.
5. **One start frame for a group.** Stagger by measured frames (2–2.5 f at 30 fps) with jitter.
6. **Easing in at a cut.** Cut in ON motion (speed on the cut 4–10× the shot average).
7. **Everything inside the camera.** Only what zooms or moves belongs in the camera transform. Fixed chrome
   (a taskbar, a wallpaper edge) sits outside it.
8. **Crossfading same-colour solids.** Opacity black-over-black flashes grey. Morph with solid layers instead.
9. **Stepping into a blur.** blur(0) → blur(1px) is a one-frame jump. Start ramps at ~0.3 px.
10. **Smooth motion where the reference animates on 2s.** Match the cadence (quantise to half frame rate if the reference does).
11. **Guessing instead of measuring.**

## Curves that work
- AE speed ramps (cubic-bezier):
  - `ramp (0.86,0,0.07,1)`: slow, whip, slow (the default move).
  - `hard (0.95,0,0.05,1)`: camera moves and big pulls.
  - `out (0.16,1,0.3,1)`: entries that land and glide (0.25–0.45 s).
  - `outBack (0.34,1.32,0.64,1)`: tiny overshoot for pops.
  - `in (0.7,0,0.84,0)`: accelerating away into a cut.
- Springs: pop `{damping 13, stiffness 190, mass 0.9}` (visible overshoot) · firm `{20, 210, 1}` · soft `{26, 120, 1}`.
- Float/drift settle: `p(t) = A(1 − e^(−t/τ)) + B·t` (half quick ease-out, half steady drift), with τ ≈ 6–17 f.
- Log-space zoom for any big pull or dive (the launch film pulls out 12.8× from the logo into the site).
- Motion blur from velocity: `v = fn(f+0.5) − fn(f−0.5)`, `blur = min(cap, |v| × 0.28)`, directional (x and y separately).

## The method
1. Measure the reference per channel, per frame.
2. Read the curves: velocity zeros, settle length, overshoot, phase offsets, secondary wobble.
3. Build each channel as its own smooth curve; offset phases between objects as measured.
4. Check the numbers: motion corr ≥ 0.95, ratio ~1.0 (well under 1 means too fast and settles too soon; over 1 means too busy), peak offset 0 f.
5. Then watch it at normal speed next to the reference. The numbers tell you where it's off; your eye tells you whether it feels natural.

## Measured wins
- Raycast window cascade: per-element 7–9× → 1× log quartic ease-out over 30–33 f, rows 2–2.5 f apart, containers
  ~1 f before their content. Motion corr 0.79 → 0.96. Row start frames mattered more than curve power.
- MarkKnd floating keyboard: replacing per-key eases with one drift curve per channel took motion corr from 0.73 to 0.98.

## Smooth as butter (owner, 2026-10-18)
- A "2× → 0.5× → 2×" instruction means an **easing** (a speed curve), not literal speed plateaus. Build it as one
  smooth velocity curve that starts and ends at rest: `v ∝ sin²(πu)·(0.15 + 0.85·sin²(2πu))` (`EASES['speed-ramp']`
  in `@moovi/library/camera`). Check for corners (the second difference of velocity) before showing anything.
- The hard AE ramp bezier (0.86, 0, 0.07, 1) is for a slam, not for travel. Travel and cursor paths use a soft in-out.
- Camera taste by moment: `references/camera.md`.
