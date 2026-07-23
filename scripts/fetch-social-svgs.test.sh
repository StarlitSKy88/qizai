#!/usr/bin/env bash
# fetch-social-svgs.sh unit tests (no vitest, pure bash — mirrors fetch-video.test.sh)
# 7 tests per v0.13.B.2 spec §六.2

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
SOCIALS_DIR="$ROOT/apps/web/public/socials"
CONSTANTS_FILE="$ROOT/apps/web/src/constants/socials.ts"
SCRIPT="$SCRIPT_DIR/fetch-social-svgs.sh"
LOG="/tmp/socials-test-$$.log"

PASS=0
FAIL=0

assert() {
  local desc="$1" expected="$2" actual="$3"
  if [ "$expected" = "$actual" ]; then
    echo "  ✅ $desc"
    PASS=$((PASS + 1))
  else
    echo "  ❌ $desc (expected: $expected, got: $actual)"
    FAIL=$((FAIL + 1))
  fi
}

cleanup() {
  rm -rf "$SOCIALS_DIR"
}
trap cleanup EXIT

# ===== Test 1: outputs 3 SVG files in apps/web/public/socials/ =====
echo "=== Test 1: outputs 3 SVG files ==="
mkdir -p "$SOCIALS_DIR"
rm -f "$SOCIALS_DIR"/*.svg "$SOCIALS_DIR"/*.tmp "$SOCIALS_DIR"/*.bak
bash "$SCRIPT" > "$LOG" 2>&1
EXIT=$?
assert "exit code 0" "0" "$EXIT"
XHS="false"; TK="false"; BILI="false"
[ -f "$SOCIALS_DIR/xiaohongshu.svg" ] && XHS="true"
[ -f "$SOCIALS_DIR/tiktok.svg" ] && TK="true"
[ -f "$SOCIALS_DIR/bilibili.svg" ] && BILI="true"
assert "xiaohongshu.svg exists" "true" "$XHS"
assert "tiktok.svg exists" "true" "$TK"
assert "bilibili.svg exists" "true" "$BILI"

# ===== Test 2: each SVG either has fill="currentColor" OR no fill attr =====
echo ""
echo "=== Test 2: fill injection correct ==="
INJECTION_OK="true"
for f in "$SOCIALS_DIR"/*.svg; do
  filename="$(basename "$f")"
  if grep -q 'fill="currentColor"' "$f"; then
    : # injection succeeded
  elif ! grep -q 'fill=' "$f"; then
    : # upstream CSS-only (no fill attr at all)
  else
    echo "  ⚠️  $filename has fill attr but NOT currentColor: $(grep -oE 'fill="[^"]*"' "$f" | head -1)"
    INJECTION_OK="false"
  fi
done
assert "all 3 SVGs use currentColor or no fill" "true" "$INJECTION_OK"

# ===== Test 3: idempotency — second run within 24h does not re-fetch =====
echo ""
echo "=== Test 3: idempotency (mtime check) ==="
MTIME_BEFORE=$(stat -f%m "$SOCIALS_DIR/xiaohongshu.svg" 2>/dev/null || stat -c%Y "$SOCIALS_DIR/xiaohongshu.svg")
sleep 2
bash "$SCRIPT" > "$LOG" 2>&1
MTIME_AFTER=$(stat -f%m "$SOCIALS_DIR/xiaohongshu.svg" 2>/dev/null || stat -c%Y "$SOCIALS_DIR/xiaohongshu.svg")
assert "mtime unchanged after re-run" "$MTIME_BEFORE" "$MTIME_AFTER"
case "$(cat "$LOG")" in
  *"cached"*) IDEMPOTENT="true" ;;
  *) IDEMPOTENT="false" ;;
esac
assert "cached log message present" "true" "$IDEMPOTENT"

# ===== Test 4: CDN unreachable → exit 0 (graceful degradation) =====
echo ""
echo "=== Test 4: CDN unreachable graceful degradation ==="
# Point CONSTANTS_PATH at a fixture with bad URLs
TMP_CONST="$(mktemp)"
cat > "$TMP_CONST" << 'EOF'
export interface SocialPlatform {
  readonly id: 'xiaohongshu' | 'tiktok' | 'bilibili';
  readonly label: string;
  readonly localSvgPath: string;
  readonly cdnSvgUrl: string;
}
export const SOCIALS: readonly SocialPlatform[] = [
  { id: 'xiaohongshu', label: '小红书', localSvgPath: '/socials/xiaohongshu.svg',
    cdnSvgUrl: 'http://127.0.0.1:1/nonexistent.svg' },
] as const;
EOF
rm -f "$SOCIALS_DIR"/*.svg
CONSTANTS_PATH="$TMP_CONST" bash "$SCRIPT" > "$LOG" 2>&1
EXIT=$?
assert "exit code 0 (graceful)" "0" "$EXIT"
rm -f "$TMP_CONST"

# ===== Test 5: no .tmp files left after run =====
echo ""
echo "=== Test 5: no .tmp residue ==="
TMP_COUNT=$(find "$SOCIALS_DIR" -name '*.tmp' 2>/dev/null | wc -l | tr -d ' ')
assert "zero .tmp files" "0" "$TMP_COUNT"

# ===== Test 6: no .bak files left after run (sed -i.bak residue) =====
echo ""
echo "=== Test 6: no .bak residue ==="
BAK_COUNT=$(find "$SOCIALS_DIR" -name '*.bak' 2>/dev/null | wc -l | tr -d ' ')
assert "zero .bak files" "0" "$BAK_COUNT"

# ===== Test 7: pnpm build produces dist/socials/*.svg + dist/_headers =====
echo ""
echo "=== Test 7: pnpm build verification ==="
# Ensure public/socials is populated before build (Test 4 cleared it with bad-URL fixture)
bash "$SCRIPT" > "$LOG" 2>&1
cd "$ROOT/apps/web"
pnpm build > "$LOG" 2>&1
BUILD_EXIT=$?
assert "pnpm build exit 0" "0" "$BUILD_EXIT"
SVG_COUNT=$(ls "$ROOT/apps/web/dist/socials/"*.svg 2>/dev/null | wc -l | tr -d ' ')
assert "dist/socials/*.svg = 3 files" "3" "$SVG_COUNT"
HEADERS_OK="false"
[ -f "$ROOT/apps/web/dist/_headers" ] && grep -q '/socials/\*' "$ROOT/apps/web/dist/_headers" && HEADERS_OK="true"
assert "dist/_headers has /socials/* rule" "true" "$HEADERS_OK"

echo ""
echo "=== Results ==="
echo "PASS: $PASS / FAIL: $FAIL"
[ "$FAIL" -eq 0 ] && exit 0 || exit 1
