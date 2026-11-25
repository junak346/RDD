# Citizen reporting

This document describes the anonymous citizen journey. It is public/product documentation and intentionally does **not** describe the hidden government portal.

## Journey

1. **Landing page** — `REPORT ROAD DAMAGE` opens the camera flow; `CHECK REPORT STATUS` opens `/track`.
2. **Permission explanation** — the citizen sees why camera and location are needed before any browser prompt, then presses **Continue**.
3. **Live camera** — `navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false })` opens the device camera. There is no file input, gallery picker, drag/drop or computer upload path.
4. **Fresh photo** — the browser captures a new frame from the live stream, downscales only if the long edge exceeds 1920 px, and encodes JPEG at quality 0.88 to preserve road-damage detail.
5. **Retake / confirm** — nothing is uploaded until the citizen confirms the preview. Retake clears the preview and returns to the live stream.
6. **Explicit location** — `navigator.geolocation.getCurrentPosition()` is called only after an explicit action with `enableHighAccuracy: true`, `timeout: 15000`, `maximumAge: 0`. The browser supplies `latitude`, `longitude`, `accuracy` and `timestamp`; these are sent as `capturedAt`.
7. **Confirmation** — the citizen reviews the photo, coarse area and accuracy, sees a concise privacy notice, then presses **SUBMIT ROAD REPORT**.
8. **Backend + AI** — multipart `image` + JSON `location` is posted to `POST /api/v1/public/reports`. The backend validates the image and coordinates, stores the case, calls the existing FastAPI pipeline, groups likely duplicate reports and returns a strict public DTO.
9. **Public ID** — an unguessable `RVR-YYYY-XXXXXXXXXX` capability ID is returned. It is separate from the internal database ID and is hashed for lookup.
10. **Tracking** — `GET /api/v1/public/reports/:publicId/status` and `/track` show a limited lifecycle timeline without an account.

## Browser requirements

| Requirement | Behaviour |
| --- | --- |
| HTTPS | Required in production for camera and Geolocation. `localhost` / `127.0.0.1` are allowed for development only. |
| Camera | Maintained `getUserMedia()` API; deprecated camera APIs are not used. |
| Geolocation | Browser Geolocation API; EXIF GPS is never treated as authoritative. |
| Permissions-Policy | `camera=(self), geolocation=(self), microphone=()` from the backend and nginx. Official pages deny camera/geolocation. |
| Secure context | The UI checks `window.isSecureContext` or localhost before requesting capabilities. |
| Unsupported / insecure browser | Clear message; no silent fallback to a normal upload. |
| Camera denied / unavailable / cancelled / no device | Understandable message with **Try again** and **Cancel**; no silent failure. |
| Location denied | `Location access is required to report road damage.` with **Enable Location** / **Try Again**. The report cannot be submitted as a normal geolocated report. |

## Backend validation

`POST /api/v1/public/reports` uses `multer` memory storage with a single `image` field and a maximum size; declared MIME type is only a first gate. The storage layer sniffs magic bytes and accepts JPEG/PNG/WebP. The `location` multipart field is parsed as JSON then validated with strict Zod pre-processing:

- `latitude` and `longitude` must be finite numbers or numeric strings within `[-90, 90]` and `[-180, 180]`. `null`, `NaN`, booleans, arrays and objects are rejected.
- `accuracy` must be finite, non-negative and within `MAX_LOCATION_ACCURACY_METERS`.
- `capturedAt` must be recent and not in the future (`MAX_LOCATION_AGE_MINUTES`, `MAX_LOCATION_FUTURE_MINUTES`).
- The zero-island placeholder `0,0` is rejected.
- Extra fields, `$where`, `$ne` and prototype-pollution-shaped objects are rejected by the strict schema.
- Request body, field count, file count, image bytes and declared types are bounded.

The backend stores GeoJSON `Point` coordinates as `[longitude, latitude]` with a MongoDB `2dsphere` index, plus accuracy and captured timestamp. Reported location accuracy is retained for official review.

## What the public response contains

The public DTO contains only:

- `publicReportId`, `submittedAt`, `lastUpdatedAt`, `status`
- `generalLocation.area` (coarse `0.1°` area), `precision`, `accuracyMeters`
- `detectedDamageType`, `severity`, `confidence`, `noDamageDetected`, `aiPending`, `aiDemo`
- a limited public `timeline` and a status-aware `message`

It never contains exact coordinates, image URLs or image bytes, internal notes, audit history, IP hashes, department/official names, administrative priority, incident IDs, citizen report counts, or any citizen PII. `Cache-Control: no-store` is set on report creation and status responses. SessionStorage may remember the last report ID locally as a convenience; the backend does not require a citizen account.

## AI language and trust

- “AI detected a likely pothole.” — assistive computer-vision result, not a guarantee.
- “Estimated severity” — computer-vision triage, not an engineering assessment.
- “AI RESULT” is visually separate from “OFFICIAL DECISION” in the operator portal.
- Government priority is an administrative decision and is never mixed with AI severity.
- `DEMO MODE` is shown when trained weights are unavailable; heuristic demo detections are not calibrated model predictions.
- If no detection passes the configured gate, the UI shows `No road damage detected.` The submission is preserved for appropriate review; no detections are fabricated.
- AI failure preserves the report in `SUBMITTED` with an `AI_ANALYSIS_UNAVAILABLE` audit event rather than inventing an AI result.

## Anti-abuse and privacy

- Public report rate limiter, global limiter and per-IP/email-shaped login limiter.
- In-process abuse guard stores only IP hash, image hash and coarse grid hash — no raw address or personal data.
- Identical-image, daily-IP, coarse-grid and suspicious-submission thresholds are configurable.
- Request/image size limits and magic-byte validation reduce upload abuse.
- Nearby reports with the same likely damage type inside a configurable radius/window are grouped into incidents. Individual citizen reports are preserved.
- A concise privacy notice appears before capture and at submission: the camera image and location are collected to analyse and manage the report; citizens are asked not to capture unnecessary personal or sensitive information.
- No public directory listing exists. Original and annotated images are served only through authenticated, authorized official endpoints with `private, no-store`.

## Accessibility

The camera flow uses semantic headings, labelled buttons, `aria-live` status text, high-contrast controls, keyboard-visible focus rings, retake/confirm/cancel actions and readable permission/error messages. The public tracking page uses an ordered timeline with explicit current/complete/pending states and a labelled report-ID field.
