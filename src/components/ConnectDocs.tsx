import PortfolioCta from './PortfolioCta'
import { Link } from 'react-router-dom'
import SiteNav from './SiteNav'
import SiteFooter from './SiteFooter'

export function Step({ n, title, children }: { n: string; title: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-4">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-full border border-line-strong bg-surface font-inter text-sm font-semibold text-ink">
        {n}
      </span>
      <div className="min-w-0 flex-1 border-b border-line pb-6 last:border-0">
        <p className="text-xs font-semibold uppercase text-ink-muted">Step {n}</p>
        <h3 className="mt-1 font-inter text-subheading font-semibold">{title}</h3>
        <div className="mt-2 flex flex-col gap-2 text-body leading-relaxed text-ink-secondary">{children}</div>
      </div>
    </div>
  )
}

export function Code({ children }: { children: string }) {
  return (
    <pre className="overflow-x-auto rounded-lg border border-line-strong/30 bg-inkwell-navy p-4 font-mono text-xs leading-relaxed text-paper-white sm:p-5">
      {children}
    </pre>
  )
}

export function Path({ children }: { children: React.ReactNode }) {
  return <p className="rounded-lg border border-line bg-surface px-3 py-2.5 font-inter text-sm font-medium leading-relaxed text-ink">{children}</p>
}

export function Trouble({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border-b border-line py-5">
      <h3 className="font-inter text-body font-semibold">{title}</h3>
      <p className="mt-1 text-body-sm text-ink-muted">{children}</p>
    </div>
  )
}

/** Shared shell for the connection guide pages: nav, header, footer. */
export function GuideShell(props: {
  badge: string
  title: React.ReactNode
  intro: string
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen bg-canvas font-inter text-ink">
      <SiteNav active="docs" />
      <main id="main-content" className="public-page">
        <div className="max-w-3xl border-b border-line pb-8 sm:pb-10">
          <nav aria-label="Breadcrumb" className="mb-5 flex items-center gap-2 text-sm">
            <Link to="/docs" className="nav-link">Documentation</Link>
            <span aria-hidden="true" className="text-ink-muted">/</span>
            <span className="font-medium text-ink">Connection guides</span>
          </nav>
          <p className="badge bg-surface">{props.badge}</p>
          <h1 className="page-title">
            {props.title}
          </h1>
          <p className="mt-4 text-body-lg leading-relaxed text-ink-secondary">{props.intro}</p>
        </div>
        <div className="max-w-3xl">
          {props.children}
          <div className="mt-10 text-center">
            <PortfolioCta />
          </div>
        </div>
      </main>
      <SiteFooter />
    </div>
  )
}
