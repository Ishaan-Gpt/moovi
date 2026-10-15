"""Fast Style 1 audio stems: the SFX stem and the music bed in ONE process, with the decoded sounds cached.
Usage: python s1audio.py <events.json> <outdir> --me <MotionEasy dir> --cache <dir> --seconds S [--seed 1]
Writes <outdir>/sfx.wav and <outdir>/music.wav. The placement logic is a line-for-line copy of MotionEasy's
styles/tools/sfx_mix.py (main) and tl_make.py (bed); only the decode (librosa.load + onset slicing, the slow part:
~20 s per process) is cached as a pickle keyed by file size+mtime. Output is sample-identical to the originals
(checked by scripts/s1make.ts --check-audio). librosa is imported only on a cache miss."""
import argparse, json, pickle, random, sys
from pathlib import Path
import numpy as np, soundfile as sf

SR = 44100


def cached(cache, key, files, make):
    sig = [(str(f), f.stat().st_size, int(f.stat().st_mtime)) for f in files]
    p = cache / (key + ".pkl")
    if p.exists():
        try:
            d = pickle.loads(p.read_bytes())
            if d["sig"] == sig: return d["v"]
        except Exception: pass
    v = make()
    cache.mkdir(parents=True, exist_ok=True)
    p.write_bytes(pickle.dumps({"sig": sig, "v": v}, protocol=4))
    return v


def load_sounds(sfx_dir, spec):
    import librosa
    out = {}
    for key, s in spec.items():
        y = librosa.load(str(sfx_dir / s["file"]), sr=SR, mono=True)[0]
        if s.get("slices") == "onsets":
            on = list(librosa.onset.onset_detect(y=y, sr=SR, units="samples", backtrack=True, delta=0.2)) + [len(y)]
            cap = int(s.get("slice_len", 1.0) * SR)
            parts = [y[a:min(b, a + cap)] for a, b in zip(on, on[1:]) if np.abs(y[a:b]).max() > np.abs(y).max() * 0.15]
        else:
            e = np.abs(y); a = np.argmax(e > e.max() * 0.03); b = len(y) - np.argmax(e[::-1] > e.max() * 0.03)
            parts = [y[a:b]]
        out[key] = [{"y": p, "peak": int(np.argmax(np.abs(p))), "rms": float(np.sqrt(np.mean(p ** 2)) + 1e-9)} for p in parts]
    return out


