# Security & privacy

> Hidden routes and `robots.txt` are discoverability controls, **not** access controls. All private data is protected by server-side authentication, RBAC, CSRF and repository-level validation.

## Trust boundaries

| Surface | Trust model |
| --- | --- |
| Citizen browser | Untrusted input; no account; no citizen-controlled identity fields. |
| nginx/Vite proxy | Security headers, HTTPS termination in production, `/api` same-origin proxy, private-route noindex/no-store, upload-directory denial. |
| Express public router | Anonymous, rate-limited, strict Zod/multipart/magic-byte validation, coarse public DTO. |
| Express official router | Separate cookie/JWT auth, RBAC, CSRF, role- and transition-checked case actions. |
| FastAPI AI service | Internal service; accepts bounded image; clearly labelled demo fallback; no trained weights shipped. |
| MongoDB | Workflow data, exact GeoJSON points, append-only audit logs, `2dsphere` and status indexes. |
| File storage | Protected random paths; cloud/S3 adapter hook; no public directory listing. |

## Authentication and session security

- Citizen reporting requires no login; no public official signup exists.
- Official accounts are provisioned by controlled bootstrap/CLI or an authenticated admin.
- Passwords require 12+ characters with upper/lowercase, number and symbol; bcrypt hashes; hashes are never returned or logged.
- Failed-login counters, temporary lockout, IP + hashed-email login limiter and generic error messages.
- Official session JWT uses a **separate key** from legacy citizen JWTs with `kind:official`, issuer `rdd-official-backend`, audience `rdd-official-portal`, short expiry, and a numeric session version.
- Session cookie is `httpOnly`, `SameSite=Strict`, `Secure` in production, scoped to `/api/v1/official`; legacy tokens in localStorage are ignored by `officialApi`.
- Non-httpOnly root-path CSRF cookie plus `X-CSRF-Token` header on state changes. Logout increments session version and clears both cookies without deprecated `maxAge`.
- Each request re-reads the official account and checks active status, email, role and session version. Expired/wrong-audience/wrong-kind tokens are rejected.

## Authorization

Role middleware and action-specific transitions enforce least privilege:

- `VIEWER` is read-only.
- `INSPECTOR` can verify/reject/note/inspect but cannot assign, close or bulk-update.
- `DEPARTMENT_OFFICIAL` can verify/reject/note/assign/manage status and export with permission, but cannot request inspection or administer.
- `SUPER_ADMIN`/`ADMIN` can configure settings, provision, bulk-update and close cases.
- Exact GPS and images require an authenticated, active official session and authorized report lookup; image responses use `private, no-store`.
- No audit update/delete repository methods exist. Permanent case deletion is not exposed; archival is preferred.

## Public privacy

The public DTO strictly omits exact GPS, images/image URLs, citizen PII, internal notes, audit history, IP hashes, suspicious flags, priority, internal incident IDs, report counts and department/official identities. Public tracking returns only a coarse `0.1°` area, reported accuracy, AI estimate, no-damage/demo flags, limited timeline and status message. `Cache-Control: no-store` is set. Guessed IDs, normalized-ID hashes and unknown IDs return 404 without enumeration clues.

No unnecessary personal data is requested. The citizen portal contains no email/phone/name/password field. Abuse guard stores only IP hash, image hash and coarse grid hash. The privacy notice asks citizens not to capture unnecessary personal or sensitive information and explains that an image+location are used to analyse/manage the report.

## Input and injection defence

- Strict Zod schemas reject unknown fields, unexpected multipart fields, arrays/objects where numbers/strings are required, `NaN`, `null` coercion, booleans, prototype-pollution-shaped keys, `$where`, `$ne` and other injection-shaped query parameters.
- Public IDs match a strict Crockford `RVR-YYYY-XXXXXXXXXX` pattern and are hashed before lookup. Mongo IDs are validated before query casting.
- Location uses strict numeric pre-processing rather than coercive `z.coerce.number()`; range, freshness, future and zero-island checks are enforced.
- CSV export escapes spreadsheet formula prefixes.
- Multer memory upload limits field/part/body/file count and size. Magic-byte sniffing accepts JPEG/PNG/WebP; declared MIME alone is insufficient.
- HMAC hashing uses `HMAC_SECRET`, a separate server-side key required in production, for public IDs, citizen capability tokens and abuse identifiers. Production refuses missing or reused `JWT_SECRET`, `HMAC_SECRET` and `OFFICIAL_JWT_SECRET` values.
- `helmet`, strict CSP with tile-origin exceptions, `Cross-Origin-Resource-Policy: same-origin`, credentialed CORS allowlist, `Referrer-Policy`, `Permissions-Policy` and `trust proxy 1` behind a known reverse proxy.
- CSP remains strict in development to avoid a weaker browser policy than production; localhost tile origins are allowed where needed.

## Anti-abuse, lifecycle and audit

- Global, public-report and official-login rate limiters with configurable windows.
- In-process abuse guard tracks hashed image, IP and coarse-grid frequency; configurable daily/duplicate/suspicious thresholds.
- Duplicate detection groups likely duplicate citizen reports near a configurable radius/window/damage type; individual reports are retained.
- Report lifecycle transitions are validated server-side; AI severity and administrative priority are distinct.
- Every important action writes an append-only audit event with actor, role, action, timestamp, internal/public report IDs and metadata, and publishes an internal domain event.
- `domainEvents.ts` is in-process; no SMS/email delivery is claimed without a configured provider.
- `MODEL_CONFIDENCE_THRESHOLD` is a hardcoded environment baseline; admin overrides can only raise the backend gate. AI-service and backend thresholds are both applied.

## AI integrity

- `AI_MODE=auto` may use a labelled heuristic demo engine when real weights are unavailable; `demo:true`, `model.engine:"demo"`, `DEMO MODE` warnings and persistent frontend banner make that explicit.
- `AI_MODE=real` fails cleanly rather than silently falling back to demo detections.
- “AI detected a likely …” and “Estimated severity” are probabilistic language, never guarantees. Officials make the final decision.
- `No road damage detected.` is returned when no detection passes the gate; no detections are fabricated.
- AI failure preserves the report with `AI_ANALYSIS_UNAVAILABLE` instead of lying about analysis.
- No trained weights are bundled; real deployments supply and version their model artifact.

## Deployment security checklist

- HTTPS everywhere; camera/geolocation do not work on insecure production origins.
- Set unique `JWT_SECRET`, `OFFICIAL_JWT_SECRET` and `HMAC_SECRET`, plus MongoDB credentials; rotate through a secret manager. CSRF uses random per-session double-submit tokens, not a global secret.
- Set `NODE_ENV=production`, `OFFICIAL_COOKIE_SECURE=true`, `CLIENT_URL` to the exact HTTPS origin, and restrict CORS origins.
- Keep MongoDB, AI service and file storage on a private network; expose only nginx and intentionally published ports.
- Back up MongoDB and protected image storage; verify restore; monitor audit logs, AI failures, rate limits and lockouts.
- `robots.txt` and nginx noindex directives are not access control; keep authentication tests in CI and perform periodic IDOR/CSRF/RBAC audits.
- Do not publish `GOVERNMENT_PORTAL.md` as public API docs or link private routes from public UI.
- Re-run `SECURITY_AUDIT.md`'s acceptance checklist after any change to auth, public DTOs, storage, nginx or deployment configuration.
