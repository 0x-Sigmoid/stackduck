# Snapshot provenance — what is real and what is stubbed

Two passes. Read this before using either set to judge anything.

## `flow-public/` — real, no API needed

Captured against the actual dev server (`localhost:5173`). These pages do not
touch the API, so nothing here is faked:

`landing`, `pricing`, `about`, `docs`, `security`, `signin`, `notfound`,
`webhook-guide` (all desktop 1440×900, full-page).

One real finding from this pass: `/pricing` logs `ERR_CONNECTION_REFUSED`
because it calls `GET /v1/billing/plans` and no API is running. That is the
expected behaviour on a machine without the backend, not a bug.

## `flow-app/` + `flow-mobile/` — UI rendering only, against a stub

**These are NOT screenshots of working software.** The machine has no Postgres
(Docker daemon is down, no local Postgres binary) and no `backend/.env`, so the
real NestJS API cannot boot — which is why the signed-in screens could not be
reached normally.

To make the screens visible for design/copy review, `shots/api-stub.mjs` stands
in on `:3001` and serves hand-written fixtures for the read endpoints the UI
calls on load (`/v1/auth/refresh`, `/v1/auth/me`, `/v1/projects`,
`/v1/projects/:id`, `.../connectors`, `.../alerts`, `.../metric-keys`,
`.../metrics`). Treat every number, project name, and timestamp in these shots
as placeholder content — only the **layout, styling, and copy** are real.

| Shot | Route | Renders |
| --- | --- | --- |
| `portfolio` | `/portfolio` | populated grid, mixed statuses, key metrics |
| `portfolio-empty` | `/portfolio` | zero-project state (stub run with `STUB_EMPTY=1`) |
| `project-detail` | `/projects/p_1` | healthy project: connectors, chart, alert rules |
| `project-connector-error` | `/projects/p_3` | connector in `error` state + its alert rule |
| `project-migrated` | `/projects/p_6` | the D34 "reconnect your project" prompt |
| `add-project` | `/projects/new` | step 1 of the Add Project flow |
| `account` | `/account` | account settings |

Mobile (`390×844`, `--mobile`): `portfolio-mobile`, `project-detail-mobile`,
`add-project-mobile`, `signin-mobile`, `notfound-mobile`, `landing-mobile`.
`signin-mobile` was captured **without** `--auth` (the signed-in seed redirects
`/signin` to `/portfolio`, which is correct behaviour, not a capture bug).

## Reproduce

```sh
node shots/api-stub.mjs                       # terminal 1 — the stub on :3001
npm run dev                                   # terminal 2 — dev server on :5173
node shots/capture-app.mjs shots/out --auth --full portfolio=/portfolio
node shots/capture-app.mjs shots/out --mobile --full signin-mobile=/signin
# zero-project state:
#   set STUB_EMPTY=1 (no trailing space before &&) and restart the stub
```

`capture-app.mjs` flags: `--mobile` (390×844), `--full` (full-page), `--auth`
(seeds `stackduck:refresh` before app scripts run). Every run prints the
rendered heading and the `innerWidth`/`scrollWidth` pair per route — matching
numbers mean no horizontal overflow, which is how the mobile regression check
was verified.

## What is still unverified

Nothing in these passes exercises the real backend. Auth, project CRUD, ingest,
metrics queries, alert evaluation, and the migration path all remain unverified
end-to-end until a Postgres is reachable — see `backend/README.md` and the
`smoke:*` scripts for that run.
