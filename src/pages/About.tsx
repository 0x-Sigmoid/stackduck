import PortfolioCta from '../components/PortfolioCta'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Activity, ArrowRight, FolderKanban, PlugZap } from 'lucide-react'
import SiteNav from '../components/SiteNav'
import SiteFooter from '../components/SiteFooter'
import DeveloperModal from '../components/DeveloperModal'
import { Reveal } from '../components/Reveal'

const STORY_STEPS = [
  {
    number: '01',
    Icon: FolderKanban,
    title: 'Give every project a home.',
    description: 'Keep its purpose, links, stack, and environment together in one catalog entry.',
  },
  {
    number: '02',
    Icon: PlugZap,
    title: 'Connect the data you need.',
    description: 'Attach a source once. Live health, users, errors, and revenue join the same project.',
  },
  {
    number: '03',
    Icon: Activity,
    title: 'Get the whole picture.',
    description: 'Scan your portfolio in one place, then open a project when you need the detail.',
  },
]

/** Why Stackduck exists - human, not corporate. */
export default function About() {
  const [devOpen, setDevOpen] = useState(false)

  return (
    <div className="min-h-screen bg-canvas font-inter text-ink">
      <SiteNav active="about" />

      <main id="main-content" className="public-page">
        <Reveal>
          <section className="border-b border-line py-10 sm:py-14 lg:py-16">
            <div className="max-w-4xl">
              <p className="font-inter text-xs font-semibold uppercase text-ink-muted">Why Stackduck</p>
              <h1 className="page-title">
                Too many projects.<br /><span>Too many tabs.</span>
              </h1>
              <div className="mt-6 flex max-w-2xl flex-col gap-4 text-body leading-relaxed text-ink-secondary">
                <p>
                  Every project you ship comes with its own admin panels: users over here,
                  errors over there, revenue somewhere else entirely. With one project that's
                  fine. With five, ten, fifteen, your morning becomes a tour of dashboards -
                  most of which you built yourself, one copy-pasted admin page at a time.
                </p>
                <p>
                  Stackduck is the fix I wanted: part Datadog for indie devs, part Backstage
                  for solo founders. Every project gets one entry - what it is, where it lives -
                  and that same entry fills with live health, users, and revenue once you plug
                  in a connector. Registering a project and monitoring it are the same action,
                  not two chores.
                </p>
              </div>
              <div className="mt-7 flex flex-wrap items-center gap-5">
                <PortfolioCta />
                <Link to="/docs" className="text-link-emphasis text-link inline-flex items-center gap-1 text-sm">
                  How it works <ArrowRight size={14} aria-hidden="true" />
                </Link>
              </div>
            </div>
          </section>
        </Reveal>

        <Reveal delay={0.06}>
          <section className="border-b border-line py-10 sm:py-14">
            <div className="grid gap-8 lg:grid-cols-[minmax(220px,0.7fr)_1.3fr] lg:gap-14">
              <div>
                <p className="font-inter text-xs font-semibold uppercase text-ink-muted">The idea</p>
                <h2 className="mt-2 font-display text-heading-sm font-bold leading-tight">One entry. The full picture.</h2>
              </div>
              <div className="grid gap-px overflow-hidden rounded-cards border border-line bg-line sm:grid-cols-3">
                {STORY_STEPS.map(({ number, Icon, title, description }) => (
                  <div key={number} className="bg-surface p-5 sm:p-6">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold tabular-nums text-ink-muted">{number}</span>
                      <Icon size={18} className="text-ink-secondary" aria-hidden="true" />
                    </div>
                    <h3 className="mt-6 font-inter text-body font-semibold leading-snug">{title}</h3>
                    <p className="mt-2 text-body-sm leading-relaxed text-ink-secondary">{description}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>
        </Reveal>

        <Reveal delay={0.1}>
          <section className="grid gap-8 border-b border-line py-10 sm:py-14 lg:grid-cols-[minmax(220px,0.7fr)_1.3fr] lg:gap-14">
              <div>
                <p className="font-inter text-xs font-semibold uppercase text-ink-muted">A note from the builder</p>
                <h2 className="mt-2 font-display text-heading-sm font-bold leading-tight">Made for the many-things-at-once kind of builder.</h2>
              </div>
            <div className="flex max-w-3xl flex-col gap-4 text-body leading-relaxed text-ink-secondary">
              <p>
                I run a lot of projects - marketplaces, sign tools, lending experiments,
                learning apps. Each one small, each one mine, each one with its own corner
                of the internet to check. I got tired of building the same little dashboard
                for every new idea, so I built the dashboard that ends all dashboards:
                register the project once, plug in its data, and see everything side by side.
              </p>
              <p>
                I use Stackduck every day on my own portfolio. If it saves me one morning
                tour of admin panels, it was worth building - and I think it'll do the same
                for anyone else running more than one thing.
              </p>
              <p className="font-medium text-ink">
                - <button className="text-link" onClick={() => setDevOpen(true)} title="About the developer">0xSigmoid</button>
              </p>
            </div>
          </section>
        </Reveal>

        <div className="flex flex-wrap items-center justify-between gap-5 pt-8">
          <p className="text-body-sm text-ink-muted">One calm place to keep an eye on everything you build.</p>
          <PortfolioCta />
        </div>
      </main>

      <SiteFooter />
      {devOpen && <DeveloperModal onClose={() => setDevOpen(false)} />}
    </div>
  )
}
