import { UseGuards, Controller, Get, Post, Patch, Body, Param, Headers, Query } from '@nestjs/common';
import { PmtctService } from '../services/pmtct.service';
import { PmtctObservationMapper } from '../fhir/mappers/pmtct-observation.mapper';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';

@Controller('hiv/pmtct')
@UseGuards(JwtAuthGuard)
export class PmtctController {
  constructor(private readonly svc: PmtctService) {}

  private tenant(h: Record<string, string>): string {
    return h['x-tenant-subdomain'] || 'default';
  }

  // ── PMTCT Enrollments ─────────────────────────────────────────────────────

  @Post('patient/:patientId/enroll')
  enrollMother(@Headers() h: Record<string, string>, @Param('patientId') patientId: string, @Body() dto: any) {
    return this.svc.enrollMother(this.tenant(h), { ...dto, patientId });
  }

  @Get('patient/:patientId/enroll')
  getEnrollment(@Headers() h: Record<string, string>, @Param('patientId') patientId: string) {
    return this.svc.getEnrollment(this.tenant(h), patientId);
  }

  @Patch('enrollment/:id')
  updateEnrollment(@Headers() h: Record<string, string>, @Param('id') id: string, @Body() dto: any) {
    return this.svc.updateEnrollment(this.tenant(h), id, dto);
  }

  // ── PMTCT Infants ─────────────────────────────────────────────────────────

  @Post('patient/:motherPatientId/infant')
  addInfant(@Headers() h: Record<string, string>, @Param('motherPatientId') motherPatientId: string, @Body() dto: any) {
    return this.svc.addInfant(this.tenant(h), { ...dto, motherPatientId });
  }

  @Get('patient/:motherPatientId/infant')
  getInfants(@Headers() h: Record<string, string>, @Param('motherPatientId') motherPatientId: string) {
    return this.svc.getInfants(this.tenant(h), motherPatientId);
  }

  @Patch('infant/:id')
  updateInfant(@Headers() h: Record<string, string>, @Param('id') id: string, @Body() dto: any) {
    return this.svc.updateInfant(this.tenant(h), id, dto);
  }

  // ── CDSS ──────────────────────────────────────────────────────────────────

  @Post('risk')
  pmtctRisk(@Body() dto: any) {
    return this.svc.pmtctRisk(dto);
  }

  // ── FHIR Export ───────────────────────────────────────────────────────────

  @Get('patient/:patientId/fhir')
  async patientFhirBundle(@Headers() h: Record<string, string>, @Param('patientId') patientId: string) {
    const tenantId = this.tenant(h);
    const [enrollments, infants] = await Promise.all([
      this.svc.getEnrollment(tenantId, patientId),
      this.svc.getInfants(tenantId, patientId),
    ]);
    const entries = [
      ...enrollments.map(r => ({ resource: PmtctObservationMapper.enrollmentToFhir(r, tenantId) })),
      ...infants.map(r => ({ resource: PmtctObservationMapper.infantToFhir(r, tenantId) })),
    ];
    return { resourceType: 'Bundle', type: 'searchset', total: entries.length, entry: entries };
  }
}
