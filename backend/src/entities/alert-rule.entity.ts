import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import type {
  AlertChannel,
  AlertCondition,
  AlertStatus,
  MetricType,
} from '../common/types';
import { Project } from './project.entity';

@Entity({ name: 'alert_rules' })
@Index(['projectId'])
export class AlertRule {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'project_id', type: 'uuid' })
  projectId!: string;

  @ManyToOne(() => Project, (p) => p.alertRules, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'project_id' })
  project?: Project;

  @Column({ name: 'metric_type', type: 'text' })
  metricType!: MetricType;

  @Column({ type: 'text' })
  key!: string;

  @Column({ type: 'text' })
  condition!: AlertCondition;

  @Column({ type: 'double precision' })
  threshold!: number;

  /** Evaluation window in minutes (Alerting Model §2). */
  @Column({ name: 'window_minutes', type: 'int', default: 60 })
  windowMinutes!: number;

  @Column({ type: 'text' })
  channel!: AlertChannel;

  @Column({ name: 'channel_target', type: 'text' })
  channelTarget!: string;

  @Column({ type: 'text', default: 'active' })
  status!: AlertStatus;

  @Column({ name: 'last_triggered_at', type: 'timestamptz', nullable: true })
  lastTriggeredAt?: Date | null;

  @Column({ name: 'cooldown_minutes', type: 'int', default: 60 })
  cooldownMinutes!: number;

  /** Current breach state, independent of notification cooldown. */
  @Column({ name: 'triggered_at', type: 'timestamptz', nullable: true })
  triggeredAt?: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
