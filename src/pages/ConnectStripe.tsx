import { Link } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import { GuideShell, Step, Path, Trouble } from '../components/ConnectDocs'

/** Stripe: restricted key, webhook registration, nightly fallback. */
export default function ConnectStripe() {
  return (
    <GuideShell
      badge="Connection guide · Stripe"
      title={<>Stripe: the <span>restricted key.</span></>}
      intro="For projects that take payments. You paste a restricted secret key — scoped to reading charges, balance, and payouts — and Stackduck verifies it on the spot. Instant events arrive through a webhook you register; nightly totals reconcile on their own even if you skip that step."
    >
      <div className="mt-8 flex flex-col gap-8">
        <Step n="1" title="Create a restricted key">
          <Path>dashboard.stripe.com → Developers → API keys → Create restricted key</Path>
          <p>
            Give it <strong>read</strong> access to charges, balance, and payouts — nothing
            else. Copy the key (it starts with <strong>rk_live_</strong> or{' '}
            <strong>rk_test_</strong>) and paste it into the Stripe connector box. A health
            check runs immediately.
          </p>
        </Step>
        <Step n="2" title="Register the webhook for instant events (recommended)">
          <p>
            After connecting, Stackduck shows you an <strong>endpoint URL</strong>. In Stripe,
            go to <strong>Developers → Webhooks → Add endpoint</strong>, paste the URL, and
            listen to charge and payout events. Stripe hands you an endpoint{' '}
            <strong>signing secret</strong> (whsec_…) — paste it into the connector's
            webhook-secret box when connecting and
            every event arrives verified within seconds. Skip this and you still get nightly
            revenue totals.
          </p>
        </Step>
      </div>
      <h2 className="mt-12 font-inter text-heading-sm font-semibold">If something fails</h2>
      <div className="mt-4 flex flex-col gap-3">
        <Trouble title="Key rejected">
          Use a <strong>secret</strong> key (rk_/sk_), not the publishable one (pk_) —
          publishable keys can't read anything and fail immediately. Test-mode keys only
          see test data.
        </Trouble>
        <Trouble title="Connected, but no instant events">
          Totals land after the first nightly run. For instant events, the endpoint URL must
          be registered in your Stripe dashboard — pasting the key alone only enables polling.
        </Trouble>
      </div>
      <p className="mt-8 text-body-sm text-ink-muted">
        Connecting something else? <Link to="/docs/connect" className="text-link-emphasis text-link">All connection guides <ArrowRight size={14} className="ml-1 inline" aria-hidden="true" /></Link>
      </p>
    </GuideShell>
  )
}
