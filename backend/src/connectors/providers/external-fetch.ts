import { Injectable } from '@nestjs/common';
import type { NormalizedEvent } from '../../common/types';
import { ExternalConfig, ExternalType, assertConfig, posthogQuery, requestJson } from './external-config';
import { CredentialsService } from '../../credentials/credentials.service';

/** Fetch side of the external connector port (split for file-size limits). */
@Injectable()
export class ExternalFetch {
  constructor(private readonly creds: CredentialsService) {}

  async fetchMetrics(type: ExternalType, credentialsEnc: string, projectId: string, connectorId: string): Promise<NormalizedEvent[]> {
    const config = JSON.parse(this.creds.decrypt(credentialsEnc)) as ExternalConfig;
    assertConfig(type, config);
    const now = new Date();
    const make = (metricType: NormalizedEvent['metricType'], key: string, value: number): NormalizedEvent =>
      ({ projectId, connectorId, metricType, key, value, timestamp: now, aggregation: 'last' });
    if (type === 'sentry' && config.provider === 'sentry') {
      const since = Math.floor((now.getTime() - 24 * 3600000) / 1000);
      const until = Math.floor(now.getTime() / 1000);
      const rows = (await requestJson(
        `https://sentry.io/api/0/projects/${encodeURIComponent(config.organization)}/${encodeURIComponent(config.project)}/stats/?stat=received&since=${since}&until=${until}&resolution=1h`,
        config.token,
      )) as Array<[number, number]>;
      return [make('error_metrics', 'events_received_24h', rows.reduce((s, r) => s + (Number(r[1]) || 0), 0))];
    }
    if (type === 'github-actions' && config.provider === 'github-actions') {
      const since = new Date(now.getTime() - 86400000).toISOString();
      const payload = (await requestJson(
        `https://api.github.com/repos/${config.repository}/actions/runs?per_page=100&created=%3E%3D${encodeURIComponent(since)}`,
        config.token, { 'X-GitHub-Api-Version': '2022-11-28' },
      )) as { total_count?: number; workflow_runs?: Array<{ conclusion: string | null; status: string }> };
      const runs = payload.workflow_runs ?? [];
      return [
        make('custom', 'workflow_runs_24h', Number(payload.total_count ?? runs.length)),
        make('error_metrics', 'failed_workflow_runs_24h', runs.filter((r) => r.conclusion === 'failure').length),
        make('custom', 'in_progress_workflow_runs', runs.filter((r) => r.status !== 'completed').length),
      ];
    }
    if (type === 'posthog' && config.provider === 'posthog') {
      const [users, events] = await Promise.all([
        posthogQuery(config, 'SELECT count(DISTINCT person_id) FROM events WHERE timestamp >= now() - INTERVAL 30 DAY'),
        posthogQuery(config, 'SELECT count() FROM events WHERE timestamp >= now() - INTERVAL 24 HOUR'),
      ]);
      return [make('user_metrics', 'active_users_30d', users), make('custom', 'events_24h', events)];
    }
    if (type === 'betterstack' && config.provider === 'betterstack') {
      const payload = (await requestJson(
        `https://uptime.betterstack.com/api/v2/monitors?url=${encodeURIComponent(config.monitorUrl)}`, config.token,
      )) as { data?: Array<{ attributes?: { url?: string; status?: string } }> };
      const match = (payload.data ?? []).find((i) => i.attributes?.url === config.monitorUrl);
      const status = match?.attributes?.status;
      if (!status) throw new Error('The matching Better Stack monitor is unavailable.');
      if (status !== 'up' && status !== 'down' && status !== 'validating') return [];
      return [make('uptime_metrics', 'availability_percent', status === 'down' ? 0 : 100)];
    }
    const teamId = config.provider === 'vercel' ? config.teamId : undefined;
    const pid = config.provider === 'vercel' ? config.projectId : '';
    const q = new URLSearchParams({ projectId: pid, limit: '100', since: String(Date.now() - 86400000) });
    if (teamId) q.set('teamId', teamId);
    const payload = (await requestJson(`https://api.vercel.com/v6/deployments?${q}`,
      (config as { token: string }).token)) as { deployments?: Array<{ state?: string; readyState?: string }> };
    const deployments = payload.deployments ?? [];
    const states = deployments.map((d) => (d.readyState ?? d.state ?? '').toUpperCase());
    return [
      make('custom', 'deployments_24h', deployments.length),
      make('error_metrics', 'failed_deployments_24h', states.filter((s) => s === 'ERROR' || s === 'CANCELED').length),
      make('custom', 'ready_deployments_24h', states.filter((s) => s === 'READY').length),
      make('custom', 'active_deployments', states.filter((s) => ['BUILDING', 'QUEUED', 'INITIALIZING'].includes(s)).length),
    ];
  }
}
