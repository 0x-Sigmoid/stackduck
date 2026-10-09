import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AlertRule } from '../entities/alert-rule.entity';
import { Connector } from '../entities/connector.entity';
import { MetricPoint } from '../entities/metric-point.entity';
import { Project } from '../entities/project.entity';
import { MetricsModule } from '../metrics/metrics.module';
import { ProjectsController } from './projects.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Project, Connector, MetricPoint, AlertRule]), MetricsModule],
  controllers: [ProjectsController],
})
export class ProjectsModule {}
