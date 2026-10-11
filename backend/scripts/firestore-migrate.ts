/**
 * Phase 2 — one-time Firestore → Postgres migration (staging first).
 * Reads projects, connectors, metric buckets, alert rules, user consent
 * docs; transforms into the new Postgres schema; writes to staging;
 * verifies counts + spot-checks.
 *
 *   FIRESTORE_PROJECT=<id> STAGING_DATABASE_URL=postgres://... \
 *     npm run migrate:firestore --workspace backend
 * Flags: --dry-run (no writes), --verify (verify only, no writes)
 */
import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { Project } from '../src/entities/project.entity';
import { Connector } from '../src/entities/connector.entity';
import { MetricPoint } from '../src/entities/metric-point.entity';
import { AlertRule } from '../src/entities/alert-rule.entity';
import { User } from '../src/entities/user.entity';

export const DRY = process.argv.includes('--dry-run');
export const VERIFY_ONLY = process.argv.includes('--verify');

export function toDate(v: unknown): Date | null {
  if (!v) return null;
  if (v instanceof Date) return v;
  if (typeof (v as { toDate?: unknown }).toDate === 'function') {
    return (v as { toDate: () => Date }).toDate();
  }
  const d = new Date(v as string);
  return Number.isNaN(d.getTime()) ? null : d;
}

export async function verifyCounts(ds: DataSource, expected: Record<string, number>) {
  const actual = {
    projects: await ds.getRepository(Project).count(),
    users: await ds.getRepository(User).count(),
    connectors: await ds.getRepository(Connector).count(),
    alertRules: await ds.getRepository(AlertRule).count(),
    metricPoints: await ds.getRepository(MetricPoint).count(),
  };
  // eslint-disable-next-line no-console
  console.log('postgres counts:', actual);
  const mismatches = [
    ['projects', expected.projects, actual.projects],
    ['users', expected.users, actual.users],
    ['connectors', expected.connectors, actual.connectors],
    ['alertRules', expected.alertRules, actual.alertRules],
  ].filter(([, e, a]) => e !== a);
  if (mismatches.length) {
    // eslint-disable-next-line no-console
    console.error('COUNT MISMATCHES:', mismatches);
    process.exitCode = 1;
  }
  const sample = await ds.getRepository(Project).createQueryBuilder('p').limit(5).getMany();
  // eslint-disable-next-line no-console
  console.log('spot-check:', sample.map((p) => ({ id: p.id, name: p.name, status: p.status })));
  // eslint-disable-next-line no-console
  console.log(mismatches.length ? 'VERIFY FAILED' : 'VERIFY OK');
}

export async function main() {
  const stagingUrl = process.env.STAGING_DATABASE_URL ?? process.env.DATABASE_URL;
  if (!stagingUrl) throw new Error('Set STAGING_DATABASE_URL (staging Postgres) first.');
  initializeApp({ credential: applicationDefault(), projectId: process.env.FIRESTORE_PROJECT });
  const fs = getFirestore();
  const ds = new DataSource({
    type: 'postgres', url: stagingUrl,
    entities: [User, Project, Connector, MetricPoint, AlertRule],
    synchronize: false,
  });
  await ds.initialize();
  const projectsSnap = await fs.collection('projects').get();
  const usersSnap = await fs.collection('users').get();
  const metricsSnap = await fs.collection('metrics').get();
  const expected = { projects: projectsSnap.size, users: usersSnap.size, connectors: 0, alertRules: 0 };
  for (const p of projectsSnap.docs) {
    expected.connectors += (await p.ref.collection('connectors').get()).size;
    expected.alertRules += (await p.ref.collection('alertRules').get()).size;
  }
  // eslint-disable-next-line no-console
  console.log('firestore counts:', { ...expected, metricBuckets: metricsSnap.size });
  if (VERIFY_ONLY || DRY) {
    // eslint-disable-next-line no-console
    console.log(DRY ? 'dry run — no writes' : 'verify only — no writes');
    if (VERIFY_ONLY) await verifyCounts(ds, expected);
    await ds.destroy();
    return;
  }
  const { migrateAll } = await import('./migrate-all.js');
  await migrateAll(ds, fs, projectsSnap, usersSnap, metricsSnap);
  await verifyCounts(ds, expected);
  await ds.destroy();
}
