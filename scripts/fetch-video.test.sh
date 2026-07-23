#!/usr/bin/env bash
# fetch-video.sh 单元测试（不依赖 vitest，纯 bash）
set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
TEST_DIR="$ROOT/apps/web/public/videos"
REAL_CONSTANTS="$ROOT/apps/web/src/constants/videos.ts"

PASS=0
FAIL=0

assert() {
  local desc="$1"
  local expected="$2"
  local actual="$3"
  if [ "$expected" = "$actual" ]; then
    echo "  ✅ $desc"
    PASS=$((PASS + 1))
  else
    echo "  ❌ $desc (expected: $expected, got: $actual)"
    FAIL=$((FAIL + 1))
  fi
}

cleanup() {
  rm -f "$TEST_DIR/hero.mp4"
}
trap cleanup EXIT

echo "=== Test 1: fetch-video.sh creates hero.mp4 (real download with small test URL) ==="
mkdir -p "$TEST_DIR"
rm -f "$TEST_DIR/hero.mp4"

# Create temp constants with small test URL (w3schools sample ~788KB)
TEMP_CONST=$(mktemp)
cat > "$TEMP_CONST" << 'EOFCONST'
export const HERO_VIDEO_SOURCE_URL = 'https://www.w3schools.com/html/mov_bbb.mp4';
export const HERO_VIDEO_LOCAL_URL = '/videos/hero.mp4';
export const HERO_VIDEO_WARN_SIZE = 5 * 1024 * 1024;
export const HERO_VIDEO_MAX_SIZE = 10 * 1024 * 1024;
EOFCONST

CONSTANTS_PATH="$TEMP_CONST" bash "$SCRIPT_DIR/fetch-video.sh" > /tmp/fetch-output.txt 2>&1
EXIT=$?
rm -f "$TEMP_CONST"

assert "exit code 0" "0" "$EXIT"
assert "hero.mp4 exists" "true" "$([ -f "$TEST_DIR/hero.mp4" ] && echo true || echo false)"
SIZE=$(stat -f%z "$TEST_DIR/hero.mp4" 2>/dev/null || stat -c%s "$TEST_DIR/hero.mp4")
[ "$SIZE" -gt 1000 ] && SIZE_OK="true" || SIZE_OK="false"
assert "hero.mp4 size > 1KB (real download)" "true" "$SIZE_OK"

echo ""
echo "=== Test 2: idempotent — re-running skips download ==="
bash "$SCRIPT_DIR/fetch-video.sh" > /tmp/fetch-output2.txt 2>&1
LOG_AFTER=$(tail -1 /tmp/fetch-output2.txt)
case "$LOG_AFTER" in
  *"already present"*) IDEMPOTENT_OK="true" ;;
  *) IDEMPOTENT_OK="false" ;;
esac
assert "idempotent message" "true" "$IDEMPOTENT_OK"

echo ""
echo "=== Test 3: curl failure exits 1 (bad URL via CONSTANTS_PATH) ==="
rm -f "$TEST_DIR/hero.mp4"

# Create temp constants with invalid URL (port 1 is unreachable)
TEMP_CONST=$(mktemp)
cat > "$TEMP_CONST" << 'EOFCONST'
export const HERO_VIDEO_SOURCE_URL = 'http://127.0.0.1:1/nonexistent.mp4';
export const HERO_VIDEO_LOCAL_URL = '/videos/hero.mp4';
export const HERO_VIDEO_WARN_SIZE = 5 * 1024 * 1024;
export const HERO_VIDEO_MAX_SIZE = 10 * 1024 * 1024;
EOFCONST

CONSTANTS_PATH="$TEMP_CONST" bash "$SCRIPT_DIR/fetch-video.sh" > /tmp/fetch-threshold.txt 2>&1
EXIT=$?
rm -f "$TEMP_CONST"

assert "exit code 1 on curl failure" "1" "$EXIT"
case "$(cat /tmp/fetch-threshold.txt)" in
  *"FAILED"*) THRESHOLD_OK="true" ;;
  *) THRESHOLD_OK="false" ;;
esac
assert "FAILED message present" "true" "$THRESHOLD_OK"

echo ""
echo "=== Results ==="
echo "PASS: $PASS / FAIL: $FAIL"
[ "$FAIL" -eq 0 ] && exit 0 || exit 1
