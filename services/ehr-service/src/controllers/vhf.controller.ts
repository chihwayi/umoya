import { Body, Controller, Get, Param, Patch, Post, Query, Request, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { RequestWithTenant } from '../middleware/tenant.middleware';
import { VhfService } from '../services/vhf.service';

@Controller('vhf')
@UseGuards(JwtAuthGuard)
export class VhfController {
  constructor(private readonly vhfService: VhfService) {}

  @Post('cases')
  reportCase(@Body() body: any, @Request() req: RequestWithTenant) {
    const user = req.user as any;
    return this.vhfService.reportCase(req.tenantId!, user?.userId ?? user?.id, body ?? {});
  }

  @Get('cases')
  getCases(
    @Query('pathogen') pathogen: string | undefined,
    @Query('classification') classification: string | undefined,
    @Request() req: RequestWithTenant,
  ) {
    return this.vhfService.getCases(req.tenantId!, { pathogen, classification });
  }

  @Get('cases/:id')
  getCase(@Param('id') id: string, @Request() req: RequestWithTenant) {
    return this.vhfService.getCase(req.tenantId!, id);
  }

  @Patch('cases/:id')
  updateCase(@Param('id') id: string, @Body() body: any, @Request() req: RequestWithTenant) {
    return this.vhfService.updateCase(req.tenantId!, id, body ?? {});
  }

  @Post('cases/:id/contacts')
  addContact(@Param('id') id: string, @Body() body: any, @Request() req: RequestWithTenant) {
    return this.vhfService.addContact(req.tenantId!, id, body ?? {});
  }

  @Get('cases/:id/contacts')
  getContacts(@Param('id') id: string, @Request() req: RequestWithTenant) {
    return this.vhfService.getContacts(req.tenantId!, id);
  }

  @Patch('contacts/:id/status')
  updateContactStatus(
    @Param('id') id: string,
    @Body() body: { status: string; becameCaseId?: string },
    @Request() req: RequestWithTenant,
  ) {
    return this.vhfService.updateContactStatus(req.tenantId!, id, body?.status, body?.becameCaseId);
  }

  @Post('mpox/lesion-assessment')
  recordLesionAssessment(@Body() body: any, @Request() req: RequestWithTenant) {
    const user = req.user as any;
    return this.vhfService.recordLesionAssessment(req.tenantId!, user?.userId ?? user?.id, body ?? {});
  }

  @Get('mpox/lesion-history/:patientId')
  getLesionHistory(@Param('patientId') patientId: string, @Request() req: RequestWithTenant) {
    return this.vhfService.getLesionHistory(req.tenantId!, patientId);
  }

  @Post('cases/:id/triage')
  triageCase(@Param('id') id: string, @Body() body: any, @Request() req: RequestWithTenant) {
    return this.vhfService.triageCase(req.tenantId!, id, body ?? {});
  }

  @Get('surveillance/summary')
  getSurveillanceSummary(@Request() req: RequestWithTenant) {
    return this.vhfService.getActiveSurveillanceSummary(req.tenantId!);
  }
}
