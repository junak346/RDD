#!/usr/bin/env bash
# =============================================================================
# RoadVision end-to-end smoke test.
#
# Prerequisites:
#   1. AI service running   (cd ai-service && uvicorn app.main:app --port 8000)
#   2. Backend running      (cd backend && DATA_MODE=demo npm run dev)
#   3. Frontend optional    — this script exercises the HTTP API only.
#
# Usage: bash scripts/smoke.sh [backend-url]  (default http://127.0.0.1:5000)
# Demo official credentials can be overridden with OFFICIAL_SMOKE_EMAIL and
# OFFICIAL_SMOKE_PASSWORD. In MongoDB mode, provision an official first.
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
http_status() { curl -sS -o /dev/null -w '%{http_code}' "$@"; }

echo "== RoadVision — smoke test against $BASE_URL"

# --- 1. Health and public configuration -----------------------------------
echo "-- Health and public config"
HEALTH="$(curl -fsS "$API/health/live")" || fail "GET /api/v1/health/live unreachable"
echo "$HEALTH" | grep -q '"status"' || fail "health payload missing status"
DATA_MODE="$(python3 -c 'import json,sys; print(json.load(sys.stdin)["meta"]["dataMode"])' <<< "$HEALTH")" \
  || fail "health payload missing meta.dataMode"
pass "health endpoint responds (DATA_MODE=$DATA_MODE)"

CONFIG="$(curl -fsS "$API/public/config")" || fail "public config unreachable"
echo "$CONFIG" | python3 -c '
import json,sys
d=json.load(sys.stdin)["data"]
assert d["camera"]=="required" and d["location"]=="required"
assert d["maxImageBytes"] > 0 and "image/jpeg" in d["acceptedImageTypes"]
assert 0 <= d["modelConfidenceThreshold"] <= 1
assert d["privacyNotice"]
' || fail "public config payload incomplete"
pass "anonymous public config"

# --- 2. Fresh camera-style report -----------------------------------------
echo "-- Public camera + GPS report"
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

LOCATION="$(python3 -c '
import datetime, json
print(json.dumps({
  "latitude": 26.1445,
  "longitude": 91.7362,
  "accuracy": 12,
  "capturedAt": datetime.datetime.now(datetime.timezone.utc).isoformat().replace("+00:00", "Z"),
}))
')" || fail "could not build location payload"

curl -fsS -D "$TMP_DIR/create.headers" -o "$TMP_DIR/create.json" \
  -X POST "$API/public/reports" \
  -F "image=@$TMP_DIR/road.png;type=image/png" \
  -F "location=$LOCATION" || fail "anonymous public report submission failed"
PUBLIC_ID="$(python3 -c '
import json,sys
print(json.load(open(sys.argv[1]))["data"]["report"]["publicReportId"])
' "$TMP_DIR/create.json")" || fail "no publicReportId in response"
[[ "$PUBLIC_ID" =~ ^RVR-[0-9]{4}-[0-9A-Z]{10}$ ]] || fail "public ID is not unguessable-shaped: $PUBLIC_ID"
grep -qi '^cache-control:.*no-store' "$TMP_DIR/create.headers" || fail "report creation is not no-store"
pass "anonymous image + GPS accepted; public ID $PUBLIC_ID"

# --- 3. Public tracking and privacy boundary ------------------------------
echo "-- Public tracking / privacy"
curl -fsS -D "$TMP_DIR/status.headers" -o "$TMP_DIR/status.json" \
  "$API/public/reports/$PUBLIC_ID/status" || fail "public status lookup failed"
grep -qi '^cache-control:.*no-store' "$TMP_DIR/status.headers" || fail "public status is not no-store"
python3 -c '
import json,sys
body=json.load(open(sys.argv[1]))
report=body["data"]["report"]
serialized=json.dumps(report)
assert report["publicReportId"] == sys.argv[2]
assert report["generalLocation"]["precision"] == "coarse"
assert "26.1445" not in serialized and "91.7362" not in serialized
for field in ("image", "imageUrl", "exactLocation", "internalNotes", "auditHistory", "priority", "incidentPublicId", "sourceIpHash"):
    assert field not in report, field
assert isinstance(report["timeline"], list) and report["timeline"]
' "$TMP_DIR/status.json" "$PUBLIC_ID" || fail "public DTO leaks private data"
pass "public status is coarse, limited and no-store"

[ "$(http_status "$API/public/reports/RVR-2026-AAAAAAAAAA/status")" = "404" ] \
  || fail "guessed public ID did not return 404"
