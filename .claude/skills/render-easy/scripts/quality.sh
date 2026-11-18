#!/usr/bin/env bash
# Compare a candidate render against the baseline render.
# Prints average PSNR (dB) and SSIM over all frames.
# Usage: bash quality.sh baseline.mp4 candidate.mp4
set -euo pipefail
if [ $# -ne 2 ]; then
  echo "Usage: bash quality.sh baseline.mp4 candidate.mp4" >&2
  exit 1
fi
base="$1"; cand="$2"

psnr=$(ffmpeg -hide_banner -nostats -i "$cand" -i "$base" \
  -lavfi "[0:v]setpts=PTS-STARTPTS[a];[1:v]setpts=PTS-STARTPTS[b];[a][b]psnr" -f null - 2>&1 \
  | grep -o 'average:[0-9.inf]*' | tail -1 | cut -d: -f2)
ssim=$(ffmpeg -hide_banner -nostats -i "$cand" -i "$base" \
  -lavfi "[0:v]setpts=PTS-STARTPTS[a];[1:v]setpts=PTS-STARTPTS[b];[a][b]ssim" -f null - 2>&1 \
  | grep -o 'All:[0-9.]*' | tail -1 | cut -d: -f2)

echo "PSNR average: ${psnr:-unknown} dB"
echo "SSIM all:     ${ssim:-unknown}"
