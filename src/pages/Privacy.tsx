import { Link } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import SiteNav from '../components/SiteNav'
import SiteFooter from '../components/SiteFooter'
import LegalNav from '../components/LegalNav'

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="border-b border-line py-6 first:pt-0 last:border-0">
      <h2 className="font-inter text-subheading font-semibold text-ink">{title}</h2>
      <div className="mt-3 flex flex-col gap-3 font-inter text-sm leading-relaxed text-ink-secondary">{children}</div>
    </section>
  )
}

/**
 * Standard-form Privacy Policy for Stackduck (early-stage SaaS).
 * Starting template — have it reviewed by a lawyer before real users sign up.
 */
export default function Privacy() {
  return (
    <div className="min-h-screen bg-canvas font-inter text-ink">
      <SiteNav />
      <main id="main-content" className="public-page">
      <article className="max-w-3xl">
        <LegalNav active="privacy" />
        <header className="border-b border-line pb-6">
          <p className="font-inter text-xs font-semibold uppercase text-ink-muted">Your data and choices</p>
          <h1 className="page-title">Privacy Policy</h1>
          <p className="mt-2 font-inter text-sm text-ink-muted">Last updated: September 2026</p>
        </header>

        <Section title="What Stackduck is">
          <p>
            Stackduck is a monitoring and catalog service for software projects. You register
            the projects you run, optionally connect them to data sources, and view their
            health, usage, and revenue in one portfolio. This policy explains what data we
            collect, why, and what we never do with it.
          </p>
        </Section>

        <Section title="Data we collect">
          <p><strong>Account data.</strong> When you create an account or sign in, we receive your email
            address and basic sign-in activity from our authentication provider. If you use
            Google or GitHub sign-in, we receive the name, email address, and profile image
            those providers share with us — nothing more.</p>
          <p><strong>Project catalog data.</strong> Whatever you enter about your projects: names,
            descriptions, stack tags, repository and live URLs, environment labels, and notes.
            You control this data; only a project name is required.</p>
          <p><strong>Metric data.</strong> When you attach a connector, we collect the metrics that
            connector reports (for example user counts, error counts, or transaction volumes)
            and store them as aggregated daily buckets tied to your projects.</p>
          <p><strong>Consent records.</strong> When you agree to this policy and our Terms of Service,
            we store a timestamped record of that agreement on your account.</p>
        </Section>

        <Section title="Connected accounts you import from">
          <p><strong>GitHub repositories.</strong> If you import projects from GitHub, we read
            your repository listing — names, public/private visibility, and last push dates —
            so you can pick which repos to add. On import, the repo link is saved on the new
            project. We never read your code.</p>
          <p><strong>Google Cloud projects.</strong> If you import from Google Cloud, we read
            your project listing — IDs, names, and project numbers — for the same picker
            purpose. The cloud project ID is kept in the new project's notes so a future
            connector can use it. This access uses a restricted Google scope and works for
            test users while our app verification is pending.</p>
          <p><strong>Access tokens.</strong> The short-lived tokens that power these listings
            are stored encrypted and used only to refresh
            your import lists at your request. Disconnecting the provider or revoking access
            on the provider's side stops this immediately.</p>
        </Section>

        <Section title="Connector credentials">
          <p>
            Connectors that need secrets — such as a Firebase service-account key, an API key,
            or a webhook signing secret — are encrypted before they are stored, never kept
            alongside your project data in readable form. Secrets are never returned by
            the API or written to logs. Secrets are used solely to fetch your metrics and run
            connection health checks.
          </p>
        </Section>

        <Section title="How your data is stored and processed">
          <p>
            Account, catalog, and metric data is stored in a PostgreSQL database
            (with the TimescaleDB extension for metrics) hosted on Railway.
            Authentication is handled by our own API with hashed credentials —
            passwords are never stored in readable form. These processors handle
            your data only as instructed to operate the service.
          </p>
        </Section>

        <Section title="What we never do">
          <p>
            We do not sell your data. We do not share it with advertisers or data brokers.
            We do not show ads. We access your connected services only through the connectors
            you explicitly attach, and only to collect the metrics those connectors report.
          </p>
        </Section>

        <Section title="Your rights">
          <p>
            You can view and edit your catalog data at any time from your project pages. You
            can disconnect any connector, which stops further collection from that source. You
            can ask us to delete your account and its associated data by reaching out — we
            will confirm once deletion is complete.
          </p>
        </Section>

        <Section title="Changes to this policy">
          <p>
            If this policy changes in a way that affects your rights, we will update the
            date above and, where practical, notify you in the product. Continued use of
            Stackduck after a change takes effect means you accept the updated policy.
          </p>
        </Section>

        <Section title="Contact">
          <p>Questions about privacy? Reach out and we will answer.</p>
        </Section>

        <Link to="/" className="text-link mt-6 inline-block text-sm"><ArrowLeft size={14} className="mr-1 inline" aria-hidden="true" />Back</Link>
      </article>
      </main>
      <SiteFooter />
    </div>
  )
}
