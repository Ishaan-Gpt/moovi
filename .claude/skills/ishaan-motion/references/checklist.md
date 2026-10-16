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

## Non-negotiables
- [ ] Every shot that would look better with a real asset has one (or the owner said no). No cheap code copies.
- [ ] Each shot is clearly better than the reference shot (the leap check), not just similar.
- [ ] Every arrival, press, settle and change has micro-motion AND an SFX. Nothing was removed to save time.
- [ ] Each shot, transition and text treatment came from idea 4/5 of the drill, and is specific to this product.
- [ ] The best tool was used per shot; new libraries are logged in toolbox.md.