def sfx(events, ME, cache, seed, out_path):
    sfx_dir = ME / "styles" / "style-1" / "sfx"
    M = json.loads((sfx_dir / "map.json").read_text(encoding="utf-8"))
    files = [sfx_dir / "map.json"] + [sfx_dir / s["file"] for s in M["sounds"].values()]
    S = cached(cache, "sfx-sounds", files, lambda: load_sounds(sfx_dir, M["sounds"]))
    E = M["events"]; R = M["rules"]
    rnd = random.Random(seed)
    evs = events
    flat = []
    for ev in evs:
        if ev["event"] == "cascade":
            every = E["cascade"].get("every", 1); n = ev.get("count", 8); sp = ev.get("spacing", 0.05)
            hits = list(range(0, n, every))
            for j, i in enumerate(hits):
                fade = E["cascade"].get("fade_db", 0) * j / max(1, len(hits) - 1)
                flat.append({**ev, "event": "cascade", "t": ev["t"] + i * sp, "gain_db": ev.get("gain_db", 0) + fade})
        else:
            flat.append(ev)
    prio = {k: i for i, k in enumerate(R["priority"])}
    sustained = {k for k, s in M["sounds"].items() if s["align"] == "end" or k in ("ui-riser", "fast-typing")}
    kept, taken = [], {}
    for ev in sorted(flat, key=lambda e: (prio.get(e["event"], 99), e["t"])):
        snd = ev.get("sound") or E[ev["event"]]["sounds"][0]
        same = taken.setdefault(ev["event"], [])
        if snd in sustained or all(abs(ev["t"] - t) >= R["min_gap"] for t in same):
            kept.append(ev); same.append(ev["t"])
    kept.sort(key=lambda e: e["t"])
    end = max(e["t"] for e in kept) + 4
    out = np.zeros(int(end * SR), dtype=np.float32)
    last_pick = {}
    for ev in kept:
        cfg = E[ev["event"]]
        choices = [ev["sound"]] if ev.get("sound") else cfg["sounds"]
        k = choices[(choices.index(last_pick[ev["event"]]) + 1) % len(choices)] if last_pick.get(ev["event"]) in choices and len(choices) > 1 else choices[0]
        last_pick[ev["event"]] = k
        parts = S[k]; pi = rnd.randrange(len(parts))
        if len(parts) > 1 and last_pick.get(k + "#") == pi: pi = (pi + 1) % len(parts)
        last_pick[k + "#"] = pi
        p = parts[pi]; y = p["y"]
        if "max_len" in cfg and len(y) > cfg["max_len"] * SR:
            y = y[: int(cfg["max_len"] * SR)].copy(); f = int(0.05 * SR); y[-f:] *= np.linspace(1, 0, f)
        g = cfg["level_db"] - 20 * np.log10(p["rms"]) + ev.get("gain_db", 0) + rnd.uniform(-R["jitter_db"], R["jitter_db"])
        g = min(g, R["peak_ceiling_db"] - 20 * np.log10(np.abs(y).max() + 1e-9))
        align = M["sounds"][k]["align"]
        off = 0 if align == "start" else p["peak"] if align == "peak" else len(y)
        s = int(ev["t"] * SR) - off
        if s < 0: y = y[-s:]; s = 0
        seg = y * 10 ** (g / 20)
        out[s:s + len(seg)] += seg[: len(out) - s]
        if "then" in cfg:
            t2 = cfg["then"]; q = S[t2["sound"]][0]
            g2 = t2["level_db"] - 20 * np.log10(q["rms"])
            s2 = int((ev["t"] + t2["after"]) * SR)
            out[s2:s2 + len(q["y"])] += (q["y"] * 10 ** (g2 / 20))[: len(out) - s2]
    pk = np.abs(out).max()
    if pk > 10 ** (-1 / 20): out *= 10 ** (-1 / 20) / pk
    n = len(out) - np.argmax(np.abs(out[::-1]) > 1e-5)
    sf.write(out_path, out[: n + SR // 4], SR)
    return len(kept)


def bed(dur, ME, cache, out_path):
    M = ME / "styles" / "style-1" / "music"; B = json.loads((M / "bed.json").read_text(encoding="utf-8"))
    def load():
        import librosa
        return np.atleast_2d(librosa.load(str(M / B["file"]), sr=44100, mono=False)[0])
    y = cached(cache, "bed", [M / "bed.json", M / B["file"]], load); sr = 44100
    s0 = int(B["start"] * sr); loop = int(10 * 4 * 60 / B["bpm"] * sr); xf = int(0.25 * sr)
    seg = y[:, s0:s0 + loop + xf]; n = int((dur + 0.5) * sr); outb = seg[:, :loop + xf].copy()
    ramp = np.linspace(0, 1, xf)
    while outb.shape[1] < n:
        tail = outb[:, -xf:] * (1 - ramp) + seg[:, :xf] * ramp
        outb = np.concatenate([outb[:, :-xf], tail, seg[:, xf:loop + xf]], axis=1)
    outb = outb[:, :n]; f = int(1.5 * sr); outb[:, -f:] *= np.linspace(1, 0, f)
    outb[:, :int(0.05 * sr)] *= np.linspace(0, 1, int(0.05 * sr))
    sf.write(out_path, outb.T, sr)


if __name__ == "__main__":
    ap = argparse.ArgumentParser(); ap.add_argument("events"); ap.add_argument("outdir")
    ap.add_argument("--me", required=True); ap.add_argument("--cache", required=True)
    ap.add_argument("--seconds", type=float, required=True); ap.add_argument("--seed", type=int, default=1)
    a = ap.parse_args(); out = Path(a.outdir); ME = Path(a.me); cache = Path(a.cache)
    evs = json.loads(Path(a.events).read_text(encoding="utf-8"))
    n = sfx(evs, ME, cache, a.seed, str(out / "sfx.wav"))
    bed(a.seconds, ME, cache, str(out / "music.wav"))
    print(json.dumps({"hits": n}))
