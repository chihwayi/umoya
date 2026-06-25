import { Controller, Get, Post, Patch, Body, Param, Query, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { CathLabService } from '../services/cathlab.service';

@UseGuards(JwtAuthGuard)
@Controller('cathlab')
export class CathLabController {
  constructor(private readonly cath: CathLabService) {}

  // ── Case scheduling & management ──────────────────────────────────────

  @Post('cases')
  scheduleCase(
    @Req() req: any,
    @Body() body: {
      patientId: string;
      encounterId?: string;
      procedureType: string;
      indication?: string;
      priority?: string;
      scheduledAt?: string;
      referringCardiologistId?: string;
    },
  ) {
    return this.cath.scheduleCase(req.tenantDb, req.user.id, body);
  }

  @Get('cases')
  listCases(
    @Req() req: any,
    @Query('status') status?: string,
    @Query('priority') priority?: string,
    @Query('date') date?: string,
  ) {
    return this.cath.listCases(req.tenantDb, { status, priority, date });
  }

  @Get('cases/:id')
  getCase(@Req() req: any, @Param('id') id: string) {
    return this.cath.getCase(req.tenantDb, id);
  }

  @Patch('cases/:id/start')
  startCase(@Req() req: any, @Param('id') id: string, @Body() body: { accessSite?: string }) {
    return this.cath.startCase(req.tenantDb, id, body.accessSite);
  }

  @Patch('cases/:id/complete')
  completeCase(
    @Req() req: any,
    @Param('id') id: string,
    @Body() body: {
      contrastVolumeMl?: number;
      fluoroscopyTimeMins?: number;
      timiFlowPre?: number;
      timiFlowPost?: number;
      complications?: string[];
      outcome: string;
      notes?: string;
    },
  ) {
    return this.cath.completeCase(req.tenantDb, id, body);
  }

  // ── Lesions ───────────────────────────────────────────────────────────

  @Post('cases/:id/lesions')
  addLesion(
    @Req() req: any,
    @Param('id') caseId: string,
    @Body() body: {
      vessel: string;
      stenosisPercent?: number;
      lesionLengthMm?: number;
      isCalcified?: boolean;
      isBifurcation?: boolean;
      isCto?: boolean;
      interventionDone?: boolean;
      stentType?: string;
      stentBrand?: string;
      stentDiameterMm?: number;
      stentLengthMm?: number;
      ivusDone?: boolean;
      octDone?: boolean;
      ffrValue?: number;
      notes?: string;
    },
  ) {
    return this.cath.addLesion(req.tenantDb, caseId, body);
  }

  @Get('cases/:id/lesions')
  getLesions(@Req() req: any, @Param('id') caseId: string) {
    return this.cath.getLesions(req.tenantDb, caseId);
  }

  // ── Hemodynamics ──────────────────────────────────────────────────────

  @Post('cases/:id/hemodynamics')
  recordHemodynamics(
    @Req() req: any,
    @Param('id') caseId: string,
    @Body() body: {
      aorticSystolic?: number;
      aorticDiastolic?: number;
      lvedp?: number;
      heartRate?: number;
      spo2?: number;
      notes?: string;
    },
  ) {
    return this.cath.recordHemodynamics(req.tenantDb, caseId, body);
  }

  // ── STEMI Activation ──────────────────────────────────────────────────

  @Post('stemi/activate')
  activateStemi(
    @Req() req: any,
    @Body() body: {
      patientId: string;
      activationSource: string;
      ecgAt?: string;
      doorInAt?: string;
      notes?: string;
    },
  ) {
    return this.cath.activateStemi(req.tenantDb, req.user.id, body);
  }

  @Patch('stemi/:id/balloon')
  recordBalloon(
    @Req() req: any,
    @Param('id') id: string,
    @Body() body: { balloonAt: string; cathlabCaseId?: string },
  ) {
    return this.cath.recordBalloonTime(req.tenantDb, id, body);
  }

  @Get('stemi/d2b-metrics')
  getD2bMetrics(@Req() req: any) {
    return this.cath.getD2bMetrics(req.tenantDb);
  }

  // ── Post-procedure ────────────────────────────────────────────────────

  @Post('cases/:id/post-procedure')
  recordPostProcedure(
    @Req() req: any,
    @Param('id') caseId: string,
    @Body() body: {
      sheathRemovalAt?: string;
      vascularComplication?: string;
      postTroponin?: number;
      daptDurationMonths?: number;
      followUpDate?: string;
      dischargeMedications?: any[];
      notes?: string;
    },
  ) {
    return this.cath.recordPostProcedure(req.tenantDb, caseId, body);
  }

  // ── Dashboard & Patient history ───────────────────────────────────────

  @Get('dashboard')
  getDashboard(@Req() req: any) {
    return this.cath.getDashboard(req.tenantDb);
  }

  @Get('patients/:patientId/cases')
  getPatientCases(@Req() req: any, @Param('patientId') patientId: string) {
    return this.cath.getPatientCases(req.tenantDb, patientId);
  }
}
