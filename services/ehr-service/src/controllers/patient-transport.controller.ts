import { Controller, Get, Post, Patch, Body, Param, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { PatientTransportService } from '../services/patient-transport.service';

@UseGuards(JwtAuthGuard)
@Controller('transport')
export class PatientTransportController {
  constructor(private readonly svc: PatientTransportService) {}

  @Get('vehicles')
  getFleet(@Req() req: any) {
    return this.svc.getFleet(req.tenantDb);
  }

  @Patch('vehicles/:id/status')
  updateVehicleStatus(@Req() req: any, @Param('id') id: string, @Body() body: { status: string }) {
    return this.svc.updateVehicleStatus(req.tenantDb, id, body.status);
  }

  @Post('jobs')
  createJob(
    @Req() req: any,
    @Body() body: {
      vehicleId?: string; priority: string; incidentType: string;
      sceneAddress?: string; destination?: string; patientId?: string;
    },
  ) {
    return this.svc.createJob(req.tenantDb, req.user.id, body);
  }

  @Patch('jobs/:id/timeline')
  updateTimeline(
    @Req() req: any,
    @Param('id') id: string,
    @Body() body: { event: 'dispatched' | 'arrived_scene' | 'departed_scene' | 'arrived_hospital' | 'cleared'; outcome?: string },
  ) {
    return this.svc.updateJobTimeline(req.tenantDb, id, body);
  }

  @Get('jobs/active')
  getActiveJobs(@Req() req: any) {
    return this.svc.getActiveJobs(req.tenantDb);
  }

  @Post('mist-handover')
  recordMistHandover(@Req() req: any, @Body() body: any) {
    return this.svc.recordMistHandover(req.tenantDb, req.user.id, body);
  }

  @Post('inter-facility')
  recordInterFacilityTransfer(@Req() req: any, @Body() body: any) {
    return this.svc.recordInterFacilityTransfer(req.tenantDb, req.user.id, body);
  }

  @Get('quality-metrics')
  getQualityMetrics(@Req() req: any) {
    return this.svc.getQualityMetrics(req.tenantDb);
  }
}
