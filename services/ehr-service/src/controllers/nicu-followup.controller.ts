import { Controller, Get, Post, Patch, Body, Param, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { NicuFollowupService } from '../services/nicu-followup.service';

@UseGuards(JwtAuthGuard)
@Controller('nicu-followup')
export class NicuFollowupController {
  constructor(private readonly svc: NicuFollowupService) {}

  @Post('register')
  enrollPatient(@Req() req: any, @Body() body: any) {
    return this.svc.enrollPatient(req.tenantDb, req.user.id, body);
  }

  @Get('register')
  getRegister(@Req() req: any) {
    return this.svc.getRegister(req.tenantDb);
  }

  @Get('corrected-age/:patientId')
  getCorrectedAge(@Req() req: any, @Param('patientId') patientId: string) {
    return this.svc.getCorrectedAge(req.tenantDb, patientId);
  }

  @Post('visits')
  recordVisit(@Req() req: any, @Body() body: any) {
    return this.svc.recordVisit(req.tenantDb, req.user.id, body);
  }

  @Post('bayley')
  recordBayley(@Req() req: any, @Body() body: any) {
    return this.svc.recordBayley(req.tenantDb, req.user.id, body);
  }

  @Get('bayley/:patientId')
  getBayleyHistory(@Req() req: any, @Param('patientId') patientId: string) {
    return this.svc.getBayleyHistory(req.tenantDb, patientId);
  }

  @Post('rop')
  recordRop(@Req() req: any, @Body() body: any) {
    return this.svc.recordRop(req.tenantDb, req.user.id, body);
  }

  @Get('rop/pending-screening')
  getRopPendingScreening(@Req() req: any) {
    return this.svc.getRopPendingScreening(req.tenantDb);
  }

  @Post('hie')
  recordHie(@Req() req: any, @Body() body: any) {
    return this.svc.recordHie(req.tenantDb, body);
  }

  @Patch('hie/:id/outcome')
  recordHieOutcome(@Req() req: any, @Param('id') id: string, @Body() body: { outcome: string; assessedAt?: string }) {
    return this.svc.recordHieOutcome(req.tenantDb, id, body);
  }
}
