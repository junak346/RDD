# Deployment

## Prerequisites

- Docker Engine + Compose plugin (container deployment), or Node 20+, Python 3.11+, MongoDB 7+ for local processes.
- A public HTTPS origin. Browser camera and Geolocation require a secure context; `localhost` is only a development exception.
- Real YOLO weights if you intend to use trained inference. None are bundled; otherwise the service is explicitly labelled `DEMO MODE`.
- Strong, unique secrets in a secret manager. Do not reuse example values.

## Environment

Start from `.env.example`:

```bash
cp .env.example .env
```

Important production settings:

| Variable | Requirement |
| --- | --- |
| `NODE_ENV` | `production` |
| `DATA_MODE` | `mongo` for real persistent data; `demo` only for labelled testing |
| `DATABASE_URL` | MongoDB URI with credentials and TLS as appropriate |
| `JWT_SECRET` | Legacy JWT key, long random value, distinct from both other keys |
| `HMAC_SECRET` | Separate long random HMAC key for public IDs, citizen capabilities and IP hashes |
| `OFFICIAL_JWT_SECRET` | Separate long random key for official sessions |
| `OFFICIAL_COOKIE_SECURE` | `true` behind HTTPS (production default; explicitly false only for local HTTP Compose) |
| `OFFICIAL_JWT_EXPIRES_IN` | Short lifetime, default `8h` |
| `CLIENT_URL` | Exact public HTTPS origin(s), comma-separated; also used for credentialed CORS/CSP |
| `AI_SERVICE_URL`, `AI_MODE` | Internal AI URL; use `real` to fail cleanly if weights are unavailable |
| `MODEL_CONFIDENCE_THRESHOLD` | Environment baseline gate; admins may only raise the backend gate |
| `UPLOAD_DIRECTORY` | Persistent protected volume, never served as a public directory |
| `MAX_UPLOAD_MB`, `PUBLIC_REPORT_*` | Size/rate/abuse thresholds |
| `OFFICIAL_BOOTSTRAP_*` | Optional controlled first official account; remove after provisioning |

Security headers and CSP are emitted by both the backend and nginx. Review image/tile CDN origins before adding them to CSP.

## Docker Compose

`docker-compose.yml` defines:

- `mongodb`: persistent volume and healthcheck.
- `ai-service`: FastAPI on internal port 8000; health endpoint; `MODEL_CONFIDENCE_THRESHOLD`, `AI_MODE`, model path.
- `backend`: Express on port 5000; MongoDB URI, AI URL, secrets, persistent `UPLOAD_DIR` volume; waits for MongoDB/AI health.
- `frontend`: static React build served by nginx on port 8080; proxies `/api` to backend; security headers, private-route noindex/no-store, upload-path denial, SPA fallback.
- Upload volume shared only with backend; frontend never exposes it directly.

```bash
# .env must contain distinct JWT_SECRET, HMAC_SECRET and OFFICIAL_JWT_SECRET values.
docker compose config
# For local HTTP only, keep OFFICIAL_COOKIE_SECURE=false (the Compose default).
docker compose up --build -d
docker compose ps
docker compose logs -f backend ai-service
```

In production, terminate TLS at a trusted reverse proxy/CDN on port 443 and forward to nginx; set `NODE_ENV=production`, `OFFICIAL_COOKIE_SECURE=true`, three distinct secrets, and an exact `CLIENT_URL`. The config refuses a production start with missing or reused keys. The Compose HTTP port is for local/proxy use, not a substitute for HTTPS.

## First official account

No public official registration exists. Use one of:

```bash
# Controlled environment bootstrap on backend startup (MongoDB mode)
DATA_MODE=mongo \
OFFICIAL_BOOTSTRAP_EMAIL='admin@agency.example' \
OFFICIAL_BOOTSTRAP_PASSWORD='replace-with-a-strong-password' \
OFFICIAL_BOOTSTRAP_NAME='System Administrator' \
OFFICIAL_BOOTSTRAP_DEPARTMENT='Public Works' \
OFFICIAL_BOOTSTRAP_DESIGNATION='Administrator' \
npm --prefix backend run provision:official

# Or an authenticated SUPER_ADMIN/ADMIN creates officials in /official/admin
```

Remove bootstrap secrets after provisioning and store the password in a secret manager. See `GOVERNMENT_PORTAL.md` (internal operator documentation).

## Local development without containers

```bash
(cd backend && npm ci && npm run dev)
(cd frontend && npm ci && npm run dev)
(cd ai-service && python3 -m venv .venv && . .venv/bin/activate && pip install -r requirements.txt -r requirements-dev.txt && uvicorn app.main:app --reload --host 0.0.0.0 --port 8000)
```

Run MongoDB locally and point `DATABASE_URL` at it. Vite dev/preview binds `0.0.0.0`, allows preview hosts and proxies `/api` to the backend. Browser code uses relative `/api` URLs; no localhost cross-origin calls.

## Model deployment

See [AI_MODEL_DEPLOYMENT.md](AI_MODEL_DEPLOYMENT.md). Place weights in the configured model path; set `AI_MODE=real` for clean failure if unavailable; version and monitor model precision/recall and latency. The AI service enforces `MODEL_CONFIDENCE_THRESHOLD`, while the backend applies the highest of its baseline, admin override and model-reported threshold.

## CI/CD and smoke validation

CI runs backend lint/typecheck/tests/build, frontend lint/typecheck/tests/build, AI `ruff`/`pytest`, `docker compose config -q`, `nginx -t` against the checked-in nginx files, and Docker image builds. `scripts/smoke.sh` verifies public camera/GPS reporting, public DTO privacy, hidden-portal auth/CSRF/audit/logout, legacy token separation, labelled demo AI and legacy compatibility. Recommended post-deploy checks:

1. `GET /api/v1/health` and AI `GET /health`.
2. `/api/v1/public/config` returns secure-context requirements and no private data.
3. A fresh camera capture with real browser GPS returns an `RVR-…` ID; `/track` accepts it and guessed IDs return 404.
4. Public DTO has no exact coordinates, image URL, priority, incident ID, notes or audit metadata.
5. Unauthenticated private endpoints fail; a citizen JWT cannot substitute for official auth; state changes without CSRF fail.
6. Low-confidence detections are gated; no detections produce `No road damage detected.`; demo mode is labelled.
7. An official session can see protected image/exact GPS and an action append-only audit appears; logout invalidates the token.
8. nginx denies direct upload paths, private routes emit noindex/no-store, camera/geolocation policy is correct, and all APIs are HTTPS-only in production.

## Backups and operations

- Back up MongoDB (`roadReports`, `incidents`, `officials`, `departments`, `auditLogs`, `systemSettings`) and the protected upload volume together; test restoration.
- Monitor AI timeouts/unavailability (reports must still be preserved), 429/lockout counts, suspicious duplicate flags, SLA/overdue counts and audit volume.
- Rotate the separate JWT/HMAC/official-session secrets with a planned session revocation; increment official session versions when needed. CSRF uses random per-session double-submit tokens, not a global signing secret.
- Keep legacy compatibility endpoints behind existing auth until clients are migrated; do not advertise them as citizen reporting.
- `domainEvents.ts` is in-process. For multi-instance deployment, replace it with Redis/Kafka/WebSocket/SSE; do not claim email/SMS delivery without configuring a provider.
