import { Body, Controller, Get, Param, Patch, Post, Query, Request, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { RequestWithTenant } from '../middleware/tenant.middleware';
import { OrthopaedicsService } from '../services/orthopaedics.service';

@Controller('orthopaedics')
@UseGuards(JwtAuthGuard)
export class OrthopaedicsController {
  constructor(private readonly orthoSvc: OrthopaedicsService) {}

  // ── Register ──────────────────────────────────────────────────────────────

  @Post('patient/:patientId/register')
  enroll(@Param('patientId') patientId: string, @Body() body: any, @Request() req: RequestWithTenant) {
    return this.orthoSvc.enroll(req.tenantId!, { ...body, patientId, registeredBy: req.user?.sub || req.user?.id });
  }

  @Get('patient/:patientId/register')
  getRegister(@Param('patientId') patientId: string, @Request() req: RequestWithTenant) {
    return this.orthoSvc.getRegister(req.tenantId!, patientId);
  }

  @Get()
  list(@Query('status') status?: string, @Query('limit') limit?: string, @Request() req?: RequestWithTenant) {
    return this.orthoSvc.listRegisters((req as any).tenantId!, { status, limit: limit ? Number(limit) : undefined });
  }

  @Patch('register/:id')
  updateRegister(@Param('id') id: string, @Body() body: any, @Request() req: RequestWithTenant) {
    return this.orthoSvc.updateRegister(req.tenantId!, id, body);
  }

  // ── Fractures ─────────────────────────────────────────────────────────────

  @Post('patient/:patientId/fractures')
  recordFracture(@Param('patientId') patientId: string, @Body() body: any, @Request() req: RequestWithTenant) {
    return this.orthoSvc.recordFracture(req.tenantId!, { ...body, patientId });
  }

  @Get('patient/:patientId/fractures')
  getFractures(@Param('patientId') patientId: string, @Request() req: RequestWithTenant) {
    return this.orthoSvc.getFractures(req.tenantId!, patientId);
  }

  @Patch('fractures/:id')
  updateFracture(@Param('id') id: string, @Body() body: any, @Request() req: RequestWithTenant) {
    return this.orthoSvc.updateFracture(req.tenantId!, id, body);
  }

  // ── Joint Replacements ────────────────────────────────────────────────────

  @Post('patient/:patientId/joint-replacement')
  recordJointReplacement(@Param('patientId') patientId: string, @Body() body: any, @Request() req: RequestWithTenant) {
    return this.orthoSvc.recordJointReplacement(req.tenantId!, { ...body, patientId });
  }

  @Get('patient/:patientId/joint-replacements')
  getJointReplacements(@Param('patientId') patientId: string, @Request() req: RequestWithTenant) {
    return this.orthoSvc.getJointReplacements(req.tenantId!, patientId);
  }

  @Patch('joint-replacement/:id')
  updateJointReplacement(@Param('id') id: string, @Body() body: any, @Request() req: RequestWithTenant) {
    return this.orthoSvc.updateJointReplacement(req.tenantId!, id, body);
  }

  // ── CDSS ──────────────────────────────────────────────────────────────────

  @Post('cdss/rehab-plan')
  rehabPlan(@Body() body: any, @Request() req: RequestWithTenant) {
    return this.orthoSvc.getRehabPlan(req.tenantId!, body);
  }

  @Post('cdss/dvt-risk')
  dvtRisk(@Body() body: any) {
    return this.orthoSvc.dvtRisk(body);
  }
}
