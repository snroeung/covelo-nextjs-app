#!/usr/bin/env bash
#
# Record the home-page feature panels as GIFs.
#
#   scripts/record-home-gifs.sh            # record all five
#   scripts/record-home-gifs.sh --grep search   # just one (passes through to Playwright)
#
# Drives real flows with the existing e2e helpers (e2e/home-gifs/record-home-gifs.spec.ts,
# gated behind RECORD_GIFS=1), recording each to a .webm, then converts every .webm to
# public/home/<name>.gif with ffmpeg. Needs a local dev env with live API keys — the same
# .env/.env.local the e2e suite uses — plus ffmpeg on PATH.
#
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

RAW_DIR="$ROOT/public/home/_raw"
OUT_DIR="$ROOT/public/home"
FPS="${GIF_FPS:-12}"
WIDTH="${GIF_WIDTH:-720}"
NAMES=(search compare reports trip board)

if ! command -v ffmpeg >/dev/null 2>&1; then
  echo "ffmpeg not found — install it first:  brew install ffmpeg" >&2
  exit 1
fi

mkdir -p "$RAW_DIR" "$OUT_DIR"
rm -f "$RAW_DIR"/*.webm

echo "==> recording flows with Playwright (RECORD_GIFS=1)…"
RECORD_GIFS=1 GIF_RAW_DIR="$RAW_DIR" \
  npx playwright test e2e/home-gifs/record-home-gifs.spec.ts --project=chromium "$@"

echo "==> converting webm → gif (fps=$FPS, width=$WIDTH)…"
made=0
for name in "${NAMES[@]}"; do
  src="$RAW_DIR/$name.webm"
  if [ ! -f "$src" ]; then
    echo "  skip $name — no recording produced"
    continue
  fi
  pal="$RAW_DIR/$name.palette.png"
  out="$OUT_DIR/$name.gif"
  # Two-pass palette for clean colour; -1 keeps aspect ratio.
  ffmpeg -y -loglevel error -i "$src" \
    -vf "fps=$FPS,scale=$WIDTH:-1:flags=lanczos,palettegen=stats_mode=diff" "$pal"
  ffmpeg -y -loglevel error -i "$src" -i "$pal" \
    -lavfi "fps=$FPS,scale=$WIDTH:-1:flags=lanczos,paletteuse=dither=bayer:bayer_scale=3:diff_mode=rectangle" \
    "$out"
  rm -f "$pal"
  echo "  made $out ($(du -h "$out" | cut -f1 | tr -d ' '))"
  made=$((made + 1))
done

rm -f "$RAW_DIR"/*.webm
rmdir "$RAW_DIR" 2>/dev/null || true

echo "==> done — $made gif(s) in public/home/"
if [ "$made" -eq 0 ]; then
  echo "    nothing recorded. Check the dev server, .env.local keys, and that the seeds ran" >&2
  echo "    (npm run seed:local-admin / seed:local-member)." >&2
  exit 1
fi
