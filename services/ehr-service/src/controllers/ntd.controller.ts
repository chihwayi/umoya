import { Controller, Get, Post, Patch, Body, Param, Req, Query, UseGuards } from '@nestjs/common';
import { NtdService } from '../services/ntd.service';
import { NtdConditionMapper } from '../fhir/mappers/ntd-condition.mapper';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { RequestWithTenant } from '../middleware/tenant.middleware';

@UseGuards(JwtAuthGuard)
@Controller('ntd')
export class NtdController {
  constructor(private readonly svc: NtdService) {}

  // ── NTD Cases ──────────────────────────────────────────────────────────────

  @Post('patient/:patientId/case')
  addNtdCase(@Req() req: RequestWithTenant, @Param('patientId') patientId: string, @Body() dto: any) {
    return this.svc.addNtdCase(req.tenantDb!, { ...dto, patientId });
  }

  @Get('patient/:patientId/case')
  getNtdCases(@Req() req: RequestWithTenant, @Param('patientId') patientId: string) {
    return this.svc.getNtdCases(req.tenantDb!, patientId);
  }

  @Patch('case/:id')
  updateNtdCase(@Req() req: RequestWithTenant, @Param('id') id: string, @Body() dto: any) {
    return this.svc.updateNtdCase(req.tenantDb!, id, dto);
  }

  // ── Cholera Cases ─────────────────────────────────────────────────────────

  @Post('patient/:patientId/cholera')
  addCholeraCase(@Req() req: RequestWithTenant, @Param('patientId') patientId: string, @Body() dto: any) {
    return this.svc.addCholeraCase(req.tenantDb!, { ...dto, patientId });
  }

  @Get('patient/:patientId/cholera')
  getCholeraCases(@Req() req: RequestWithTenant, @Param('patientId') patientId: string) {
    return this.svc.getCholeraCases(req.tenantDb!, patientId);
  }

  @Patch('cholera/:id')
  updateCholeraCase(@Req() req: RequestWithTenant, @Param('id') id: string, @Body() dto: any) {
    return this.svc.updateCholeraCase(req.tenantDb!, id, dto);
  }

  // ── Typhoid Cases ─────────────────────────────────────────────────────────

  @Post('patient/:patientId/typhoid')
  addTyphoidCase(@Req() req: RequestWithTenant, @Param('patientId') patientId: string, @Body() dto: any) {
    return this.svc.addTyphoidCase(req.tenantDb!, { ...dto, patientId });
  }

  @Get('patient/:patientId/typhoid')
  getTyphoidCases(@Req() req: RequestWithTenant, @Param('patientId') patientId: string) {
    return this.svc.getTyphoidCases(req.tenantDb!, patientId);
  }

  @Patch('typhoid/:id')
  updateTyphoidCase(@Req() req: RequestWithTenant, @Param('id') id: string, @Body() dto: any) {
    return this.svc.updateTyphoidCase(req.tenantDb!, id, dto);
  }

  @Post('assess')
  recordAssessment(@Body() body: any, @Req() req: RequestWithTenant) {
    const userId = req.user?.sub || req.user?.id || '';
    return this.svc.recordAssessment(req.tenantId!, userId, body);
  }

  @Get('assessments/:patientId')
  getPatientAssessments(@Param('patientId') patientId: string, @Req() req: RequestWithTenant) {
    return this.svc.getPatientAssessments(req.tenantId!, patientId);
  }

  @Post('mda/campaigns')
  createCampaign(@Body() body: any, @Req() req: RequestWithTenant) {
    const userId = req.user?.sub || req.user?.id || '';
    return this.svc.createCampaign(req.tenantId!, userId, body);
  }

  @Get('mda/campaigns')
  listCampaigns(@Req() req: RequestWithTenant) {
    return this.svc.listCampaigns(req.tenantId!);
  }

  @Patch('mda/campaigns/:id/record')
  recordTreatedCount(@Param('id') id: string, @Body() body: { count: number }, @Req() req: RequestWithTenant) {
    return this.svc.recordTreatedCount(req.tenantId!, id, Number(body?.count) || 0);
  }

  // ── Regional Disease Reports ───────────────────────────────────────────────

  @Post('report')
  upsertReport(@Req() req: RequestWithTenant, @Body() dto: any) {
    return this.svc.upsertReport(req.tenantDb!, dto);
  }

  @Get('report')
  getReports(@Req() req: RequestWithTenant, @Query('periodType') periodType?: string) {
    return this.svc.getReports(req.tenantDb!, periodType);
  }

  @Post('report/aggregate')
  aggregateReport(@Req() req: RequestWithTenant, @Body() dto: { reportPeriod: string; periodType: string }) {
    return this.svc.aggregateReport(req.tenantDb!, dto.reportPeriod, dto.periodType);
  }

  // ── CDSS ──────────────────────────────────────────────────────────────────

  @Post('cdss/screen')
  screenNtd(@Body() dto: any) {
    return this.svc.screenNtd(dto);
  }

  @Post('cdss/cholera/risk')
  choleraRisk(@Body() dto: any) {
    return this.svc.choleraRisk(dto);
  }

  // ── FHIR Export ───────────────────────────────────────────────────────────

  @Get('patient/:patientId/fhir')
  async patientFhirBundle(@Req() req: RequestWithTenant, @Param('patientId') patientId: string) {
    const [ntd, cholera, typhoid] = await Promise.all([
      this.svc.getNtdCases(req.tenantDb!, patientId),
      this.svc.getCholeraCases(req.tenantDb!, patientId),
      this.svc.getTyphoidCases(req.tenantDb!, patientId),
    ]);
    const entries = [
      ...ntd.map(r => ({ resource: NtdConditionMapper.ntdCaseToFhir(r, req.tenantId!) })),
      ...cholera.map(r => ({ resource: NtdConditionMapper.choleraCaseToFhir(r, req.tenantId!) })),
      ...typhoid.map(r => ({ resource: NtdConditionMapper.typhoidCaseToFhir(r, req.tenantId!) })),
    ];
    return { resourceType: 'Bundle', type: 'searchset', total: entries.length, entry: entries };
  }
}
