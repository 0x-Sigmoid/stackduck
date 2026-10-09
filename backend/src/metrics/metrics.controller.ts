import { Controller, Get, Param, Query, Req, UseGuards } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { err } from '../common/errors';
import { METRIC_TYPES } from '../common/types';
import { Project } from '../entities/project.entity';
import { MetricsService } from './metrics.service';

@Controller('v1/projects/:projectId/metrics')
@UseGuards(JwtAuthGuard)
export class MetricsController {
  constructor(
    @InjectRepository(Project) private readonly projects: Repository<Project>,
    private readonly metrics: MetricsService,
  ) {}

  /** Latest value per (metricType,key) — chart key discovery for the detail page. */
  @Get('metric-keys')
  async keys(
    @Req() req: { user: { userId: string } },
    @Param('projectId') projectId: string,
  ) {
    const p = await this.projects.findOne({ where: { id: projectId } });
    if (!p || p.ownerId !== req.user.userId) return err(404, 'not_found', 'Project not found.');
    const latest = await this.metrics.latestPerKey(projectId, 10);
    return {
      keys: latest.map((m) => ({
        metricType: m.metricType, key: m.key, value: Number(m.value),
        at: m.at instanceof Date ? m.at.toISOString() : m.at,
      })),
    };
  }

  /** GET ?metricType=&key=[&from=&to=] — max 90d, mirrors the old contract. */
  @Get()
  async series(
    @Req() req: { user: { userId: string } },
    @Param('projectId') projectId: string,
    @Query('metricType') metricType: string,
    @Query('key') key: string,
    @Query('from') from: string | undefined,
    @Query('to') to: string | undefined,
  ) {
    if (!metricType || !key) return err(400, 'invalid_argument', '"metricType" and "key" are required.');
    if (!(METRIC_TYPES as readonly string[]).includes(metricType)) {
      return err(400, 'invalid_argument', `"metricType" must be one of ${METRIC_TYPES.join(', ')}.`);
    }
    const p = await this.projects.findOne({ where: { id: projectId } });
    if (!p || p.ownerId !== req.user.userId) return err(404, 'not_found', 'Project not found.');
    const end = to ? new Date(`${to}T23:59:59.999Z`) : new Date();
    const start = from ? new Date(`${from}T00:00:00.000Z`) : new Date(Date.now() - 29 * 86400000);
    const days = (end.getTime() - start.getTime()) / 86400000;
    if (Number.isNaN(days) || days < 0 || days > 90) {
      return err(400, 'invalid_argument', 'Date range must span 0–90 days (YYYY-MM-DD).');
    }
    const [buckets, points] = await Promise.all([
      this.metrics.dailySeries(projectId, metricType, key, start, end),
      this.metrics.rawPoints(projectId, metricType, key, start, end),
    ]);
    return {
      buckets: buckets.map((b) => ({
        date: b.date,
        points: points
          .filter((pt) => pt.timestamp.toISOString().slice(0, 10) === b.date)
          .map((pt) => ({ time: pt.timestamp.toISOString(), value: pt.value })),
        dailyAggregate: { sum: b.sum, avg: b.avg, max: b.max, min: b.min, last: b.last },
      })),
    };
  }
}
