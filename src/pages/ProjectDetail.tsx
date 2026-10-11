import CopyButton from '../components/CopyButton'
import { useCallback, useEffect, useRef, useState } from 'react'
import { ArrowLeft, ArrowRight, X } from 'lucide-react'
import { useParams, useNavigate, Link, useSearchParams } from 'react-router-dom'
import ActionMenu from '../components/ActionMenu'
import ConfirmDialog from '../components/ConfirmDialog'
import ProjectOverview, { type MetricKey } from '../components/ProjectOverview'
import DurationPicker from '../components/ui/duration-picker'
import { api, ingestUrlFor, stripeUrlFor, ApiError, connectErrorMessage, loadErrorMessage } from '../lib/api'
import SaJsonUpload from '../components/SaJsonUpload'
import ReconnectBanner, { needsReconnect } from '../components/ReconnectBanner'
import ConnectorPicker, { type ConnectableType } from '../components/ConnectorPicker'
import ExternalConnectorForm, { type ExternalConnectorType } from '../components/ExternalConnectorForm'
import { connectorStatus, describeRule, humanKeyLabel, metricFamilyLabel } from '../lib/format'
import type { ProjectListEntry, FirebaseConnectResult, WebhookConnectResult, StripeConnectResult, SupabaseConnectResult } from '../lib/contracts'
import type { AlertRule, ConnectorInstance, MetricType, Project } from '../types'

