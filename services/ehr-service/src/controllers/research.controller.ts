import { Controller, Get, Post, Param, Body, Query, Req, UseGuards, BadRequestException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { CascadeMetricsService } from '../services/cascade-metrics.service';
import { RetentionService } from '../services/retention.service';
import { CohortBuilderService } from '../services/cohort-builder.service';
import { KaplanMeierService } from '../services/kaplan-meier.service';
import { DeidExportService } from '../services/deid-export.service';

@ApiTags('Research')
@Controller('research')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class ResearchController {
  constructor(
    private readonly cascadeSvc: CascadeMetricsService,
    private readonly retentionSvc: RetentionService,
    private readonly cohortSvc: CohortBuilderService,
    private readonly kmSvc: KaplanMeierService,
    private readonly deidSvc: DeidExportService,
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

  @Get('kaplan-meier')
  @ApiOperation({ summary: 'Kaplan-Meier survival analysis (LTFU or treatment failure)' })
  async getKaplanMeier(
    @Query('eventType') eventType: string,
    @Query('cohortStart') cohortStart: string,
    @Req() req: any,
  ) {
    if (!['ltfu', 'treatment_failure'].includes(eventType)) {
      throw new BadRequestException('eventType must be ltfu or treatment_failure');
    }
    return this.kmSvc.computeFromDb({
      eventType: eventType as 'ltfu' | 'treatment_failure',
      cohortStart,
      db: req.tenantDb,
    });
  }

  @Post('adverse-events')
  @ApiOperation({ summary: 'Report an ART adverse event' })
  async reportAdverseEvent(@Body() body: any, @Req() req: any) {
    const [row] = await req.tenantDb.query(
      `INSERT INTO art_adverse_events
         (patient_id, suspect_drug, event_description, event_severity, event_outcome,
          causality, reported_by, report_date, vigibase_exported)
       VALUES ($1,$2,$3,$4,$5,$6,$7,CURRENT_DATE,false) RETURNING *`,
      [body.patientId, body.suspectDrug, body.eventDescription, body.eventSeverity,
       body.eventOutcome, body.causality, req.user.sub],
    );
    return row;
  }

  @Get('adverse-events/unreported')
  @ApiOperation({ summary: 'List adverse events not yet exported to VigiBase' })
  getUnreportedEvents(@Req() req: any) {
    return req.tenantDb.query(
      `SELECT * FROM art_adverse_events WHERE vigibase_exported = false ORDER BY report_date DESC`,
    );
  }

  @Get('adverse-events/export-vigibase')
  @ApiOperation({ summary: 'Export pending adverse events in VigiBase E2B format and mark as exported' })
  async exportVigibase(@Req() req: any) {
    const rows = await req.tenantDb.query(
      `SELECT * FROM art_adverse_events WHERE vigibase_exported = false`,
    );
    if (rows.length === 0) return { exported: 0, records: [] };
    const ids = rows.map((r: any) => r.id);
    await req.tenantDb.query(
      `UPDATE art_adverse_events SET vigibase_exported = true WHERE id = ANY($1)`,
      [ids],
    );
    return { exported: rows.length, records: rows };
  }

  @Post('export/deid')
  @ApiOperation({ summary: 'Export de-identified cohort data (HIPAA Safe Harbor)' })
  async exportDeid(
    @Body() body: {
      cohortPatients: any[];
      fields: string[];
      cohortName: string;
      cohortCriteria: any;
      purpose: string;
      approvedBy?: string;
    },
    @Req() req: any,
  ) {
    return this.deidSvc.exportCohortDeidentified({
      cohortPatients: body.cohortPatients,
      fields: body.fields,
      exportedBy: req.user.sub,
      cohortName: body.cohortName,
      cohortCriteria: body.cohortCriteria,
      purpose: body.purpose,
      approvedBy: body.approvedBy,
      db: req.tenantDb,
    });
  }
}
