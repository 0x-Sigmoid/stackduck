import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import { Logger } from '@nestjs/common';

/**
 * Creates the citext + TimescaleDB extensions and converts metric_points
 * into a hypertable. Falls back to a plain table (+ btree index, which the
 * entity already declares) when Timescale is unavailable, unless
 * REQUIRE_TIMESCALE=true — hosting is undecided, so dev must boot anywhere.
 */
@Injectable()
export class TimescaleSetupService implements OnModuleInit {
  private readonly logger = new Logger(TimescaleSetupService.name);
  constructor(
    private readonly dataSource: DataSource,
    private readonly config: ConfigService,
  ) {}

  async onModuleInit(): Promise<void> {
    if (await this.dataSource.showMigrations()) {
      throw new Error('Pending database migrations. Run npm run migrate:prod before starting the production API.');
    }
    await this.dataSource.query('CREATE EXTENSION IF NOT EXISTS "citext"').catch((e) => {
      this.logger.warn(`citext extension unavailable: ${(e as Error).message}`);
    });
    const requireTimescale =
      (this.config.get<string>('REQUIRE_TIMESCALE') ?? 'false').toLowerCase() === 'true';
    try {
      await this.dataSource.query('CREATE EXTENSION IF NOT EXISTS timescaledb');
      const tables: Array<{ exists: boolean }> = await this.dataSource.query(
        `SELECT EXISTS (SELECT 1 FROM timescaledb_information.hypertables WHERE hypertable_name = 'metric_points') AS "exists"`,
      );
      if (!tables[0]?.exists) {
        await this.dataSource.query(
          `SELECT create_hypertable('metric_points', 'timestamp', if_not_exists => TRUE, migrate_data => TRUE)`,
        );
        this.logger.log('metric_points converted to a TimescaleDB hypertable.');
      }
      // D6 retention: raw points 30 days (aggregates are computed on read via time_bucket).
      await this.dataSource
        .query(
          `SELECT add_retention_policy('metric_points', INTERVAL '30 days', if_not_exists => TRUE)`,
        )
        .catch((e) => this.logger.warn(`retention policy skipped: ${(e as Error).message}`));
    } catch (e) {
      const msg = (e as Error).message;
      if (requireTimescale) throw new Error(`TimescaleDB required but unavailable: ${msg}`);
      this.logger.warn(
        `TimescaleDB unavailable — running on plain Postgres (time_bucket queries fall back to date_trunc). Reason: ${msg}`,
      );
    }
  }
}
