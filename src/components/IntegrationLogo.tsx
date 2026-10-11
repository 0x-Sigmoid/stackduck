import { Webhook } from 'lucide-react'

const LOGOS: Record<string, string> = {
  Firebase: 'firebase',
  Stripe: 'stripe',
  Supabase: 'supabase',
  Sentry: 'sentry',
  'GitHub Actions': 'githubactions',
  PostHog: 'posthog',
  'Better Stack': 'betterstack',
  Vercel: 'vercel',
}

/** Decorative mark beside a visible provider name; white keeps brand colors legible in both themes. */
export default function IntegrationLogo({ name }: { name: string }) {
  const logo = LOGOS[name]
  return (
    <span aria-hidden="true" className="grid size-9 shrink-0 place-items-center rounded-lg border border-line bg-paper-white text-inkwell-navy">
      {logo ? (
        <img src={`/integrations/${logo}.svg`} alt="" width={24} height={24} loading="lazy" decoding="async" className="size-6 object-contain" />
      ) : (
        <Webhook size={22} />
      )}
    </span>
  )
}
