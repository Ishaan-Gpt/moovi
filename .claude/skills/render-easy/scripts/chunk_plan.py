#!/usr/bin/env python3
"""Plan a render split into chunks for parallel machines.

Prints each chunk's frame range, start time and output name, plus the ffmpeg
concat list for joining the chunks without re-encoding.

Example:
    python chunk_plan.py --duration 30 --fps 24 --chunk-seconds 6
"""
import argparse
import json


def plan(duration: float, fps: int, chunk_seconds: float):
    total = round(duration * fps)
    per_chunk = max(1, round(chunk_seconds * fps))
    chunks = []
    start = 0
    index = 0
    while start < total:
        end = min(start + per_chunk, total)  # exclusive
        chunks.append({
            "chunk": index,
            "first_frame": start,
            "last_frame": end - 1,
            "frames": end - start,
            "start_time_s": round(start / fps, 6),
            "output": f"chunk-{index:02d}.mp4",
        })
        start = end
        index += 1
    return total, chunks


def main():
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--duration", type=float, required=True, help="clip length in seconds")
    p.add_argument("--fps", type=int, required=True)
    p.add_argument("--chunk-seconds", type=float, default=6.0)
    p.add_argument("--json", action="store_true", help="print the plan as JSON")
    a = p.parse_args()

    total, chunks = plan(a.duration, a.fps, a.chunk_seconds)
    if a.json:
        print(json.dumps({"total_frames": total, "fps": a.fps, "chunks": chunks}, indent=2))
        return

    print(f"Total frames: {total} at {a.fps} fps, {len(chunks)} chunks\n")
    for c in chunks:
        print(f"chunk {c['chunk']:>2}: frames {c['first_frame']}-{c['last_frame']} "
              f"({c['frames']} frames), starts at t={c['start_time_s']}s -> {c['output']}")
    print("\nchunks.txt for: ffmpeg -f concat -safe 0 -i chunks.txt -c copy final.mp4")
    for c in chunks:
        print(f"file '{c['output']}'")


if __name__ == "__main__":
    main()
