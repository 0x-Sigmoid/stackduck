import { Body, Controller, Delete, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsIn, IsInt, IsOptional, IsString, Min } from 'class-validator';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { validateWebhookTarget } from './webhook-target';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { err } from '../common/errors';
import { METRIC_TYPES, MetricType } from '../common/types';
import { AlertRule } from '../entities/alert-rule.entity';
import { Project } from '../entities/project.entity';

class CreateRuleDto {
  @IsIn(METRIC_TYPES) metricType!: MetricType;
  @IsString() key!: string;
  @IsIn(['above', 'below']) condition!: 'above' | 'below';
  @IsInt() threshold!: number;
  @IsOptional() @IsInt() @Min(1) windowMinutes?: number;
  @IsIn(['email', 'webhook']) channel!: 'email' | 'webhook';
  @IsString() channelTarget!: string;
  @IsOptional() @IsIn(['active', 'muted']) status?: 'active' | 'muted';
  @IsOptional() @IsInt() @Min(1) cooldownMinutes?: number;
}

class UpdateRuleDto {
  @IsOptional() @IsIn(METRIC_TYPES) metricType?: MetricType;
  @IsOptional() @IsString() key?: string;
  @IsOptional() @IsIn(['above', 'below']) condition?: 'above' | 'below';
  @IsOptional() @IsInt() threshold?: number;
  @IsOptional() @IsInt() @Min(1) windowMinutes?: number;
  @IsOptional() @IsIn(['email', 'webhook']) channel?: 'email' | 'webhook';
  @IsOptional() @IsString() channelTarget?: string;
  @IsOptional() @IsIn(['active', 'muted']) status?: 'active' | 'muted';
  @IsOptional() @IsInt() @Min(1) cooldownMinutes?: number;
}

@Controller('v1/projects/:projectId/alerts')
@UseGuards(JwtAuthGuard)
export class AlertsController {
  constructor(
    @InjectRepository(AlertRule) private readonly rules: Repository<AlertRule>,
    @InjectRepository(Project) private readonly projects: Repository<Project>,
    private readonly config: ConfigService,
  ) {}

  private async validateTarget(channel: string, target: string): Promise<void> {
    if (channel === 'webhook') {
      const allowLocal = this.config.get<string>('NODE_ENV') !== 'production' &&
        this.config.get<string>('ALLOW_LOCAL_ALERT_WEBHOOKS') === 'true';
      try { await validateWebhookTarget(target, allowLocal); }
      catch (e) { err(400, 'invalid_argument', (e as Error).message); }
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(target)) {
      err(400, 'invalid_argument', 'Enter a valid email address.');
    }
  }

  private async own(userId: string, projectId: string) {
    const p = await this.projects.findOne({ where: { id: projectId } });
    return p && p.ownerId === userId ? p : null;
  }

  @Get()
  async list(@Req() req: { user: { userId: string } }, @Param('projectId') projectId: string) {
    if (!(await this.own(req.user.userId, projectId))) return err(404, 'not_found', 'Project not found.');
    return { rules: await this.rules.find({ where: { projectId }, order: { createdAt: 'DESC' } }) };
  }

  @Post()
  async create(@Req() req: { user: { userId: string } }, @Param('projectId') projectId: string, @Body() dto: CreateRuleDto) {
    if (!(await this.own(req.user.userId, projectId))) return err(404, 'not_found', 'Project not found.');
    if (!dto.metricType || !dto.key || !dto.channelTarget) {
      return err(400, 'invalid_argument', '"metricType", "key" and "channelTarget" are required.');
    }
    await this.validateTarget(dto.channel, dto.channelTarget);
    const rule = await this.rules.save(this.rules.create({
      projectId, metricType: dto.metricType as never, key: dto.key,
      condition: dto.condition, threshold: dto.threshold,
      windowMinutes: dto.windowMinutes ?? 60, channel: dto.channel,
      channelTarget: dto.channelTarget, status: dto.status ?? 'active',
      cooldownMinutes: dto.cooldownMinutes ?? 60,
    }));
    return { rule };
  }

  @Patch(':ruleId')
  async update(
    @Req() req: { user: { userId: string } },
    @Param('projectId') projectId: string,
    @Param('ruleId') ruleId: string,
    @Body() dto: UpdateRuleDto,
  ) {
    if (!(await this.own(req.user.userId, projectId))) return err(404, 'not_found', 'Project not found.');
    const rule = await this.rules.findOne({ where: { id: ruleId, projectId } });
    if (!rule) return err(404, 'not_found', 'Alert rule not found.');
    await this.validateTarget(dto.channel ?? rule.channel, dto.channelTarget ?? rule.channelTarget);
    const changedCondition = ['metricType', 'key', 'condition', 'threshold', 'windowMinutes']
      .some((field) => field in dto && dto[field] !== rule[field]);
    await this.rules.update({ id: ruleId }, {
      ...dto,
      ...(changedCondition || dto.status === 'muted' ? { triggeredAt: null } : {}),
      ...(changedCondition ? { lastTriggeredAt: null } : {}),
    });
    return { rule: await this.rules.findOneOrFail({ where: { id: ruleId } }) };
  }

  @Delete(':ruleId')
  async remove(@Req() req: { user: { userId: string } }, @Param('projectId') projectId: string, @Param('ruleId') ruleId: string) {
    if (!(await this.own(req.user.userId, projectId))) return err(404, 'not_found', 'Project not found.');
    const rule = await this.rules.findOne({ where: { id: ruleId, projectId } });
    if (!rule) return err(404, 'not_found', 'Alert rule not found.');
    await this.rules.delete({ id: ruleId });
    return { ok: true };
  }
}
