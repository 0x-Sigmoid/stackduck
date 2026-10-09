import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsArray, IsIn, IsOptional, IsString } from 'class-validator';
import { In, IsNull, Not, Repository } from 'typeorm';
import { AlertRule } from '../entities/alert-rule.entity';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AuditService } from '../common/audit.service';
import { err } from '../common/errors';
import { projectHomeStatus } from '../common/types';
import { Connector } from '../entities/connector.entity';
import { MetricPoint } from '../entities/metric-point.entity';
import { Project } from '../entities/project.entity';
import { MetricsService } from '../metrics/metrics.service';

const STATUSES = ['active', 'paused', 'archived'] as const;

class CreateProjectDto {
  @IsString() name!: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsArray() @IsString({ each: true }) stackTags?: string[];
  @IsOptional() @IsString() repoUrl?: string;
  @IsOptional() @IsString() liveUrl?: string;
  @IsOptional() @IsIn(['production', 'staging', 'development']) environment?: 'production' | 'staging' | 'development';
  @IsOptional() @IsString() notes?: string;
}

class UpdateProjectDto {
  @IsOptional() @IsString() name?: string | null;
  @IsOptional() @IsString() description?: string | null;
  @IsOptional() @IsArray() @IsString({ each: true }) stackTags?: string[] | null;
  @IsOptional() @IsString() repoUrl?: string | null;
  @IsOptional() @IsString() liveUrl?: string | null;
  @IsOptional() @IsIn(['production', 'staging', 'development']) environment?: 'production' | 'staging' | 'development' | null;
  @IsOptional() @IsString() notes?: string | null;
  @IsOptional() @IsIn(['active', 'paused', 'archived']) status?: 'active' | 'paused' | 'archived';
}

@Controller('v1/projects')
@UseGuards(JwtAuthGuard)
export class ProjectsController {
  constructor(
    @InjectRepository(Project) private readonly projects: Repository<Project>,
    @InjectRepository(Connector) private readonly connectors: Repository<Connector>,
    @InjectRepository(MetricPoint) private readonly points: Repository<MetricPoint>,
    private readonly metrics: MetricsService,
    private readonly audit: AuditService,
    @InjectRepository(AlertRule) private readonly rules: Repository<AlertRule>,
  ) {}

  @Post()
  async create(@Req() req: { user: { userId: string } }, @Body() dto: CreateProjectDto) {
    if (!dto.name?.trim()) return err(400, 'invalid_argument', 'Project "name" is required.');
    const p = await this.projects.save(this.projects.create({
      ownerId: req.user.userId,
      name: dto.name.trim(),
      status: 'active',
      description: dto.description,
      stackTags: dto.stackTags ?? [],
      repoUrl: dto.repoUrl,
      liveUrl: dto.liveUrl,
      environment: dto.environment,
      notes: dto.notes,
    }));
    this.audit.event('project.created', { project_id: p.id, owner_id: p.ownerId });
    return { project: p };
  }

  /** Enriched list for Portfolio cards (avoids N+1 on the client). */
  @Get()
  async list(@Req() req: { user: { userId: string } }, @Query('status') status?: string) {
    const where: Record<string, unknown> = { ownerId: req.user.userId };
    if (status && (STATUSES as readonly string[]).includes(status)) where['status'] = status;
    const projects = await this.projects.find({ where, order: { updatedAt: 'DESC' } });
    const breached = projects.length ? await this.rules.find({
      where: { projectId: In(projects.map((p) => p.id)), status: 'active', triggeredAt: Not(IsNull()) },
      select: ['projectId'],
    }) : [];
    const breachedIds = new Set(breached.map((r) => r.projectId));
    return {
      projects: await Promise.all(projects.map(async (project) => {
        const conns = await this.connectors.find({ where: { projectId: project.id } });
        const connectorStatuses = conns.map((c) => c.status);
        const latest = await this.metrics.latestPerKey(project.id, 10);
        const keyMetrics = latest.slice(0, 3).map((m) => ({
          metricType: m.metricType, key: m.key, value: Number(m.value), at: m.at,
        }));
        const homeStatus = projectHomeStatus({ hasTriggeredUnresolvedAlert: breachedIds.has(project.id), connectorStatuses });
        return { project, connectorStatuses, keyMetrics, homeStatus };
      })),
    };
  }

