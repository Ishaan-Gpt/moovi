#!/usr/bin/env python
"""s1record.py: run a Style 1 build.py with the s1kit `Kit` instrumented and write a declarative PLAN (JSON).

Usage (cwd is irrelevant; the recorder chdirs into the mirror root; NOTHING is written to MotionEasy):
    python s1record.py <video-id> [--mirror <root>] [--plans <dir>] [--golden <dir>]
    python s1record.py --all      [same options]      (one subprocess per video that has a build.py)
Defaults: mirror = <worktree>/data/s1mirror, plans = <worktree>/packages/library/src/style-1/plans,
golden = <worktree>/data/s1golden. Python outputs (timeline.json, <id>.json, events.json) are copied to <golden>/<id>/.

PLAN FORMAT (one op per line in the file)
{ "video": "ce-11-hormozi-style",
  "kit":   { "brand": "captionseasy", "alias": {"30": "tees"}, "logo": null, "attrs": {"FONT": "bricolage"} },
  "words": "styles/style-1/videos/ce-11-hormozi-style/words.json",
  "ops":   [ ... ] }
  kit.attrs  = scalar Kit attributes (FONT, LOGO, INK, ACC, BG) assigned before the first call. Kit(video_dir, brand, alias, logo)
               is constructed with video_dir = dirname(words) + "/".
Ops, applied in order against one Kit `k`:
  {"call": "<preset>", "args": [..], "kw": {..}}   preset: lines list_left stack_slam logo_land icon_ring trio grid4 export_proof
                                                   reveal cta_comment cta_pill, and "finish" (writes timeline.json/<id>.json/events.json
                                                   and keeps the returned timeline T) and "polish" (kw only; V and T are implicit).
                                                   "args"/"kw" are omitted when empty.
  {"set": [path..], "value": v}                    assign. path root: "S" (k.S scenes; -1 = last scene), "T" (timeline returned by
                                                   finish), "B" (brand dict), "alias", or a scalar attr ("FONT","LOGO","INK","ACC","BG",
                                                   "_cursor"; path is just that name). Intermediate steps are dict keys / list indices.
  {"del": [path..]}                                delete a dict key
  {"insert": [path..], "index": i, "value": [items]}   list[i:i] = items        (path points at a list)
  {"remove": [path..], "index": i, "count": n}         del list[i:i+n]
  {"sfx": [ [scene, when, event, sound?], .. ]}    k.sfx += tuples (when = spoken word | "@f:<frame>" | "@f0" | "@last")
  {"dims": [ [ [scene_idx, layer_idx], .. ] ]}     k.dims.append(group) for build-made groups; refs are absolute indices into k.S
  {"events": {"append": [ev..]}}                   load events.json, append, stable-sort by "t", write (json indent=1)
  {"events": {"set": [ev..]}}                      fallback: replace the whole list (only if append+sort cannot express it)
  {"write": "timeline"}                            write T to timeline.json (indent=1) and <id>.json (compact, style1-timeline wrapper),
                                                   for builds that dump the timeline themselves after editing it in place.
Values (anywhere inside args / kw / value / sfx):
  {"$F": "bade", "after": null|int|<$F>, "add": -6, "v": 123}
        = k.F(word, after) + add. after=null means "the kit cursor at the moment this op runs" (the recorder emits an explicit int
        whenever the cursor differed when the build evaluated F). "v" is the resolved frame in the Python run (a self-check; additive,
        consumers may ignore it). *, /, dict-key use, string formatting etc. resolve to plain ints/strings.
  {"$el": "phone", "args": [..], "kw": {..}}
        = k.<helper>(*args, **kw) where helper is one of ln serif accent card look phone icon mark burst win at_px browser mark_hl
        logo_grid. A helper result that the build mutated before using it is emitted as a plain dict instead.
  plain JSON otherwise (tuples become lists).
Legacy builds that do not use Kit (ce-01..ce-04) get { "video", "kit": null, "legacy": true, "words", "ops": [] }.
"""
import copy, inspect, io, json, os, runpy, shutil, subprocess, sys, contextlib
from collections import Counter
from difflib import SequenceMatcher
from pathlib import Path

