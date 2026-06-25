import { Controller, Get, Post, Body, Param, Query, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { ImmunisationService } from '../services/immunisation.service';

@UseGuards(JwtAuthGuard)
@Controller('immunisation')
export class ImmunisationController {
  constructor(private readonly imm: ImmunisationService) {}

  @Get('catalog')
  getCatalog(@Req() req: any) {
    return this.imm.getCatalog(req.tenantDb);
  }

  @Post('records')
  recordVaccination(
    @Req() req: any,
    @Body() body: {
      patientId: string; antigenCode: string; doseNumber?: number;
      lotNumber?: string; expiryDate?: string; siteGiven?: string; notes?: string;
    },
  ) {
    return this.imm.recordVaccination(req.tenantDb, req.user.id, body);
  }

  @Get('patients/:patientId/records')
  getPatientRecord(@Req() req: any, @Param('patientId') patientId: string) {
    return this.imm.getPatientVaccinationRecord(req.tenantDb, patientId);
  }

  @Get('patients/:patientId/schedule')
  getSchedule(@Req() req: any, @Param('patientId') patientId: string) {
    return this.imm.getVaccinationSchedule(req.tenantDb, patientId);
  }

  @Post('cold-chain')
  logColdChain(
    @Req() req: any,
    @Body() body: { fridgeId: string; tempCelsius: number; notes?: string },
  ) {
    return this.imm.logColdChain(req.tenantDb, req.user.id, body);
  }

  @Get('cold-chain/excursions')
  getColdChainExcursions(@Req() req: any) {
    return this.imm.getColdChainExcursions(req.tenantDb);
  }

  @Post('aefi')
  reportAefi(@Req() req: any, @Body() body: any) {
    return this.imm.reportAefi(req.tenantDb, req.user.id, body);
  }

  @Get('coverage')
  getCoverage(@Req() req: any) {
    return this.imm.getCoverage(req.tenantDb);
  }

  @Get('defaulters')
  getDefaulters(@Req() req: any, @Query('days') days?: string) {
    return this.imm.getDefaulters(req.tenantDb, Number(days ?? 30));
  }
}
