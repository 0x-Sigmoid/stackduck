# Stackduck backend — NestJS API + PostgreSQL/TimescaleDB (Phase 1)

The React frontend uses this API for authentication, projects, metrics, and alerts.
PostgreSQL stores application data; TimescaleDB supplies time-series bucketing and retention.

## Layout

- `src/entities/` — `User`, `Project`, `Connector`, `MetricPoint` (Timescale hypertable), `AlertRule`
- `src/auth/` — passport-local (bcrypt) + google-oauth20 + github2, JWT access + refresh
- `src/connectors/` — ported connector providers + registry + CRUD/healthcheck/rotate controllers
- `src/metrics/` — point writer + `time_bucket()` reader (falls back to `date_trunc()` without Timescale)
- `src/ingest/` — generic-webhook HMAC guard + Stripe signature guard, throttled controllers
- `src/alerts/` — CRUD + 5-minute evaluation service (sum for counts, latest for gauges, cooldown)
- `src/jobs/` — `@nestjs/schedule` polling (30 min providers, 24 h Stripe) + alert evaluation (5 min)
- `scripts/firestore-migrate.ts` — Phase 2 one-time Firestore → staging Postgres migration

## Credential storage (Step 6 — decided)

**Encrypted columns in Postgres** (AES-256-GCM, app-level, per your choice).
Set `CREDENTIALS_ENCRYPTION_KEY` to 32 random bytes base64-encoded:

```powershell
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

No Secret Manager, no GCP dependency. Secrets are never returned by any endpoint
(controllers strip `credentialsEnc`/`previousCredentialsEnc`).

## Local dev

```powershell
# 1. Start Postgres + TimescaleDB (Docker Desktop must be running)
docker compose -f backend/docker-compose.yml up -d

# 2. Install + configure
cd backend
npm install
copy .env.example .env   # then set CREDENTIALS_ENCRYPTION_KEY + JWT secrets

