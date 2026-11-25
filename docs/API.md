# Public API reference

Base URL: `/api/v1`. All responses use the existing envelope:

```json
{ "success": true, "data": { }, "meta": { "requestId": "...", "timestamp": "...", "dataMode": "mongo|demo" } }
```

Errors use `{ "success": false, "error": { "code", "message", "details?" } }`. Public report creation/status responses set `Cache-Control: no-store`.

> This document is the **public** API reference. Private government authentication, case-management and image endpoints are intentionally omitted; they are described only in internal operator documentation and are protected server-side. No public official signup or Government Login route is published here.

---

## `GET /api/v1/public/config`

Returns citizen capture requirements without authentication.

```json
{
  "camera": "required",
  "location": "required",
  "maxImageBytes": 10485760,
  "acceptedImageTypes": ["image/jpeg", "image/png", "image/webp"],
  "secureContextRequired": true,
  "modelConfidenceThreshold": 0.35,
  "privacyNotice": "Your camera image and location are collected to analyse and manage this road-damage report..."
}
```

Production camera/geolocation requires HTTPS; localhost is allowed for development.

---

## `POST /api/v1/public/reports`

Anonymous, rate-limited citizen report submission. No account, token, email or phone number is required.

**Content-Type:** `multipart/form-data`

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `image` | file | yes | Fresh camera JPEG/PNG/WebP. One file only; declared MIME and magic bytes are validated; `MAX_UPLOAD_MB` applies. |
| `location` | JSON string | yes | `{ latitude, longitude, accuracy, capturedAt }`. Browser Geolocation is authoritative. |

Example `location` field:

```json
{
  "latitude": 26.1445,
  "longitude": 91.7362,
  "accuracy": 12,
  "capturedAt": "2026-11-24T10:30:00.000Z"
}
```

Validation:

- finite latitude `[-90, 90]`, longitude `[-180, 180]`, accuracy within `MAX_LOCATION_ACCURACY_METERS`;
- `capturedAt` must be recent and not in the future;
- `0,0`, `NaN`, `null`, booleans, arrays, objects, injection-shaped and unknown fields are rejected;
- no EXIF GPS is trusted; no unnecessary citizen PII is accepted.

**201 response:**

```json
{
  "success": true,
  "data": {
    "report": {
      "publicReportId": "RVR-2026-7K92M4QX8P",
      "submittedAt": "2026-11-24T10:30:01.000Z",
      "lastUpdatedAt": "2026-11-24T10:30:02.000Z",
      "status": "AI_ANALYSED",
      "generalLocation": {
        "area": "Approximate area 26.1°, 91.7°",
        "precision": "coarse",
        "accuracyMeters": 12
      },
      "detectedDamageType": "pothole",
      "severity": "high",
      "confidence": 0.94,
      "noDamageDetected": false,
      "aiPending": false,
      "aiDemo": true,
      "timeline": [
        { "key": "SUBMITTED", "label": "Submitted", "state": "complete" },
        { "key": "AI_ANALYSED", "label": "AI analysed", "state": "current" }
      ],
      "message": "AI detected a likely pothole."
    }
  }
}
```

The public ID is unguessable and separate from the internal database ID. AI wording is assistive: “AI detected a likely pothole.” and “Estimated severity”; it never claims a guarantee. `aiDemo: true` / `DEMO MODE` means heuristic results from the labelled demo engine, not trained inference. `No road damage detected.` is returned when no detection passes the configured threshold; the report is preserved.

**Common errors:** `400 INVALID_IMAGE` (bad magic bytes), `413` / size limit, `422 VALIDATION_ERROR` (missing/invalid image or location), `429 RATE_LIMITED`.

---

## `GET /api/v1/public/reports/:publicId/status`

Login-free tracking by the unguessable public ID. The ID is normalized and hashed before lookup; sequential or guessed IDs return `404 NOT_FOUND`.

```text
GET /api/v1/public/reports/RVR-2026-7K92M4QX8P/status
```

Returns the same strict public DTO as creation. It contains only a coarse area and limited lifecycle timeline. It never contains exact coordinates, image URLs/bytes, internal notes, audit history, IP hashes, department/official names, administrative priority, incident IDs, citizen report counts or private administrative data.

Lifecycle statuses stored in the database: `SUBMITTED`, `AI_ANALYSIS`, `AI_ANALYSED`, `UNDER_REVIEW`, `VERIFIED`, `REJECTED`, `ASSIGNED`, `IN_PROGRESS`, `RESOLVED`, `CLOSED`.

---

## Legacy compatibility APIs

The following authenticated endpoints remain temporarily for existing tooling and are not the citizen reporting flow:

| Method | Path | Notes |
| --- | --- | --- |
| `POST` | `/auth/register`, `/auth/login`, `/auth/forgot-password`, `/auth/reset-password` | Legacy citizen/account JWT flow. |
| `GET` | `/auth/me`, `/users/*` | Legacy profile/admin tooling. |
| `POST` | `/inspections` | Authenticated upload analysis; retained for compatibility. |
| `GET` | `/inspections`, `/inspections/:id`, `/inspections/:id/image` | Owner/admin-checked legacy inspection data. |
| `GET` | `/analytics/*`, `/maps/*` | Legacy authenticated analytics/map endpoints. |
| `GET` | `/health` | Service health. |

Legacy Bearer tokens are never accepted by private government APIs. Public `/public/*` requests do not attach the legacy JWT.

---

## Public/private DTO separation

| Field | Public citizen DTO | Private official DTO |
| --- | --- | --- |
| Unguessable public report ID | ✅ | ✅ |
| Internal database ID | ❌ | ✅ |
| Coarse area | ✅ | ✅ (plus exact point) |
| Exact latitude/longitude/accuracy/timestamp | ❌ | ✅ |
| Original/annotated image bytes or URLs | ❌ | ✅ (authorized only) |
| AI class/confidence/estimated severity | ✅ | ✅ |
| Administrative priority / department / official | ❌ | ✅ |
| Incident ID and citizen report count | ❌ | ✅ |
| Internal notes / action history / audit metadata | ❌ | ✅ |
| IP hash / suspicious flag / archived state | ❌ | ✅ |

No public directory listing is exposed. Images are retrieved only through an authenticated, authorized, `private, no-store` endpoint in the operator surface, whose documentation is intentionally outside this public API reference.
