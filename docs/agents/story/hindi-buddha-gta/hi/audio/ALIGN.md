# Voice: which take, the speed, and how the words were timed

- **Which take is Hindi.** Each take was compared with an espeak-ng reading of the Hindi script and of the English
  script (MFCC + DTW, normalised path cost; lower is closer). `take-viraj.mp3`: Hindi 0.315, English 0.400.
  `take-titan.mp3`: Hindi 0.430, English 0.330. So Viraj is the Hindi read and Titan the English one, as expected.
- **Speed.** 1.4x with ffmpeg `atempo=1.4` on the whole take (one continuous read, pitch kept): 72.05 s becomes
  51.47 s, about 3.6 words a second (the series rule is 3.2 to 3.8). 1.3x gives 3.35 and 1.5x gives 3.85.
  The choice was made on the numbers; nobody has listened to it in this cloud session (no audio out), so Ishaan's ear
  decides. To change it: edit `TEMPO` in `refine.py`, rerun the three steps below, then `score.mjs` and `mix.mjs`.
- **Word times.** The cloud blocks ElevenLabs and every whisper model host, so the alignment is local:
  `words.py` reads each script line with espeak-ng (Hindi voice; its word events give exact word starts in the
  synthetic read), computes MFCCs of that and of the real take, and maps the word starts through a DTW path;
  `refine.py` then pins every comma and line end to the real silences in the take (27 of 32 pauses anchored) and
  divides by the tempo. Line starts and ends sit on real pauses; words inside a phrase are good to roughly 0.1 s.
  When the film goes back to Ishaan's PC, `hindi-azad/short/audio/align.mjs` (ElevenLabs forced alignment) can
  replace `timing.js` with no other edit: every cue in the film is a word, not a second.

```
pip install espeakng-loader numpy scipy
cd docs/agents/story/hindi-buddha-gta
python3 hi/audio/align.py /tmp/lang.json                 # which take is which
python3 hi/audio/words.py hi/audio /tmp/words-raw.json   # word starts by DTW
python3 hi/audio/refine.py /tmp/words-raw.json hi/timing.js
```
