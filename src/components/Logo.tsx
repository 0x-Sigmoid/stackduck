import { Link } from 'react-router-dom'

/** Duck mascot on two stack layers, shared with the favicon and exported brand assets. */
export function StackduckMark({ size = 32 }: { size?: number }) {
  return <img src="/logo.svg" width={size} height={size} alt="Stackduck mark" className="shrink-0" />
}

/** Full lockup: mark + Inter 600 wordmark. Theme-aware via `text-ink`
 *  (flips automatically under [data-theme="dark"]); pass `dark` only when the
 *  lockup sits on an explicitly dark surface regardless of page theme. */
export function StackduckLockup({
  dark = false,
  markSize = 32,
  to = '/',
}: {
  dark?: boolean
  markSize?: number
  to?: string | null
}) {
  const inner = (
    <>
      <StackduckMark size={markSize} />
      <span
        className={`font-inter text-xl font-semibold tracking-tight ${dark ? 'text-paper-white' : 'text-ink'}`}
      >
        Stackduck
      </span>
    </>
  )
  if (to === null) {
    return (
      <span className="flex items-center gap-2.5" aria-label="Stackduck">
        {inner}
      </span>
    )
  }
  return (
    <Link to={to} className="flex items-center gap-2.5 rounded-lg" aria-label="Stackduck home">
      {inner}
    </Link>
  )
}

/** Aliases for backwards-compatibility */
export const ProxibayMark = StackduckMark
export const ProxibayLockup = StackduckLockup

/** Default export kept for existing call sites (App, SiteNav, SiteFooter). */
export default function Logo({ dark = false }: { dark?: boolean }) {
  return <StackduckLockup dark={dark} />
}
