import { api, ApiError } from './api'

export interface PlanOffer {
  tier: 'pro'
  period: 'monthly' | 'yearly'
  price: number
  offered: boolean
}

/** Display catalog (no identifiers ever reach the client). */
export async function getPlans(): Promise<{ plans: PlanOffer[]; teamsNote: string }> {
  return api<{ plans: PlanOffer[]; teamsNote: string }>('/v1/billing/plans')
}

/** Starts checkout and navigates to the Kelviq-hosted page. */
export async function startCheckout(period: 'monthly' | 'yearly'): Promise<void> {
  const res = await api<{ checkoutUrl: string }>('/v1/billing/checkout', {
    method: 'POST',
    body: JSON.stringify({ tier: 'pro', period }),
  })
  window.location.href = res.checkoutUrl
}

/** Opens the customer billing portal in a new tab. */
export async function openPortal(): Promise<void> {
  try {
    const res = await api<{ portalUrl: string }>('/v1/billing/portal', { method: 'POST' })
    window.open(res.portalUrl, '_blank', 'noopener')
  } catch (e) {
    throw new Error(
      e instanceof ApiError ? e.message : 'Couldn’t open the billing portal. Try again in a minute.',
    )
  }
}
