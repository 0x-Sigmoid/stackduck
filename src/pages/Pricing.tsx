import PortfolioCta from '../components/PortfolioCta'
import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Activity, ArrowRight, Check as CheckIcon, CircleCheck, UsersRound } from 'lucide-react'
import SiteNav from '../components/SiteNav'
import SiteFooter from '../components/SiteFooter'
import { Reveal } from '../components/Reveal'
import { useAuthUser } from '../lib/useAuthUser'
import { getPlans, startCheckout, type PlanOffer } from '../lib/billing'

/** Intended prices, shown until the server publishes live ones. */
const FALLBACK_PRICES = { monthly: 9.99, yearly: 107.89 } as const

function Faq({ q, children }: { q: string; children: React.ReactNode }) {
  return (
    <details className="group border-b border-line py-5 text-left first:border-t">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-inter text-body font-semibold marker:hidden focus-visible:outline-2 focus-visible:outline-ring [&::-webkit-details-marker]:hidden">
        {q}
        <span aria-hidden="true" className="text-xl font-normal text-ink-muted transition-transform group-open:rotate-45">+</span>
      </summary>
      <div className="mt-2 max-w-3xl text-body-sm leading-relaxed text-ink-secondary">{children}</div>
    </details>
  )
}

function Check() {
  return <CheckIcon size={16} aria-hidden="true" className="inline-block shrink-0" />
}

function PricingPreview() {
  return (
    <div role="img" aria-label="Stackduck portfolio dashboard preview" className="w-full rounded-cards border border-line bg-surface p-4 sm:p-5">
      <div className="flex items-center justify-between border-b border-line pb-3">
        <div className="flex items-center gap-2">
          <span className="grid size-8 place-items-center rounded-lg bg-inset text-ink"><Activity size={16} aria-hidden="true" /></span>
          <div>
            <p className="text-xs font-semibold">Your portfolio</p>
            <p className="mt-0.5 text-[11px] text-ink-muted">All projects in one view</p>
          </div>
        </div>
        <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-ink-secondary"><span className="status-dot status-green size-2" />Example</span>
      </div>
      <div className="grid grid-cols-3 divide-x divide-line py-4 text-center">
        <div><p className="text-[10px] text-ink-muted">Projects</p><p className="mt-1 text-lg font-semibold tabular-nums">08</p></div>
        <div><p className="text-[10px] text-ink-muted">Users</p><p className="mt-1 text-lg font-semibold tabular-nums">2.4k</p></div>
        <div><p className="text-[10px] text-ink-muted">Health</p><p className="mt-1 inline-flex items-center gap-1 text-sm font-semibold"><CircleCheck size={14} className="text-mint-pulse" aria-hidden="true" />Good</p></div>
      </div>
      <div className="flex items-end justify-between gap-3 border-t border-line pt-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between text-[10px]">
            <span className="font-medium">Activity</span><span className="text-ink-muted">Last 7 days</span>
          </div>
          <div aria-hidden="true" className="mt-3 flex h-12 items-end gap-1.5">
            {[35, 48, 39, 65, 54, 82, 60, 74, 52, 92, 68, 80, 59, 100, 76, 88, 66, 95, 72, 84].map((height, i) => (
              <span key={i} className={`min-w-0 flex-1 rounded-t-[2px] ${i === 13 ? 'bg-ink' : 'bg-ink/15'}`} style={{ height: `${height}%` }} />
            ))}
          </div>
        </div>
        <div className="hidden w-28 shrink-0 border-l border-line pl-3 sm:block">
          <p className="text-[10px] text-ink-muted">Latest project</p>
          <p className="mt-1 truncate text-xs font-semibold">asterscholar</p>
          <p className="mt-1 inline-flex items-center gap-1 text-[10px] text-ink-secondary"><span className="status-dot status-green size-1.5" />Healthy</p>
        </div>
      </div>
    </div>
  )
}

