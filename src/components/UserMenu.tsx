import { useAccessibleMenu } from '../lib/useAccessibleMenu'
import { ChevronDown } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { signOut, type BackendUser } from '../lib/session'
import UserAvatar from './UserAvatar'

const ITEM_CLASS =
  'block min-h-11 w-full rounded-lg px-3 py-2.5 text-left font-inter text-sm font-medium text-ink-muted transition-colors duration-150 hover:bg-inset hover:text-ink focus-visible:outline-2 focus-visible:outline-ring'

/**
 * Signed-in account chip: avatar button + dropdown (Portfolio, Account
 * settings, Sign out). Shared by the marketing SiteNav and the app Header so
 * a logged-in user is recognized on every page, landing included.
 */
export default function UserMenu({ user }: { user: BackendUser }) {
  const { open, setOpen, rootRef, triggerRef, menuRef, onMenuKeyDown, onTriggerKeyDown, close } = useAccessibleMenu()
  const navigate = useNavigate()



  async function handleSignOut() {
    setOpen(false)
    await signOut().catch(() => undefined)
    navigate('/')
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={triggerRef}
        onKeyDown={onTriggerKeyDown}
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Account menu for ${user.displayName || user.email || 'you'}`}
        className="flex min-h-11 items-center gap-2 rounded-full border border-line bg-surface py-1 pl-1 pr-2.5 transition-colors duration-150 hover:border-line-strong focus-visible:outline-2 focus-visible:outline-ring"
      >
        <UserAvatar user={user} size={28} />
        <ChevronDown size={14} aria-hidden="true" className={`text-ink-muted transition-transform duration-150 ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <>
          <button
            aria-hidden
            tabIndex={-1}
            aria-label="Close account menu"
            className="fixed inset-0 z-40 cursor-default bg-ink/30 sm:hidden"
            onClick={() => close()}
          />
          <div
            ref={menuRef}
            onKeyDown={onMenuKeyDown}
            role="menu"
            aria-label="Account"
            className="modal-pop fixed inset-x-4 bottom-4 z-50 mt-2 rounded-2xl border border-line bg-elevated p-2 shadow-sm sm:absolute sm:inset-x-auto sm:bottom-auto sm:right-0 sm:w-64"
          >
          <div className="flex items-center gap-3 border-b border-line px-3 pb-3 pt-1">
            <UserAvatar user={user} size={36} />
            <div className="min-w-0">
              <p className="truncate font-inter text-sm font-semibold text-ink">
                {user.displayName || 'Stackduck user'}
              </p>
              <p className="truncate font-inter text-xs text-ink-muted">{user.email}</p>
            </div>
          </div>
          <div className="pt-2">
            <Link role="menuitem" tabIndex={-1} to="/portfolio" className={ITEM_CLASS} onClick={() => close()}>
              Portfolio
            </Link>
            <Link role="menuitem" tabIndex={-1} to="/docs" className={ITEM_CLASS} onClick={() => close()}>
              Guides
            </Link>
            <Link role="menuitem" tabIndex={-1} to="/account" className={ITEM_CLASS} onClick={() => close()}>
              Account settings
            </Link>
            <button role="menuitem" tabIndex={-1} type="button" className={ITEM_CLASS} onClick={() => void handleSignOut()}>
              Sign out
            </button>
          </div>
        </div>
        </>
      )}
    </div>
  )
}
