import { Link } from 'react-router-dom'
import { ArrowRight, BellRing, Database, FolderPlus, Monitor, Server, ShieldCheck } from 'lucide-react'
import SiteNav from '../components/SiteNav'
import SiteFooter from '../components/SiteFooter'
import PortfolioDemo from '../components/PortfolioDemo'
import { Reveal } from '../components/Reveal'
import PortfolioCta from '../components/PortfolioCta'
import IntegrationLogo from '../components/IntegrationLogo'

const INTEGRATIONS = ['Firebase', 'Stripe', 'Supabase', 'Sentry', 'GitHub Actions', 'PostHog', 'Better Stack', 'Vercel', 'Signed webhooks']

function Question({ title, children }: { title: string; children: React.ReactNode }) {
  return <details className="group border-b border-line py-5 first:border-t">
    <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-4 text-sm font-semibold marker:hidden [&::-webkit-details-marker]:hidden">{title}<span aria-hidden="true" className="text-xl font-normal text-ink-muted group-open:rotate-45">+</span></summary>
    <div className="mt-2 max-w-3xl text-sm leading-relaxed text-ink-secondary">{children}</div>
  </details>
}

export default function Landing() {

  return (
    <div className="min-h-screen bg-canvas font-inter text-ink">
      <SiteNav />
      <main>
        <header className="mx-auto max-w-[var(--page-max-width)] px-6 pb-10 pt-12 text-center sm:pb-14 sm:pt-20">
          <Reveal>
            <p className="text-xs font-semibold uppercase tracking-wider text-ink-muted">Monitoring for every project you run</p>
            <h1 className="mx-auto mt-4 max-w-3xl font-display text-4xl font-semibold leading-tight text-ink sm:text-6xl">All your projects.<br />One clear view.</h1>
            <p className="mx-auto mt-5 max-w-xl text-base leading-relaxed text-ink-secondary sm:text-lg">Track health, users, errors, and revenue across your apps. Connect the tools you already use and spend less time building dashboards.</p>
            <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
              <PortfolioCta />
              <a href="#demo" className="btn-ghost">View demo</a>
            </div>
            <p className="mt-5"><Link to="/docs" className="text-link inline-flex min-h-11 items-center gap-1.5 text-sm">Read the Docs <ArrowRight size={14} aria-hidden="true" /></Link></p>
          </Reveal>
        </header>

        <section id="demo" aria-labelledby="demo-heading" className="mx-auto max-w-[var(--page-max-width)] scroll-mt-8 px-6 pb-16 sm:pb-20">
          <Reveal>
            <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
              <div><h2 id="demo-heading" className="font-display text-2xl font-semibold">See what your portfolio could look like</h2><p className="mt-2 text-sm text-ink-muted">Explore projects and time ranges. This demo uses sample data and requires no sign-in.</p></div>
              <a href="#how-it-works" className="text-link inline-flex min-h-11 items-center gap-1.5 text-sm">See how it works <ArrowRight size={14} aria-hidden="true" /></a>
            </div>
            <PortfolioDemo />
          </Reveal>
        </section>

        <section id="how-it-works" aria-labelledby="workflow-heading" className="scroll-mt-8 border-y border-line bg-surface">
          <div className="mx-auto max-w-[var(--page-max-width)] px-6 py-14 sm:py-20">
            <h2 id="workflow-heading" className="font-display text-2xl font-semibold sm:text-3xl">From a project name to a clear picture</h2>
            <p className="mt-3 text-sm text-ink-muted">Three steps to start monitoring. Metadata and extra sources can wait.</p>
            <ol className="mt-8 grid gap-8 md:grid-cols-3">
              {[
                { Icon: FolderPlus, title: 'Create a project', text: 'Create your account and give your project a name. Add stack tags, links, and notes whenever you need them.' },
                { Icon: Database, title: 'Connect a source', text: 'Choose an integration and follow its credential guide, or send signed events from your own backend.' },
                { Icon: BellRing, title: 'Receive metrics and alerts', text: 'Charts appear when the first samples arrive. Add threshold rules for email or webhook notifications.' },
              ].map(({ Icon, title, text }, index) => <li key={title} className="min-w-0"><div className="flex items-center gap-3"><span className="grid size-10 place-items-center rounded-lg border border-line bg-inset"><Icon size={18} aria-hidden="true" /></span><span className="text-xs font-semibold text-ink-muted">0{index + 1}</span></div><h3 className="mt-4 text-base font-semibold">{title}</h3><p className="mt-2 text-sm leading-relaxed text-ink-secondary">{text}</p></li>)}
            </ol>
          </div>
        </section>

        <section aria-labelledby="integrations-heading" className="mx-auto max-w-[var(--page-max-width)] px-6 py-14 sm:py-20">
          <div className="flex flex-wrap items-end justify-between gap-4"><div><h2 id="integrations-heading" className="font-display text-2xl font-semibold sm:text-3xl">Connect your existing stack</h2><p className="mt-3 max-w-xl text-sm text-ink-muted">Bring usage, errors, revenue, deployments, and uptime into the same portfolio. Each source reports the metrics it supports.</p></div><Link to="/docs/connect" className="text-link inline-flex min-h-11 items-center gap-1.5 text-sm">Browse connection guides <ArrowRight size={14} aria-hidden="true" /></Link></div>
          <ul className="mt-6 flex flex-wrap gap-2" aria-label="Available integrations">{INTEGRATIONS.map((name) => <li key={name} className="flex min-h-16 items-center gap-3 rounded-xl border border-line bg-surface px-4 py-3 text-sm font-medium"><IntegrationLogo name={name} /><span>{name}</span></li>)}</ul>
        </section>

        <section aria-labelledby="questions-heading" className="mx-auto max-w-[var(--page-max-width)] px-6 pb-14 sm:pb-20">
          <div className="grid gap-8 lg:grid-cols-[1fr_2fr]">
            <div><ShieldCheck size={22} aria-hidden="true" className="text-ink-muted" /><h2 id="questions-heading" className="mt-4 font-display text-2xl font-semibold">Before you connect</h2><p className="mt-3 text-sm leading-relaxed text-ink-muted">Know what access is needed, when data arrives, and how to run Stackduck.</p></div>
            <div>
              <Question title="What permissions do I need?"><p>Access depends on the source: Firebase uses a service account with Authentication Viewer and Logs Viewer roles; Stripe supports restricted read access; Supabase currently requires a service-role key, which has broad access. Other integrations use provider-specific API tokens.</p><p className="mt-3">Connector credentials are encrypted on the server. Follow the <Link to="/docs/connect" className="text-link">connection guides</Link> for the exact permissions, and read our <Link to="/security" className="text-link">security information</Link> before sharing credentials.</p></Question>
              <Question title="How often does data update?"><p>Firebase, Supabase, Sentry, GitHub Actions, PostHog, Better Stack, and Vercel are polled on a 30-minute schedule. Signed webhooks report when your app sends an event. Stripe webhook events require its endpoint to be configured; reconciliation runs daily.</p><p className="mt-3">Alert rules are evaluated every five minutes. Delivery depends on the configured email or webhook channel. The portfolio shows sample freshness so you can see when data last arrived.</p></Question>
              <Question title="Can I try it before creating an account?"><p>Yes. The <a href="#demo" className="text-link">interactive demo</a> uses example projects and values. Connecting your own sources and saving a portfolio requires an account.</p></Question>
              <Question title="Can I self-host Stackduck?"><p>Yes. Stackduck is open source. You can run the frontend and API yourself with Node.js and PostgreSQL/TimescaleDB; Docker provisions the local database. You configure authentication secrets, credential encryption, and notification delivery for your deployment.</p><p className="mt-3">Use this app to get started with an account, or follow the <Link to="/docs#quickstart" className="text-link">self-hosting quickstart</Link> to run your own copy.</p></Question>
              <Question title="What does it cost?"><p>The app’s pricing page describes free early access for monitoring features. Visit <Link to="/pricing" className="text-link">Pricing</Link> for current plans and availability. Self-hosting also requires your own infrastructure; provider services and email delivery may have their own costs.</p></Question>
            </div>
          </div>
        </section>

        <section id="self-hosting" aria-labelledby="self-hosting-heading" className="mx-auto max-w-[var(--page-max-width)] px-6 pb-14 sm:pb-20">
          <div className="grid gap-6 rounded-2xl border border-line bg-surface p-6 sm:p-8 md:grid-cols-2">
            <div><Server size={22} aria-hidden="true" className="text-ink-muted" /><h2 id="self-hosting-heading" className="mt-4 font-display text-2xl font-semibold">Prefer your own infrastructure?</h2><p className="mt-3 text-sm leading-relaxed text-ink-secondary">Run your own copy of Stackduck. The quickstart covers the database, API configuration, secrets, and frontend setup.</p><Link to="/docs#quickstart" className="btn-ghost mt-5">Self-hosting guide <ArrowRight size={14} aria-hidden="true" /></Link></div>
            <div className="border-t border-line pt-6 md:border-l md:border-t-0 md:pl-6 md:pt-0"><Monitor size={22} aria-hidden="true" className="text-ink-muted" /><h3 className="mt-4 text-base font-semibold">Start with the source code</h3><code className="mt-3 block break-words rounded-lg bg-inset p-4 font-mono text-xs leading-relaxed">npx degit 0x-Sigmoid/stackduck my-stackduck</code><p className="mt-3 text-xs leading-relaxed text-ink-muted">This command copies the repository. It does not install dependencies, configure the database, or start the app.</p><a href="https://github.com/0x-Sigmoid/stackduck" target="_blank" rel="noreferrer" className="text-link mt-3 inline-flex min-h-11 items-center gap-1.5 text-sm">View source on GitHub <ArrowRight size={14} aria-hidden="true" /></a></div>
          </div>
        </section>

        <section aria-labelledby="start-heading" className="mx-auto max-w-[var(--page-max-width)] px-6 pb-16">
          <div className="rounded-2xl bg-feature p-8 text-center text-paper-white sm:p-12"><h2 id="start-heading" className="font-display text-2xl font-semibold sm:text-3xl">Give your projects one place to check in</h2><p className="mx-auto mt-3 max-w-lg text-sm leading-relaxed text-paper-white/80">Start with a name. Connect your first source when you’re ready.</p><div className="mt-6 inline-block"><PortfolioCta inverse /></div></div>
        </section>
      </main>
      <SiteFooter />
    </div>
  )
}
