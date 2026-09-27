# API_CONTRACT.md — Stackduck (historical design notes)

This file records the original API design and is not a complete or normative description
of the current API. See [CONNECTORS.md](CONNECTORS.md) for the current connector inventory,
setup permissions, metric coverage, and token-based connector API.

**Backend pivot (2026-09-25, [D28](DECISIONS.md)):** a self-managed NestJS + PostgreSQL/TimescaleDB API
now lives in [`backend/`](backend/README.md) and will replace this Cloud Functions API at cutover. It keeps
the same route shapes and error envelope so the frontend's data layer can switch with minimal change, with
these differences:

- **Auth:** `Authorization: Bearer <JWT access token>` issued by `/v1/auth/*`, instead of a Firebase ID token.
  Owners are still derived from the token, never from the request body.
- **Credentials:** stored encrypted in Postgres ([D29](DECISIONS.md)) instead of Secret Manager; the
  `credentialsRef` pointer no longer exists and no connector endpoint returns secret material.
- **Metrics:** read back from a TimescaleDB hypertable via `time_bucket()` ([D30](DECISIONS.md)) instead of
  daily bucket documents. The response still arrives as `{ buckets: [{ date, points, dailyAggregate }] }`.
- **Alerts:** `alertRules` are served under `/v1/projects/:projectId/alerts` (CRUD), with evaluation every
  5 minutes and email delivery via Resend.
- **Scheduled work:** `/v1/internal/jobs/*` can run polling and alert evaluation on demand when
  `JOBS_TRIGGER_SECRET` is set; otherwise those routes 404.

Everything below describes the **retired** Firebase backend. The `functions/` implementation and Firebase config were removed from this repository; the doc survives as historical design reference, since the NestJS API mirrors these route shapes.

Base URL (emulator): `http://localhost:5001/proxibay-dev/europe-west1/api`
Base URL (prod): `https://europe-west1-proxibay-dev.cloudfunctions.net/api`
All paths below are relative to the base. One Express-style v2 `onRequest` function
(`api`) with sub-routers keeps the function count (and cold starts) at 1.

## Conventions

- **Auth (all except `POST /v1/ingest/:connectorId`):** Firebase Auth ID token,
  `Authorization: Bearer <idToken>`. 401 if missing/invalid. `ownerId` is always
  derived from the token — never trusted from the client body.
- **Content type:** `application/json` unless noted.
- **Errors:** `{ "error": { "code": "string_snake_case", "message": "human readable" } }`
  with HTTP status. Codes: `unauthenticated` 401, `forbidden` 403, `not_found` 404,
  `invalid_argument` 400, `conflict` 409, `rate_limited` 429, `internal` 500.
- **Timestamps:** ISO-8601 strings on the wire (`2026-09-20T14:00:00.000Z`); Firestore
  `Timestamp` in storage. `timestamp` omitted on ingest ⇒ server receipt time.
- **Direct Firestore reads (no endpoint):** project list/detail and metric buckets are
  read directly by the client (rules enforce owner scoping). The `GET` endpoints below
  exist as convenience aggregations; clients may use either.

---

## Projects (Add Project flow, steps 1 / 4 / 5)

### POST /v1/projects — createProject
Step 1 of the flow. Name only required.
```json
// request
{ "name": "Tabmeet", "description?": "…", "stackTags?": ["firebase","react"],
  "repoUrl?": "https://…", "liveUrl?": "https://…",
  "environment?": "production|staging|development", "notes?": "…" }
// 201 response
{ "project": { "id": "abc", "ownerId": "uid", "name": "Tabmeet",
  "status": "active", "createdAt": "…", "updatedAt": "…" } }
```
400 `invalid_argument` if `name` missing/blank. `status` always starts `"active"`.

