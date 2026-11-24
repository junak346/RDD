# Security

## Threat model summary

The platform accepts untrusted image uploads and serves authenticated data to
web and mobile clients. Primary risks: credential compromise, malicious file
uploads, injection (NoSQL/XSS), abuse (rate/resource exhaustion), and secret
leakage. Mitigations below map to each.

## Authentication & sessions

* Passwords hashed with **bcrypt (12 rounds)** — never stored or logged in
  plain text. Password policy: ≥ 8 chars, letters + digit.
* Stateless **JWT** sessions (`Authorization: Bearer`), `iss`-validated,
  configurable expiry (default 7 days), signed with `JWT_SECRET` (≥ 16 chars
  enforced at boot; use 32+ random bytes in production).
* **No cookies are used for auth**, which removes the classic CSRF attack
  surface (browsers do not attach credentials automatically).
* Login failures return an identical `401 INVALID_CREDENTIALS` for unknown
  email and wrong password (no account enumeration).
* Password reset: random 32-byte token, **only its SHA-256 hash is stored**,
  single-use, 30-minute TTL (Mongo TTL index), generic 202 response.
  `EXPOSE_RESET_TOKENS` is forced off whenever `NODE_ENV=production`.
* Roles (`user` / `inspector` / `admin`) enforced by `requireRole`; admin
  routes (e.g. `GET /users`) are unreachable for normal users. Admin accounts
  are only created via the `ADMIN_EMAILS` allow-list at registration.

## Authorization

* Every inspection/image route checks **ownership or admin** before returning
  data; cross-user access returns `403 FORBIDDEN`, missing records `404`.
* Images are served only through authenticated endpoints (Bearer header) —
  never as open static files.

## Input validation

* All request bodies/queries/parses validated with **zod** schemas →
  consistent `422 VALIDATION_ERROR` with field-level details; unknown/invalid
  types (including severity enums, coordinates, pagination caps) are rejected.
* NoSQL-injection surface is reduced by typed coercion (zod) and Mongoose
  schema casting; string filters are regex-escaped before use.
* XSS: React escapes all rendered values by default; the API returns JSON only
  (no HTML); `helmet` sets `X-Content-Type-Options`, CSP, `X-Frame-Options`,
  `Referrer-Policy` and related headers.

## File upload handling

* Only **JPEG / PNG / WebP** accepted, verified twice: declared MIME filter
  plus **magic-byte sniffing** of the actual content (`utils/filenames.ts`).
* Size capped (`MAX_UPLOAD_MB`, default 10 MB) at the middleware and again in
  the AI service (`AI_MAX_IMAGE_MB`).
* Stored file names are **server-generated UUIDs** with extensions derived
  from sniffed content — client file names never touch the filesystem path
  (path-traversal-proof) and are kept only as sanitized display metadata.
* Uploads live outside application source (`UPLOAD_DIRECTORY`), are never
  executed, and are served with their correct `Content-Type`.
* The AI service additionally guards against decompression bombs
  (`Pillow.MAX_IMAGE_PIXELS`, dimension/pixel caps) and corrupted files.

## Abuse protection

* Tiered **rate limiting** (global 300/15 min, auth 20/15 min, analysis
  75/15 min) with standard `RateLimit` headers.
* JSON body limit 2 MB; multipart limited by multer config.
* AI calls carry a hard timeout (`AI_TIMEOUT_MS`, default 60 s) so a slow
  inference service cannot exhaust API workers; failures map to clean 503s.

## Secrets & configuration

* All secrets come from environment variables (`.env` loaded locally, never
  committed — `.gitignore` blocks `.env*`; only `.env.example` is tracked).
* Production runs must set `JWT_SECRET`; docker-compose refuses to start
  without it (`${JWT_SECRET:?...}`).
* Structured logs **redact** `authorization`, `cookie`, password fields,
  tokens and reset tokens at the logger level.

## Error handling & information leakage

* Centralised error middleware returns stable machine codes and human-safe
  messages; stack traces and internals are logged server-side only.
* 404 handler prevents framework/version banners (`x-powered-by` disabled).
* Database and AI failures surface as `503` with generic text.

## Network / transport

* CORS restricted to configured `CLIENT_URL` origins (no credentials mode).
* Docker deployment serves everything from one nginx origin (recommended
  behind TLS). Production checklist: enable HTTPS/HSTS at the reverse proxy,
  keep `trust proxy` configured for correct client IPs in rate limiting.

## Dependency hygiene

* Lockfiles committed (`package-lock.json`); `npm ci` in CI/Docker builds.
* No post-install scripts of untrusted packages; Python deps pinned by range
  to major versions.
* CI runs lint + tests + builds on every push/PR (`.github/workflows/ci.yml`).

## Known limitations / residual risks

* Stateless JWTs cannot be revoked server-side before expiry (logout is
  client-side); a revocation list or short-lived + refresh tokens is the
  planned hardening step.
* Email delivery is a stub (`email.service.ts`) — wire a real provider before
  enabling password recovery in production.
* Rate limiting is per-instance; multi-replica deployments should back it with
  a shared store (e.g. Redis) or API gateway limits.
* Demo mode (`DATA_MODE=demo`) is for evaluation only — it stores data in
  process memory and must not be used with real user data.
