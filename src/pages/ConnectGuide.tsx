import { Link } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import IntegrationLogo from '../components/IntegrationLogo'
import { GuideShell, Trouble } from '../components/ConnectDocs'

const GUIDES = [
  {
    to: '/docs/connect/firebase',
    tag: 'Firebase',
    title: 'The service-account key',
    blurb: 'Generate a JSON key, lock it to read-only roles, paste it in. Health check runs on the spot.',
  },
  {
    to: '/docs/connect/stripe',
    tag: 'Stripe',
    title: 'The restricted key',
    blurb: 'Scoped to reading charges and payouts, verified instantly. Register the webhook for live events.',
  },
  {
    to: '/docs/connect/supabase',
    tag: 'Supabase',
    title: 'URL + service key',
    blurb: 'Project URL plus the service_role secret (never anon). Polls user totals, signups, and active users.',
  },
  {
    to: '/docs/connect/webhook',
    tag: 'Generic webhook',
    title: 'The signed webhook',
    blurb: 'A private URL plus a signing secret. Your backend signs each event; no SDKs, no agents.',
  },
  {
    to: '/docs#connectors',
    tag: 'Sentry',
    title: 'Organization, project, and token',
    blurb: 'Use a project:read token to report recent error-event volume.',
  },
  {
    to: '/docs#connectors',
    tag: 'GitHub Actions',
    title: 'Repository and fine-grained token',
    blurb: 'Grant read-only Actions and repository metadata access for workflow status.',
  },
  {
    to: '/docs#connectors',
    tag: 'PostHog',
    title: 'Project ID, region, and API key',
    blurb: 'Grant query:read and project read access for usage metrics.',
  },
  {
    to: '/docs#connectors',
    tag: 'Better Stack',
    title: 'Monitor URL and Uptime token',
    blurb: 'Use a read-only Uptime API token to track an existing monitor.',
  },
  {
    to: '/docs#connectors',
    tag: 'Vercel',
    title: 'Project ID and access token',
    blurb: 'Use a scoped read token, and include a team ID for team-owned projects.',
  },
]

/** Connection guide index: one card per connector, each with its own page. */
export default function ConnectGuide() {
  return (
    <GuideShell
      badge="Connection guide"
      title={<>Get your project <span>plugged in.</span></>}
      intro="Every connector needs one thing from you before Stackduck can read it. Pick yours below — each guide is its own page, written assuming no cloud experience."
    >
      <div className="mt-8 grid gap-3 sm:grid-cols-2">
        {GUIDES.map((g) => (
          <Link key={g.tag} to={g.to} className="card card-hover flex min-h-48 flex-col">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <IntegrationLogo name={g.tag} />
                <p className="text-sm font-semibold text-ink">{g.tag}</p>
              </div>
              <ArrowRight size={16} className="text-ink-muted" aria-hidden="true" />
            </div>
            <h2 className="mt-3 font-inter text-subheading font-semibold">{g.title}</h2>
            <p className="mt-2 flex-1 text-body-sm leading-relaxed text-ink-secondary">{g.blurb}</p>
            <p className="mt-4 text-sm font-medium text-ink">Read the guide</p>
          </Link>
        ))}
      </div>
      <h2 className="mt-12 font-inter text-heading-sm font-semibold">If something fails</h2>
      <div className="mt-4 flex flex-col gap-3">
        <Trouble title="“Could not create” / connector won't generate">
          Stackduck couldn't reach its own services — usually you're offline, the request
          timed out, or (if you run your own copy) the API backend isn't deployed yet:
          connectors need the API backend, Auth + database alone aren't enough. Check
          your connection and try again; nothing is half-created, so it's safe to retry.
          Each connector's own page covers what comes next.
        </Trouble>
      </div>
    </GuideShell>
  )
}
