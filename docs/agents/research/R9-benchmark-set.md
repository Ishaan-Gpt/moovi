# R9: the benchmark clip set and the edit score

Owner: Tab · 2026-10-16. Status: done (spec). The score script itself is D1.6 (`packages/engine/scripts/edit-bench.ts`).
Inputs: R3 (the raw clip and the 2 minute budget), R4 (shared laws, style bands, the EDL `metrics` block), R8 (caption
safe zones), R10 (time to first frame), `PLAN.md` (speed bar and the Day 1 gate in `docs/SPEED.md`).

## Rules for the set

- **Nothing is committed.** Every clip is fetched at run time from its source page into `data/bench/src/` (gitignored),
  checked against the SHA-1 Wikimedia Commons publishes for the original file, and deleted with `--clean`. Edits made
  from the clips are bench output only: never a showcase, a demo reel or a post.
- **Open licences only:** public domain, CC0, CC BY, CC BY-SA. No NC, no ND. Every clip carries its credit line in the
  manifest, and the score table prints it.
- **B1 is Vignesh's own raw take.** It stays on the machine it was recorded for and is described here by its properties
  only. The script reads it from `MOOVI_BENCH_B1` and skips it (marked `local missing`) when that is unset.
- **Fixed.** The set does not change during Day 1 and Day 2, so numbers stay comparable across commits. A clip is
  replaced only if its source page disappears or its SHA-1 changes; the replacement gets a new id.
- **Tiers.** `quick` = B1, B2, B4 (the three clips D1.3 unit tests use; about 165 s of source). `full` = all nine
  (about 650 s of source, about 175 MB to fetch once).

## The clips

All Commons files were read through the Commons API on 2026-10-16 (size, duration, licence, author, SHA-1, available
transcodes) and three poster frames per clip were looked at. Nothing was watched end to end; "speakers" and
"framing" below are from those frames and the file pages. "Truth" is where the word truth comes from (next section).

