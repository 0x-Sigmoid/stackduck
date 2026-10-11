import type { ProjectListEntry } from './contracts'

const MONEY_KEYS = new Set(['transaction_volume', 'payout_volume', 'revenue_30d', 'mrr', 'revenue', 'arr'])
export function isMoneyMetric(type: string, key: string) { return type === 'revenue_metrics' && MONEY_KEYS.has(key) }
export function metricUnit(type: string, key: string, currency?: string | null) {
  if (isMoneyMetric(type, key)) return currency?.toUpperCase() ?? 'Currency not supplied'
  if (key.endsWith('_ms')) return 'Milliseconds'
  if (key.endsWith('_percent') || key.endsWith('_rate')) return 'Percent'
  if (type === 'user_metrics') return 'Users'
  return 'Count'
}
export function formatMetricValue(type: string, key: string, value: number, currency?: string | null, compact = false): string {
  const options: Intl.NumberFormatOptions = { maximumFractionDigits: 2, ...(compact ? { notation: 'compact' } : {}) }
  if (isMoneyMetric(type, key) && currency && /^[a-z]{3}$/i.test(currency)) {
    options.style = 'currency'
    options.currency = currency.toUpperCase()
    options.minimumFractionDigits = compact ? 0 : 2
  } else if (isMoneyMetric(type, key)) options.minimumFractionDigits = 2
  const number = new Intl.NumberFormat('en-US', options).format(value)
  return key.endsWith('_ms') ? `${number} ms` : key.endsWith('_percent') || key.endsWith('_rate') ? `${number}%` : number
}
export function freshness(iso?: string | null) {
  if (!iso || !Number.isFinite(Date.parse(iso))) return 'No samples yet'
  const minutes = Math.max(0, Math.floor((Date.now() - Date.parse(iso)) / 60000))
  return minutes < 1 ? 'Just now' : minutes < 60 ? `${minutes}m ago` : minutes < 1440 ? `${Math.floor(minutes / 60)}h ago` : `${Math.floor(minutes / 1440)}d ago`
}

export function monitoringHealth(entry: ProjectListEntry) {
  if (entry.homeStatus === 'red' || entry.homeStatus === 'amber') return entry.homeStatus
  if (!entry.connectorStatuses.length || !entry.keyMetrics.length) return 'gray'
  return entry.homeStatus
}
