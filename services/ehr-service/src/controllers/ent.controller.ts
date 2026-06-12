import { Body, Controller, Get, Param, Patch, Post, Request, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { RequestWithTenant } from '../middleware/tenant.middleware';
import { EntService } from '../services/ent.service';

@Controller('ent')
@UseGuards(JwtAuthGuard)
export class EntController {
  constructor(private readonly entSvc: EntService) {}

  @Post('patient/:patientId/visits')
  recordVisit(@Param('patientId') patientId: string, @Body() body: any, @Request() req: RequestWithTenant) {
    return this.entSvc.recordVisit(req.tenantId!, { ...body, patientId, clinicianId: req.user?.sub || req.user?.id });
  }

  @Get('patient/:patientId/visits')
  getVisits(@Param('patientId') patientId: string, @Request() req: RequestWithTenant) {
    return this.entSvc.getVisits(req.tenantId!, patientId);
  }

  @Get('visits/:id')
  getVisit(@Param('id') id: string, @Request() req: RequestWithTenant) {
    return this.entSvc.getVisit(req.tenantId!, id);
  }

  @Patch('visits/:id')
  updateVisit(@Param('id') id: string, @Body() body: any, @Request() req: RequestWithTenant) {
    return this.entSvc.updateVisit(req.tenantId!, id, body);
  }

  @Post('patient/:patientId/audiograms')
  recordAudiogram(@Param('patientId') patientId: string, @Body() body: any, @Request() req: RequestWithTenant) {
    return this.entSvc.recordAudiogram(req.tenantId!, { ...body, patientId });
  }

  @Get('patient/:patientId/audiograms')
  getAudiograms(@Param('patientId') patientId: string, @Request() req: RequestWithTenant) {
    return this.entSvc.getAudiograms(req.tenantId!, patientId);
  }

  @Post('cdss/tonsillitis-triage')
  tonsillitisTriage(@Body() body: any) {
    return this.entSvc.tonsillitisTriage(body);
  }

  @Post('cdss/rhinosinusitis-triage')
  rhinosinusitisTriage(@Body() body: any) {
    return this.entSvc.rhinosinusitisTriage(body);
  }
}
