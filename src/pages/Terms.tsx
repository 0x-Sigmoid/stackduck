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
 * Standard-form Terms of Service for Stackduck (early-stage SaaS).
 * Starting template — have it reviewed by a lawyer before real users sign up.
 */
export default function Terms() {
  return (
    <div className="min-h-screen bg-canvas font-inter text-ink">
      <SiteNav />
      <main id="main-content" className="public-page">
      <article className="max-w-3xl">
        <LegalNav active="terms" />
        <header className="border-b border-line pb-6">
          <p className="font-inter text-xs font-semibold uppercase text-ink-muted">Using Stackduck</p>
          <h1 className="page-title">Terms of Service</h1>
          <p className="mt-2 font-inter text-sm text-ink-muted">Last updated: September 2026</p>
        </header>

        <Section title="The service">
          <p>
            Stackduck provides project cataloging, metric collection through connectors,
            dashboards, and alerting. The service is under active development: features may
            change, and metrics are informational — they are not a substitute for your own
            monitoring, backups, or incident response.
          </p>
        </Section>

        <Section title="Your account">
          <p>
            You need an account to use Stackduck. Keep your credentials private and do not
            share your account. You are responsible for everything done under your account,
            including projects registered and connectors attached with it.
          </p>
        </Section>

        <Section title="Acceptable use">
          <p>Connect only services you own or are authorized to access. Do not use Stackduck to:</p>
          <ul className="list-disc pl-5">
            <li>collect data you have no right to collect;</li>
            <li>probe, disrupt, or abuse third-party services through connectors or webhooks;</li>
            <li>circumvent access controls, rate limits, or the law.</li>
          </ul>
          <p>We may suspend accounts that do any of the above.</p>
        </Section>

        <Section title="Your content">
          <p>
            You keep ownership of everything you put into Stackduck — project details, metrics,
            and credentials. You grant us only the limited right to store and process that
            content in order to operate the service (for example, running scheduled metric
            polls you configured, or sending alerts you set up).
          </p>
        </Section>

        <Section title="Credentials you provide">
          <p>
            Service-account keys, API keys, and webhook secrets you supply are encrypted
            at rest and used solely for the connector they belong to. Use
            least-privilege, read-only credentials where the connected service allows it, and
            rotate a secret immediately if you believe it has been exposed.
          </p>
        </Section>

        <Section title="Availability and liability">
          <p>
            We aim for reliable service but make no guarantees about uptime, data freshness,
            or alert delivery. To the maximum extent permitted by law, Stackduck is provided
            “as is,” and we are not liable for indirect or consequential losses — including
            downtime, missed alerts, or decisions made on the basis of displayed metrics.
          </p>
        </Section>

        <Section title="Changes and termination">
          <p>
            We may update these terms; material changes take effect after notice in the
            product, and continued use means acceptance. You may stop using Stackduck at any
            time. We may suspend or terminate accounts for violations of these terms.
          </p>
        </Section>

        <Link to="/" className="text-link mt-6 inline-block text-sm"><ArrowLeft size={14} className="mr-1 inline" aria-hidden="true" />Back</Link>
      </article>
      </main>
      <SiteFooter />
    </div>
  )
}