HERE = Path(__file__).resolve().parent
WORKTREE = HERE.parents[2]
HELPERS = ["ln", "serif", "accent", "card", "look", "phone", "icon", "mark", "burst", "win", "at_px", "browser", "mark_hl", "logo_grid"]
PRESETS = ["lines", "list_left", "stack_slam", "logo_land", "icon_ring", "trio", "grid4", "export_proof", "reveal", "cta_comment", "cta_pill"]
SCALARS = ["FONT", "LOGO", "INK", "ACC", "BG", "_cursor"]


def pj(x):  # plain-JSON snapshot (tags and tuples flattened)
    return json.loads(json.dumps(x))


# ── tagged values ───────────────────────────────────────────────────────────────────────────────────────────────
class Fr(int):
    """A frame number that remembers k.F(word, after) (+ accumulated integer offset)."""
    def __new__(cls, v, word, after, cursor, add=0):
        o = int.__new__(cls, v); o.word = word; o.after = after; o.cursor = cursor; o.add = add
        return o
    def __deepcopy__(self, memo): return self
    def __copy__(self): return self
    def _shift(self, n): return Fr(int(self) + n, self.word, self.after, self.cursor, self.add + n)
    def __add__(self, o): return self._shift(o) if type(o) is int else int.__add__(self, o)
    __radd__ = __add__
    def __sub__(self, o): return self._shift(-o) if type(o) is int else int.__sub__(self, o)


class ElDict(dict): pass
class ElList(list): pass
class ElTuple(tuple): pass


def freeze(x):
    if isinstance(x, (ElDict, ElList, ElTuple, Fr)): return x
    if isinstance(x, dict): return {k: freeze(v) for k, v in x.items()}
    if isinstance(x, (list, tuple)): return [freeze(v) for v in x]
    return x


def tag_el(res, name, a, kw):
    cls = ElDict if isinstance(res, dict) else ElList if isinstance(res, list) else ElTuple if isinstance(res, tuple) else None
    if cls is None: return res
    o = cls(res); o._call = (name, freeze(a), freeze(kw)); o._snap = pj(o)
    return o


def ser(x, cur):
    """Live value -> plan JSON. `cur` = kit cursor when the consuming op executes (decides after:null vs explicit)."""
    if x is None or isinstance(x, (bool, str)): return x
    if isinstance(x, Fr):
        if x.after is None: after = None if x.cursor == cur else int(x.cursor)
        else: after = ser(x.after, cur)
        return {"$F": x.word, "after": after, "add": x.add, "v": int(x)}
    if isinstance(x, int): return int(x)
    if isinstance(x, float): return float(x)
    if isinstance(x, (ElDict, ElList, ElTuple)) and pj(x) == x._snap:
        n, a, kw = x._call
        return {"$el": n, "args": [ser(i, cur) for i in a], "kw": {k: ser(v, cur) for k, v in kw.items()}}
    if isinstance(x, dict):
        assert all(isinstance(k, str) for k in x), "non-string dict key %r" % list(x)
        return {k: ser(v, cur) for k, v in x.items()}
    if isinstance(x, (list, tuple)): return [ser(v, cur) for v in x]
    raise TypeError("cannot serialise %r" % type(x))


