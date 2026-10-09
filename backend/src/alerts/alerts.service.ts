import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { postWebhook } from './webhook-target';
import { AlertRule } from '../entities/alert-rule.entity';
import { MetricsService } from '../metrics/metrics.service';

/**
 * Alert evaluation (Alerting Model §3–§5): scheduled every 5 minutes.
 * Sum for count-like keys, latest value for gauge-like keys. Cooldown
 * enforced via lastTriggeredAt + cooldownMinutes.
 * Delivery: email via Resend (ALERT_FROM_EMAIL + RESEND_API_KEY);
 * webhook POSTs JSON to the target.
 */
@Injectable()
export class AlertsService {
  private readonly logger = new Logger(AlertsService.name);
  private readonly resend: Resend | null;
  private readonly fromEmail: string;
  private readonly allowLocalWebhooks: boolean;
  constructor(
    @InjectRepository(AlertRule) private readonly rules: Repository<AlertRule>,
    private readonly metrics: MetricsService,
    config: ConfigService,
  ) {
    this.allowLocalWebhooks = config.get<string>('NODE_ENV') !== 'production' &&
      config.get<string>('ALLOW_LOCAL_ALERT_WEBHOOKS') === 'true';
    const apiKey = config.get<string>('RESEND_API_KEY') ?? '';
    this.fromEmail = config.get<string>('ALERT_FROM_EMAIL') ?? 'Stackduck <alerts@stackduck.app>';
    this.resend = apiKey ? new Resend(apiKey) : null;
    if (!apiKey) {
      this.logger.warn('RESEND_API_KEY is not set — alert emails will be logged, not sent.');
    }
  }

  async evaluateAll(now = new Date()): Promise<{ evaluated: number; triggered: number }> {
    const rules = await this.rules.find({
      where: { status: 'active', project: { status: In(['active', 'paused']) } },
    });
    let triggered = 0;
    for (const rule of rules) {
      try {
        if (await this.evaluateOne(rule, now)) triggered += 1;
      } catch (e) {
        this.logger.warn(`alert ${rule.id} failed: ${(e as Error).message}`);
      }
    }
    return { evaluated: rules.length, triggered };
  }

  async evaluateOne(rule: AlertRule, now = new Date()): Promise<boolean> {
    const since = new Date(now.getTime() - rule.windowMinutes * 60000);
    const agg = await this.metrics.windowAggregate(rule.projectId, rule.metricType, rule.key, since, now);
    // Missing samples are unknown, not zero.
    if (agg.count === 0) return false;
    const value = agg.value;
    const fires = rule.condition === 'above' ? value > rule.threshold : value < rule.threshold;
    if (!fires) {
      if (rule.triggeredAt) await this.rules.update({ id: rule.id }, { triggeredAt: null });
      return false;
    }
    if (!rule.triggeredAt) await this.rules.update({ id: rule.id }, { triggeredAt: now });
    if (rule.lastTriggeredAt && now.getTime() - rule.lastTriggeredAt.getTime() < rule.cooldownMinutes * 60000) {
      return false; // in cooldown
    }
    await this.deliver(rule, value);
    await this.rules.update({ id: rule.id }, { lastTriggeredAt: now });
    return true;
  }

  private async deliver(rule: AlertRule, value: number): Promise<void> {
    const payload = {
      ruleId: rule.id, projectId: rule.projectId,
      metricType: rule.metricType, key: rule.key,
      condition: rule.condition, threshold: rule.threshold,
      value, at: new Date().toISOString(),
    };
    if (rule.channel === 'webhook') {
      await postWebhook(rule.channelTarget, payload, this.allowLocalWebhooks);
    } else {
      await this.sendEmail(rule, value);
    }
  }

  private async sendEmail(rule: AlertRule, value: number): Promise<void> {
    const direction = rule.condition === 'above' ? 'rose above' : 'fell below';
    const subject = `Stackduck alert: ${rule.key} ${direction} ${rule.threshold} (now ${value})`;
    const html = [
      `<p>Your <strong>${rule.metricType} / ${rule.key}</strong> ${direction} its threshold.</p>`,
      `<p>Value: <strong>${value}</strong> · Threshold: <strong>${rule.threshold}</strong> · Window: last ${rule.windowMinutes} minutes.</p>`,
      `<p style="color:#666">Project ${rule.projectId} · Rule ${rule.id} · ${new Date().toISOString()}</p>`,
    ].join('');
    if (!this.resend) {
      this.logger.log(`EMAIL (unsent — no RESEND_API_KEY) to ${rule.channelTarget}: ${subject}`);
      throw new Error('Email delivery is not configured.');
    }
    const { error } = await this.resend.emails.send({
      from: this.fromEmail,
      to: [rule.channelTarget],
      subject,
      html,
    });
    if (error) throw new Error(`Resend delivery failed: ${error.message}`);
    this.logger.log(`EMAIL alert sent to ${rule.channelTarget}: rule ${rule.id} value ${value}`);
  }
}
