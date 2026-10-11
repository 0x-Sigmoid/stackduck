import ConfirmDialog from '../components/ConfirmDialog'
﻿import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../lib/api'
import { setSessionUser, signOut, type BackendUser } from '../lib/session'
import { useAuthUser } from '../lib/useAuthUser'
import { DEFAULT_PREFS, coercePrefs, saveUserPrefs, type UserPrefs } from '../lib/prefs'
import UserAvatar from '../components/UserAvatar'

function Section({
  title,
  blurb,
  children,
}: {
  title: string
  blurb: string
  children: React.ReactNode
}) {
  return (
    <section className="settings-section" aria-label={title}><div>
      <h2 className="font-inter text-lg font-semibold text-ink">{title}</h2>
      <p className="mt-1 font-inter text-sm font-normal text-ink-muted">{blurb}</p>
      </div><div className="min-w-0">{children}</div>
    </section>
  )
}

function Toggle({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string
  hint: string
  checked: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="flex w-full items-center justify-between gap-4 rounded-lg px-1 py-2 text-left focus-visible:outline-2 focus-visible:outline-ring"
    >
      <span>
        <span className="block font-inter text-sm font-medium text-ink">{label}</span>
        <span className="block font-inter text-xs font-normal text-ink-muted">{hint}</span>
      </span>
      <span
        aria-hidden="true"
        className={`relative h-6 w-11 shrink-0 rounded-full transition-colors duration-150 ${
          checked ? 'bg-primary' : 'bg-line'
        }`}
      >
        <span
          className={`absolute top-0.5 h-5 w-5 rounded-full bg-on-primary shadow-subtle transition-transform duration-150 ${
            checked ? 'translate-x-[22px]' : 'translate-x-0.5'
          }`}
        />
      </span>
    </button>
  )
}

function fmtDate(iso: string | undefined): string {
  if (!iso) return '—'
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
}

const PROVIDER_LABEL: Record<string, string> = {
  google: 'Google',
  github: 'GitHub',
  password: 'Email & password',
}


/**
 * Account settings (auth-gated): profile, persisted preferences, security
 * overview, and a danger zone. Profile + preferences live on the backend
 * user row (PATCH /v1/auth/me).
 */