# ── generic JSON diff -> set/del/insert/remove ops ──────────────────────────────────────────────────────────────
def diff(path, old, live, new, out, cur):
    if old == new: return
    if isinstance(old, dict) and isinstance(new, dict):
        for k in old:
            if k not in new: out.append({"del": path + [k]})
        for k in new:
            if k not in old: out.append({"set": path + [k], "value": ser(live[k], cur)})
            elif old[k] != new[k]: diff(path + [k], old[k], live[k], new[k], out, cur)
    elif isinstance(old, list) and isinstance(new, list):
        if len(old) == len(new):
            for i in range(len(old)):
                if old[i] != new[i]: diff(path + [i], old[i], live[i], new[i], out, cur)
        else:
            sm = SequenceMatcher(None, [json.dumps(x, sort_keys=True) for x in old], [json.dumps(x, sort_keys=True) for x in new], autojunk=False)
            for tg, i1, i2, j1, j2 in reversed(sm.get_opcodes()):
                if tg == "equal": continue
                if i2 > i1: out.append({"remove": path, "index": i1, "count": i2 - i1})
                if j2 > j1: out.append({"insert": path, "index": i1, "value": [ser(live[j], cur) for j in range(j1, j2)]})
    else:
        out.append({"set": path, "value": ser(live, cur)})


def scene_neg(ops, nscenes):
    for op in ops:
        for key in ("set", "del", "insert", "remove"):
            if key in op and op[key][0] == "S" and len(op[key]) >= 2 and op[key][1] == nscenes - 1: op[key][1] = -1
    return ops


# ── recorder ────────────────────────────────────────────────────────────────────────────────────────────────────
class Recorder:
    def __init__(s):
        s.ops, s.kit, s.depth, s.ncalls = [], None, 0, 0
        s.attrs, s.known, s.keep = {}, set(), []
        s.T = s.Tsnap = s.disk_T = s.ev_known = s.snap = None
        s.header = None; s.vdir = None

    def emit(s, op): s.ops.append(op)

    def state(s, k): return {"S": k.S, "sfx": k.sfx, "B": k.B, "alias": k.alias, **{n: getattr(k, n) for n in SCALARS}}

    def begin(s, k, video_dir, brand, alias, logo):
        s.kit = k; s.vdir = video_dir
        s.header = {"brand": brand, "alias": dict(alias or {}), "logo": logo}
        s.snap = pj(s.state(k))

    def events_path(s): return Path(s.kit.V) / "events.json"

    def read_events(s):
        p = Path(s.kit.V) / "events.json"
        return json.load(open(p, encoding="utf-8")) if p.exists() else None

    def boundary(s, final=False):
        k = s.kit; live = s.state(k); new = pj(live); old = s.snap
        cur0, cur1 = old["_cursor"], k._cursor
        for n in SCALARS:
            if new[n] != old[n]:
                v = ser(live[n], cur0)
                if s.ncalls == 0 and n != "_cursor": s.attrs[n] = v
                else: s.emit({"set": [n], "value": v})
        for n in ("B", "alias"):
            out = []; diff([n], old[n], live[n], new[n], out, cur1); s.ops.extend(out)
        if not (s.T is not None and s.T.get("scenes") is k.S):  # after finish() S is T["scenes"]: the "T" ops cover it
            out = []; diff(["S"], old["S"], live["S"], new["S"], out, cur1); s.ops.extend(scene_neg(out, len(k.S)))
        if new["sfx"] != old["sfx"]:
            n = len(old["sfx"])
            if new["sfx"][:n] == old["sfx"]: s.emit({"sfx": [ser(t, cur1) for t in k.sfx[n:]]})
            else: s.emit({"set": ["sfx"], "value": ser(k.sfx, cur1)})
        s.resolve_dims()
        s.snap = new
        if s.T is not None and not final:
            tn = pj(s.T); out = []; diff(["T"], s.Tsnap, s.T, tn, out, cur1); s.ops.extend(out); s.Tsnap = tn
        if s.ev_known is not None:
            evn = s.read_events(); op = ev_op(s.ev_known, evn)
            if op: s.emit(op)
            s.ev_known = evn

    def resolve_dims(s):
        k = s.kit
        for g in k.dims:
            if id(g) in s.known: continue
            refs = []
            for el in g:
                loc = next(([si, li] for si, sc in enumerate(k.S) for li, L in enumerate(sc["layers"]) if L is el), None)
                if loc is None: break
                refs.append(loc)
            else:
                s.emit({"dims": [refs]}); s.known.add(id(g)); s.keep.append(g)

    def call(s, name, a, kw, fn):
        k = s.kit
        s.boundary()
        before = {id(g) for g in k.dims}
        op = {"call": name}
        if a: op["args"] = [ser(x, k._cursor) for x in a]
        if kw: op["kw"] = {n: ser(v, k._cursor) for n, v in kw.items()}
        s.emit(op); s.ncalls += 1
        s.depth += 1
        try: res = fn()
        finally: s.depth -= 1
        for g in k.dims:
            if id(g) not in before: s.known.add(id(g)); s.keep.append(g)
        s.snap = pj(s.state(k))
        s.resolve_dims()
        return res

    def after_T(s, T):
        s.T = T; s.Tsnap = pj(T); s.disk_T = s.Tsnap; s.ev_known = s.read_events(); s.snap = pj(s.state(s.kit))

    def finalize(s, id_):
        k = s.kit
        s.boundary(final=True)
        unresolved = [g for g in k.dims if id(g) not in s.known]
        assert not unresolved, "dims group refers to elements that are not in any scene"
        if s.T is not None:
            tpath = Path(k.V) / "timeline.json"; ftl = json.load(open(tpath, encoding="utf-8"))
            if ftl != s.disk_T:
                out = []; tn = pj(s.T); diff(["T"], s.Tsnap, s.T, tn, out, k._cursor); s.ops.extend(out); s.emit({"write": "timeline"}); s.Tsnap = tn
                assert ftl == tn, "timeline.json on disk differs from live T"
            idj = Path(k.V) / (Path(k.V.rstrip("/")).name + ".json")
            exp = {"component": "style1-timeline", "format": "vertical", "fps": 30, "props": {"timeline": ftl}}
            assert json.load(open(idj, encoding="utf-8")) == exp, "<id>.json differs from the standard wrapper of timeline.json"


