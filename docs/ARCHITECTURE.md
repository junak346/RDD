# Architecture

## System overview

```
┌──────────────────┐      ┌───────────────────────────┐      ┌──────────────────────────┐
│  React SPA       │      │  Node.js / Express API    │      │  Python / FastAPI        │
│  (TypeScript,    │ ───► │  /api/v1/*                │ ───► │  AI inference service    │
│   Vite, Tailwind)│      │  auth · validation ·      │      │  POST /predict           │
│                  │ ◄─── │  storage · analytics      │ ◄─── │  YOLO / PyTorch / OpenCV │
└──────────────────┘      └────────────┬──────────────┘      └──────────────────────────┘
        ▲                              │
        │  nginx (prod) / Vite proxy   │  Mongoose ODM
        │                              ▼
        │                    ┌──────────────────┐
        └──────────────────  │  MongoDB 7       │
                             │  users,          │
                             │  inspections,    │
                             │  password_resets │
                             └──────────────────┘
```

The three application tiers are independent processes that communicate over
HTTP. The frontend never talks to the AI service or the database directly — all
data flows through the Express API, which is the single authorisation and
validation boundary.

## Request lifecycle: image analysis

1. User drops an image on `/app/analyze` (client-side type/size validation).
2. `POST /api/v1/inspections` (multipart) — Bearer JWT required.
3. Backend middleware: rate limit → auth → multer (memory buffer) → zod fields.
4. `storage.service` sniffs magic bytes (JPEG/PNG/WebP only) and writes the
   original under a server-generated UUID name in `UPLOAD_DIRECTORY`.
5. `ai.client` calls `POST {AI_SERVICE_URL}/predict` with a hard timeout.
6. AI service: validate/decode → engine inference → severity estimation →
   annotated JPEG → structured JSON (typed pydantic schema).
7. Backend persists the inspection (detections embedded), stores the annotated
   image, and returns the full record.
8. Frontend caches it via React Query; dashboard/analytics/map queries refresh.

If the AI service is unavailable the request fails with a clean
`503 AI_SERVICE_UNAVAILABLE` and **no partial record is persisted** — results
are never fabricated.

## Backend layering

```
routes/        URL → middleware → controller wiring (no business logic)
controllers/   HTTP concerns only (parse request, call service, envelope response)
services/      business logic (auth, inspections, analytics, AI client, storage)
repositories/  data access contract + two implementations:
               ├── mongo/    Mongoose schemas + aggregations (production)
               └── memory/   in-process store (explicitly-labelled demo mode)
models/        Mongoose schemas with indexes
validators/    zod schemas + validate() middleware (422 with field details)
middleware/    auth, rate limiting, uploads, centralised error handling
config/        env parsing (zod), fails fast on misconfiguration
```

### Data modes

`DATA_MODE` selects the repository implementation:

| Mode | Store | Behaviour |
|---|---|---|
| `mongo` (default) | MongoDB via Mongoose | Production. |
| `demo` | In-memory maps | Every API response is tagged `meta.dataMode: "demo"`; the UI shows a permanent DEMO MODE banner. Optional `DEMO_SEED=true` loads clearly-labelled sample records (demo user `demo@rdd.local` / `demo1234`). |

The two implementations satisfy the same `Repositories` interface
(`repositories/types.ts`), so services are written once and stay testable
without a database.

## AI service structure

```
ai-service/app/
├── api/          FastAPI routers (predict, model info, health)
├── core/         config, typed errors, logging
├── models/       engine implementations + selection registry
│   ├── base.py           DetectionEngine interface (swap models freely)
│   ├── yolo_engine.py    real Ultralytics YOLO backend (lazy imports)
│   ├── demo_engine.py    labelled heuristic engine (demo=true responses)
│   └── registry.py       AI_MODE=auto|real|demo policy
├── services/     preprocessing · severity · visualization · orchestration
├── schemas/      pydantic response schemas (OpenAPI-visible)
└── classes.json  configurable damage-class catalogue
```

The application depends only on the `DetectionEngine` interface. Swapping in a
new model (different YOLO generation, segmentation model, TensorRT export)
means adding one engine class — no API/service changes.