[ "$(http_status "$API/public/reports/$PUBLIC_ID/image")" = "404" ] \
  || fail "public image route should not exist"
[ "$(http_status "$BASE_URL/uploads/road-capture.jpg")" = "404" ] \
  || fail "direct upload path should not be served"
[ "$(http_status "$API/official/reports")" = "401" ] \
  || fail "unauthenticated official list should be 401"
pass "guessed IDs, direct images and unauthenticated private data rejected"

# --- 4. Legacy citizen token cannot cross the official boundary ------------
echo "-- Legacy compatibility and token separation"
REGISTER="$(curl -fsS -X POST "$API/auth/register" \
  -H 'Content-Type: application/json' \
  -d "{\"name\":\"Smoke Tester\",\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\"}")" \
  || fail "legacy registration failed"
TOKEN="$(python3 -c 'import json,sys; print(json.load(sys.stdin)["data"]["token"])' <<< "$REGISTER")" \
  || fail "no legacy JWT in register response"
curl -fsS "$API/auth/me" -H "Authorization: Bearer $TOKEN" > /dev/null \
  || fail "legacy /auth/me failed"
[ "$(http_status "$API/official/reports" -H "Authorization: Bearer $TOKEN")" = "401" ] \
  || fail "legacy citizen JWT was accepted by official API"
pass "legacy JWT is rejected by private government API"

# --- 5. Official auth, RBAC/CSRF and protected data ------------------------
echo "-- Official portal"
if [[ "$DATA_MODE" == "demo" ]]; then
  OFFICIAL_SMOKE_EMAIL="${OFFICIAL_SMOKE_EMAIL:-command.demo@rdd.local}"
  OFFICIAL_SMOKE_PASSWORD="${OFFICIAL_SMOKE_PASSWORD:-OfficialDemo!2026}"
fi
if [[ -z "${OFFICIAL_SMOKE_EMAIL:-}" || -z "${OFFICIAL_SMOKE_PASSWORD:-}" ]]; then
  echo "  ! OFFICIAL_SMOKE_EMAIL/PASSWORD not set; skipping authenticated official checks"
else
  LOGIN_BODY="{\"email\":\"$OFFICIAL_SMOKE_EMAIL\",\"password\":\"$OFFICIAL_SMOKE_PASSWORD\"}"
  curl -fsS -D "$TMP_DIR/login.headers" -c "$TMP_DIR/cookies" \
    -o "$TMP_DIR/login.json" \
    -X POST "$API/official/auth/login" \
    -H 'Content-Type: application/json' -d "$LOGIN_BODY" \
    || fail "official login failed"
  grep -qi '^set-cookie: rdd_official_session=.*HttpOnly' "$TMP_DIR/login.headers" \
    || fail "official session cookie is not HttpOnly"
  grep -qi '^set-cookie: rdd_official_session=.*SameSite=Strict' "$TMP_DIR/login.headers" \
    || fail "official session cookie is not SameSite=Strict"
  CSRF="$(python3 -c 'import json,sys; print(json.load(open(sys.argv[1]))["data"]["csrfToken"])' "$TMP_DIR/login.json")" \
    || fail "no CSRF token in login response"
  pass "separate official cookie session established"

  [ "$(http_status -b "$TMP_DIR/cookies" -X POST "$API/official/auth/logout")" = "403" ] \
    || fail "state-changing route accepted a request without CSRF"
  pass "CSRF-less state change rejected"

  curl -fsS -b "$TMP_DIR/cookies" "$API/official/reports?limit=50" \
    -o "$TMP_DIR/official-reports.json" || fail "official report list failed"
  INTERNAL_ID="$(python3 -c '
import json,sys
items=json.load(open(sys.argv[1]))["data"]["items"]
match=next((item for item in items if item["publicReportId"] == sys.argv[2]), None)
if not match: sys.exit("new report missing from official list")
print(match["id"])
' "$TMP_DIR/official-reports.json" "$PUBLIC_ID")" || fail "could not resolve internal report ID"

  curl -fsS -b "$TMP_DIR/cookies" "$API/official/reports/$INTERNAL_ID/location" \
    -o "$TMP_DIR/location.json" || fail "protected exact GPS failed"
  python3 -c '