function timeAgo(ts: string | undefined): string | null {
  if (!ts) return null
  const ms = new Date(ts).getTime()
  if (Number.isNaN(ms)) return null
  const mins = Math.max(0, Math.round((Date.now() - ms) / 60000))
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.round(mins / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.round(hours / 24)}d ago`
}

/** "Polled 12m ago · checked 1h ago" — segments omitted when there's nothing to report. */
function connectorActivity(c: ConnectorInstance): string | null {
  const polled = timeAgo(c.lastFetchedAt ?? undefined)
  const checked = timeAgo(c.lastHealthCheck ?? undefined)
  const parts: string[] = []
  if (c.fetchMode === 'poll' && polled) parts.push(`new data ${polled}`)
  if (checked) parts.push(`last checked ${checked}`)
  return parts.length ? parts.join(' · ') : null
}

/** "Users: total, signups" from live keys, or just the family names before data arrives. */
function reportingFor(c: ConnectorInstance, keys: Array<{ metricType: MetricType; key: string }>): string {
  const fams = [...new Set(c.capabilities.map(metricFamilyLabel))]
  return fams
    .map((f) => {
      const ks = keys.filter((k) => metricFamilyLabel(k.metricType) === f).map((k) => humanKeyLabel(k.key))
      return ks.length ? `${f}: ${ks.join(', ')}` : f
    })
    .join(' · ')
}

/** Production → Production, paused → Paused. Enum values stay internal. */
function titleCase(s: string): string {
  return s ? s[0].toUpperCase() + s.slice(1) : s
}


/** Click-to-edit field: text → input on click, Enter/blur saves, Esc cancels. */
function Editable(props: {
  label: string
  value: string
  placeholder?: string
  multiline?: boolean
  onSave: (v: string) => Promise<void>
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(props.value)
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  async function save() {
    if (draft === props.value) {
      setEditing(false)
      return
    }
    setSaving(true)
    setErr(null)
    try {
      await props.onSave(draft)
      setEditing(false)
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "Couldn't save that change — try again.")
    } finally {
      setSaving(false)
    }
  }

  if (!editing) {
    return (
      <div>
        <dt className="text-xs font-medium uppercase tracking-wide text-ink-muted">{props.label}</dt>
        <dd>
          <button
            className="min-h-11 break-all text-left text-sm hover:underline"
            title="Click to edit"
            onClick={() => { setDraft(props.value); setEditing(true) }}
          >
            {props.value || <span className="text-ink-muted">{props.placeholder ?? '+ add'}</span>}
          </button>
        </dd>
        {err && <p className="text-xs text-coral-emphasis">{err}</p>}
      </div>
    )
  }
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-ink-muted">{props.label}</dt>
      <dd className="flex gap-2">
        {props.multiline ? (
          <textarea className="input" rows={2} value={draft} onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Escape') setEditing(false) }} autoFocus />
        ) : (
          <input className="input" value={draft} onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') void save(); if (e.key === 'Escape') setEditing(false) }} autoFocus />
        )}
        <div className="flex flex-col gap-1">
          <button className="btn-primary px-3 py-1 text-sm" disabled={saving} onClick={() => void save()}>
            {saving ? '…' : 'Save'}
          </button>
          <button className="btn-ghost px-3 py-1 text-sm" onClick={() => setEditing(false)}>Cancel</button>
        </div>
      </dd>
      {err && <p className="text-xs text-coral-emphasis">{err}</p>}
    </div>
  )
}

export default function ProjectDetail() {
  const { projectId } = useParams()
  const navigate = useNavigate()
  const [entry, setEntry] = useState<ProjectListEntry | null>(null)
  const [connectors, setConnectors] = useState<ConnectorInstance[] | null>(null)
  const [keys, setKeys] = useState<MetricKey[]>([])
  const [error, setError] = useState<string | null>(null)
  const [deleteArmed, setDeleteArmed] = useState(false)
  const [deleteBusy, setDeleteBusy] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [searchParams, setSearchParams] = useSearchParams()
  const requestedTab = searchParams.get('tab')
  const activeTab = ['sources', 'alerts', 'details'].includes(requestedTab ?? '') ? requestedTab! : 'overview'
  function selectTab(tab: string) { setSearchParams(tab === 'overview' ? {} : { tab }, { replace: true }) }
  const loadVersion = useRef(0)
  const [nameEditing, setNameEditing] = useState(false)
  const [nameDraft, setNameDraft] = useState('')
  const [nameSaving, setNameSaving] = useState(false)
  const [attach, setAttach] = useState<ConnectableType | 'webhook' | null>(null)
  const [showConnectorPicker, setShowConnectorPicker] = useState(false)
  const [stripeKey, setStripeKey] = useState('')
  const [stripeWhSecret, setStripeWhSecret] = useState('')
  const [stripeEndpoint, setStripeEndpoint] = useState<string | null>(null)
  const [supabaseUrl, setSupabaseUrl] = useState('')
  const [supabaseKey, setSupabaseKey] = useState('')
  const [saJson, setSaJson] = useState('')
  const [attachBusy, setAttachBusy] = useState(false)
  const [attachError, setAttachError] = useState<string | null>(null)
  const [webhookSecret, setWebhookSecret] = useState<string | null>(null)
  const [healthBusy, setHealthBusy] = useState<string | null>(null)
  const [rules, setRules] = useState<AlertRule[] | null>(null)
  const [ruleKey, setRuleKey] = useState('')
  const [ruleCondition, setRuleCondition] = useState<'above' | 'below'>('above')
  const [ruleThreshold, setRuleThreshold] = useState('')
  const [ruleWindow, setRuleWindow] = useState(15)
  const [ruleChannel, setRuleChannel] = useState<'email' | 'webhook'>('email')
  const [ruleTarget, setRuleTarget] = useState('')
  const [ruleBusy, setRuleBusy] = useState(false)
  const [ruleError, setRuleError] = useState<string | null>(null)
  const [ruleActionId, setRuleActionId] = useState<string | null>(null)
  const [showRuleForm, setShowRuleForm] = useState(false)
  const [editingRuleId, setEditingRuleId] = useState<string | null>(null)
  const [healthErrors, setHealthErrors] = useState<Record<string, string>>({})
  const [toast, setToast] = useState<string | null>(null)
  const toastTimer = useRef<number | null>(null)

  function showToast(msg: string) {
    setToast(msg)
    if (toastTimer.current) window.clearTimeout(toastTimer.current)
    toastTimer.current = window.setTimeout(() => setToast(null), 4000)
  }

  useEffect(() => {
    const pending = sessionStorage.getItem('stackduck:just-connected')
    if (pending) {
      sessionStorage.removeItem('stackduck:just-connected')
      showToast(`${pending} connected! Your first data will show up shortly.`)
    }
    return () => {
      if (toastTimer.current) window.clearTimeout(toastTimer.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const load = useCallback(async () => {
    if (!projectId) return
    const version = ++loadVersion.current
    setError(null)
    try {
      const [detail, conns, rulesRes, keysRes] = await Promise.all([
        api<ProjectListEntry>(`/v1/projects/${projectId}`),
        api<{ connectors: ConnectorInstance[] }>(`/v1/projects/${projectId}/connectors`),
        api<{ rules: AlertRule[] }>(`/v1/projects/${projectId}/alerts`),
        api<{ keys: MetricKey[] }>(`/v1/projects/${projectId}/metrics/metric-keys`),
      ])
      if (version !== loadVersion.current) return
      setEntry(detail)
      setConnectors(conns.connectors)
      setRules(rulesRes.rules)
      setKeys(keysRes.keys)
    } catch (e) {
      if (version !== loadVersion.current) return
      if (e instanceof ApiError && e.status === 404) setError('not-found')
      else setError(loadErrorMessage('this project', e))
    }
  }, [projectId])

  useEffect(() => {
    setEntry(null)
    setConnectors(null)
    setRules(null)
    setKeys([])
    setAttach(null)
    setShowRuleForm(false)
    setNameEditing(false)
    setDeleteArmed(false)
    void load()
    return () => { loadVersion.current++ }
  }, [load])

  async function patchProject(body: Record<string, unknown>) {
    const res = await api<{ project: Project }>(`/v1/projects/${projectId}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    })
    setEntry((e) => (e ? { ...e, project: { ...e.project, ...res.project } } : e))
  }

  async function saveName() {
    const next = nameDraft.trim()
    if (!next || next === entry?.project.name) {
      setNameEditing(false)
      return
    }
    setNameSaving(true)
    try {
      await patchProject({ name: next })
      await load()
      setNameEditing(false)
    } finally {
      setNameSaving(false)
    }
  }

  /** Hard delete: project + connectors + rules + metric points, server-side. */
  async function deleteProject() {
    if (!projectId) return
    setDeleteBusy(true)
    setDeleteError(null)
    try {
      await api<{ ok: boolean }>(`/v1/projects/${projectId}?forever=true`, { method: 'DELETE' })
    navigate('/portfolio')
    } catch (cause) {
      setDeleteError(loadErrorMessage('this project for removal', cause))
    } finally { setDeleteBusy(false) }
  }

  async function attachFirebase() {
    setAttachError(null)
    setAttachBusy(true)
    try {
      const parsed = JSON.parse(saJson) as unknown
      const res = await api<FirebaseConnectResult>(`/v1/projects/${projectId}/connectors/firebase`, {
        method: 'POST',
        body: JSON.stringify({ serviceAccountJson: parsed }),
      })
      if (!res.healthCheck.ok) {
        setAttachError(`Saved but unhealthy: ${res.healthCheck.detail}`)
      } else {
        setAttach(null)
        setSaJson('')
        showToast('Firebase connected! Your first data will show up shortly.')
      }
      await load()
    } catch (e) {
      setAttachError(connectErrorMessage(e))
    } finally {
      setAttachBusy(false)
    }
  }

  async function attachStripe() {
    setAttachError(null)
    setAttachBusy(true)
    try {
      const res = await api<StripeConnectResult>(`/v1/projects/${projectId}/connectors/stripe`, {
        method: 'POST',
        body: JSON.stringify({
          apiKey: stripeKey.trim(),
          ...(stripeWhSecret.trim() ? { webhookSecret: stripeWhSecret.trim() } : {}),
        }),
      })
      if (!res.healthCheck.ok) {
        setAttachError(`Saved but unhealthy: ${res.healthCheck.detail}`)
      } else {
        setStripeEndpoint(res.stripeEndpoint)
        showToast('Stripe connected! Your first data will show up shortly.')
      }
      await load()
    } catch (e) {
      setAttachError(connectErrorMessage(e))
    } finally {
      setAttachBusy(false)
    }
  }

  async function attachSupabase() {
    setAttachError(null)
    setAttachBusy(true)
    try {
      const res = await api<SupabaseConnectResult>(`/v1/projects/${projectId}/connectors/supabase`, {
        method: 'POST',
        body: JSON.stringify({ url: supabaseUrl.trim(), serviceKey: supabaseKey.trim() }),
      })
      if (!res.healthCheck.ok) {
        setAttachError(`Saved but unhealthy: ${res.healthCheck.detail}`)
      } else {
        setAttach(null)
        setSupabaseUrl('')
        setSupabaseKey('')
        showToast('Supabase connected! Your first data will show up shortly.')
      }
      await load()
    } catch (e) {
      setAttachError(connectErrorMessage(e))
    } finally {
      setAttachBusy(false)
    }
  }

  async function attachWebhook() {
    setAttachError(null)
    setAttachBusy(true)
    try {
      const res = await api<WebhookConnectResult>(`/v1/projects/${projectId}/connectors/generic-webhook`, {
        method: 'POST',
        body: JSON.stringify({}),
      })
      setWebhookSecret(res.signingSecret)
      showToast('Webhook created! Send your first update to switch it on.')
      await load()
    } catch (e) {
      setAttachError(connectErrorMessage(e))
    } finally {
      setAttachBusy(false)
    }
  }

  async function createRule() {
    if (!projectId || !ruleKey || !ruleThreshold.trim() || !ruleTarget.trim() || ruleWindow < 1) return
    const [metricTypeValue, ...keyParts] = ruleKey.split('/')
    const metricType = metricTypeValue as MetricType
    setRuleError(null)
    setRuleBusy(true)
    try {
      const threshold = Number(ruleThreshold)
      if (!Number.isFinite(threshold)) {
        setRuleError('Enter a valid numeric threshold.')
        return
      }
      const ruleFields = {
        metricType,
        key: keyParts.join('/'),
        condition: ruleCondition,
        threshold,
        windowMinutes: ruleWindow,
        channel: ruleChannel,
        channelTarget: ruleTarget.trim(),
      }
      if (editingRuleId) {
        const updated = await api<{ rule: AlertRule }>(`/v1/projects/${projectId}/alerts/${editingRuleId}`, {
          method: 'PATCH',
          body: JSON.stringify(ruleFields),
        })
        setRules((current) => current?.map((rule) => rule.id === editingRuleId ? updated.rule : rule) ?? null)
      } else {
        const created = await api<{ rule: AlertRule }>(`/v1/projects/${projectId}/alerts`, {
          method: 'POST',
          body: JSON.stringify(ruleFields),
        })
        setRules((current) => [...(current ?? []), created.rule])
      }
      setEditingRuleId(null)
      setRuleKey('')
      setRuleThreshold('')
      setRuleTarget('')
      setRuleWindow(15)
      setShowRuleForm(false)
    } catch {
      setRuleError('Couldn’t save the rule. Check your connection and try again.')
    } finally {
      setRuleBusy(false)
    }
  }

  async function toggleRule(rule: AlertRule) {
    if (!projectId) return
    setRuleActionId(rule.id)
    setRuleError(null)
    try {
      const updated = await api<{ rule: AlertRule }>(`/v1/projects/${projectId}/alerts/${rule.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: rule.status === 'active' ? 'muted' : 'active' }),
      })
      setRules((rs) => rs?.map((r) => (r.id === rule.id ? updated.rule : r)) ?? null)
    } catch {
      setRuleError('Could not update this rule. Check your connection and retry.')
    } finally {
      setRuleActionId(null)
    }
  }

  async function deleteRule(rule: AlertRule) {
    if (!projectId) return
    setRuleActionId(rule.id)
    setRuleError(null)
    try {
      await api<{ ok: boolean }>(`/v1/projects/${projectId}/alerts/${rule.id}`, { method: 'DELETE' })
      setRules((rs) => rs?.filter((r) => r.id !== rule.id) ?? null)
    } catch {
      setRuleError('Could not delete this rule. Check your connection and retry.')
    } finally {
      setRuleActionId(null)
    }
  }

  async function runHealthcheck(connectorId: string) {
    setHealthBusy(connectorId)
    setHealthErrors((errors) => ({ ...errors, [connectorId]: '' }))
    try {
      const result = await api<{ healthCheck: { ok: boolean; detail: string } }>(
        `/v1/projects/${projectId}/connectors/${connectorId}/healthcheck`,
        { method: 'POST' },
      )
      if (!result.healthCheck.ok) {
        setHealthErrors((errors) => ({ ...errors, [connectorId]: result.healthCheck.detail }))
      }
      await load()
    } catch {
      setHealthErrors((errors) => ({ ...errors, [connectorId]: 'Could not reach the connector service. Check your connection and try again.' }))
    } finally {
      setHealthBusy(null)
    }
  }

  async function attachExternal(type: ExternalConnectorType, data: Record<string, string>) {
    if (!projectId) return
    setAttachError(null)
    setAttachBusy(true)
    try {
      const result = await api<{ healthCheck: { ok: boolean; detail: string } }>(
        `/v1/projects/${projectId}/connectors/${type}`,
        { method: 'POST', body: JSON.stringify(data) },
      )
      if (!result.healthCheck.ok) setAttachError(`Saved but unhealthy: ${result.healthCheck.detail}`)
      else {
        setAttach(null)
        showToast(`${type === 'github-actions' ? 'GitHub Actions' : type === 'posthog' ? 'PostHog' : type === 'betterstack' ? 'Better Stack' : type === 'vercel' ? 'Vercel' : 'Sentry'} connected. First metrics arrive on the next poll.`)
      }
      await load()
    } catch (e) {
      setAttachError(connectErrorMessage(e))
    } finally {
      setAttachBusy(false)
    }
  }

  if (error === 'not-found') {
    return (
      <div className="utility-panel">
        <h1 className="workspace-title">Project not found</h1>
        <Link to="/portfolio" className="btn-ghost mt-5"><ArrowLeft size={14} className="mr-1 inline" aria-hidden="true" />Back to portfolio</Link>
      </div>
    )
  }
  if (error) return (
    <div className="card mt-8 text-center">
      <h1 className="workspace-title">Couldn’t load this project</h1>
      <p role="alert" className="mt-3 text-sm text-coral-emphasis">{error}</p>
      <button className="btn-primary mt-4" onClick={() => void load()}>
        Try again
      </button>
    </div>
  )
  if (!entry) return (
    <div className="mt-8 flex flex-col gap-6" aria-label="Loading project" aria-busy="true">
      <div className="skeleton h-4 w-24" /><div className="skeleton h-10 w-1/2" /><div className="skeleton h-12 w-full max-w-md" />
      <div className="card"><div className="skeleton h-4 w-24" /><div className="skeleton mt-3 h-8 w-32" /><div className="mt-6 grid grid-cols-3 gap-4 border-t border-line pt-5">{[0, 1, 2].map(index => <div key={index}><div className="skeleton h-3 w-20" /><div className="skeleton mt-2 h-5 w-full" /></div>)}</div></div>
      <div className="grid gap-4 lg:grid-cols-2">{[0, 1].map(index => <div className="card" key={index}><div className="skeleton h-4 w-32" /><div className="skeleton mt-5 h-9 w-24" /><div className="skeleton mt-5 h-[200px] w-full" /></div>)}</div>
    </div>
  )

  const p = entry.project
  const archived = p.status === 'archived'

  return (
    <div className="mt-8 flex flex-col gap-4">
      {archived && (
        <div className="card bg-butter-yellow text-inkwell-navy">
          <p className="text-sm font-medium">This project is archived. New data is paused — nothing is lost.</p>
          <button className="btn-ghost mt-2 !border-line-strong bg-paper-white text-inkwell-navy hover:!bg-paper-white" onClick={() => void patchProject({ status: 'active' }).then(load)}>
            Restore to active
          </button>
        </div>
      )}

      {/* 1. Header */}
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-4">
        <div className="min-w-0 [overflow-wrap:anywhere]">
          <Link to="/portfolio" className="mb-3 inline-flex items-center gap-1.5 font-inter text-sm text-ink-muted hover:text-ink"><ArrowLeft size={15} aria-hidden="true" />Portfolio</Link>
          {nameEditing ? (
              <div className="flex flex-wrap items-center gap-2">
                <input
                className="input min-w-0 w-full max-w-xs !text-xl font-semibold sm:!text-2xl"
                value={nameDraft}
                autoFocus
                aria-label="Project name"
                onChange={(e) => setNameDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') void saveName()
                  if (e.key === 'Escape') setNameEditing(false)
                }}
              />
              <button
                className="btn-primary px-3 py-1 text-sm"
                disabled={nameSaving || !nameDraft.trim()}
                onClick={() => void saveName()}
              >
                {nameSaving ? '…' : 'Save'}
              </button>
              <button className="btn-ghost px-3 py-1 text-sm" onClick={() => setNameEditing(false)}>Cancel</button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <h1 className="min-w-0 [overflow-wrap:anywhere] font-display text-3xl font-semibold text-ink sm:text-4xl">{p.name}</h1>
              <button
                className="icon-button"
                title="Rename project"
                aria-label="Rename project"
                onClick={() => { setNameDraft(p.name); setNameEditing(true) }}
              >
                ✎
              </button>
            </div>
          )}
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {p.environment && <span className="badge">{titleCase(p.environment)}</span>}
            <span className={p.status === 'paused' ? 'badge badge-highlight' : 'badge'}>
              {titleCase(p.status)}
            </span>
          </div>
          {p.description && <p className="mt-3 max-w-2xl text-sm text-ink-secondary">{p.description}</p>}
          {p.repoUrl && <a href={p.repoUrl} target="_blank" rel="noreferrer" className="mt-2 inline-flex max-w-full items-center gap-1.5 truncate text-sm text-link-emphasis hover:underline">{p.repoUrl}<ArrowRight size={14} aria-hidden="true" /></a>}
        </div>
        <ActionMenu label="Project actions" actions={[
          ...(archived ? [] : [{ label: p.status === 'paused' ? 'Resume project' : 'Pause project', onSelect: () => void patchProject({ status: p.status === 'paused' ? 'active' : 'paused' }).then(load).catch(() => showToast('Couldn’t update project status. Try again.')) }]),
          { label: archived ? 'Restore project' : 'Archive project', onSelect: () => void patchProject({ status: archived ? 'active' : 'archived' }).then(load).catch(() => showToast('Couldn’t update project status. Try again.')) },
          { label: 'Remove project…', destructive: true, onSelect: () => { setDeleteError(null); setDeleteArmed(true) } },
        ]} />
      </div>
      <div role="tablist" aria-label="Project sections" className="workspace-tabs">
        {[['overview', 'Overview'], ['sources', 'Data sources'], ['alerts', 'Alerts'], ['details', 'Details']].map(([id, label], index) => <button key={id} id={`tab-${id}`} role="tab" aria-selected={activeTab === id} aria-controls={`panel-${id}`} tabIndex={activeTab === id ? 0 : -1} onClick={() => selectTab(id)} onKeyDown={event => {
          const tabs = ['overview', 'sources', 'alerts', 'details']
          const next = event.key === 'ArrowRight' ? (index + 1) % 4 : event.key === 'ArrowLeft' ? (index + 3) % 4 : event.key === 'Home' ? 0 : event.key === 'End' ? 3 : undefined
          if (next !== undefined) { event.preventDefault(); selectTab(tabs[next]); document.getElementById(`tab-${tabs[next]}`)?.focus() }
        }}>{label}</button>)}
      </div>
      <div id="panel-overview" role="tabpanel" aria-labelledby="tab-overview" hidden={activeTab !== 'overview'} tabIndex={0}>
        {activeTab === 'overview' && <ProjectOverview entry={entry} connectors={connectors ?? []} keys={keys} rules={rules ?? []} onRefresh={load} onSources={() => selectTab('sources')} onAlerts={() => selectTab('alerts')} />}
      </div>

      {/* 2. About */}
      <section className="card" id="panel-details" role="tabpanel" aria-labelledby="tab-details" hidden={activeTab !== 'details'} tabIndex={0}>
        <h2 className="font-inter text-lg font-semibold text-ink">
          <span className="flex items-center justify-between gap-3">Project details <span className="text-xs font-normal text-ink-muted">Edit catalog fields</span></span>
        </h2>
        <dl className="mt-3 grid gap-4 sm:grid-cols-2">
          <Editable label="Name" value={p.name} onSave={(v) => patchProject({ name: v })} />
          <Editable label="Description" value={p.description ?? ''} multiline onSave={(v) => patchProject({ description: v || null })} />
          <Editable label="Stack tags (comma-separated)" value={(p.stackTags ?? []).join(', ')}
            onSave={(v) => patchProject({ stackTags: v.split(',').map((t) => t.trim()).filter(Boolean) })} />
          <Editable label="Environment" value={p.environment ?? ''} placeholder="+ add (production/staging/development)"
            onSave={(v) => patchProject({ environment: v || null })} />
          <Editable label="Repo URL" value={p.repoUrl ?? ''} onSave={(v) => patchProject({ repoUrl: v || null })} />
          <Editable label="Live URL" value={p.liveUrl ?? ''} onSave={(v) => patchProject({ liveUrl: v || null })} />
          <div className="sm:col-span-2">
            <Editable label="Notes" value={p.notes ?? ''} multiline onSave={(v) => patchProject({ notes: v || null })} />
          </div>
        </dl>
        <p className="mt-3 text-xs text-ink-muted">
          {(() => {
            const t = timeAgo(p.updatedAt)
            return t ? `Saved ${t}` : 'Not saved yet'
          })()}
        </p>
      </section>

      {/* 3. Connectors */}
      <section className="card" id="panel-sources" role="tabpanel" aria-labelledby="tab-sources" hidden={activeTab !== 'sources'} tabIndex={0}>
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-inter text-lg font-semibold">Data sources</h2>
            <Link to="/docs/connect" target="_blank" rel="noreferrer" className="text-link-emphasis text-link text-sm">How to get your credentials <ArrowRight size={14} className="ml-1 inline" aria-hidden="true" /></Link>
          </div>
          {(connectors?.length ?? 0) > 0 && (
            <button className="btn-ghost shrink-0 text-sm" onClick={() => setShowConnectorPicker((shown) => !shown)} aria-expanded={showConnectorPicker}>
              {showConnectorPicker ? 'Close chooser' : 'Add source'}
            </button>
          )}
        </div>

        {showConnectorPicker && (connectors?.length ?? 0) > 0 && (
          <div className="mt-4 border-t border-line pt-4">
            <ConnectorPicker
              connectedTypes={(connectors ?? []).filter((c) => c.status !== 'error').map((c) => c.type)}
              failedTypes={(connectors ?? []).filter((c) => c.status === 'error').map((c) => c.type)}
              onSelect={(type) => {
              setAttach(type === 'generic-webhook' ? 'webhook' : type)
              setWebhookSecret(null)
              setStripeEndpoint(null)
              setShowConnectorPicker(false)
            }} />
          </div>
        )}

        {connectors === null && <p className="mt-3 text-sm text-ink-muted">Loading connectors…</p>}

        {connectors !== null && connectors.length === 0 && attach === null && (
          <div className="mt-5 rounded-lg border border-line p-4">
            <p className="text-sm font-medium">No live data yet — pick a source below. This page stays useful without it.</p>
            <div className="mt-3">
              <ConnectorPicker
                connectedTypes={[]}
                failedTypes={[]}
                onSelect={(type: ConnectableType) => {
                  setAttach(type === 'generic-webhook' ? 'webhook' : type)
                  setWebhookSecret(null)
                  setStripeEndpoint(null)
                }}
              />
            </div>
          </div>
        )}

        <ul className="mt-3 flex flex-col gap-3">
          {connectors?.map((c) => {
            const st = connectorStatus(c.status)
            const activity = connectorActivity(c)
            const pushAddress = c.type === 'generic-webhook' ? ingestUrlFor(c.id) : c.type === 'stripe' ? stripeUrlFor(c.id) : null
            return (
              <li key={c.id} className="border-b border-line py-4 last:border-0">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className={`status-dot ${st.dot}`} aria-hidden="true" />
                    <span className="text-sm font-semibold">
                      {c.type === 'firebase' ? 'Firebase' : c.type === 'stripe' ? 'Stripe' : c.type === 'supabase' ? 'Supabase' : c.type === 'sentry' ? 'Sentry' : c.type === 'github-actions' ? 'GitHub Actions' : c.type === 'posthog' ? 'PostHog' : c.type === 'betterstack' ? 'Better Stack' : c.type === 'vercel' ? 'Vercel' : 'Generic Webhook'}
                    </span>
                  </div>
                  {(c.type === 'firebase' || c.type === 'stripe' || c.type === 'supabase' || c.type === 'sentry' || c.type === 'github-actions' || c.type === 'posthog' || c.type === 'betterstack' || c.type === 'vercel') && (
                    <button className="btn-ghost text-sm" disabled={healthBusy === c.id} onClick={() => void runHealthcheck(c.id)}>
                      {healthBusy === c.id ? 'Checking…' : 'Check again'}
                    </button>
                  )}
                </div>
                <p className="mt-1 text-sm font-medium">{st.headline}</p>
                {c.status === 'error' && needsReconnect(c.lastError) && (
                  <ReconnectBanner
                    connectorType={c.type}
                    onReconnect={() => {
                      setAttach(c.type === 'generic-webhook' ? 'webhook' : (c.type as ConnectableType))
                      setWebhookSecret(null)
                      setStripeEndpoint(null)
                      setShowConnectorPicker(false)
                      selectTab('sources')
                    }}
                  />
                )}
                {c.status === 'error' && !needsReconnect(c.lastError) && (
                  <div role="status" className="mt-2 rounded-md border border-coral-emphasis/30 bg-coral-emphasis/5 px-3 py-2">
                    <p className="text-sm text-coral-emphasis">
                      {healthErrors[c.id] || c.lastError || 'The last connection check failed. Check credentials and provider permissions.'}
                    </p>
                    <p className="mt-1 text-xs text-ink-muted">Re-enter credentials with Add source, or use Check again to retry the connection.</p>
                  </div>
                )}
                {healthErrors[c.id] && c.status !== 'error' && (
                  <p role="alert" className="mt-2 text-sm text-coral-emphasis">{healthErrors[c.id]}</p>
                )}
                <p className="mt-1 text-xs text-ink-muted">Reporting · {reportingFor(c, keys)}</p>
                {activity ? (
                  <p className="mt-1 text-xs text-ink-muted">{activity}</p>
                ) : (
                  <p className="mt-1 text-xs text-ink-muted">No updates yet</p>
                )}
                {c.status === 'pending' && (
                  <p className="mt-2 text-sm text-ink-muted">
                    {c.fetchMode === 'poll'
                      ? 'Checks run about every 30 minutes — the first one will pick this up.'
                      : 'Send your first update to the address below — this switches on by itself once it arrives.'}
                  </p>
                )}
                {pushAddress && (
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <code className="break-all text-xs">{pushAddress}</code>
                    <CopyButton value={pushAddress} label="Copy endpoint" />
                  </div>
                )}
                {c.type === 'stripe' && c.status === 'connected' && keys.length === 0 && (
                  <p className="mt-2 text-sm text-ink-muted">
                    Instant events arrive once the address above is registered in Stripe;
                    totals land on their own every night.
                  </p>
                )}
              </li>
            )
          })}
        </ul>

        {attach === 'firebase' && (
          <div className="mt-3 rounded-lg bg-inset p-4">
            <p className="text-sm font-medium">Paste the Firebase service-account JSON (read-only roles recommended). <Link to="/docs/connect/firebase" className="text-link-emphasis text-link font-normal">Where do I find this? <ArrowRight size={14} className="ml-1 inline" aria-hidden="true" /></Link></p>
            <details className="mt-2 rounded-lg bg-surface p-3 text-sm">
              <summary className="cursor-pointer font-medium text-ink">What is this?</summary>
              <p className="mt-2 text-ink-muted">
                A service account is like a read-only username your Firebase project issues
                for tools like Stackduck. It can only look — it can't change or delete anything.
              </p>
            </details>
            <div className="mt-2">
              <SaJsonUpload
                disabled={attachBusy}
                onInvalid={(m) => setAttachError(m)}
                onLoaded={(text) => {
                  setSaJson(text)
                  if (text) setAttachError(null)
                }}
              />
            </div>
            <textarea className="input mt-2 font-mono text-xs" rows={6} value={saJson} onChange={(e) => setSaJson(e.target.value)} />
            {attachError && <p role="alert" className="mt-2 text-sm text-coral-emphasis">{attachError}</p>}
            <div className="mt-2 flex gap-2">
              <button className="btn-primary" disabled={attachBusy || !saJson.trim()} onClick={() => void attachFirebase()}>
                {attachBusy ? 'Checking…' : 'Connect + run health check'}
              </button>
              <button className="btn-ghost" onClick={() => { setAttach(null); setAttachError(null) }}>Cancel</button>
            </div>
          </div>
        )}
        {attach === 'stripe' && !stripeEndpoint && (
          <div className="mt-3 rounded-lg bg-inset p-4">
            <p className="text-sm font-medium">
              A restricted key can only read — it can't move money. Paste it from your Stripe dashboard
              (Developers → API keys, read access to charges, balance, payouts).{' '}
              <Link to="/docs/connect/stripe" className="text-link-emphasis text-link font-normal">Where do I find this? <ArrowRight size={14} className="ml-1 inline" aria-hidden="true" /></Link>
            </p>
            <label className="mt-3 flex flex-col gap-1 text-sm font-medium">
              Restricted secret key *
              <input
                className="input font-mono text-xs"
                type="password"
                autoComplete="off"
                placeholder="rk_live_… or rk_test_…"
                value={stripeKey}
                onChange={(e) => setStripeKey(e.target.value)}
              />
            </label>
            <label className="mt-3 flex flex-col gap-1 text-sm font-medium">
              Webhook signing secret <span className="font-normal text-ink-muted">(optional — enables instant events)</span>
              <input
                className="input font-mono text-xs"
                type="password"
                autoComplete="off"
                placeholder="whsec_… (skip for nightly totals only)"
                value={stripeWhSecret}
                onChange={(e) => setStripeWhSecret(e.target.value)}
              />
            </label>
            {attachError && <p className="mt-2 text-sm text-coral-emphasis">{attachError}</p>}
            <div className="mt-2 flex gap-2">
              <button className="btn-primary" disabled={attachBusy || !stripeKey.trim()} onClick={() => void attachStripe()}>
                {attachBusy ? 'Checking…' : 'Connect + run health check'}
              </button>
              <button className="btn-ghost" onClick={() => { setAttach(null); setAttachError(null) }}>Cancel</button>
            </div>
          </div>
        )}
        {stripeEndpoint && (
          <div className="mt-3 rounded-lg bg-inset p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">Stripe webhook endpoint</p>
            <code className="mt-1 block break-all text-sm">{stripeEndpoint}</code>
            <div className="mt-2 flex gap-2">
              <CopyButton value={stripeEndpoint} label="Copy endpoint" />
              <button className="btn-ghost" onClick={() => { setAttach(null); setStripeEndpoint(null); setStripeKey(''); setStripeWhSecret('') }}>Done</button>
            </div>
            <p className="mt-2 text-sm text-ink-muted">
              Register this under <strong>Stripe dashboard → Developers → Webhooks</strong> for instant
              charge and payout events. Without it, nightly totals still reconcile.
            </p>
          </div>
        )}
        {attach === 'supabase' && (
          <div className="mt-3 rounded-lg bg-inset p-4">
            <div className="rounded-lg bg-butter-yellow p-3 text-sm font-medium text-inkwell-navy">
              Use the <strong>service_role</strong> secret — never the anon key. Think of it
              as a master key for your database: powerful, so keep it private.{' '}
              <Link to="/docs/connect/supabase" className="text-link-emphasis text-link">Where do I find this? <ArrowRight size={14} className="ml-1 inline" aria-hidden="true" /></Link>
            </div>
            <label className="mt-3 flex flex-col gap-1 text-sm font-medium">
              Project URL *
              <input
                className="input font-mono text-xs"
                type="url"
                autoComplete="off"
                placeholder="https://xyzcompany.supabase.co"
                value={supabaseUrl}
                onChange={(e) => setSupabaseUrl(e.target.value)}
              />
            </label>
            <label className="mt-3 flex flex-col gap-1 text-sm font-medium">
              service_role secret *
              <input
                className="input font-mono text-xs"
                type="password"
                autoComplete="off"
                placeholder="eyJ…"
                value={supabaseKey}
                onChange={(e) => setSupabaseKey(e.target.value)}
              />
            </label>
            {attachError && <p className="mt-2 text-sm text-coral-emphasis">{attachError}</p>}
            <div className="mt-2 flex gap-2">
              <button className="btn-primary" disabled={attachBusy || !supabaseUrl.trim() || !supabaseKey.trim()} onClick={() => void attachSupabase()}>
                {attachBusy ? 'Checking…' : 'Connect + run health check'}
              </button>
              <button className="btn-ghost" onClick={() => { setAttach(null); setAttachError(null) }}>Cancel</button>
            </div>
          </div>
        )}
        {(attach === 'sentry' || attach === 'github-actions' || attach === 'posthog' || attach === 'betterstack' || attach === 'vercel') && (
          <ExternalConnectorForm
            type={attach}
            repoUrl={entry?.project.repoUrl}
            liveUrl={entry?.project.liveUrl}
            busy={attachBusy}
            error={attachError}
            onConnect={(data) => void attachExternal(attach, data)}
            onCancel={() => { setAttach(null); setAttachError(null) }}
          />
        )}
        {attach === 'webhook' && (
          <div className="mt-3 rounded-lg bg-inset p-4">
            {!webhookSecret ? (
              <>
                <p className="text-sm">Generate a unique ingest URL + signing secret for this project. <Link to="/docs/connect/webhook" className="text-link-emphasis text-link">How to sign events <ArrowRight size={14} className="ml-1 inline" aria-hidden="true" /></Link></p>
                {attachError && <p className="mt-2 text-sm text-coral-emphasis">{attachError}</p>}
                <div className="mt-2 flex gap-2">
                  <button className="btn-primary" disabled={attachBusy} onClick={() => void attachWebhook()}>
                    {attachBusy ? 'Generating…' : 'Generate URL + secret'}
                  </button>
                  <button className="btn-ghost" onClick={() => { setAttach(null); setAttachError(null) }}>Cancel</button>
                </div>
              </>
            ) : (
              <>
                <p className="text-xs font-semibold uppercase text-ink-muted">Signing secret — shown once</p>
                <code className="mt-1 block break-all text-sm">{webhookSecret}</code>
                <CopyButton value={webhookSecret} label="Copy secret" className="mt-2" />
                <button className="btn-ghost ml-2" onClick={() => { setAttach(null); setWebhookSecret(null) }}>Done</button>
              </>
            )}
          </div>
        )}
      </section>

      {/* 5. Alerts */}
      <section className="card" id="panel-alerts" role="tabpanel" aria-labelledby="tab-alerts" hidden={activeTab !== 'alerts'} tabIndex={0}>
        <h2 className="font-inter text-lg font-semibold">Alerts</h2>
        <p className="mt-1 text-sm text-ink-muted">
          Save threshold rules for this project. Rules are evaluated every few minutes
          and notify you by email or webhook when they trip.
        </p>

        {rules === null && <p className="mt-3 text-sm text-ink-muted">Loading saved rules…</p>}
        {rules?.length === 0 && (
          <p className="mt-3 rounded-md border border-line px-3 py-3 text-sm text-ink-muted">
            No alert rules yet. Add a metric source and save a threshold rule to keep its configuration here.
          </p>
        )}

        {rules !== null && rules.length > 0 && (
          <ul className="mt-3 flex flex-col gap-2">
            {rules.map((r) => (
              <li key={r.id} className="flex flex-col gap-3 border-b border-line py-4 last:border-0 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0 [overflow-wrap:anywhere]">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={r.triggeredAt && r.status === 'active' ? 'badge badge-alert' : 'badge'}>
                      {r.status === 'active' ? r.triggeredAt ? 'Firing' : 'Active' : 'Muted'}
                    </span>
                    <span className="text-sm font-medium">{describeRule(r)}</span>
                  </div>
                  <p className="mt-1 text-xs text-ink-muted">{r.channel === 'email' ? 'Email' : 'Webhook'} destination: {r.channelTarget}</p>
                </div>
                <div className="flex shrink-0 gap-2">
                  <button className="btn-ghost px-2 py-1 text-xs" disabled={ruleActionId !== null} onClick={() => void toggleRule(r)}>
                    {ruleActionId === r.id ? 'Updating…' : r.status === 'active' ? 'Mute rule' : 'Resume rule'}
                  </button>
                  <button
                    className="btn-ghost px-2 py-1 text-xs"
                    disabled={ruleActionId !== null || ruleBusy}
                    onClick={() => {
                      setRuleError(null)
                      setEditingRuleId(r.id)
                      setRuleKey(`${r.metricType}/${r.key}`)
                      setRuleCondition(r.condition)
                      setRuleThreshold(String(r.threshold))
                      setRuleWindow(r.windowMinutes)
                      setRuleChannel(r.channel)
                      setRuleTarget(r.channelTarget)
                      setShowRuleForm(true)
                    }}
                  >Edit</button>
                  <button className="btn-ghost px-2 py-1 text-xs" disabled={ruleActionId !== null} aria-label={`Delete alert rule: ${humanKeyLabel(r.key)}`} onClick={() => void deleteRule(r)}>
                    Delete
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}

        <h3 className="mt-5 font-inter text-base font-semibold">Latest alert activity</h3>
        <p className="mt-1 rounded-md bg-inset px-3 py-3 text-sm text-ink-muted">
          {rules?.some(rule => rule.lastTriggeredAt) ? rules.filter(rule => rule.lastTriggeredAt).map(rule => humanKeyLabel(rule.key) + ' · last triggered ' + timeAgo(rule.lastTriggeredAt ?? undefined)).join('; ') : 'No alert rules have fired yet.'}
        </p>

        {ruleError && <p role="alert" className="mt-3 text-sm text-coral-emphasis">{ruleError}</p>}
        {keys.length === 0 ? (
          <div className="mt-4 rounded-md border border-line p-3">
            <p className="text-sm font-medium">Connect a metric source first</p>
            <p className="mt-1 text-sm text-ink-muted">Once a source reports its first metric, you can save a threshold rule for it.</p>
            <button className="btn-ghost mt-2 text-sm" onClick={() => selectTab('sources')}>
              Go to data sources <ArrowRight size={14} className="ml-1 inline" aria-hidden="true" />
            </button>
          </div>
        ) : !showRuleForm ? (
          <button className="btn-primary mt-4" onClick={() => { setRuleError(null); setShowRuleForm(true) }}>New alert rule</button>
        ) : (
        <form className="mt-4 rounded-lg bg-inset p-4" onSubmit={(event) => { event.preventDefault(); void createRule() }}>
          <p className="text-sm font-semibold">{editingRuleId ? 'Edit rule' : 'Configure a rule'}</p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <label className="flex flex-col gap-1 text-sm font-medium">
              Metric
              <select className="input" required value={ruleKey} onChange={(e) => setRuleKey(e.target.value)}>
                <option value="">Choose…</option>
                {keys.map((k) => (
                  <option key={`${k.metricType}/${k.key}`} value={`${k.metricType}/${k.key}`}>
                    {metricFamilyLabel(k.metricType)} — {humanKeyLabel(k.key)}
                  </option>
                ))}
              </select>
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="flex flex-col gap-1 text-sm font-medium">
                Condition
                <select className="input" value={ruleCondition} onChange={(e) => setRuleCondition(e.target.value as 'above' | 'below')}>
                  <option value="above">above</option>
                  <option value="below">below</option>
                </select>
              </label>
              <label className="flex flex-col gap-1 text-sm font-medium">
                Threshold
                <input
                  className="input"
                  type="number"
                  step="any"
                  required
                  placeholder="e.g. 5"
                  value={ruleThreshold}
                  onChange={(e) => setRuleThreshold(e.target.value)}
                />
              </label>
            </div>
            <label className="flex flex-col gap-1 text-sm font-medium">
              Evaluate over
              <DurationPicker
                value={{ hours: Math.floor(ruleWindow / 60), minutes: ruleWindow % 60 }}
                onChange={(d) => setRuleWindow(Math.max(1, d.hours * 60 + d.minutes))}
                maxHours={24}
                hoursLabel="h"
                minutesLabel="m"
              />
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="flex flex-col gap-1 text-sm font-medium">
                Channel
                <select className="input" value={ruleChannel} onChange={(e) => setRuleChannel(e.target.value as 'email' | 'webhook')}>
                  <option value="email">Email</option>
                  <option value="webhook">Webhook</option>
                </select>
              </label>
              <label className="flex flex-col gap-1 text-sm font-medium">
                {ruleChannel === 'email' ? 'Email address' : 'Webhook URL'}
                <input
                  className="input"
                  type={ruleChannel === 'email' ? 'email' : 'url'}
                  required
                  placeholder={ruleChannel === 'email' ? 'you@example.com' : 'https://…'}
                  value={ruleTarget}
                  onChange={(e) => setRuleTarget(e.target.value)}
                />
              </label>
            </div>
          </div>
          <button
            type="submit"
            className="btn-primary mt-3"
            disabled={ruleBusy || !ruleKey || !ruleThreshold.trim() || !ruleTarget.trim() || ruleWindow < 1}
          >
            {ruleBusy ? 'Saving…' : editingRuleId ? 'Save changes' : 'Save rule'}
          </button>
          <button type="button" className="btn-ghost ml-2 mt-3" disabled={ruleBusy} onClick={() => { setShowRuleForm(false); setEditingRuleId(null); setRuleError(null) }}>Cancel</button>
        </form>
        )}
      </section>

      {/* 6. Recent */}
      <section className="card" id="activity" hidden={activeTab !== 'overview'}>
        <h2 className="font-inter text-lg font-semibold">Recent activity</h2>
        <ul className="mt-2 flex flex-col gap-1 text-sm">
          {(connectors ?? []).map((c) => {
            const st = connectorStatus(c.status)
            const activity = connectorActivity(c)
            const label = c.type === 'firebase' ? 'Firebase' : c.type === 'stripe' ? 'Stripe' : c.type === 'supabase' ? 'Supabase' : c.type === 'sentry' ? 'Sentry' : c.type === 'github-actions' ? 'GitHub Actions' : c.type === 'posthog' ? 'PostHog' : c.type === 'betterstack' ? 'Better Stack' : c.type === 'vercel' ? 'Vercel' : 'Webhook'
            return (
              <li key={c.id} className="text-ink-muted">
                {label} — {st.headline.toLowerCase()}{activity ? ` · ${activity}` : ''}
              </li>
            )
          })}
          {(connectors?.length ?? 0) === 0 && <li className="text-ink-muted">Nothing yet — activity from your connectors will show here.</li>}
        </ul>
      </section>

      <Link to="/portfolio" className="order-7 text-link text-sm"><ArrowLeft size={14} className="mr-1 inline" aria-hidden="true" />Back to portfolio</Link>

      {deleteArmed && <ConfirmDialog title="Remove project?" body="This permanently removes the project, its data sources, metrics, and alert rules." confirmWord={p.name} confirmLabel="Remove forever" busy={deleteBusy} error={deleteError} onConfirm={() => void deleteProject()} onCancel={() => setDeleteArmed(false)} />}

      {toast && (
        <div
          role="status"
          className="fade-swap fixed bottom-6 left-1/2 z-50 flex w-[calc(100%-2rem)] max-w-sm -translate-x-1/2 items-center gap-3 rounded-2xl border border-line bg-elevated p-4 shadow-sm"
        >
          <span className="status-dot status-green shrink-0" aria-hidden="true" />
          <p className="font-inter text-sm font-medium">{toast}</p>
          <button
            className="rounded-lg px-2 py-1 font-inter text-lg leading-none text-ink-muted transition-colors duration-150 hover:bg-inset hover:text-ink"
            aria-label="Dismiss"
            onClick={() => setToast(null)}
          >
            <X size={18} aria-hidden="true" />
          </button>
        </div>
      )}
    </div>
  )
}
