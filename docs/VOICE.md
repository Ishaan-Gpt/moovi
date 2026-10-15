# The voice: library, Voice Director, cache

Built during Graph Hacks (Oct 16, 2026) by Vignesh B S with AI agent help (see AI_USAGE.md).

## What runs

The crew's `voice` task (src/tasks/script.ts) now does three things before the Editor gets `vo.wav` and `words.json`:

1. **Cast** (`src/tasks/casting.ts`, `src/audio/cast.ts`). The Voice Director reads the brief, the plan's mood and the
   script, and hears: the language (Devanagari, Tamil, Telugu, Kannada, Malayalam, Gujarati, Bengali script, or
   "in Hindi", "in Tamil"…), an accent ("Indian", "Bangalore", "British", "Aussie"…; Hinglish lines want Indian
   English), a gender, an age feel (kids, students, premium), the energy (hype, promo, calm, documentary) and the job
   (news, story, tutorial…). Every voice in the library is scored against that, plus the project's graph:
   the voice this project already uses scores higher (a brand keeps its voice), "a different voice" turns the old one
   down for good in that chat, and a turned-down voice is never cast again there. A voice named in the brief
   ("use Ryan", `en-GB-RyanNeural`) wins. On a close call the fast model picks from the top 6 with a one-line reason;
   with no model, the ranking's first pick stands. The pick and its reason are written as
   `(:Film)-[:VOICED_BY {reason, shortlist, by, picked, rate}]->(:Voice)`.
2. **Speak** (`src/audio/lines.ts`). Each beat is spoken on its own, up to 8 at once, and cached by
   `sha256(engine, voice, rate, pitch, text)` in `data/cache/voice`. Lines are trimmed to their speech and joined with
   a 0.4 s breath; word times are shifted onto the joined track and punctuation is given back from the script.
3. **Record what really happened** (`voiceSpoken`): the engine that spoke each line (`spokenBy`, e.g. `edge:6`), cache
   hits, ms per line, and why ElevenLabs did not speak when it was asked for.

## The library (`src/audio/voices.ts`)

63 Microsoft Edge voices, free and keyless: 17 American, 5 British, 2 Irish, 3 Indian English, 2 Hindi, 14 in 7 Indian
languages (Tamil, Telugu, Kannada, Malayalam, Marathi, Gujarati, Bengali), and Australian, Canadian, New Zealand, South
African, Nigerian, Kenyan, Tanzanian, Singaporean, Filipino and Hong Kong English. Gender and locale are Microsoft's;
age feel, energy (1 to 5), tone and the jobs each voice suits are our own tags. Every id is checked against
Microsoft's live list by `pnpm --filter @moovi/engine voices --check`.

## ElevenLabs (optional, off by default)

`MOOVI_VOICE_ENGINE=elevenlabs` plus `ELEVENLABS_API_KEY` (and optionally `ELEVENLABS_VOICE_ID`) speak through
ElevenLabs' `with-timestamps` API, word times from its character alignment. If the key is missing or a call fails,
Edge speaks, and the graph says so (`spokenBy`, `fallback`). Moovi never reports ElevenLabs when Edge spoke.
This path is unit tested with a stand-in; it has not been run against a live ElevenLabs key.

## Commands

```bash
pnpm --filter @moovi/engine voices                          # the library
pnpm --filter @moovi/engine voices --check                  # ids against Microsoft's live list
pnpm --filter @moovi/engine voices --pick "Hype ad for a Bangalore coffee startup"
pnpm --filter @moovi/engine voices --bench --rounds 5       # speed: old one-shot vs lines, cold, cached, one edit
FALKORDB_URL=falkor://127.0.0.1:6380 pnpm --filter @moovi/engine exec tsx scripts/voice-check.ts "brief" "a different voice"
```

## Speed (measured Oct 16, 2026, this repo, 6-line script, Edge, median of 5 rounds)

| | before (whole script in one call) | now |
|---|---|---|
| first time (cold) | 0.93 s | 0.84 s (8 lines at once) |
| same script again (cache) | 0.93 s | 0.16 s |
| one line edited | 0.93 s | 0.71 s |

The cold gain is small; the real speed-up is the cache on re-runs, send-backs and edits. Hindi (Swara) one-shot was
1.84 s vs 1.35 s by lines. Times depend on the network to Microsoft.

## Graph

Queries in `packages/graph/src/queries/voice.ts`, documented in `docs/QUERIES.md`: `castVoice`, `voiceSpoken`,
`voiceHistory`, `rejectVoice`, `whyVoice`, `voiceMix`.
