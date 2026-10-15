# Any model

The crew thinks on whatever model you give it. By default it uses this machine's Claude Code login. One line in
`.env.local` switches it to any model API, and nothing else in the engine changes.

```bash
CE_RUNTIME=http
GROQ_API_KEY=...        # or GEMINI_API_KEY, OPENAI_API_KEY, ANTHROPIC_API_KEY, OPENROUTER_API_KEY, ...
```

The provider is the first one whose key is set. `CE_PROVIDER` picks one explicitly. Each provider has its own models
for the three tiers (director, crew and fast). `CE_MODEL_DIRECTOR`, `CE_MODEL_CREW` and `CE_MODEL_FAST` override them.
A Claude model id left over from the Claude Code setup is ignored on providers that cannot serve it.

| Provider | Key | Default models (director / crew / fast) | Notes |
|---|---|---|---|
| anthropic | `ANTHROPIC_API_KEY` | claude-opus-5-5 / claude-sonnet-5-5 / claude-haiku-5-5 | native tools |
| openai | `OPENAI_API_KEY` | gpt-5 / gpt-5-mini / gpt-5-nano | JSON Schema-constrained answers |
| gemini | `GEMINI_API_KEY` | gemini-2.5-pro / gemini-2.5-flash / gemini-2.5-flash-lite | responseSchema-constrained answers |
| groq | `GROQ_API_KEY` | llama-3.3-70b-versatile / same / llama-3.1-8b-instant | JSON mode; broken tool calls are recovered |
| openrouter | `OPENROUTER_API_KEY` | google/gemini-2.5-pro / -flash / -flash-lite | any OpenRouter model via `CE_MODEL_*` |
| ollama | none | the largest local model (`auto`) | emulated tools, schema-constrained, deadlines ×4 |
| deepseek, mistral, together, xai, cerebras | `<NAME>_API_KEY` | see `runtime/providers.ts` | |
| compatible | `CE_API_KEY` + `CE_BASE_URL` | `CE_MODEL_*` | any OpenAI-compatible server |

## Why a weak model still makes a good film

A model's quality should change how sharp a film is, never whether the film works. So the engine asks every model
only for what any model does well, and does the rest itself:

1. **Narrow asks.** The model extracts facts, fills named script slots, picks from short lists (enums) and tags
   needs. It never gives coordinates, colours, timings or layouts. Those come from the style's laws and the matcher.
2. **Constrained answers.** Where the API supports it, the JSON Schema is enforced by the decoder (OpenAI
   `json_schema`, Gemini `responseSchema`, Ollama `format`). Otherwise the API's JSON mode is used, and failing that,
   a plain-words picture of the shape. When an API refuses a mode, it is downgraded automatically.
3. **Coercion before validation.** `"3"` becomes 3, `"Hero"` becomes `hero`, `"before_after"` becomes `before-after`.
   One object where a list was asked becomes a list, and an answer wrapped in `{"answer": ...}` is unwrapped. JSON
   inside prose, a code fence or a truncated reply is still read (`runtime/coerce.ts`).
4. **Repair turns.** A still-wrong answer goes back with the exact problems (`beats.1.device: Invalid option`), up to
   twice. Then the other tier's model gets one try, and after that comes the deterministic fallback.
5. **Tools without tool support.** Models without native tool calls (and APIs that reject them) get the tools as words
   and call them with a JSON reply. Groq's `tool_use_failed`, Llama's `<function=x>{...}</function>` text and an
   answer sent without the tool call are all read, not lost.
6. **The script doctor and the quality bounce.** The doctor removes copied labels, hype, invented numbers, repeats
   and over-long lines. It fills missing slots from the site's own facts, makes sure each slot that needs the brand
   names it, and makes sure the CTA has the domain. The brief bounces once for stock phrases ("easy-to-use
   platform") or lines that barely use the page's own words.
7. **Trust is earned.** A model's need tags are merged with the detector only when they agree with it often enough
   (`mergeNeeds`). A model tagging at random changes nothing.
8. **Pacing.** Each provider gets its own limit on calls in flight (Groq 3, Ollama 1, …). A 429 waits as long as the
   API asks (`retry-after`, Groq's reset headers, Gemini's `retryDelay`).

## Checking a model

```bash
cd packages/engine
CE_RUNTIME=http CE_PROVIDER=groq pnpm exec tsx --env-file-if-exists=../../.env.local scripts/model-check.ts https://cal.com
```

This runs the real calls a style makes (the arc brief, needs tagging, one improvised set-up) and prints validity,
seconds and the doctor's fixes. It writes the result to `data/checks/models/` so runs on different models can be
compared side by side. `test/weak-models.test.ts` replays the bad habits weak models actually have against every
adapter.

## In the studio: every user brings their own key

A new account is asked for one API key before the studio opens (Settings → Your model, `apps/studio/src/app/settings`).
The server checks the key against the provider's live model list, so a refused key is never saved. It picks the
three tier models from the models that key can actually use, and stores the key sealed with AES-256-GCM under
`data/users/<id>/model.json` (`packages/engine/src/keys.ts`). The browser only ever sees the provider and the key's
last four characters.

Every job runs inside its owner's model scope (`withModel`, an `AsyncLocalStorage`). One worker serves many users at
once, and no job ever uses another user's key. A user without a key who sends a brief gets a plain message asking
for one. `CE_BYOK=optional` lets such users run on the server's own model instead.

## Pictures on models that don't draw well

Editorial asks the model to draw each picture as a layered SVG, and drawing is the one job where model strength
still shows. On anything but Claude, Editorial is **library-first** (`packages/engine/src/s4/library-pics.ts`):

1. Every sentence gets the library picture that best matches its planned noun, the picture idea and its own words.
   Each picture is used once per film.
2. The model draws only what the library can't serve, and its drawing faces the same checker.
3. If that drawing fails, the closest library picture stands in.

The library ships in the repo (`packages/library/src/style-4/pictures.json`: 258 Claude-drawn pictures that passed
the checker, rebuilt with `scripts/s4-seed.ts`). It grows with every good drawing made on the machine. Drawings by a
weaker model are never added to it. `CE_S4_DRAW=model|library` forces either mode.
