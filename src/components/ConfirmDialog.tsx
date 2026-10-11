import { useEffect, useRef, useState } from 'react'
import { X } from 'lucide-react'

/**
 * Confirmation prompt for permanent removals. Requires typing the exact
 * resource name — same deliberate step as the project-detail delete, so
 * "permanent" always costs the same amount of intent.
 *
 * Controlled: render it only when there's something to confirm. Escape and
 * backdrop-click cancel (blocked while a removal is in flight).
 */
export default function ConfirmDialog(props: {
  title: string
  body: React.ReactNode
  /** the exact text the user must type to unlock the confirm button */
  confirmWord: string
  confirmLabel: string
  busy?: boolean
  error?: string | null
  onConfirm: () => void
  onCancel: () => void
}) {
  const [draft, setDraft] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const dialogRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    inputRef.current?.focus()
    return () => { document.body.style.overflow = overflow; previous?.focus() }
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !props.busy) props.onCancel()
      if (e.key === 'Tab') {
        const items = Array.from(dialogRef.current?.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), [tabindex="0"]') ?? [])
        const first = items[0], last = items[items.length - 1]
        if (!items.length) { e.preventDefault(); dialogRef.current?.focus() }
        else if (e.shiftKey && (document.activeElement === first || !dialogRef.current?.contains(document.activeElement))) { e.preventDefault(); last?.focus() }
        else if (!e.shiftKey && (document.activeElement === last || !dialogRef.current?.contains(document.activeElement))) { e.preventDefault(); first?.focus() }
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [props])

  const armed = draft.trim() === props.confirmWord

  return (
    <div
      className="modal-backdrop fixed inset-0 z-50 flex items-center justify-center bg-backdrop p-4"
      role="presentation"
      onClick={() => { if (!props.busy) props.onCancel() }}
    >
      <div
        ref={dialogRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-heading"
        className="modal-pop w-full max-w-md rounded-2xl bg-elevated p-5 shadow-sm-2"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={props.onCancel}
          disabled={props.busy}
          aria-label="Close"
          title="Close"
          className="float-right -mr-1 -mt-1 rounded-lg px-2 py-1 text-ink-muted transition-colors duration-150 hover:bg-inset hover:text-ink disabled:opacity-50"
        >
          <X size={18} aria-hidden="true" />
        </button>

        <h2 id="confirm-heading" className="font-inter text-xl font-semibold text-ink">
          {props.title}
        </h2>
        <div className="mt-2 font-inter text-sm text-ink-muted">{props.body}</div>

        <label className="mt-3 flex flex-col gap-1 font-inter text-sm font-medium text-ink">
          Type <strong className="[overflow-wrap:anywhere]">{props.confirmWord}</strong> to confirm
          <input
            ref={inputRef}
            className="input mt-1"
            autoComplete="off"
            aria-label="Type the name to confirm removal"
            placeholder={props.confirmWord}
            value={draft}
            disabled={props.busy}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && armed && !props.busy) props.onConfirm() }}
          />
        </label>

        {props.error && (
          <p role="alert" className="mt-2 font-inter text-sm text-coral-emphasis">
            {props.error}
          </p>
        )}

        <div className="mt-4 flex gap-2">
          <button
            className="btn-primary bg-coral-emphasis flex-1"
            disabled={!armed || props.busy}
            onClick={props.onConfirm}
          >
            {props.busy ? 'Removing…' : props.confirmLabel}
          </button>
          <button className="btn-ghost" disabled={props.busy} onClick={props.onCancel}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}
