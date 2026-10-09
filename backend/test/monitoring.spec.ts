import 'reflect-metadata';
import { ConfigService } from '@nestjs/config';
import { AlertsService } from '../src/alerts/alerts.service';
import { MetricsController } from '../src/metrics/metrics.controller';
import { MetricsService } from '../src/metrics/metrics.service';
import { ProjectsController } from '../src/projects/projects.controller';
import { AlertRule } from '../src/entities/alert-rule.entity';
import { metricAggregation } from '../src/common/metric-aggregation';

describe('monitoring regressions', () => {
  const now = new Date('2026-10-09T12:00:00Z');
  const rule = () => Object.assign(new AlertRule(), {
    id: 'rule', projectId: 'project', metricType: 'error_metrics', key: 'failed_workflow_runs_24h',
    condition: 'above', threshold: 7, windowMinutes: 60, cooldownMinutes: 60,
    channel: 'webhook', channelTarget: 'https://example.com/hook',
  });
  let repo: any;
  let metrics: any;
  let alerts: AlertsService;
  let delivery: jest.SpyInstance;

  beforeEach(() => {
    repo = { update: jest.fn().mockResolvedValue({}), find: jest.fn().mockResolvedValue([]) };
    metrics = { windowAggregate: jest.fn().mockResolvedValue({ value: 5, sum: 10, last: 5, count: 2 }) };
    alerts = new AlertsService(repo, metrics, new ConfigService({ RESEND_API_KEY: '' }));
    delivery = jest.spyOn(alerts as any, 'deliver').mockResolvedValue(undefined);
  });

  it('does not sum repeated rolling snapshots when evaluating thresholds', async () => {
    expect(await alerts.evaluateOne(rule(), now)).toBe(false);
    expect(delivery).not.toHaveBeenCalled();
    expect(metrics.windowAggregate.mock.calls[0][4]).toEqual(now);
  });

  it('records breach state and delivers the aggregated value', async () => {
    metrics.windowAggregate.mockResolvedValue({ value: 9, sum: 18, last: 9, count: 2 });
    expect(await alerts.evaluateOne(rule(), now)).toBe(true);
    expect(repo.update).toHaveBeenCalledWith({ id: 'rule' }, { triggeredAt: now });
    expect(delivery).toHaveBeenCalledWith(expect.any(AlertRule), 9);
    expect(repo.update).toHaveBeenCalledWith({ id: 'rule' }, { lastTriggeredAt: now });
  });

  it('tracks a current breach even when notification is in cooldown', async () => {
    const current = rule();
    current.lastTriggeredAt = now;
    metrics.windowAggregate.mockResolvedValue({ value: 9, count: 1 });
    expect(await alerts.evaluateOne(current, now)).toBe(false);
    expect(repo.update).toHaveBeenCalledWith({ id: 'rule' }, { triggeredAt: now });
    expect(delivery).not.toHaveBeenCalled();
  });

  it('clears breach state when the threshold resolves', async () => {
    const current = rule();
    current.triggeredAt = now;
    expect(await alerts.evaluateOne(current, now)).toBe(false);
    expect(repo.update).toHaveBeenCalledWith({ id: 'rule' }, { triggeredAt: null });
  });

  it('does not treat missing data as zero for below-threshold rules', async () => {
    const current = rule();
    current.condition = 'below';
    metrics.windowAggregate.mockResolvedValue({ value: 0, count: 0 });
    expect(await alerts.evaluateOne(current, now)).toBe(false);
    expect(repo.update).not.toHaveBeenCalled();
    expect(delivery).not.toHaveBeenCalled();
  });

  it('does not consume notification cooldown after a delivery failure', async () => {
    metrics.windowAggregate.mockResolvedValue({ value: 9, count: 1 });
    delivery.mockRejectedValue(new Error('delivery failed'));
    await expect(alerts.evaluateOne(rule(), now)).rejects.toThrow('delivery failed');
    expect(repo.update).not.toHaveBeenCalledWith({ id: 'rule' }, { lastTriggeredAt: now });
  });

  it('keeps gauges and rolling totals separate from event increments', () => {
    expect(metricAggregation('error_metrics', 'failed_workflow_runs_24h')).toBe('last');
    expect(metricAggregation('custom', 'events_24h')).toBe('last');
    expect(metricAggregation('uptime_metrics', 'latency')).toBe('last');
    expect(metricAggregation('user_metrics', 'signups')).toBe('sum');
  });

  it('uses explicit aggregation declared by an ingest event', async () => {
    const points: any = { create: jest.fn((row) => row), save: jest.fn() };
    await new MetricsService(points).writeEvents([{
      projectId: 'project', connectorId: 'connector', metricType: 'custom',
      key: 'queue_depth', value: 5, timestamp: now, aggregation: 'last',
    }]);
    expect(points.save.mock.calls[0][0][0].aggregation).toBe('last');
  });

  it('returns last in dailyAggregate including a legitimate zero', async () => {
    const controller = new MetricsController(
      { findOne: async () => ({ ownerId: 'owner' }) } as any,
      { dailySeries: async () => [{ date: '2026-10-09', sum: 5, avg: 2.5, min: 0, max: 5, last: 0 }],
        rawPoints: async () => [] } as any,
    );
    const response = await controller.series({ user: { userId: 'owner' } }, 'project', 'custom', 'queue_depth', '2026-10-09', '2026-10-09');
    expect(response.buckets[0].dailyAggregate.last).toBe(0);
  });

  it('reports current breached rules as red in both project endpoints', async () => {
    const project = { id: 'project', ownerId: 'owner' };
    const controller = new ProjectsController(
      { find: async () => [project], findOne: async () => project } as any,
      { find: async () => [{ status: 'connected' }] } as any,
      {} as any, { latestPerKey: async () => [] } as any, {} as any,
      { find: async () => [{ projectId: 'project' }], exists: async () => true } as any,
    );
    expect((await controller.list({ user: { userId: 'owner' } })).projects[0].homeStatus).toBe('red');
    expect((await controller.getOne({ user: { userId: 'owner' } }, 'project')).homeStatus).toBe('red');
  });
});
