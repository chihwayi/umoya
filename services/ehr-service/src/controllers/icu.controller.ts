import { Controller, Get, Post, Patch, Body, Param, Query, Req, UseGuards, Logger } from '@nestjs/common';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { IcuService } from '../services/icu.service';
import { OutcomeLinkageService } from '../services/outcome-linkage.service';

@UseGuards(JwtAuthGuard)
@Controller('icu')
export class IcuController {
  private readonly logger = new Logger(IcuController.name);

  constructor(
    private readonly icu: IcuService,
    private readonly outcomeLinkage: OutcomeLinkageService,
  ) {}

  @Get('census')
  getCensus(@Req() req: any, @Query('icuType') icuType?: string) {
    return this.icu.getCensus(req.tenantDb, icuType);
  }

  @Post('admissions')
  admit(
    @Req() req: any,
    @Body() body: {
      patientId: string;
      encounterId?: string;
      icuType?: string;
      bedCode: string;
      diagnosis?: string;
      ventilatorRequired?: boolean;
      isolationRequired?: boolean;
      isolationType?: string;
    },
  ) {
    return this.icu.admitPatient(req.tenantDb, req.user.id, body);
  }

  @Patch('admissions/:id/discharge')
  async discharge(@Req() req: any, @Param('id') id: string, @Body() body: { destination?: string }) {
    const admission = await this.icu.dischargePatient(req.tenantDb, id, body.destination);
    if (admission?.patient_id && req.tenantId) {
      this.outcomeLinkage.scheduleFollowUpsFromDb(
        req.tenantDb, req.tenantId, id, 'icu_admission',
        admission.patient_id, new Date(),
      ).catch((e: any) => { this.logger.warn(`Schedule follow-ups from DB failed: ${e?.message}`); return undefined; });
    }
    return admission;
  }

  @Post('admissions/:id/vitals')
  chartVitals(@Req() req: any, @Param('id') id: string, @Body() body: any) {
    return this.icu.chartVitals(req.tenantDb, req.user.id, id, body);
  }

  @Get('admissions/:id/vitals')
  getVitals(@Req() req: any, @Param('id') id: string, @Query('hours') hours?: string) {
    return this.icu.getVitals(req.tenantDb, id, Number(hours ?? 24));
  }

  @Post('admissions/:id/ventilator')
  recordVentilator(@Req() req: any, @Param('id') id: string, @Body() body: any) {
    return this.icu.recordVentilatorSettings(req.tenantDb, req.user.id, id, body);
  }

  @Get('admissions/:id/ventilator')
  getVentilatorHistory(@Req() req: any, @Param('id') id: string) {
    return this.icu.getVentilatorHistory(req.tenantDb, id);
  }

  @Get('admissions/:id/ventilator-alarms')
  getVentilatorAlarms(@Req() req: any, @Param('id') id: string) {
    return this.icu.getActiveVentilatorAlarms(req.tenantDb, id);
  }

  @Post('admissions/:id/fluid-balance')
  upsertFluidBalance(@Req() req: any, @Param('id') id: string, @Body() body: any) {
    return this.icu.upsertFluidBalance(req.tenantDb, req.user.id, id, body);
  }

  @Get('admissions/:id/fluid-balance')
  getFluidBalance(@Req() req: any, @Param('id') id: string) {
    return this.icu.getFluidBalance(req.tenantDb, id);
  }

  @Post('admissions/:id/infusions')
  startInfusion(
    @Req() req: any,
    @Param('id') id: string,
    @Body() body: { drugName: string; concentration?: string; rateMlHr?: number; doseMcgKgMin?: number; rationale?: string },
  ) {
    return this.icu.startInfusion(req.tenantDb, req.user.id, id, body);
  }

  @Patch('infusions/:infusionId/stop')
  stopInfusion(@Req() req: any, @Param('infusionId') infusionId: string) {
    return this.icu.stopInfusion(req.tenantDb, infusionId);
  }

  @Get('admissions/:id/infusions')
  getActiveInfusions(@Req() req: any, @Param('id') id: string) {
    return this.icu.getActiveInfusions(req.tenantDb, id);
  }

  @Post('admissions/:id/daily-goals')
  saveDailyGoals(@Req() req: any, @Param('id') id: string, @Body() body: any) {
    return this.icu.saveDailyGoals(req.tenantDb, req.user.id, id, body);
  }

  @Get('admissions/:id/daily-goals')
  getDailyGoals(@Req() req: any, @Param('id') id: string) {
    return this.icu.getDailyGoals(req.tenantDb, id);
  }

  @Post('admissions/:id/scores')
  recordScore(
    @Req() req: any,
    @Param('id') id: string,
    @Body() body: {
      sofaResp?: number;
      sofaCoag?: number;
      sofaLiver?: number;
      sofaCardio?: number;
      sofaCns?: number;
      sofaRenal?: number;
      apache2Score?: number;
    },
  ) {
    return this.icu.recordScore(req.tenantDb, req.user.id, id, body);
  }

  @Get('admissions/:id/scores')
  getScores(@Req() req: any, @Param('id') id: string) {
    return this.icu.getScores(req.tenantDb, id);
  }

  @Get('dashboard')
  getDashboard(@Req() req: any) {
    return this.icu.getDashboard(req.tenantDb);
  }
}
