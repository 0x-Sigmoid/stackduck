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
 * Plain-language security posture: what protects your data, the one honest
 * exception (Supabase service_role), and how to report a vulnerability.
 */
export default function Security() {
  return (
    <div className="min-h-screen bg-canvas font-inter text-ink">
      <SiteNav />
      <main id="main-content" className="public-page">
      <article className="max-w-3xl">
        <LegalNav active="security" />
        <header className="border-b border-line pb-6">
          <p className="font-inter text-xs font-semibold uppercase text-ink-muted">How your data is protected</p>
          <h1 className="page-title">Security</h1>
          <p className="mt-2 font-inter text-sm text-ink-muted">Last updated: September 2026</p>
        </header>

        <Section title="Sign-in and sessions">
          <p>
            Passwords are hashed with bcrypt (cost 12) and never stored in readable
            form. Sign-in sessions use short-lived access tokens plus refresh tokens
            that are stored hashed and replaced on every use — stealing a database
            row does not give an attacker a usable session. Google and GitHub
            sign-in are protected against cross-site request forgery during the
            OAuth handshake.
          </p>
        </Section>

        <Section title="Your connector credentials">
          <p>
            API keys and service-account credentials you connect are encrypted with
            AES-256-GCM before they reach the database, and they are never returned
            by the API or written to logs. Webhook endpoints verify a signed
            signature on every delivery and reject replays older than five minutes.
          </p>
        </Section>

        <Section title="One honest exception: Supabase">
          <p>
            The Supabase connector asks for your project's <strong>service_role</strong> key,
            which bypasses Row Level Security and is not structurally read-only, even
            though we only ever read with it. We need it for reliable aggregate reads
            (a limited key could silently hide data from your own monitoring), but you
            should know what you are handing over: treat it as a sensitive credential,
            and rotate it in your Supabase dashboard if it is ever exposed. The connect
            screen says this too — this page is the second place, not the first.
          </p>
        </Section>

        <Section title="Transport and infrastructure">
          <p>
            All traffic is served over HTTPS with HSTS, and the API sends strict
            security headers on every response. Dependencies are updated via
            Dependabot and checked by automated audit on every change.
          </p>
        </Section>

        <Section title="Report a vulnerability">
          <p>
            Found a security problem? Please report it privately through{' '}
            <a
              href="https://github.com/0x-Sigmoid/stackduck/security/advisories/new"
              target="_blank"
              rel="noreferrer"
              className="text-link"
            >
              GitHub Security Advisories
            </a>{' '}
            — not a public issue. Stackduck is maintained by a single developer, so
            expect a first response within about a week; urgent, actively-exploited
            issues jump the queue. The full policy lives in{' '}
            <a
              href="https://github.com/0x-Sigmoid/stackduck/blob/main/SECURITY.md"
              target="_blank"
              rel="noreferrer"
              className="text-link"
            >
              SECURITY.md
            </a>
            .
          </p>
        </Section>

        <div className="mt-8">
          <Link to="/" className="inline-flex min-h-11 items-center gap-2 text-sm font-medium text-ink-muted transition-colors hover:text-ink">
            <ArrowLeft size={16} aria-hidden="true" />Back to home
          </Link>
        </div>
      </article>
      </main>
      <SiteFooter />
    </div>
  )
}
