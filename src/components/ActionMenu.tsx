import { useId, type ReactNode } from 'react'
import { MoreHorizontal } from 'lucide-react'
import { useAccessibleMenu } from '../lib/useAccessibleMenu'

export interface MenuAction { label: string; onSelect: () => void; destructive?: boolean; disabled?: boolean }
export default function ActionMenu({ label, actions, children }: { label: string; actions: MenuAction[]; children?: ReactNode }) {
  const id = useId()
  const { open, setOpen, rootRef, triggerRef, menuRef, onMenuKeyDown, onTriggerKeyDown, close } = useAccessibleMenu()
  return <div ref={rootRef} className="relative z-20 shrink-0">
    <button ref={triggerRef} type="button" className={children ? 'btn-ghost gap-2' : 'icon-button'} aria-label={label} aria-haspopup="menu" aria-expanded={open} aria-controls={open ? id : undefined} onKeyDown={onTriggerKeyDown} onClick={() => setOpen(!open)}>
      {children ?? <MoreHorizontal size={20} aria-hidden="true" />}
    </button>
    {open && <div id={id} ref={menuRef} role="menu" aria-label={label} onKeyDown={onMenuKeyDown} className="action-menu">
      {actions.map(action => <button key={action.label} type="button" role="menuitem" tabIndex={-1} disabled={action.disabled} className={`menu-item ${action.destructive ? 'text-coral-emphasis' : 'text-ink'}`} onClick={() => { close(); action.onSelect() }}>{action.label}</button>)}
    </div>}
  </div>
}
