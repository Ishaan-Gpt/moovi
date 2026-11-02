# PREFLIGHT: the gate every video session runs

It takes about 2 seconds, and it fails before time is spent instead of after. It needs Node 24 and nothing else (`probe` also uses
the repo's playwright-core). Run it from the repo root.

## When to run what

| When | Command |
|---|---|
| Before the first stage of any film or Short | `node docs/agents/speed/preflight.mjs check <filmDir> stage=plan` |
| After reading what it printed (the newest rules) | `node docs/agents/speed/preflight.mjs ack <filmDir>` |
| Before builders start | `node docs/agents/speed/preflight.mjs check <filmDir> stage=build format=short\|long mins=<minutes>` |
| Before the first export | `node docs/agents/speed/preflight.mjs probe <page.html or url> secs=<film seconds>` |
| Every export (it takes and frees the GPU lease itself) | `node docs/agents/speed/export.mjs page=<filmDir>/<page>.html [audio=...] [out=...]` (add `http=http://localhost:4351 root=<served dir>` for served pages, `preview=1` for an AMD-encoded preview) |
| The per-scene blind judge | `node docs/agents/speed/sheet.mjs <exported.mp4> from=<s> to=<s>`, then the sheets go to a fresh judge |
| A batch capture or a film's own exporter (not export.mjs) | `node docs/agents/speed/preflight.mjs gpu take <filmDir>`, then `check <filmDir> stage=export`, then `gpu free` after |
| Each stage | `node docs/agents/speed/tlog.mjs start <filmDir> "<stage>" <estimate min>`, then `end <filmDir> "<stage>" "<cause if over>"` |
| At the end | `node docs/agents/speed/tlog.mjs total <filmDir>` |

Exit code 0 means go, 1 means a FAIL (fix it first), 2 means a usage error. WARN lines never block. Each check is appended to
`<filmDir>/PREFLIGHT.log` (add `nolog=1` to skip that when checking someone else's folder).

## What it checks, and the measured cost it prevents

| Check | FAIL when | Why (from the logs) |
|---|---|---|
| Disk | C: under 10 GB free (WARN under 25) | the paper film hit 0 MB twice: a 6 min retry and a crashed chunk |
| RAM | under 1.5 GB free (WARN under 3) | a capture page needs about 1-1.5 GB; 1.8 GB was free with idle sessions |
| Docker | WARN if vmmem runs | WSL holds RAM even when FalkorDB is not needed |
| GPU | at export, if another film holds the lease | the same export ran at 224 or 417 ms a frame depending on load |
| Rules | the skill's CHANGELOG has entries newer than this film's `ack`, or `~/.claude/CLAUDE.md` changed after it | "every fix after v1 was a rule known in advance" (AirPods); a look board broke a rule written that morning |
| TIMINGS.md | missing, or no Estimate column | Ishaan's honest-timing rule; overruns need a named cause |
| Script | none at build time | Ishaan approves the script before any build |
| Look or kit | no `LOOK.md`, `kit/`, `kit.js` or `palette.js` here or 1-2 folders up | a look changed mid-build cost every builder a round; kit reuse made 68 min into 17 |
| Voice first | no `timing.js` / `words.json` / `lines.json` / `audio/` / `vo/` | shots are keyed to words |
| Contract | no `CONTRACT.md` / `BRIEF.md` / `SHOTS.md` / `shots.js` / `BEATS.md` | builders need the band, format, banned list and shared models on minute one |
| Staging | WARN on hanging, climbing onto, lifting a person, reaching across, crowds, vast | clip 3's six judge rounds came from staging the rig cannot nail (RULES-8 B) |
| Safe area | WARN when a Short's contract never mentions it | teaser v1 got 4/10 with captions in the Shorts UI |
| Shared kit | WARN when the pages load no `kit/` or `studio` file | building from scratch is the 68-minute path |

`probe` loads the real page with 1 tab, then with 3 tabs, times 30 frames each, picks the faster setup (3 only if it is at least 15%
faster), and projects the export time for the film's length. It warns when the export alone runs past 20 min. In that case,
export scene by scene while building (PLAN.md section 4, rule 6).

The page must set `window.__ready = true` and expose either `window.frameB64(t)` (the Gandhi pattern) or `window.seek(t)`
with a `#cv` canvas (the Stickman pattern).

## Tested (2026-11-02)

- `check` on three real film folders and a test folder: 1.6-2.9 s each.
- `gpu take` by a second film returns BUSY with exit 1, and its `check stage=export` FAILs. The owning film can re-take the lease. The lease
  ends on `gpu free` or after 4 hours.
- `tlog` start, end and total wrote a correct table.
- `probe` on the Gandhi long form: 381 ms a frame with 1 tab against 170 with 3 tabs, 23 s load, a projected 31.8 min for 6.15 min of film
  (its last two real exports took 24 and 49 min). The run took 83 s.

## Limits (honest)

- The content checks are file and keyword checks. They catch a missing step, not a weak shot; the blind judge per scene still does that.
- The GPU lease only works if sessions use it. `export.mjs` takes it by itself; the films' own export scripts do not, so a session that
  still uses one runs `gpu take` and `gpu free` around it. Those scripts also start each tab cold (no pre-roll), which can pop at the splits.
