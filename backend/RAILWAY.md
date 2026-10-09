# Railway hosting — stackduck-api + TimescaleDB Postgres

Railway's default Postgres template does **not** include TimescaleDB
([Railway docs: "we do not plan to add extensions… for the most popular
extensions, like PostGIS and Timescale, there are several options in the
template marketplace"](https://docs.railway.com/guides/postgresql) —
use the **TimescaleDB template**, not the plain Postgres one).

## 1. Database: TimescaleDB template (not plain Postgres)

1. Railway project → **New → Database → TimescaleDB** (marketplace template;
   unmanaged, you own its config — see Railway's warning).
2. Open the TimescaleDB service → **Variables** → copy `DATABASE_URL`
   (Railway injects `DATABASE_URL`, `PGHOST`, `PGUSER`, etc. automatically).
3. Verify the extension exists before pointing the API at it:
   `SELECT * FROM pg_available_extensions WHERE name = 'timescaledb';`
   must return a row. If it doesn't, that service is plain Postgres —
   do not proceed; re-provision from the TimescaleDB template.
4. Run the versioned schema migrations before starting the production API
   (see step 2). The API then creates the Timescale extension and converts
   metric_points with its timestamp-inclusive primary key, preserving existing rows.

## 2. API service

1. **New → GitHub Repo** (or Empty Service + `railway up`), root directory
   `backend/`. Build: `npm install && npm run build`. Start: `npm run start:prod`.
   Run `npm run migrate:prod` as the release step after the build and before
   starting the API. Set `NODE_ENV=production`; startup refuses pending migrations.
   Back up existing databases before the first migration.
   Add `backend/railway.json` (nixpacks) if the UI asks for explicit commands.
2. **Variables** (all in Railway → API service → Variables; nothing hardcoded,
   nothing committed — `.env` is gitignored and `.env.example` is the schema):
   - `DATABASE_URL` — reference the TimescaleDB service (`${{TimescaleDB.DATABASE_URL}}`)
   - `DATABASE_SSL` — `true` when the API connects over Railway's public TCP
     proxy (TLS); `false` for Railway internal service networking
   - `JWT_ACCESS_SECRET` — generate per environment:
     `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`
     (There is no `JWT_REFRESH_SECRET`: refresh tokens are opaque random values
     stored SHA-256-hashed in Postgres, not signed tokens.)
   - `JWT_OAUTH_STATE_SECRET` — optional; when blank it is derived from
     `JWT_ACCESS_SECRET`. Set explicitly in production for independent rotation.
   - `CREDENTIALS_ENCRYPTION_KEY` — 32 bytes base64:
     `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`
   - `RESEND_API_KEY` + `ALERT_FROM_EMAIL` — Resend (see below)
   - `GOOGLE_CLIENT_ID/SECRET`, `GITHUB_CLIENT_ID/SECRET` — Phase 3 prep values
   - `PUBLIC_APP_URL` — staging frontend origin (NOT the live app until Phase 4)
   - `CORS_ALLOWED_ORIGINS` — extra origins (comma-separated), never `*`
   - `REQUIRE_TIMESCALE=true` — fail fast on Railway if the extension is missing
     (local dev keeps `false` for plain-Postgres fallback)
   - `KELVIQ_SERVER_API_KEY`, `KELVIQ_ENV=sandbox`, `KELVIQ_PLAN_PRO_MONTHLY`,
     `KELVIQ_PLAN_PRO_YEARLY`, `KELVIQ_WEBHOOK_SECRET` — billing (sandbox until
     go-live; unset locally: plans show as not offered, checkout 409s)
   - `GITHUB_IMPORT_CALLBACK_URL`, `GOOGLE_IMPORT_CALLBACK_URL` — import-time
     OAuth callbacks (`…/v1/auth/github-import/callback`,
     `…/v1/auth/google-import/callback`); register both in the GitHub OAuth App
     and Google Cloud Console alongside the sign-in callbacks
3. Generate a domain → note the `https://…up.railway.app` URL as the
   **staging API base** for the OAuth callback setup (step 5).

## 3. Email: Resend

1. Resend dashboard → **API Keys** → create key → set `RESEND_API_KEY`.
2. **Domains** → verify the sending domain → set `ALERT_FROM_EMAIL`
   (e.g. `Stackduck <alerts@yourdomain>` — must be the verified domain;
   `onboarding@resend.dev` only delivers to the account owner).
3. Wiring: `AlertsService` constructs `new Resend(apiKey)` and sends via
   `resend.emails.send({ from, to: [rule.channelTarget], subject, html })`
   on the Alerting Model's email channel. **Without the key it logs instead
   of sending** (`EMAIL (unsent — no RESEND_API_KEY)`) so local dev never
   silently pretends to notify.
4. End-to-end test (after Railway deploy): create an alert rule with
   `channel: email`, trip it with a test event, confirm the email arrives,
   then confirm cooldown suppresses the re-fire. Do not mark email "done"
   on a compile check alone.

## 4. Local shakedown (before touching Railway/production)

Docker Desktop must be **running** (daemon unreachable = `docker ps` fails;
start Docker Desktop and retry — no code change fixes that).

```powershell
docker compose -f backend/docker-compose.yml up -d
cd backend
npm run start:dev   # :3001, /v1/health
```

Walkthrough: register → project → generic-webhook connector → signed POST
to `/v1/ingest/:id` → row in `metric_points` → `GET /v1/projects/:id/metrics`
daily rollup via `time_bucket()` → alert rule tripped → 5-min job fires →
cooldown blocks re-fire. Report anything off — don't silently patch.

## 5. OAuth callbacks

Register all four callback URLs (sign-in + import) wherever the API is
deployed, staging and production alike:
- Google Cloud Console → Credentials → OAuth client → add
  `https://<api>/v1/auth/google/callback`
  plus `https://<api>/v1/auth/google-import/callback` (GCP project
  import; needs the Cloud Resource Manager read-only scope verified)
- GitHub → OAuth App settings → Authorization callback URL →
  `https://<api>/v1/auth/github/callback`
  plus `https://<api>/v1/auth/github-import/callback` (repo import)
- Sign-in requests identity scopes only (`read:user` + email); the `repo`
  scope lives exclusively on the import flow and its token is stored
  encrypted server-side, never returned to the client

## 5b. Frontend cutover wiring

The React frontend talks to this API over REST (`VITE_API_BASE`):
sessions are a 15-minute JWT (memory) + rotating refresh token
(localStorage). Point `VITE_API_BASE` at the staging API base above for
staging previews; `PUBLIC_APP_URL` on the API must exactly match the
frontend origin or CORS rejects it. The old Firebase Functions backend and
`functions/` directory are retired — do not deploy them alongside this API.

## 6. Security-plan operations checklist (do before production traffic)

These are Railway-dashboard/console steps, not code — all verified against the
Security Plan §2/§5. HTTPS is enforced end-to-end by Railway's proxy (TLS
termination + automatic redirect); the API adds HSTS via Helmet
(`max-age=15552000, includeSubDomains`) so browsers refuse later HTTP downgrades.

1. **Encryption at rest — verify, don't assume.** Railway states volumes are
   encrypted at rest; confirm the current wording in the dashboard/docs for the
   region/plan in use and note the answer (algorithm + key management) in the
   repo's Security page before claiming it publicly. If the answer is ever "no",
   treat disk theft as in-scope and lean on the app-level AES-256-GCM
   credential columns (D29) as the backstop.
2. **Automated backups — enable and test-restore.** For the TimescaleDB
   service, enable PITR (`railway postgres pitr enable`) and/or a scheduled
   volume-backup policy (`railway postgres pitr schedule set --daily --weekly`),
   then **restore once to a throwaway sibling service**
   (`railway postgres pitr restore --at <timestamp>` or `backup restore`) and
   confirm the API boots against it. A backup that has never been restored is
   unverified — record the date of the last successful test restore here.
3. **Least-privilege Postgres role.** The app must not run as the
   Railway-provisioned superuser. After first deploy, create a dedicated role
   and grant only what the app needs (TypeORM `synchronize` needs DDL at boot,
   so keep this to `CONNECT` + full rights **on the app schema only**, never
   superuser):
   ```sql
   CREATE USER stackduck_app WITH PASSWORD '<strong-random-password>';
   GRANT CONNECT ON DATABASE stackduck TO stackduck_app;
   GRANT ALL ON SCHEMA public TO stackduck_app;
   ALTER DEFAULT PRIVILEGES IN SCHEMA public
     GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO stackduck_app;
   ALTER DEFAULT PRIVILEGES IN SCHEMA public
     GRANT USAGE, SELECT ON SEQUENCES TO stackduck_app;
   ```
   Point the API's `DATABASE_URL` at this role and keep the superuser URL in
   Railway variables only for admin work. Rotate via Railway → database
   variables, then redeploy.
4. **Dependabot + audit CI** are already wired in-repo
   (`.github/dependabot.yml`, `npm audit --audit-level=high` in
   `.github/workflows/ci.yml`) — confirm the Security tab shows them active
   after the repo went public.
