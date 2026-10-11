import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Menu, X } from 'lucide-react'
import Logo from './Logo'
import GitHubStars from './GitHubStars'
import UserMenu from './UserMenu'
import ThemeSwitcher from './ThemeSwitcher'
import { useAuthUser } from '../lib/useAuthUser'

export type SiteSection = 'about' | 'docs' | 'pricing'

const LINKS: Array<{ to: string; label: string; key: SiteSection }> = [
  { to: '/about', label: 'About', key: 'about' },
  { to: '/docs', label: 'Docs', key: 'docs' },
  { to: '/pricing', label: 'Pricing', key: 'pricing' },
]

/** Public marketing nav — single instance per page (no app-chrome double nav).
 *  Signed-in users get their avatar menu here too, landing page included. */
export default function SiteNav({ active }: { active?: SiteSection }) {
  const user = useAuthUser()
  const [mobileOpen, setMobileOpen] = useState(false)
  const triggerRef = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    if (!mobileOpen) return
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') { setMobileOpen(false); triggerRef.current?.focus() } }
    document.addEventListener('keydown', escape)
    return () => document.removeEventListener('keydown', escape)
  }, [mobileOpen])
  return (
    <nav className="relative z-30 bg-transparent">
      <div className="mx-auto flex max-w-[var(--page-max-width)] items-center justify-between gap-2 px-4 py-3 sm:gap-4 sm:px-6 sm:py-4">
        <Logo />
        <div className="flex items-center gap-2 sm:gap-5">
          <div className="hidden items-center gap-5 text-sm sm:flex">
            {LINKS.map((l) => (
              <Link
                key={l.key}
                aria-current={active === l.key ? 'page' : undefined}
                to={l.to}
                className={`nav-link ${active === l.key ? 'nav-link-active' : ''}`}
              >
                {l.label}
              </Link>
            ))}
          </div>
          {user === undefined ? (
            <span className="skeleton h-9 w-20" aria-hidden="true" />
          ) : user ? (
            <>
              <Link to="/portfolio" className="btn-ghost hidden whitespace-nowrap sm:inline-flex">
                Portfolio
              </Link>
              <UserMenu user={user} />
            </>
          ) : (
            <Link to="/signin" className="btn-ghost whitespace-nowrap">
              Sign in
            </Link>
          )}
          <ThemeSwitcher />
          <span className="hidden sm:block"><GitHubStars /></span>
          <button
            ref={triggerRef}
            type="button"
            className="grid size-11 place-items-center rounded-lg border border-line text-ink transition-colors hover:bg-surface focus-visible:outline-2 focus-visible:outline-ring sm:hidden"
            aria-label={mobileOpen ? 'Close navigation menu' : 'Open navigation menu'}
            aria-expanded={mobileOpen}
            aria-controls="site-mobile-navigation"
            onClick={() => setMobileOpen((open) => !open)}
          >
            {mobileOpen ? <X size={19} aria-hidden="true" /> : <Menu size={19} aria-hidden="true" />}
          </button>
        </div>
      </div>
      {mobileOpen && (
        <div id="site-mobile-navigation" className="border-t border-line bg-canvas px-4 py-3 sm:hidden">
          <div className="mx-auto flex max-w-[var(--page-max-width)] flex-col gap-1">
            {LINKS.map((link) => (
              <Link
                key={link.key}
                to={link.to}
                aria-current={active === link.key ? 'page' : undefined}
                onClick={() => setMobileOpen(false)}
                className={`min-h-11 rounded-lg px-3 py-2.5 text-sm font-medium ${active === link.key ? 'bg-inset text-ink' : 'text-ink-secondary hover:bg-inset'}`}
              >
                {link.label}
              </Link>
            ))}
            {user && (
              <Link to="/portfolio" onClick={() => setMobileOpen(false)} className="min-h-11 rounded-lg px-3 py-2.5 text-sm font-medium text-ink-secondary hover:bg-inset">
                Portfolio
              </Link>
            )}
          </div>
        </div>
      )}
    </nav>
  )
}
