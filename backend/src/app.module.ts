import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AlertsModule } from './alerts/alerts.module';
import { AuthModule } from './auth/auth.module';
import { BillingModule } from './billing/billing.module';
import { TimescaleSetupService } from './config/timescale-setup.service';
import { ConnectorsModule } from './connectors/connectors.module';
import { CredentialsModule } from './credentials/credentials.module';
import { AuditModule } from './common/audit.service';
import { FeedbackModule } from './feedback/feedback.module';
import { databaseOptions } from './database/options';
import { HealthController } from './health.controller';
import { IngestModule } from './ingest/ingest.module';
import { JobsModule } from './jobs/jobs.module';
import { MetricsModule } from './metrics/metrics.module';
import { ProjectsModule } from './projects/projects.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: ['backend/.env', '.env'] }),
    AuditModule,
    ScheduleModule.forRoot(),
    // Named buckets: `auth`/`signup` are the tight brute-force limits applied
    // per-route on login/refresh/register; everything else uses `default`.
    ThrottlerModule.forRoot([
      { name: 'default', ttl: 60000, limit: 300 },
      { name: 'auth', ttl: 60000, limit: 10 },
      { name: 'signup', ttl: 60000, limit: 5 },
    ]),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        ...databaseOptions(config),
        // Production applies migrations explicitly before starting the API.
        migrationsRun: config.get<string>('NODE_ENV') !== 'production',
      }),
    }),
    CredentialsModule,
    AuthModule,
    BillingModule,
    FeedbackModule,
    ProjectsModule,
    ConnectorsModule,
    MetricsModule,
    AlertsModule,
    IngestModule,
    JobsModule,
  ],
  controllers: [HealthController],
  providers: [
    TimescaleSetupService,
    // Without this the ThrottlerModule/@Throttle decorators do nothing — the
    // Phase 1 report claimed ingest rate limits that were silently inert.
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {}
