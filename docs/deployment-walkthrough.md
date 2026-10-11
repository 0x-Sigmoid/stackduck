# Stackduck deployment walkthrough

Checked against this repository and the linked provider documentation on 11 October 2026.

This walkthrough starts with your existing Railway TimescaleDB service. It uses Vercel for the React frontend and Railway for the NestJS API and database. You can finish the core app before configuring Google/GitHub sign-in or email. Paid subscriptions are not ready: the billing webhook currently verifies and logs events but does not provision subscription entitlements.

## 1. Understand the three parts

| Part | Where it runs | What it does |
| --- | --- | --- |
| Frontend | Vercel | Displays the website, forms, portfolio, and charts |
| API | Railway service named `stackduck-api` | Handles accounts, projects, connectors, metrics, and alerts |
| Database | Your Railway TimescaleDB service | Stores accounts, encrypted credentials, and metric history |

The browser calls the API. Only the API connects to the database. The frontend never needs the database password or encryption key.

Use temporary hosting URLs first. Later, the intended addresses will be `https://stackduck.app` for the frontend and `https://api.stackduck.app` for the API. Those names do not work merely because you enter them in a variable; you must configure the domains and DNS first.

## 2. Make sure GitHub contains the code you intend to deploy

Open https://github.com/0x-Sigmoid/stackduck in your browser. Confirm that `backend/package.json`, `backend/railway.json`, and the latest frontend changes are present on your deployment branch. Railway and Vercel deploy the files on GitHub, not uncommitted files on your computer.

Use your editor's source-control panel or GitHub Desktop to review, commit, and push the changes you want deployed. Never include `.env`, service-account JSON, or real keys. This guide does not commit or push anything for you.

## 3. Check your database service

Open your Railway project and click the TimescaleDB tile you already created. Confirm its latest deployment is running and it has an attached persistent volume. A volume is the disk that keeps data when the database container restarts.

Open its Variables or connection details. Identify its private connection URL, usually exposed as `DATABASE_URL`, whose host ends in `.railway.internal`. The API and database must be in the same Railway project and environment. Record the database service's exact name; references are name-sensitive.

Do not copy a localhost connection URL from `backend/.env.example`. That example is for Docker on your computer. Do not use the database's public TCP URL for the deployed API when a private URL is available.

## 4. Create the API service

In the same Railway project, choose New → GitHub Repo and select `0x-Sigmoid/stackduck`. If Railway asks for GitHub permission, grant access to this repository. Rename the new service `stackduck-api`.

An initial deployment may fail while settings are incomplete; finish these settings before diagnosing that first failure. Open the API service's Settings and configure:

| Setting | Value |
| --- | --- |
| Root Directory | `/backend` |
| Builder | Railpack (keep the current default) |
| Build Command | `npm ci --include=dev && npm run build` |
| Pre-deploy Command | `npm run migrate:prod` |
| Start Command | `npm run start:prod` |
| Healthcheck Path | `/v1/health` |
| Replicas | `1` |

The root directory matters: the repository root builds the frontend; `/backend` builds the API. Enter the commands and healthcheck directly in the dashboard. Your new service's Settings notice says Config as Code is deprecated and new services cannot opt in; leave Railway Config File unset. The repository's `backend/railway.json` is a legacy configuration, not a required step for this dashboard setup.

Keep Serverless/App Sleeping disabled on the API. Its scheduled jobs run inside the server process, so a sleeping server will miss polling and alert evaluation. Keep one replica for now: there is no distributed scheduler lock preventing multiple replicas from running the same jobs.

