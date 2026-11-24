# AI Road Damage Detection

A production-grade web + AI platform that analyses road images with computer
vision to detect potholes, cracks and surface damage — with confidence scores,
severity estimates, an inspection history, live analytics and an interactive
damage map.

> **See road damage before it becomes a bigger problem.**

![Stack](https://img.shields.io/badge/React%2018-TypeScript-61dafb) ![Stack](https://img.shields.io/badge/Node.js%20Express-API-3c873a) ![Stack](https://img.shields.io/badge/FastAPI%20PyTorch-AI-009688) ![Stack](https://img.shields.io/badge/MongoDB-Database-47a248)

---

## Contents

- [Overview](#overview) · [Features](#features) · [Architecture](#architecture)
- [Tech stack](#tech-stack) · [Repository structure](#repository-structure)
- [Quick start](#quick-start) · [Environment variables](#environment-variables)
- [AI model setup](#ai-model-setup) · [Testing](#testing) · [Production build & deployment](#production-build--deployment)
- [Documentation](#documentation) · [Limitations](#limitations) · [Troubleshooting](#troubleshooting)

## Overview

Road damage is slow and expensive to identify manually. This platform lets an
inspector photograph a road surface, run an AI analysis in seconds, and keep
every result as a structured, searchable record:

1. Upload a road image (drag & drop, optional GPS capture).
2. The backend validates it and calls the independent Python inference service.
3. Damage regions are located, classified (pothole / crack / surface damage /
   other), scored with confidence and ranked by estimated severity.
4. The annotated result is stored and displayed with an interactive viewer.
5. Dashboard, analytics and map views update from real stored data.

**Honesty first:** the repository contains the complete real inference
architecture (YOLO/PyTorch) but ships **without trained weights** — see
[AI model setup](#ai-model-setup). Until real weights are installed the service
runs a clearly-labelled **demo engine** whose every response is flagged
`demo: true` and shown with DEMO MODE banners in the UI. Nothing synthetic is
ever presented as real inference.

## Features

**Public site** — premium landing page, product tour, registration/login,
password recovery.

**AI analysis workspace** — drag & drop upload with validation, image preview,
optional geolocation (browser GPS or manual), real upload progress, honest
indeterminate analysis state, and a result view with original ↔ annotated
toggle, zoom/pan, hover-highlighted boxes and a per-detection list (class,
confidence, severity, coordinates).

**Inspection management** — history with search, filtering (damage type,
severity, date), sorting and pagination; detailed report pages with model
information, warnings and location; delete with confirmation.

**Dashboard & analytics** — total inspections/detections, pothole & high-severity
counts, damage trends over time, class & severity distributions, top affected
areas, date-range/type/severity filters — all computed from stored data (never
hardcoded).

**Damage map** — Leaflet map with severity-coded markers, filters, detail
popups and links to full reports. Location is always optional.

**Platform** — JWT auth with roles (user/inspector/admin), rate limiting,
input validation, secure headers, structured logging, health probes,
Docker Compose stack, GitHub Actions CI, responsive + accessible UI.

## Architecture

```
React + TypeScript + Vite + Tailwind  →  Node.js/Express REST API (/api/v1)
        ↑                                      ↓                ↓
   nginx (prod)                          MongoDB          Python FastAPI AI service
                                         (Mongoose)       (YOLO/PyTorch/OpenCV)
```

The three tiers are independent services; the Express API is the single
auth/validation boundary. The AI model sits behind a `DetectionEngine`
interface so it can be upgraded without touching the rest of the system.
Full details: **[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)**.

## Tech stack

| Layer | Technologies |
|---|---|
| Frontend | React 18, TypeScript, Vite, Tailwind CSS, TanStack Query, Recharts, Leaflet/react-leaflet, lucide-react |
| Backend | Node.js 22, Express 4, TypeScript, Mongoose 8, zod, JWT (jsonwebtoken), bcryptjs, helmet, pino |
| AI service | Python 3.11, FastAPI, Pydantic v2, Pillow/NumPy, (optional) Ultralytics YOLO · PyTorch · OpenCV |
| Database | MongoDB 7 (schemas + indexes + aggregation pipelines) |
| Quality | Vitest + Testing Library + supertest, pytest, ESLint, Prettier, ruff, GitHub Actions |
| Deploy | Docker / Docker Compose, nginx |

## Repository structure

```
├── frontend/            React SPA (components/, pages/, stores/, services/, hooks/)
├── backend/             Express API (controllers/, services/, repositories/, models/)
├── ai-service/          FastAPI inference (models/, services/, schemas/, classes.json)
├── docs/                ARCHITECTURE · API · AI_MODEL · SECURITY · DEPLOYMENT
├── scripts/smoke.sh     end-to-end HTTP smoke test
├── .github/workflows/   CI pipeline
├── docker-compose.yml   full stack: mongo + ai-service + backend + frontend
├── .env.example         all configuration variables (documented)
└── Makefile             install / dev / test / lint / build / smoke / up
```

## Quick start

### Option A — Docker (recommended)

```bash
cp .env.example .env        # set JWT_SECRET to a long random string
docker compose up --build
# → frontend http://localhost:8080 · API http://localhost:5000 · AI http://localhost:8000
```

### Option B — local processes

```bash
# 0. MongoDB running locally (or use DATA_MODE=demo, see below)
make install                # installs frontend + backend + ai-service deps

# 1. AI service
cd ai-service && . .venv/bin/activate
uvicorn app.main:app --host 0.0.0.0 --port 8000

# 2. Backend (new shell)
cd backend && npm run dev   # reads ../.env — or: DATA_MODE=demo DEMO_SEED=true npm run dev

# 3. Frontend (new shell)
cd frontend && npm run dev  # → http://localhost:5173
```

The frontend proxies `/api` to the backend port configured by `PORT` in the
repository-root `.env` (default `5000`). Set `VITE_API_URL` in the shell to
override the proxy target. If another app is already using port `5173`, start
the frontend on a free port, for example:

```bash
cd frontend && npm run dev -- --host 127.0.0.1 --port 5174 --strictPort
# → http://localhost:5174
```

**No MongoDB available?** Run the backend with `DATA_MODE=demo DEMO_SEED=true`:
an explicitly-labelled in-memory demo store (every API response is tagged
`meta.dataMode: "demo"` and the UI shows a permanent DEMO MODE banner). Demo
credentials with seeded data: `demo@rdd.local` / `demo1234`.

**Verify the whole stack:** `bash scripts/smoke.sh` — registers a user, runs a
real upload → AI analysis → storage cycle and checks history, analytics, map
and error handling.

## Environment variables

All variables are documented in [`.env.example`](.env.example). Highlights:

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | MongoDB connection string |
| `JWT_SECRET` | **required in production** — auth token signing key |
| `DATA_MODE` | `mongo` (production) or `demo` (labelled in-memory store) |
| `AI_SERVICE_URL` | backend → AI service address |
| `AI_MODE` | `auto` / `real` / `demo` engine selection |
| `MODEL_PATH` | trained YOLO weights location |
| `UPLOAD_DIRECTORY`, `MAX_UPLOAD_MB` | image storage and limits |
| `CLIENT_URL` | CORS origin allow-list |

## AI model setup

The inference service has two engines behind one interface:

* **Real engine** — Ultralytics YOLO on PyTorch (`ai-service/requirements-ml.txt`
  + trained weights at `MODEL_PATH`). This is the production path.
* **Demo engine** — deterministic image heuristics for evaluation without
  weights; every result is flagged `demo: true` end to end.

Installing real inference:

```bash
cd ai-service && . .venv/bin/activate
pip install -r requirements.txt -r requirements-ml.txt
cp your_trained_weights.pt models/road_damage_yolo.pt
AI_MODE=real uvicorn app.main:app --port 8000
curl localhost:8000/health   # expect: "engine": "yolo", "demo": false
```

No dataset or weights are bundled — see **[docs/AI_MODEL.md](docs/AI_MODEL.md)**
for the exact contract, class configuration, severity rules, suitable public
datasets (e.g. RDD2022) and how to plug in alternative models.

## Testing

```bash
make test        # everything below
cd backend  && npm test     # 49 tests: units + full API workflow (AI stubbed over HTTP)
                            # + MongoDB integration (mongodb-memory-server; runs in CI)
cd frontend && npm test     # 20 tests: components, forms, upload validation, utils
cd ai-service && . .venv/bin/activate && python -m pytest   # 29 tests
bash scripts/smoke.sh       # live end-to-end smoke against running services
```

Lint & type checks: `make lint` (ESLint + ruff) and `tsc` strict mode in both
TypeScript packages.

## Production build & deployment

```bash
make build       # backend tsc build + frontend vite build
make up          # docker compose up --build
```

Deployment guide (env hardening, TLS, volumes, health checks, scaling notes):
**[docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)**. CI runs lint, tests, builds and
Docker image builds on every push/PR (`.github/workflows/ci.yml`).

## Documentation

| Document | Contents |
|---|---|
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | system design, data flow, schema/indexing, testing strategy |
| [docs/API.md](docs/API.md) | every REST endpoint + AI service contract with examples |
| [docs/AI_MODEL.md](docs/AI_MODEL.md) | engine modes, weights installation, severity rules, datasets |
| [docs/SECURITY.md](docs/SECURITY.md) | auth model, validation, uploads, headers, rate limits, risks |
| [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) | environments, variables, Docker, production checklist |

## Limitations (read this)

* **No trained weights ship with the repository.** Without them the AI service
  runs the clearly-labelled demo engine. This is a deliberate, documented
  limitation — not hidden or faked functionality.
* **Confidence scores are model estimates**, not guarantees of real-world
  accuracy. **Severity is a heuristic ranking**, not a professional
  civil-engineering assessment — always verify critical findings on site.
* JWT sessions are stateless (no server-side revocation yet); email delivery
  for password recovery is an integration stub; rate limiting is per-instance.
* Demo mode stores data in memory — it resets on restart and is not for real
  user data.

## Troubleshooting

See the table in [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md#troubleshooting) for
common issues (AI service unreachable, database disconnected, CORS, rate
limits, upload rejections).
