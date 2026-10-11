import { Link } from 'react-router-dom'
import { ArrowRight, X } from 'lucide-react'
import { GuideShell, Step, Path, Trouble } from '../components/ConnectDocs'

/** Firebase service-account key: where it comes from, how to lock it down. */
export default function ConnectFirebase() {
  return (
    <GuideShell
      badge="Connection guide · Firebase"
      title={<>Firebase: the <span>service-account key.</span></>}
      intro="A service account is like a read-only username your Firebase project issues for tools like Stackduck. It arrives as a JSON file — you paste its contents into Stackduck once, and we use it to count users and read error logs. We never write or delete anything with it."
    >
      <div className="mt-8 flex flex-col gap-8">
        <Step n="1" title="Open your Firebase project settings">
          <Path>console.firebase.google.com → your project → Project settings → Service accounts tab</Path>
          <p>Click <strong>Generate new private key</strong> and confirm. A JSON file downloads to your computer.</p>
        </Step>
          <Step n="2" title="Lock the key down to read-only (recommended)">
            <p>
              Fresh keys arrive with the powerful <strong>Editor</strong> role. Stackduck only
              reads, so shrink it: open{' '}
              <strong>console.cloud.google.com → IAM &amp; Admin → IAM</strong> and find the
              new service account in the list. It looks like this (your random letters and
              project name will differ — that's normal):
            </p>
            <div className="rounded-lg border border-line bg-surface p-3">
              <code className="block break-all font-mono text-xs text-ink">
                firebase-adminsdk-a1b2c@my-project.iam.gserviceaccount.com
              </code>
              <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-ink-muted">Before — remove this</p>
              <p className="mt-1">
                <span className="badge badge-alert">Editor <X size={14} aria-hidden="true" /></span>
              </p>
              <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-ink-muted">After — add these two</p>
              <p className="mt-1 flex flex-wrap gap-1">
                <span className="badge badge-success">Firebase Authentication Viewer</span>
                <span className="badge badge-success">Logs Viewer</span>
              </p>
            </div>
            <p>
              Click the pencil icon on that row, delete the Editor role, then add{' '}
              <strong>Firebase Authentication Viewer</strong> (lets us list users — read-only;
              the Admin variant works too, but you don't need its write access) plus{' '}
              <strong>Logs Viewer</strong> (lets us read error logs). Save. Nothing else
              is needed — if you only see the email and the two green roles, you did it right.
            </p>
            <figure className="overflow-hidden rounded-lg border border-line bg-surface">
              <img
                src="/iam-done-right.png"
                alt="Example IAM setup done right: only Firebase Authentication Viewer and Logs Viewer assigned"
                className="w-full"
                loading="lazy"
                onError={(e) => {
                  e.currentTarget.closest('figure')?.remove()
                }}
              />
              <figcaption className="px-3 py-2 font-inter text-xs text-ink-muted">
                Done right: two read-only roles, nothing else.
              </figcaption>
            </figure>
          </Step>
        <Step n="3" title="Paste it into Stackduck">
          <p>
            Open the JSON file in any text editor, copy everything, and paste it into the
            Firebase connector box — or use the <strong>Upload JSON file</strong> button to
            load it straight from disk. Stackduck runs a <strong>health check on the spot</strong> —
            if the key works you'll see it connect immediately; if not, you'll get a plain
            explanation and can retry without losing your place.
          </p>
        </Step>
      </div>
      <div className="card mt-6">
        <h3 className="font-inter text-body font-semibold">Keep this key safe</h3>
          <ul className="mt-1 list-disc pl-5 text-body-sm text-ink-muted">
            <li>Never commit the JSON file to git or paste it into a chat.</li>
            <li>Use one key per project — and one per tool. Sharing a single key across
              instances means every instance inherits every permission (including dangerous
              ones like Token Creator), and a leak anywhere forces you to re-key everywhere.</li>
            <li>If a key ever leaks, delete it under the same Service accounts tab and generate a fresh one.</li>
          </ul>
      </div>
      <h2 className="mt-12 font-inter text-heading-sm font-semibold">If something fails</h2>
      <div className="mt-4 flex flex-col gap-3">
        <Trouble title="Health check fails">
          The key is pasted incompletely, belongs to a different project, or its roles were
          trimmed too far (it needs the two read roles above). The error message says which —
          fix that and retry in place.
        </Trouble>
        <Trouble title="Connected, but no data yet">
          Polling runs about every 30 minutes — give it one full cycle before worrying.
        </Trouble>
      </div>
      <p className="mt-8 text-body-sm text-ink-muted">
        Connecting something else? <Link to="/docs/connect" className="text-link-emphasis text-link">All connection guides <ArrowRight size={14} className="ml-1 inline" aria-hidden="true" /></Link>
      </p>
    </GuideShell>
  )
}
