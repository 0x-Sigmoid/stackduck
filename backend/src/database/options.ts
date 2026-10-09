import { ConfigService } from '@nestjs/config';
import type { PostgresConnectionOptions } from 'typeorm/driver/postgres/PostgresConnectionOptions';
import { User, RefreshToken } from '../entities/user.entity';
import { Project } from '../entities/project.entity';
import { Connector } from '../entities/connector.entity';
import { MetricPoint } from '../entities/metric-point.entity';
import { AlertRule } from '../entities/alert-rule.entity';
import { Feedback } from '../entities/feedback.entity';
import { IntegrationToken } from '../entities/integration-token.entity';
import { PasswordResetToken } from '../entities/password-reset.entity';
import { Baseline1791500000000 } from './migrations/1791500000000-baseline';
import { MonitoringReliability1791500000001 } from './migrations/1791500000001-monitoring-reliability';

export function databaseOptions(config: ConfigService): PostgresConnectionOptions {
  return {
    type: 'postgres',
    url: config.get<string>('DATABASE_URL'),
    entities: [User, RefreshToken, Project, Connector, MetricPoint, AlertRule, Feedback, IntegrationToken, PasswordResetToken],
    synchronize: false,
    migrations: [Baseline1791500000000, MonitoringReliability1791500000001],
    migrationsRun: false,
    ssl: config.get<string>('DATABASE_SSL') === 'true' ? { rejectUnauthorized: false } : false,
  };
}
