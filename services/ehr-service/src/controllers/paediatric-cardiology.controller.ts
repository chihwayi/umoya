import { Controller, Get, Post, Patch, Body, Param, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { PaediatricCardiologyService } from '../services/paediatric-cardiology.service';

@UseGuards(JwtAuthGuard)
@Controller('paed-cardiology')
export class PaediatricCardiologyController {
  constructor(private readonly svc: PaediatricCardiologyService) {}

  @Post('chd-register')
  registerChd(@Req() req: any, @Body() body: any) {
    return this.svc.registerChd(req.tenantDb, req.user.id, body);
  }

  @Get('chd-register')
  getChdRegister(@Req() req: any) {
    return this.svc.getChdRegister(req.tenantDb);
  }

  @Post('echo')
  recordEcho(@Req() req: any, @Body() body: any) {
    return this.svc.recordEcho(req.tenantDb, req.user.id, body);
  }

  @Get('echo/:patientId')
  getEchoHistory(@Req() req: any, @Param('patientId') patientId: string) {
    return this.svc.getEchoHistory(req.tenantDb, patientId);
  }

  @Post('intervention')
  recordIntervention(@Req() req: any, @Body() body: any) {
    return this.svc.recordIntervention(req.tenantDb, req.user.id, body);
  }

  @Post('followup')
  scheduleFollowup(@Req() req: any, @Body() body: any) {
    return this.svc.scheduleFollowup(req.tenantDb, req.user.id, body);
  }

  @Get('followup/overdue')
  getOverdue(@Req() req: any) {
    return this.svc.getOverdueFollowups(req.tenantDb);
  }

  @Patch('followup/:id/complete')
  markFollowupComplete(@Req() req: any, @Param('id') id: string) {
    return this.svc.markFollowupComplete(req.tenantDb, id);
  }
}