# 3. Run
npm run start:dev         # API on :3001, /v1/health
```

Without TimescaleDB the API still boots (plain table + `date_trunc()` fallback);
set `REQUIRE_TIMESCALE=true` to fail fast instead. Hosting is decided: Railway
using their **TimescaleDB** template — see [RAILWAY.md](RAILWAY.md).

Alert email is delivered by Resend: set `RESEND_API_KEY` and `ALERT_FROM_EMAIL`
to enable it. Without the key, the rule can still be marked breached, but email
delivery fails without consuming its notification cooldown. `smoke:email` performs
the real send.

## Database migrations and verification

Schema synchronization is disabled. Development applies versioned migrations at
startup. In production, set `NODE_ENV=production`, back up the database, then run
`npm run build` and `npm run migrate:prod` before `npm run start:prod`.
The API refuses to start with pending migrations. `npm run migrate:run` runs
the same migrations from TypeScript during development.

The baseline supports fresh databases and adopts existing tables created by the
previous synchronization setup. The reliability migration preserves metric rows,
changes the metric primary key to `(id, timestamp)`, classifies existing built-in
snapshots, and adds current alert breach state. Timescale conversion uses
`migrate_data => TRUE` so existing rows survive conversion. Migrations are
forward-only; use a database backup for rollback.

Run `npm test` for production-service regression tests. Database-backed API tests
run when `TEST_DATABASE_URL` points to a **disposable** database named
`stackduck_test_*`. The test user must be able to create another disposable
database for the legacy-upgrade check. Set `TEST_REQUIRE_TIMESCALE=true` to also
require successful hypertable creation; CI runs that mode on TimescaleDB.

```powershell
$env:TEST_DATABASE_URL="postgres://stackduck:stackduck@localhost:5433/stackduck_test_local"
$env:TEST_REQUIRE_TIMESCALE="true"
npm test
```

Tests cover fresh and existing schemas, signed ingestion, the frontend metric-key
route, daily headline values, snapshot aggregation, real webhook delivery,
cooldowns, current breach/resolution state, and blocked private destinations.
They do not contact connector providers or send real emails.

## Smoke tests (run these, don't trust a compile)

| Command | What it proves |
| --- | --- |
| `npm run smoke:unit` | Production signature + encryption checks (no DB/network needed) |
| `npm run smoke:local` | register → project → webhook connector → signed ingest → metrics read-back |
| `npm run smoke:alerts` | alert rule → evaluation → webhook delivery → cooldown blocks re-fire |
| `npm run smoke:email` | **real** Resend send (needs `RESEND_API_KEY` + `ALERT_TO`) |

`smoke:alerts` needs `PROJECT_ID` + `TOKEN` from `smoke:local`'s output, and the
API must run with `JOBS_TRIGGER_SECRET` set — that enables
`POST /v1/internal/jobs/{evaluate-alerts,poll-providers,reconcile-stripe}`
so the 5-minute job can be triggered on demand instead of waited on. The routes
404 when `JOBS_TRIGGER_SECRET` is empty.

Alert webhook targets require HTTPS and exclusively public DNS answers. Delivery
pins the validated IP and rejects redirects. For the loopback receiver used by
`smoke:alerts`, set `ALLOW_LOCAL_ALERT_WEBHOOKS=true` on the local API.
This exception only permits literal loopback addresses and is never honored
when `NODE_ENV=production`.

Metric ingestion accepts optional `aggregation: "sum" | "last"`: use `sum` for
event increments (such as signups) and `last` for snapshots (such as queue depth
or a rolling 24-hour error count). Built-in providers declare or infer their
aggregation; unknown webhook keys default to `sum`. Alerts sum increments and
take the latest snapshot per connector inside the evaluation window. Missing
samples are unknown and do not create a zero-valued alert. A resolved rule clears
its current breach state even during notification cooldown.

## Hosting — Railway

See [RAILWAY.md](RAILWAY.md). Key point: use Railway's **TimescaleDB template**
("[we do not plan to add extensions to the PostgreSQL templates… for the most
popular extensions, like PostGIS and Timescale, there are several options in the
template marketplace](https://docs.railway.com/guides/postgresql)") — the plain
Postgres template has no TimescaleDB. Set `REQUIRE_TIMESCALE=true` there so a
wrong database fails fast instead of silently degrading to `date_trunc()`.


## API surface (mirrors API_CONTRACT.md, JWT instead of Firebase ID tokens)

- `POST /v1/auth/register|login|refresh|logout`, `GET /v1/auth/me`
- `GET /v1/auth/google|github` → callbacks (update OAuth app configs in Phase 3)
- `POST/GET/PATCH/DELETE /v1/projects…`
- `POST /v1/projects/:id/connectors/:provider` + `:id/healthcheck` + `:id/rotate-secret`
- `GET /v1/projects/:id/metrics?metricType=&key=[&from=&to=]` (90d max)
- `POST/GET/PATCH/DELETE /v1/projects/:id/alerts…` (CRUD; evaluated every 5 min)
- `POST /v1/ingest/:connectorId` (public, HMAC guard, 60/min throttle)
- `POST /v1/stripe/:connectorId` (public, Stripe guard, 60/min throttle)
- `POST /v1/internal/jobs/{evaluate-alerts,poll-providers,reconcile-stripe}`
  (only when `JOBS_TRIGGER_SECRET` is set; 404s otherwise)

## Phase 2 migration notes

`scripts/firestore-migrate.ts` reads all Firestore collections into staging
Postgres, verifies counts, and spot-checks 5 projects. Two deliberate caveats:

1. **Secrets don't migrate** — Secret Manager ciphertext can't transfer without
   the original IAM; connector rows are created in `error` with a placeholder
   and owners reconnect (re-enter credentials) afterward.
2. **Metric buckets un-bucket** — D2 daily documents explode back into individual
   `metric_points` rows (the whole point of the hypertable improvement).