Railway documentation: [monorepo settings](https://docs.railway.com/deployments/monorepo), [pre-deploy commands](https://docs.railway.com/deployments/pre-deploy-command), [serverless behavior](https://docs.railway.com/deployments/serverless).

## 5. Generate the secret values

On your computer, open PowerShell. Confirm Node is installed:

```powershell
node --version
```

If the command is missing, install a current Node.js LTS release from https://nodejs.org and reopen PowerShell. The repository requires Node 24.9 or newer (use the Node 24 LTS release).

Run this command for the JWT secret:

```powershell
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

Copy the complete output into a password manager under `Stackduck JWT_ACCESS_SECRET`. Run the same command again for a separate `JWT_OAUTH_STATE_SECRET` value.

Then generate the credential encryption key:

```powershell
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

Save that output as `Stackduck CREDENTIALS_ENCRYPTION_KEY`. Preserve this exact key across redeployments: replacing it makes existing stored connector credentials unreadable. Losing it requires reconnecting those sources. Do not paste these values into frontend variables or GitHub files.

## 6. Add the API variables in Railway

Click `stackduck-api` → Variables. Enter the following values. When using New Variable, enter values without surrounding quotation marks.

| Name | Value |
| --- | --- |
| `NODE_ENV` | `production` |
| `PORT` | `3001` |
| `DATABASE_URL` | Reference to the database service's private URL |
| `DATABASE_SSL` | `false` for the private connection used here |
| `REQUIRE_TIMESCALE` | `true` |
| `JWT_ACCESS_SECRET` | The first generated hex value |
| `JWT_OAUTH_STATE_SECRET` | The second generated hex value |
| `JWT_ACCESS_TTL` | `15m` |
| `JWT_REFRESH_TTL` | `30d` |
| `CREDENTIALS_ENCRYPTION_KEY` | The generated base64 value |
| `PUBLIC_APP_URL` | `http://localhost:5173` temporarily |
| `ALLOW_LOCAL_ALERT_WEBHOOKS` | `false` |

For `DATABASE_URL`, use Railway's reference-variable picker rather than copying the database password manually. If the database service is literally named `TimescaleDB`, and its `DATABASE_URL` is private, the reference is:

```text
${{TimescaleDB.DATABASE_URL}}
```

Replace `TimescaleDB` with the actual service name. Verify the resolved URL uses `.railway.internal`. If your template supplies a separately named private URL, reference that variable instead. `DATABASE_SSL=false` applies to this private connection; it is not an instruction to disable TLS on a public connection.

Do not bulk-import the local example file unchanged. In particular, leave Google/GitHub ID and secret variables absent until you have real values. Empty strings can prevent the OAuth strategies from starting; absent variables use the code's development placeholders. OAuth buttons will not work until configured.

Leave `JOBS_TRIGGER_SECRET` and all `KELVIQ_*` variables absent for this initial deployment.

Railway variable changes are staged: click Deploy/Apply Changes when ready. [Variables and references](https://docs.railway.com/variables).

## 7. Deploy and check the API

Deploy the API service. In the deployment details, read build logs, pre-deploy logs, and application logs separately.

The build should finish successfully. The pre-deploy migration command should report `Applied 2 database migration(s).` on a fresh database, or `Applied 0 database migration(s).` after those migrations already exist. Do not reset or delete the database if the count is zero.

The application should start and log that it is listening on port 3001. With `REQUIRE_TIMESCALE=true`, startup fails if the TimescaleDB extension/hypertable setup fails. On first conversion, look for `metric_points converted to a TimescaleDB hypertable.`

Open Settings → Networking → Public Networking → Generate Domain. Set the target port to `3001` if prompted. Copy the HTTPS URL Railway generates, such as `https://stackduck-api-example.up.railway.app`. This is your API base URL; your actual URL will differ.

Add the following API variable, using your actual URL without a trailing slash:

```text
PUBLIC_API_BASE=https://YOUR-API-DOMAIN.up.railway.app
```

Apply changes and redeploy. This variable controls the webhook URLs shown to users.

Open this address in a browser:

```text
https://YOUR-API-DOMAIN.up.railway.app/v1/health
```

Expected result:

```json
{"ok":true}
```

The bare API address may return 404 because there is no homepage there. Use `/v1/health`. This endpoint is a liveness check; it does not by itself prove OAuth, email, provider access, or alert delivery.

[Railway domain setup](https://docs.railway.com/networking/domains/working-with-domains).

## 8. Prepare frontend route handling

The app uses client-side routing. Add a file named `vercel.json` at the repository root, next to the frontend `package.json`, containing:

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "rewrites": [
    { "source": "/(.*)", "destination": "/index.html" }
  ]
}
```

Commit and push this file using your editor or GitHub Desktop. It tells Vercel to load the app when someone opens or refreshes `/signin`, `/portfolio`, or a project URL. This file is a setup instruction; this walkthrough has not created it for you.

[Vercel's Vite SPA instructions](https://vercel.com/docs/frameworks/frontend/vite).

## 9. Deploy the frontend to Vercel

Sign into Vercel → Add New → Project → import `0x-Sigmoid/stackduck`. Grant repository access if asked.

| Setting | Value |
| --- | --- |
| Framework Preset | Vite |
| Root Directory | Repository root; do not select `backend` |
| Build Command | `npm run build` |
| Output Directory | `dist` |
| Install Command | `npm ci` |

Add one frontend environment variable, replacing the example with your real API URL:

```text
VITE_API_BASE=https://YOUR-API-DOMAIN.up.railway.app
```

Use the base URL only. Do not append `/v1`, `/health`, or `/v1/health`. The code adds the endpoint path itself. Never add JWT, database, OAuth client secrets, or encryption keys to Vercel frontend variables: `VITE_*` values are included in browser-delivered code.

Deploy and copy the project's stable production `.vercel.app` address. Use the stable project URL rather than an individual deployment's changing preview URL. Whenever you change `VITE_API_BASE`, rebuild/redeploy the frontend; changing the variable alone does not update an already-built site.

## 10. Connect the two services

Return to Railway → `stackduck-api` → Variables. Replace `PUBLIC_APP_URL` with the exact frontend origin, for example:

```text
PUBLIC_APP_URL=https://YOUR-FRONTEND.vercel.app
```

Do not add `/signin`, a trailing slash, or quotation marks. `PUBLIC_APP_URL` is used for CORS and OAuth/password-reset redirects.

If you also want to use the local frontend, add:

```text
CORS_ALLOWED_ORIGINS=http://localhost:5173
```

Additional origins are comma-separated. Never use `*`. Apply changes and redeploy the API.

Now open your Vercel app → Sign in → Create account. Register using your email and an 8-character-or-longer password, accepting the terms. You should land in an empty portfolio. Create a test project, open it, refresh the page, then sign out and sign in again. This confirms the frontend/API connection and persistent account/project storage.

If the website looks correct but registration fails, inspect the API logs and the browser Network panel; static page rendering does not prove the backend connection works.

## 11. Add the production domains

First confirm the temporary URLs work. Then open Vercel project → Settings → Domains → add `stackduck.app`. In your domain registrar/DNS provider, add the exact records Vercel displays. Do not copy DNS targets from another project. If you add `www.stackduck.app`, configure its redirect to the canonical `stackduck.app` address.

In Railway → API Settings → Networking → Custom Domain, add `api.stackduck.app`, targeting port 3001. Copy the CNAME and ownership-verification TXT records Railway supplies into your DNS provider. Do not replace unrelated mail records. Wait until both providers show the domains as verified and HTTPS works.

Update Railway:

```text
PUBLIC_APP_URL=https://stackduck.app
PUBLIC_API_BASE=https://api.stackduck.app
```

If you still need the Vercel project URL for testing, include its exact origin in `CORS_ALLOWED_ORIGINS`. There should be only one canonical `PUBLIC_APP_URL`.

Update Vercel:

```text
VITE_API_BASE=https://api.stackduck.app
```

Redeploy the API and frontend. Check `https://api.stackduck.app/v1/health`, then register/sign in on `https://stackduck.app`. Test direct visits and refreshes on `/signin`, `/docs`, and `/portfolio`.

[Vercel domains](https://vercel.com/docs/domains/working-with-domains/add-a-domain), [Railway domains](https://docs.railway.com/networking/domains/working-with-domains).

## 12. Turn on email with Resend

Open Resend → Domains → Add Domain. Use a dedicated sending subdomain such as `mail.stackduck.app`. Add the exact DNS records Resend displays at your DNS provider, then wait for Verified. Create an API key authorized to send from that domain.

In Railway, add:

```text
RESEND_API_KEY=YOUR-REAL-RESEND-KEY
ALERT_FROM_EMAIL=Stackduck <alerts@mail.stackduck.app>
```

Enter the full sender value in Railway's value field. Redeploy the API. Use Forgot password on an existing email/password account, check the inbox/spam folder, follow the reset link, and sign in with the new password. The link should point to the canonical frontend domain.

Without Resend configured, the current backend logs rather than delivers reset/alert emails. A successful reset-request response does not prove an email was sent. Check the Resend delivery dashboard as well as the inbox.

[Resend domain verification](https://resend.com/docs/dashboard/domains/introduction).

## 13. Enable Google sign-in and cloud-project import

In Google Cloud Console, select/create a project. Open Google Auth Platform (or APIs & Services → OAuth consent screen in older layouts). Configure app name, support email, audience, and developer contact. For an External app still in Testing, add your own Google email as a test user.

Create an OAuth client of type Web application. Set the authorized JavaScript origin to `https://stackduck.app`. Add these exact authorized redirect URIs:

```text
https://api.stackduck.app/v1/auth/google/callback
https://api.stackduck.app/v1/auth/google-import/callback
```

Copy the client ID and secret into Railway:

```text
GOOGLE_CLIENT_ID=YOUR-GOOGLE-CLIENT-ID
GOOGLE_CLIENT_SECRET=YOUR-GOOGLE-CLIENT-SECRET
GOOGLE_CALLBACK_URL=https://api.stackduck.app/v1/auth/google/callback
GOOGLE_IMPORT_CALLBACK_URL=https://api.stackduck.app/v1/auth/google-import/callback
```

Redeploy and test Continue with Google. For a brand-new OAuth account, select Create account and accept the terms first. Test Google project import separately: enable the Cloud Resource Manager API and configure the additional read-only cloud scope requested by the import flow, `https://www.googleapis.com/auth/cloudplatform.read-only`. Your Google user needs access to the projects being imported. Review Google's production/verification requirements before allowing all external users.

[Google OAuth setup and redirect matching](https://developers.google.com/identity/protocols/oauth2/web-server).

## 14. Enable GitHub sign-in and repository import

GitHub → Settings → Developer settings → OAuth Apps → New OAuth App. Use `Stackduck` as the app name and `https://stackduck.app` as the homepage.

Register both exact callback URLs in the app's callback settings:

```text
https://api.stackduck.app/v1/auth/github/callback
https://api.stackduck.app/v1/auth/github-import/callback
```

Current GitHub documentation describes multiple callback URLs and per-callback wildcard controls. Prefer the two exact URLs with wildcard matching disabled. If your dashboard only exposes one callback field, enable sign-in with the first URL and resolve import callback registration before claiming import works; do not put two URLs into one field.

Generate a client secret. Add the following Railway variables:

```text
GITHUB_CLIENT_ID=YOUR-GITHUB-CLIENT-ID
GITHUB_CLIENT_SECRET=YOUR-GITHUB-CLIENT-SECRET
GITHUB_CALLBACK_URL=https://api.stackduck.app/v1/auth/github/callback
GITHUB_IMPORT_CALLBACK_URL=https://api.stackduck.app/v1/auth/github-import/callback
```

Redeploy. Test sign-in, then test repository import from the portfolio. Import requests broader repository access than sign-in. Organization repositories may require the organization's approval.

[Creating a GitHub OAuth app](https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/creating-an-oauth-app), [callback URL rules](https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/authorizing-oauth-apps).

## 15. Prove metrics and alerts work

In Stackduck, create a project named `Deployment check`. Add a Signed/Generic webhook source. Copy the generated ingest URL and signing secret into a private note. The URL must start with your public API address, not localhost. The source should wait for its first event.

Open PowerShell and set these session variables, replacing the placeholders:

```powershell
$env:STACKDUCK_INGEST_URL = 'PASTE-THE-GENERATED-INGEST-URL'
$env:STACKDUCK_SIGNING_SECRET = 'PASTE-THE-GENERATED-SIGNING-SECRET'
```

Send a signed sample event with this complete PowerShell command:

```powershell
@'
const crypto = require('node:crypto');
(async () => {
  const body = JSON.stringify({ metricType: 'custom', key: 'smoke_events', value: 42, aggregation: 'sum' });
  const timestamp = String(Math.floor(Date.now() / 1000));
  const signature = crypto.createHmac('sha256', process.env.STACKDUCK_SIGNING_SECRET)
    .update(timestamp + '.' + body).digest('hex');
  const response = await fetch(process.env.STACKDUCK_INGEST_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Stackduck-Timestamp': timestamp,
      'X-Stackduck-Signature': signature,
    },
    body,
  });
  console.log('HTTP', response.status);
  console.log(await response.text());
})().catch(error => { console.error(error.message); process.exitCode = 1; });
'@ | node
```

Expect HTTP 202 with one accepted event. Refresh the project overview: the source should be connected and `smoke_events` should show 42. Keep your computer clock accurate because signatures include a timestamp.

Add an email alert rule for the custom `smoke_events` metric, condition above 10, a 15-minute window, and your email as recipient. Wait for the next evaluation, normally within five minutes. Confirm the email arrives and the rule's state changes. Repeated evaluation within its cooldown should not send another alert.

Now connect one real provider using `/docs/connect`. Provider polling normally runs every 30 minutes; Stripe reconciliation runs daily at 02:00 in the server's timezone. A source waiting for its first scheduled sync is not automatically broken. Check application logs for polling outcomes.

After testing, clear the temporary PowerShell variables:

```powershell
Remove-Item Env:STACKDUCK_SIGNING_SECRET
Remove-Item Env:STACKDUCK_INGEST_URL
```

## 16. Complete operational checks

Enable scheduled backups on the TimescaleDB service's attached volume where supported. Railway's volume backups are distinct from database-specific point-in-time recovery; do not assume your marketplace template includes PITR. Restore a backup to a separate test environment/service and confirm the restored accounts, projects, and metrics are present. Never test restoration over your working database.

Keep the encryption key backed up separately from the database. Add an external uptime monitor for `/v1/health`, review Railway logs after deploying, and retain one always-running API replica. The current Timescale setup retains raw metric points for 30 days; older history is removed by that retention policy.

The current API startup performs Timescale extension/hypertable setup. Do not blindly replace the database user with an unprivileged role: that startup setup needs sufficient privileges or must first be separated into an administrative bootstrap step. The older least-privilege SQL example in `backend/RAILWAY.md` is not sufficient on its own for this startup behavior.

[Railway volume backups](https://docs.railway.com/volumes/backups).

## 17. Keep billing disabled until the remaining code is implemented

Stripe as a monitoring connector and Kelviq as Stackduck's subscription billing provider are separate integrations. You can monitor Stripe revenue without enabling Stackduck paid plans.

Leave Kelviq plan identifiers unset. The current `/v1/billing/webhooks` handler verifies the signature and logs the event, but does not update subscription entitlements. Paid checkout should not be enabled until event handlers, durable deduplication, provisioning, and sandbox tests are completed. Dashboard settings alone cannot finish this feature.

## Troubleshooting

| Symptom | Check / fix |
| --- | --- |
| Railway builds Vite instead of NestJS | Set API Root Directory to `/backend` |
| Cannot find `dist/src/main.js` | Check Nest build succeeded and service root is `/backend` |
| Pending database migrations | Set Pre-deploy Command to `npm run migrate:prod`; deploy again |
| Database DNS/connect timeout | API and DB must share project/environment; check private URL and database status |
| Password authentication failed | Use a reference to the actual database URL, not local example credentials |
| TimescaleDB required but unavailable | Verify the database really uses TimescaleDB and the DB user can perform setup |
| Invalid encryption-key length | Generate 32 random bytes as base64; paste the complete output |
| OAuth strategy requires client ID | Remove empty OAuth ID/secret variables or supply real values |
| API domain 502 | Check API logs, `PORT=3001`, domain target port, and healthcheck |
| Bare API URL 404 | Use `/v1/health`; the API has no homepage |
| Website loads but actions fail | Verify `VITE_API_BASE`, rebuild frontend, inspect API logs |
| Browser reports CORS | Exact frontend origin must match `PUBLIC_APP_URL` or an explicit allowed origin |
| Refreshing `/signin` returns hosting 404 | Add and deploy the root `vercel.json` SPA rewrite |
| OAuth redirect mismatch | Match provider callback URL and Railway callback variable exactly |
| OAuth returns to localhost | Fix `PUBLIC_APP_URL` and callback variables; redeploy |
| Generated webhook URL uses localhost | Fix `PUBLIC_API_BASE`; redeploy; recreate/copy the current endpoint |
| Reset message appears but email never arrives | Check Resend variables, domain verification, delivery logs, and spam |
| Metrics/alerts stop while idle | Disable API sleeping; check jobs logs and active deployments |
| Repeated alerts or duplicate polling | Keep one replica until scheduler coordination is implemented |

## Completion checklist

- [ ] API health URL returns `{"ok":true}`.
- [ ] Migrations succeeded and Timescale startup passed.
- [ ] Frontend production routes open and refresh successfully.
- [ ] Email/password registration, login, logout, and session restoration work.
- [ ] Projects remain after refresh and sign-in.
- [ ] Public generated webhook URL accepts signed events; metrics appear.
- [ ] A real provider connects and scheduled polling supplies data.
- [ ] Password reset email arrives and changes the password.
- [ ] Alert email arrives; cooldown prevents repeat delivery.
- [ ] Google and GitHub sign-in/import are tested separately if enabled.
- [ ] Production domains work over HTTPS; canonical URL variables match.
- [ ] Backup/restore is tested and the credential encryption key is saved securely.
- [ ] API sleeping is disabled and replica count is one.
- [ ] Paid plans remain disabled pending billing implementation.
