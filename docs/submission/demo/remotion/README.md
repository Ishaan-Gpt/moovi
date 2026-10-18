# MotionEasy clones 2 and 3, imported for the demo film

Two of the three reference clones Ishaan built in MotionEasy (three.js + Remotion), copied here to tailor to the
demo script. Clone 1 (Bundance) stayed in MotionEasy.

| Composition | Clone | Frame | Notes |
|---|---|---|---|
| `SaaswaveClone` | Ref B, SaasWAVE (ig-DcvVp-Qof2x), 26.3 s | 1920×1080, 24 fps | the fast pipeline: real-time R3F, the room is a light bake (`style3/saaswave-room`) |
| `SaaswaveBest` | the same film, best-overall pipeline | 1920×1080, 24 fps | needs MotionEasy's pre-rendered `style3/saaswave-best` frames (178 MB), so it's not in the slim public dir |
| `CClone` | Ref C, "Not everything has a tutorial" (ig-C-pPfbftP_6), 41.6 s | 1080×1920, 24 fps | colour-field mesh from `data/c-clone/` |

Code: `src/style3` (the style-3 kit, films and helpers, as in MotionEasy on 2026-10-14). Dependencies are not installed
here: `node_modules` is a junction to `MotionEasy/launch-remotion/node_modules`. Media stays in MotionEasy: the slim
public dir `data/demo/remotion-pub` holds junctions to the three folders these films read (Remotion copies the whole
public dir on every render, and MotionEasy's is 1.4 GB).

```bash
npx remotion still src/index.ts SaaswaveClone out.jpg --frame=120 --public-dir="../../../../data/demo/remotion-pub" --gl=angle
```
