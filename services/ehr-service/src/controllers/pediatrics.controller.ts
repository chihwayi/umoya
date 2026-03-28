import {
  Controller, Get, Post, Patch, Param, Body, Query, Request, UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { PediatricsService } from '../services/pediatrics.service';
import { RequestWithTenant } from '../middleware/tenant.middleware';

@Controller('pediatrics')
@UseGuards(JwtAuthGuard)
export class PediatricsController {
  constructor(private readonly svc: PediatricsService) {}

  // ── Profile ───────────────────────────────────────────────────────────────

  @Get('patient/:patientId/profile')
  getProfile(@Param('patientId') patientId: string, @Request() req: RequestWithTenant) {
    return this.svc.getOrCreateProfile(patientId, req.tenantDb);
  }

  @Patch('patient/:patientId/profile')
  updateProfile(
    @Param('patientId') patientId: string,
    @Body() body: Record<string, any>,
    @Request() req: RequestWithTenant,
  ) {
    return this.svc.updateProfile(patientId, body, req.tenantDb);
  }

  // ── Growth ────────────────────────────────────────────────────────────────

  @Get('patient/:patientId/growth')
  getGrowth(
    @Param('patientId') patientId: string,
    @Request() req: RequestWithTenant,
    @Query('limit') limit?: string,
  ) {
    return this.svc.getGrowthHistory(patientId, req.tenantDb, limit ? Number(limit) : undefined);
  }

  @Post('patient/:patientId/growth')
  addGrowth(
    @Param('patientId') patientId: string,
    @Body() body: Record<string, any>,
    @Request() req: RequestWithTenant,
  ) {
    return this.svc.addGrowthMeasurement({ ...body, patientId }, req.tenantDb);
  }

  // ── Milestones ────────────────────────────────────────────────────────────

  @Get('patient/:patientId/milestones')
  getMilestones(
    @Param('patientId') patientId: string,
    @Request() req: RequestWithTenant,
    @Query('domain') domain?: string,
  ) {
    return this.svc.getMilestones(patientId, req.tenantDb, domain);
  }

  @Post('patient/:patientId/milestones')
  upsertMilestone(
    @Param('patientId') patientId: string,
    @Body() body: Record<string, any>,
    @Request() req: RequestWithTenant,
  ) {
    return this.svc.upsertMilestone({ ...body, patientId }, req.tenantDb);
  }

  // ── Neonatal ──────────────────────────────────────────────────────────────

  @Get('patient/:patientId/neonatal')
  getNeonatal(@Param('patientId') patientId: string, @Request() req: RequestWithTenant) {
    return this.svc.getNeonatalRecord(patientId, req.tenantDb);
  }

  @Post('patient/:patientId/neonatal')
  saveNeonatal(
    @Param('patientId') patientId: string,
    @Body() body: Record<string, any>,
    @Request() req: RequestWithTenant,
  ) {
    return this.svc.saveNeonatalRecord({ ...body, patientId }, req.tenantDb);
  }

  // ── School health ─────────────────────────────────────────────────────────

  @Get('patient/:patientId/school-health')
  getSchoolHealth(@Param('patientId') patientId: string, @Request() req: RequestWithTenant) {
    return this.svc.getSchoolHealthRecords(patientId, req.tenantDb);
  }

  @Post('patient/:patientId/school-health')
  addSchoolHealth(
    @Param('patientId') patientId: string,
    @Body() body: Record<string, any>,
    @Request() req: RequestWithTenant,
  ) {
    return this.svc.addSchoolHealthRecord({ ...body, patientId }, req.tenantDb);
  }

  // ── CDSS ──────────────────────────────────────────────────────────────────

  @Post('cdss/dosing')
  pediatricDosing(@Body() body: Record<string, any>) {
    return this.svc.pediatricDosing(body);
  }

  @Post('cdss/growth')
  assessGrowth(@Body() body: Record<string, any>) {
    return this.svc.assessGrowth(body);
  }

  @Post('cdss/milestones')
  assessMilestones(@Body() body: Record<string, any>) {
    return this.svc.assessMilestones(body);
  }
}
