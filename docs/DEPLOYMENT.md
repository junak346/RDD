# Deployment

## Topologies

| Environment | What runs | Notes |
|---|---|---|
| Local dev | `vite dev` + `tsx watch` + `uvicorn --reload` | Vite proxies `/api` to the backend |
| Docker Compose | `mongo` + `ai-service` + `backend` + `frontend(nginx)` | one-command full stack |
| Production | same containers behind a TLS reverse proxy | set real `JWT_SECRET`, `DATA_MODE=mongo` |

## Prerequisites

* Node.js ≥ 20, npm
* Python ≥ 3.11
* MongoDB ≥ 6 (or Docker)
* Optional for real AI: CUDA-capable GPU + `requirements-ml.txt`, trained
  weights (see `docs/AI_MODEL.md`)

## Environment variables

Root `.env.example` documents every variable. Summary:

| Variable | Service | Default | Notes |
|---|---|---|---|
| `NODE_ENV` | backend | `development` | `production` disables dev conveniences |
| `PORT` | backend | `5000` | |
| `DATABASE_URL` | backend | `mongodb://localhost:27017/rdd` | |
| `DATA_MODE` | backend | `mongo` | `demo` = labelled in-memory store |
| `DEMO_SEED` | backend | `false` | seed sample data in demo mode |
| `JWT_SECRET` | backend | dev placeholder | **required in production** |
| `JWT_EXPIRES_IN` | backend | `7d` | |
| `AI_SERVICE_URL` | backend | `http://localhost:8000` | |
| `UPLOAD_DIRECTORY` | backend | `uploads` | mount a volume in Docker |
| `MAX_UPLOAD_MB` | backend | `10` | |
| `RATE_LIMIT_*` | backend | 300 / 15 min | auth & analysis are stricter |
| `CLIENT_URL` | backend | `http://localhost:5173` | CORS allow-list (comma-separated) |
| `ADMIN_EMAILS` | backend | *(empty)* | registration allow-list for admins |
| `EXPOSE_RESET_TOKENS` | backend | `false` | dev/test only, forced off in production |
| `AI_MODE` | ai-service | `auto` | `auto` / `real` / `demo` |
| `MODEL_PATH` | ai-service | `models/road_damage_yolo.pt` | trained weights |
| `MODEL_CONFIDENCE_THRESHOLD`, `MODEL_IOU_THRESHOLD` | ai-service | `0.35`, `0.45` | |
| `MODEL_DEVICE` | ai-service | `auto` | `cpu` / `cuda` |
| `AI_MAX_IMAGE_MB` | ai-service | `16` | |

## Local development (without Docker)

```bash
# 1. AI service
cd ai-service && python3 -m venv .venv && . .venv/bin/activate
pip install -r requirements.txt -r requirements-dev.txt
uvicorn app.main:app --host 0.0.0.0 --port 8000

# 2. Backend (separate shell) — needs a MongoDB, or use demo mode
cd backend && npm install
cp ../.env.example ../.env       # adjust DATABASE_URL / JWT_SECRET
npm run dev                       # or: DATA_MODE=demo DEMO_SEED=true npm run dev

# 3. Frontend (separate shell)
cd frontend && npm install && npm run dev   # http://localhost:5173
```

Quick verification: `bash scripts/smoke.sh` (registers a user, uploads an
image through the full AI pipeline, checks history/analytics/map).

## Docker Compose

```bash
cp .env.example .env          # set JWT_SECRET (required)
docker compose up --build
# frontend: http://localhost:8080  ·  api: http://localhost:5000  ·  ai: http://localhost:8000
```

Notes:

* `backend` runs with `DATA_MODE=mongo` against the bundled MongoDB 7.
* Uploaded images persist in the `upload-data` volume; database in `mongo-data`.
* Real inference: `docker build --build-arg INSTALL_ML=true` for the AI image
  (or edit `docker-compose.yml`) and mount weights in `ai-service/models/`.

## Production checklist

- [ ] `JWT_SECRET` = long random value from a secret manager
- [ ] `DATA_MODE=mongo`, `DEMO_SEED=false`, `EXPOSE_RESET_TOKENS` unset
- [ ] TLS at the reverse proxy (nginx/Caddy/ALB) + HSTS
- [ ] `CLIENT_URL` set to the real frontend origin
- [ ] Persistent volumes/managed MongoDB with backups + authentication enabled
- [ ] Restrict MongoDB network exposure (private network only)
- [ ] Log aggregation (JSON logs are stdout-friendly)
- [ ] Health checks wired: `/health` (liveness), `/api/v1/health` (readiness)
- [ ] Trained weights installed and `GET /health` shows `engine: "yolo"`
- [ ] Email provider wired in `email.service.ts` before enabling recovery
- [ ] Review rate limits for expected traffic; add shared store for replicas

## CI (GitHub Actions)

`.github/workflows/ci.yml` runs four jobs on every push/PR:
backend (lint/type-check/test/build), frontend (lint/type-check/test/build),
ai-service (ruff/pytest) and Docker image builds. The backend job includes the
mongodb-memory-server integration tests (runners can download the MongoDB
binary).

## Troubleshooting

| Symptom | Fix |
|---|---|
| `503 AI_SERVICE_UNAVAILABLE` on upload | AI service not running or `AI_SERVICE_URL` wrong; check `curl localhost:8000/health` |
| `/api/v1/health` shows `database.connected: false` | MongoDB unreachable — check `DATABASE_URL`, container health, credentials |
| UI shows DEMO MODE banner | `DATA_MODE=demo` is active (or `meta.dataMode` says so) — switch to `mongo` for real data |
| `MODEL_UNAVAILABLE` from AI service | `AI_MODE=real` but weights/ML stack missing — see `docs/AI_MODEL.md` |
| CORS errors in browser | `CLIENT_URL` must match the frontend origin exactly (scheme + host + port) |
| `429 RATE_LIMITED` | raise `RATE_LIMIT_MAX_REQUESTS` or widen the window |
| Uploads rejected with `INVALID_IMAGE` | file must really be JPEG/PNG/WebP (magic bytes are checked) |
| Vite dev server rejects preview host | dev-only host allowlist — `server.allowedHosts` in `vite.config.ts` |
