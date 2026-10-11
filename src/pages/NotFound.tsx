import { Link } from 'react-router-dom'
import SiteNav from '../components/SiteNav'
import SiteFooter from '../components/SiteFooter'
import PortfolioCta from '../components/PortfolioCta'

export default function NotFound() {
  return <div><SiteNav /><main id="main-content" className="public-page"><div className="utility-panel">
    <p className="text-xs font-semibold uppercase tracking-wider text-ink-muted">404 · Page not found</p>
    <h1 className="workspace-title">This page doesn’t exist.</h1>
    <p className="mt-3 text-sm leading-relaxed text-ink-muted">The link may be wrong or the page may have moved. Choose where to go next.</p>
    <div className="mt-6 flex flex-wrap justify-center gap-3"><Link to="/" className="btn-ghost">Back to home</Link><PortfolioCta /></div>
  </div></main><SiteFooter /></div>
}