export default function Account() {
  const user = useAuthUser()
  const navigate = useNavigate()

  const [name, setName] = useState('')
  const [photoUrl, setPhotoUrl] = useState('')
  const [profileMsg, setProfileMsg] = useState<string | null>(null)
  const [savingProfile, setSavingProfile] = useState(false)

  const [prefs, setPrefs] = useState<UserPrefs>(DEFAULT_PREFS)
  const [prefsLoaded, setPrefsLoaded] = useState(false)
  const [prefsMsg, setPrefsMsg] = useState<string | null>(null)
  const [savingPrefs, setSavingPrefs] = useState(false)

  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [dangerError, setDangerError] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [profileError, setProfileError] = useState(false)
  const [prefsError, setPrefsError] = useState(false)

  useEffect(() => {
    if (!user) return
    setName(user.displayName ?? '')
    setPhotoUrl(user.photoUrl ?? '')
    setPrefs(coercePrefs(user.prefs))
    setPrefsLoaded(true)
  }, [user])

  if (user === undefined) return <p className="p-8 text-ink-muted">Loading…</p>
  if (user === null) return null // RequireAuth owns the redirect

  async function saveProfile(u: BackendUser) {
    void u
    setSavingProfile(true)
    setProfileMsg(null)
    setProfileError(false)
    try {
      const result = await api<{ user: BackendUser }>('/v1/auth/me', {
        method: 'PATCH',
        body: JSON.stringify({
          displayName: name.trim() || null,
          photoUrl: photoUrl.trim() || null,
        }),
      })
      setSessionUser(result.user)
      setProfileMsg('Profile updated.')
    } catch {
      setProfileError(true)
      setProfileMsg('Couldn’t save your profile. Try again.')
    } finally {
      setSavingProfile(false)
    }
  }

  async function savePrefs() {
    setSavingPrefs(true)
    setPrefsMsg(null)
    setPrefsError(false)
    try {
      const saved = await saveUserPrefs(prefs)
      setPrefs(saved)
      setSessionUser({ ...user!, prefs: saved })
      setPrefsMsg('Preferences saved.')
    } catch {
      setPrefsError(true)
      setPrefsMsg('Couldn’t save preferences. Check your connection and try again.')
    } finally {
      setSavingPrefs(false)
    }
  }

  async function handleDelete() {
    setDangerError(null)
    setDeleting(true)
    try {
      await api<{ ok: boolean }>(`/v1/auth/me`, { method: 'DELETE' })
      await signOut()
      navigate('/')
    } catch {
      setDangerError('Couldn’t delete your account. Try again, or contact support.')
    } finally { setDeleting(false) }
  }


  return (
    <div className="workspace-page">
      <h1 className="workspace-title">Account settings</h1>
      <p className="mt-2 font-inter text-sm font-normal text-ink-muted">
        Manage your profile, preferences, and sign-in security.
      </p>

      <div className="mt-8 flex flex-col gap-6">
        <Section title="Profile" blurb="How you appear across Stackduck. Your email comes from your sign-in provider and can’t be changed here.">
          <div className="flex items-center gap-4">
            <UserAvatar user={{ displayName: name, email: user.email, photoUrl }} size={56} />
            <div className="min-w-0">
              <p className="truncate font-inter text-sm font-medium text-ink">{user.email}</p>
              <p className="font-inter text-xs font-normal text-ink-muted">
                Member since {fmtDate(user.createdAt)}
              </p>
            </div>
          </div>
          <form
            className="mt-5 flex flex-col gap-4"
            onSubmit={(e) => {
              e.preventDefault()
              void saveProfile(user)
            }}
          >
            <label className="block">
              <span className="mb-1 block font-inter text-sm font-medium text-ink">Display name</span>
              <input
                className="input"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={80}
                placeholder="Ada Lovelace"
                autoComplete="name"
              />
            </label>
            <label className="block">
              <span className="mb-1 block font-inter text-sm font-medium text-ink">Avatar photo URL</span>
              <input
                className="input"
                type="url"
                value={photoUrl}
                onChange={(e) => setPhotoUrl(e.target.value)}
                placeholder="https://…"
              />
              <span className="mt-1 block font-inter text-xs font-normal text-ink-muted">
                Paste a link to a square image. Leave empty to use your initials.
              </span>
            </label>
            <div className="flex items-center gap-3">
              <button type="submit" className="btn-primary" disabled={savingProfile}>
                {savingProfile ? 'Saving…' : 'Save profile'}
              </button>
              {profileMsg && (
                <p className={profileError ? 'text-sm text-coral-emphasis' : 'text-sm text-ink-muted'} role={profileError ? 'alert' : 'status'}>
                  {profileMsg}
                </p>
              )}
            </div>
          </form>
        </Section>


        <Section title="Preferences" blurb="Defaults for your portfolio and the emails we send you.">
          {!prefsLoaded ? (
            <div className="flex flex-col gap-3" aria-hidden="true">
              <div className="skeleton h-8 w-full" />
              <div className="skeleton h-8 w-2/3" />
              <div className="skeleton h-8 w-1/2" />
            </div>
          ) : (
            <form
              className="flex flex-col gap-4"
              onSubmit={(e) => {
                e.preventDefault()
                void savePrefs()
              }}
            >
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block">
                  <span className="mb-1 block font-inter text-sm font-medium text-ink">
                    Default metrics window
                  </span>
                  <select
                    className="input"
                    value={prefs.defaultWindowDays}
                    onChange={(e) =>
                      setPrefs((p) => ({ ...p, defaultWindowDays: Number(e.target.value) as UserPrefs['defaultWindowDays'] }))
                    }
                  >
                    <option value={7}>Last 7 days</option>
                    <option value={30}>Last 30 days</option>
                    <option value={90}>Last 90 days</option>
                  </select>
                </label>
                <label className="block">
                  <span className="mb-1 block font-inter text-sm font-medium text-ink">
                    Portfolio sort order
                  </span>
                  <select
                    className="input"
                    value={prefs.portfolioSort}
                    onChange={(e) => setPrefs((p) => ({ ...p, portfolioSort: e.target.value as UserPrefs['portfolioSort'] }))}
                  >
                    <option value="updated">Recently updated</option>
                    <option value="name">Name (A–Z)</option>
                  </select>
                </label>
              </div>
              <fieldset>
                <legend className="sr-only">Email notifications</legend>
                <Toggle
                  label="Product updates"
                  hint="Occasional announcements about new Stackduck features."
                  checked={prefs.emailProductUpdates}
                  onChange={(v) => setPrefs((p) => ({ ...p, emailProductUpdates: v }))}
                />
                <Toggle
                  label="Weekly digest"
                  hint="A once-a-week summary of your projects’ key metrics."
                  checked={prefs.emailWeeklyDigest}
                  onChange={(v) => setPrefs((p) => ({ ...p, emailWeeklyDigest: v }))}
                />
              </fieldset>
              <div className="flex items-center gap-3">
                <button type="submit" className="btn-primary" disabled={savingPrefs}>
                  {savingPrefs ? 'Saving…' : 'Save preferences'}
                </button>
                {prefsMsg && (
                  <p className={prefsError ? 'text-sm text-coral-emphasis' : 'text-sm text-ink-muted'} role={prefsError ? 'alert' : 'status'}>
                    {prefsMsg}
                  </p>
                )}
              </div>
            </form>
          )}
        </Section>

        <Section title="Security" blurb="How you sign in and when your account was created.">
          <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
            <div>
              <dt className="font-inter text-xs font-medium uppercase tracking-wide text-ink-muted">Sign-in methods</dt>
              <dd className="mt-1 flex flex-wrap gap-2">
                {user.providers.map((p) => (
                  <span key={p} className="badge">
                    {PROVIDER_LABEL[p] ?? p}
                  </span>
                ))}
              </dd>
            </div>
            <div>
              <dt className="font-inter text-xs font-medium uppercase tracking-wide text-ink-muted">Member since</dt>
              <dd className="mt-1 font-inter text-sm font-normal text-ink">
                {fmtDate(user.createdAt)}
              </dd>
            </div>
          </dl>
          <button
            type="button"
            className="btn-ghost mt-5"
            onClick={() => void signOut().then(() => navigate('/'))}
          >
            Sign out
          </button>
        </Section>

        <section className="rounded-xl border border-line bg-surface p-5 sm:p-6" aria-label="Danger zone">
          <h2 className="font-inter text-lg font-semibold text-ink">Danger zone</h2>
          <p className="mt-1 font-inter text-sm font-normal text-ink-muted">
            Deleting your account removes your sign-in immediately, along with your
            projects, connectors, metrics, and alert rules.{' '}
            <a href="/privacy" className="text-link text-link-emphasis">
              privacy policy
            </a>
            .
          </p>
          <div className="mt-5">
            <button type="button" className="btn-ghost text-coral-emphasis" onClick={() => { setDangerError(null); setConfirmingDelete(true) }}>Delete account…</button>

          </div>
        </section>
      </div>
      {confirmingDelete && <ConfirmDialog title="Delete your account?" body="This permanently removes your account, projects, connectors, metrics, and alert rules." confirmWord="DELETE" confirmLabel="Delete account" busy={deleting} error={dangerError} onCancel={() => setConfirmingDelete(false)} onConfirm={() => void handleDelete()} />}
    </div>
  )
}
