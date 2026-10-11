import CopyButton from '../components/CopyButton'
import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { ArrowRight, Check } from 'lucide-react'
import { api, ApiError, connectErrorMessage } from '../lib/api'
import SaJsonUpload from '../components/SaJsonUpload'
import ConnectorPicker, { type ConnectableType } from '../components/ConnectorPicker'
import ExternalConnectorForm, { type ExternalConnectorType } from '../components/ExternalConnectorForm'
import type { CreatedProject, FirebaseConnectResult, StripeConnectResult, SupabaseConnectResult, WebhookConnectResult } from '../lib/contracts'
import type { Project } from '../types'

type Phase = 'create' | 'connect'

/** Name → Connect → Done. Done lights once a connector is attached. */
function FlowSteps({ phase, done }: { phase: Phase; done: boolean }) {
  const steps = ['Name', 'Connect', 'Done']
  const active = phase === 'create' ? 0 : done ? 2 : 1
  return (
    <ol className="flex w-full items-center gap-2" aria-label="Setup progress">
      {steps.map((label, i) => (
        <li key={label} className="flex items-center gap-2">
          <span
            aria-current={i === active ? 'step' : undefined}
            className={`flex h-8 w-8 items-center justify-center rounded-full font-inter text-xs font-semibold transition-colors duration-150 ${
              i < active ? 'bg-mint-pulse text-inkwell-navy' : i === active ? 'bg-primary text-on-primary' : 'bg-inset text-ink-muted'
            }`}
          >
            {i < active ? <Check size={14} strokeWidth={3} aria-hidden="true" /> : i + 1}
          </span>
          <span className={`font-inter text-sm font-medium ${i === active ? 'text-ink' : 'text-ink-muted'}`}>{label}</span>
          {i < steps.length - 1 && <span className={`mx-1 h-px min-w-4 flex-1 ${i < active ? 'bg-mint-pulse' : 'bg-line'}`} aria-hidden="true" />}
        </li>
      ))}
    </ol>
  )
}

/**
 * Add Project flow (per spec):
 * Step 1 — name only required, rest optional.
 * Step 2 — immediate optional connector prompt (Firebase / Webhook / do later).
 */