def ev_op(old, new):
    if new == old: return None
    rem = Counter(json.dumps(e, sort_keys=True) for e in old); app = []
    for e in new:
        key = json.dumps(e, sort_keys=True)
        if rem[key] > 0: rem[key] -= 1
        else: app.append(e)
    if sum(rem.values()) == 0 and sorted(old + app, key=lambda e: e["t"]) == new: return {"events": {"append": app}}
    return {"events": {"set": new}}


R = Recorder()


def install(s1kit):
    base = s1kit.Kit

    class RecKit(base):
        def __init__(self, video_dir, brand, alias=None, logo=None):
            R.depth += 1
            try: base.__init__(self, video_dir, brand, alias, logo)
            finally: R.depth -= 1
            R.begin(self, video_dir, brand, alias, logo)

    def mk_helper(name):
        fn = getattr(base, name)
        def f(self, *a, **kw):
            top = R.depth == 0
            R.depth += 1
            try: res = fn(self, *a, **kw)
            finally: R.depth -= 1
            return tag_el(res, name, a, kw) if top else res
        return f

    def mk_preset(name):
        fn = getattr(base, name)
        def f(self, *a, **kw):
            if R.depth: return fn(self, *a, **kw)
            return R.call(name, a, kw, lambda: fn(self, *a, **kw))
        return f

    def F(self, word, after=None):
        top, cur = R.depth == 0, self._cursor
        R.depth += 1
        try: v = base.F(self, word, after)
        finally: R.depth -= 1
        return Fr(v, word, after, cur) if top else v

    def finish(self, *a, **kw):
        T = R.call("finish", a, kw, lambda: base.finish(self, *a, **kw))
        R.after_T(T)
        return T

    for n in HELPERS: setattr(RecKit, n, mk_helper(n))
    for n in PRESETS: setattr(RecKit, n, mk_preset(n))
    RecKit.F = F; RecKit.finish = finish
    s1kit.Kit = RecKit

    orig_polish = s1kit.polish; sig = inspect.signature(orig_polish)

    def polish(V, T, *a, **kw):
        bound = sig.bind(V, T, *a, **kw)
        extra = {n: v for n, v in bound.arguments.items() if n not in ("V", "T")}
        assert V.rstrip("/") + "/" == R.kit.V, "polish() on another video dir"
        R.T = T  # builds hand over the finish() timeline; in-place edits since finish() become ops now
        R.boundary()
        R.emit({"call": "polish", **({"kw": {n: ser(v, R.kit._cursor) for n, v in extra.items()}} if extra else {})}); R.ncalls += 1
        res = orig_polish(V, T, *a, **kw)
        R.after_T(T)
        return res
    s1kit.polish = polish


