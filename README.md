# AI-POWERED CITIZEN ROAD DAMAGE REPORTING AND GOVERNMENT RESPONSE PLATFORM

**Capture. Detect. Locate. Report. Resolve.**

RoadVision lets a citizen report road damage without creating an account: open the browser camera, capture a **fresh** photo, explicitly share current GPS, review the evidence, and submit. The existing FastAPI/YOLO/OpenCV pipeline analyses the image, the Node/Express API stores the case and produces an unguessable public report ID, and citizens can follow a limited public timeline at `/track`. Authorized government officials use a separate, unadvertised portal to verify, assign, inspect, resolve and audit cases.

> AI results are assistive estimates, never a guarantee that a road is damaged. Officials make the final decision. If trained model weights are unavailable, results are clearly labelled **DEMO MODE**.

---

## What changed from the upload-centric app

- Primary citizen flow is camera-first: `navigator.mediaDevices.getUserMedia()` → fresh JPEG capture → retake/confirm → explicit browser Geolocation → submit.
- No file input, gallery picker, drag/drop, browse-files button or normal upload CTA in the citizen flow.
- No citizen login, registration, password, email login or phone login is required. Reports are anonymous/public and do not request unnecessary personal data.
- Public capability IDs (`RVR-YYYY-XXXXXXXXXX`) use secure randomness and are separate from internal MongoDB IDs. Public status lookup hashes the normalized ID; guessed IDs return 404.
- Exact GPS, original/annotated images, internal notes, administrative priority, incident IDs, report counts and audit details are **not** exposed through public endpoints. Public tracking shows a coarse area only.
- Status lifecycle is persisted in the database: `SUBMITTED`, `AI_ANALYSIS`, `AI_ANALYSED`, `UNDER_REVIEW`, `VERIFIED`, `REJECTED`, `ASSIGNED`, `IN_PROGRESS`, `RESOLVED`, `CLOSED`.
- A private government portal has separate server-side authentication, RBAC, short-lived httpOnly SameSite cookies, CSRF, lockout/rate limiting, session invalidation and append-only audit history. It is not linked from public navigation or public API docs.
- Legacy authenticated inspection APIs and tooling remain temporarily for compatibility, but are no longer advertised as the citizen path.

---

## Architecture at a glance

```text
Citizen mobile browser (HTTPS)
  React/Vite SPA → POST /api/v1/public/reports (multipart image + location)
                 → GET /api/v1/public/reports/:publicId/status
        │
        ▼
Express /api/v1  ── validation · rate limits · abuse guard · image storage abstraction
        │             public DTO (coarse location only)      official DTO (exact GPS)
        ├──────────────────────────► FastAPI /predict (YOLO/OpenCV or labelled demo engine)
        ├──────────────────────────► MongoDB 2dsphere reports, incidents, officials,
        │                            departments, system settings, append-only audit logs
        └──────────────────────────► Hidden operator SPA (separate auth/RBAC/CSRF)

Leaflet / Recharts dashboards use real stored data. No hardcoded statistics.
```

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md), [CITIZEN_REPORTING.md](CITIZEN_REPORTING.md), [GOVERNMENT_PORTAL.md](GOVERNMENT_PORTAL.md), [docs/API.md](docs/API.md), [docs/SECURITY.md](docs/SECURITY.md), [docs/AI_MODEL.md](docs/AI_MODEL.md) and [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md).

---

## Quick start (local development)

Camera and Geolocation require a secure context; `localhost` is the documented development exception. Production **must** terminate HTTPS in front of the frontend.

```bash
cp .env.example .env
# Install dependencies
(cd backend && npm ci)
(cd frontend && npm ci)
(cd ai-service && python3 -m venv .venv && . .venv/bin/activate && pip install -r requirements.txt -r requirements-dev.txt)

# Three terminals
(cd ai-service && . .venv/bin/activate && uvicorn app.main:app --reload --host 0.0.0.0 --port 8000)
(cd backend && npm run dev)       # http://localhost:5000
(cd frontend && npm run dev)      # http://localhost:5173
```

The Vite dev server proxies `/api` to the backend, so browser code uses same-origin relative URLs. For a container deployment:

```bash
docker compose up --build
# frontend: http://localhost:8080 · backend: http://localhost:5000 · AI: http://localhost:8000
```

Set three distinct long random secrets — `JWT_SECRET`, `HMAC_SECRET`, `OFFICIAL_JWT_SECRET` — plus `CLIENT_URL` to the HTTPS origin and `OFFICIAL_COOKIE_SECURE=true` in production. First official accounts are provisioned by a controlled server-side process; there is no public official registration endpoint. See [GOVERNMENT_PORTAL.md](GOVERNMENT_PORTAL.md) and [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md).

---

## Data modes and honest AI labelling

- `DATA_MODE=mongo` uses MongoDB and real stored reports.
- `DATA_MODE=demo` uses an explicitly labelled in-memory demo store; the UI shows a persistent demo banner.
- `AI_MODE=auto` uses real YOLO weights when installed, otherwise returns `demo: true`, `model.engine: "demo"` and `DEMO MODE` warnings. `AI_MODE=real` fails cleanly instead of silently substituting demo detections.
- No trained weights ship with the repository. `MODEL_CONFIDENCE_THRESHOLD` is the configured minimum gate; AI-service and backend gates use it and administrators may raise, but not lower, the backend gate.
- `No road damage detected.` is shown when no detection passes the configured threshold; the submission is preserved rather than fabricating a result.

---

## Tests & validation

```bash
cd backend  && npm test && npm run lint && npx tsc -p tsconfig.build.json --noEmit && npm run build
cd frontend && npm test && npm run lint && npx tsc --noEmit && npm run build
cd ai-service && . .venv/bin/activate && ruff check app tests && python -m pytest -q
```

Current suite: **backend 78 passing tests** (3 Mongo integration tests skipped without a running MongoDB), **frontend 35 passing tests**, **AI service 31 passing tests**. Security-focused suites explicitly check public/private separation, IDOR-style access, guessed IDs, direct image access, CSRF, RBAC, session expiry, production secret separation, rate limiting, malicious uploads and injection-shaped query/location payloads. A full-stack HTTP smoke script additionally verifies anonymous reporting, strict public DTOs, hidden-portal auth/CSRF/audit/logout, legacy token separation and labelled demo AI.

---

## Repository layout

| Path | Purpose |
| --- | --- |
| `frontend/` | React/Vite citizen camera flow, public tracking and hidden operator SPA |
| `backend/` | Express APIs, validation, repositories, auth/RBAC, storage abstraction, tests |
| `ai-service/` | FastAPI YOLO/OpenCV inference service with labelled demo fallback |
| `docs/` | Architecture, public API, security, security audit, AI model and deployment documentation |
| `CITIZEN_REPORTING.md` | Camera, permissions, location, privacy and public tracking |
| `GOVERNMENT_PORTAL.md` | Internal operator guide: provisioning, roles, auth, workflows, audit |
| `SECURITY_AUDIT.md` | Evidence-backed final security audit and acceptance checklist |
| `FINAL_REPORT.md` | Implementation, validation, limitations and delivery report |
| `docker-compose.yml` | MongoDB · AI service · backend · nginx frontend |
| `.env.example` | All configuration, including official/session, abuse and SLA settings |

## Documentation boundary

`docs/API.md` is the **public API** reference. The hidden government portal, its login route, provisioning and private endpoints are described only in `GOVERNMENT_PORTAL.md`, which is internal operator documentation and must not be published as public API docs or linked from public navigation, sitemaps or robots-indexable menus.
