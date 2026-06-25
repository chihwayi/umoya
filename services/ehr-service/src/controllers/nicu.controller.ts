import { Controller, Get, Post, Patch, Body, Param, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { NicuService } from '../services/nicu.service';

@UseGuards(JwtAuthGuard)
@Controller('nicu')
export class NicuController {
  constructor(private readonly nicu: NicuService) {}

  // ── Admissions ────────────────────────────────────────────────────────────

  @Post('admissions')
  admit(@Req() req: any, @Body() body: any) {
    return this.nicu.admitNewborn(req.tenantDb, req.user.id, body);
  }

  @Get('census')
  getCensus(@Req() req: any) {
    return this.nicu.getCensus(req.tenantDb);
  }

  @Get('admissions/:id')
  getAdmission(@Req() req: any, @Param('id') id: string) {
    return this.nicu.getAdmission(req.tenantDb, id);
  }

  @Patch('admissions/:id/discharge')
  discharge(@Req() req: any, @Param('id') id: string, @Body() body: any) {
    return this.nicu.discharge(req.tenantDb, id, body);
  }

  // ── Incubator settings ────────────────────────────────────────────────────

  @Post('admissions/:id/incubator')
  setIncubator(@Req() req: any, @Param('id') id: string, @Body() body: any) {
    return this.nicu.recordIncubatorSettings(req.tenantDb, req.user.id, id, body);
  }

  @Get('admissions/:id/incubator')
  getIncubator(@Req() req: any, @Param('id') id: string) {
    return this.nicu.getLatestIncubatorSettings(req.tenantDb, id);
  }

  // ── Vitals ────────────────────────────────────────────────────────────────

  @Post('admissions/:id/vitals')
  chartVitals(@Req() req: any, @Param('id') id: string, @Body() body: any) {
    return this.nicu.chartVitals(req.tenantDb, req.user.id, id, body);
  }

  @Get('admissions/:id/vitals')
  getVitals(@Req() req: any, @Param('id') id: string) {
    return this.nicu.getVitals(req.tenantDb, id);
  }

  // ── Bilirubin / Phototherapy ──────────────────────────────────────────────

  @Post('admissions/:id/bilirubin')
  recordBilirubin(@Req() req: any, @Param('id') id: string, @Body() body: any) {
    return this.nicu.recordBilirubin(req.tenantDb, req.user.id, id, body);
  }

  @Get('admissions/:id/bilirubin')
  getBilirubinHistory(@Req() req: any, @Param('id') id: string) {
    return this.nicu.getBilirubinHistory(req.tenantDb, id);
  }

  @Post('admissions/:id/phototherapy/start')
  startPhototherapy(@Req() req: any, @Param('id') id: string, @Body() body: any) {
    return this.nicu.startPhototherapy(req.tenantDb, req.user.id, id, body);
  }

  @Patch('phototherapy/:sessionId/stop')
  stopPhototherapy(@Req() req: any, @Param('sessionId') sessionId: string, @Body() body: { stoppedReason: string }) {
    return this.nicu.stopPhototherapy(req.tenantDb, sessionId, body.stoppedReason);
  }

  // ── KMC ──────────────────────────────────────────────────────────────────

  @Post('admissions/:id/kmc/start')
  startKmc(@Req() req: any, @Param('id') id: string, @Body() body: any) {
    return this.nicu.startKmc(req.tenantDb, req.user.id, id, body);
  }

  @Patch('kmc/:sessionId/stop')
  stopKmc(@Req() req: any, @Param('sessionId') sessionId: string, @Body() body: any) {
    return this.nicu.stopKmc(req.tenantDb, sessionId, body);
  }

  @Get('admissions/:id/kmc')
  getKmcSummary(@Req() req: any, @Param('id') id: string) {
    return this.nicu.getKmcSummary(req.tenantDb, id);
  }

  // ── Dashboard ─────────────────────────────────────────────────────────────

  @Get('dashboard')
  getDashboard(@Req() req: any) {
    return this.nicu.getDashboard(req.tenantDb);
  }
}
