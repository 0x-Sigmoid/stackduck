import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, Repository } from 'typeorm';
import { metricAggregation } from '../common/metric-aggregation';
import type { NormalizedEvent } from '../common/types';
import { MetricPoint } from '../entities/metric-point.entity';

/**
 * Metrics writer/reader. Writes store individual points (no hand-bucketing);
 * reads aggregate with Timescale time_bucket() when available, falling back
 * to date_trunc() on plain Postgres (same numbers, slightly slower).
 */
@Injectable()
export class MetricsService {
  private timeBucketFn: 'time_bucket' | 'date_trunc' | null = null;
  constructor(
    @InjectRepository(MetricPoint) private readonly points: Repository<MetricPoint>,
  ) {}

  async writeEvents(events: NormalizedEvent[]): Promise<number> {
    if (events.length === 0) return 0;
    const rows = events.map((e) =>
      this.points.create({
        projectId: e.projectId, connectorId: e.connectorId,
        metricType: e.metricType, key: e.key, value: e.value,
        timestamp: e.timestamp, metadata: e.metadata ?? null,
        aggregation: e.aggregation ?? metricAggregation(e.metricType, e.key),
      }),
    );
    await this.points.save(rows, { chunk: 500 });
    return rows.length;
  }

  private async bucketFn(): Promise<'time_bucket' | 'date_trunc'> {
    if (this.timeBucketFn) return this.timeBucketFn;
    try {
      await this.points.query('SELECT time_bucket(INTERVAL \'1 day\', now())');
      this.timeBucketFn = 'time_bucket';
    } catch {
      this.timeBucketFn = 'date_trunc';
    }
    return this.timeBucketFn;
  }

  /** Daily rollup for one (project, metricType, key) in [from, to]. */
  async dailySeries(projectId: string, metricType: string, key: string, from: Date, to: Date) {
    const fn = await this.bucketFn();
    const bucket = fn === 'time_bucket'
      ? `time_bucket(INTERVAL '1 day', "timestamp")`
      : `date_trunc('day', "timestamp")`;
    // `last` (latest value in the day) powers the UI hero stats. Timescale
    // has last(); plain Postgres falls back to ordered array_agg.
    const last = fn === 'time_bucket'
      ? `last("value", "timestamp")`
      : `(array_agg("value" ORDER BY "timestamp" DESC))[1]`;
    const rows = await this.points.query(
      `SELECT ${bucket} AS "day", COUNT(*)::int AS "count",
              SUM("value") AS "sum", AVG("value") AS "avg",
              MAX("value") AS "max", MIN("value") AS "min",
              ${last} AS "last"
         FROM "metric_points"
        WHERE "project_id" = $1 AND "metric_type" = $2 AND "key" = $3
          AND "timestamp" >= $4 AND "timestamp" <= $5
        GROUP BY 1 ORDER BY 1 ASC`,
      [projectId, metricType, key, from.toISOString(), to.toISOString()],
    );
    return (rows as Array<{ day: Date; count: number; sum: string; avg: string; max: string; min: string; last: string | null }>).map((r) => ({
      date: new Date(r.day).toISOString().slice(0, 10),
      count: r.count,
      sum: Number(r.sum), avg: Number(r.avg), max: Number(r.max), min: Number(r.min),
      ...(r.last === null ? {} : { last: Number(r.last) }),
    }));
  }

  /** Raw points for one key in [from, to] (cap 5000, newest last). */
  async rawPoints(projectId: string, metricType: string, key: string, from: Date, to: Date, limit = 5000) {
    return this.points.find({
      where: { projectId, metricType: metricType as never, key, timestamp: Between(from, to) },
      order: { timestamp: 'ASC' },
      take: Math.min(limit, 5000),
    });
  }

  /** Latest value per (metricType,key) — powers the project-list keyMetrics. */
  async latestPerKey(projectId: string, limit = 10) {
    const rows = await this.points.query(
      `SELECT DISTINCT ON ("metric_type", "key") "metric_type" AS "metricType", "key",
              "value", "timestamp" AS "at"
         FROM "metric_points" WHERE "project_id" = $1
         ORDER BY "metric_type", "key", "timestamp" DESC LIMIT $2`,
      [projectId, limit],
    );
    return rows as Array<{ metricType: string; key: string; value: number; at: Date }>;
  }

  /** Sum event increments plus the latest snapshot per connector in the window. */
  async windowAggregate(
    projectId: string, metricType: string, key: string, since: Date, until = new Date(),
  ): Promise<{ sum: number; last: number; count: number; value: number }> {
    const rows = await this.points.query(
      `WITH window_points AS (
         SELECT * FROM metric_points
          WHERE project_id = $1 AND metric_type = $2 AND key = $3
            AND timestamp >= $4 AND timestamp <= $5
       ), snapshots AS (
         SELECT DISTINCT ON (connector_id) value FROM window_points
          WHERE aggregation = 'last'
          ORDER BY connector_id, timestamp DESC, id DESC
       )
       SELECT COALESCE(SUM(value), 0) AS sum, COUNT(*)::int AS count,
              COALESCE((SELECT value FROM window_points ORDER BY timestamp DESC, id DESC LIMIT 1), 0) AS last,
              COALESCE(SUM(value) FILTER (WHERE aggregation = 'sum'), 0) +
                COALESCE((SELECT SUM(value) FROM snapshots), 0) AS value
         FROM window_points`,
      [projectId, metricType, key, since.toISOString(), until.toISOString()],
    );
    const r = (rows as Array<{ sum: string; count: number; last: string; value: string }>)[0];
    return { sum: Number(r.sum), last: Number(r.last), count: r.count, value: Number(r.value) };
  }
}