export default function AddProject() {
  const navigate = useNavigate()
  const [phase, setPhase] = useState<Phase>('create')
  const [project, setProject] = useState<Project | null>(null)

  // Step 1 fields
  const [name, setName] = useState('')
  const [showOptional, setShowOptional] = useState(false)
  const [description, setDescription] = useState('')
  const [stackTags, setStackTags] = useState('')
  const [repoUrl, setRepoUrl] = useState('')
  const [liveUrl, setLiveUrl] = useState('')
  const [environment, setEnvironment] = useState('')
  const [notes, setNotes] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  // Step 2 state
  const [connectorChoice, setConnectorChoice] = useState<ConnectableType | 'webhook' | null>(null)
  const [saJson, setSaJson] = useState('')
  const [stripeKey, setStripeKey] = useState('')
  const [stripeWhSecret, setStripeWhSecret] = useState('')
  const [supabaseUrl, setSupabaseUrl] = useState('')
  const [supabaseKey, setSupabaseKey] = useState('')
  const [step2Error, setStep2Error] = useState<string | null>(null)
  const [step2Busy, setStep2Busy] = useState(false)
  const [webhookResult, setWebhookResult] = useState<WebhookConnectResult | null>(null)
  const [stripeResult, setStripeResult] = useState<StripeConnectResult | null>(null)

  async function onCreate(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setBusy(true)
    try {
      const body: Record<string, unknown> = { name: name.trim() }
      if (description.trim()) body.description = description.trim()
      if (stackTags.trim()) body.stackTags = stackTags.split(',').map((t) => t.trim()).filter(Boolean)
      if (repoUrl.trim()) body.repoUrl = repoUrl.trim()
      if (liveUrl.trim()) body.liveUrl = liveUrl.trim()
      if (environment) body.environment = environment
      if (notes.trim()) body.notes = notes.trim()
      const res = await api<CreatedProject>('/v1/projects', { method: 'POST', body: JSON.stringify(body) })
      setProject(res.project)
      setPhase('connect')
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not create project.')
    } finally {
      setBusy(false)
    }
  }

  async function connectFirebase() {
    setStep2Error(null)
    setStep2Busy(true)
    try {
      const parsed = JSON.parse(saJson) as unknown
      const res = await api<FirebaseConnectResult>(`/v1/projects/${project!.id}/connectors/firebase`, {
        method: 'POST',
        body: JSON.stringify({ serviceAccountJson: parsed }),
      })
      if (!res.healthCheck.ok) {
        setStep2Error(`Connected with a warning: ${res.healthCheck.detail}`)
        return
      }
      sessionStorage.setItem('stackduck:just-connected', 'Firebase')
      navigate(`/projects/${project!.id}`)
    } catch (err) {
      setStep2Error(connectErrorMessage(err))
    } finally {
      setStep2Busy(false)
    }
  }

  async function connectStripe() {
    setStep2Error(null)
    setStep2Busy(true)
    try {
      const res = await api<StripeConnectResult>(`/v1/projects/${project!.id}/connectors/stripe`, {
        method: 'POST',
        body: JSON.stringify({
          apiKey: stripeKey.trim(),
          ...(stripeWhSecret.trim() ? { webhookSecret: stripeWhSecret.trim() } : {}),
        }),
      })
      setStripeResult(res)
      if (!res.healthCheck.ok) {
        setStep2Error(`Saved but unhealthy: ${res.healthCheck.detail}`)
      }
    } catch (err) {
      setStep2Error(connectErrorMessage(err))
    } finally {
      setStep2Busy(false)
    }
  }

  async function connectSupabase() {
    setStep2Error(null)
    setStep2Busy(true)
    try {
      const res = await api<SupabaseConnectResult>(`/v1/projects/${project!.id}/connectors/supabase`, {
        method: 'POST',
        body: JSON.stringify({ url: supabaseUrl.trim(), serviceKey: supabaseKey.trim() }),
      })
      if (!res.healthCheck.ok) {
        setStep2Error(`Saved but unhealthy: ${res.healthCheck.detail}`)
        return
      }
      sessionStorage.setItem('stackduck:just-connected', 'Supabase')
      navigate(`/projects/${project!.id}`)
    } catch (err) {
      setStep2Error(connectErrorMessage(err))
    } finally {
      setStep2Busy(false)
    }
  }

  async function connectWebhook() {
    setStep2Error(null)
    setStep2Busy(true)
    try {
      const res = await api<WebhookConnectResult>(`/v1/projects/${project!.id}/connectors/generic-webhook`, {
        method: 'POST',
        body: JSON.stringify({}),
      })
      setWebhookResult(res)
    } catch (err) {
      setStep2Error(connectErrorMessage(err))
    } finally {
      setStep2Busy(false)
    }
  }

  async function connectExternal(type: ExternalConnectorType, data: Record<string, string>) {
    setStep2Error(null)
    setStep2Busy(true)
    try {
      const res = await api<{ healthCheck: { ok: boolean; detail: string } }>(
        `/v1/projects/${project!.id}/connectors/${type}`,
        { method: 'POST', body: JSON.stringify(data) },
      )
      if (!res.healthCheck.ok) {
        setStep2Error(`Saved but unhealthy: ${res.healthCheck.detail}`)
        return
      }
      sessionStorage.setItem('stackduck:just-connected', type === 'github-actions' ? 'GitHub Actions' : type === 'posthog' ? 'PostHog' : type === 'betterstack' ? 'Better Stack' : type === 'vercel' ? 'Vercel' : 'Sentry')
      navigate(`/projects/${project!.id}`)
    } catch (err) {
      setStep2Error(connectErrorMessage(err))
    } finally {
      setStep2Busy(false)
    }
  }

  if (phase === 'connect' && project) {
    const done = !!webhookResult || !!stripeResult
    return (
      <div className="mx-auto mt-8 max-w-2xl"><Link to="/portfolio" className="text-link mb-5 inline-flex min-h-11 items-center text-sm">Back to portfolio</Link>
        <FlowSteps phase={phase} done={done} />
        <div className="card mt-4">
          <p className="badge badge-success">Project created</p>
          <h1 className="workspace-title">Want to connect live data?</h1>
          <p className="mt-1 text-sm text-ink-muted">
            {project.name} is ready. Connect a source now, or open the project and add one later.{' '}
            <Link to="/docs/connect" className="text-link-emphasis text-link">Where do the credentials come from? <ArrowRight size={14} className="ml-1 inline" aria-hidden="true" /></Link>
          </p>


          {!connectorChoice && !webhookResult && !stripeResult && (
            <div className="mt-6">
              <ConnectorPicker
                connectedTypes={[]}
                onSelect={(type: ConnectableType) => {
                  const choice = type === 'generic-webhook' ? 'webhook' : type
                  setConnectorChoice(choice)
                  if (type === 'generic-webhook') void connectWebhook()
                }}
              />
            </div>
          )}

          {connectorChoice === 'firebase' && (
            <div className="mt-6">
              <SaJsonUpload
                disabled={step2Busy}
                onInvalid={(m) => setStep2Error(m)}
                onLoaded={(text) => {
                  setSaJson(text)
                  if (text) setStep2Error(null)
                }}
              />
              <details className="mt-3 rounded-lg bg-inset p-3 text-sm">
                <summary className="cursor-pointer font-medium text-ink">What is this?</summary>
                <p className="mt-2 text-ink-muted">
                  A service account lets Stackduck access your project. Its permissions depend on the roles you grant. Use Authentication Viewer and Logs Viewer as described in the{' '}
                  <Link to="/docs/connect/firebase" className="text-link-emphasis text-link">
                    step-by-step guide <ArrowRight size={14} className="ml-1 inline" aria-hidden="true" />
                  </Link>
                </p>
              </details>
              <label className="mt-3 flex flex-col gap-1 text-sm font-medium">
                Service-account JSON (read-only roles recommended){' '}
                <Link to="/docs/connect/firebase" className="text-link-emphasis text-link font-normal">
                  Where do I find this? <ArrowRight size={14} className="ml-1 inline" aria-hidden="true" />
                </Link>
                <textarea
                  className="input font-mono text-xs"
                  rows={8}
                  placeholder='Paste the full service-account JSON file…'
                  value={saJson}
                  onChange={(e) => setSaJson(e.target.value)}
                />
              </label>
              {step2Error && <p role="alert" className="mt-2 text-sm text-coral-emphasis">{step2Error}</p>}
              <div className="mt-4 flex gap-3">
                <button className="btn-primary" disabled={step2Busy || !saJson.trim()} onClick={() => void connectFirebase()}>
                  {step2Busy ? 'Checking…' : 'Connect + run health check'}
                </button>
                <button className="btn-ghost" onClick={() => setConnectorChoice(null)}>Back</button>
              </div>
            </div>
          )}

          {connectorChoice === 'stripe' && !stripeResult && (
            <div className="mt-6 flex flex-col gap-4">
              <p className="text-sm text-ink-muted">
                A restricted key can only read — it can't move money or change anything.
                Paste it from your Stripe dashboard
                (Developers → API keys → Create restricted key with <strong>read</strong> access
                to charges, balance, and payouts).{' '}
                <Link to="/docs/connect/stripe" className="text-link-emphasis text-link">Where do I find this? <ArrowRight size={14} className="ml-1 inline" aria-hidden="true" /></Link>
              </p>
              <label className="flex flex-col gap-1 text-sm font-medium">
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
              <label className="flex flex-col gap-1 text-sm font-medium">
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
              {step2Error && <p role="alert" className="text-sm text-coral-emphasis">{step2Error}</p>}
              <div className="flex gap-3">
                <button className="btn-primary" disabled={step2Busy || !stripeKey.trim()} onClick={() => void connectStripe()}>
                  {step2Busy ? 'Checking…' : 'Connect + run health check'}
                </button>
                <button className="btn-ghost" onClick={() => setConnectorChoice(null)}>Back</button>
              </div>
            </div>
          )}

          {stripeResult && (
            <div className="mt-6">
              <div className="rounded-lg bg-inset p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">Stripe webhook endpoint</p>
                <code className="mt-1 block break-all text-sm">{stripeResult.stripeEndpoint}</code>
                <CopyButton value={stripeResult.stripeEndpoint} label="Copy endpoint" />
                <p className="mt-3 text-sm text-ink-muted">
                  Register this URL under <strong>Stripe dashboard → Developers → Webhooks</strong> (listen
                  to charges + payouts) and paste that endpoint's signing secret when connecting — or leave
                  it out and Stackduck reconciles nightly totals instead.
                </p>
              </div>
              {step2Error && <p role="alert" className="mt-2 text-sm text-coral-emphasis">{step2Error}</p>}
            </div>
          )}

          {connectorChoice === 'supabase' && (
            <div className="mt-6 flex flex-col gap-4">
              <div className="rounded-lg bg-butter-yellow p-3 text-sm font-medium text-inkwell-navy">
                Use the <strong>service_role</strong> secret — never the anon key. Think of it
                as a master key for your database: powerful, so keep it private. If it was ever
                committed anywhere, reset it in Supabase first. <Link to="/docs/connect/supabase" className="text-link-emphasis text-link">Where do I find this? <ArrowRight size={14} className="ml-1 inline" aria-hidden="true" /></Link>
              </div>
              <label className="flex flex-col gap-1 text-sm font-medium">
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
              <label className="flex flex-col gap-1 text-sm font-medium">
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
              {step2Error && <p role="alert" className="text-sm text-coral-emphasis">{step2Error}</p>}
              <div className="flex gap-3">
                <button className="btn-primary" disabled={step2Busy || !supabaseUrl.trim() || !supabaseKey.trim()} onClick={() => void connectSupabase()}>
                  {step2Busy ? 'Checking…' : 'Connect + run health check'}
                </button>
                <button className="btn-ghost" onClick={() => setConnectorChoice(null)}>Back</button>
              </div>
            </div>
          )}

          {(connectorChoice === 'sentry' || connectorChoice === 'github-actions' || connectorChoice === 'posthog' || connectorChoice === 'betterstack' || connectorChoice === 'vercel') && (
            <div className="mt-6">
              <ExternalConnectorForm
                type={connectorChoice}
                repoUrl={project.repoUrl}
                liveUrl={project.liveUrl}
                busy={step2Busy}
                error={step2Error}
                onConnect={(data) => void connectExternal(connectorChoice, data)}
                onCancel={() => { setConnectorChoice(null); setStep2Error(null) }}
              />
            </div>
          )}

          {(connectorChoice === 'webhook' || webhookResult) && (
            <div className="mt-6">
              {step2Busy && !webhookResult && <p className="text-sm text-ink-muted">Generating ingest URL…</p>}
              {webhookResult && (
                <>
                  <div className="rounded-lg bg-inset p-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">Ingest URL</p>
                    <code className="mt-1 block break-all text-sm">{webhookResult.ingestUrl}</code>
                    <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-ink-muted">Signing secret — shown once</p>
                    <code className="mt-1 block break-all text-sm">{webhookResult.signingSecret}</code>
                    <CopyButton value={webhookResult.signingSecret} label="Copy secret" className="mt-2" />
                  </div>
                  <pre className="mt-3 overflow-x-auto rounded-lg bg-inkwell-navy p-4 text-xs text-paper-white">
                    {webhookResult.snippet.node}
                  </pre>
                  <p className="mt-2 text-sm text-ink-muted">
                    If you're not comfortable with this step, this connector needs a developer
                    to set up — the other options don't. Status is <span className="badge">Waiting for first update</span> until
                    the first verified event arrives — then it switches on by itself.{' '}
                    <Link to="/docs/connect/webhook" className="text-link-emphasis text-link">How to sign events <ArrowRight size={14} className="ml-1 inline" aria-hidden="true" /></Link>
                  </p>
                </>
              )}
              {step2Error && <p role="alert" className="mt-2 text-sm text-coral-emphasis">{step2Error}</p>}
            </div>
          )}

          <div className="mt-6 border-t border-line pt-4">
            <Link to={project ? `/projects/${project.id}` : '/'} className="btn-primary">
              {done ? 'Open project' : 'Connect later — open project'} <ArrowRight size={14} className="ml-1 inline" aria-hidden="true" />
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto mt-8 max-w-xl"><Link to="/portfolio" className="text-link mb-5 inline-flex min-h-11 items-center text-sm">Back to portfolio</Link>
      <FlowSteps phase={phase} done={false} />
      <div className="card mt-5">
        <p className="font-inter text-xs font-semibold uppercase text-ink-muted">Step 1 of 3 · Catalog</p>
        <h1 className="workspace-title">Add a project</h1>
        <p className="mt-1 text-sm text-ink-muted">Only the name is required. Everything else can be filled in later.</p>
        <form onSubmit={(e) => void onCreate(e)} className="mt-6 flex flex-col gap-4">
          <label className="flex flex-col gap-1 text-sm font-medium">
            Name *
            <input className="input" required value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Tabmeet" />
          </label>
          <button type="button" aria-expanded={showOptional} className="text-link self-start text-sm" onClick={() => setShowOptional((s) => !s)}>
            {showOptional ? 'Hide optional fields −' : 'Add details (optional) +'}
          </button>
          {showOptional && (
            <>
              <label className="flex flex-col gap-1 text-sm font-medium">
                Description
                <input className="input" value={description} onChange={(e) => setDescription(e.target.value)} />
              </label>
              <label className="flex flex-col gap-1 text-sm font-medium">
                Stack tags (comma-separated)
                <input className="input" value={stackTags} onChange={(e) => setStackTags(e.target.value)} placeholder="firebase, react, typescript" />
              </label>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="flex flex-col gap-1 text-sm font-medium">
                  Repo URL
                  <input className="input" value={repoUrl} onChange={(e) => setRepoUrl(e.target.value)} />
                </label>
                <label className="flex flex-col gap-1 text-sm font-medium">
                  Live URL
                  <input className="input" value={liveUrl} onChange={(e) => setLiveUrl(e.target.value)} />
                </label>
              </div>
              <label className="flex flex-col gap-1 text-sm font-medium">
                Environment
                <select className="input" value={environment} onChange={(e) => setEnvironment(e.target.value)}>
                  <option value="">—</option>
                  <option value="production">production</option>
                  <option value="staging">staging</option>
                  <option value="development">development</option>
                </select>
              </label>
              <label className="flex flex-col gap-1 text-sm font-medium">
                Notes
                <textarea className="input" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
              </label>
            </>
          )}
          {error && <p role="alert" className="text-sm text-coral-emphasis">{error}</p>}
          <button className="btn-primary" type="submit" disabled={busy || !name.trim()}>
            {busy ? 'Creating…' : 'Create project'}
          </button>
          <p className="text-sm text-ink-muted">
            Not sure what to connect? <Link to="/docs/connect" className="text-link-emphasis text-link">How connecting works <ArrowRight size={14} className="ml-1 inline" aria-hidden="true" /></Link>
          </p>
        </form>
      </div>
    </div>
  )
}