### GET /v1/projects — listProjects
Portfolio Home needs per-card connector statuses + key numbers without N+1 reads.
```json
// 200 response
{ "projects": [ {
  "project": { "id": "…", "name": "…", "status": "active", "stackTags": [],
               "updatedAt": "…" },
  "connectorStatuses": ["connected","pending"],
  "keyMetrics": [ { "metricType": "user_metrics", "key": "total_users",
                    "value": 1234, "at": "…" } ],
  "homeStatus": "green|gray|amber|red"
} ] }
```
Query: `?status=active` (default all non-archived; `archived` only with explicit
`?status=archived`). Red state is always `"green"` in Phase 1 (no alert engine yet).

### PATCH /v1/projects/:projectId — updateProject
Inline editing (flow step 5) — any subset of catalog fields + status transitions.
```json
// request (all optional)
{ "name?": "…", "description?": "…", "stackTags?": ["…"], "repoUrl?": "…",
  "liveUrl?": "…", "environment?": "production|staging|development|null",
  "notes?": "…", "status?": "active|paused|archived" }
// 200 response
{ "project": { "id": "…", "updatedAt": "…", "status": "…" } }
```
404 if not owned. Clearing an optional field: send `null`.

### DELETE /v1/projects/:projectId — deleteProject (soft-archive, per D8)
```json
// 200 response
{ "project": { "id": "…", "status": "archived" },
  "disabledConnectors": 2, "note": "Ingest URLs now return 410 Gone." }
```
Never hard-deletes in v1. Push URLs kept reserved so old backends fail loudly (410),
not silently into a recycled ID.

---

## Firebase connector (poll)

### POST /v1/projects/:projectId/connectors/firebase — createFirebaseConnector
Flow step 3a. Body carries the service-account JSON (transport only — stored to
Secret Manager, never Firestore).
```json
// request (Content-Type: application/json)
{ "serviceAccountJson": { "type": "service_account", "project_id": "…",
    "private_key": "…", "client_email": "…" },
  "pollIntervalMinutes?": 30 }
// 201 response — healthCheck already ran inline
{ "connector": { "id": "conn_…", "type": "firebase", "authType": "service_account",
    "fetchMode": "poll", "capabilities": ["user_metrics","error_metrics"],
    "credentialsRef": "projects/…/secrets/proxibay-conn_…/versions/1",
    "status": "connected|error", "lastHealthCheck": "…", "createdAt": "…" },
  "healthCheck": { "ok": true, "detail": "listUsers(1) succeeded" } }
```
Failure path: 422 `connector_unhealthy` + `{ "connector": { …, "status": "error" },
"healthCheck": { "ok": false, "detail": "…" } }` — client stays in-flow with inline
retry (per spec, no navigation away). 409 `duplicate_connector` if a firebase
instance already exists (1:1 per D9).

### POST /v1/projects/:projectId/connectors/:connectorId/healthcheck
Manual re-check from the detail page.
```json
// 200 response
{ "connector": { "id": "…", "status": "connected|error", "lastHealthCheck": "…" },
  "healthCheck": { "ok": true, "detail": "…" } }
```

### Polling (no HTTP contract — Cloud Scheduler → function, per D7)
`pollFirebaseMetrics` runs every 30 min (default), reads SA from Secret Manager via
`credentialsRef`, emits NormalizedEvents → bucketed writes. Emitted keys v1:
`user_metrics/signups`, `user_metrics/total_users`, `error_metrics/error_count`.
(`active_users` only if source app maintains `lastActiveAt`; `uptime`/`revenue`
explicitly out of scope for this connector.)

---

## Generic Webhook connector (push)

### POST /v1/projects/:projectId/connectors/webhook — createWebhookConnector
Flow step 3b. No credentials in — secret generated server-side.
```json
// request: {} (empty body)
// 201 response — signingSecret shown ONCE, never returned again
{ "connector": { "id": "conn_…", "type": "generic-webhook", "authType": "none",
    "fetchMode": "push", "capabilities": [],
    "credentialsRef": "projects/…/secrets/proxibay-conn_…/versions/1",
    "status": "pending", "createdAt": "…" },
  "ingestUrl": "https://…/v1/ingest/conn_…",
  "signingSecret": "whsec_…",
  "snippet": { "curl": "curl -X POST $URL -H 'X-Stackduck-Signature: …' …",
               "node": "crypto.createHmac('sha256', SECRET).update(body)…" } }
```
`capabilities` starts empty (dev can push any of the 5 metric types); server records
observed types. Status flips `pending → connected` on first verified event.

