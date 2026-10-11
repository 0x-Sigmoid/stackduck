import { useEffect, useState } from 'react'
import { Check, Copy } from 'lucide-react'

export default function CopyButton({ value, label = 'Copy', className = '' }: { value: string; label?: string; className?: string }) {
  const [status, setStatus] = useState<'idle' | 'copied' | 'error'>('idle')
  useEffect(() => {
    setStatus('idle')
  }, [value])
  useEffect(() => {
    if (status === 'idle') return
    const timer = window.setTimeout(() => setStatus('idle'), 3000)
    return () => window.clearTimeout(timer)
  }, [status])
  async function copy() {
    try { await navigator.clipboard.writeText(value); setStatus('copied') } catch { setStatus('error') }
  }
  return <span className="inline-flex flex-wrap items-center gap-2"><button type="button" className={`btn-ghost ${className}`} onClick={() => void copy()}>{status === 'copied' ? <Check size={14} aria-hidden="true" /> : <Copy size={14} aria-hidden="true" />}{status === 'copied' ? 'Copied' : label}</button><span role="status" className="text-xs text-ink-muted">{status === 'error' ? 'Copy failed. Select and copy the text manually.' : ''}</span></span>
}
