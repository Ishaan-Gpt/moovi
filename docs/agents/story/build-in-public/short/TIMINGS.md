# TIMINGS: short (estimate before, actual after; machine clock; written by docs/agents/speed/tlog.mjs)

| Stage | Estimate | Start | End | Actual | Note |
|---|---|---|---|---|---|
| Preflight + kit read | 6 min | 01:34 | 01:35 | 1 min | preflight blocked on disk 7.7 GB, RAM 1.1 GB and a Blender render holding the GPU; the kit read itself took 1 min |
| Script + voice + word times | 8 min | 01:35 | 01:42 | 7 min | one re-voice: a line said the clock read 59 when the screen clock already had (logic rule) |
| Shots: page build (13 shots) | 20 min | 01:42 | 01:49 | 7 min | 4 check renders; 1 fix round on F (framing) and I (swat pose); GPU shared with a Blender render |
| Export short-vo.mp4 (speed/export.mjs) | - | 01:50 | 01:56 | 6.9 min | 5/5 chunks rendered, 1336 frames at 242 ms, 1 tab(s) |
| Export short-vo.mp4 (speed/export.mjs) | - | 01:57 | 01:58 | 1.5 min | 1/5 chunks rendered, 191 frames at 238 ms, 1 tab(s) |
| Export (export.mjs) + mux | 12 min | 01:49 | 01:59 | 9 min | picture 416 s at 242 ms a frame (1 tab); re-export to the mix length reused 4 of 5 chunks (90 s); sound engine reused from ep1 (9 s mix) |
| Blind judge on the export | 6 min | 01:59 | 02:01 | 3 min | 5.17/10: logic (proof faller before Turbo), unseen actions (run, swat, Reflex's fall), fly reads as a drop, static clock, payoff from behind |
| Fix round 1 (judge's top defects) | 15 min | 02:01 | 02:12 | 11 min | logic restructure (Turbo is the proof + a replay), re-voice + re-align, 8 shot fixes, 2 self-made bugs (comments swallowing code), sound cues re-keyed |
| Export short-vo.mp4 (speed/export.mjs) | - | 02:12 | 02:19 | 7.3 min | 5/5 chunks rendered, 1445 frames at 226 ms, 1 tab(s) |
| Export v2 + mux | 9 min | 02:12 | 02:19 | 7 min | 437 s at 226 ms a frame; all 5 chunks changed (the re-voice moved every shot) |
| Blind judge 2 on the export | 5 min | 02:19 | 02:21 | 2 min | 5.0/10 (v1 5.17): plateau. The replay read as Turbo falling twice; running legs and the swat still do not read; holds too long; hook shows no loss |
| **TOTAL** | 81 min (sum) | 01:34 | 02:21 | 47 min wall | inside the hour |
