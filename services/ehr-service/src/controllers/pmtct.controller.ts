import { UseGuards, Controller, Get, Post, Patch, Body, Param, Req, Query } from '@nestjs/common';
import { PmtctService } from '../services/pmtct.service';
import { PmtctObservationMapper } from '../fhir/mappers/pmtct-observation.mapper';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { RequestWithTenant } from '../middleware/tenant.middleware';

@Controller('hiv/pmtct')
@UseGuards(JwtAuthGuard)
export class PmtctController {
  constructor(private readonly svc: PmtctService) {}

  // ── PMTCT Enrollments ─────────────────────────────────────────────────────

  @Post('patient/:patientId/enroll')
  enrollMother(@Req() req: RequestWithTenant, @Param('patientId') patientId: string, @Body() dto: any) {
    return this.svc.enrollMother(req.tenantId!, req.tenantDb!, { ...dto, patientId });
  }

  @Get('patient/:patientId/enroll')
  getEnrollment(@Req() req: RequestWithTenant, @Param('patientId') patientId: string) {
    return this.svc.getEnrollment(req.tenantDb!, patientId);
  }

  @Patch('enrollment/:id')
  updateEnrollment(@Req() req: RequestWithTenant, @Param('id') id: string, @Body() dto: any) {
    return this.svc.updateEnrollment(req.tenantDb!, id, dto);
  }

  // ── PMTCT Infants ─────────────────────────────────────────────────────────

  @Post('patient/:motherPatientId/infant')
  addInfant(@Req() req: RequestWithTenant, @Param('motherPatientId') motherPatientId: string, @Body() dto: any) {
    return this.svc.addInfant(req.tenantDb!, { ...dto, motherPatientId });
  }

  @Get('patient/:motherPatientId/infant')
  getInfants(@Req() req: RequestWithTenant, @Param('motherPatientId') motherPatientId: string) {
    return this.svc.getInfants(req.tenantDb!, motherPatientId);
  }

  @Patch('infant/:id')
  updateInfant(@Req() req: RequestWithTenant, @Param('id') id: string, @Body() dto: any) {
    return this.svc.updateInfant(req.tenantDb!, id, dto);
  }

  // ── CDSS ──────────────────────────────────────────────────────────────────

  @Post('risk')
  pmtctRisk(@Body() dto: any) {
    return this.svc.pmtctRisk(dto);
  }

  // ── FHIR Export ───────────────────────────────────────────────────────────

  @Get('patient/:patientId/fhir')
  async patientFhirBundle(@Req() req: RequestWithTenant, @Param('patientId') patientId: string) {
    const [enrollments, infants] = await Promise.all([
      this.svc.getEnrollment(req.tenantDb!, patientId),
      this.svc.getInfants(req.tenantDb!, patientId),
    ]);
    const entries = [
      ...enrollments.map(r => ({ resource: PmtctObservationMapper.enrollmentToFhir(r, req.tenantId!) })),
      ...infants.map(r => ({ resource: PmtctObservationMapper.infantToFhir(r, req.tenantId!) })),
    ];
    return { resourceType: 'Bundle', type: 'searchset', total: entries.length, entry: entries };
  }
}
