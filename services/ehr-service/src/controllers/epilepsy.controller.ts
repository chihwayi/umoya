import { Body, Controller, Get, Param, Patch, Post, Request, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { RequestWithTenant } from '../middleware/tenant.middleware';
import { EpilepsyService } from '../services/epilepsy.service';

@Controller('epilepsy')
@UseGuards(JwtAuthGuard)
export class EpilepsyController {
  constructor(private readonly epilepsyService: EpilepsyService) {}

  @Post('patient/:patientId/enroll')
  enroll(@Param('patientId') patientId: string, @Body() body: any, @Request() req: RequestWithTenant) {
    const user = req.user as any;
    return this.epilepsyService.enroll(req.tenantId!, patientId, user?.userId ?? user?.id, body);
  }

  @Get('patient/:patientId/register')
  getRegister(@Param('patientId') patientId: string, @Request() req: RequestWithTenant) {
    return this.epilepsyService.getRegister(req.tenantId!, patientId);
  }

  @Patch('register/:id')
  updateRegister(@Param('id') id: string, @Body() body: any, @Request() req: RequestWithTenant) {
    return this.epilepsyService.updateRegister(req.tenantId!, id, body);
  }

  @Post('patient/:patientId/aed')
  recordAedTherapy(@Param('patientId') patientId: string, @Body() body: any, @Request() req: RequestWithTenant) {
    const user = req.user as any;
    return this.epilepsyService.recordAedTherapy(req.tenantId!, patientId, user?.userId ?? user?.id, body);
  }

  @Get('patient/:patientId/aed')
  getAedTherapy(@Param('patientId') patientId: string, @Request() req: RequestWithTenant) {
    return this.epilepsyService.getAedTherapy(req.tenantId!, patientId);
  }

  @Patch('aed/:id/stop')
  stopAedTherapy(@Param('id') id: string, @Body() body: any, @Request() req: RequestWithTenant) {
    return this.epilepsyService.stopAedTherapy(
      req.tenantId!,
      id,
      body?.stopDate ?? new Date().toISOString().slice(0, 10),
      body?.stopReason ?? '',
    );
  }

  @Post('patient/:patientId/toxicity')
  recordToxicityEvent(@Param('patientId') patientId: string, @Body() body: any, @Request() req: RequestWithTenant) {
    const user = req.user as any;
    return this.epilepsyService.recordToxicityEvent(req.tenantId!, patientId, user?.userId ?? user?.id, body);
  }

  @Get('patient/:patientId/toxicity')
  getToxicityEvents(@Param('patientId') patientId: string, @Request() req: RequestWithTenant) {
    return this.epilepsyService.getToxicityEvents(req.tenantId!, patientId);
  }

  @Post('cdss/aed-dose')
  getAedDose(@Body() body: any, @Request() req: RequestWithTenant) {
    return this.epilepsyService.getAedDose(req.tenantId!, body ?? {});
  }

  @Post('cdss/drug-interactions')
  checkDrugInteractions(@Body() body: any, @Request() req: RequestWithTenant) {
    return this.epilepsyService.checkDrugInteractions(req.tenantId!, body ?? {});
  }

  @Post('cdss/status-epilepticus')
  getStatusEpilepticusProtocol(@Body() body: any, @Request() req: RequestWithTenant) {
    return this.epilepsyService.getStatusEpilepticusProtocol(req.tenantId!, body ?? {});
  }
}
