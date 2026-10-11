import type { ConnectorInstance, MetricType, Project } from '../types'

export interface ProjectListEntry {
  project: Project
  connectorStatuses: Array<'connected' | 'error' | 'pending'>
  keyMetrics: Array<{ metricType: MetricType; key: string; value: number; at: string; currency?: string | null }>
  homeStatus: 'green' | 'gray' | 'amber' | 'red'
}

export interface CreatedProject {
  project: Project
}

export interface FirebaseConnectResult {
  connector: ConnectorInstance
  healthCheck: { ok: boolean; detail: string }
}

export interface WebhookConnectResult {
  connector: ConnectorInstance
  ingestUrl: string
  signingSecret: string
  snippet: { node: string; curl: string }
}

export interface StripeConnectResult {
  connector: ConnectorInstance
  healthCheck: { ok: boolean; detail: string }
  /** Register this URL in the Stripe dashboard (Developers → Webhooks) for instant events. */
  stripeEndpoint: string
}

export interface SupabaseConnectResult {
  connector: ConnectorInstance
  healthCheck: { ok: boolean; detail: string }
}