import json,sys
loc=json.load(open(sys.argv[1]))["data"]["location"]
assert abs(loc["latitude"] - 26.1445) < 0.001
assert abs(loc["longitude"] - 91.7362) < 0.001
' "$TMP_DIR/location.json" || fail "exact official GPS payload is wrong"

  curl -fsS -D "$TMP_DIR/image.headers" -b "$TMP_DIR/cookies" \
    "$API/official/reports/$INTERNAL_ID/image?variant=original" \
    -o "$TMP_DIR/protected-image.png" || fail "protected image failed"
  test -s "$TMP_DIR/protected-image.png" || fail "protected image is empty"
  grep -qi '^cache-control:.*no-store' "$TMP_DIR/image.headers" \
    || fail "protected image is not no-store"
  pass "exact GPS and protected image available only with official session"

  curl -fsS -b "$TMP_DIR/cookies" -H "X-CSRF-Token: $CSRF" \
    -H 'Content-Type: application/json' \
    -d '{"action":"VERIFY_REPORT","note":"Smoke audit"}' \
    "$API/official/reports/$INTERNAL_ID/actions" -o "$TMP_DIR/action.json" \
    || fail "official action failed"
  curl -fsS -b "$TMP_DIR/cookies" \
    "$API/official/audit-logs?limit=100&reportId=$INTERNAL_ID" \
    -o "$TMP_DIR/audit.json" || fail "audit log lookup failed"
  python3 -c '
import json,sys
logs=json.load(open(sys.argv[1]))["data"]["logs"]
assert any(log["action"] == "VERIFY_REPORT" for log in logs)
assert all("password" not in json.dumps(log).lower() for log in logs)
' "$TMP_DIR/audit.json" || fail "action did not produce a clean audit event"
  pass "official action is appended to audit history"

  curl -fsS -b "$TMP_DIR/cookies" -c "$TMP_DIR/cookies" \
    -H "X-CSRF-Token: $CSRF" -X POST "$API/official/auth/logout" \
    -o /dev/null || fail "official logout failed"
  [ "$(http_status -b "$TMP_DIR/cookies" "$API/official/auth/me")" = "401" ] \
    || fail "logout did not invalidate the official session"
  pass "logout invalidates official session"
fi

# --- 6. Legacy upload/analysis compatibility ------------------------------
echo "-- Legacy inspection compatibility"
curl -fsS -X POST "$API/inspections" \
  -H "Authorization: Bearer $TOKEN" \
  -F "image=@$TMP_DIR/road.png;type=image/png" \
  -F "latitude=26.1445" -F "longitude=91.7362" -F "address=GS Road, Guwahati, Assam" \
  -o "$TMP_DIR/upload.json" || fail "legacy upload/analysis failed"
INSPECTION_ID="$(python3 -c '
import json,sys
d=json.load(open(sys.argv[1]))["data"]["inspection"]
assert "detections" in d and "summary" in d and "model" in d
print(d["id"])
' "$TMP_DIR/upload.json")" || fail "no inspection id returned"
pass "legacy upload → AI → stored inspection ($INSPECTION_ID)"

curl -fsS "$API/inspections/$INSPECTION_ID" -H "Authorization: Bearer $TOKEN" > /dev/null \
  || fail "legacy inspection detail fetch failed"
curl -fsS "$API/inspections/$INSPECTION_ID/image?variant=original" \
  -H "Authorization: Bearer $TOKEN" -o "$TMP_DIR/legacy-image.png" \
  || fail "legacy original image fetch failed"
curl -fsS "$API/inspections" -H "Authorization: Bearer $TOKEN" | grep -q "$INSPECTION_ID" \
  || fail "legacy history list missing the new inspection"
curl -fsS "$API/analytics/summary" -H "Authorization: Bearer $TOKEN" | grep -q '"totalInspections"' \
  || fail "legacy analytics summary failed"
curl -fsS "$API/analytics/timeseries?interval=day" -H "Authorization: Bearer $TOKEN" | grep -q '"points"' \
  || fail "legacy analytics timeseries failed"
curl -fsS "$API/maps/reports" -H "Authorization: Bearer $TOKEN" | grep -q "$INSPECTION_ID" \
  || fail "legacy map reports missing the located inspection"
pass "legacy history, analytics and map"

[ "$(http_status -X POST "$API/inspections" -H "Authorization: Bearer $TOKEN")" = "422" ] \
  || fail "expected 422 for missing image"
[ "$(http_status "$API/inspections")" = "401" ] \
  || fail "expected 401 for unauthenticated legacy inspection"
pass "legacy validation and auth errors"

curl -fsS -X DELETE "$API/inspections/$INSPECTION_ID" \
  -H "Authorization: Bearer $TOKEN" -o /dev/null || fail "legacy delete failed"
pass "legacy cleanup"

echo
echo "ALL SMOKE TESTS PASSED"