## Severity engine

`services/severity.py` computes a score from three observable signals:

```
score = 0.50 · size_signal(bbox_area / image_area, saturating at 25% coverage)
      + 0.30 · detector_confidence
      + 0.20 · class_prior(classes.json severity_weight)
```

Thresholds: `score ≥ 0.60 → high`, `≥ 0.35 → moderate`, else `low`.
This is a **documented heuristic estimate**, not a civil-engineering verdict —
the disclaimer is part of every report page and of `docs/AI_MODEL.md`.

## Database schema & indexing

**users** — `name, email(unique), passwordHash(select:false), role(user|inspector|admin), timestamps`
Indexes: `{email: 1} unique`, `{createdAt: -1}`.

**inspections** — `userId, image ref, annotatedImage ref, timestamp, location{lat,lng,address}, status,
model info, processingTimeMs, aiWarnings, detections[embedded], summary, timestamps`
Indexes:
- `{userId: 1, createdAt: -1}` — history lists (most common query)
- `{createdAt: -1}` — global recency / admin views
- `{detections.className: 1}` — damage-type filtering (multikey)
- `{detections.severity: 1}` — severity filtering (multikey)
- `{location.latitude: 1, location.longitude: 1}` — map/geo range queries

**password_resets** — `userId, tokenHash(unique), expiresAt, usedAt` with a
TTL index on `expiresAt` (expired tokens removed automatically).

Detections are embedded documents (one inspection → few detections) to avoid an
extra collection and joins; the multikey indexes make per-class analytics fast.
Analytics use MongoDB aggregation pipelines (`$facet`, `$unwind`, `$group`).

## Frontend architecture

```
src/
├── components/
│   ├── ui/           design-system primitives
│   ├── layout/       AppShell (sidebar/drawer), PublicLayout, DemoBanner
│   ├── analysis/     Dropzone, ImageViewer (zoom/pan/toggle), DetectionList
│   └── charts/       recharts wrappers (trend, pie, bar)
├── pages/            one file per route
├── stores/           auth context, toast system
├── hooks/            useAuthImage (blob loading), useGeolocation, useDebounce
├── services/         axios client + typed API modules
└── utils/            formatting, severity/class color maps, cn()
```

Data fetching uses TanStack Query for caching, loading/error states and
invalidation after mutations. Auth tokens are held in `localStorage` and sent
as `Authorization: Bearer` headers (no cookies → CSRF surface is minimal).

## Deployment topologies

* **Development** — three dev servers; Vite proxies `/api` to the backend.
* **Docker Compose** — `mongo`, `ai-service`, `backend`, `frontend`
  (nginx serving the built SPA and proxying `/api` to the backend).
* **Production** — the same containers behind a TLS-terminating reverse proxy;
  see `docs/DEPLOYMENT.md`.

## Observability

* Structured JSON logs (pino) with centralised redaction of secrets.
* `GET /health` — liveness. `GET /api/v1/health` — readiness including
  database connection state and AI service reachability/mode.
* AI service logs every prediction with demo flag, count and duration.

## Testing strategy

| Layer | Tool | What it covers |
|---|---|---|
| Frontend | Vitest + Testing Library | components, forms, upload validation, utils |
| Backend unit | Vitest | filenames/magic bytes, hashing, JWT, zod schemas, AI client contract (mocked HTTP) |
| Backend API | Vitest + supertest | full workflow against an HTTP stub speaking the real AI contract; auth, validation, permissions, analytics math |
| Backend DB | Vitest + mongodb-memory-server | real MongoDB semantics + aggregations (skips gracefully where the binary cannot be downloaded; runs in CI) |
| AI service | pytest + FastAPI TestClient | endpoints, response schema, image validation, severity rules, visualisation, mocked YOLO parsing |
| E2E smoke | `scripts/smoke.sh` | live stack: register → upload → analysis → history → analytics → map → delete |

## Security architecture

See `docs/SECURITY.md` for the full model (authentication, validation, upload
handling, headers, rate limiting, secret management).
