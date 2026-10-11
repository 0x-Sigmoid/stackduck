import { Link } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import { GuideShell, Step, Code, Trouble } from '../components/ConnectDocs'

/** Generic webhook: generate URL + secret, sign events, watch it connect. */
export default function ConnectWebhook() {
  return (
    <GuideShell
      badge="Connection guide · Webhook"
      title={<>Any backend: the <span>signed webhook.</span></>}
      intro="If your project isn't on Firebase, it can still report in: Stackduck gives that project a private ingest URL plus a signing secret. Your backend signs each event with the secret and posts it. The signature proves the event came from you — no login, no API keys in your code."
    >
      <div className="mt-8 flex flex-col gap-8">
        <Step n="1" title="Generate the URL and secret in Stackduck">
          <p>
            On your project page, choose <strong>Generic Webhook → Generate URL + secret</strong>.
            Copy both somewhere safe — the <strong>secret is shown once</strong> and never again.
            (Lost it? You can rotate it from the same place; the old one keeps working for 24 hours
            while you update your backend.)
          </p>
        </Step>
        <Step n="2" title="Send a signed event from your backend">
          <p>
            Every request carries two headers: <strong>X-Stackduck-Timestamp</strong> (the
            current time in unix seconds) and <strong>X-Stackduck-Signature</strong>, which is
            the hex HMAC-SHA256 of <code>{'{timestamp}.{raw body}'}</code> with your secret.
            Signing the timestamp is what stops replay attacks — deliveries older than five
            minutes are rejected even with a valid signature, so keep your server clock
            accurate. In Node.js:
          </p>
          <Code>{`const crypto = require('crypto');

const body = JSON.stringify({
  metricType: 'user_metrics',   // one of: user_metrics, error_metrics,
  key: 'signups',               //   revenue_metrics, uptime_metrics, custom
  value: 3,                     // must be a number
  // timestamp is optional — omitted means "right now"
});

const timestamp = Math.floor(Date.now() / 1000).toString();
const signature = crypto
  .createHmac('sha256', process.env.STACKDUCK_SIGNING_SECRET)
  .update(timestamp + '.' + body)
  .digest('hex');

await fetch(process.env.STACKDUCK_INGEST_URL, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-Stackduck-Timestamp': timestamp,
    'X-Stackduck-Signature': signature,
  },
  body,
});`}</Code>
          <p>Quick test from a terminal (replace the placeholders):</p>
          <Code>{`BODY='{"metricType":"user_metrics","key":"signups","value":1}'
TS=$(date +%s)
SIG=$(echo -n "$TS.$BODY" | openssl dgst -sha256 -hmac "$STACKDUCK_SIGNING_SECRET")
curl -X POST "$STACKDUCK_INGEST_URL" \\
  -H 'Content-Type: application/json' \\
  -H "X-Stackduck-Timestamp: $TS" \\
  -H "X-Stackduck-Signature: $SIG" \\
  -d "$BODY"`}</Code>
        </Step>
        <Step n="3" title="Watch it flip to connected">
          <p>
            The connector starts as <strong>pending</strong> and flips to{' '}
            <strong>connected</strong> automatically when the first verified event arrives —
            no health check to run, no page to refresh. You can send up to 500 events per
            request as a JSON array (requests are capped at 100kb); sustained traffic is capped
            at 60 requests a minute
            per connector (a retry loop gone wild gets a polite 429, not a bill shock).
          </p>
        </Step>
      </div>
      <h2 className="mt-12 font-inter text-heading-sm font-semibold">If something fails</h2>
      <div className="mt-4 flex flex-col gap-3">
        <Trouble title="Events rejected (401)">
          Signature mismatch. The usual suspects: signing the body alone instead of{' '}
          <code>{'{timestamp}.{body}'}</code>, signing a pretty-printed body but sending
          a compact one (sign the exact bytes you send), a missing{' '}
          <code>X-Stackduck-Timestamp</code> header, an extra newline, or a rotated secret
          that never made it into your backend's environment.
        </Trouble>
        <Trouble title="Timestamp outside the 5-minute window (401)">
          The signature was valid but the delivery is too old (or from the future) — usually
          a wrong server clock or a replayed capture. Sync time (NTP) and send fresh
          timestamps; retries must re-sign with a new timestamp, not resend the old one.
        </Trouble>
        <Trouble title="Connector still “pending”">
          No verified event has arrived yet. Send the test event above and check the
          response code.
        </Trouble>
      </div>
      <p className="mt-8 text-body-sm text-ink-muted">
        Connecting something else? <Link to="/docs/connect" className="text-link-emphasis text-link">All connection guides <ArrowRight size={14} className="ml-1 inline" aria-hidden="true" /></Link>
      </p>
    </GuideShell>
  )
}
