import { useState } from 'react'
import { Activity, ArrowUpRight, Folder, ShieldCheck } from 'lucide-react'
import { formatMetricValue } from '../lib/metricPresentation'

const PROJECTS = [
  { id: 'atlas', name: 'Atlas', stack: 'Next.js · Supabase', health: 'green', label: 'Healthy', users: 3628, revenue: 16090, errors: 4, source: 'Supabase', trend: [2400, 2520, 2700, 2810, 3080, 3290, 3628] },
  { id: 'storefront', name: 'Storefront', stack: 'React · Stripe', health: 'green', label: 'Healthy', users: 1480, revenue: 8240, errors: 2, source: 'Stripe', trend: [1100, 1210, 1170, 1290, 1350, 1410, 1480] },
  { id: 'api', name: 'Release API', stack: 'Node.js · Sentry', health: 'amber', label: 'Source needs attention', users: 820, revenue: 0, errors: 18, source: 'Sentry', trend: [620, 690, 730, 710, 790, 800, 820] },
] as const

/** Public, local-only sample portfolio. It never requests or changes account data. */
export default function PortfolioDemo() {
  const [selected, setSelected] = useState(0)
  const [range, setRange] = useState<24 | 168>(168)
  const project = PROJECTS[selected]
  const samples = range === 168 ? [...project.trend] : [0.92, 0.94, 0.93, 0.97, 0.99, 1].map(ratio => Math.round(project.users * ratio))
  const min = Math.min(...samples) * 0.9
  const max = Math.max(...samples) * 1.05
  const points = samples.map((value, index) => `${20 + index * 360 / (samples.length - 1)},${130 - ((value - min) / (max - min)) * 110}`).join(' ')

  return (
    <div className="overflow-hidden rounded-2xl border border-line bg-surface shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-4 sm:px-6">
        <span className="inline-flex items-center gap-2 text-sm font-semibold"><Activity size={16} aria-hidden="true" />Example portfolio</span>
        <span className="badge">Sample data · no account needed</span>
      </div>
      <div className="grid lg:grid-cols-[280px_minmax(0,1fr)]">
        <div className="border-b border-line p-4 lg:border-b-0 lg:border-r">
          <p className="mb-3 px-2 text-xs font-medium text-ink-muted">Select a project to explore</p>
          <div className="flex flex-col gap-2" role="group" aria-label="Demo projects">
            {PROJECTS.map((item, index) => (
              <button key={item.id} type="button" aria-pressed={selected === index} aria-controls="demo-project-detail" onClick={() => setSelected(index)}
                className={`flex min-h-20 w-full items-center gap-3 rounded-xl border p-3 text-left transition-colors ${selected === index ? 'border-line-strong bg-inset' : 'border-transparent hover:bg-inset'}`}>
                <Folder size={20} aria-hidden="true" className="shrink-0 text-ink-muted" />
                <span className="min-w-0 flex-1"><span className="block text-sm font-semibold">{item.name}</span><span className="mt-1 block text-xs text-ink-muted">{item.stack}</span></span>
                <span className={`status-dot status-${item.health} shrink-0`} aria-label={item.label} />
                <ArrowUpRight size={14} aria-hidden="true" className="shrink-0 text-ink-muted" />
              </button>
            ))}
          </div>
        </div>
        <div id="demo-project-detail" role="region" aria-labelledby="demo-project-name" className="min-w-0 p-5 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h3 id="demo-project-name" className="text-xl font-semibold" aria-live="polite">{project.name}</h3>
            <span className={`health-pill health-${project.health}`}><span className={`status-dot status-${project.health}`} aria-hidden="true" />{project.label}</span>
          </div>
          <p className="mt-2 text-sm text-ink-muted">{project.health === 'amber' ? 'A source connection needs a check. Earlier samples remain visible.' : 'Connected sources and alert status are summarized together.'}</p>
          <dl className="mt-5 grid grid-cols-3 gap-3 border-y border-line py-5">
            {[
              ['Active users', formatMetricValue('user_metrics', 'active_users', project.users)],
              ['Revenue (USD)', formatMetricValue('revenue_metrics', 'mrr', project.revenue, 'USD', true)],
              ['Errors', String(project.errors)],
            ].map(([label, value]) => (
              <div key={label} className="min-w-0"><dt className="text-xs text-ink-muted">{label}</dt><dd className="metric-number mt-2 text-lg font-semibold sm:text-2xl">{value}</dd></div>
            ))}
          </dl>
          <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
            <div><h4 className="text-sm font-semibold">Active users</h4><p className="mt-1 text-xs text-ink-muted">Illustrative {range === 168 ? 'daily' : 'hourly'} samples</p></div>
            <div role="group" aria-label="Demo time range" className="segmented-control">
              {([24, 168] as const).map(hours => <button type="button" key={hours} aria-pressed={range === hours} onClick={() => setRange(hours)}>{hours === 24 ? '24h' : '7d'}</button>)}
            </div>
          </div>
          <svg viewBox="0 0 400 170" role="img" aria-label={`Sample active users trend for ${project.name}, ${range === 168 ? 'seven days' : '24 hours'}, ending at ${project.users} users.`} className="mt-4 block w-full text-ink">
            {[20, 75, 130].map(y => <line key={y} x1="20" x2="380" y1={y} y2={y} stroke="var(--color-line)" strokeDasharray="3 5" />)}
            <polyline points={points} fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinejoin="round" />
            <text x="20" y="158" fill="var(--color-ink-muted)" fontSize="11">{range === 168 ? 'Day 1' : '00:00'}</text>
            <text x="200" y="158" textAnchor="middle" fill="var(--color-ink-muted)" fontSize="11">{range === 168 ? 'Day 4' : '12:00'}</text>
            <text x="380" y="158" textAnchor="end" fill="var(--color-ink-muted)" fontSize="11">{range === 168 ? 'Day 7' : '20:00'}</text>
          </svg>
          <div className="mt-2 flex flex-wrap items-center justify-between gap-2 border-t border-line pt-4 text-xs text-ink-muted"><span className="inline-flex items-center gap-1.5"><ShieldCheck size={14} aria-hidden="true" />{project.source} · example source</span><span>Illustrative values, not live monitoring</span></div>
        </div>
      </div>
    </div>
  )
}
