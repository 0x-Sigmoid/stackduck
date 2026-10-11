import { DataSource } from 'typeorm';
import type { Firestore, QuerySnapshot } from 'firebase-admin/firestore';
import { Project } from '../src/entities/project.entity';
import { Connector } from '../src/entities/connector.entity';
import { MetricPoint } from '../src/entities/metric-point.entity';
import { AlertRule } from '../src/entities/alert-rule.entity';
import { User } from '../src/entities/user.entity';
import { toDate } from './firestore-migrate';

/** Transform + write pass (split for file-size limits). */
export async function migrateAll(
  ds: DataSource, fs: Firestore,
  projectsSnap: QuerySnapshot,
  usersSnap: QuerySnapshot,
  metricsSnap: QuerySnapshot,
) {
  const projByFid = new Map<string, string>();
  for (const u of usersSnap.docs) {
    const data = u.data() as { email?: string; consentAcceptedAt?: unknown };
    const row = await ds.getRepository(User).save(ds.getRepository(User).create({
      email: data.email?.toLowerCase() ?? null,
      consentAcceptedAt: toDate(data.consentAcceptedAt),
    }));
    void row;
  }
  for (const p of projectsSnap.docs) {
    const d = p.data() as Record<string, unknown>;
    const ownerRow = await ds.getRepository(User).save(ds.getRepository(User).create({
      email: null, consentAcceptedAt: null,
    }));
    const saved = await ds.getRepository(Project).save(ds.getRepository(Project).create({
      ownerId: ownerRow.id,
      name: d['name'] as string,
      description: (d['description'] as string) ?? null,
      stackTags: (d['stackTags'] as string[]) ?? [],
      repoUrl: (d['repoUrl'] as string) ?? null,
      liveUrl: (d['liveUrl'] as string) ?? null,
      environment: (d['environment'] as Project['environment']) ?? null,
      status: (d['status'] as Project['status']) ?? 'active',
      // Preserve the Firestore identity for verification + connector joins.
      notes: [`firestore_owner_uid=${d['ownerId']}`, `firestore_id=${p.id}`, d['notes'] as string].filter(Boolean).join('\n'),
      createdAt: toDate(d['createdAt']) ?? new Date(),
      updatedAt: toDate(d['updatedAt']) ?? new Date(),
    } as Partial<Project> as Project));
    projByFid.set(p.id, saved.id);
    const conns = await p.ref.collection('connectors').get();
    for (const c of conns.docs) {
      const cd = c.data() as Record<string, unknown>;
      // Secrets cannot migrate (Secret Manager IAM) — placeholder forces
      // the error state until the owner reconnects. Never fabricate enc.
      await ds.getRepository(Connector).upsert({
        id: c.id,
        projectId: saved.id,
        type: cd['type'] as Connector['type'],
        authType: (cd['authType'] as Connector['authType']) ?? 'api_key',
        fetchMode: (cd['fetchMode'] as Connector['fetchMode']) ?? 'poll',
        capabilities: (cd['capabilities'] as Connector['capabilities']) ?? [],
        credentialsEnc: `MIGRATION_PLACEHOLDER:${cd['credentialsRef'] ?? 'unknown'}`,
        status: 'error',
        lastError: 'Migrated from Firestore — reconnect to re-enter credentials.',
        lastHealthCheck: toDate(cd['lastHealthCheck']),
        lastFetchedAt: toDate(cd['lastFetchedAt']),
        pollIntervalMinutes: (cd['pollIntervalMinutes'] as number) ?? 30,
        createdAt: toDate(cd['createdAt']) ?? new Date(),
        updatedAt: new Date(),
      } as Connector, ['id']);
    }
    const rules = await p.ref.collection('alertRules').get();
    for (const r of rules.docs) {
      const rd = r.data() as Record<string, unknown>;
      await ds.getRepository(AlertRule).save(ds.getRepository(AlertRule).create({
        projectId: saved.id,
        metricType: rd['metricType'] as never,
        key: rd['key'] as string,
        condition: rd['condition'] as AlertRule['condition'],
        threshold: rd['threshold'] as number,
        windowMinutes: (rd['windowMinutes'] as number) ?? 60,
        channel: rd['channel'] as AlertRule['channel'],
        channelTarget: rd['channelTarget'] as string,
        status: (rd['status'] as AlertRule['status']) ?? 'active',
        lastTriggeredAt: toDate(rd['lastTriggeredAt']),
        cooldownMinutes: 60,
      }));
    }
  }
  // Metric buckets → individual points (un-bucket D2 documents back out).
  const pointRepo = ds.getRepository(MetricPoint);
  let points = 0;
  for (const b of metricsSnap.docs) {
    const d = b.data() as {
      projectId: string; metricType: string; key: string;
      points?: Array<{ time: unknown; value: number }>;
    };
    const pid = projByFid.get(d.projectId);
    if (!pid) continue;
    const rows = (d.points ?? []).map((pt) => pointRepo.create({
      projectId: pid,
      connectorId: 'migration-unknown',
      metricType: d.metricType as never,
      key: d.key,
      value: pt.value,
      timestamp: toDate(pt.time) ?? new Date(),
    }));
    if (rows.length) {
      await pointRepo.save(rows, { chunk: 500 });
      points += rows.length;
    }
  }
  // eslint-disable-next-line no-console
  console.log(`wrote ${points} metric points from ${metricsSnap.size} buckets`);
}

void import('./firestore-migrate.js').then((m) => {
  if (require.main === module) void (m.main as () => Promise<void>)().catch((e) => {
    // eslint-disable-next-line no-console
    console.error(e);
    process.exit(1);
  });
});
