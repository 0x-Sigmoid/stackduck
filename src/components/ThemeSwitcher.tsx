import { useAccessibleMenu } from '../lib/useAccessibleMenu'
import { Check, Monitor, Moon, Sun } from 'lucide-react'
import { useTheme, type ThemeChoice } from '../lib/theme'

const OPTIONS: Array<{
  value: ThemeChoice
  label: string
  hint: string
  Icon: typeof Sun
}> = [
  { value: 'light', label: 'Light', hint: 'Always light', Icon: Sun },
  { value: 'dark', label: 'Dark', hint: 'Always dark', Icon: Moon },
  { value: 'system', label: 'System', hint: 'Follows your device', Icon: Monitor },
]

/**
 * Theme switcher: icon button (sun/moon/monitor for the current choice) +
 * dropdown. Sits near the GitHub link in both the marketing SiteNav and the
 * app Header. Choice persists in localStorage; default for new visitors is
 * Light (see src/lib/theme.ts).
 */
export default function ThemeSwitcher() {
  const { choice, setChoice } = useTheme()
  const { open, setOpen, rootRef, triggerRef, menuRef, onMenuKeyDown, onTriggerKeyDown, close } = useAccessibleMenu()



  const current = OPTIONS.find((o) => o.value === choice) ?? OPTIONS[0]

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={triggerRef}
        onKeyDown={onTriggerKeyDown}
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Theme: ${current.label}`}
        title={`Theme: ${current.label}`}
        className="grid size-11 place-items-center rounded-lg border border-line text-ink transition-colors duration-150 hover:border-line-strong hover:bg-surface focus-visible:outline-2 focus-visible:outline-ring"
      >
        <current.Icon />
      </button>

      {open && (
        <div
          ref={menuRef}
          onKeyDown={onMenuKeyDown}
          role="menu"
          aria-label="Theme"
          className="modal-pop absolute right-0 z-50 mt-2 w-44 rounded-lg border border-line bg-elevated p-1 shadow-sm"
        >
          {OPTIONS.map(({ value, label, hint, Icon }) => {
            const active = value === choice
            return (
              <button
                key={value}
                role="menuitemradio" tabIndex={-1}
                aria-checked={active}
                type="button"
                onClick={() => {
                  setChoice(value)
                  close()
                }}
                className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left font-inter text-sm transition-colors duration-150 hover:bg-inset ${
                  active ? 'font-semibold text-ink' : 'font-medium text-ink-muted hover:text-ink'
                }`}
              >
                <Icon />
                <span className="min-w-0 flex-1">
                  {label}
                  <span className="block text-xs font-normal text-ink-muted">{hint}</span>
                </span>
                {active && (
                  <Check size={16} aria-hidden="true" />
                )}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
