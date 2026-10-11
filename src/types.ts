/**
 * Stackduck data layer — mirrors the NestJS API response shapes.
 * Single source of truth shared by the frontend pages.
 */

export type MetricType =
  | 'user_metrics'
  | 'error_metrics'
  | 'revenue_metrics'
  | 'uptime_metrics'
  | 'custom'

export type ProjectStatus = 'active' | 'paused' | 'archived'
export type Environment = 'production' | 'staging' | 'development'

/** Backend: `projects` row */
export interface Project {
  id: string
  /** uid that registered it — single-owner, no teams (PRD non-goal) */
  ownerId: string
  /** required — only mandatory field */
  name: string
  description?: string
  /** e.g. ["firebase", "react", "typescript"] */
  stackTags?: string[]
  repoUrl?: string
  liveUrl?: string
  environment?: Environment
  status: ProjectStatus
  /** free-text, docs links etc. */
  notes?: string
  createdAt: IsoTimestamp
  updatedAt: IsoTimestamp
}

export type ConnectorType = 'firebase' | 'generic-webhook' | 'supabase' | 'stripe' | 'sentry' | 'github-actions' | 'posthog' | 'betterstack' | 'vercel'
export type ConnectorAuthType = 'api_key' | 'oauth' | 'service_account' | 'none'
export type ConnectorFetchMode = 'poll' | 'push' | 'both'
export type ConnectorStatus = 'connected' | 'error' | 'pending'

/** Backend: `connectors` row (credentials stripped server-side — never present). */
export interface ConnectorInstance {
  id: string
  type: ConnectorType
  authType: ConnectorAuthType
  fetchMode: ConnectorFetchMode
  /** what this instance actually reports */
  capabilities: MetricType[]
  status: ConnectorStatus
  lastError?: string | null
  lastHealthCheck?: IsoTimestamp | null
  /** poll-mode only */
  lastFetchedAt?: IsoTimestamp | null
  createdAt: IsoTimestamp
}

/** Pre-storage output of every connector — never stored 1:1, always bucketed. */
export interface NormalizedEvent {
  projectId: string
  connectorId: string
  metricType: MetricType
  /** e.g. "signups", "active_users", "error_rate", "mrr" */
  key: string
  value: number
  timestamp: IsoTimestamp
  metadata?: Record<string, string | number | boolean>
}

/** Backend: TimescaleDB rollup bucket from GET /v1/projects/:id/metrics. */
export interface MetricBucket {
  projectId: string
  metricType: MetricType
  key: string
  /** "2026-09-20" */
  date: string
  /** intraday points for this key/day */
  points: Array<{ time: IsoTimestamp; value: number; currency?: string | null }>
  dailyAggregate?: {
    sum?: number
    avg?: number
    max?: number
    min?: number
    /** useful for gauge-like metrics (e.g. current uptime status) */
    last?: number
  }
  updatedAt: IsoTimestamp
}

/** Backend: `alert_rules` row. */
export type AlertCondition = 'above' | 'below'
export type AlertChannel = 'email' | 'webhook'
export type AlertStatus = 'active' | 'muted'

export interface AlertRule {
  id: string
  projectId: string
  metricType: MetricType
  key: string
  condition: AlertCondition
  threshold: number
  /** evaluation window in minutes — set via the duration picker */
  windowMinutes: number
  channel: AlertChannel
  /** email address or webhook URL */
  channelTarget: string
  status: AlertStatus
  triggeredAt?: IsoTimestamp | null
  lastTriggeredAt?: IsoTimestamp | null
  createdAt: IsoTimestamp
}

/** ISO-8601 timestamps from the API (was a Firestore Timestamp pre-cutover). */
export type IsoTimestamp = string

/** Doc-ID helper — must stay in sync with functions/src/metrics.ts */
export function metricBucketId(
  projectId: string,
  metricType: MetricType,
  key: string,
  date: string,
): string {
  return `${projectId}_${metricType}_${key}_${date}`
}

/** Portfolio Home status color logic (spec § status): red reflects firing alerts once evaluation runs. */
export type HomeStatus = 'red' | 'amber' | 'gray' | 'green'
export function projectHomeStatus(args: {
  hasTriggeredUnresolvedAlert: boolean
  connectorStatuses: ConnectorStatus[]
}): HomeStatus {
  if (args.hasTriggeredUnresolvedAlert) return 'red'
  if (args.connectorStatuses.includes('error')) return 'amber'
  if (args.connectorStatuses.includes('pending')) return 'gray'
  return 'green'
}
