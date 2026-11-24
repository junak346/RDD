# API Reference

Base URL: `/api/v1` (versioned). All responses use a consistent envelope.

**Success**

```json
{ "success": true, "data": { "...": "..." }, "meta": { "dataMode": "mongo", "serverTime": "..." } }
```

`meta.dataMode` is `"demo"` when the labelled in-memory store is active — the
UI shows a DEMO MODE banner in that case.

**Failure**

```json
{ "success": false, "error": { "code": "VALIDATION_ERROR", "message": "...", "details": [{ "field": "email", "message": "..." }] } }
```

Stable error codes: `BAD_REQUEST`, `INVALID_IMAGE`, `AUTH_REQUIRED`,
`INVALID_CREDENTIALS`, `INVALID_TOKEN`, `FORBIDDEN`, `NOT_FOUND`, `CONFLICT`,
`EMAIL_TAKEN`, `PAYLOAD_TOO_LARGE`, `VALIDATION_ERROR`, `RATE_LIMITED`,
`AI_SERVICE_UNAVAILABLE`, `AI_INVALID_RESPONSE`, `DATABASE_UNAVAILABLE`,
`INTERNAL_ERROR`.

**Authentication** — protected endpoints require
`Authorization: Bearer <JWT>` (returned by register/login).
Roles: `user` (default), `inspector`, `admin`.

**Rate limits** — global 300 req / 15 min per IP; auth endpoints 20 / 15 min;
analysis endpoint 75 / 15 min. Exceeding a limit returns `429 RATE_LIMITED`.

---

## Health

### `GET /health`
Liveness probe (no auth).

```json
{ "success": true, "data": { "status": "ok", "uptimeSeconds": 42 }, "meta": { ... } }
```

### `GET /api/v1/health`
Readiness: database + AI service state (200 when ready, 503 when degraded).

```json
{
  "success": true,
  "data": {
    "status": "ok",
    "version": "1.0.0",
    "database": { "mode": "mongo", "connected": true },
    "dataMode": "mongo",
    "ai": { "reachable": true, "status": "ok", "engine": "yolo", "modelLoaded": true, "demo": false },
    "uptimeSeconds": 42
  }
}
```

---

## Auth — `/api/v1/auth`

### `POST /auth/register`
Body: `{ "name": "Ada Lovelace", "email": "ada@example.com", "password": "analytical1" }`
Rules: name ≥ 2 chars; valid email; password ≥ 8 chars with letters + digit.
`201` → `{ "user": {...}, "token": "JWT" }`. `409 EMAIL_TAKEN` on duplicates.

### `POST /auth/login`
Body: `{ "email": "...", "password": "..." }` → `200 { user, token }`.
`401 INVALID_CREDENTIALS` on wrong email/password (identical message for both).

### `POST /auth/logout` *(auth)*
`200 { message }`. Stateless JWT — the client discards its token.

### `POST /auth/forgot-password`
Body: `{ "email": "..." }` → always `202` with the same message (prevents email
enumeration). A single-use, 30-minute reset token is generated and hashed at
rest; the link is delivered through the email provider hook
(`backend/src/services/email.service.ts`).

> Development only: when `EXPOSE_RESET_TOKENS=true` (never in production) the
> response includes `resetToken` so the flow can be exercised without email.

### `POST /auth/reset-password`
Body: `{ "token": "...", "password": "newpassword1" }` → `200`.
`401 INVALID_TOKEN` when the link is expired, unknown or already used.

### `GET /auth/me` *(auth)*
`200 { "user": { id, name, email, role, createdAt } }`.

---

## Users — `/api/v1/users`

### `PATCH /users/me` *(auth)*
Body (any subset): `{ "name": "...", "currentPassword": "...", "newPassword": "..." }`.
Changing the password requires the current one. → `200 { user }`.

### `GET /users` *(admin)*
Query: `page`, `limit` (≤ 100). → `200 { items: [user], pagination }`.

---

## Inspections — `/api/v1/inspections`

### `POST /inspections` *(auth, multipart)*
Fields:

| field | type | required | notes |
|---|---|---|---|
| `image` | file | yes | JPEG/PNG/WebP, ≤ `MAX_UPLOAD_MB` (default 10 MB), validated by magic bytes |
| `latitude` | number | no | −90…90 |
| `longitude` | number | no | −180…180 |
| `address` | string | no | ≤ 240 chars |

`201 { "inspection": { ... } }`. Failures: `400 INVALID_IMAGE`,
`413 PAYLOAD_TOO_LARGE`, `422 VALIDATION_ERROR`, `503 AI_SERVICE_UNAVAILABLE`.

### `GET /inspections` *(auth)*
Query: `page`, `limit`, `search`, `damageType`, `severity`, `sort`
(`createdAt_desc|createdAt_asc|detections_desc`), `from`, `to` (ISO dates).
Regular users see their own records; admins see all.
→ `200 { items: [inspection], pagination: { page, limit, total } }`.

### `GET /inspections/recent` *(auth)*
Query: `limit` (default 5) → `200 { items }`.

### `GET /inspections/:id` *(auth, owner/admin)*
`200 { "inspection": { ... } }` — full record including detections.

