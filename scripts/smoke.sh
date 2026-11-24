#!/usr/bin/env bash
# =============================================================================
# End-to-end smoke test for the AI Road Damage Detection stack.
#
# Prerequisites (see README.md):
#   1. AI service running   (cd ai-service && uvicorn app.main:app --port 8000)
#   2. Backend running      (cd backend && npm run dev)  — DATA_MODE=demo is fine
#   3. (optional) frontend  — not required for this script
#
# Usage: bash scripts/smoke.sh [backend-url]   (default http://127.0.0.1:5000)
# =============================================================================
set -euo pipefail

BASE_URL="${1:-http://127.0.0.1:5000}"
API="$BASE_URL/api/v1"
EMAIL="smoke-$(date +%s)@example.com"
PASSWORD="smokepass123"
TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT

pass() { echo "  ✓ $1"; }
fail() { echo "  ✗ $1" >&2; exit 1; }

echo "== AI Road Damage Detection — smoke test against $BASE_URL"

# --- 1. Health -------------------------------------------------------------
echo "-- Health"
HEALTH="$(curl -sf "$API/health")" || fail "GET /api/v1/health unreachable"
echo "$HEALTH" | grep -q '"status"' || fail "health payload missing status"
pass "health endpoint responds"

# --- 2. Register + login ---------------------------------------------------
echo "-- Auth"
REGISTER="$(curl -sf -X POST "$API/auth/register" \
  -H 'Content-Type: application/json' \
  -d "{\"name\":\"Smoke Tester\",\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\"}")" \
  || fail "register failed"
TOKEN="$(echo "$REGISTER" | python3 -c 'import json,sys; print(json.load(sys.stdin)["data"]["token"])')" \
  || fail "no token in register response"
pass "registered and obtained JWT"

curl -sf "$API/auth/me" -H "Authorization: Bearer $TOKEN" > /dev/null || fail "GET /auth/me failed"
pass "authenticated profile access"

# --- 3. Image analysis (real multipart upload → AI service) -----------------
echo "-- Analysis workflow"
python3 - "$TMP_DIR/road.png" <<'PYEOF'
import struct, sys, zlib
# Build a tiny but valid PNG (dark road-like gradient) without dependencies.
w, h = 240, 160
rows = b''
for y in range(h):
    row = b'\x00'
    for x in range(w):
        shade = 60 + (x * 40) // w + (y * 25) // h
        if 60 <= x < 120 and 50 <= y < 90:
            shade = 30  # dark pothole-like blob
        row += bytes([shade, shade, shade])
    rows += row

def chunk(tag, data):
    return struct.pack('>I', len(data)) + tag + data + struct.pack('>I', zlib.crc32(tag + data) & 0xffffffff)

png = b'\x89PNG\r\n\x1a\n'
png += chunk(b'IHDR', struct.pack('>IIBBBBB', w, h, 8, 2, 0, 0, 0))
png += chunk(b'IDAT', zlib.compress(rows))
png += chunk(b'IEND', b'')
open(sys.argv[1], 'wb').write(png)
PYEOF

UPLOAD="$(curl -sf -X POST "$API/inspections" \
  -H "Authorization: Bearer $TOKEN" \
  -F "image=@$TMP_DIR/road.png;type=image/png" \
  -F "latitude=26.1445" -F "longitude=91.7362" -F "address=GS Road, Guwahati, Assam")" \
  || fail "inspection upload/analysis failed"
INSPECTION_ID="$(echo "$UPLOAD" | python3 -c 'import json,sys; print(json.load(sys.stdin)["data"]["inspection"]["id"])')" \
  || fail "no inspection id returned"
echo "$UPLOAD" | python3 -c 'import json,sys; d=json.load(sys.stdin)["data"]["inspection"]; assert "detections" in d and "summary" in d and "model" in d, "missing fields"' \
  || fail "inspection payload incomplete"
pass "upload → AI analysis → stored inspection ($INSPECTION_ID)"

curl -sf "$API/inspections/$INSPECTION_ID" -H "Authorization: Bearer $TOKEN" > /dev/null \
  || fail "inspection detail fetch failed"
pass "inspection detail"

curl -sf "$API/inspections/$INSPECTION_ID/image?variant=original" -H "Authorization: Bearer $TOKEN" -o "$TMP_DIR/out.png" \
  || fail "original image fetch failed"
pass "original image served"

# --- 4. History / analytics / map -----------------------------------------
echo "-- Data surfaces"
curl -sf "$API/inspections" -H "Authorization: Bearer $TOKEN" | grep -q "$INSPECTION_ID" \
  || fail "history list missing the new inspection"
pass "history list"

curl -sf "$API/analytics/summary" -H "Authorization: Bearer $TOKEN" | grep -q '"totalInspections"' \
  || fail "analytics summary failed"
pass "analytics summary"

curl -sf "$API/analytics/timeseries?interval=day" -H "Authorization: Bearer $TOKEN" | grep -q '"points"' \
  || fail "analytics timeseries failed"
pass "analytics timeseries"

curl -sf "$API/maps/reports" -H "Authorization: Bearer $TOKEN" | grep -q "$INSPECTION_ID" \
  || fail "map reports missing the located inspection"
pass "map reports"

# --- 5. Validation & error handling ---------------------------------------
echo "-- Error handling"
CODE="$(curl -s -o /dev/null -w '%{http_code}' -X POST "$API/inspections" -H "Authorization: Bearer $TOKEN")"
[ "$CODE" = "422" ] || fail "expected 422 for missing file, got $CODE"
pass "validation error (422) for missing image"

CODE="$(curl -s -o /dev/null -w '%{http_code}' "$API/inspections")"
[ "$CODE" = "401" ] || fail "expected 401 without token, got $CODE"
pass "auth required (401)"

# --- 6. Cleanup ------------------------------------------------------------
curl -sf -X DELETE "$API/inspections/$INSPECTION_ID" -H "Authorization: Bearer $TOKEN" -o /dev/null \
  || fail "delete failed"
pass "inspection deleted"

echo
echo "ALL SMOKE TESTS PASSED"
