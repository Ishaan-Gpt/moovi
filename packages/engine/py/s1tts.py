"""Script → voice with word timings in one pass (edge-tts WordBoundary events; no speech-to-text step).
Usage: python s1tts.py <dir> [--voice en-IN-PrabhatNeural] [--rate +8%]
Reads <dir>/script.txt (lines starting with # are notes), writes <dir>/vo.wav (44.1 kHz mono) and <dir>/words.json
([{word, t, end}] in seconds, the shape the kit reads). Prints the seconds it took."""
import asyncio, json, subprocess, sys, time
from pathlib import Path

import edge_tts


async def main(d: Path, voice: str, rate: str):
    text = " ".join(l.strip() for l in (d / "script.txt").read_text(encoding="utf-8").splitlines() if l.strip() and not l.lstrip().startswith("#"))
    mp3, words = d / "vo.mp3", []
    com = edge_tts.Communicate(text, voice, rate=rate, boundary="WordBoundary")
    with open(mp3, "wb") as f:
        async for ch in com.stream():
            if ch["type"] == "audio":
                f.write(ch["data"])
            elif ch["type"] == "WordBoundary":
                t = ch["offset"] / 1e7
                words.append({"word": ch["text"], "t": round(t, 3), "end": round(t + ch["duration"] / 1e7, 3)})
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", str(mp3), "-ar", "44100", "-ac", "1", str(d / "vo.wav")], check=True)
    # edge-tts reports words without their punctuation; give it back from the script so the kit's line text matches
    toks = text.split()
    norm = lambda w: "".join(c for c in w.lower() if c.isalnum())
    j = 0
    for w in words:
        for k in range(j, min(j + 4, len(toks))):
            if norm(toks[k]) == norm(w["word"]):
                w["word"], j = toks[k], k + 1
                break
    (d / "words.json").write_text(json.dumps(words, indent=1, ensure_ascii=False), encoding="utf-8")
    return len(words), words[-1]["end"] if words else 0


if __name__ == "__main__":
    a = sys.argv[1:]
    opt = lambda k, v: a[a.index(k) + 1] if k in a else v
    t0 = time.time()
    n, dur = asyncio.run(main(Path(a[0]), opt("--voice", "en-IN-PrabhatNeural"), opt("--rate", "+8%")))
    print(json.dumps({"words": n, "duration_s": dur, "seconds": round(time.time() - t0, 2)}))
