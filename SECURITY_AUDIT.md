# Final security audit

**Scope:** anonymous citizen reporting, public status DTO, hidden government portal, official auth/RBAC/CSRF, protected images and exact GPS, AI trust labelling, deployment/configuration files, and legacy compatibility routes.

**Verdict:** all automated acceptance checks in the current workspace pass. Hidden routes, `robots.txt` and noindex header directives remain *discoverability controls only*; every private API independently enforces authentication, role, CSRF and repository-level checks.

---

## Acceptance questions — all answers must be NO

| Question | Answer | Evidence |
| --- | --- | --- |
| Can an anonymous public response expose exact latitude/longitude, original/annotated image bytes or URLs? | **NO** | Strict `toPublicReportDto()` plus `backend/tests/api/civic.security.test.ts`; `scripts/smoke.sh` checks status payload and `Cache-Control: no-store`. |
| Can public tracking expose internal notes, audit history, IP hash, priority, incident IDs, report counts or department/official identities? | **NO** | Strict public DTO, privacy assertions in security/API tests, smoke script. |
| Can a guessed, sequential or malformed public ID enumerate a report? | **NO** | `RVR-YYYY-XXXXXXXXXX` format, secure Crockford randomness, hashed lookup, 404 tests. `scripts/smoke.sh` checks a guessed ID. |
| Can a direct upload path or public image URL serve a citizen photo? | **NO** | No public image route; images are served only by the authenticated official image endpoint with `private, no-store`; nginx denies `/uploads` and `/upload-data`. |
| Can unauthenticated callers read official reports, exact GPS or images? | **NO** | `requireOfficialAuth` on every route after `/auth/login`; security tests and smoke script expect 401. |
| Can a legacy citizen JWT substitute for an official session? | **NO** | Separate `OFFICIAL_JWT_SECRET`, issuer, audience, `kind:'official'`, numerical session version, and repository revalidation; security tests and smoke script. |
| Can an expired or logged-out official session still work? | **NO** | `exp`, session-version invalidation, logout cookie clearing, security test and smoke script. |
| Can a `VIEWER` or lesser role change case status or provision a `SUPER_ADMIN`? | **NO** | `requireOfficialRole`, action-specific role table, status-flow checks; `backend/tests/api/civic.security.test.ts` and `civic.api.test.ts`. |
| Can a state-changing official request skip CSRF? | **NO** | Double-submit CSRF cookie/header with constant-shaped comparison; security test and smoke script expect 403. |
| Can a malicious location, multipart body, `$ne`/`$where` query or declared-only image type bypass validation? | **NO** | Strict Zod pre-processing, finite/range/freshness checks, magic-byte sniffing, `multer` limits; security tests. |
| Are password hashes, session tokens or passwords returned in DTOs/audit logs? | **NO** | `toPublicOfficial`, login DTO, audit event metadata; security tests explicitly assert absence. |
| Can audit entries be silently updated or deleted through the repository? | **NO** | `ICivicRepository` exposes append/list only for audit logs; role-gated admin actions append new events. |
| Can an administrator lower the `MODEL_CONFIDENCE_THRESHOLD` baseline? | **NO** | `systemSettings.service.ts` clamps values to `[baseline, 1]`; `civicSettings.test.ts` covers raise/lower and validation. |
| Is any heuristic demo inference presented as trained-model output? | **NO** | `demo:true`, `model.engine:"demo"`, `DEMO MODE` banner/warnings, `aiDemo` flag, docs and AI-service tests. |
| Does a failed AI call fabricate detections or lose the report? | **NO** | Report stays `SUBMITTED` with `AI_ANALYSIS_UNAVAILABLE`; low-confidence outputs become `No road damage detected.`. |
| Are `robots.txt`/hidden routes used as the actual access control? | **NO** | Repeated in `README.md`, `GOVERNMENT_PORTAL.md`, `docs/SECURITY.md`, `frontend/public/robots.txt`, `frontend/nginx.conf` and server-side middleware. |

---

## Controls verified

### Application and API

