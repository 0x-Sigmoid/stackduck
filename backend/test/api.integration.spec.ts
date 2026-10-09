import 'reflect-metadata';
import crypto from 'node:crypto';
import { createServer, Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import type { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import { databaseOptions } from '../src/database/options';
import { TimescaleSetupService } from '../src/config/timescale-setup.service';

const databaseUrl = process.env.TEST_DATABASE_URL;
const integration = databaseUrl ? describe : describe.skip;

integration('real monitoring API and migrations', () => {
  let app: INestApplication;
  let db: DataSource;
  let receiver: Server;
  let base: string;
  let token: string;
  let projectId: string;
  let connectorId: string;
  let signingSecret: string;
  let target: string;
  let received: Array<{ value: number }>;
  const request = async (path: string, method = 'GET', payload?: unknown) => {
    const response = await fetch(base + path, {
      method, headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
      ...(payload === undefined ? {} : { body: JSON.stringify(payload) }),
    });
    return { status: response.status, body: await response.json() as any };
  };
  const ingest = async (events: unknown[]) => {
    const body = JSON.stringify(events);
    const timestamp = String(Math.floor(Date.now() / 1000));
    const signature = crypto.createHmac('sha256', signingSecret).update(timestamp + '.' + body).digest('hex');
    const response = await fetch(base + '/v1/ingest/' + connectorId, {
      method: 'POST', body, headers: {
        'Content-Type': 'application/json', 'X-Stackduck-Timestamp': timestamp, 'X-Stackduck-Signature': signature,
      },
    });
    expect(response.status).toBe(202);
  };

  beforeAll(async () => {
    if (!new URL(databaseUrl!).pathname.startsWith('/stackduck_test_')) {
      throw new Error('Integration tests require a disposable database named stackduck_test_*.');
    }
    Object.assign(process.env, {
      DATABASE_URL: databaseUrl, DATABASE_SSL: 'false', NODE_ENV: 'test',
      REQUIRE_TIMESCALE: process.env.TEST_REQUIRE_TIMESCALE ?? 'false',
      ALLOW_LOCAL_ALERT_WEBHOOKS: 'true', RESEND_API_KEY: '',
      JWT_ACCESS_SECRET: crypto.randomBytes(48).toString('hex'),
      CREDENTIALS_ENCRYPTION_KEY: crypto.randomBytes(32).toString('base64'),
      PUBLIC_APP_URL: 'http://localhost:5173',
    });
    // Import after overriding configuration so the production module uses
    // only the disposable test database, never a developer's .env database.
    const { createApiApp } = await import('../src/bootstrap');
    app = await createApiApp();
    // Silence routine Nest startup/audit logs while keeping HTTP assertions visible.
    app.useLogger(false);
    await app.listen(0, '127.0.0.1');
    base = await app.getUrl();
    db = app.get(DataSource);
    received = [];
    receiver = createServer((req, res) => {
      let raw = '';
      req.on('data', (data) => raw += data);
      req.on('end', () => { received.push(JSON.parse(raw)); res.writeHead(200).end(); });
    });
    await new Promise<void>((resolve) => receiver.listen(0, '127.0.0.1', resolve));
    target = 'http://127.0.0.1:' + (receiver.address() as AddressInfo).port + '/hook';
    const register = await request('/v1/auth/register', 'POST', {
      email: 'review-' + crypto.randomUUID() + '@example.com', password: 'test-password-123', consent: true,
    });
    expect(register.status).toBe(201);
    token = register.body.accessToken;
    const project = await request('/v1/projects', 'POST', { name: 'Regression project' });
    expect(project.status).toBe(201);
    projectId = project.body.project.id;
    const connector = await request('/v1/projects/' + projectId + '/connectors/generic-webhook', 'POST', {});
    expect(connector.status).toBe(201);
    connectorId = connector.body.connector.id;
    signingSecret = connector.body.signingSecret;
  }, 60_000);

  afterAll(async () => {
    if (receiver) await new Promise<void>((resolve) => receiver.close(() => resolve()));
    if (app) await app.close();
  });

  it('bootstraps matching tables and records versioned migrations', async () => {
    const runner = db.createQueryRunner();
    try {
      for (const entity of db.entityMetadatas) {
        const table = await runner.getTable(entity.tableName);
        expect(table).toBeDefined();
        for (const column of entity.columns) {
          const actual = table!.findColumnByName(column.databaseName);
          expect(actual).toBeDefined();
          expect(actual!.isPrimary).toBe(column.isPrimary);
          expect(actual!.isNullable).toBe(column.isNullable);
        }
      }
      expect((await db.query('SELECT count(*)::int AS count FROM migrations'))[0].count).toBe(2);
      if (process.env.TEST_REQUIRE_TIMESCALE === 'true') {
        const rows = await db.query("SELECT hypertable_name FROM timescaledb_information.hypertables WHERE hypertable_name = 'metric_points'");
        expect(rows).toHaveLength(1);
      }
    } finally { await runner.release(); }
  });

  it('ingests signed snapshots and loads the complete project detail contract', async () => {
    const now = new Date().toISOString();
    const yesterday = new Date(Date.now() - 3 * 86400000).toISOString();
    await ingest([
      { metricType: 'error_metrics', key: 'failed_workflow_runs_24h', value: 5, timestamp: now },
      { metricType: 'error_metrics', key: 'failed_workflow_runs_24h', value: 5, timestamp: now },
      { metricType: 'error_metrics', key: 'failed_workflow_runs_24h', value: 99, timestamp: yesterday },
    ]);
    // Use the actual route from the React loader to guard against another
    // frontend/backend mismatch, rather than testing a separately copied URL.
    const { readFileSync } = await import('node:fs');
    const { resolve } = await import('node:path');
    const detailSource = readFileSync(resolve(__dirname, '../../src/pages/ProjectDetail.tsx'), 'utf8');
    const keyPath = detailSource.match(/\x60(\/v1\/projects\/\$\{projectId\}\/[^\x60]*metric-keys)\x60/);
    expect(keyPath).not.toBeNull();
    const keys = await request(keyPath![1].replace('${projectId}', projectId));
    expect(keys.status).toBe(200);
    expect(keys.body.keys.some((key: any) => key.key === 'failed_workflow_runs_24h')).toBe(true);
    for (const suffix of ['', '/connectors', '/alerts']) {
      expect((await request('/v1/projects/' + projectId + suffix)).status).toBe(200);
    }
    const today = now.slice(0, 10);
    const series = await request('/v1/projects/' + projectId + '/metrics?metricType=error_metrics&key=failed_workflow_runs_24h&from=' + today + '&to=' + today);
    expect(series.status).toBe(200);
    expect(series.body.buckets[0].dailyAggregate.last).toBe(5);
    expect(series.body.buckets[0].points).toHaveLength(2);
    // A narrower range still returns recent points once the global raw-point
    // cap is exceeded by historical data.
    const raw = await app.get((await import('../src/metrics/metrics.service')).MetricsService)
      .rawPoints(projectId, 'error_metrics', 'failed_workflow_runs_24h', new Date(today), new Date(today + 'T23:59:59.999Z'), 2);
    expect(raw.every((point) => point.value === 5)).toBe(true);
  });

  it('does not double-count snapshots, then delivers and resolves real alerts', async () => {
    const { AlertsService } = await import('../src/alerts/alerts.service');
    const service = app.get(AlertsService);
    const ruleResult = await request('/v1/projects/' + projectId + '/alerts', 'POST', {
      metricType: 'error_metrics', key: 'failed_workflow_runs_24h', condition: 'above',
      threshold: 7, windowMinutes: 60, cooldownMinutes: 60, channel: 'webhook', channelTarget: target,
    });
    expect(ruleResult.status).toBe(201);
    expect((await service.evaluateAll()).triggered).toBe(0);
    expect(received).toHaveLength(0);
    expect((await request('/v1/projects/' + projectId)).body.homeStatus).toBe('green');

    await ingest([{ metricType: 'error_metrics', key: 'failed_workflow_runs_24h', value: 9 }]);
    expect((await service.evaluateAll()).triggered).toBe(1);
    expect(received).toEqual([expect.objectContaining({ value: 9 })]);
    expect((await request('/v1/projects')).body.projects[0].homeStatus).toBe('red');
    expect((await service.evaluateAll()).triggered).toBe(0);
    expect(received).toHaveLength(1);

    await ingest([{ metricType: 'error_metrics', key: 'failed_workflow_runs_24h', value: 0 }]);
    expect((await service.evaluateAll()).triggered).toBe(0);
    expect((await request('/v1/projects')).body.projects[0].homeStatus).toBe('green');
  });

  it('rejects private destinations on rule creation and update', async () => {
    const rule = {
      metricType: 'custom', key: 'errors', condition: 'above', threshold: 1,
      channel: 'webhook', channelTarget: 'https://169.254.169.254/latest/meta-data',
    };
    expect((await request('/v1/projects/' + projectId + '/alerts', 'POST', rule)).status).toBe(400);
    const created = await request('/v1/projects/' + projectId + '/alerts', 'POST', { ...rule, channelTarget: target });
    expect(created.status).toBe(201);
    expect((await request('/v1/projects/' + projectId + '/alerts/' + created.body.rule.id, 'PATCH', {
      channelTarget: 'https://10.0.0.1/internal',
    })).status).toBe(400);
  });

  it('keeps event increments additive and takes latest snapshots per connector', async () => {
    const { MetricsService } = await import('../src/metrics/metrics.service');
    const metrics = app.get(MetricsService);
    const now = new Date();
    await metrics.writeEvents([
      { projectId, connectorId: 'one', metricType: 'custom', key: 'mixed', value: 3, timestamp: now, aggregation: 'sum' },
      { projectId, connectorId: 'one', metricType: 'custom', key: 'mixed', value: 5, timestamp: now, aggregation: 'last' },
      { projectId, connectorId: 'one', metricType: 'custom', key: 'mixed', value: 6, timestamp: now, aggregation: 'last' },
      { projectId, connectorId: 'two', metricType: 'custom', key: 'mixed', value: 4, timestamp: now, aggregation: 'last' },
      { projectId, connectorId: 'future', metricType: 'custom', key: 'mixed', value: 99, timestamp: new Date(now.getTime() + 86400000), aggregation: 'sum' },
    ]);
    const result = await metrics.windowAggregate(projectId, 'custom', 'mixed', new Date(now.getTime() - 60000), now);
    expect(result.value).toBe(13);
    expect(result.count).toBe(4);
  });

  it('upgrades an existing id-only table without losing metric history', async () => {
    const legacyName = 'stackduck_test_legacy_' + Date.now();
    await db.query('CREATE DATABASE "' + legacyName + '"');
    const legacyUrl = new URL(databaseUrl!);
    legacyUrl.pathname = '/' + legacyName;
    const legacy = new DataSource({ ...databaseOptions(new ConfigService()), url: legacyUrl.toString(), ssl: false });
    try {
      await legacy.initialize();
      await legacy.query(`CREATE TABLE metric_points (
        id serial PRIMARY KEY, project_id uuid NOT NULL, connector_id text NOT NULL,
        metric_type text NOT NULL, key text NOT NULL, value double precision NOT NULL,
        timestamp timestamptz NOT NULL, metadata jsonb
      )`);
      await legacy.query(`INSERT INTO metric_points(project_id, connector_id, metric_type, key, value, timestamp)
        VALUES($1, 'legacy', 'error_metrics', 'failed_workflow_runs_24h', 5, now())`, [projectId]);
      await legacy.runMigrations({ transaction: 'all' });
      const points = await legacy.query('SELECT value, aggregation FROM metric_points');
      expect(points).toEqual([{ value: 5, aggregation: 'last' }]);
      await new TimescaleSetupService(legacy, new ConfigService({
        REQUIRE_TIMESCALE: process.env.TEST_REQUIRE_TIMESCALE ?? 'false',
      })).onModuleInit();
      if (process.env.TEST_REQUIRE_TIMESCALE === 'true') {
        expect(await legacy.query("SELECT hypertable_name FROM timescaledb_information.hypertables WHERE hypertable_name = 'metric_points'")).toHaveLength(1);
      }
      expect(await legacy.runMigrations()).toHaveLength(0);
    } finally { if (legacy.isInitialized) await legacy.destroy(); }
  });
});
