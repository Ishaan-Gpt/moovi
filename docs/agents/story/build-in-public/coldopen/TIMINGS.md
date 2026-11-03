# TIMINGS: coldopen (estimate before, actual after; machine clock; written by docs/agents/speed/tlog.mjs)

Note: research, script, voice, sound and the three look rounds of this cold open ran before this log existed (about 37 min of wall
time, from 08:13 to 08:50, by the clip and log times); the preflight gate caught that at export. Only the stages from here are clocked.

| Stage | Estimate | Start | End | Actual | Note |
|---|---|---|---|---|---|
| Export coldopen-v1.mp4 (speed/export.mjs, preview) | - | 09:25 | 09:40 | 14.9 min | 7/7 chunks rendered, 1849 frames at 1325 ms, 3 tab(s) |
| export (preview) + sheets | 6 min | 08:50 | 09:41 | 50 min **OVER** |  |

Cause of the export over-run: the stage clock includes a GPU wait behind the Hindi Bhagat export and a PC restart. The render itself
took 895 s (1.3 s a frame with 3 tabs), against 65-870 ms a frame in single stills: the canvas blur filters (`ctx.filter = blur()`) on
every depth layer are the cost. Fix for the kit: pre-blur the static room layers once per shot into an offscreen canvas.
