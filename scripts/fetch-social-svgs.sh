#!/usr/bin/env bash
# fetch-social-svgs.sh — v0.13.B.2 build-time SVG fetcher (spec §五.1)
# Mirrors scripts/fetch-video.sh patterns (CONSTANTS_PATH override, strict mode).
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# Allow CONSTANTS_PATH override for testing (default: standard path)
CONSTANTS_FILE="${CONSTANTS_PATH:-$ROOT/apps/web/src/constants/socials.ts}"

if [ ! -f "$CONSTANTS_FILE" ]; then
  echo "[socials] ERROR: $CONSTANTS_FILE not found" >&2
  exit 1
fi

# Read cdnSvgUrl values from constants via grep (single source of truth)
# Use while/read instead of mapfile for bash 3.2 compatibility (macOS default)
URLS=()
while IFS= read -r url; do
  URLS+=("$url")
done < <(grep -oE "cdnSvgUrl: '[^']+'" "$CONSTANTS_FILE" \
  | sed -E "s/.*'([^']+)'/\1/")

if [ "${#URLS[@]}" -eq 0 ]; then
  echo "[socials] ERROR: no cdnSvgUrl found in $CONSTANTS_FILE" >&2
  exit 1
fi

OUT_DIR="$ROOT/apps/web/public/socials"
mkdir -p "$OUT_DIR"

# Cache TTL: 24 hours (spec §五.1 mtime)
CACHE_TTL=86400
EXIT_CODE=0

for url in "${URLS[@]}"; do
  # Extract filename from URL (e.g. .../xiaohongshu.svg → xiaohongshu.svg)
  filename=$(basename "$url")
  out_path="$OUT_DIR/$filename"

  # Idempotency: skip if file exists and < 24h old (mtime check, macOS/Linux portable)
  if [ -f "$out_path" ]; then
    MTIME=$(stat -f%m "$out_path" 2>/dev/null || stat -c%Y "$out_path")
    NOW=$(date +%s)
    AGE=$((NOW - MTIME))
    if [ "$AGE" -lt "$CACHE_TTL" ]; then
      echo "[socials] cached: $filename ($AGE seconds old)"
      continue
    fi
  fi

  echo "[socials] fetching: $url → $out_path"
  tmp_path="$out_path.tmp"
  if ! curl --fail --silent --show-error --location "$url" -o "$tmp_path"; then
    echo "[socials] WARN: $url unreachable; skipping (graceful degradation, spec §五)" >&2
    rm -f "$tmp_path"
    EXIT_CODE=0  # Spec: exit 0 even on partial failures (don't block dev/build)
    continue
  fi

  # simple-icons v13+ ships CSS-only SVG (no fill attribute).
  # Inject fill="currentColor" into root <svg> tag via single-quoted sed (no escape issues).
  sed -i.bak 's|<svg |<svg fill="currentColor" |' "$tmp_path"
  rm -f "$tmp_path.bak"

  # Move to final location
  mv "$tmp_path" "$out_path"

  # Verify injection (spec §六.2 Test 2 OR logic)
  if grep -q 'fill="currentColor"' "$out_path" || ! grep -q 'fill=' "$out_path"; then
    echo "[socials] OK: $filename"
  else
    echo "[socials] WARN: $filename sed injection may have failed" >&2
  fi
done

exit "$EXIT_CODE"
