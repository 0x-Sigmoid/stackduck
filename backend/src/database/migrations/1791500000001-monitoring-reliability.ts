import type { MigrationInterface, QueryRunner } from 'typeorm';

export class MonitoringReliability1791500000001 implements MigrationInterface {
  async up(runner: QueryRunner): Promise<void> {
    const table = await runner.getTable('metric_points');
    if (!table) throw new Error('metric_points must exist before applying monitoring reliability.');
    if (!table.primaryColumns.some((column) => column.name === 'timestamp')) {
      await runner.dropPrimaryKey(table);
      await runner.createPrimaryKey('metric_points', ['id', 'timestamp']);
    }
    await runner.query("ALTER TABLE metric_points ADD COLUMN IF NOT EXISTS aggregation text NOT NULL DEFAULT 'sum'");
    // Freeze the compatibility mapping in this version; future migrations
    // must never change behavior by importing a mutable runtime mapping.
    await runner.query(`UPDATE metric_points SET aggregation = 'last'
      WHERE metric_type = 'uptime_metrics' OR key = ANY($1::text[])`, [[
      'total_users', 'active_users', 'active_users_30d', 'availability_percent',
      'events_received_24h', 'workflow_runs_24h', 'failed_workflow_runs_24h',
      'in_progress_workflow_runs', 'events_24h', 'deployments_24h',
      'failed_deployments_24h', 'ready_deployments_24h', 'active_deployments',
      'revenue_30d', 'failed_24h',
    ]]);
    await runner.query('ALTER TABLE alert_rules ADD COLUMN IF NOT EXISTS triggered_at timestamptz');
  }

  async down(): Promise<void> {
    throw new Error('Monitoring reliability is forward-only because timestamp is required by TimescaleDB.');
  }
}
