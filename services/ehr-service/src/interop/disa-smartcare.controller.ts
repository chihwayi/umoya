import { Body, Controller, Get, Param, Post, Request, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { RequestWithTenant } from '../middleware/tenant.middleware';
import { DisaSmartcareService } from './disa-smartcare.service';

@Controller('interop')
@UseGuards(JwtAuthGuard)
export class DisaSmartcareController {
  constructor(private readonly service: DisaSmartcareService) {}

  @Post('disa/pull-vl')
  pullDisa(@Body() dto: { nid: string; patientId?: string }, @Request() req: RequestWithTenant) {
    return this.service.pullDisaVlResults(req.tenantId, dto.nid, dto.patientId);
  }

  @Get('disa/history/:patientId')
  getDisaHistory(@Param('patientId') patientId: string, @Request() req: RequestWithTenant) {
    return this.service.getDisaSyncHistory(req.tenantId, patientId);
  }

  @Post('smartcare/link')
  linkSmartcare(
    @Body() dto: { localPatientId: string; smartcareUuid: string; artNumber?: string },
    @Request() req: RequestWithTenant,
  ) {
    return this.service.linkSmartcarePatient(req.tenantId, dto.localPatientId, dto.smartcareUuid, dto.artNumber);
  }

  @Get('smartcare/link/:patientId')
  getSmartcareLink(@Param('patientId') patientId: string, @Request() req: RequestWithTenant) {
    return this.service.getSmartcareLink(req.tenantId, patientId);
  }

  @Post('cross-border/flag')
  flagCrossBorder(@Body() dto: Record<string, any>, @Request() req: RequestWithTenant) {
    return this.service.flagCrossBorderPatient(req.tenantId, dto);
  }

  @Get('cross-border/continuity/:patientId')
  assessContinuity(@Param('patientId') patientId: string, @Request() req: RequestWithTenant) {
    return this.service.assessCrossBorderContinuity(req.tenantId, patientId);
  }

  @Get('summary')
  summary(@Request() req: RequestWithTenant) {
    return this.service.getInteropSummary(req.tenantId);
  }
}
