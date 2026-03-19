import { Controller, Get, Post, Patch, Body, Param, Headers, Query } from '@nestjs/common';
import { PmtctService } from '../services/pmtct.service';

@Controller('hiv/pmtct')
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
}
