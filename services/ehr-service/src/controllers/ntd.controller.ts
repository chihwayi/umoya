import { Controller, Get, Post, Patch, Body, Param, Headers, Query, Request, UseGuards } from '@nestjs/common';
import { NtdService } from '../services/ntd.service';
import { NtdConditionMapper } from '../fhir/mappers/ntd-condition.mapper';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { RequestWithTenant } from '../middleware/tenant.middleware';

@UseGuards(JwtAuthGuard)
@Controller('ntd')
export class NtdController {
  constructor(private readonly svc: NtdService) {}

  private tenant(h: Record<string, string>): string {
    return h['x-tenant-id'] || h['x-tenant-subdomain'] || 'default';
  }

  // ── NTD Cases ──────────────────────────────────────────────────────────────

  @Post('patient/:patientId/case')
  addNtdCase(@Headers() h: Record<string, string>, @Param('patientId') patientId: string, @Body() dto: any) {
    return this.svc.addNtdCase(this.tenant(h), { ...dto, patientId });
  }

  @Get('patient/:patientId/case')
  getNtdCases(@Headers() h: Record<string, string>, @Param('patientId') patientId: string) {
    return this.svc.getNtdCases(this.tenant(h), patientId);
  }

  @Patch('case/:id')
  updateNtdCase(@Headers() h: Record<string, string>, @Param('id') id: string, @Body() dto: any) {
    return this.svc.updateNtdCase(this.tenant(h), id, dto);
  }

  // ── Cholera Cases ─────────────────────────────────────────────────────────

  @Post('patient/:patientId/cholera')
  addCholeraCase(@Headers() h: Record<string, string>, @Param('patientId') patientId: string, @Body() dto: any) {
    return this.svc.addCholeraCase(this.tenant(h), { ...dto, patientId });
  }

  @Get('patient/:patientId/cholera')
  getCholeraCases(@Headers() h: Record<string, string>, @Param('patientId') patientId: string) {
    return this.svc.getCholeraCases(this.tenant(h), patientId);
  }

  @Patch('cholera/:id')
  updateCholeraCase(@Headers() h: Record<string, string>, @Param('id') id: string, @Body() dto: any) {
    return this.svc.updateCholeraCase(this.tenant(h), id, dto);
  }

  // ── Typhoid Cases ─────────────────────────────────────────────────────────

  @Post('patient/:patientId/typhoid')
  addTyphoidCase(@Headers() h: Record<string, string>, @Param('patientId') patientId: string, @Body() dto: any) {
    return this.svc.addTyphoidCase(this.tenant(h), { ...dto, patientId });
  }

  @Get('patient/:patientId/typhoid')
  getTyphoidCases(@Headers() h: Record<string, string>, @Param('patientId') patientId: string) {
    return this.svc.getTyphoidCases(this.tenant(h), patientId);
  }

  @Patch('typhoid/:id')
  updateTyphoidCase(@Headers() h: Record<string, string>, @Param('id') id: string, @Body() dto: any) {
    return this.svc.updateTyphoidCase(this.tenant(h), id, dto);
  }

  @Post('assess')
  recordAssessment(@Body() body: any, @Request() req: RequestWithTenant) {
    const userId = req.user?.sub || req.user?.id || '';
    return this.svc.recordAssessment(req.tenantId!, userId, body);
  }

  @Get('assessments/:patientId')
  getPatientAssessments(@Param('patientId') patientId: string, @Request() req: RequestWithTenant) {
    return this.svc.getPatientAssessments(req.tenantId!, patientId);
  }

  @Post('mda/campaigns')
  createCampaign(@Body() body: any, @Request() req: RequestWithTenant) {
    const userId = req.user?.sub || req.user?.id || '';
    return this.svc.createCampaign(req.tenantId!, userId, body);
  }

  @Get('mda/campaigns')
  listCampaigns(@Request() req: RequestWithTenant) {
    return this.svc.listCampaigns(req.tenantId!);
  }

  @Patch('mda/campaigns/:id/record')
  recordTreatedCount(@Param('id') id: string, @Body() body: { count: number }, @Request() req: RequestWithTenant) {
    return this.svc.recordTreatedCount(req.tenantId!, id, Number(body?.count) || 0);
  }

  // ── Regional Disease Reports ───────────────────────────────────────────────

  @Post('report')
  upsertReport(@Headers() h: Record<string, string>, @Body() dto: any) {
    return this.svc.upsertReport(this.tenant(h), dto);
  }

  @Get('report')
  getReports(@Headers() h: Record<string, string>, @Query('periodType') periodType?: string) {
    return this.svc.getReports(this.tenant(h), periodType);
  }

  @Post('report/aggregate')
  aggregateReport(@Headers() h: Record<string, string>, @Body() dto: { reportPeriod: string; periodType: string }) {
    return this.svc.aggregateReport(this.tenant(h), dto.reportPeriod, dto.periodType);
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
  async patientFhirBundle(@Headers() h: Record<string, string>, @Param('patientId') patientId: string) {
    const tenantId = this.tenant(h);
    const [ntd, cholera, typhoid] = await Promise.all([
      this.svc.getNtdCases(tenantId, patientId),
      this.svc.getCholeraCases(tenantId, patientId),
      this.svc.getTyphoidCases(tenantId, patientId),
    ]);
    const entries = [
      ...ntd.map(r => ({ resource: NtdConditionMapper.ntdCaseToFhir(r, tenantId) })),
      ...cholera.map(r => ({ resource: NtdConditionMapper.choleraCaseToFhir(r, tenantId) })),
      ...typhoid.map(r => ({ resource: NtdConditionMapper.typhoidCaseToFhir(r, tenantId) })),
    ];
    return { resourceType: 'Bundle', type: 'searchset', total: entries.length, entry: entries };
  }
}
