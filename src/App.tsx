import { useEffect } from 'react'
import { BrowserRouter, Routes, Route, Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuthUser } from './lib/useAuthUser'
import type { BackendUser } from './lib/session'
import SignIn from './pages/SignIn'
import AuthCallback from './pages/AuthCallback'
import PortfolioHome from './pages/PortfolioHome'
import AddProject from './pages/AddProject'
import ProjectDetail from './pages/ProjectDetail'
import Privacy from './pages/Privacy'
import Terms from './pages/Terms'
import Landing from './pages/Landing'
import Logo from './components/Logo'
import About from './pages/About'
import Docs from './pages/Docs'
import ConnectGuide from './pages/ConnectGuide'
import ConnectFirebase from './pages/ConnectFirebase'
import ConnectWebhook from './pages/ConnectWebhook'
import ConnectStripe from './pages/ConnectStripe'
import ConnectSupabase from './pages/ConnectSupabase'
import Pricing from './pages/Pricing'
import Changelog from './pages/Changelog'
import License from './pages/License'
import Security from './pages/Security'
import Support from './pages/Support'
import Feedback from './pages/Feedback'
import BillingSuccess from './pages/BillingSuccess'
import Account from './pages/Account'
import NotFound from './pages/NotFound'
import UserMenu from './components/UserMenu'
import ThemeSwitcher from './components/ThemeSwitcher'
import LogoStudies from './pages/LogoStudies'
import { LayoutDashboard } from 'lucide-react'

const MARKETING_PATHS = ['/', '/about', '/docs', '/pricing', '/support', '/feedback', '/changelog', '/license', '/privacy', '/terms', '/security', '/logo-studies']

/** Marketing + docs pages own their chrome — match exact or nested paths. */
function isMarketing(pathname: string): boolean {
  return MARKETING_PATHS.includes(pathname) || pathname.startsWith('/docs/') || !(['/portfolio', '/account', '/billing/success', '/signin', '/auth/callback'].includes(pathname) || /^\/projects\/[^/]+$/.test(pathname))
}

