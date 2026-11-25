# Architecture

## Product shape

This repository now implements two deliberately separate product surfaces over one preserved technical stack:

1. **Anonymous citizen reporting** — camera-first, location-required, no account, limited public status.
2. **Government response** — an unadvertised operator portal with independent authentication, RBAC, case management, exact-GPS access, analytics and audit history.

The original React/Vite frontend, Express/TypeScript backend, MongoDB/Mongoose repositories, FastAPI/YOLO/OpenCV AI service, Leaflet maps and Recharts analytics remain. Legacy authenticated inspection APIs remain temporarily for compatibility but are no longer the public citizen path.

```text
                         ┌──────────────────────────────┐
                         │ Citizen browser (HTTPS)      │
                         │ Camera + Geolocation + SPA   │
                         └──────────────┬───────────────┘
                                        │ relative /api URLs
                         ┌──────────────▼───────────────┐
                         │ nginx / Vite proxy           │
                         │ CSP · Permissions-Policy     │
                         │ noindex for private pages    │
                         └──────────────┬───────────────┘
                                        │
             ┌──────────────────────────▼──────────────────────────┐
             │ Express /api/v1                                     │
             │ helmet · CORS allowlist · rate limits · Zod         │
             │ public router             official router           │
             │ anonymous DTO             auth + RBAC + CSRF        │
             └───────┬───────────────────────────────┬─────────────┘
                     │                               │
       ┌─────────────▼─────────────┐   ┌─────────────▼──────────────┐
       │ Report workflow           │   │ Official workflow          │
       │ image storage abstraction │   │ dashboard/table/map/detail │
       │ abuse guard · public IDs  │   │ actions · audit · settings │
       │ duplicate grouping        │   │ CSV export · exact GPS     │
       └─────────────┬─────────────┘   └─────────────┬──────────────┘
                     │                               │
       ┌─────────────▼─────────────┐   ┌─────────────▼──────────────┐
       │ FastAPI /predict           │   │ MongoDB                    │
       │ YOLO/OpenCV or DEMO MODE   │   │ roadReports (2dsphere)     │
       │ boxes · severity · timing  │   │ incidents · officials      │
       │ optional segmentation      │   │ departments · auditLogs    │
       └───────────────────────────┘   │ systemSettings             │
                                       └────────────────────────────┘
```

## Frontend

- `PublicLayout`, `LandingPage`, `CameraReportPage`, `ReportSuccessPage`, `TrackPage`, `NotFoundPage`.
- `useCameraCapture` uses maintained `getUserMedia()`, a long-edge cap of 1920 px, JPEG quality 0.88, object-URL previews and full stream cleanup. It has no `<input type="file">`.
- `useRequiredGeolocation` requests GPS only after explicit user action with high accuracy, zero cached position and a 15 s timeout.
- `reportsService` posts multipart `image` + `location`; the shared `api` client deliberately does not attach a legacy citizen JWT to `/public/*`.
- `officialApi` is a separate credentialed axios client; it never reads the citizen token. Official pages are wrapped by `OfficialAuthProvider`, mounted only when the browser is in the private area. A frontend guard improves UX, but every official API re-checks auth server-side.
- Dashboard, reports table, Leaflet command map, hotspots, analytics, incidents, notifications, audit, admin, departments and officials pages consume real backend data.
- Vite build splits React, chart and map chunks. Tailwind provides the design system; existing UI primitives are reused.

## Backend modules

### Configuration and types

`config/index.ts` validates environment variables once with Zod: data mode, separate citizen JWT/official session/HMAC secrets, official session/lockout, AI URL/timeout, upload limits, rate/abuse limits, location limits, duplicate radius/window, `MODEL_CONFIDENCE_THRESHOLD`, configurable SLA rules, bootstrap and CORS origins. Production requires three distinct secrets and refuses missing or reused keys. `types/civic.ts` centralizes statuses, priorities, roles, actions, records, DTOs and analytics shapes.

### Public reporting

`routes/public.routes.ts` → `publicReport.controller.ts` → `civicReport.service.ts`:

