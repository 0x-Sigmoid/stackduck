import { useEffect, useState } from 'react'
import { ArrowRight, RefreshCw } from 'lucide-react'
import { CartesianGrid, LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import { useReducedMotion } from 'motion/react'
import { api } from '../lib/api'
import { homeStatusLabel, humanKeyLabel, metricFamilyLabel } from '../lib/format'
import { formatMetricValue, freshness, isMoneyMetric, metricUnit, monitoringHealth } from '../lib/metricPresentation'
import type { ProjectListEntry } from '../lib/contracts'
import type { ConnectorInstance, MetricType, AlertRule } from '../types'

export interface MetricKey { metricType: MetricType; key: string; value?: number; at?: string; currency?: string | null }
interface Point { time: string; value: number; currency?: string | null }
interface Bucket { points: Point[] }
type Series = { status: 'loading' } | { status: 'error' } | { status: 'ready'; points: Point[] }

function MetricChart({ projectId, metric, hours, now }: { projectId: string; metric: MetricKey; hours: number; now: number }) {
  const [series, setSeries] = useState<Series>({ status: 'loading' })
  const [retry, setRetry] = useState(0)
  const reducedMotion = useReducedMotion()
  useEffect(() => {
    let cancelled = false
    setSeries({ status: 'loading' })
    const from = new Date(now - hours * 3600000).toISOString().slice(0, 10)
    const to = new Date(now).toISOString().slice(0, 10)
    api<{ buckets: Bucket[] }>(`/v1/projects/${projectId}/metrics?metricType=${metric.metricType}&key=${encodeURIComponent(metric.key)}&from=${from}&to=${to}`)
      .then(response => {
        const points = response.buckets.flatMap(bucket => bucket.points).filter(point => Date.parse(point.time) >= now - hours * 3600000 && Date.parse(point.time) <= now).sort((a, b) => Date.parse(a.time) - Date.parse(b.time))
        if (!cancelled) setSeries({ status: 'ready', points })
      })
      .catch(() => { if (!cancelled) setSeries({ status: 'error' }) })
    return () => { cancelled = true }
  }, [projectId, metric.metricType, metric.key, hours, now, retry])
  const points = series.status === 'ready' ? series.points : []
  const first = points[0]
  const last = points.slice(-1)[0]
  const currencies = new Set(points.map(point => point.currency?.toUpperCase() ?? 'unknown'))
  const mixed = isMoneyMetric(metric.metricType, metric.key) && currencies.size > 1
  const currency = last?.currency ?? metric.currency
  const format = (value: number, compact = false) => formatMetricValue(metric.metricType, metric.key, value, currency, compact)
  const delta = first && last && !mixed ? last.value - first.value : undefined
  const timeLabel = (time: number) => new Date(time).toLocaleString(undefined, hours === 24 ? { hour: 'numeric', minute: '2-digit' } : { month: 'short', day: 'numeric' })
  return <section className="card chart-panel" aria-label={humanKeyLabel(metric.key)} aria-busy={series.status === 'loading'}>
    <div className="flex items-start justify-between gap-3"><div><h3 className="text-sm font-semibold">{humanKeyLabel(metric.key)}</h3><p className="mt-1 text-xs text-ink-muted">{metricFamilyLabel(metric.metricType)} · {metricUnit(metric.metricType, metric.key, currency)}</p></div></div>
    <div className="mt-4 min-h-16">
      {series.status === 'loading' ? <><div className="skeleton h-8 w-28" /><div className="skeleton mt-2 h-3 w-40" /></> : <><p className="metric-number text-3xl font-semibold">{last ? format(last.value) : '—'}</p><p className="mt-1 text-xs text-ink-muted">{delta !== undefined && points.length > 1 ? `${delta > 0 ? '+' : delta < 0 ? '−' : ''}${format(Math.abs(delta))} since first sample in this range` : last ? 'Latest sample in this range' : series.status === 'error' ? 'Value unavailable' : 'No value in this range'}</p></>}
    </div>
    {series.status === 'loading' ? <div className="skeleton mt-4 h-[200px] w-full" aria-label="Loading chart" /> : series.status === 'error' ? <div className="chart-empty" role="alert"><p className="font-medium text-coral-emphasis">Failed to load</p><p>We couldn’t retrieve this metric.</p><button className="btn-ghost mt-3" onClick={() => setRetry(value => value + 1)}>Retry chart</button></div> : mixed ? <div className="chart-empty"><p className="font-medium">Multiple currencies</p><p>This range includes different currencies. A combined trend would be misleading.</p></div> : !points.length ? <div className="chart-empty"><p className="font-medium text-ink">No data in this range</p><p>Try a longer time range to see earlier samples.</p></div> : <div className="mt-4" role="group" aria-label={`${humanKeyLabel(metric.key)} trend, ${points.length} samples. Latest ${format(last!.value)}.`}>
      <ResponsiveContainer width="100%" height={200}>
        <LineChart accessibilityLayer data={points.map(point => ({ ...point, timestamp: Date.parse(point.time) }))} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke="var(--color-line)" strokeDasharray="3 5" />
          <XAxis type="number" domain={['dataMin', 'dataMax']} dataKey="timestamp" tickFormatter={timeLabel} tick={{ fontSize: 11, fill: 'var(--color-ink-muted)' }} tickLine={false} axisLine={false} minTickGap={35} />
          <YAxis tickFormatter={value => format(Number(value), true)} tick={{ fontSize: 11, fill: 'var(--color-ink-muted)' }} tickLine={false} axisLine={false} width={64} />
          <Tooltip labelFormatter={value => new Date(Number(value)).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })} formatter={value => [format(Number(value)), humanKeyLabel(metric.key)]} contentStyle={{ background: 'var(--color-elevated)', border: '1px solid var(--color-line)', borderRadius: 8, color: 'var(--color-ink)', fontSize: 12 }} itemStyle={{ color: 'var(--color-ink)' }} />
          <Line dataKey="value" type="linear" stroke="var(--color-ink)" strokeWidth={2} dot={points.length === 1 ? { r: 4 } : false} activeDot={{ r: 4, stroke: 'var(--color-surface)', strokeWidth: 2 }} isAnimationActive={!reducedMotion} />
        </LineChart>
      </ResponsiveContainer>
    </div>}
    <p className="mt-3 text-xs text-ink-muted">{last ? `Latest sample · ${freshness(last.time)}` : 'Samples shown in your local time'}</p>
  </section>
}

