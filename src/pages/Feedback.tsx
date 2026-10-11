import { useState } from 'react'
import { ArrowRight, CheckCircle2 } from 'lucide-react'
import SiteNav from '../components/SiteNav'
import SiteFooter from '../components/SiteFooter'
import { api } from '../lib/api'

/**
 * Public feedback form. POSTs to the API (stored in Postgres, reviewed via
 * SQL) — no account needed, rate-limited server-side.
 */
export default function Feedback() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [sent, setSent] = useState(false)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!message.trim()) {
      setError('Tell us what’s on your mind first — the message can’t be empty.')
      return
    }
    setError(null)
    setBusy(true)
    try {
      await api<{ ok: boolean }>('/v1/feedback', {
        method: 'POST',
        body: JSON.stringify({
          ...(name.trim() ? { name: name.trim().slice(0, 100) } : {}),
          ...(email.trim() ? { email: email.trim().slice(0, 254) } : {}),
          message: message.trim().slice(0, 2000),
        }),
      })
      setSent(true)
    } catch {
      setError('Couldn’t send that. Check your connection and try again — or open a GitHub issue instead.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="min-h-screen bg-canvas font-inter text-ink">
      <SiteNav />
      <main id="main-content" className="public-page">
        <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] lg:gap-14">
        <header className="max-w-xl">
          <p className="badge bg-surface">No account required</p>
        <h1 className="page-title">
          Help shape Stackduck.
        </h1>
        <p className="mt-4 text-body-lg leading-relaxed text-ink-secondary">
          Bugs, confusing copy, missing connectors — send it here. A human reads
          everything; the human is also the entire team.
        </p>
        <p className="mt-6 border-t border-line pt-5 text-sm leading-relaxed text-ink-muted">
          For anything urgent or trackable, use{' '}
          <a href="https://github.com/0x-Sigmoid/stackduck/issues" target="_blank" rel="noreferrer" className="text-link-emphasis text-link inline-flex items-center gap-1">
            GitHub Issues <ArrowRight size={13} aria-hidden="true" />
          </a>
          .
        </p>
        </header>

        <div className="card p-5 sm:p-7">
          {sent ? (
            <div role="status" className="py-8 text-center">
              <CheckCircle2 size={32} className="mx-auto text-mint-pulse" aria-hidden="true" />
              <p className="badge badge-success">Received</p>
              <h2 className="mt-3 font-inter text-xl font-semibold">Thanks for your feedback.</h2>
              <p className="mt-1 font-inter text-sm text-ink-muted">
                For anything urgent or trackable,{' '}
                <a
                  href="https://github.com/0x-Sigmoid/stackduck/issues"
                  target="_blank"
                  rel="noreferrer"
                  className="text-link-emphasis text-link"
                >
                  open a GitHub issue
                </a>{' '}
                instead so it can't get lost.
              </p>
              <button type="button" className="btn-ghost mt-5" onClick={() => { setSent(false); setName(''); setEmail(''); setMessage('') }}>
                Send another note
              </button>
            </div>
          ) : (
            <form onSubmit={(e) => void onSubmit(e)} className="flex flex-col gap-4">
              <div className="border-b border-line pb-4">
                <h2 className="font-inter text-subheading font-semibold">Send a note</h2>
                <p className="mt-1 text-sm text-ink-muted">We read every message. Replies go to the email you provide.</p>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="flex flex-col gap-1 text-sm font-medium">
                  Name <span className="font-normal text-ink-muted">(optional)</span>
                  <input
                    className="input"
                    value={name}
                    maxLength={100}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="What should we call you?"
                    autoComplete="name"
                  />
                </label>
                <label className="flex flex-col gap-1 text-sm font-medium">
                  Email <span className="font-normal text-ink-muted">(optional, for replies)</span>
                  <input
                    className="input"
                    type="email"
                    value={email}
                    maxLength={254}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    autoComplete="email"
                  />
                </label>
              </div>
              <label className="flex flex-col gap-1 text-sm font-medium">
                Message *
                <textarea
                  className="input"
                  rows={5}
                  required
                  maxLength={2000}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="What happened, what did you expect, where were you in the app…"
                />
              </label>
              {error && (
                <p role="alert" className="font-inter text-sm text-coral-emphasis">
                  {error}
                </p>
              )}
              <button className="btn-primary w-full sm:w-auto sm:self-start" type="submit" disabled={busy}>
                {busy ? 'Sending…' : 'Send feedback'}
              </button>
            </form>
          )}
        </div>
        </div>
      </main>
      <SiteFooter />
    </div>
  )
}