def record(vid, mirror, plans, golden):
    mirror = Path(mirror).resolve(); vdir = mirror / "styles/style-1/videos" / vid
    rel = "styles/style-1/videos/%s/" % vid
    words = rel + "words.json"
    src = (vdir / "build.py").read_text(encoding="utf-8")
    os.makedirs(golden / vid, exist_ok=True); os.makedirs(plans, exist_ok=True)
    plan_path = plans / (vid + ".plan.json")
    if "Kit(" not in src:  # legacy self-contained pipeline: nothing to record
        plan = {"video": vid, "kit": None, "legacy": True, "words": words, "ops": []}
        plan_path.write_text(json.dumps(plan, ensure_ascii=False) + "\n", encoding="utf-8")
        for f in vdir.iterdir():
            if f.name in ("timeline.json", "events.json") or (f.suffix == ".json" and f.stem.startswith("ce-") and not f.name.endswith(".qa.json")):
                shutil.copy2(f, golden / vid / f.name)
        print("LEGACY", vid); return
    os.chdir(mirror); sys.path.insert(0, str(mirror / "styles/tools"))
    for f in ("timeline.json", "events.json", vid + ".json"):
        p = vdir / f
        if p.exists(): p.unlink()
    import s1kit
    assert Path(s1kit.__file__).resolve().is_relative_to(mirror), "s1kit not loaded from the mirror"
    install(s1kit)
    buf = io.StringIO()
    with contextlib.redirect_stdout(buf):
        runpy.run_path(str(vdir / "build.py"), run_name="__main__")
    R.finalize(vid)
    plan = {"video": vid, "kit": {**R.header, "attrs": R.attrs}, "words": words, "ops": R.ops}
    with open(plan_path, "w", encoding="utf-8", newline="\n") as f:
        head = {k: v for k, v in plan.items() if k != "ops"}
        f.write("{" + ", ".join("%s: %s" % (json.dumps(k), json.dumps(v, ensure_ascii=False)) for k, v in head.items()) + ',\n "ops": [\n')
        f.write(",\n".join("  " + json.dumps(o, ensure_ascii=False) for o in R.ops) + "\n ]}\n")
    for fn in ("timeline.json", vid + ".json", "events.json"):
        shutil.copy2(vdir / fn, golden / vid / fn)
    print("OK", vid, "ops", len(R.ops), "| build said:", buf.getvalue().strip().splitlines()[-1] if buf.getvalue().strip() else "")


def main():
    args = sys.argv[1:]
    def opt(name, default):
        if name in args:
            i = args.index(name); v = args[i + 1]; del args[i:i + 2]; return Path(v)
        return default
    mirror = opt("--mirror", WORKTREE / "data/s1mirror")
    plans = opt("--plans", WORKTREE / "packages/library/src/style-1/plans")
    golden = opt("--golden", WORKTREE / "data/s1golden")
    if args == ["--all"]:
        rc = 0
        for d in sorted((mirror / "styles/style-1/videos").iterdir()):
            if (d / "build.py").exists():
                r = subprocess.run([sys.executable, __file__, d.name, "--mirror", str(mirror), "--plans", str(plans), "--golden", str(golden)])
                if r.returncode: rc = 1; print("FAIL", d.name)
        sys.exit(rc)
    record(args[0], mirror, plans, golden)


if __name__ == "__main__":
    main()
