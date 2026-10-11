import { useState } from 'react'
import { Link } from 'react-router-dom'
import { openPortal } from '../lib/billing'
import { useAuthUser } from '../lib/useAuthUser'
import PortfolioCta from '../components/PortfolioCta'

export default function BillingSuccess() {
  const user = useAuthUser()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  async function manage() {
    setBusy(true); setError(null)
    try { await openPortal() } catch (err) { setError(err instanceof Error ? err.message : 'Couldn’t open billing. Try again.') } finally { setBusy(false) }
  }
  return <div className="utility-panel">
    <p className="text-xs font-semibold uppercase tracking-wider text-ink-muted">Billing</p>
    <h1 className="workspace-title">Check your subscription</h1>
    <p className="mt-3 text-sm leading-relaxed text-ink-muted">If you completed checkout, your payment and subscription details are available in the billing portal. Updates may take a moment to arrive.</p>
    <div className="mt-6 flex flex-wrap justify-center gap-3"><PortfolioCta />{user && <button className="btn-ghost" disabled={busy} onClick={() => void manage()}>{busy ? 'Opening…' : 'Manage billing'}</button>}</div>
    {error && <p role="alert" className="mt-4 text-sm text-coral-emphasis">{error}</p>}
    <Link to="/pricing" className="text-link mt-5 inline-flex min-h-11 items-center text-sm">Back to pricing</Link>
  </div>
}
