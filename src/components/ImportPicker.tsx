import { useDialog } from '../lib/useDialog'
import { useMemo, useState } from 'react'
import { X } from 'lucide-react'
import type { ImportItem, ImportSelection } from '../lib/oauth'

/**
 * Import picker modal: checkbox list with per-item rename, refresh action,
 * primary Import / ghost Cancel. No silent bulk import — nothing is created
 * until the user confirms the selection.
 */
export default function ImportPicker(props: {
  title: string
  subtitle: string
  items: ImportItem[]
  loading: boolean
  error: string | null
  onRefresh: () => void
  onImport: (selections: ImportSelection[]) => Promise<void>
  onClose: () => void
}) {
  const [checked, setChecked] = useState<Set<string>>(new Set())
  const [names, setNames] = useState<Record<string, string>>({})
  const [query, setQuery] = useState('')
  const [busy, setBusy] = useState(false)
  const [importError, setImportError] = useState<string | null>(null)
  const dialogRef = useDialog(props.onClose, busy)

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return props.items
    return props.items.filter((i) => i.name.toLowerCase().includes(q))
  }, [props.items, query])

  function toggle(key: string) {
    setChecked((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  async function onConfirm() {
    setImportError(null)
    setBusy(true)
    try {
      const selections = props.items
        .filter((i) => checked.has(i.key))
        .map((i) => ({
          name: (names[i.key] ?? '').trim() || i.name,
          repoUrl: i.url,
          externalId: i.externalId,
        }))
      await props.onImport(selections)
      props.onClose()
    } catch {
      setImportError('Import failed partway. Some projects may already exist — check the portfolio.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div
      className="modal-backdrop fixed inset-0 z-50 flex items-center justify-center bg-backdrop p-4"
      onClick={() => { if (!busy) props.onClose() }}
      role="presentation"
    >
      <div
        ref={dialogRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby="import-heading"
        className="modal-pop flex max-h-[85vh] w-full max-w-lg flex-col rounded-2xl bg-elevated p-5 shadow-sm-2"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={() => { if (!busy) props.onClose() }}
          disabled={busy}
          aria-label="Close"
          title="Close"
          className="icon-button self-end"
        >
          <X size={18} aria-hidden="true" />
        </button>
        <h2 id="import-heading" className="font-inter text-2xl font-semibold text-ink">
          {props.title}
        </h2>
        <p className="mt-1 font-inter text-sm font-normal text-ink-muted">{props.subtitle}</p>

        <div className="mt-4 flex gap-2">
          <input
            className="input"
            placeholder="Filter by name…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Filter by name"
          />
          <button className="btn-ghost whitespace-nowrap" onClick={props.onRefresh} disabled={props.loading || busy}>
            {props.loading ? '…' : 'Refresh'}
          </button>
        </div>

        <div className="mt-3 min-h-[120px] flex-1 overflow-y-auto rounded-lg border border-line">
          {props.loading && props.items.length === 0 && (
            <div className="flex flex-col gap-2 p-3" aria-label="Loading candidates">
              {[0, 1, 2].map((i) => (
                <div key={i} className="skeleton h-12 w-full" />
              ))}
            </div>
          )}
          {!props.loading && filtered.length === 0 && (
            <p className="p-4 text-center font-inter text-sm text-ink-muted">
              {props.error ?? 'Nothing found on this account.'}
            </p>
          )}
          {filtered.map((item) => (
            <div
              key={item.key}
              className="flex cursor-pointer items-start gap-3 border-b border-line p-3 transition-colors duration-150 last:border-0 hover:bg-inset"
            >
              <input
                type="checkbox"
                className="mt-1 h-[18px] w-[18px] shrink-0 accent-primary"
                disabled={busy}
                checked={checked.has(item.key)}
                onChange={() => toggle(item.key)}
                aria-label={`Import ${item.name}`}
              />
              <span className="min-w-0 flex-1">
                <input
                  className="input !border-0 !bg-transparent !p-0 font-inter text-sm font-semibold text-ink focus:!bg-elevated"
                  disabled={busy}
                  value={names[item.key] ?? item.name}
                  onChange={(e) => setNames((n) => ({ ...n, [item.key]: e.target.value }))}
                  onClick={(e) => e.stopPropagation()}
                  onFocus={(e) => e.stopPropagation()}
                  aria-label="Project name"
                />
                <span className="block truncate font-inter text-xs text-ink-muted">{item.subtitle}</span>
              </span>
            </div>
          ))}
        </div>

        {props.error && filtered.length > 0 && (
          <p className="mt-2 font-inter text-sm text-coral-emphasis">{props.error}</p>
        )}
        {importError && (
          <p role="alert" className="mt-2 font-inter text-sm text-coral-emphasis">
            {importError}
          </p>
        )}

        <div className="mt-4 flex gap-2">
          <button className="btn-primary flex-1" disabled={busy || checked.size === 0} onClick={() => void onConfirm()}>
            {busy ? 'Importing…' : `Import selected${checked.size > 0 ? ` (${checked.size})` : ''}`}
          </button>
          <button disabled={busy} className="btn-ghost" onClick={() => { if (!busy) props.onClose() }}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}
