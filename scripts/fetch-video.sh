#!/usr/bin/env bash
set -euo pipefail

# Resolve monolith
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# Allow CONSTANTS_PATH override for testing (default: use standard path)
CONSTANTS_FILE="${CONSTANTS_PATH:-$ROOT/apps/web/src/constants/videos.ts}"

# Read source URL from TS constants via grep (no node needed)
SOURCE_URL=$(grep -oE "HERO_VIDEO_SOURCE_URL = '[^']+'" "$CONSTANTS_FILE" \
  | sed -E "s/.*'([^']+)'/\1/")

if [ -z "$SOURCE_URL" ]; then
  echo "[fetch-video] ERROR: HERO_VIDEO_SOURCE_URL not found in $CONSTANTS_FILE" >&2
  exit 1
fi

OUT="$ROOT/apps/web/public/videos/hero.mp4"
mkdir -p "$(dirname "$OUT")"

# Idempotent: file exists → skip
if [ -f "$OUT" ]; then
  SIZE=$(stat -f%z "$OUT" 2>/dev/null || stat -c%s "$OUT")
  echo "[fetch-video] already present: $OUT ($SIZE bytes)"
  exit 0
fi

echo "[fetch-video] downloading $SOURCE_URL → $OUT"
if ! curl --fail -L -o "$OUT" "$SOURCE_URL"; then
  echo "[fetch-video] FAILED to download $SOURCE_URL" >&2
  rm -f "$OUT"
  exit 1
fi

# Size threshold check
SIZE=$(stat -f%z "$OUT" 2>/dev/null || stat -c%s "$OUT")
if [ "$SIZE" -gt 26214400 ]; then  # 25MB hard fail (spec §Q5 v0.13.B.3 amended)
  echo "[fetch-video] FAIL: $SIZE bytes > 25MB threshold" >&2
  rm -f "$OUT"
  exit 1
elif [ "$SIZE" -gt 5242880 ]; then  # 5MB warn
  echo "[fetch-video] WARN: $SIZE bytes > 5MB (soft limit)" >&2
fi

echo "[fetch-video] OK: $OUT ($SIZE bytes)"
