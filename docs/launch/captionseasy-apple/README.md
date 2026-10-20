# CaptionsEasy keynote film

A 46.7 s launch film for https://captionseasy-web-app-r5ri.bolt.host, built as a live canvas preview
(`index.html`, `frame(t)` draws everything, time comes from the audio clock).

Play it: `node docs/launch/serve-range.mjs docs/launch/captionseasy-apple 4320`, then open http://localhost:4320.
The media (`media/`: clips, voice, sfx) is local and not in git. To rebuild it: the clips are the Mixkit ones in
`data/launch/captionseasy/` (footage finder), the voice is `packages/engine/scripts/_cse-apple-vo.ts`, the sfx are
copies from `packages/engine/assets/sfx-style1/`.

## Locked by Ishaan (2026-10-21)
- **Palette, celadon porcelain.** Derived from the brand's green, not the site's cream. Light world: porcelain
  `#EFF4EE` → `#DCE6DD`, mist `#C3D3C6`, sage `#7C9486`, graphite `#2E3833`. Dark world: lacquer `#101613` with one
  green bloom. Accent (≤10%): brand green `#34d399` and deep green `#0D6B4C` for serif hero words on light. The brand's
  cream `#FFFFEB` and ink `#1a1a1a` stay only on the logo and the product's own Studio UI.
- **Voice: Andrew** (`en-US-AndrewMultilingualNeural`, edge, rate -6%), lines on a 96 bpm half-bar grid, 0.35 s gap,
  the film opens 1 s before the first word.
- **Music: a synthesized keynote bed** written for this film (WebAudio, 96 bpm, Dmaj9 → Bm9 → Gmaj9 → A6/9): a
  breathing triangle pad, a glass sine arpeggio, a soft pulse from the logo on, a breakdown in the on-device scene and
  a long final chord on the end card. Chosen over the library's Funkorama (too funky for a keynote) and over no music.
- Type: the brand's Plus Jakarta Sans (display) + Instrument Serif italic (one hero word per line).
