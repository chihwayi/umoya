import { Controller, Get, Post, Put, Param, Body, Req, UseGuards, Query, BadRequestException } from '@nestjs/common';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { DentalService } from '../services/dental.service';
import { AncService } from '../services/anc.service';
import { GrowthChartService } from '../services/growth-chart.service';
import { PaediatricDosingService } from '../services/paediatric-dosing.service';

@Controller('clinical')
@UseGuards(JwtAuthGuard)
export class ClinicalSpecialtiesController {
  constructor(
    private readonly dental: DentalService,
    private readonly anc: AncService,
    private readonly growth: GrowthChartService,
    private readonly dosing: PaediatricDosingService,
  ) {}

  // ── Dental ──────────────────────────────────────────────────────────────

  @Post('dental/charts')
  createDentalChart(@Body() body: any, @Req() req: any) {
    return this.dental.createDentalChart({ ...body, dentistId: req.user?.sub }, req.tenantDb);
  }

  @Post('dental/charts/:chartId/teeth')
  recordToothCondition(@Param('chartId') chartId: string, @Body() body: any, @Req() req: any) {
    return this.dental.recordToothCondition(
      chartId, body.toothNumber, body.surface ?? null, body.condition, body.notes ?? null, req.tenantDb,
    );
  }

  @Post('dental/charts/:chartId/perio')
  recordPerioChart(@Param('chartId') chartId: string, @Body() body: { entries: any[] }, @Req() req: any) {
    return this.dental.recordPerioChart(chartId, body.entries, req.tenantDb);
  }

  @Post('dental/treatment-plans')
  addTreatmentPlan(@Body() body: any, @Req() req: any) {
    return this.dental.addTreatmentPlan(body, req.tenantDb);
  }

  @Put('dental/treatment-plans/:id/complete')
  completeTreatment(@Param('id') id: string, @Body() body: { completedDate: string }, @Req() req: any) {
    return this.dental.completeTreatment(id, body.completedDate, req.tenantDb);
  }

  @Get('dental/patients/:patientId/history')
  getDentalHistory(@Param('patientId') patientId: string, @Req() req: any) {
    return this.dental.getPatientDentalHistory(patientId, req.tenantDb);
  }

  // ── PMTCT / ANC ─────────────────────────────────────────────────────────

  @Post('anc/register')
  registerAnc(@Body() body: any, @Req() req: any) {
    return this.anc.registerAnc(body, req.tenantDb);
  }

  @Get('anc/patients/:patientId')
  getAnc(@Param('patientId') patientId: string, @Req() req: any) {
    return this.anc.getAncByPatient(patientId, req.tenantDb);
  }

  @Post('anc/pmtct-visits')
  recordPmtctVisit(@Body() body: any, @Req() req: any) {
    return this.anc.recordPmtctVisit(body, req.user?.sub, req.tenantDb);
  }

  @Post('anc/eid-schedules')
  createEidSchedule(@Body() body: any, @Req() req: any) {
    return this.anc.createEidSchedule(body, req.tenantDb);
  }

  @Put('anc/eid-schedules/:id/result')
  recordEidResult(
    @Param('id') id: string,
    @Body() body: { timepoint: '6w' | '4m' | '12m' | '18m'; result: 'positive' | 'negative' | 'indeterminate'; doneDate: string },
    @Req() req: any,
  ) {
    return this.anc.recordEidResult(id, body.timepoint, body.result, body.doneDate, req.tenantDb);
  }

  @Get('anc/eid-schedules/overdue')
  getOverdueEid(@Req() req: any) {
    return this.anc.getOverdueEid(req.tenantDb);
  }

  // ── Growth Charts ────────────────────────────────────────────────────────

  @Post('growth/measurements')
  recordGrowthMeasurement(@Body() body: any, @Req() req: any) {
    return this.growth.recordGrowthMeasurement(
      body.patientId, body.measurementDate, body.weightKg ?? null, body.heightCm ?? null,
      body.headCircumferenceCm ?? null, body.muacCm ?? null,
      body.sex, body.dateOfBirth, req.user?.sub, req.tenantDb,
    );
  }

  @Get('growth/patients/:patientId/history')
  getGrowthHistory(@Param('patientId') patientId: string, @Req() req: any) {
    return this.growth.getGrowthHistory(patientId, req.tenantDb);
  }

  // ── Paediatric Dosing ────────────────────────────────────────────────────

  @Get('paediatric/dosing')
  getDose(@Query('weightKg') weightKg: string) {
    const weight = parseFloat(weightKg);
    if (isNaN(weight) || weight <= 0) throw new BadRequestException('Invalid weightKg');
    return this.dosing.getDoseForWeight(weight);
  }

  @Get('paediatric/dosing/table')
  getFullDoseTable() {
    return this.dosing.getFullDoseTable();
  }
}
