import { ArrowRight, Clock3, Bug, MessageSquareText } from 'lucide-react'
import SiteNav from '../components/SiteNav'
import SiteFooter from '../components/SiteFooter'

/** Support: honest solo-maintainer help page. No SLA cosplay. */
export default function Support() {
  return (
    <div className="min-h-screen bg-canvas font-inter text-ink">
      <SiteNav />
      <main id="main-content" className="public-page">
        <header className="max-w-3xl border-b border-line pb-8 sm:pb-10">
          <p className="font-inter text-xs font-semibold uppercase text-ink-muted">Support</p>
          <h1 className="page-title">
            Help, <span>human included.</span>
          </h1>
          <p className="mt-4 text-body-lg leading-relaxed text-ink-secondary">
            Stackduck is built and maintained by one person. No support tiers, no bots -
            here is how to actually reach help.
          </p>
        </header>

        <section className="mt-8 max-w-4xl">
          <h2 className="font-inter text-subheading font-semibold">Choose the best route</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className="card flex min-h-52 flex-col items-start">
              <span className="grid size-9 place-items-center rounded-lg border border-line bg-canvas"><Bug size={17} aria-hidden="true" /></span>
              <h3 className="mt-4 font-inter text-body font-semibold">Found a bug?</h3>
              <p className="mt-1 flex-1 text-body-sm leading-relaxed text-ink-secondary">
                GitHub Issues is the bug tracker. Include what you clicked, what you expected, and your
                browser; screenshots help more than paragraphs.
              </p>
              <a href="https://github.com/0x-Sigmoid/stackduck/issues" target="_blank" rel="noreferrer" className="text-link-emphasis text-link mt-4 inline-flex items-center gap-1 text-sm">
                Open GitHub Issues <ArrowRight size={14} aria-hidden="true" />
              </a>
            </div>
            <div className="card flex min-h-52 flex-col items-start">
              <span className="grid size-9 place-items-center rounded-lg border border-line bg-canvas"><MessageSquareText size={17} aria-hidden="true" /></span>
              <h3 className="mt-4 font-inter text-body font-semibold">Have a question or idea?</h3>
              <p className="mt-1 flex-1 text-body-sm leading-relaxed text-ink-secondary">
                Use the feedback form for feature ideas, confusing copy, or anything that does not need a public issue. No account needed.
              </p>
              <a href="/feedback" className="text-link-emphasis text-link mt-4 inline-flex items-center gap-1 text-sm">
                Send feedback <ArrowRight size={14} aria-hidden="true" />
              </a>
            </div>
          </div>
        </section>

        <section className="mt-8 flex max-w-4xl items-start gap-4 border-t border-line pt-6">
          <span className="grid size-9 shrink-0 place-items-center rounded-lg border border-line bg-surface"><Clock3 size={17} aria-hidden="true" /></span>
          <div>
            <h2 className="font-inter text-body font-semibold">What to expect</h2>
            <p className="mt-1 max-w-3xl text-body-sm leading-relaxed text-ink-secondary">
              Honestly: usually within a couple of days, sometimes within the hour, occasionally
              after a weekend. Breaking bugs jump the queue. There is no SLA because there is no
              company - just a maintainer who uses this daily and wants it to work.
            </p>
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  )
}