/** Pricing: free during early access, Pro flat-rate options, comparison, FAQ. */
export default function Pricing() {
  const navigate = useNavigate()
  const sessionUser = useAuthUser()
  const [offers, setOffers] = useState<PlanOffer[] | null>(null)
  const [teamsNote, setTeamsNote] = useState('')
  const [catalogueError, setCatalogueError] = useState(false)
  const [attempt, setAttempt] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState<'monthly' | 'yearly' | null>(null)

  useEffect(() => {
    setCatalogueError(false)
    setOffers(null)
    let active = true
    void getPlans().then((r) => {
      if (!active) return
      setOffers(r.plans)
      setTeamsNote(r.teamsNote)
    }).catch(() => { if (active) { setCatalogueError(true); setOffers([]) } })
    return () => { active = false }
  }, [attempt])

  const offered = (period: 'monthly' | 'yearly') =>
    offers?.find((o) => o.period === period)?.offered ?? false
  const price = (period: 'monthly' | 'yearly') =>
    offers?.find((o) => o.period === period)?.price ?? FALLBACK_PRICES[period]

  async function upgrade(period: 'monthly' | 'yearly') {
    if (!sessionUser) {
      navigate('/signin?mode=signup')
      return
    }
    setError(null)
    setBusy(period)
    try {
      await startCheckout(period)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not start checkout. Try again in a minute.')
    } finally {
      setBusy(null)
    }
  }

  const rows: Array<{ label: string; free: string; pro: string }> = [
    { label: 'Price', free: '$0', pro: '$9.99/mo or $107.89/yr' },
    { label: 'Projects', free: 'Unlimited', pro: 'Unlimited' },
    { label: 'Connectors', free: 'All available', pro: 'All available' },
    { label: 'Charts & history', free: 'Full access', pro: 'Full access' },
    { label: 'Alerts', free: 'Threshold rules + notifications', pro: 'Threshold rules + notifications' },
    { label: 'Support', free: 'Community (Issues)', pro: 'Priority' },
  ]

  const freeFeatures = [
    'Unlimited projects in your portfolio',
    'All available connectors',
    'Metric charts and history',
    'Threshold rules with email and webhook notifications',
  ]

  return (
    <div className="min-h-screen bg-canvas font-inter text-ink">
      <SiteNav active="pricing" />

      <main id="main-content" className="public-page">
        <section className="grid items-center gap-8 border-b border-line pb-10 md:grid-cols-[minmax(0,1fr)_minmax(300px,440px)] md:gap-12 md:pb-12">
          <div className="max-w-2xl">
            <p className="badge badge-success">Early access</p>
            <h1 className="page-title">
              Plans for your portfolio.
            </h1>
            <p className="mt-4 max-w-xl text-body-lg leading-relaxed text-ink-secondary">
              {offers === null ? 'Checking current plan availability…' : catalogueError ? 'Plan availability is temporarily unavailable. Try again before choosing a plan.' : offers.some(plan => plan.offered) ? 'Start with a portfolio. Review the available plans below before upgrading.' : 'Monitoring is free during early access. Paid plans are not published yet.'}
            </p>
          </div>
          <PricingPreview />
        </section>

        {catalogueError && <div role="alert" className="mt-6 flex flex-wrap items-center gap-3 text-sm"><p className="text-coral-emphasis">Couldn’t load plans.</p><button className="btn-ghost" onClick={() => setAttempt(value => value + 1)}>Retry plans</button></div>}
        <Reveal>
          <section className="grid gap-6 border-b border-line py-10 md:grid-cols-[minmax(220px,0.7fr)_1.3fr] md:gap-12 md:py-12">
            <div>
              <p className="font-inter text-caption font-semibold uppercase text-ink-muted">Included today</p>
              <h2 className="mt-2 font-inter text-heading-sm font-semibold">Everything you need to start.</h2>
            </div>
            <ul className="grid gap-x-8 gap-y-4 text-body text-ink-secondary sm:grid-cols-2">
              {freeFeatures.map((item) => (
                <li key={item} className="flex items-start gap-3">
                  <span className="mt-0.5 text-mint-pulse"><Check /></span><span>{item}</span>
                </li>
              ))}
            </ul>
          </section>
        </Reveal>

        <Reveal delay={0.06}>
          <section className="grid gap-6 border-b border-line py-10 md:grid-cols-[minmax(220px,0.7fr)_1.3fr] md:gap-12 md:py-12">
            <div>
              <p className="font-inter text-caption font-semibold uppercase text-ink-muted">When plans open</p>
              <h2 className="mt-2 font-inter text-heading-sm font-semibold">Pro, one flat rate.</h2>
            </div>
            <div className="min-w-0">
              <p className="max-w-md text-body-sm leading-relaxed text-ink-muted">
                One price per account, not per seat. Same product, higher limits, priority support.
              </p>
              {error && <p role="alert" className="mt-4 font-inter text-sm text-coral-emphasis">{error}</p>}
              <div className="mt-5 overflow-hidden rounded-cards border border-line bg-surface">
                {(['monthly', 'yearly'] as const).map((period) => {
                  const isOffered = offered(period)
                  const amount = price(period)
                  return (
                    <div key={period} className={`grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-2 px-4 py-4 sm:grid-cols-[minmax(92px,0.45fr)_minmax(0,1fr)_auto] sm:gap-x-5 sm:px-5 ${period === 'yearly' ? 'border-t border-line' : ''}`}>
                      <h3 className="font-inter text-sm font-semibold capitalize sm:text-body">{period}</h3>
                      <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 sm:gap-x-3">
                        <span className="font-inter text-lg font-semibold tabular-nums sm:text-subheading">${amount.toFixed(2)}</span>
                        <span className="font-inter text-xs text-ink-muted sm:text-sm">/ {period === 'yearly' ? 'year' : 'month'}</span>
                        {period === 'yearly' && <span className="badge badge-success !px-2 !py-1 text-[10px] sm:text-xs">10% off vs monthly</span>}
                      </div>
                      <button
                        className="btn-primary col-start-2 row-start-1 row-span-2 whitespace-nowrap !px-3 !py-2 text-sm sm:col-start-3 sm:row-span-1 sm:!px-4"
                        disabled={!isOffered || busy !== null}
                        title={isOffered ? `Upgrade to Pro ${period}` : 'Coming soon - plans are not published yet'}
                        onClick={() => void upgrade(period)}
                      >
                        {busy === period ? 'Starting…' : offers === null ? 'Checking…' : catalogueError ? 'Unavailable' : isOffered ? `Upgrade ${period}` : 'Coming soon'}
                      </button>
                    </div>
                  )
                })}
              </div>
            </div>
          </section>
        </Reveal>

        <Reveal delay={0.06}>
          <section className="grid gap-6 border-b border-line py-10 md:grid-cols-[minmax(220px,0.7fr)_1.3fr] md:gap-12 md:py-12">
            <div>
              <p className="font-inter text-caption font-semibold uppercase text-ink-muted">Plan details</p>
              <h2 className="mt-2 font-inter text-heading-sm font-semibold">Free vs Pro</h2>
              <p className="mt-2 text-body-sm leading-relaxed text-ink-muted">Early users keep a free tier that covers small portfolios. No surprises.</p>
            </div>
            <div className="overflow-x-auto text-left">
              <table className="w-full min-w-[420px] border-collapse font-inter text-sm">
                <thead><tr className="border-b border-line">
                  <th className="p-4 text-left font-medium text-ink-muted" scope="col"><span className="sr-only">Feature</span></th>
                  <th className="p-4 text-center font-semibold" scope="col">Free</th>
                  <th className="p-4 text-center font-semibold" scope="col">Pro</th>
                </tr></thead>
                <tbody>{rows.map((r) => (
                  <tr key={r.label} className="border-b border-line last:border-0">
                    <th className="p-4 text-left font-medium text-ink" scope="row">{r.label}</th>
                    <td className="p-4 text-center text-ink-secondary">{r.free}</td>
                    <td className="p-4 text-center font-medium">{r.pro}</td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          </section>
        </Reveal>

        <Reveal delay={0.06}>
          <section className="my-10 grid gap-7 overflow-hidden rounded-cards bg-feature px-6 py-7 text-left sm:px-8 sm:py-8 md:grid-cols-[minmax(0,1.3fr)_minmax(220px,0.7fr)] md:items-center md:gap-12">
            <div className="max-w-2xl">
              <p className="inline-flex items-center gap-2 text-xs font-semibold uppercase text-mint-pulse"><UsersRound size={15} aria-hidden="true" /> Team plans</p>
              <h2 className="mt-3 font-display text-heading-sm font-bold text-paper-white">More room to build together.</h2>
              <p className="mt-2 max-w-xl text-body-sm leading-relaxed text-paper-white/80">
                {teamsNote || 'Teams and Enterprise plans - shared portfolios, per-seat pricing - are coming soon.'}
              </p>
              <Link to="/feedback" className="mt-5 inline-flex items-center gap-2 rounded-buttons bg-paper-white px-4 py-2.5 text-sm font-semibold text-inkwell-navy transition-opacity hover:opacity-90">
                Tell us what your team needs <ArrowRight size={15} aria-hidden="true" />
              </Link>
            </div>
            <div className="border-t border-paper-white/15 pt-5 md:border-l md:border-t-0 md:pl-7 md:pt-0">
              <p className="text-xs font-semibold uppercase text-paper-white/60">On the roadmap</p>
              <div className="mt-3 flex items-center justify-between gap-4 border-b border-paper-white/15 py-3 text-sm text-paper-white">
                <span>Shared portfolios</span><span className="text-xs text-paper-white/60">Team access</span>
              </div>
              <div className="flex items-center justify-between gap-4 py-3 text-sm text-paper-white">
                <span>Per-seat plans</span><span className="text-xs text-paper-white/60">Flexible billing</span>
              </div>
            </div>
          </section>
        </Reveal>

        <Reveal delay={0.06}>
          <section className="grid gap-6 border-b border-line py-10 md:grid-cols-[minmax(220px,0.7fr)_1.3fr] md:gap-12 md:py-12">
            <div>
              <p className="font-inter text-caption font-semibold uppercase text-ink-muted">Good to know</p>
              <h2 className="mt-2 font-inter text-heading-sm font-semibold">Questions</h2>
            </div>
            <div>
              <Faq q="When will I actually be charged?"><p>Checkout is available for published plans. Review the price and billing period in checkout before confirming payment. Plans marked Coming soon cannot be purchased.</p></Faq>
              <Faq q="What happens if I cancel Pro?"><p>You keep your account and all your data. Paid features switch off at the end of the billing period; your projects and history stay readable on the free tier.</p></Faq>
              <Faq q="Can I switch between monthly and yearly?"><p>Yes, switch anytime from the billing portal. Yearly works out 10% cheaper than twelve monthly payments.</p></Faq>
            </div>
          </section>
        </Reveal>

        <div className="pt-10 text-center">
          <PortfolioCta />
        </div>
      </main>

      <SiteFooter />
    </div>
  )
}
