import { Body, Controller, Get, Param, Patch, Post, Query, Request, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { RequestWithTenant } from '../middleware/tenant.middleware';
import { RheumatologyService } from '../services/rheumatology.service';

@Controller('rheumatology')
@UseGuards(JwtAuthGuard)
export class RheumatologyController {
  constructor(private readonly rheuSvc: RheumatologyService) {}

  @Post('patient/:patientId/register')
  enroll(@Param('patientId') patientId: string, @Body() body: any, @Request() req: RequestWithTenant) {
    return this.rheuSvc.enroll(req.tenantId!, { ...body, patientId, registeredBy: req.user?.sub || req.user?.id });
  }

  @Get('patient/:patientId/register')
  getRegister(@Param('patientId') patientId: string, @Request() req: RequestWithTenant) {
    return this.rheuSvc.getRegister(req.tenantId!, patientId);
  }

  @Get()
  list(@Query('diagnosis') diagnosis?: string, @Query('limit') limit?: string, @Request() req?: RequestWithTenant) {
    return this.rheuSvc.listRegisters((req as any).tenantId!, { diagnosis, limit: limit ? Number(limit) : undefined });
  }

  @Patch('register/:id')
  updateRegister(@Param('id') id: string, @Body() body: any, @Request() req: RequestWithTenant) {
    return this.rheuSvc.updateRegister(req.tenantId!, id, body);
  }

  @Post('patient/:patientId/assessments')
  recordAssessment(@Param('patientId') patientId: string, @Body() body: any, @Request() req: RequestWithTenant) {
    return this.rheuSvc.recordAssessment(req.tenantId!, { ...body, patientId });
  }

  @Get('patient/:patientId/assessments')
  getAssessments(@Param('patientId') patientId: string, @Request() req: RequestWithTenant) {
    return this.rheuSvc.getAssessments(req.tenantId!, patientId);
  }

  @Post('patient/:patientId/dmards')
  recordDmard(@Param('patientId') patientId: string, @Body() body: any, @Request() req: RequestWithTenant) {
    return this.rheuSvc.recordDmard(req.tenantId!, { ...body, patientId });
  }

  @Get('patient/:patientId/dmards')
  getDmards(@Param('patientId') patientId: string, @Request() req: RequestWithTenant) {
    return this.rheuSvc.getDmards(req.tenantId!, patientId);
  }

  @Patch('dmards/:id/stop')
  stopDmard(@Param('id') id: string, @Body() body: any, @Request() req: RequestWithTenant) {
    return this.rheuSvc.stopDmard(req.tenantId!, id, body.reason);
  }

  @Post('cdss/treat-to-target')
  treatToTarget(@Body() body: any) {
    return this.rheuSvc.treatToTarget(body);
  }

  @Post('cdss/gout')
  goutManagement(@Body() body: any) {
    return this.rheuSvc.goutManagement(body);
  }

  @Post('cdss/biologic-safety')
  biologicSafety(@Body() body: any) {
    return this.rheuSvc.biologicSafetyScan(body);
  }
}
