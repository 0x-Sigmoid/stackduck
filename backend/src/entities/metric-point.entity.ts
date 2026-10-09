import {
  Column,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';
import type { MetricType } from '../common/types';

/**
 * MetricPoint — TimescaleDB hypertable storing INDIVIDUAL data points
 * (project_id, metric_type, key, value, timestamp). This is a strict
 * improvement over Firestore's hand-bucketed daily documents: Timescale's
 * native time_bucket() queries replace the manual daily-document workaround
 * entirely (D2 bucket IDs, D6 retention policy, and the MAX_POINTS cap all
 * disappear — retention becomes a drop_chunks policy instead).
 */
@Entity({ name: 'metric_points' })
@Index(['projectId', 'metricType', 'key', 'timestamp'])
@Index(['connectorId', 'timestamp'])
export class MetricPoint {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: 'project_id', type: 'uuid' })
  projectId!: string;

  @Column({ name: 'connector_id', type: 'text' })
  connectorId!: string;

  @Column({ name: 'metric_type', type: 'text' })
  metricType!: MetricType;

  @Column({ type: 'text' })
  key!: string;

  @Column({ type: 'text', default: 'sum' })
  aggregation!: 'sum' | 'last';

  @Column({ type: 'double precision' })
  value!: number;

  @Column({ type: 'timestamptz', primary: true })
  timestamp!: Date;

  @Column({ type: 'jsonb', nullable: true })
  metadata?: Record<string, string | number | boolean> | null;
}
