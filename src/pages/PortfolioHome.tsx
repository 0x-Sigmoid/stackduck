import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Check, Plus, Search, Upload, X } from 'lucide-react'
import { api, ApiError, loadErrorMessage } from '../lib/api'
import { useAuthUser } from '../lib/useAuthUser'
import ActionMenu from '../components/ActionMenu'
import ProjectCard from '../components/ProjectCard'
import { monitoringHealth } from '../lib/metricPresentation'
import {
  authForImport,
  consumeImportPrompt,
  importSelected,
  listImportCandidates,
  type ImportItem,
  type OAuthKind,
} from '../lib/oauth'
import ImportPicker from '../components/ImportPicker'
import ConfirmDialog from '../components/ConfirmDialog'
import type { ProjectListEntry } from '../lib/contracts'

/** One checklist row: done check or step number, title, blurb, optional action. */
function OnboardingStep(props: {
  done: boolean
  title: string
  blurb: string
  action?: { to: string; label: string }
}) {
  return (
    <li className="flex items-center gap-3">
      <span
        aria-hidden="true"
        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full font-inter text-sm font-semibold transition-colors duration-150 ${
          props.done ? 'bg-mint-pulse text-inkwell-navy' : 'bg-inset text-ink-muted'
        }`}
      >
        {props.done ? <Check size={16} strokeWidth={3} aria-hidden="true" /> : ''}
      </span>
      <div className="min-w-0 flex-1">
        <p className={`font-inter text-sm font-medium ${props.done ? 'text-ink-muted line-through' : ''}`}>
          {props.title}
          {props.done && <span className="sr-only"> (done)</span>}
        </p>
        {!props.done && <p className="font-inter text-xs text-ink-muted">{props.blurb}</p>}
      </div>
      {props.action && !props.done && (
        <Link to={props.action.to} className="btn-primary shrink-0 px-3 py-1.5 text-sm">
          {props.action.label}
        </Link>
      )}
    </li>
  )
}

/**
 * Portfolio Home View (per spec): card grid, status color logic, search/filter,
 * empty state. No inline card actions — click through to detail.
 */
export default function PortfolioHome() {
  const [entries, setEntries] = useState<ProjectListEntry[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'paused' | 'archived'>('all')
  const [attempt, setAttempt] = useState(0)
  const [onboardingGone, setOnboardingGone] = useState(false)
  // Removal is permanent (project + its connectors, metrics, alert rules), so
  // it goes through a typed confirmation prompt rather than a bare click.
  const [removeTarget, setRemoveTarget] = useState<ProjectListEntry | null>(null)
  const [removeBusy, setRemoveBusy] = useState(false)
  const [removeError, setRemoveError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const noticeTimer = useRef<number | null>(null)

  function flashNotice(msg: string) {
    setNotice(msg)
    if (noticeTimer.current) window.clearTimeout(noticeTimer.current)
    noticeTimer.current = window.setTimeout(() => setNotice(null), 5000)
  }

  useEffect(() => () => {
    if (noticeTimer.current) window.clearTimeout(noticeTimer.current)
  }, [])

  async function confirmRemoval() {
    if (!removeTarget) return
    const { id, name } = removeTarget.project
    setRemoveBusy(true)
    setRemoveError(null)
    try {
      await api<{ ok: boolean }>(`/v1/projects/${id}?forever=true`, { method: 'DELETE' })
      setEntries((prev) => (prev ? prev.filter((e) => e.project.id !== id) : prev))
      setRemoveTarget(null)
      flashNotice(`“${name}” was removed, along with its data sources, metrics, and alert rules.`)
    } catch (e) {
      setRemoveError(loadErrorMessage(`“${name}” for removal`, e))
    } finally {
      setRemoveBusy(false)
    }
  }
  const [picker, setPicker] = useState<{
    kind: OAuthKind
    items: ImportItem[]
    loading: boolean
    error: string | null
  } | null>(null)

  const openImporter = useCallback(async (kind: OAuthKind) => {
    setPicker({ kind, items: [], loading: true, error: null })
    try {
      // Stored provider token → list through the backend proxy. No token (or
      // an expired one) → bounce to the provider's import-time OAuth dance.
      const { items } = await listImportCandidates(kind)
      setPicker({ kind, items, loading: false, error: null })
    } catch (e) {
      const code = e instanceof ApiError ? e.code : ''
      if (code === 'no_integration' || code === 'integration_expired' || code === 'unauthenticated') {
        await authForImport(kind) // full-page redirect; picker reopens on return
        return
      }
      setPicker({
        kind,
        items: [],
        loading: false,
        error:
          kind === 'google'
            ? 'Couldn’t load anything to import. Google may not have enabled this level of access for Stackduck yet (verification is pending) — importing can wait.'
            : 'Couldn’t load anything to import. Check the connection and try again.',
      })
    }
  }, [])

  const refreshPicker = useCallback(() => {
    if (picker) void openImporter(picker.kind)
  }, [picker, openImporter])

  const [searchParams, setSearchParams] = useSearchParams()

  // Return leg of the import OAuth dance (?import=github|google), plus the
  // auto-prompt flagged after a social sign-in captured a fresh token.
  useEffect(() => {
    const param = searchParams.get('import')
    const denied = searchParams.get('error')
    if (denied) {
      setSearchParams({}, { replace: true })
      flashNotice('That provider connection didn’t complete — try importing again.')
      return
    }
    if (param === 'github' || param === 'google') {
      setSearchParams({}, { replace: true })
      void openImporter(param)
      return
    }
    const kind = consumeImportPrompt()
    if (kind) void openImporter(kind)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openImporter])

  useEffect(() => {
    setEntries(null)
    setError(null)
    let cancelled = false
    api<{ projects: ProjectListEntry[] }>('/v1/projects')
      .then((r) => { if (!cancelled) setEntries(r.projects) })
      .catch((e) => { if (!cancelled) setError(loadErrorMessage('your portfolio', e)) })
    return () => { cancelled = true }
  }, [attempt])

  const filtered = useMemo(() => {
    if (!entries) return []
    const q = query.trim().toLowerCase()
    return entries.filter((e) => {
      if (statusFilter !== 'all' && e.project.status !== statusFilter) return false
      if (!q) return true
      const tags = (e.project.stackTags ?? []).join(' ').toLowerCase()
      return e.project.name.toLowerCase().includes(q) || tags.includes(q) || e.project.status.includes(q)
    })
  }, [entries, query, statusFilter])

  const healthyCount = entries?.filter((e) => monitoringHealth(e) === 'green').length ?? 0
  const attentionCount = entries?.filter((e) => e.homeStatus === 'red' || e.homeStatus === 'amber').length ?? 0

  // Guided first run: shown until all three steps are done (or dismissed).
  // Returning users with live projects never see it.
  const sessionUser = useAuthUser()
  const onboarding = useMemo(() => {
    if (!entries || onboardingGone) return null
    const uid = sessionUser?.id ?? 'anon'
    if (typeof localStorage !== 'undefined' && localStorage.getItem(`stackduck:onboarding-dismissed:${uid}`)) return null
    const hasProject = entries.length > 0
    const hasConnector = entries.some((e) => e.connectorStatuses.length > 0)
    const hasMetric = entries.some((e) => e.keyMetrics.length > 0)
    if (hasProject && hasConnector && hasMetric) return null
    const firstOpen = entries.find((e) => e.connectorStatuses.length === 0) ?? entries[0]
    return { hasProject, hasConnector, hasMetric, firstOpen }
  }, [entries, onboardingGone])

  function dismissOnboarding() {
    const uid = sessionUser?.id ?? 'anon'
    try {
      localStorage.setItem(`stackduck:onboarding-dismissed:${uid}`, '1')
    } catch {
      // Private mode — dismissal just lasts this visit.
    }
    setOnboardingGone(true)
  }

  return (
    <div className="mt-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="font-inter text-xs font-semibold uppercase text-ink-muted">Workspace</p>
          <h1 className="mt-1 font-display text-3xl font-semibold text-ink">Portfolio</h1>
          <p className="mt-1 font-inter text-sm text-ink-muted">A live view of every project you’re tracking — your ducklings, at a glance.</p>
        </div>
        <div className="flex items-center gap-2">
          <ActionMenu label="Import projects" actions={[{ label: "Import from GitHub", onSelect: () => void openImporter("github") }, { label: "Import from Google Cloud", onSelect: () => void openImporter("google") }]}><Upload size={16} aria-hidden="true" />Import</ActionMenu>
          <Link to="/projects/new" className="btn-primary inline-flex items-center gap-2">
            <Plus size={17} aria-hidden="true" />
            Add project
          </Link>
        </div>
      </div>

      <div className="portfolio-stats mt-7 grid grid-cols-3 divide-x divide-line border-y border-line py-4">
        <div className="px-3 first:pl-0"><p className="font-display text-2xl font-semibold">{entries?.length ?? '—'}</p><p className="mt-1 text-xs text-ink-muted">Projects</p></div>
        <div className="px-4 sm:px-6"><p className="flex items-center gap-2 font-display text-2xl font-semibold"><span className="status-dot status-green" />{entries ? healthyCount : '—'}</p><p className="mt-1 text-xs text-ink-muted">Healthy</p></div>
        <div className="px-4 sm:px-6"><p className="flex items-center gap-2 font-display text-2xl font-semibold"><span className="status-dot status-amber" />{entries ? attentionCount : '—'}</p><p className="mt-1 text-xs text-ink-muted">Need attention</p></div>
      </div>
      <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
        <label className="relative w-full max-w-sm">
        <Search size={16} aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted" />
        <input
          aria-label="Search projects"
          className="input pl-10"
          placeholder="Search by name, stack tag, or status…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        </label>
        <div role="group" aria-label="Filter projects by status" className="flex max-w-full gap-1 overflow-x-auto rounded-lg bg-inset p-1">
          {(['all', 'active', 'paused', 'archived'] as const).map((status) => (
            <button key={status} aria-pressed={statusFilter === status} onClick={() => setStatusFilter(status)} className={`whitespace-nowrap rounded-md px-3 py-2 font-inter text-sm font-medium transition-colors ${statusFilter === status ? 'bg-surface text-ink' : 'text-ink-muted hover:text-ink'}`}>
              {status === 'all' ? 'All' : status[0].toUpperCase() + status.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="card mt-6 text-center">
          <p className="font-inter text-base font-semibold">Something went wrong loading your portfolio.</p>
          <p className="mt-1 font-inter text-sm text-ink-muted">{error}</p>
          <button className="btn-primary mt-4" onClick={() => setAttempt((a) => a + 1)}>
            Try again
          </button>
        </div>
      )}

      {entries === null && !error && (
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3" aria-label="Loading projects">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="card project-card flex flex-col gap-3">
              <div className="skeleton h-6 w-2/3" />
              <div className="flex gap-2">
                <div className="skeleton h-6 w-16" />
                <div className="skeleton h-6 w-16" />
              </div>
              <div className="skeleton h-10 w-full" />
              <div className="skeleton h-4 w-1/2" />
            </div>
          ))}
        </div>
      )}

      {onboarding && (
        <div className="card mt-6">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="font-inter text-lg font-semibold">Get set up in three steps</h2>
              <p className="mt-1 text-sm text-ink-muted">A quick tour — most people finish in a few minutes.</p>
            </div>
            <button
              className="rounded-lg px-2 py-1 font-inter text-sm text-ink-muted transition-colors duration-150 hover:bg-inset hover:text-ink"
              onClick={dismissOnboarding}
              aria-label="Dismiss setup guide"
            >
              Dismiss
            </button>
          </div>
          <ol className="mt-4 flex flex-col gap-3">
            <OnboardingStep
              done={onboarding.hasProject}
              title="Add your first project"
              blurb="Just a name — details can wait."
              action={!onboarding.hasProject ? { to: '/projects/new', label: 'Add project' } : undefined}
            />
            <OnboardingStep
              done={onboarding.hasConnector}
              title="Connect a data source"
              blurb="Link Firebase, Stripe, Supabase, or a webhook."
              action={
                onboarding.hasProject && !onboarding.hasConnector && onboarding.firstOpen
                  ? { to: `/projects/${onboarding.firstOpen.project.id}?tab=sources`, label: 'Connect now' }
                  : undefined
              }
            />
            <OnboardingStep
              done={onboarding.hasMetric}
              title="See your first metric"
              blurb="Charts appear here on their own once data arrives."
            />
          </ol>
        </div>
      )}

      {entries !== null && entries.length === 0 && !onboarding && (
        <div className="card mt-6 text-center">
          <p className="text-lg font-medium text-ink">Add your first duckling 🐣</p>
          <p className="mt-1 text-sm text-ink-muted">A name is enough for now — you can connect live data right after.</p>
          <Link to="/projects/new" className="btn-primary mt-4 inline-block">
            Add project
          </Link>
        </div>
      )}

      {entries !== null && entries.length > 0 && filtered.length === 0 && (
        <p className="card mt-6 text-sm text-ink-muted">No projects match “{query}”. <button className="text-link" onClick={() => { setQuery(''); setStatusFilter('all') }}>Clear filters</button></p>
      )}

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.map(entry => <ProjectCard key={entry.project.id} entry={entry} onRemove={() => { setRemoveError(null); setRemoveTarget(entry) }} />)}
      </div>

      {picker && (
        <ImportPicker
          title={picker.kind === 'github' ? 'Import from GitHub' : 'Import from Google Cloud'}
          subtitle={
            picker.kind === 'github'
              ? 'Choose repos to add as projects. Names are editable; links come along automatically.'
              : 'Choose cloud projects to add. Their IDs are kept in the project notes.'
          }
          items={picker.items}
          loading={picker.loading}
          error={picker.error}
          onRefresh={refreshPicker}
          onImport={async (selections) => {
            await importSelected(selections)
            setAttempt((a) => a + 1)
          }}
          onClose={() => setPicker(null)}
        />
      )}

      {/* Same bottom-centre toast idiom as the project detail page. */}
      {notice && (
        <div
          role="status"
          className="fade-swap fixed bottom-6 left-1/2 z-50 flex max-w-sm -translate-x-1/2 items-center gap-3 rounded-2xl border border-line bg-elevated p-4 shadow-sm"
        >
          <span className="status-dot status-green shrink-0" aria-hidden="true" />
          <p className="font-inter text-sm font-medium">{notice}</p>
          <button
            className="rounded-lg px-2 py-1 font-inter text-lg leading-none text-ink-muted transition-colors duration-150 hover:bg-inset hover:text-ink"
            aria-label="Dismiss"
            onClick={() => setNotice(null)}
          >
            <X size={18} aria-hidden="true" />
          </button>
        </div>
      )}

      {removeTarget && (
        <ConfirmDialog
          title={`Remove “${removeTarget.project.name}”?`}
          body={
            <>
              <p>
                This permanently deletes the project and everything attached to it — data sources,
                metrics history, and alert rules. It can’t be undone.
              </p>
              <p className="mt-2">
                Only want it out of the way for now? Open the project and use Archive instead —
                archived projects keep their history and can be restored.
              </p>
            </>
          }
          confirmWord={removeTarget.project.name}
          confirmLabel="Remove permanently"
          busy={removeBusy}
          error={removeError}
          onConfirm={() => void confirmRemoval()}
          onCancel={() => { setRemoveTarget(null); setRemoveError(null) }}
        />
      )}
    </div>
  )
}
