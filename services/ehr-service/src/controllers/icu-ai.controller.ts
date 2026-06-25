import { Controller, Get, Post, Patch, Body, Param, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { IcuAiService } from '../services/icu-ai.service';

@UseGuards(JwtAuthGuard)
@Controller('icu/ai')
export class IcuAiController {
  constructor(private readonly svc: IcuAiService) {}

  @Post('sofa-alert')
  createSofaAlert(
    @Req() req: any,
    @Body() body: { admissionId: string; patientId: string; scoreNow: number; score24hAgo: number },
  ) {
    return this.svc.createSofaAlert(req.tenantDb, body);
  }

  @Get('sofa-alerts/active')
  getActiveSofaAlerts(@Req() req: any) {
    return this.svc.getActiveSofaAlerts(req.tenantDb);
  }

  @Patch('sofa-alerts/:id/acknowledge')
  acknowledgeSofaAlert(@Req() req: any, @Param('id') id: string) {
    return this.svc.acknowledgeSofaAlert(req.tenantDb, id, req.user.id);
  }

  @Post('vent-safety-check')
  ventSafetyCheck(
    @Req() req: any,
    @Body() body: { admissionId: string; ventSettingId?: string; patientIbwKg: number },
  ) {
    return this.svc.runVentSafetyCheck(req.tenantDb, body);
  }

  @Post('care-bundle')
  documentBundle(
    @Req() req: any,
    @Body() body: {
      admissionId: string;
      bundleType: string;
      items: Array<{ name: string; compliant: boolean }>;
    },
  ) {
    return this.svc.documentCareBundle(req.tenantDb, req.user.id, body);
  }

  @Get('care-bundle/:admissionId')
  getBundleHistory(@Req() req: any, @Param('admissionId') admissionId: string) {
    return this.svc.getBundleHistory(req.tenantDb, admissionId);
  }

  @Post('handover/generate')
  generateHandover(@Req() req: any, @Body() body: { shift: string }) {
    return this.svc.generateHandoverNote(req.tenantDb, req.user.id, body.shift);
  }

  @Get('handover/latest')
  getLatestHandover(@Req() req: any) {
    return this.svc.getLatestHandover(req.tenantDb);
  }

  @Get('fluid-overload-warnings')
  getFluidOverloadWarnings(@Req() req: any) {
    return this.svc.getFluidOverloadWarnings(req.tenantDb);
  }
}
