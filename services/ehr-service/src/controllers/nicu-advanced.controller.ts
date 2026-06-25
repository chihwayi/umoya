import { Controller, Get, Post, Body, Param, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { NicuAdvancedService } from '../services/nicu-advanced.service';

@UseGuards(JwtAuthGuard)
@Controller('nicu/advanced')
export class NicuAdvancedController {
  constructor(private readonly svc: NicuAdvancedService) {}

  // ── Drug Dosing ──────────────────────────────────────────────────────────
  @Get('formulary')
  getFormulary(@Req() req: any) {
    return this.svc.getFormulary(req.tenantDb);
  }

  @Post('drug-orders')
  orderDrug(
    @Req() req: any,
    @Body() body: { admissionId: string; drugCode: string; weightKg: number; notes?: string },
  ) {
    return this.svc.orderDrug(req.tenantDb, req.user.id, body);
  }

  @Get('drug-orders/:admissionId')
  getDrugOrders(@Req() req: any, @Param('admissionId') admissionId: string) {
    return this.svc.getDrugOrders(req.tenantDb, admissionId);
  }

  // ── PN Calculator ────────────────────────────────────────────────────────
  @Post('pn-prescription')
  prescribePN(
    @Req() req: any,
    @Body() body: {
      admissionId: string; weightKg: number;
      postnatalDay: number; gestationalAgeWeeks: number;
    },
  ) {
    return this.svc.prescribePN(req.tenantDb, req.user.id, body);
  }

  @Get('pn-prescription/:admissionId')
  getPNHistory(@Req() req: any, @Param('admissionId') admissionId: string) {
    return this.svc.getPNHistory(req.tenantDb, admissionId);
  }

  // ── Newborn Screening ─────────────────────────────────────────────────────
  @Post('screening')
  recordScreening(
    @Req() req: any,
    @Body() body: {
      admissionId: string; patientId: string; screeningType: string;
      resultStatus: string; resultDetails?: object; notes?: string;
    },
  ) {
    return this.svc.recordScreening(req.tenantDb, req.user.id, body);
  }

  @Get('screening/:admissionId')
  getScreeningResults(@Req() req: any, @Param('admissionId') admissionId: string) {
    return this.svc.getScreeningResults(req.tenantDb, admissionId);
  }

  @Get('screening/pending-followup')
  getPendingFollowups(@Req() req: any) {
    return this.svc.getPendingScreeningFollowups(req.tenantDb);
  }

  // ── NAS Scoring ─────────────────────────────────────────────────────────
  @Post('nas-score')
  recordNasScore(
    @Req() req: any,
    @Body() body: { admissionId: string; scoreItems: Record<string, number>; totalScore: number },
  ) {
    return this.svc.recordNasScore(req.tenantDb, req.user.id, body);
  }

  @Get('nas-score/:admissionId')
  getNasHistory(@Req() req: any, @Param('admissionId') admissionId: string) {
    return this.svc.getNasHistory(req.tenantDb, admissionId);
  }
}
