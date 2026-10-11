import { useState, type FormEvent } from 'react'
import type { ConnectableType } from './ConnectorPicker'

export type ExternalConnectorType = Extract<ConnectableType, 'sentry' | 'github-actions' | 'posthog' | 'betterstack' | 'vercel'>

const DETAILS: Record<ExternalConnectorType, { title: string; description: string; tokenLabel: string; tokenHint: string }> = {
  sentry: {
    title: 'Sentry',
    description: 'Read project error-event totals from the last 24 hours.',
    tokenLabel: 'Sentry auth token',
    tokenHint: 'Create a token with project:read access.',
  },
  'github-actions': {
    title: 'GitHub Actions',
    description: 'Read recent workflow run and failure counts. Grant read-only Actions access.',
    tokenLabel: 'GitHub token',
    tokenHint: 'A fine-grained token with Actions: read and repository metadata access.',
  },
  posthog: {
    title: 'PostHog',
    description: 'Read 30-day active users and events from the last 24 hours.',
    tokenLabel: 'PostHog personal API key',
    tokenHint: 'Grant query:read and read access to the selected project.',
  },
  betterstack: {
    title: 'Better Stack',
    description: 'Match an existing Better Stack Uptime monitor and report whether it is up or down.',
    tokenLabel: 'Better Stack Uptime API token',
    tokenHint: 'Use a read-only Uptime API token for the team that owns this monitor.',
  },
  vercel: {
    title: 'Vercel',
    description: 'Read deployment status and failures for one Vercel project.',
    tokenLabel: 'Vercel access token',
    tokenHint: 'Use a token scoped to the team and project you want to monitor.',
  },
}

export default function ExternalConnectorForm(props: {
  type: ExternalConnectorType
  repoUrl?: string
  liveUrl?: string
  busy: boolean
  error?: string | null
  onConnect: (data: Record<string, string>) => void
  onCancel: () => void
}) {
  const [token, setToken] = useState('')
  const [organization, setOrganization] = useState('')
  const [project, setProject] = useState('')
  const [repository, setRepository] = useState(props.repoUrl ?? '')
  const [projectId, setProjectId] = useState('')
  const [region, setRegion] = useState<'us' | 'eu'>('us')
  const [monitorUrl, setMonitorUrl] = useState(props.liveUrl ?? '')
  const [vercelProjectId, setVercelProjectId] = useState('')
  const [teamId, setTeamId] = useState('')
  const details = DETAILS[props.type]

  function submit(event: FormEvent) {
    event.preventDefault()
    const data: Record<string, string> = { token: token.trim() }
    if (props.type === 'sentry') Object.assign(data, { organization: organization.trim(), project: project.trim() })
    if (props.type === 'github-actions') Object.assign(data, { repository: repository.trim() })
    if (props.type === 'posthog') Object.assign(data, { projectId: projectId.trim(), region })
    if (props.type === 'betterstack') Object.assign(data, { monitorUrl: monitorUrl.trim() })
    if (props.type === 'vercel') Object.assign(data, { projectId: vercelProjectId.trim(), teamId: teamId.trim() })
    props.onConnect(data)
  }

  return (
    <form onSubmit={submit} className="mt-4 flex flex-col gap-4 border-t border-line pt-5">
      <div>
        <h3 className="text-sm font-semibold">Connect {details.title}</h3>
        <p className="mt-1 text-sm text-ink-muted">{details.description}</p>
      </div>
      {props.type === 'sentry' && (
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-1 text-sm font-medium">Organization slug
            <input className="input" required value={organization} onChange={(e) => setOrganization(e.target.value)} placeholder="my-team" />
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium">Project slug
            <input className="input" required value={project} onChange={(e) => setProject(e.target.value)} placeholder="my-app" />
          </label>
        </div>
      )}
      {props.type === 'github-actions' && (
        <label className="flex flex-col gap-1 text-sm font-medium">Repository
          <input className="input font-mono text-xs" required value={repository} onChange={(e) => setRepository(e.target.value)} placeholder="owner/repository" />
          <span className="text-xs font-normal text-ink-muted">Owner/repository or its GitHub URL.</span>
        </label>
      )}
      {props.type === 'posthog' && (
        <div className="grid gap-3 sm:grid-cols-[1fr_140px]">
          <label className="flex flex-col gap-1 text-sm font-medium">Project ID
            <input className="input" required value={projectId} onChange={(e) => setProjectId(e.target.value)} placeholder="12345" />
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium">Region
            <select className="input" value={region} onChange={(e) => setRegion(e.target.value as 'us' | 'eu')}>
              <option value="us">US</option><option value="eu">EU</option>
            </select>
          </label>
        </div>
      )}
      {props.type === 'betterstack' && (
        <label className="flex flex-col gap-1 text-sm font-medium">Monitor URL
          <input className="input" type="url" required value={monitorUrl} onChange={(e) => setMonitorUrl(e.target.value)} placeholder="https://your-app.example" />
          <span className="text-xs font-normal text-ink-muted">Must match the URL of an existing monitor.</span>
        </label>
      )}
      {props.type === 'vercel' && (
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-1 text-sm font-medium">Vercel project ID
            <input className="input" required value={vercelProjectId} onChange={(e) => setVercelProjectId(e.target.value)} placeholder="prj_…" />
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium">Team ID <span className="font-normal text-ink-muted">(optional)</span>
            <input className="input" value={teamId} onChange={(e) => setTeamId(e.target.value)} placeholder="team_…" />
          </label>
        </div>
      )}
      <label className="flex flex-col gap-1 text-sm font-medium">{details.tokenLabel}
        <input className="input font-mono text-xs" type="password" required autoComplete="off" value={token} onChange={(e) => setToken(e.target.value)} />
        <span className="text-xs font-normal text-ink-muted">{details.tokenHint} Stored encrypted; never exposed in the browser again.</span>
      </label>
      {props.error && <p role="alert" className="text-sm text-coral-emphasis">{props.error}</p>}
      <div className="flex gap-2">
        <button className="btn-primary" type="submit" disabled={props.busy || !token.trim()}>{props.busy ? 'Checking…' : 'Connect and check'}</button>
        <button className="btn-ghost" type="button" disabled={props.busy} onClick={props.onCancel}>Cancel</button>
      </div>
    </form>
  )
}