| Id | Clip | Length | Format | Language | Speakers | Framing | What it stresses | Truth | Licence |
|---|---|---|---|---|---|---|---|---|---|
| B1 | `vignesh-raw-1.mp4` (local, not uploaded) | 29.7 s | 474x850, H.264 30 fps, AAC 48 kHz stereo | English, Indian accent, about 60 words after the slate | 1 | phone selfie, close | the slate ("Take one ... Start", about 9.8 s of pre-roll), a noisy room (no stretch quieter than -35 dB over 0.4 s; -19.4 LUFS integrated), the take ending on the floor, low resolution, R3's Urdu misread | hand, from R3's checked transcript | owner's own; local only |
| B2 | [President Biden records a selfie video with Shawn Fain of the UAW](https://commons.wikimedia.org/wiki/File:President_Biden_records_a_selfie_video_with_Shawn_Fain_of_the_UAW.webm) | 34.1 s | 1080x1920 WebM | English | 2 in one frame | arm's length selfie, two faces | two speakers sharing one frame (face box choice, `speaker` on words), captions already burned into the source (ours must not stack on them) | hand | public domain (per the file page); bench only, no likeness in any showcase |
| B3 | [WP25Jimmy](https://commons.wikimedia.org/wiki/File:WP25Jimmy.webm) | 62.7 s | 1080x1920 WebM | English | 1 | produced: several shots, on-screen cards | an already edited source: the builder must not re-cut existing cuts into stutters, must find the shot changes it did not make, and must keep captions off the source's own cards; 60 s+ | Commons `TimedText` `.en.srt` (line times), aligned to words | CC BY-SA 4.0, Wikimedia Foundation |
| B4 | [WIKITONGUES- Krishna speaking Hindi](https://commons.wikimedia.org/wiki/File:WIKITONGUES-_Krishna_speaking_Hindi.webm) | 101.1 s | 1920x1080 WebM | Hindi with English words mixed in ("university", "but", "job") | 1 | landscape, seated medium shot | the language lock (Devanagari out, not Urdu script, not English), code switching inside a sentence, 16:9 to 9:16 reframing, 60 s+ | Commons `TimedText` `.hi.srt`, aligned to words | CC BY-SA 4.0, Wikitongues and Teddy Nee |
| B5 | [Voices of the People: Lee waiting for Allen West in Lexington](https://commons.wikimedia.org/wiki/File:Voices_of_the_People_Lee_waiting_for_Allen_West_in_Lexington_8-5-12.webm) | 138.1 s | 640x480 (4:3) WebM | English | 1 to camera, an off-camera interviewer (not confirmed) | handheld, outdoors, moving camera | street and crowd noise, wind, a shaky frame for zoom keys, 4:3 to 9:16, long take | hand | CC BY 3.0, DaTechGuyBlog |
| B6 | [Wikimedia CEO Maryana Iskander Interview by Delwar](https://commons.wikimedia.org/wiki/File:Wikimedia_CEO_Maryana_Iskander_Interview_by_Delwar.webm) | 184.3 s | 1920x1080 WebM | English (the interviewer's language not confirmed); Bangla and English subtitles burned in | 2, in separate shots | pre-cut interview, two set-ups | turn taking (who speaks when), cuts that already exist in the source, burned-in subtitles in the lower third, the longest clip (scaling of every stage) | hand | CC BY 4.0, Delwar and Yahya |
| B7 | [WIKITONGUES- Kangkana speaking Assamese and English](https://commons.wikimedia.org/wiki/File:WIKITONGUES-_Kangkana_speaking_Assamese_and_English.webm) | 84.0 s | 626x360 WebM | Assamese and English | 1 | webcam, landscape, low resolution | switching language between sentences: the lock must not force one language on the whole clip; small source upscaled to 1080x1920 | hand for the English parts; Assamese scored by script and word count only | CC BY-SA 4.0, Wikitongues and Kangkana Kuwali Brahma |
| B8 | [Umar speaking Central Kanuri](https://commons.wikimedia.org/wiki/File:Umar_speaking_Central_Kanuri.webm) | 47.0 s | 720x1280 WebM | Central Kanuri (not a language the transcribers list) | 1 | phone selfie, vertical | the confidence gate: low confidence must give an edit with no wrong words on screen (captions off or flagged), never confident nonsense | none needed: the pass rule is "no caption shown below the confidence gate" | CC BY 4.0, Wikitongues, Inc. |
| B9 | [WIKITONGUES- Aditya speaking Marwari](https://commons.wikimedia.org/wiki/File:WIKITONGUES-_Aditya_speaking_Marwari.webm) | 67.6 s | 264x480 WebM | Marwari (the file page; any English intro not confirmed) | 1 | webcam selfie, very close, very low resolution | the smallest source in the set: face box and person mask at 264 px wide, upscale to 1080 wide, punch-ins that cannot go far | same rule as B8 for any non-English speech | CC BY-SA 4.0, Wikitongues and Aditya Marwari |

Coverage against the R9 row on `BOARD.md`: selfie B1, B2, B8, B9; noisy room or street B1, B5; slate B1; landscape B4,
B6, B7 (and 4:3 B5); 60 s+ B3, B4, B5, B6, B7, B9; two speakers B2, B6; non-English B4, B7, B8, B9. Also covered:
already edited sources (B3, B6), burned-in captions (B2, B6), tiny sources (B7, B9).

**Not in the set, on purpose:** a reel with music under the voice from start to end (none found with a clean licence and
a raw take; add one as B10 if Ishaan has his own), and a clip longer than about 3 minutes (out of scope for Day 1).

### Manifest (what `edit-bench.ts` reads)

`packages/engine/bench/clips.json`, committed (it holds no media, only these facts):

```json
[{ "id": "B2", "tier": "quick", "page": "https://commons.wikimedia.org/wiki/File:President_Biden_records_a_selfie_video_with_Shawn_Fain_of_the_UAW.webm",
   "file": "President_Biden_records_a_selfie_video_with_Shawn_Fain_of_the_UAW.webm",
   "sha1": "8c94adb935e8ba62d5eee9d9ec6f291e5986ce21", "duration": 34.1, "w": 1080, "h": 1920,
   "lang": "en", "speakers": 2, "licence": "public-domain", "credit": "Joe Biden, public domain, via Wikimedia Commons",
   "truth": "hand", "window": null }]
```

SHA-1 of each original, as Commons publishes it on 2026-10-16:

| Id | SHA-1 |
|---|---|
| B2 | `8c94adb935e8ba62d5eee9d9ec6f291e5986ce21` |
| B3 | `4fd5edadc595a99c42fe903d537f888d02536f25` |
| B4 | `588b0259cce4b8afcbb52c778e5c0c7b9e1fec57` |
| B5 | `162459f5077b02e197936ad9eef41e5be2c69ada` |
| B6 | `1774112ae6af92bb8210c2cf1cf7e8567635c7cb` |
| B7 | `2f23908511be1893ab3795c4d1cf8a8134379ce0` |
| B8 | `52621a12ed1d96f8774e719ae44e956a565d1134` |
| B9 | `efda9d1ccba57a320e5cc2348a2f9a9aa52999cd` |

Fetch: `GET https://commons.wikimedia.org/w/api.php?action=query&titles=File:<file>&prop=imageinfo&iiprop=url|sha1|size`
with a User-Agent header, then the original from `imageinfo.url`. Commons also serves 480p and 1080p VP9 transcodes,
but their bytes are not pinned, so the bench uses the originals. `window` (source in and out seconds) is null for all
nine: whole clips are scored.

## Word truth

One file per clip, `data/bench/truth/<id>.words.json` (local, gitignored; the text is the speaker's words, so it is
not committed until Ishaan and Vignesh decide otherwise):

```json
{ "id": "B4", "lang": "hi", "source": "commons-timedtext-hi", "checked_by": "Tab", "checked_at": "2026-10-16",
  "words": [{ "t0": 0.71, "t1": 1.12, "text": "नमस्ते", "speaker": "A", "lang": "hi" }] }
```

How it is made, once per clip, before Day 1's gate:
1. Text. B3 and B4: the Commons subtitle file in the clip's own language (`TimedText:<file>.en.srt`, `.hi.srt`), which
   gives line text and line times. The rest: the strongest transcriber we have (word times on), then a person reads
   it against the audio and fixes it. B1: R3's checked words.
2. Word times. The checked text is aligned to the audio by the same word-timed transcriber, matching words in order;
   a word that does not match keeps the line's time spread evenly and is marked `aligned: false`. Word times are
   therefore good to about 50 to 100 ms, which is the precision the cut-on-word rule needs (100 ms).
3. Speakers and pauses come from the truth file, never from the build under test.

## What is measured

Each run is one clip under one edit style at one commit. The script writes every number below to
`data/bench/results/<sha>-<clip>-<style>.json` and prints one table.

| Metric | Exact definition | Pass (Day 1 gate) | Source of the bar |
|---|---|---|---|
| Preview time | seconds from the upload being accepted by the studio to the player's first painted frame (`requestVideoFrameCallback` in headless Chrome, R10's method) | 30 s clip: 60 s or less. Longer: 2.0 s per source second or less (proposed) | PLAN speed bar; R10 |
| MP4 time | seconds from the MP4 request to the file closed and probed | 30 s clip: 120 s or less. Longer: 4.0 s per source second or less (proposed) | PLAN speed bar |
| Stage seconds | hear, take and cuts, prep, EDL build, first frame, MP4, each logged | reported, no bar | R3 |
| Word accuracy | 1 minus WER of the EDL's `words[]` against truth, after lowercasing and stripping punctuation; Devanagari compared as Devanagari | English (B1, B2, B3, B5, B6, English parts of B7): 95% or more. Hindi (B4): 85% or more (proposed) | R3 (footage-edit got every word on B1) |
| Language right | the language the EDL names per line equals the truth's; script check (no Urdu script on B1 or B4) | every line | R3's Urdu misread |
| Gate honesty | on B8 and B9, words shown as captions while the line's confidence is under the gate | 0 | D1.2's confidence gate |
| Pause trims | (a) gaps between kept words longer than the style's `pause_max` in the output timeline; (b) longest such gap; (c) count of truth pauses over `pause_max` that were trimmed | (a) 0 (Handmade exempt); (b) 0.45 s or less; (c) reported | R4 shared laws (0.40 to 0.18 s) |
| Slate and retakes | output seconds that fall inside truth ranges marked slate or retake | 0 on B1 | R3 |
| Cut on word | share of speaker cuts (`cuts[]` of type hard, jump or punch whose both sides show the speaker) whose source time lies within 100 ms of a truth word boundary; plus cuts landing inside a word, more than 100 ms from both its edges | 95% or more; 0 inside a word | R4 cut snap law |
| LUFS | integrated loudness and true peak of the MP4 (ffmpeg `ebur128=peak=true`) | -14 LUFS plus or minus 1 LU; true peak -1.0 dBTP or less | R4 loudness law |
| Silence holes | stretches quieter than -35 dB longer than 0.4 s inside the MP4 (`audio-proof` method) | 0 inside speech | R4 |
| Captions off the face | share of caption frames (sampled at 5 fps) whose box overlaps the face box | 0% (2% allowed while the face moves faster than the box updates) | R4 safe zones, R8 `face-safe` |
| Platform zones | caption pixels inside the top 8% or bottom 15% of 9:16 | 0 | R4, `render/qa.ts platformZone` |
| Style band | the EDL `metrics` block (changes per s, events per s, median shot, max hold, words per s, max gap, cuts on word, sfx on cut) against the style's R4 band | every metric inside its band | R4, Claude 1's D1.1 note 3 (fail loudly) |
| Determinism | the same clip, style and seed built twice: EDL JSON byte equal after sorting keys | equal | R4 determinism law |

Bars marked "proposed" are mine; Claude 1 or Vignesh can move them before the gate.

## The score script, outline (D1.6)

`packages/engine/scripts/edit-bench.ts`, TypeScript and ffmpeg only, no Python (root rule).

```text
npx tsx scripts/edit-bench.ts [--tier quick|full] [--style night-desk-a,...|all] [--mp4] [--clean] [--json]

1. load    bench/clips.json; B1 from MOOVI_BENCH_B1 (skip if unset)
2. fetch   per clip, if data/bench/src/<id>.<ext> is missing: imageinfo -> original URL -> download -> SHA-1 check
           (mismatch = stop, the clip changed upstream); 3 clips at a time; record fetch seconds apart, never in a score
3. truth   read data/bench/truth/<id>.words.json; missing truth = word metrics print "no truth", speed still runs
4. run     per clip x style: start the edit job through the same entry the studio route uses (D1.7), never a
           shortcut; stamp t_accept, every stage event, t_edl
5. preview open the D1.4 player on the EDL in headless Chrome (the engine's Playwright), visible page, metadata
           first; stamp t_first_frame; sample caption boxes and face boxes at 5 fps over the whole edit
6. mp4     with --mp4: request the D1.8 render, stamp t_mp4, ffprobe the file, ebur128 + silence scan
7. score   the metrics table above, from the EDL (words, keep, cuts, captions, metrics), the truth and the MP4;
           a second build with the same seed for determinism
8. report  data/bench/results/<sha>-<clip>-<style>.json; stdout: one markdown table, one row per clip x style,
           ready to paste under "Day 1 gate" in docs/SPEED.md; exit 1 if any gate row fails
9. clean   with --clean: delete data/bench/src and any temp dirs (the box disk is small)
```

Notes for the build:
- Speed numbers are taken with the box otherwise idle, and the table says so (SPEED.md showed test suites skew runs).
- The preview clock includes upload handling but not the network upload itself (the bench reads the file from disk).
- `edit-bench.ts` never calls a model on its own; any model call is the edit job's (one per edit, PLAN's quota note).

## The Day 1 gate table (for `docs/SPEED.md`)

One row per clip and style at one commit, on the R9 `quick` tier at least:

| Clip | Source s | Style | Preview s | MP4 s | Words right | Lang | Pauses left (max) | Cut on word | LUFS / TP | Captions off face | Band | Result |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| B1 | 29.7 | (style) | | | | | | | | | | |
| B2 | 34.1 | (style) | | | | | | | | | | |
| B4 | 101.1 | (style) | | | | | | | | | | |

Header line above it: commit sha, box (CPU, memory, GPU or none), idle or shared, date and time IST.

## Credits

- B2: Joe Biden (author as the file page names it), public domain, via Wikimedia Commons.
- B3: Wikimedia Foundation, "WP25Jimmy", CC BY-SA 4.0, via Wikimedia Commons (full credits on the file page).
- B4: Wikitongues and Teddy Nee, "WIKITONGUES- Krishna speaking Hindi", CC BY-SA 4.0, via Wikimedia Commons.
- B5: DaTechGuyBlog, "Voices of the People Lee waiting for Allen West in Lexington 8-5-12", CC BY 3.0, via Wikimedia Commons.
- B6: Delwar and Yahya, "Wikimedia CEO Maryana Iskander Interview by Delwar", CC BY 4.0, via Wikimedia Commons.
- B7: Wikitongues and Kangkana Kuwali Brahma, "WIKITONGUES- Kangkana speaking Assamese and English", CC BY-SA 4.0, via Wikimedia Commons.
- B8: Wikitongues, Inc., "Umar speaking Central Kanuri", CC BY 4.0, via Wikimedia Commons.
- B9: Wikitongues and Aditya Marwari, "WIKITONGUES- Aditya speaking Marwari", CC BY-SA 4.0, via Wikimedia Commons.
