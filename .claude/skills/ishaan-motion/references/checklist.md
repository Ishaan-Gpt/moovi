# Ship checklist

## Honesty
- [ ] Every claim, number, customer and quote is real and verified. Quotes are verbatim.
- [ ] No other company's real logo or artwork. Stand-ins are stylised.

## Picture
- [ ] Contact sheet reviewed at fixed timestamps (and side by side with the reference, if there is one).
- [ ] No text overflow, no overlapping elements, phone-safe margins on 9:16.
- [ ] Every shot moves on its first and last frame. No dead stops mid-move. No lockstep groups.
- [ ] Cuts come in on motion. Big scales are done in log space. Settles are long.
- [ ] No crossfades, flares, glow-everywhere, camera shake or random particles.
- [ ] Brand palette and fonts only. Light/dark rhythm reads at speed.
- [ ] Palette gate passed (palette.md): the site's CSS colours and fonts were read first; every hex in the film is a token from that ramp, the product's own content included (cards, buttons, status, code); colour from real photos only when the brand is monochrome.

## Timing
- [ ] Every cut on a bar/half-bar, every slam on a beat, end card on the final chord.
- [ ] Watched at 1× and 0.25×.

## Talking head / voice-led (if it applies)
- [ ] Word stamps cleaned (monotonic, ends set); every event keyed to a word, not a typed second.
- [ ] Every jump cut reframes and lands on motion; big words punch the camera; captions hidden under big words.
- [ ] Behind-the-head words actually overlap the head (matte or stand-in placement checked on a still).
- [ ] Every panel acts out its sentence; chapter cards vary their entry.
- [ ] No transition reveals black: the outgoing shot is drawn under every incoming panel or card.
- [ ] No other person's name or real brand mark in big type, CTA keywords or product stand-ins.

## Live preview (when no MP4 is asked for)
- [ ] Watched in real time in a browser, start to end, as Ishaan will see it (1.17.83): every image, clip and frame preloaded behind a loading gate (never a blank or black player), no stutter, camera moves calm and text readable at 1080p (no zoom into blurry screenshot text, no hold-then-jump).
- [ ] A how-to teaches: each section is a step the viewer can do (the exact prompt or command shown long enough to copy, the real output, the result).
- [ ] Full-runtime sweep of `frame(t)` with no exceptions; same t renders identical pixels.
- [ ] Played end to end with SFX on and the reference beside it; console clean.
- [ ] Each transition checked at 3–6 sub-steps in a `?grid=` sheet next to the reference frames.

## Variety (across a series)
- [ ] No repeated recipe, opener or music bed within 3 posts; no transition spam; shot lengths not uniform.

## Audio
- [ ] −14 LUFS integrated, true peak ≤ −1 dB, measured after export.
- [ ] SFX sparse and recorded, risers end on the hit. CC-BY credit on the end card.

## Export
- [ ] 60 fps master, CRF ≤ 16, every requested format, ffprobe checked (duration, fps, size, audio stream).
- [ ] Deterministic: rendering twice gives identical frames.

- [ ] Pop scan run on the exported MP4 (frame difference vs neighbours); every in-shot pop fixed at the source; a 6-frame motion
      strip per shot checked for broken poses, crops, props through hands, and cards that jump (lessons.md "Smooth means no pops").

## Non-negotiables
- [ ] Every shot that would look better with a real asset has one (or the owner said no). No cheap code copies.
- [ ] Each shot is clearly better than the reference shot (the leap check), not just similar.
- [ ] Every arrival, press, settle and change has micro-motion AND an SFX. Nothing was removed to save time.
- [ ] Each shot, transition and text treatment came from idea 4/5 of the drill, and is specific to this product.
- [ ] The best tool was used per shot; new libraries are logged in toolbox.md.

- [ ] Shorts: every text element inside y 230-1480, x 70-905 (mask over 10+ stills); no punctuation in captions; no text on a face; the head separated from its ground (2026-10-25).
- [ ] Merged voice: every line cut at its own silence (12 ms in, 45-120 ms out), every join's last 30 ms below -40 dB (2026-11-01).
- [ ] Walking shots aim at the walker's path, not the head; no shake loop over ~1 Hz (2026-11-01).
- [ ] Every slip or paper with words: text fits the paper, whole slip in frame, nothing on the words, caption hidden while it is read (2026-11-01).

## Character (any new or rebuilt character)
- [ ] Every rig built so far was listed and the best one named; the new character starts from it or beats it in a blind side-by-side (lessons.md, 2026-11-03).
- [ ] The hero passed a kit day at 8/10 alone: close-ups of every expression the script needs and every action the shots use, before any shot was built.
- [ ] A historical hero keeps his icon (hat, glasses, silhouette) in the hook and the thumbnail.
- [ ] Shots pre-vized as a still contact sheet and judged (face readable, eyes on the upper third, no bar across a face, no camera inside a wall) before animating.
