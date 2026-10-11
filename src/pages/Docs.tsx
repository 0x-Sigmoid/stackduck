import PortfolioCta from '../components/PortfolioCta'
import { useEffect } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import SiteNav from '../components/SiteNav'
import SiteFooter from '../components/SiteFooter'
import { Code } from '../components/ConnectDocs'

function Step({ n, title, children }: { n: string; title: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-4">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-full border border-line-strong bg-surface font-inter text-sm font-semibold text-ink">
        {n}
      </span>
      <div className="min-w-0 flex-1 border-b border-line pb-6">
        <p className="text-xs font-semibold uppercase text-ink-muted">Step {n}</p>
        <h3 className="mt-1 font-inter text-subheading font-semibold">{title}</h3>
        <div className="mt-2 flex flex-col gap-2 text-body leading-relaxed text-ink-secondary">{children}</div>
      </div>
    </div>
  )
}

function Faq({ q, children }: { q: string; children: React.ReactNode }) {
  return (
    <details className="group border-b border-line py-4 first:border-t">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-inter text-body font-semibold [&::-webkit-details-marker]:hidden">
        {q}<span aria-hidden="true" className="text-xl font-normal text-ink-muted group-open:rotate-45">+</span>
      </summary>
      <div className="mt-2 text-body-sm leading-relaxed text-ink-secondary">{children}</div>
    </details>
  )
}

