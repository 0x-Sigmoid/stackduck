import type { MetricType } from './types';

export type MetricAggregation = 'sum' | 'last';

// Compatibility for data written before aggregation was part of the contract.
// New providers should declare their aggregation on each normalized event.
export const SNAPSHOT_KEYS = [
  'total_users', 'active_users', 'active_users_30d', 'availability_percent',
  'events_received_24h', 'workflow_runs_24h', 'failed_workflow_runs_24h',
  'in_progress_workflow_runs', 'events_24h', 'deployments_24h',
  'failed_deployments_24h', 'ready_deployments_24h', 'active_deployments',
  'revenue_30d', 'failed_24h',
];

export function metricAggregation(metricType: MetricType, key: string): MetricAggregation {
  return metricType === 'uptime_metrics' || SNAPSHOT_KEYS.includes(key) ? 'last' : 'sum';
}