### POST /v1/ingest/:connectorId — ingestWebhook (**public**, HMAC-gated)
```http
POST /v1/ingest/conn_abc
Content-Type: application/json
X-Stackduck-Signature: <hmac-sha256 hex of RAW body with signing secret>
```
```json
// single event
{ "metricType": "user_metrics", "key": "signups", "value": 3,
  "timestamp?": "2026-09-20T14:00:00Z", "metadata?": { "source": "nightly-batch" } }
// …or batch (max 500 per D5)
[ { "metricType": "user_metrics", "key": "signups", "value": 3 }, … ]
```
`projectId`/`connectorId` are taken from the URL, never the body.
Validation: `metricType` ∈ 5-type enum (unknown ⇒ 400, NOT coerced to `custom`);
`value` numeric; `timestamp` optional ⇒ receipt time.
```json
// 202 response
{ "accepted": 2, "bucketIds": ["proj_user_metrics_signups_2026-09-20", "…"],
  "connectorStatus": "connected" }
```
Failures: 401 `bad_signature` (no/incorrect header), 404 `unknown_connector`,
410 `connector_disabled` (project archived per D8), 429 `rate_limited`
(>60 req/min per connector per D5, with `Retry-After` header), 400 `invalid_event`.

### POST /v1/projects/:projectId/connectors/:connectorId/rotate-secret
```json
// 200 response — new secret shown ONCE; old secret stays valid 24h (grace window)
{ "signingSecret": "whsec_new…", "graceUntil": "2026-09-21T…Z" }
```

---

## Metrics reads (Project Detail charts — full layout spec still to come, step 9)

### GET /v1/projects/:projectId/metrics — getProjectMetrics
```http
GET /v1/projects/:projectId/metrics?key=signups&metricType=user_metrics&from=2026-08-21&to=2026-09-20
// 200 response — one entry per day-bucket in range (ascending)
{ "buckets": [ { "date": "2026-09-20",
  "points": [{ "time": "…", "value": 3 }],
  "dailyAggregate": { "sum": 9, "avg": 3, "max": 5, "min": 1, "last": 2 } } ] }
```
`metricType`+`key` required; `from`/`to` default to last 30d; max 90d per call.
(Client may alternatively read `metrics/` docs directly — same shape.)

---

## Out of scope (explicitly NOT in this contract)
AlertRules / alert evaluation / notifications, cross-project inbox,
self-signup, team sharing. `homeStatus: "red"` and `hasTriggeredUnresolvedAlert`
are carried in types for Phase 2 but the alert engine doesn't exist yet.

---

## Kelviq billing (merchant of record, sandbox until go-live)

Base + auth as above. `customerId` is always the Firebase UID from the ID
token — never a request field. Plan identifiers never leave the server: the
client sends `{tier: "pro", period: "monthly"|"yearly"}` and the server maps to
`KELVIQ_PLAN_PRO_*`. Empty identifier = plan not offered (409).

### GET /v1/billing/plans — **public** display catalog
```json
// 200 response
{ "currency": "USD",
  "teamsNote": "Teams/Enterprise plans are coming soon.",
  "plans": [
    { "tier": "pro", "period": "monthly", "price": 9.99, "offered": false },
    { "tier": "pro", "period": "yearly", "price": 107.89, "offered": false }
  ] }
```

### POST /v1/billing/checkout — createCheckout
```json
// request
{ "tier": "pro", "period": "monthly" }
// 200 response
{ "checkoutUrl": "https://www.kelviq.com/checkout/…" }
```
Ensures the Kelviq customer (create-with-email, conflicts ignored), then
`checkout.createSession({ planIdentifier, chargePeriod, customerId, successUrl })`.
Pro is flat per account — no seat quantities (seats arrive with Teams). 409 `plan-not-published`
while identifiers are unset. `successUrl` = `{PUBLIC_APP_URL}/billing/success`.

