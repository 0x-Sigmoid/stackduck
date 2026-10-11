import SiteNav from '../components/SiteNav'
import SiteFooter from '../components/SiteFooter'
import { Reveal } from '../components/Reveal'
import { Check } from 'lucide-react'

const ENTRIES: Array<{ version: string; date: string; items: string[] }> = [
  {
    version: 'Initial release',
    date: 'September 2026',
    items: [
      'Portfolio home with project cards, health colors, search, and filters',
      'Project detail: inline-editable catalog, connectors, metric charts',
      'Connectors: Firebase, Stripe, Supabase, Sentry, GitHub Actions, PostHog, Better Stack, Vercel, and signed webhooks',
      'Email, Google, and GitHub sign-in with consent records',
      'Connection guides, docs, and this changelog',
    ],
  },
]

/** Reverse-chronological changelog. Maintained going forward, not backfilled. */
export default function Changelog() {
  return (
    <div className="min-h-screen bg-canvas font-inter text-ink">
      <SiteNav />
      <main id="main-content" className="public-page">
        <header className="max-w-3xl border-b border-line pb-8 sm:pb-10">
        <p className="font-inter text-xs font-semibold uppercase text-ink-muted">Release notes</p>
        <h1 className="page-title">
          What <span>changed.</span>
        </h1>
        <p className="mt-4 text-body-lg leading-relaxed text-ink-secondary">
          Every release, newest first. Short on purpose.
        </p>
        </header>
        <div className="mt-10 max-w-4xl border-l border-line pl-6 sm:pl-8">
          {ENTRIES.map((e, i) => (
            <Reveal key={e.version} delay={Math.min(i * 0.06, 0.24)}>
            <article className="relative pb-8 before:absolute before:-left-[31px] before:top-1 before:size-3 before:rounded-full before:border-2 before:border-canvas before:bg-ink-muted sm:before:-left-[39px]">
              <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-line pb-3">
                <h2 className="font-inter text-subheading font-semibold">{e.version}</h2>
                <time className="font-inter text-sm text-ink-muted">{e.date}</time>
              </div>
              <ul className="mt-4 grid gap-3 text-body-sm text-ink-secondary sm:grid-cols-2">
                {e.items.map((item) => (
                  <li key={item} className="flex items-start gap-2.5"><Check size={15} className="mt-0.5 shrink-0 text-mint-pulse" aria-hidden="true" /><span>{item}</span></li>
                ))}
              </ul>
            </article>
            </Reveal>
          ))}
        </div>
      </main>
      <SiteFooter />
    </div>
  )
}