export default function ProjectOverview({ entry, connectors, keys, rules, onSources, onAlerts, onRefresh }: { entry: ProjectListEntry; connectors: ConnectorInstance[]; keys: MetricKey[]; rules: AlertRule[]; onSources: () => void; onAlerts: () => void; onRefresh: () => Promise<void> }) {
  const [hours, setHours] = useState(168)
  const [now, setNow] = useState(Date.now)
  const [refreshing, setRefreshing] = useState(false)
  const health = monitoringHealth(entry)
  const latest = keys.map(key => key.at).filter((value): value is string => Boolean(value)).sort().slice(-1)[0]
  const firing = rules.filter(rule => rule.status === 'active' && rule.triggeredAt)
  async function refresh() {
    setRefreshing(true)
    try { await onRefresh(); setNow(Date.now()) } finally { setRefreshing(false) }
  }
  return <div className="flex flex-col gap-6">
    <section className="card">
      <div className="flex items-start justify-between gap-3"><div className="min-w-0 flex-1"><h2 className="text-sm font-semibold text-ink-muted">Project health</h2><p className={`health-pill health-${health} mt-3`}><span className={`status-dot status-${health}`} aria-hidden="true" />{connectors.length ? homeStatusLabel(health) : 'Not connected'}</p><p className="mt-3 text-sm text-ink-muted">{firing.length ? `${firing.length} active alert${firing.length === 1 ? '' : 's'} need attention.` : connectors.some(source => source.status === 'error') ? 'A data source needs attention.' : connectors.length ? 'Health reflects connector checks and active alerts.' : 'Connect a data source to begin monitoring.'}</p></div>
        <button className="btn-ghost shrink-0 px-3" aria-label="Refresh project" disabled={refreshing} onClick={() => void refresh()}><RefreshCw size={15} aria-hidden="true" /><span className="hidden sm:inline">{refreshing ? 'Refreshing…' : 'Refresh'}</span></button>
      </div>
      <dl className="mt-5 grid grid-cols-2 gap-4 border-t border-line pt-5 sm:grid-cols-3">
        <div><dt className="text-xs text-ink-muted">Data freshness</dt><dd className="mt-1 text-sm font-semibold" title={latest ? new Date(latest).toLocaleString() : undefined}>{freshness(latest)}</dd><dd className="mt-1 text-xs text-ink-muted">{latest ? 'Latest metric sample' : connectors.length ? 'Waiting for first sync' : 'No source connected'}</dd></div>
        <div><dt className="text-xs text-ink-muted">Data sources</dt><dd className="metric-number mt-1 text-sm font-semibold">{connectors.filter(source => source.status === 'connected').length} / {connectors.length} connected</dd><dd><button className="text-link mt-1 text-xs" onClick={onSources}>Manage sources <ArrowRight size={12} className="inline" /></button></dd></div>
        <div><dt className="text-xs text-ink-muted">Alert rules</dt><dd className="metric-number mt-1 text-sm font-semibold">{rules.filter(rule => rule.status === 'active').length} active{firing.length ? ` · ${firing.length} firing` : ''}</dd><dd><button className="text-link mt-1 text-xs" onClick={onAlerts}>View alerts <ArrowRight size={12} className="inline" /></button></dd></div>
      </dl>
    </section>
    <section aria-label="Metric trends">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-lg font-semibold">Metric trends</h2><p className="mt-1 text-sm text-ink-muted">Latest values and changes over time.</p></div><div className="segmented-control" role="group" aria-label="Time range">{[[24, '24h'], [168, '7d'], [720, '30d']].map(([value, label]) => <button key={value} aria-pressed={hours === value} onClick={() => { setHours(Number(value)); setNow(Date.now()) }}>{label}</button>)}</div></div>
      {!keys.length ? <div className="card py-10 text-center"><h3 className="font-semibold">{connectors.some(source => source.status === 'error') ? 'A data source needs attention' : connectors.length ? 'Waiting for first sync' : 'Start monitoring this project'}</h3><p className="mx-auto mt-2 max-w-md text-sm text-ink-muted">{connectors.some(source => source.status === 'error') ? 'Check your source connection so it can begin reporting metrics.' : connectors.length ? 'Your source is configured. Charts will appear when it reports its first metric. Refresh to check for new data.' : 'Connect a source to see health, metrics, and trends here.'}</p><button className="btn-ghost mt-5" onClick={onSources}>Manage data sources <ArrowRight size={15} /></button></div> : <div className="grid gap-4 lg:grid-cols-2">{keys.map(metric => <MetricChart key={`${entry.project.id}/${metric.metricType}/${metric.key}`} projectId={entry.project.id} metric={metric} hours={hours} now={now} />)}</div>}
    </section>
  </div>
}