/** Full documentation: concepts, quickstart, connectors, self-hosting, FAQ. */
export default function Docs() {
  // Client-side hash links (e.g. /docs#quickstart) don't auto-scroll under
  // plain routing, so scroll to the anchor on arrival.
  const { hash } = useLocation()
  useEffect(() => {
    if (hash) {
      try { document.getElementById(decodeURIComponent(hash.slice(1)))?.scrollIntoView() } catch { /* Ignore invalid fragments. */ }
    }
  }, [hash])

  return (
    <div className="min-h-screen bg-canvas font-inter text-ink">
      <SiteNav active="docs" />

      <main id="main-content" className="public-page">
        <header className="max-w-3xl border-b border-line pb-8 sm:pb-10">
        <p className="font-inter text-xs font-semibold uppercase text-ink-muted">Stackduck documentation</p>
        <h1 className="page-title">
          A guide to your portfolio.
        </h1>
        <p className="mt-4 max-w-2xl text-body-lg leading-relaxed text-ink-secondary">
          Learn the monitoring workflow, connect a source, or set up your own deployment.
        </p>
        </header>

        <nav aria-label="On this page" className="sticky top-0 z-10 -mx-6 mt-6 border-y border-line bg-canvas/95 px-6 py-3 backdrop-blur-sm">
          <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-5 gap-y-2 font-inter text-sm font-medium">
            <span className="hidden text-xs font-semibold uppercase text-ink-muted sm:inline">On this page</span>
            <a href="#get-started" className="nav-link">Get started</a>
            <a href="#concepts" className="nav-link">Core concepts</a>
            <a href="#quickstart" className="nav-link">Quickstart</a>
            <a href="#connectors" className="nav-link">Connectors</a>
            <a href="#self-hosting" className="nav-link">Self-hosting</a>
            <a href="#faq" className="nav-link">Questions</a>
          </div>
        </nav>

        <div className="max-w-4xl">
        <section id="get-started" className="mt-10 scroll-mt-24 grid gap-6 border-b border-line pb-8 sm:grid-cols-2"><div><h2 className="text-xl font-semibold">Use this app</h2><p className="mt-3 text-sm leading-relaxed text-ink-secondary">Create an account, name a project, and connect a source. Your overview shows health, metric trends, and when data last arrived.</p><div className="mt-5"><PortfolioCta /></div></div><div className="border-t border-line pt-6 sm:border-l sm:border-t-0 sm:pl-6 sm:pt-0"><h2 className="text-xl font-semibold">Run your own copy</h2><p className="mt-3 text-sm leading-relaxed text-ink-secondary">Set up the frontend, API, database, and secrets on your own infrastructure. The self-hosting guide covers each part.</p><a href="#quickstart" className="btn-ghost mt-5">Self-hosting quickstart</a></div></section>
        <h2 id="concepts" className="mt-12 scroll-mt-24 border-b border-line pb-3 font-inter text-heading-sm font-semibold">Core concepts</h2>
        <div className="mt-4 grid gap-px overflow-hidden rounded-cards border border-line bg-line md:grid-cols-3">
          <div className="bg-surface p-5 sm:p-6">
            <h3 className="font-inter text-body font-semibold">Project — your catalog entry</h3>
            <p className="mt-1 text-body-sm leading-relaxed text-ink-secondary">
              A project is the thing you run: a name plus whatever context you care about —
              description, stack tags, repo and live links, environment. Only the name is
              required. The catalog never gates monitoring; it's the label everything else hangs off.
            </p>
          </div>
          <div className="bg-surface p-5 sm:p-6">
            <h3 className="font-inter text-body font-semibold">Connector — how data gets in</h3>
            <p className="mt-1 text-body-sm leading-relaxed text-ink-secondary">
              A connector authenticates against one of your backends and translates what it finds
              into a common shape. Poll connectors (Firebase, Supabase, Sentry, GitHub Actions,
              PostHog, Better Stack, Vercel, and Stripe reconciliation) fetch on a schedule; push connectors (generic
              webhook and Stripe events) receive data your
              systems send. Each one reports its own status — receiving updates, having trouble,
              or waiting for first data — independently of the project's status.
            </p>
          </div>
          <div className="bg-surface p-5 sm:p-6">
            <h3 className="font-inter text-body font-semibold">Metric — what you actually read</h3>
            <p className="mt-1 text-body-sm leading-relaxed text-ink-secondary">
              Every data point lands in one of five buckets: users, errors, revenue, uptime, or
              custom. Points are stored individually in a time-series store and rolled up
              into daily aggregates when you read them, which is why a year of
              charts loads as fast as a week. Cards show the latest numbers; detail pages chart
              the history.
            </p>
          </div>
        </div>

        <h2 id="quickstart" className="mt-14 scroll-mt-24 border-b border-line pb-3 font-inter text-heading-sm font-semibold">Quickstart</h2>

        <h3 className="mt-6 font-inter text-body font-semibold">Run your own copy</h3>
        <div className="mt-3 flex flex-col gap-3 text-body text-ink-muted">
          <p>
            Everything below runs on your machine. You need Node 20+ and Docker.
            Stackduck has two halves with separate prerequisites — set up the one
            you need, or both:
          </p>
          <ul className="list-disc pl-5">
            <li>
              <strong>API backend (NestJS + Postgres/TimescaleDB).</strong> Owns
              auth, connectors, metrics, and alerts. It needs no cloud account —
              Docker Compose provisions its database locally.
            </li>
            <li>
              <strong>Frontend (React).</strong> Talks to the API over REST — just
              point it at the backend's URL.
            </li>
          </ul>
        </div>
        <div className="mt-3">
          <Code>{`npx degit 0x-Sigmoid/stackduck my-stackduck
cd my-stackduck`}</Code>
        </div>
        <div className="mt-3 flex flex-col gap-3 text-body text-ink-muted">
          <p>
            <strong>API backend:</strong> from <code>backend/</code>, install,
            configure, and start the database and server (the example file tells
            you how to generate each secret):
          </p>
        </div>
        <div className="mt-3">
          <Code>{`cd backend
npm install
cp .env.example .env   # fill in JWT + encryption secrets
docker compose -f docker-compose.yml up -d   # Postgres/TimescaleDB
npm run start:dev   # API on :3001, /v1/health`}</Code>
        </div>
        <div className="mt-3 flex flex-col gap-3 text-body text-ink-muted">
          <p>
            <strong>Frontend:</strong> from the repo root, point the app at the API
            and start it:
          </p>
        </div>
        <div className="mt-3">
          <Code>{`npm install
cp .env.example .env   # VITE_API_BASE=http://localhost:3001
npm run dev   # the whole UI against your local API`}</Code>
        </div>

        <h3 className="mt-8 font-inter text-body font-semibold">Your first project</h3>
        <div className="mt-5 flex flex-col gap-2">
          <Step n="1" title="Add your project">
            <p>
              Give it a name — that's all it takes. Add descriptions, links, and tags
              whenever you like; nothing here gates the monitoring.
            </p>
          </Step>
          <Step n="2" title="Connect live data">
            <p>
              Pick a connector right after creating the project, or any time later from
              its page. Connect supported services with a scoped read token or service
              credential; Stackduck verifies access and polls on a schedule (about every
              30 minutes; Stripe revenue reconciliation runs nightly). Any other
              backend can push signed events to a unique URL we generate for you.
            </p>
          </Step>
          <Step n="3" title="Read the portfolio">
            <p>
              Your home page becomes the morning check: every project a card, color-coded
              by health, key numbers on the front. Click through for charts and history.
              You can save threshold rules that are evaluated every few minutes and notify
              you by email or webhook when they trip.
            </p>
          </Step>
        </div>

        <h2 id="connectors" className="mt-14 scroll-mt-24 border-b border-line pb-3 font-inter text-heading-sm font-semibold">Connectors at a glance</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div className="bg-surface p-5 sm:p-6">
            <h3 className="font-inter text-body font-semibold">Firebase</h3>
            <p className="mt-1 text-body-sm text-ink-muted">
              Paste a service-account key. Stackduck checks the connection immediately,
              then polls user and error metrics on a schedule. Works best with read-only
              keys. <Link to="/docs/connect/firebase" className="text-link-emphasis text-link">Step-by-step key guide <ArrowRight size={14} className="ml-1 inline" aria-hidden="true" /></Link>
            </p>
          </div>
          <div className="bg-surface p-5 sm:p-6">
            <h3 className="font-inter text-body font-semibold">Generic webhook</h3>
            <p className="mt-1 text-body-sm text-ink-muted">
              For anything else — Express, Django, Rails, a cron job. We give you a URL
              and a signing secret; your backend signs each event and posts it. The
              connector flips to connected on the first verified event. <Link to="/docs/connect/webhook" className="text-link-emphasis text-link">Signing walkthrough <ArrowRight size={14} className="ml-1 inline" aria-hidden="true" /></Link>
            </p>
          </div>
          <div className="bg-surface p-5 sm:p-6">
            <h3 className="font-inter text-body font-semibold">Stripe</h3>
            <p className="mt-1 text-body-sm text-ink-muted">
              Paste a restricted secret key and Stackduck checks it on the spot. Register
              the endpoint URL we give you in your Stripe dashboard for instant charge and
              payout events — or skip it and get nightly revenue totals instead.{' '}
              <Link to="/docs/connect/stripe" className="text-link-emphasis text-link">Step-by-step key guide <ArrowRight size={14} className="ml-1 inline" aria-hidden="true" /></Link>
            </p>
          </div>
          <div className="bg-surface p-5 sm:p-6">
            <h3 className="font-inter text-body font-semibold">Supabase</h3>
            <p className="mt-1 text-body-sm text-ink-muted">
              Paste your project URL plus the service_role secret and Stackduck checks it
              on the spot, then polls user totals, signups, and 30-day active users. The
              anon key can't list users, so the health check tells you immediately if you
              pasted the wrong one. Note: this key has broader access than we use — we only
              read from it, but the key itself isn't restricted to read-only the way our
              other connectors' credentials are.{' '}
              <Link to="/docs/connect/supabase" className="text-link-emphasis text-link">Step-by-step key guide <ArrowRight size={14} className="ml-1 inline" aria-hidden="true" /></Link>
            </p>
          </div>
          <div className="bg-surface p-5 sm:p-6">
            <h3 className="font-inter text-body font-semibold">Sentry</h3>
            <p className="mt-1 text-body-sm text-ink-muted">
              Add an organization and project slug plus a token with project:read access.
              Stackduck polls the project's received error-event volume for the last 24 hours.
            </p>
          </div>
          <div className="bg-surface p-5 sm:p-6">
            <h3 className="font-inter text-body font-semibold">GitHub Actions</h3>
            <p className="mt-1 text-body-sm text-ink-muted">
              Connect a repository and fine-grained token with read-only Actions access.
              Stackduck tracks workflow runs, failures, and in-progress runs over time.
            </p>
          </div>
          <div className="bg-surface p-5 sm:p-6">
            <h3 className="font-inter text-body font-semibold">PostHog</h3>
            <p className="mt-1 text-body-sm text-ink-muted">
              Enter your project ID, region, and a project-scoped personal API key. Stackduck
              reads 30-day active users and 24-hour event volume.
            </p>
          </div>
          <div className="bg-surface p-5 sm:p-6">
            <h3 className="font-inter text-body font-semibold">Better Stack</h3>
            <p className="mt-1 text-body-sm text-ink-muted">
              Match an existing monitor by URL using a read-only Uptime API token. Stackduck
              records its current availability (up or down) on each poll.
            </p>
          </div>
          <div className="bg-surface p-5 sm:p-6">
            <h3 className="font-inter text-body font-semibold">Vercel</h3>
            <p className="mt-1 text-body-sm text-ink-muted">
              Provide a scoped access token and project ID (plus team ID for team projects).
              Stackduck tracks ready, active, and failed deployments from the last 24 hours.
            </p>
          </div>
        </div>

        <h2 id="self-hosting" className="mt-14 scroll-mt-24 border-b border-line pb-3 font-inter text-heading-sm font-semibold">Self-hosting & contributing</h2>
        <div className="mt-4 flex flex-col gap-3 text-body leading-relaxed text-ink-secondary">
          <p>
            Stackduck is MIT licensed and lives at{' '}
            <a
              href="https://github.com/0x-Sigmoid/stackduck"
              target="_blank"
              rel="noreferrer"
              className="text-link-emphasis text-link"
            >
              github.com/0x-Sigmoid/stackduck
            </a>
            . To run your own copy, follow <a href="#quickstart" className="text-link-emphasis text-link">Quickstart</a> above;
            a few notes that only matter once you're running it: scheduled polling and
            alert evaluation run as cron jobs inside the API in <code>backend/</code>
            (backed by Postgres/TimescaleDB — see <code>backend/RAILWAY.md</code> for
            hosting). The API contract lives in <code>API_CONTRACT.md</code> (historical
            Firebase notes plus the cutover deltas) and every
            open question gets logged in <code>DECISIONS.md</code>.
          </p>
          <p>
            Bugs and ideas belong in{' '}
            <a
              href="https://github.com/0x-Sigmoid/stackduck/issues"
              target="_blank"
              rel="noreferrer"
              className="text-link-emphasis text-link"
            >
              GitHub Issues
            </a>
            , pull requests are welcome. A new connector is one provider file in{' '}
            <code>backend/src/connectors/providers/</code> plus a card in the Add flow — the
            existing providers are the template.
          </p>
        </div>

        <h2 id="faq" className="mt-14 scroll-mt-24 border-b border-line pb-3 font-inter text-heading-sm font-semibold">Questions</h2>
        <div className="mt-1">
          <Faq q="Do I have to change my project code?">
            <p>For Firebase: no. For other backends: a few lines to sign and post events to your ingest URL. No agents, no SDKs to install.</p>
          </Faq>
          <Faq q="What happens to the keys I paste in?">
            <p>Secrets are encrypted with AES-256-GCM before they reach the database, and the API never returns them or writes them to logs. Rotate a key any time if you're unsure.</p>
          </Faq>
          <Faq q="Can I track projects for clients or a team?">
            <p>Accounts are single-owner right now: your projects, your logins. Sharing comes later.</p>
          </Faq>
          <Faq q="How much does it cost?">
            <p>Everything is free during early access. See <Link to="/pricing" className="text-link-emphasis text-link">Pricing</Link> for the plain version.</p>
          </Faq>
        </div>

        <div className="mt-10 text-center">
          <PortfolioCta />
        </div>
        </div>
      </main>

      <SiteFooter />
    </div>
  )
}
