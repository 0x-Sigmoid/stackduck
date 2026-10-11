import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';
import type {
  ConnectorAuthType,
  ConnectorFetchMode,
  ConnectorStatus,
  ConnectorType,
  MetricType,
} from '../common/types';
import { Project } from './project.entity';
import type { Relation } from 'typeorm';

@Entity({ name: 'connectors' })
@Index(['projectId', 'type'])
export class Connector {
  @PrimaryColumn({ type: 'text' })
  id!: string;

  @Index()
  @Column({ name: 'project_id', type: 'uuid' })
  projectId!: string;

  @ManyToOne(() => Project, (p) => p.connectors, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'project_id' })
  project?: Relation<Project>;

  @Column({ type: 'text' })
  type!: ConnectorType;

  @Column({ name: 'auth_type', type: 'text' })
  authType!: ConnectorAuthType;

  @Column({ name: 'fetch_mode', type: 'text' })
  fetchMode!: ConnectorFetchMode;

  @Column({ type: 'text', array: true, default: '{}' })
  capabilities!: MetricType[];

  /**
   * Credential storage (Step 6 decision: encrypted Postgres columns).
   * AES-256-GCM ciphertext (`v1:<iv>:<tag>:<ct>` base64) — never plaintext,
   * never returned to clients. Replaces Secret Manager credentialsRef.
   */
  @Column({ name: 'credentials_enc', type: 'text' })
  credentialsEnc!: string;

  /** Previous secret during 24h webhook rotation grace (nullable). */
  @Column({ name: 'previous_credentials_enc', type: 'text', nullable: true })
  previousCredentialsEnc?: string | null;

  @Column({ name: 'grace_until', type: 'timestamptz', nullable: true })
  graceUntil?: Date | null;

  @Column({ type: 'text', default: 'pending' })
  status!: ConnectorStatus;

  @Column({ name: 'last_error', type: 'text', nullable: true })
  lastError?: string | null;

  @Column({ name: 'last_health_check', type: 'timestamptz', nullable: true })
  lastHealthCheck?: Date | null;

  @Column({ name: 'last_fetched_at', type: 'timestamptz', nullable: true })
  lastFetchedAt?: Date | null;

  @Column({ name: 'poll_interval_minutes', type: 'int', nullable: true })
  pollIntervalMinutes?: number | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
