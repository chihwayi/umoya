import { Controller, Get, Post, Patch, Body, Param, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { ProstheticsService } from '../services/prosthetics.service';

@UseGuards(JwtAuthGuard)
@Controller('prosthetics')
export class ProstheticsController {
  constructor(private readonly svc: ProstheticsService) {}

  @Post('register')
  registerAmputee(@Req() req: any, @Body() body: any) {
    return this.svc.registerAmputee(req.tenantDb, body);
  }

  @Get('register')
  getAmputeeRegister(@Req() req: any) {
    return this.svc.getAmputeeRegister(req.tenantDb);
  }

  @Patch('register/:patientId/k-level')
  updateKLevel(
    @Req() req: any,
    @Param('patientId') patientId: string,
    @Body() body: { kLevel: number },
  ) {
    return this.svc.updateKLevel(req.tenantDb, patientId, body.kLevel);
  }

  @Post('prescriptions')
  prescribeDevice(@Req() req: any, @Body() body: any) {
    return this.svc.prescribeDevice(req.tenantDb, req.user.id, body);
  }

  @Get('prescriptions/:patientId')
  getPatientPrescriptions(@Req() req: any, @Param('patientId') patientId: string) {
    return this.svc.getPatientPrescriptions(req.tenantDb, patientId);
  }

  @Patch('prescriptions/:id/status')
  updateDeviceStatus(@Req() req: any, @Param('id') id: string, @Body() body: { status: string; deliveryDate?: string }) {
    return this.svc.updateDeviceStatus(req.tenantDb, id, body);
  }

  @Post('rehab-episodes')
  startRehabEpisode(@Req() req: any, @Body() body: any) {
    return this.svc.startRehabEpisode(req.tenantDb, req.user.id, body);
  }

  @Post('outcomes')
  recordOutcome(@Req() req: any, @Body() body: any) {
    return this.svc.recordOutcome(req.tenantDb, req.user.id, body);
  }

  @Get('outcomes/:episodeId')
  getOutcomes(@Req() req: any, @Param('episodeId') episodeId: string) {
    return this.svc.getOutcomes(req.tenantDb, episodeId);
  }
}
