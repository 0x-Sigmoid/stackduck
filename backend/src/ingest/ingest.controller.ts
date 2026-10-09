import { Body, Controller, HttpCode, Param, Post, Req, UseGuards } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Throttle } from '@nestjs/throttler';
import { err } from '../common/errors';
import { METRIC_TYPES, NormalizedEvent } from '../common/types';
import { Connector } from '../entities/connector.entity';
import { MetricsService } from '../metrics/metrics.service';
import { StripeConnector } from '../connectors/providers/stripe.connector';
import { StripeGuard } from './stripe.guard';
import { WebhookGuard } from './webhook.guard';

const MAX_BATCH = 500;

/**
 * Ingest endpoints — raw-body controllers (main.ts wires express.raw for
 * these routes), signature verification via Nest guards, rate limiting via
 * @nestjs/throttler (D5: 60 req/min per connector + 500-event batch cap).
 */
@Controller()
export class IngestController {
  constructor(
    private readonly metrics: MetricsService,
    private readonly stripe: StripeConnector,
    @InjectRepository(Connector) private readonly connectors: Repository<Connector>,
  ) {}

  @Post('v1/ingest/:connectorId')
  @HttpCode(202)
  @Throttle({ default: { limit: 60, ttl: 60000 } })
  @UseGuards(WebhookGuard)
  async ingest(
    @Param('connectorId') connectorId: string,
    @Req() req: { body: Buffer; webhook: { connector: Connector; projectId: string } },
  ) {
    let payload: unknown;
    try {
      payload = JSON.parse(req.body.toString('utf8'));
    } catch {
      return err(400, 'invalid_event', 'Body must be JSON.');
    }
    const items = Array.isArray(payload) ? payload : [payload];
    if (items.length === 0 || items.length > MAX_BATCH) {
      return err(400, 'invalid_event', `Batch must hold 1–${MAX_BATCH} events.`);
    }
    const now = new Date();
    const { projectId } = req.webhook;
    const events: NormalizedEvent[] = [];
    for (let i = 0; i < items.length; i++) {
      if (!items[i] || typeof items[i] !== 'object' || Array.isArray(items[i])) {
        return err(400, 'invalid_event', 'Each event must be an object.');
      }
      const it = items[i] as Record<string, unknown>;
      if (!METRIC_TYPES.includes(it.metricType as never)) {
        return err(400, 'invalid_event', `Event ${i}: metricType must be one of ${METRIC_TYPES.join(', ')} (unknown values are rejected, never coerced to "custom").`);
      }
      if (typeof it.key !== 'string' || !it.key) return err(400, 'invalid_event', `Event ${i}: "key" must be a non-empty string.`);
      if (typeof it.value !== 'number' || !Number.isFinite(it.value)) {
        return err(400, 'invalid_event', `Event ${i}: "value" must be numeric.`);
      }
      let ts = now;
      if (it.timestamp !== undefined) {
        const parsed = new Date(it.timestamp as string);
        if (Number.isNaN(parsed.getTime())) return err(400, 'invalid_event', `Event ${i}: bad timestamp.`);
        ts = parsed;
      }
      if (it.aggregation !== undefined && !['sum', 'last'].includes(it.aggregation as string)) {
        return err(400, 'invalid_event', 'Aggregation must be sum or last.');
      }
      events.push({
        projectId, connectorId,
        metricType: it.metricType as NormalizedEvent['metricType'],
        key: it.key, value: it.value, timestamp: ts,
        aggregation: it.aggregation as NormalizedEvent['aggregation'],
        metadata: it.metadata as NormalizedEvent['metadata'],
      });
    }
    await this.metrics.writeEvents(events);
    const conn = req.webhook.connector;
    if (conn.status === 'pending') await this.connectors.update({ id: conn.id }, { status: 'connected' });
    const observed = [...new Set(events.map((e) => e.metricType))];
    const existing = new Set(conn.capabilities ?? []);
    const merged = [...existing, ...observed.filter((o) => !existing.has(o))];
    if (merged.length !== existing.size) await this.connectors.update({ id: conn.id }, { capabilities: merged });
    return { accepted: events.length, connectorStatus: 'connected' };
  }

  @Post('v1/stripe/:connectorId')
  @HttpCode(202)
  @Throttle({ default: { limit: 60, ttl: 60000 } })
  @UseGuards(StripeGuard)
  async stripeWebhook(
    @Param('connectorId') connectorId: string,
    @Req() req: { body: Buffer; stripe: { connector: Connector; projectId: string } },
    @Body() _parsed: unknown,
  ) {
    void _parsed;
    let event: { id: string; type: string; data: { object: Record<string, unknown> } };
    try {
      event = JSON.parse(req.body.toString('utf8')) as typeof event;
    } catch {
      return err(400, 'invalid_event', 'Body must be JSON.');
    }
    const { projectId } = req.stripe;
    const events = this.stripe.eventToNormalized(projectId, connectorId, new Date(), event);
    if (events.length) await this.metrics.writeEvents(events);
    await this.connectors.update({ id: connectorId }, { lastFetchedAt: new Date() });
    return { accepted: events.length, ignored: Boolean(event.type) && events.length === 0 };
  }
}