  @Patch(':projectId')
  async update(
    @Req() req: { user: { userId: string } },
    @Param('projectId') projectId: string,
    @Body() dto: UpdateProjectDto,
  ) {
    const p = await this.projects.findOne({ where: { id: projectId } });
    if (!p || p.ownerId !== req.user.userId) return err(404, 'not_found', 'Project not found.');
    const patch: Record<string, unknown> = {};
    for (const f of ['name', 'description', 'stackTags', 'repoUrl', 'liveUrl', 'environment', 'notes', 'status'] as const) {
      if (!(f in dto)) continue;
      const v = dto[f] as unknown;
      if (f === 'name' && v !== null && (typeof v !== 'string' || !v.trim())) {
        return err(400, 'invalid_argument', 'Project "name" must not be blank.');
      }
      if (f === 'status' && !(STATUSES as readonly string[]).includes(v as string)) {
        return err(400, 'invalid_argument', 'Invalid status.');
      }
      patch[f] = v === null ? null : (f === 'name' ? (v as string).trim() : v);
    }
    await this.projects.update({ id: projectId }, patch);
    return { project: await this.projects.findOneOrFail({ where: { id: projectId } }) };
  }

  /** Soft-archive per D8; ingest goes 410. `?forever=true` hard-deletes everything. */
  @Delete(':projectId')
  async remove(
    @Req() req: { user: { userId: string } },
    @Param('projectId') projectId: string,
    @Query('forever') forever?: string,
  ) {
    const p = await this.projects.findOne({ where: { id: projectId } });
    if (!p || p.ownerId !== req.user.userId) return err(404, 'not_found', 'Project not found.');
    if (forever === 'true') {
      const conns = await this.connectors.find({ where: { projectId } });
      await this.points.delete({ projectId });
      // Connectors + alert rules cascade off the project FK; metric points
      // carry no FK so they go first, explicitly.
      await this.projects.delete({ id: projectId });
      this.audit.event('project.deleted', { project_id: projectId, owner_id: p.ownerId, disabled_connectors: conns.length, forever: true });
      return { ok: true, deletedConnectors: conns.length };
    }
    const conns = await this.connectors.find({ where: { projectId } });
    await this.projects.update({ id: projectId }, { status: 'archived' });
    for (const c of conns) await this.connectors.update({ id: c.id }, { status: 'error' });
    this.audit.event('project.deleted', { project_id: projectId, owner_id: p.ownerId, disabled_connectors: conns.length });
    return {
      project: { ...p, status: 'archived' as const },
      disabledConnectors: conns.length,
      note: 'Ingest URLs now return 410 Gone.',
    };
  }

  @Get(':projectId')
  async getOne(@Req() req: { user: { userId: string } }, @Param('projectId') projectId: string) {
    const p = await this.projects.findOne({ where: { id: projectId } });
    if (!p || p.ownerId !== req.user.userId) return err(404, 'not_found', 'Project not found.');
    const conns = await this.connectors.find({ where: { projectId } });
    const connectorStatuses = conns.map((c) => c.status);
    const latest = await this.metrics.latestPerKey(projectId, 10);
    const keyMetrics = latest.slice(0, 3).map((m) => ({
      metricType: m.metricType, key: m.key, value: Number(m.value), at: m.at,
    }));
    const hasTriggeredUnresolvedAlert = await this.rules.exists({
      where: { projectId, status: 'active', triggeredAt: Not(IsNull()) },
    });
    const homeStatus = projectHomeStatus({ hasTriggeredUnresolvedAlert, connectorStatuses });
    return { project: p, connectorStatuses, keyMetrics, homeStatus };
  }
}
