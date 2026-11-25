# Government response portal — INTERNAL OPERATOR DOCUMENTATION

> **Internal only.** This file is not public API documentation and must not be linked from public navigation, footer, landing page, mobile menu, sitemap, robots-indexable menu or a public developer portal. Route obscurity is **not** security: every private API independently enforces authentication, RBAC, CSRF and session validity.

## Access and discoverability controls

- Unadvertised SPA login path: `/official-access`.
- Protected command pages: `/official`, `/official/reports`, `/official/reports/:id`, `/official/map`, `/official/hotspots`, `/official/incidents`, `/official/analytics`, `/official/notifications`, `/official/audit`, `/official/admin`, `/official/departments`, `/official/officials`.
- No Government Login link appears in `PublicLayout`, the landing page, footer, public menu, mobile menu or `NotFoundPage`.
- `robots.txt` disallows the private paths; nginx adds `X-Robots-Tag: noindex, nofollow, noarchive` and `Cache-Control: no-store` for the login and command pages, and denies camera/geolocation on those routes.
- Official pages set a `noindex, nofollow, noarchive` meta tag dynamically.
- Public API documentation (`docs/API.md`) deliberately omits private routes and endpoints.

## Authentication architecture

| Control | Implementation |
| --- | --- |
| Separate identity | `officials` collection; legacy citizen/user accounts cannot become officials. |
| Provisioning | Server-side bootstrap (`OFFICIAL_BOOTSTRAP_*` / `ensureCivicBootstrap()`), controlled CLI (`cd backend && npm run provision:official`), or an authenticated `SUPER_ADMIN`/`ADMIN` provisioning action. No public self-registration. |
| Password policy | Minimum 12 characters with upper/lowercase, number and symbol; bcrypt hashes; password hashes are never returned or logged. |
| Login throttling | IP + hashed-email rate limiter; failed-attempt counter and temporary account lockout (`OFFICIAL_LOGIN_MAX_FAILURES`, `OFFICIAL_LOCKOUT_MINUTES`). |
| Session | Short-lived JWT (`OFFICIAL_JWT_EXPIRES_IN`, default `8h`) in an `httpOnly`, `SameSite=Strict`, `Secure` cookie scoped to `/api/v1/official`. Separate key, issuer (`rdd-official-backend`), audience (`rdd-official-portal`), token kind and numeric session version. |
| CSRF | Non-httpOnly root-path double-submit CSRF cookie plus `X-CSRF-Token` header on every state-changing route; constant-shaped comparison. |
| Session invalidation | Logout increments the account session version; subsequent tokens/cookies fail. Expired tokens are rejected. |
| Revalidation | Every request re-reads the official from the repository and checks active status, email, role and session version. |
| Frontend separation | `officialApi.ts` uses credentialed same-origin requests and never reads the legacy citizen JWT from localStorage. |
| MFA / SSO readiness | Separate issuer/audience/actor model, session-version revocation and append-only audit events provide a clean insertion point for institutional SSO/WebAuthn/TOTP. No fake verification is claimed. |

## Roles and server-side permissions

Roles: `SUPER_ADMIN`, `ADMIN`, `INSPECTOR`, `DEPARTMENT_OFFICIAL`, `VIEWER`.

| Capability | SUPER_ADMIN | ADMIN | INSPECTOR | DEPARTMENT_OFFICIAL | VIEWER |
| --- | --- | --- | --- | --- | --- |
| Dashboard, reports list/detail, map, analytics, notifications, audit read | ✅ | ✅ | ✅ | ✅ | ✅ |
| Exact GPS and protected image retrieval | ✅ | ✅ | ✅ | ✅ | ✅ |
| Verify / reject / mark in progress / add internal note | ✅ | ✅ | ✅ | ✅ | ❌ |
| Request inspection | ✅ | ✅ | ✅ | ❌ | ❌ |
| Assign department / official, change priority, mark resolved | ✅ | ✅ | ❌ | ✅ | ❌ |
| Close case / bulk status / create officials / create departments / edit settings | ✅ | ✅ | ❌ | ❌ | ❌ |
| Permissioned CSV export | ✅ | ✅ | ❌ | ✅ | ❌ |
| Permanent delete | ❌ | ❌ | ❌ | ❌ | ❌ |

Role checks are enforced by `requireOfficialRole(...)`, `assertActionRole(...)` and status-transition rules. Frontend hiding is convenience only. Ordinary officials cannot silently change history: repositories expose no audit update/delete operation. Archiving/soft-delete is preferred over permanent deletion.

## Private API surface

All routes below require `requireOfficialAuth`; state changes additionally require CSRF and the indicated role.

