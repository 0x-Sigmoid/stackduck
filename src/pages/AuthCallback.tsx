import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { flagImportPromptIfNew } from '../lib/oauth'
import { adoptTokens } from '../lib/session'

export default function AuthCallback() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    const access = params.get('accessToken'), refresh = params.get('refreshToken')
    if (!access || !refresh) { setError('That sign-in didn’t complete. Try again.'); return }
    window.history.replaceState({}, '', '/auth/callback')
    void adoptTokens(access, refresh).then(async user => {
      if (!user) { setError('That sign-in didn’t complete. Try again.'); return }
      for (const provider of user.providers) if (provider === 'google' || provider === 'github') await flagImportPromptIfNew(provider)
      navigate('/portfolio', { replace: true })
    }).catch(() => setError('That sign-in didn’t complete. Try again.'))
  }, []) // Callback tokens are consumed once and cleared from browser history.
  return <main id="main-content" className="public-page"><div className="utility-panel">
    <h1 className="workspace-title">{error ? 'Sign-in needs another try' : 'Finishing sign-in…'}</h1>
    <p role={error ? 'alert' : 'status'} className={`mt-3 text-sm ${error ? 'text-coral-emphasis' : 'text-ink-muted'}`}>{error ?? 'Your portfolio will open when your session is ready.'}</p>
    {error && <button className="btn-primary mt-6" onClick={() => navigate('/signin', { replace: true })}>Back to sign in</button>}
  </div></main>
}
