"""The music bed for a video: a track from its strong section, looped on a bar line with a short crossfade, faded out.
Usage: python bed.py <track> <out.wav> --seconds S --start T --bpm B
(the same loop the owner's tl_make.py uses for Style 1: 10 bars a loop, 0.25 s crossfade, 1.5 s fade-out)."""
import argparse
import numpy as np, soundfile as sf, librosa

ap = argparse.ArgumentParser(); ap.add_argument("track"); ap.add_argument("out")
ap.add_argument("--seconds", type=float, required=True); ap.add_argument("--start", type=float, default=0); ap.add_argument("--bpm", type=float, default=120)
a = ap.parse_args()
y, sr = librosa.load(a.track, sr=44100, mono=False)
y = np.atleast_2d(y)
if y.shape[0] == 1: y = np.vstack([y, y])
s0 = int(a.start * sr); loop = int(10 * 4 * 60 / a.bpm * sr); xf = int(0.25 * sr)
seg = y[:, s0:s0 + loop + xf]
if seg.shape[1] < loop + xf:  # the track is shorter than 10 bars after its start: loop what there is
    loop = max(xf * 2, seg.shape[1] - xf)
n = int((a.seconds + 0.5) * sr); out = seg[:, :loop + xf].copy(); ramp = np.linspace(0, 1, xf)
while out.shape[1] < n:
    tail = out[:, -xf:] * (1 - ramp) + seg[:, :xf] * ramp
    out = np.concatenate([out[:, :-xf], tail, seg[:, xf:loop + xf]], axis=1)
out = out[:, :n]; f = int(1.5 * sr); out[:, -f:] *= np.linspace(1, 0, f); out[:, :int(0.05 * sr)] *= np.linspace(0, 1, int(0.05 * sr))
sf.write(a.out, out.T, sr)
print(round(out.shape[1] / sr, 2))