| Method | Path | Purpose |
| --- | --- | --- |
| `POST` | `/api/v1/official/auth/login` | Only unauthenticated official route; rate-limited. |
| `POST` | `/api/v1/official/auth/logout` | CSRF; increments session version and clears cookies. |
| `GET` | `/api/v1/official/auth/me` | Current official DTO. |
| `GET` | `/api/v1/official/dashboard` | Real stored counts: totals, new, review, verified, high priority, in progress, resolved, overdue. |
| `GET` | `/api/v1/official/notifications` | Real new/overdue/assigned counts; no fake SMS/email delivery. |
| `GET` | `/api/v1/official/analytics` | Real timeseries, class/severity/department counts, resolution rate, descriptive hotspots. |
| `GET` | `/api/v1/official/map/reports` | Authorized exact-coordinate map markers. |
| `GET` | `/api/v1/official/incidents` | Grouped incidents with citizen report counts. |
| `GET` | `/api/v1/official/audit-logs` | Append-only audit history. |
| `GET` | `/api/v1/official/events` | Admin-only internal domain events for real-time-ready adapters. |
| `GET/PATCH` | `/api/v1/official/config` | Stored SLA/priority/duplicate/model-gate settings; PATCH is admin-only and audited. |
| `GET/POST` | `/api/v1/official/departments` | Configurable departments; creation is admin-only. |
| `GET/POST` | `/api/v1/official/officials` | Assignee list; provisioning is admin-only. |
| `GET` | `/api/v1/official/reports` | Search, status/severity/priority/department/official/damage/date/overdue filters, sort, pagination. |
| `GET` | `/api/v1/official/reports/export.csv` | Permissioned, CSV-formula-guarded export. |
| `POST` | `/api/v1/official/reports/bulk/status` | Admin bulk status with per-report audit. |
| `GET` | `/api/v1/official/reports/:id` | Full official detail DTO. |
| `GET` | `/api/v1/official/reports/:id/location` | Exact GPS, accuracy, capturedAt. |
| `GET` | `/api/v1/official/reports/:id/image?variant=original\|annotated` | Protected image bytes; `private, no-store`. |
| `POST` | `/api/v1/official/reports/:id/actions` | `VERIFY_REPORT`, `REJECT_REPORT`, `ASSIGN_DEPARTMENT`, `ASSIGN_OFFICIAL`, `CHANGE_PRIORITY`, `MARK_IN_PROGRESS`, `ADD_INTERNAL_NOTE`, `REQUEST_INSPECTION`, `MARK_RESOLVED`, `CLOSE_CASE`. |
| `PATCH` | `/api/v1/official/reports/:id/status` | Generic status transition with lifecycle validation. |

## Case-management UI

- Dashboard cards for all eight required states, latest reports, notification counts and operational signals.
- Central Leaflet map with status/priority/severity filters and marker states; hotspot view is explicitly labelled **Reported Damage Hotspots** and states that aggregation is descriptive, not statistically significant.
- Reports table with search, filters, sort, pagination, bulk status (admin), date/severity/status/department/official/damage filters and permissioned CSV export.
- Detail view shows original/AI-annotated image, detection boxes and optional segmentation, exact GPS on a map, incident grouping with citizen report count, internal notes, action history and the full official decision panel.
- Destructive decisions use confirmation modals; rejection requires a reason; bulk updates warn that each report is audited.
- Notifications are real backend counts. Domain events are internal; no SMS/email delivery is claimed when providers are unconfigured.

## Audit history

Every important action creates an `AuditEvent` with `actor`, `actorId`, `role`, `action`, `timestamp`, internal report ID, public report ID and optional metadata. The event is appended to both the global audit log and the report’s action history. Passwords, session tokens and unnecessary citizen PII are never logged. `AuditLogModel` has no update/delete repository methods.

## Administration

- Departments are configurable; no country/state-specific department list is assumed.
- Official provisioning is controlled; strong temporary passwords are bcrypt-hashed.
- Roles, status catalog, priority labels, duplicate radius/window, planning SLAs and the administrative model confidence gate are exposed in `/official/admin`.
- `MODEL_CONFIDENCE_THRESHOLD` is the non-negotiable baseline. An administrator may raise the backend gate; the server clamps any attempted lower value back to the baseline. The AI service also enforces its own configured threshold.
- SLA rules are planning defaults, not a claim about any real authority’s statutory service levels.

## Provisioning examples

```bash
# Controlled first bootstrap (MongoDB mode only)
export DATA_MODE=mongo
export OFFICIAL_BOOTSTRAP_EMAIL='admin@agency.example'
export OFFICIAL_BOOTSTRAP_PASSWORD='replace-with-a-strong-password'
cd backend && npm run dev

# Or CLI provisioning using the same controlled env vars
cd backend && \
  DATA_MODE=mongo DATABASE_URL='mongodb://localhost:27017/rdd' \
  OFFICIAL_BOOTSTRAP_EMAIL='admin@agency.example' \
  OFFICIAL_BOOTSTRAP_PASSWORD='replace-with-a-strong-password' \
  OFFICIAL_BOOTSTRAP_NAME='System Administrator' \
  OFFICIAL_BOOTSTRAP_DEPARTMENT='Public Works' \
  OFFICIAL_BOOTSTRAP_DESIGNATION='Administrator' \
  npm run provision:official
```

The CLI reads only controlled environment variables and is not a public signup endpoint; run it over a secure operator shell and store the password in a secret manager. Additional officials can be provisioned by an authenticated `SUPER_ADMIN`/`ADMIN` through the protected operator UI.
