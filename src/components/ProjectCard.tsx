import { Link } from 'react-router-dom'
import { Folder, ArrowUpRight } from 'lucide-react'
import ActionMenu from './ActionMenu'
import type { ProjectListEntry } from '../lib/contracts'
import { homeStatusLabel, humanKeyLabel } from '../lib/format'
import { formatMetricValue, freshness, monitoringHealth } from '../lib/metricPresentation'

export default function ProjectCard({ entry, onRemove }: { entry: ProjectListEntry; onRemove: () => void }) {
  const { project, keyMetrics } = entry
  const health = monitoringHealth(entry)
  const latest = keyMetrics.map(metric => metric.at).filter(Boolean).sort().slice(-1)[0]
  return <article className="card project-card">
    <div className="flex items-center gap-3">
      <span className="project-folder" aria-hidden="true"><Folder size={22} strokeWidth={1.6} /></span>
      <h2 className="min-w-0 flex-1 truncate text-base font-semibold"><Link className="project-card-link" to={`/projects/${project.id}`}>{project.name}</Link></h2>
      <ActionMenu label={`Actions for ${project.name}`} actions={[{ label: 'Remove project…', destructive: true, onSelect: onRemove }]} />
    </div>
    <div className="mt-4 flex flex-wrap items-center gap-2">
      <span className={`health-pill health-${health}`}><span className={`status-dot status-${health}`} aria-hidden="true" />{entry.connectorStatuses.length === 0 ? 'Not connected' : homeStatusLabel(health)}</span>
      {project.status !== 'active' && <span className="badge">{project.status}</span>}
    </div>
    <p className="mt-3 truncate text-xs text-ink-muted" title={(project.stackTags ?? []).join(' · ')}>{[project.environment, ...(project.stackTags ?? [])].filter(Boolean).join(' · ') || 'Project details can be added later'}</p>
    <div className="mt-4 flex-1 border-t border-line pt-4">
      {keyMetrics.length ? <dl className="grid grid-cols-3 gap-3">
        {keyMetrics.slice(0, 3).map(metric => <div className="min-w-0" key={`${metric.metricType}/${metric.key}`}>
          <dt className="line-clamp-2 min-h-8 text-xs leading-4 text-ink-muted">{humanKeyLabel(metric.key)}</dt>
          <dd className="metric-number mt-1 truncate text-lg font-semibold" title={formatMetricValue(metric.metricType, metric.key, metric.value, metric.currency)}>{formatMetricValue(metric.metricType, metric.key, metric.value, metric.currency, true)}</dd>
        </div>)}
      </dl> : <p className="text-sm text-ink-muted">{entry.connectorStatuses.length ? 'Waiting for the first sync.' : 'Connect a source to start monitoring.'}</p>}
    </div>
    <div className="mt-5 flex items-center justify-between border-t border-line pt-3 text-xs text-ink-muted"><span title={latest ? new Date(latest).toLocaleString() : undefined}>{latest ? `Latest sample · ${freshness(latest)}` : 'No samples yet'}</span><ArrowUpRight size={15} aria-hidden="true" /></div>
  </article>
}