function Header({ user }: { user: BackendUser | null }) {
  const { pathname } = useLocation()
  // Marketing pages bring their own nav — app chrome stays off them.
  if (isMarketing(pathname) || pathname === '/signin' || pathname === '/auth/callback') return null
  return (
    <header className="sticky top-0 z-40 border-b border-line bg-canvas/95 backdrop-blur-sm">
      <div className="mx-auto flex max-w-[var(--page-max-width)] items-center justify-between gap-4 px-5 py-3 sm:px-6">
        <Logo />
        {user && (
          <nav aria-label="Workspace" className="hidden items-center gap-1 sm:flex">
            <Link to="/portfolio" aria-current={pathname === '/portfolio' ? 'page' : undefined} className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 font-inter text-sm font-medium transition-colors ${pathname === '/portfolio' ? 'bg-inset text-ink' : 'text-ink-muted hover:bg-inset hover:text-ink'}`}>
              <LayoutDashboard size={16} aria-hidden="true" />Portfolio
            </Link>
            <Link to="/docs" className="rounded-lg px-3 py-2 font-inter text-sm font-medium text-ink-muted transition-colors hover:bg-inset hover:text-ink">Guides</Link>
          </nav>
        )}
        <div className="flex items-center gap-2 sm:gap-3">
          {user ? (
            <>
              <a
                href="https://github.com/0x-Sigmoid/stackduck"
                target="_blank"
                rel="noreferrer"
                aria-label="Stackduck on GitHub"
                title="Stackduck on GitHub"
                className="hidden rounded-lg border border-line p-2 text-ink transition-colors duration-150 hover:border-line-strong hover:bg-surface sm:block"
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true" className="block">
                  <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82a7.6 7.6 0 0 1 2-.27c.68 0 1.36.09 2 .27 1.53-1.03 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.28.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8z" />
                </svg>
              </a>
              <ThemeSwitcher />
              <UserMenu user={user} />
            </>
          ) : (
            <>
              <ThemeSwitcher />
              <Link to="/signin" className="btn-ghost">
                Sign in
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  )
}

import { PageFade } from './components/Reveal'

function RouteFocus() {
  const { pathname, hash } = useLocation()
  useEffect(() => {
    if (hash) {
      let id = hash.slice(1)
      try { id = decodeURIComponent(id) } catch { /* Keep an invalid fragment harmless. */ }
      document.getElementById(id)?.scrollIntoView()
      return
    }
    window.scrollTo(0, 0)
    const main = document.querySelector<HTMLElement>('main')
    main?.setAttribute('tabindex', '-1')
    main?.focus({ preventScroll: true })
  }, [pathname, hash])
  return null
}

function Shell({ children }: { children: React.ReactNode }) {
  const { pathname } = useLocation()
  if (pathname === '/signin' || pathname === '/auth/callback') {
    return <PageFade routeKey={pathname}>{children}</PageFade>
  }
  // Marketing pages own their full layout (incl. <main>) — don't nest landmarks.
  if (isMarketing(pathname)) {
    return <PageFade routeKey={pathname}>{children}</PageFade>
  }
  return (
    <main id="main-content" className="mx-auto max-w-[var(--page-max-width)] px-5 pb-20 sm:px-6">
      <PageFade routeKey={pathname}>{children}</PageFade>
    </main>
  )
}

function RequireAuth({ user, children }: { user: BackendUser | null | undefined; children: React.JSX.Element }) {
  const navigate = useNavigate()
  useEffect(() => {
    if (user === null) navigate('/signin')
  }, [user, navigate])
  if (user === undefined) return <div role="status" className="workspace-page"><span className="sr-only">Loading your workspace…</span><div className="skeleton h-9 w-48" aria-hidden="true" /><div className="skeleton mt-6 h-64 w-full" aria-hidden="true" /></div>
  if (user === null) return null
  return children
}

export default function App() {
  const user = useAuthUser()

  return (
    <BrowserRouter>
      <RouteFocus />
      <a href="#main-content" className="skip-link" onClick={event => { event.preventDefault(); const main = document.querySelector<HTMLElement>('main'); main?.setAttribute('tabindex', '-1'); main?.focus(); main?.scrollIntoView() }}>Skip to content</a>
      <div className="min-h-screen bg-canvas font-inter text-ink">
        <Header user={user ?? null} />
        <Shell>
          <Routes>
            <Route path="/signin" element={<SignIn />} />
            <Route path="/auth/callback" element={<AuthCallback />} />
            <Route path="/logo-studies" element={<LogoStudies />} />
            <Route path="/privacy" element={<Privacy />} />
            <Route path="/terms" element={<Terms />} />
            <Route path="/about" element={<About />} />
            <Route path="/docs" element={<Docs />} />
            <Route path="/docs/connect" element={<ConnectGuide />} />
            <Route path="/docs/connect/firebase" element={<ConnectFirebase />} />
            <Route path="/docs/connect/webhook" element={<ConnectWebhook />} />
            <Route path="/docs/connect/stripe" element={<ConnectStripe />} />
            <Route path="/docs/connect/supabase" element={<ConnectSupabase />} />
            <Route path="/pricing" element={<Pricing />} />
            <Route path="/support" element={<Support />} />
            <Route path="/feedback" element={<Feedback />} />
            <Route path="/billing/success" element={<BillingSuccess />} />
            <Route path="/changelog" element={<Changelog />} />
            <Route path="/license" element={<License />} />
            <Route path="/security" element={<Security />} />
            <Route path="/" element={<Landing />} />
            <Route
              path="/portfolio"
              element={
                <RequireAuth user={user}>
                  <PortfolioHome />
                </RequireAuth>
              }
            />
            <Route
              path="/projects/new"
              element={
                <RequireAuth user={user}>
                  <AddProject />
                </RequireAuth>
              }
            />
            <Route
              path="/projects/:projectId"
              element={
                <RequireAuth user={user}>
                  <ProjectDetail />
                </RequireAuth>
              }
            />
            <Route
              path="/account"
              element={
                <RequireAuth user={user}>
                  <Account />
                </RequireAuth>
              }
            />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Shell>
      </div>
    </BrowserRouter>
  )
}
