import { useEffect, useRef, useState, type KeyboardEvent } from 'react'

/** Shared focus and dismissal behavior for action, theme, and account menus. */
export function useAccessibleMenu() {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const startAtEnd = useRef(false)
  function close(restore = true) {
    setOpen(false)
    if (restore) triggerRef.current?.focus()
  }
  function items() {
    return Array.from(menuRef.current?.querySelectorAll<HTMLElement>('[role^="menuitem"]:not(:disabled)') ?? [])
  }
  useEffect(() => {
    if (!open) return
    const options = items()
    options[startAtEnd.current ? options.length - 1 : 0]?.focus()
    const dismiss = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }
    const blur = (event: FocusEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', dismiss)
    document.addEventListener('focusin', blur)
    return () => {
      document.removeEventListener('pointerdown', dismiss)
      document.removeEventListener('focusin', blur)
    }
  }, [open])
  function onTriggerKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      startAtEnd.current = event.key === 'ArrowUp'
      setOpen(true)
    } else if (event.key === 'Escape') close()
  }
  function onMenuKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const options = items()
    const index = options.indexOf(document.activeElement as HTMLElement)
    if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); close(); return }
    if (event.key === 'Tab') { close(); return }
    let next: number | undefined
    if (event.key === 'ArrowDown') next = (index + 1) % options.length
    if (event.key === 'ArrowUp') next = (index - 1 + options.length) % options.length
    if (event.key === 'Home') next = 0
    if (event.key === 'End') next = options.length - 1
    if (next !== undefined) { event.preventDefault(); options[next]?.focus() }
    else if (event.key.length === 1 && !event.ctrlKey && !event.metaKey) {
      const match = [...options.slice(index + 1), ...options.slice(0, index + 1)].find(item => item.textContent?.trim().toLowerCase().startsWith(event.key.toLowerCase()))
      if (match) { event.preventDefault(); match.focus() }
    }
  }
  return { open, setOpen, rootRef, triggerRef, menuRef, onTriggerKeyDown, onMenuKeyDown, close }
}
