import { Controller, Get, Post, Param, Body, Query, Req, UseGuards, BadRequestException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { CascadeMetricsService } from '../services/cascade-metrics.service';
import { RetentionService } from '../services/retention.service';
import { CohortBuilderService } from '../services/cohort-builder.service';

@ApiTags('Research')
@Controller('research')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class ResearchController {
  constructor(
    private readonly cascadeSvc: CascadeMetricsService,
    private readonly retentionSvc: RetentionService,
    private readonly cohortSvc: CohortBuilderService,
  ) {}

  @Get('cascade/current')
  @ApiOperation({ summary: 'Compute live 95-95-95 cascade' })
  getCascade(@Req() req: any) {
    return this.cascadeSvc.computeCascade(req.tenantDb);
  }

  @Post('cascade/snapshot')
  @ApiOperation({ summary: 'Save cascade snapshot for current period' })
  async saveSnapshot(@Body() body: { periodLabel: string }, @Req() req: any) {
    const cascade = await this.cascadeSvc.computeCascade(req.tenantDb);
    await this.cascadeSvc.saveSnapshot(cascade, body.periodLabel, req.tenantDb);
    return cascade;
  }

  @Get('cascade/snapshots')
  @ApiOperation({ summary: 'List last 12 cascade snapshots' })
  getSnapshots(@Req() req: any) {
    return this.cascadeSvc.getSnapshots(req.tenantDb);
  }

  @Get('retention')
  @ApiOperation({ summary: 'Compute retention for cohort (6/12/24 months)' })
  getRetention(
    @Query('cohortStart') cohortStart: string,
    @Query('months') months: string,
    @Req() req: any,
  ) {
    const m = parseInt(months) as 6 | 12 | 24;
    if (![6, 12, 24].includes(m)) throw new BadRequestException('months must be 6, 12, or 24');
    return this.retentionSvc.computeRetention(cohortStart, m, req.tenantDb);
  }

  @Post('patients/:id/reengagement')
  @ApiOperation({ summary: 'Record LTFU patient re-engagement' })
  recordReengagement(@Param('id') id: string, @Body() body: any, @Req() req: any) {
    return this.retentionSvc.recordReengagement({ ...body, patientId: id }, req.tenantDb);
  }

  @Post('cohorts/run')
  @ApiOperation({ summary: 'Run ad-hoc cohort query' })
  runCohort(@Body() body: { conditions: any[]; logic: 'AND' | 'OR' }, @Req() req: any) {
    return this.cohortSvc.runCohort(body, req.tenantDb);
  }

  @Post('cohorts')
  @ApiOperation({ summary: 'Save cohort definition' })
  saveCohort(@Body() body: any, @Req() req: any) {
    return this.cohortSvc.saveCohort({ ...body, createdBy: req.user.sub }, req.tenantDb);
  }

  @Get('cohorts')
  @ApiOperation({ summary: 'List saved cohort definitions' })
  listCohorts(@Req() req: any) {
    return this.cohortSvc.listSavedCohorts(req.user.sub, req.tenantDb);
  }

  @Post('cohorts/:id/run')
  @ApiOperation({ summary: 'Run saved cohort definition' })
  runSavedCohort(@Param('id') id: string, @Req() req: any) {
    return this.cohortSvc.runSavedCohort(id, req.tenantDb);
  }
}
