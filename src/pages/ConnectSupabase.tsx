import { Link } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import { GuideShell, Step, Path, Trouble } from '../components/ConnectDocs'

/** Supabase: project URL + service-role key, RLS warning included. */
export default function ConnectSupabase() {
  return (
    <GuideShell
      badge="Connection guide · Supabase"
      title={<>Supabase: <span>URL + service key.</span></>}
      intro="For database-backed projects. Stackduck polls your auth users for totals, signups, and 30-day active users — which only works with the service_role key, because it bypasses row-level security. The anon key can't list users at all."
    >
      <div className="mt-8 flex flex-col gap-8">
        <Step n="1" title="Copy the URL and the service_role key">
          <Path>supabase.com/dashboard → your project → Project Settings → API</Path>
          <p>
            Copy the <strong>Project URL</strong> (https://xyzcompany.supabase.co) and, under
            Project API keys, reveal and copy the <strong>service_role secret</strong> — not the
            anon public key next to it. Paste both into the Supabase connector box; the health
            check tells you on the spot if you grabbed the wrong key.
          </p>
        </Step>
        <Step n="2" title="Treat the key like a password">
          <p>
            Service-role bypasses every row-level policy, so never commit it or paste it into
            a chat. If it was ever exposed, roll it under the same API settings page and
            reconnect with the fresh one. Error logs aren't covered — reading those needs a
            separate management token your project key can't provide.
          </p>
        </Step>
      </div>
      <h2 className="mt-12 font-inter text-heading-sm font-semibold">If something fails</h2>
      <div className="mt-4 flex flex-col gap-3">
        <Trouble title="Health check names the anon key">
          You pasted the anon public key. Go back to Project Settings → API and copy the
          service_role secret instead.
        </Trouble>
        <Trouble title="Connected, but no data yet">
          Polling runs about every 30 minutes — give it one full cycle. Active users count
          sign-ins from the last 30 days, so brand-new projects legitimately show zero.
        </Trouble>
      </div>
      <p className="mt-8 text-body-sm text-ink-muted">
        Connecting something else? <Link to="/docs/connect" className="text-link-emphasis text-link">All connection guides <ArrowRight size={14} className="ml-1 inline" aria-hidden="true" /></Link>
      </p>
    </GuideShell>
  )
}