- Public `/public/*` routes do not receive or require a citizen JWT; strict DTO omits exact GPS, images, notes, priority, incident data, audit metadata and internal IDs.
- Public IDs are unguessable and hashed; internal Mongo IDs are never returned publicly.
- Official login is the only unauthenticated private endpoint; all other routes re-read the official account, status, email, role and session version.
- Session cookie is `httpOnly`, `SameSite=Strict`, API-path scoped, and `Secure` by default in production. CSRF cookie is readable by the SPA at root path; the session cookie is not.
- Production config now requires three distinct secrets: `JWT_SECRET`, `HMAC_SECRET`, `OFFICIAL_JWT_SECRET`. It refuses missing or reused keys; explicit `OFFICIAL_COOKIE_SECURE=false` is allowed only with a warning for local HTTP Compose.
- bcrypt password hashing, strong provisioning policy, failed-login counter, temporary lockout and IP/hashed-email login limiter.
- RBAC, CSRF, status-flow lifecycle, permissioned CSV export and guarded spreadsheet formula prefixes.
- Append-only audit events for submission, AI analysis, duplicate grouping, case actions, settings, departments and officials.
- HMAC hashing for public IDs, citizen capability tokens and IP hashes uses the separate `HMAC_SECRET` key.
- Original/annotated image responses are `private, no-store`; uploads are never served from a public directory.
- CSV escaping, strict JSON/multipart validation, magic-byte image checks, request/image/field limits and abuse guard.
- `helmet` CSP, `Permissions-Policy`, `Cross-Origin-Resource-Policy`, credentialed CORS allowlist, `trust proxy 1` behind one known reverse proxy.
- Mongo `2dsphere` and workflow indexes; fixed `updatedAt` index (the domain DTO maps it to `lastUpdatedAt`).
- Hidden portal has no public navigation/footer/menu/sitemap links; dynamic `noindex, nofollow, noarchive` meta on login and command layout.
- Legacy authenticated APIs remain temporarily but are separated from official auth and no longer advertised as the citizen flow.

### AI integrity

- `MODEL_CONFIDENCE_THRESHOLD` is enforced in FastAPI before severity/annotation/persistence; backend gate is `max(environment baseline, permitted admin override, model threshold)`.
- Optional segmentation polygon data is preserved from `RawDetection` → `Detection` → backend `DetectionRecord` → official detail UI; bounding boxes remain the universal contract.
- `No road damage detected.` is returned when no detection survives the gate; no detections are fabricated.
- `AI_MODE=real` fails cleanly without trained weights; `auto` labels demo fallback; no weights are bundled.
- AI language is probabilistic (“AI detected a likely …”, “Estimated severity”); official decisions are separate from AI severity and administrative priority.

### Deployment configuration

- `docker-compose.yml` requires `JWT_SECRET`, `HMAC_SECRET`, `OFFICIAL_JWT_SECRET`; MongoDB, AI service, backend and nginx frontend are separate; upload volume is backend-only.
- `frontend/nginx.conf`, `frontend/nginx-map.conf` and `frontend/nginx-headers.conf` use `$request_uri` maps so noindex/no-store/capability-policy headers survive SPA fallbacks; security headers also apply to static assets.
- Upload paths are denied; `/api` is proxied; `client_max_body_size 20m`.
- `robots.txt` disallows private routes and explicitly states it is not access control.
- CI runs backend/frontend/AI checks, Compose config validation, nginx config validation and Docker builds.

---

## Validation performed

| Check | Result |
| --- | --- |
| Backend `npm test -- --reporter=dot` | **78 passed, 3 skipped** (Mongo integration skipped without MongoDB) |
| Backend lint, typecheck, build | passed |
| Frontend `npm test` | **35 passed** |
| Frontend lint, `tsc --noEmit`, build | passed |
| AI `ruff check app tests && pytest -q` | **31 passed**, one non-failing Starlette deprecation warning |
| Full-stack HTTP `scripts/smoke.sh` | all checks passed in `DATA_MODE=demo` with labelled demo AI |
| Compose/CI YAML parse and env-reference audit | passed; 35 Compose env references all documented |
| nginx config via `crossplane` parser | `status=ok`, 3 URI maps, 8 security headers, 7 locations |
| `git diff --check` / `bash -n scripts/smoke.sh` | passed |
| Browser-preview CORS probe | proxied `/api/v1/public/config` returned the exact preview origin and `Access-Control-Allow-Credentials: true` |

React Router future-flag warnings are non-failing. AI demo-engine startup warnings are expected because the ML stack and trained weights are not installed in this sandbox.

## Residual limitations / honest boundaries

- No real MongoDB was running in this workspace, so the three Mongo integration tests were skipped. Memory/demo repositories and full API smoke were exercised; run `DATA_MODE=mongo npm test` against MongoDB before production.
- No trained YOLO checkpoint/ML stack is installed here; live inference used the explicitly labelled demo engine. Real deployments must supply versioned weights and validate local precision/recall.
- Browser camera and Geolocation were not exercised by a physical device in the sandbox. Production requires HTTPS; frontend hooks and tests cover permission, secure-context and unsupported-browser behaviour.
- Docker and native `nginx` binaries are unavailable in this sandbox, so `docker compose config -q` and `nginx -t` were not executed locally. Their YAML/config content was parsed and is enforced in CI.
- `domainEvents.ts` is in-process; multi-instance real-time notifications require Redis/Kafka/WebSocket/SSE. No SMS/email delivery is claimed without a provider.
- MFA/SSO is a documented integration point, not a deployed feature. The current implementation provides separate issuer/audience/session-version revocation and audit-ready primitives.
- Hidden-route obscurity is not an authentication boundary; maintaining server-side checks in CI is mandatory.
