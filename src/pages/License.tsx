import SiteNav from '../components/SiteNav'
import SiteFooter from '../components/SiteFooter'
import LegalNav from '../components/LegalNav'

/** License page: plain-language MIT summary + pointer to the repo file. */
export default function License() {
  return (
    <div className="min-h-screen bg-canvas font-inter text-ink">
      <SiteNav />
      <main id="main-content" className="public-page">
        <article className="max-w-3xl">
          <LegalNav active="license" />
          <header className="border-b border-line pb-6">
            <p className="font-inter text-xs font-semibold uppercase text-ink-muted">Open source</p>
            <h1 className="page-title">
              Free as in <span>actually free.</span>
            </h1>
            <p className="mt-2 text-sm font-medium text-ink-muted">MIT License</p>
          </header>
          <div className="mt-6 flex flex-col gap-5 font-inter text-body leading-relaxed text-ink-secondary">
            <p>
              Stackduck is MIT licensed. In plain language: you can <strong>use it, modify
              it, self-host it, and build on it</strong> — including commercially — as long
              as you keep the copyright notice in copies of the code.
            </p>
            <p>
              No warranty, as open-source licenses go: the software is provided as-is. Read
              the full text in the repo:{' '}
              <a
                href="https://github.com/0x-Sigmoid/stackduck/blob/main/LICENSE"
                target="_blank"
                rel="noreferrer"
                className="text-link-emphasis text-link"
              >
                LICENSE on GitHub
              </a>
              .
            </p>
            <p className="text-ink-muted">Copyright © 2026 Asterverse Integrated Solutions and Allied Services Ltd.</p>
          </div>
        </article>
      </main>
      <SiteFooter />
    </div>
  )
}
