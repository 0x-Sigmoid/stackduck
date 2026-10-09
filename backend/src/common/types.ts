// Shared domain enums — mirrors functions/src/types.ts + src/types.ts
// (Firestore Timestamp replaced by Date; storage is Postgres).
export type MetricType =
  | 'user_metrics'
  | 'error_metrics'
  | 'revenue_metrics'
  | 'uptime_metrics'
  | 'custom';
export type ProjectStatus = 'active' | 'paused' | 'archived';
export type Environment = 'production' | 'staging' | 'development';
export type ConnectorType =
  | 'firebase'
  | 'generic-webhook'
  | 'supabase'
  | 'stripe'
  | 'sentry'
  | 'github-actions'
  | 'posthog'
  | 'betterstack'
  | 'vercel';
export type ConnectorAuthType = 'api_key' | 'oauth' | 'service_account' | 'none';
export type ConnectorFetchMode = 'poll' | 'push' | 'both';
export type ConnectorStatus = 'connected' | 'error' | 'pending';
export type AlertCondition = 'above' | 'below';
export type AlertChannel = 'email' | 'webhook';
export type AlertStatus = 'active' | 'muted';

export const METRIC_TYPES: MetricType[] = [
  'user_metrics',
  'error_metrics',
  'revenue_metrics',
  'uptime_metrics',
  'custom',
];

export interface NormalizedEvent {
  projectId: string;
  connectorId: string;
  metricType: MetricType;
  key: string;
  value: number;
  timestamp: Date;
  aggregation?: 'sum' | 'last';
  metadata?: Record<string, string | number | boolean>;
}

export type HomeStatus = 'red' | 'amber' | 'gray' | 'green';
export function projectHomeStatus(args: {
  hasTriggeredUnresolvedAlert: boolean;
  connectorStatuses: ConnectorStatus[];
}): HomeStatus {
  if (args.hasTriggeredUnresolvedAlert) return 'red';
  if (args.connectorStatuses.includes('error')) return 'amber';
  if (args.connectorStatuses.includes('pending')) return 'gray';
  return 'green';
}
