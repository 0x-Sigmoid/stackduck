import { Link } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import { useAuthUser } from '../lib/useAuthUser'

/** Shared account entry: the label always matches the destination. */
export default function PortfolioCta({ inverse = false }: { inverse?: boolean }) {
  const user = useAuthUser()
  const className = `btn-primary ${inverse ? 'bg-paper-white text-inkwell-navy hover:bg-paper-white/90' : ''}`
  if (user === undefined) return <button className={className} disabled aria-busy="true">Checking session…</button>
  return <Link to={user ? '/portfolio' : '/signin?mode=signup'} className={className}>{user ? 'Open portfolio' : 'Create your portfolio'}<ArrowRight size={16} aria-hidden="true" /></Link>
}
