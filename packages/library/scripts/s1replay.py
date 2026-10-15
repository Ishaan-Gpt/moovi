#!/usr/bin/env python
"""s1replay.py: execute a Style 1 plan (format documented at the top of s1record.py) against the REAL s1kit.Kit in the
mirror root and compare the files it writes with the golden ones.
    python s1replay.py <video-id | plan.json> [--mirror <root>] [--plans <dir>] [--golden <dir>]
    python s1replay.py --all
Exit code 0 = every checked plan reproduced timeline.json, <id>.json and events.json byte for byte."""
import json, os, sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
WORKTREE = HERE.parents[2]
SCALARS = {"FONT", "LOGO", "INK", "ACC", "BG", "_cursor"}


class Replay:
    def __init__(self, plan, s1kit):
        self.plan, self.m = plan, s1kit
        kit = plan["kit"]
        self.vdir = os.path.dirname(plan["words"]) + "/"
        self.k = s1kit.Kit(self.vdir, kit["brand"], kit.get("alias") or {}, kit.get("logo"))
        for n, v in (kit.get("attrs") or {}).items(): setattr(self.k, n, self.res(v))
        self.T = None

    def res(self, x):
        k = self.k
        if isinstance(x, dict):
            if "$F" in x:
                after = None if x["after"] is None else self.res(x["after"])
                v = int(k.F(x["$F"], after)) + x.get("add", 0)
                if "v" in x and v != x["v"]: raise AssertionError("F(%r) resolved to %d, recorded %d" % (x["$F"], v, x["v"]))
                return v
            if "$el" in x: return getattr(k, x["$el"])(*[self.res(a) for a in x.get("args", [])], **{n: self.res(v) for n, v in x.get("kw", {}).items()})
            return {n: self.res(v) for n, v in x.items()}
        if isinstance(x, list): return [self.res(v) for v in x]
        return x

    def root(self, name):
        return self.T if name == "T" else self.k.S if name == "S" else getattr(self.k, name)

    def walk(self, path):  # returns (container, last key)
        if len(path) == 1: return None, path[0]
        cur = self.root(path[0])
        for p in path[1:-1]: cur = cur[p]
        return cur, path[-1]

    def listat(self, path):
        cur = self.root(path[0])
        for p in path[1:]: cur = cur[p]
        return cur

    def run(self):
        k, m = self.k, self.m
        for op in self.plan["ops"]:
            if "call" in op:
                a = [self.res(x) for x in op.get("args", [])]; kw = {n: self.res(v) for n, v in op.get("kw", {}).items()}
                if op["call"] == "finish": self.T = k.finish(*a, **kw)
                elif op["call"] == "polish": self.T = m.polish(k.V, self.T, *a, **kw)
                else: getattr(k, op["call"])(*a, **kw)
            elif "set" in op:
                c, key = self.walk(op["set"]); v = self.res(op["value"])
                if c is None: setattr(k, key, v) if key in SCALARS else setattr(k, key, v)
                else: c[key] = v
            elif "del" in op:
                c, key = self.walk(op["del"]); del c[key]
            elif "insert" in op:
                lst = self.listat(op["insert"]); i = op["index"]; lst[i:i] = self.res(op["value"])
            elif "remove" in op:
                lst = self.listat(op["remove"]); i = op["index"]; del lst[i:i + op["count"]]
            elif "sfx" in op: k.sfx += [tuple(t) for t in self.res(op["sfx"])]
            elif "dims" in op:
                for g in op["dims"]: k.dims.append([k.S[si]["layers"][li] for si, li in g])
            elif "events" in op:
                p = Path(k.V) / "events.json"; e = op["events"]
                if "set" in e: ev = e["set"]
                else:
                    ev = json.load(open(p, encoding="utf-8")) + self.res(e["append"]); ev.sort(key=lambda x: x["t"])
                json.dump(ev, open(p, "w"), indent=1)
            elif op.get("write") == "timeline":
                name = Path(k.V.rstrip("/")).name
                json.dump(self.T, open(Path(k.V) / "timeline.json", "w"), indent=1)
                json.dump({"component": "style1-timeline", "format": "vertical", "fps": 30, "props": {"timeline": self.T}}, open(Path(k.V) / f"{name}.json", "w"))
            else: raise ValueError("unknown op %r" % list(op))


def check(vid, plan_path, mirror, golden):
    plan = json.loads(plan_path.read_text(encoding="utf-8"))
    if plan.get("legacy"): return "LEGACY (no Kit; nothing to replay)"
    vdir = mirror / "styles/style-1/videos" / vid
    for f in ("timeline.json", "events.json", vid + ".json"):
        if (vdir / f).exists(): (vdir / f).unlink()
    os.chdir(mirror); sys.path.insert(0, str(mirror / "styles/tools"))
    import s1kit
    import io, contextlib
    with contextlib.redirect_stdout(io.StringIO()): Replay(plan, s1kit).run()
    diffs = []
    for f in ("timeline.json", vid + ".json", "events.json"):
        a = (vdir / f).read_bytes(); b = (golden / vid / f).read_bytes()
        if a != b:
            ja, jb = json.loads(a), json.loads(b)
            diffs.append(f + (" (same JSON, different bytes)" if ja == jb else " DIFFERS"))
    return "OK" if not diffs else "DIFF: " + "; ".join(diffs)


def main():
    args = sys.argv[1:]
    def opt(name, default):
        if name in args:
            i = args.index(name); v = args[i + 1]; del args[i:i + 2]; return Path(v)
        return default
    mirror = opt("--mirror", WORKTREE / "data/s1mirror").resolve()
    plans = opt("--plans", WORKTREE / "packages/library/src/style-1/plans").resolve()
    golden = opt("--golden", WORKTREE / "data/s1golden").resolve()
    if args == ["--all"]:
        import subprocess
        bad = 0
        for p in sorted(plans.glob("*.plan.json")):
            r = subprocess.run([sys.executable, __file__, p.name.replace(".plan.json", ""), "--mirror", str(mirror), "--plans", str(plans), "--golden", str(golden)])
            bad += r.returncode != 0
        sys.exit(1 if bad else 0)
    a = args[0]; p = Path(a)
    if p.suffix == ".json": plan_path = p.resolve(); vid = plan_path.name.replace(".plan.json", "")
    else: vid = a; plan_path = plans / (a + ".plan.json")
    try: r = check(vid, plan_path, mirror, golden)
    except Exception as e: r = "ERROR: %s: %s" % (type(e).__name__, e)
    print(vid, r)
    sys.exit(0 if r.startswith(("OK", "LEGACY")) else 1)


if __name__ == "__main__":
    main()