- `GET /public/config` — camera/location requirements, accepted types, size limit, threshold and privacy notice.
- `POST /public/reports` — rate-limited multipart upload, strict location validation, magic-byte image check, protected storage, secure public ID, persisted lifecycle, AI call, confidence gate, honest demo/no-damage labelling, incident grouping.
- `GET /public/reports/:publicId/status` — hashed, normalized public ID lookup and strict public DTO.

The service records `REPORT_SUBMITTED`, `AI_ANALYSIS_STARTED`, AI completion/unavailability, duplicate grouping and domain events. If AI is unavailable, the report remains `SUBMITTED`; it never fabricates detections.

### Official workflow

`routes/official.routes.ts` → `official.controller.ts` → `official.service.ts` / `officialAuth.service.ts`:

- Login is the only unauthenticated official endpoint.
- `requireOfficialAuth` verifies the separate cookie/JWT, repository account, active status, email, role and session version.
- `requireOfficialRole` and action-specific role tables enforce RBAC.
- `requireOfficialCsrf` checks the double-submit token on state changes.
- Lifecycle transitions are validated; AI severity and administrative priority are separate.
- Every action appends an immutable-style audit event and publishes an internal domain event.
- Dashboard, analytics, map, incidents, notifications, audit, settings, departments, officials, CSV export and report detail all read from the repository.

### Repositories

`repositories/civic` exposes one `ICivicRepository` with memory and Mongo implementations. It has no audit update/delete methods. Mongo documents:

- `roadReports`: unguessable public ID/hash, citizen token hash, GeoJSON `Point [longitude, latitude]`, accuracy, image metadata/hash, AI analysis, status, priority, assignment, SLA fields, notes, audit history, suspicious/archive flags, `2dsphere` and workflow indexes.
- `incidents`: grouped report IDs, public incident ID, count, centroid, primary damage type, max severity.
- `officials`: bcrypt hash, role, department, status, failed-login/lockout state, session version.
- `departments`: configurable name/code/description/active.
- `auditLogs`: append-only actor/role/action/timestamp/report/metadata.
- `systemSettings`: SLA, priority labels, duplicate rules and admin model-gate override.

Memory mode seeds clearly labelled demo data only for `DATA_MODE=demo` or tests. Mongo mode uses real data.

### Storage and images

`services/reportStorage.ts` wraps local storage behind `ReportImageStorage` and includes a cloud/S3-compatible adapter hook. Files get random names, are never served from a public directory, and are retrieved through `GET /official/reports/:id/image` with cookie auth and `private, no-store`. The nginx config denies any direct upload path. Image metadata includes width, height, format, size, capturedAt and uploadedAt. Browser GPS is authoritative; EXIF GPS is not trusted.

### AI pipeline

The existing `ai.client.ts` calls `POST {AI_SERVICE_URL}/predict`. FastAPI decodes the image with OpenCV/PIL, runs either the Ultralytics YOLO engine or the clearly labelled demo engine, estimates severity, draws annotated boxes, and returns damage class, confidence, bounding boxes, optional segmentation, severity, processing time, model version and warnings. `MODEL_CONFIDENCE_THRESHOLD` gates detections in the AI service; the backend applies the highest of its environment baseline, an optional admin override and the model-reported threshold. No trained weights ship; `AI_MODE=real` fails cleanly rather than silently faking results.

### Analytics, hotspots and events

Analytics are computed from stored reports: timeseries, class/severity/department distributions, resolution rate, average resolution time, unresolved/overdue counts. Hotspots are descriptive grid aggregations labelled **Reported Damage Hotspots**, with an explicit disclaimer that repeated reports do not prove statistical significance or causation. `domainEvents.ts` is an in-process pub/sub plus recent-event feed, ready for WebSocket/SSE or a message bus; it does not claim SMS/email delivery.

### Legacy compatibility

`POST /api/v1/inspections`, `/auth/*`, `/users/*`, `/analytics/*`, `/maps/*` and the authenticated `/app/*` SPA remain temporarily. They use the original JWT/Bearer flow and are no longer linked from public citizen navigation. Citizen `/public/*` requests never attach the legacy JWT. Official auth uses a separate key/issuer/cookie and rejects citizen tokens.