### `PATCH /inspections/:id/location` *(auth, owner/admin)*
Body: `{ "latitude": 26.14, "longitude": 91.73, "address": "GS Road, Guwahati" }`
→ `200 { inspection }`.

### `DELETE /inspections/:id` *(auth, owner/admin)*
`204`. Removes the record and both image files.

### `GET /inspections/:id/image?variant=original|annotated` *(auth, owner/admin)*
Returns the image bytes (`Content-Type: image/jpeg|png|webp`, `Cache-Control: private`).

### Inspection object

```json
{
  "id": "665f…",
  "userId": "…",
  "status": "completed",
  "timestamp": "2026-11-24T10:00:00.000Z",
  "createdAt": "2026-11-24T10:00:01.000Z",
  "location": { "latitude": 26.1445, "longitude": 91.7362, "address": "GS Road, Guwahati, Assam" },
  "model": {
    "name": "road-damage-yolo", "version": "1.0.0", "engine": "yolo",
    "device": "cpu", "demo": false, "confidenceThreshold": 0.35, "iouThreshold": 0.45
  },
  "processingTimeMs": 421.7,
  "aiWarnings": [],
  "detections": [
    {
      "classId": 0, "className": "pothole", "confidence": 0.94,
      "severity": "high", "severityScore": 0.71, "areaRatio": 0.13,
      "bbox": { "x1": 100, "y1": 120, "x2": 500, "y2": 400 }
    }
  ],
  "summary": {
    "detectionCount": 1,
    "countsByClass": { "pothole": 1 },
    "countsBySeverity": { "low": 0, "moderate": 0, "high": 1 },
    "maxSeverity": "high"
  },
  "image": { "url": "/api/v1/inspections/…/image?variant=original", "mimeType": "image/jpeg", "size": 240000, "width": 1280, "height": 720 },
  "annotatedImage": { "url": "/api/v1/inspections/…/image?variant=annotated" },
  "aiDemo": false
}
```

`aiDemo: true` / `model.demo: true` means the labelled demo engine produced the
result — never a trained model.

---

## Analytics — `/api/v1/analytics` *(auth)*

Shared query filters: `damageType`, `severity`, `from`, `to`.

### `GET /analytics/summary`

```json
{
  "totalInspections": 42, "totalDetections": 87,
  "highSeverityInspections": 6, "withLocation": 31,
  "avgConfidence": 0.71,
  "countsByClass": { "pothole": 40, "crack": 33, "surface_damage": 14 },
  "countsBySeverity": { "low": 30, "moderate": 41, "high": 16 },
  "topAreas": [{ "area": "GS Road, Guwahati", "count": 9 }]
}
```

### `GET /analytics/timeseries?interval=day|week|month`
`{ "interval": "day", "points": [{ "date": "2026-11-24", "inspections": 3, "detections": 7 }] }`

### `GET /analytics/distribution`
`{ "byClass": [{ "name": "pothole", "count": 40 }], "bySeverity": [{ "name": "low", "count": 30 }] }`

---

## Maps — `/api/v1/maps` *(auth)*

### `GET /maps/reports`
Filters as above. Returns only inspections that have location data.

```json
{
  "reports": [{
    "inspectionId": "…", "latitude": 26.1445, "longitude": 91.7362,
    "address": "GS Road, Guwahati, Assam", "timestamp": "…",
    "damageTypes": ["pothole", "crack"], "detectionCount": 3,
    "maxSeverity": "high", "maxConfidence": 0.94,
    "inspectionUrl": "/api/v1/inspections/…"
  }]
}
```

---

## AI service (FastAPI, internal)

Interactive OpenAPI docs at `http://localhost:8000/docs`.

| Method | Path | Description |
|---|---|---|
| `GET` | `/health` | service + engine status (`demo: true` when the demo engine is active) |
| `GET` | `/model/info` | engine name/version/classes/thresholds |
| `POST` | `/predict` | multipart `file` **or** JSON `{ "image_base64": "…" }` |

Prediction response (abridged):

```json
{
  "success": true,
  "demo": false,
  "model": { "name": "road-damage-yolo", "version": "1.0.0", "engine": "yolo", "device": "cpu", "demo": false, "classes": ["pothole", "crack"], "confidence_threshold": 0.35, "iou_threshold": 0.45 },
  "image": { "width": 1920, "height": 1080, "format": "jpeg" },
  "detections": [
    { "class_id": 0, "class_name": "pothole", "confidence": 0.94,
      "bbox": { "x1": 100, "y1": 120, "x2": 500, "y2": 400 },
      "severity": "high", "severity_score": 0.71, "area_ratio": 0.13 }
  ],
  "summary": { "detection_count": 1, "counts_by_class": { "pothole": 1 }, "counts_by_severity": { "low": 0, "moderate": 0, "high": 1 }, "max_severity": "high" },
  "processing_time_ms": 123.4,
  "annotated_image_base64": "…JPEG…",
  "warnings": []
}
```

Errors: `400 INVALID_IMAGE`, `413 IMAGE_TOO_LARGE`, `422 MISSING_FILE`,
`503 MODEL_UNAVAILABLE` (real mode, weights not installed), `500 INTERNAL_ERROR`.
