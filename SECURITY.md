# Security Policy

## Reporting a vulnerability

**Do not open a public GitHub issue for a suspected vulnerability.**
Use GitHub's **private vulnerability reporting** instead:

1. Go to the repository's **Security** tab → **Report a vulnerability**
   (equivalently: `https://github.com/0x-Sigmoid/stackduck/security/advisories/new`).
2. Describe what you found, the steps to reproduce it, and what you think the
   impact is. Proof-of-concept code is welcome; please avoid accessing other
   users' data or disrupting the service while investigating.

What happens next:

- You will get an acknowledgement as soon as the report is seen.
- The fix is developed privately, then disclosed via a GitHub Security
  Advisory once a patched version is deployed.
- Credit is given in the advisory if you want it.

## Expected response time — honest version

Stackduck is maintained by a single developer, part-time. Most reports get a
**first response within 7 days**; a straightforward fix typically ships within
**30 days**. A complex issue (or one found during a busy stretch) can take
longer — if so, the advisory thread will say so rather than go quiet. Severe,
actively-exploited issues jump the queue: report them with the word
**urgent** and they get looked at first.

## Scope

In scope: the NestJS API in `backend/` (authentication, session handling,
ingest endpoints, credential storage), the React frontend in `src/`, and the
deployment configuration documented in `backend/RAILWAY.md`.

Out of scope as findings (but still welcome as questions): the fact that the
Supabase connector holds a `service_role` key that bypasses Row Level
Security — that is a disclosed, intentional trade-off, documented on the
[Security page](https://stackduck.app/security) and in the connect UI, not an
oversight.

## What we do on our side

- Passwords: bcrypt cost 12. Sessions: short-lived JWT access tokens plus
  opaque refresh tokens stored SHA-256-hashed and rotated on every use.
- Connector secrets: AES-256-GCM application-level encryption in Postgres
  (see `backend/src/credentials/credentials.service.ts`).
- Ingest endpoints: HMAC/Stripe signature verification with a 5-minute
  timestamp window, per-endpoint body size limits, and tight rate limits.
- Dependencies: Dependabot updates plus `npm audit` in CI.

See `docs/stackduck-security-plan.md` for the full plan, and
`INCIDENT_RESPONSE.md` for what happens if something goes wrong.
