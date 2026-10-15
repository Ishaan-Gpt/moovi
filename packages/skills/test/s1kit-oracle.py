"""Python oracle for the TypeScript s1kit port. Runs plan JSONs (same format as plan.ts) through the REAL s1kit.py in memory and
writes golden timeline/spec/events JSON (+ the words and brand it used) to fixtures/s1kit-oracle/<name>/.

Nothing is written under MotionEasy: s1kit.py is imported from a copy, its `open` and `json.dump` are patched so finish()/polish()
capture instead of writing files.

    python packages/skills/test/s1kit-oracle.py [--root <MotionEasy>] [--out <dir>] [plan.json ...]
"""
import argparse, copy, importlib.util, io, json, shutil, sys, tempfile
from pathlib import Path
from types import SimpleNamespace

HERE = Path(__file__).resolve().parent
ME = Path(r"C:\Ishaan GPT\hackthons\MotionEasy")


def load_module(root):
    tmp = Path(tempfile.mkdtemp(prefix="s1kit-copy-"))
    shutil.copy(root / "styles/tools/s1kit.py", tmp / "s1kit.py")
    spec = importlib.util.spec_from_file_location("s1kit_copy", tmp / "s1kit.py")
    m = importlib.util.module_from_spec(spec); spec.loader.exec_module(m)
    m.ROOT = root
    dumps = []
    real_open = open

    def fake_open(p, mode="r", *a, **kw):
        return io.StringIO() if any(c in mode for c in "wa+x") else real_open(p, mode, *a, **kw)
    m.open = fake_open
    m.json = SimpleNamespace(load=json.load, dump=lambda obj, fp, **kw: dumps.append(json.dumps(obj)), dumps=json.dumps)
    return m, dumps


def run(plan, root):
    m, dumps = load_module(root)
    words_path = plan["words"]
    V = str(Path(words_path).parent).replace("\\", "/") + "/"
    kc = plan["kit"]
    k = m.Kit(V, kc["brand"], alias=kc.get("alias"), logo=kc.get("logo"))
    for a, v in (kc.get("attrs") or {}).items(): setattr(k, a, v)
    ids, st = {}, {}

    def seg(cur, s):
        if isinstance(cur, list): return s
        return s

    def walk(path):
        cur = k if path[0] not in ("timeline", "events", "spec") else st[path[0]]
        for s in path[(0 if cur is k else 1):-1]:
            cur = getattr(cur, s) if (not isinstance(s, int) and not isinstance(cur, dict)) else cur[s]
        return cur, path[-1]

    def getat(path):
        cur, key = walk(path)
        return getattr(cur, key) if (not isinstance(key, int) and not isinstance(cur, dict)) else cur[key]

    def res(v):
        if isinstance(v, list): return [res(x) for x in v]
        if not isinstance(v, dict): return v
        if "$ref" in v: return ids[v["$ref"]]
        if "$id" in v: ids[v["$id"]] = res(v["value"]); return ids[v["$id"]]
        if "$path" in v: return getat(v["$path"])
        if "$F" in v: return k.F(v["$F"], None if v.get("after") is None else res(v["after"])) + v.get("add", 0)
        if "$el" in v: return getattr(k, v["$el"])(*res(v.get("args", [])), **res(v.get("kw", {})))
        return {a: res(b) for a, b in v.items()}

    for op in plan["ops"]:
        if "call" in op:
            args, kw = res(op.get("args", [])), res(op.get("kw", {}))
            if op["call"] == "finish":
                T = k.finish(*args, **kw)
                st["timeline"], st["events"] = T, json.loads(dumps[-1])
            elif op["call"] == "polish":
                m.polish(V, st["timeline"], *args, **{a: (tuple(b) if a == "blur" else b) for a, b in kw.items()})
            else:
                getattr(k, op["call"])(*args, **kw)
        elif "set" in op:
            cur, key = walk(op["set"]); val = res(op["value"])
            if isinstance(cur, (list, dict)): cur[key] = val
            else: setattr(cur, key, val)
        elif "sfx" in op: k.sfx += [tuple(s) for s in res(op["sfx"])]
        elif "events" in op:
            ev = st["events"]; ev += res(op["events"]["append"]); ev.sort(key=lambda e: e["t"])
        elif "dims" in op: k.dims.append(res(op["dims"]))
        elif "append" in op: getat(op["append"]).append(res(op["value"]))
        elif "insert" in op: getat(op["insert"]).insert(op["index"], res(op["value"]))
        else: raise SystemExit("unknown op " + str(list(op)))
    T = st["timeline"]
    spec = {"component": "style1-timeline", "format": "vertical", "fps": 30, "props": {"timeline": T}}
    return {"timeline": T, "spec": spec, "events": st["events"]}, k


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--root", default=str(ME)); ap.add_argument("--out", default=str(HERE / "fixtures/s1kit-oracle"))
    ap.add_argument("plans", nargs="*")
    a = ap.parse_args(); root = Path(a.root)
    plans = [Path(p) for p in a.plans] or sorted((HERE / "oracle-plans").glob("*.plan.json"))
    for pp in plans:
        plan = json.load(open(pp, encoding="utf-8")); name = pp.name.replace(".plan.json", "")
        out, k = run(plan, root)
        d = Path(a.out) / name; d.mkdir(parents=True, exist_ok=True)
        for key in ("timeline", "spec", "events"): (d / f"{key}.json").write_text(json.dumps(out[key], indent=1), encoding="utf-8")
        shutil.copy(root / plan["words"], d / "words.json")
        shutil.copy(root / f"styles/style-1/brands/{plan['kit']['brand']}.json", d / "brand.json")
        shutil.copy(pp, d / f"{name}.plan.json")
        print(name, "scenes", len(out["timeline"]["scenes"]), "events", len(out["events"]))


if __name__ == "__main__":
    main()