### POST /v1/billing/portal — createPortalSession
```json
// 200 response
{ "portalUrl": "https://www.kelviq.com/portal/…?token=…" }
```
Retries once after ensuring the customer-with-email on 400 (the documented
unknown-id / no-email case) — returns 400 `no-email` / `portal-unavailable`,
never a bare 500.

### POST /v1/billing/webhooks — **public**, Kelviq-signature-gated
Raw body + `validateEvent(payload, headers, KELVIQ_WEBHOOK_SECRET)`; 403 on
`WebhookVerificationError`, 400 on malformed. Duplicate event IDs skipped
(in-memory set; Redis before scaling). Handler TODOs: `checkout.completed`,
`invoice.payment_failed`, `subscription.created`, `.updated`, `.plan_changed`,
`.cancelled` (fires at actual end, not on schedule).

---

## Stripe connector (live — added after Phase 1)

### POST /v1/projects/:projectId/connectors/stripe — createStripeConnector
Body carries the restricted key server-side only (Secret Manager, never Firestore).
```json
// request
{ "apiKey": "rk_live_…", "webhookSecret?": "whsec_…" }
// 201 response — healthCheck (balance.retrieve) already ran inline
{ "connector": { "id": "conn_…", "type": "stripe", "authType": "api_key",
    "fetchMode": "both", "capabilities": ["revenue_metrics"],
    "status": "connected|error", "lastHealthCheck": "…" },
  "healthCheck": { "ok": true, "detail": "balance.retrieve() succeeded …" },
  "stripeEndpoint": "https://…/v1/stripe/conn_…" }
```
422 `connector_unhealthy` stays in-flow like Firebase. 409 on duplicate (1:1).
Omit `webhookSecret` for poll-only (nightly totals, no instant events).

### POST /v1/stripe/:connectorId — stripeWebhook (**public**, Stripe-gated)
Stripe dashboard → Developers → Webhooks → add `stripeEndpoint`, subscribe to
charge + payout events. Verifies `Stripe-Signature` (t=`…`,v1=`…`, 5-min tolerance).
`charge.succeeded` → `{revenue_metrics, transaction_volume, $}`, `charge.failed` →
`{revenue_metrics, failed_payments, 1}`, `payout.paid` → `{revenue_metrics,
payout_volume, $}`. Unknown types (refunds/disputes — deferred) → 202 `{accepted: 0}`.
401 bad signature, 404 unknown, 410 archived/disabled.

### Polling — pollStripeMetrics, every 24 hours
Per stripe connector: last-30d succeeded charges → `revenue_metrics/revenue_30d`;
last-24h failures → `revenue_metrics/failed_24h`. Push owns per-event keys, so no
double-counting. No `mrr` key until subscription logic exists (D23).

---

## Supabase connector (live)

### POST /v1/projects/:projectId/connectors/supabase — createSupabaseConnector
```json
// request
{ "url": "https://xyzcompany.supabase.co", "serviceKey": "eyJ…" }
// 201 response — healthCheck (admin user lookup) already ran inline
{ "connector": { "id": "conn_…", "type": "supabase", "authType": "api_key",
    "fetchMode": "poll", "capabilities": ["user_metrics"],
    "status": "connected|error", "lastHealthCheck": "…" },
  "healthCheck": { "ok": true, "detail": "Admin user lookup succeeded …" } }
```
422 stays in-flow (bad URL, missing key, or anon-key rejection name the cause).
409 on duplicate (1:1). Manual re-check via the shared `…/healthcheck` endpoint.

### Polling — pollSupabaseMetrics, every 30 minutes
Paginated admin user list → `user_metrics/total_users`, `user_metrics/signups`
(since last poll), `user_metrics/active_users` (30d `last_sign_in_at` window).
No `error_metrics`: log access needs a separate management token (D24).
