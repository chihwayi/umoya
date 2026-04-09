import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  ParseIntPipe,
  DefaultValuePipe,
} from '@nestjs/common';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { EpiService } from '../services/epi.service';
import { RequestWithTenant } from '../middleware/tenant.middleware';

@UseGuards(JwtAuthGuard)
@Controller('epi')
export class EpiController {
  constructor(private readonly epiService: EpiService) {}

  // ── Immunization records ─────────────────────────────────────────────────

  /**
   * POST /epi/records — Record a vaccine dose given, missed, or contraindicated.
   */
  @Post('records')
  async recordDose(@Body() body: any, @Request() req: RequestWithTenant) {
    const userId = (req.user as any)?.userId ?? (req.user as any)?.id;
    return this.epiService.recordDose(req.tenantId, userId, body);
  }

  /**
   * GET /epi/records/:patientId — Full vaccination history for a patient.
   */
  @Get('records/:patientId')
  async getPatientRecords(@Param('patientId') patientId: string, @Request() req: RequestWithTenant) {
    return this.epiService.getPatientRecords(req.tenantId, patientId);
  }

  // ── EPI schedule ─────────────────────────────────────────────────────────

  /**
   * GET /epi/schedule/:patientId — Upcoming due dates based on DOB + country EPI schedule.
   * Query params: dob (YYYY-MM-DD), countryCode (ISO 3166-1 alpha-2/3)
   */
  @Get('schedule/:patientId')
  async getPatientSchedule(
    @Param('patientId') patientId: string,
    @Query('dob') dob: string,
    @Query('countryCode') countryCode: string,
    @Request() req: RequestWithTenant,
  ) {
    return this.epiService.getPatientSchedule(req.tenantId, patientId, dob, countryCode ?? 'ZW');
  }

  // ── Defaulters ───────────────────────────────────────────────────────────

  /**
   * GET /epi/defaulters — Patients who missed a scheduled dose.
   * Query params: facilityId, countryCode, page, limit
   */
  @Get('defaulters')
  async getDefaulters(
    @Query('facilityId') facilityId: string,
    @Query('countryCode') countryCode: string,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(50), ParseIntPipe) limit: number,
    @Request() req: RequestWithTenant,
  ) {
    return this.epiService.getDefaulters(req.tenantId, facilityId, countryCode, page, limit);
  }

  // ── AEFI ─────────────────────────────────────────────────────────────────

  /**
   * POST /epi/aefi — Report an adverse event following immunization.
   */
  @Post('aefi')
  async reportAefi(@Body() body: any, @Request() req: RequestWithTenant) {
    const userId = (req.user as any)?.userId ?? (req.user as any)?.id;
    return this.epiService.reportAefi(req.tenantId, userId, body);
  }

  /**
   * GET /epi/aefi/:patientId — AEFI history for a patient.
   */
  @Get('aefi/:patientId')
  async getPatientAefi(@Param('patientId') patientId: string, @Request() req: RequestWithTenant) {
    return this.epiService.getPatientAefi(req.tenantId, patientId);
  }

  // ── Vaccine lots ─────────────────────────────────────────────────────────

  /**
   * GET /epi/lots — List active vaccine lots.
   */
  @Get('lots')
  async getLots(
    @Query('activeOnly') activeOnly: string,
    @Request() req: RequestWithTenant,
  ) {
    return this.epiService.getLots(req.tenantId, activeOnly !== 'false');
  }

  /**
   * POST /epi/lots — Add a new vaccine lot.
   */
  @Post('lots')
  async addLot(@Body() body: any, @Request() req: RequestWithTenant) {
    return this.epiService.addLot(req.tenantId, body);
  }

  // ── Cold chain ───────────────────────────────────────────────────────────

  /**
   * POST /epi/cold-chain — Record a temperature log entry.
   */
  @Post('cold-chain')
  async recordTemperature(@Body() body: any, @Request() req: RequestWithTenant) {
    const userId = (req.user as any)?.userId ?? (req.user as any)?.id;
    return this.epiService.recordTemperature(req.tenantId, userId, body);
  }

  /**
   * GET /epi/cold-chain/excursions — Temperature excursions in last N days.
   * Query param: days (default 30)
   */
  @Get('cold-chain/excursions')
  async getColdChainExcursions(
    @Query('days', new DefaultValuePipe(30), ParseIntPipe) days: number,
    @Request() req: RequestWithTenant,
  ) {
    return this.epiService.getColdChainExcursions(req.tenantId, days);
  }

  // ── Coverage ─────────────────────────────────────────────────────────────

  /**
   * GET /epi/coverage — Coverage rate by vaccine for reporting period.
   * Query params: facilityId, from (YYYY-MM-DD), to (YYYY-MM-DD)
   */
  @Get('coverage')
  async getCoverageRate(
    @Query('facilityId') facilityId: string,
    @Query('from') fromDate: string,
    @Query('to') toDate: string,
    @Request() req: RequestWithTenant,
  ) {
    return this.epiService.getCoverageRate(req.tenantId, facilityId, fromDate, toDate);
  }

  // ── DHIS2 sync status ────────────────────────────────────────────────────

  /**
   * GET /epi/sync/status/:entityId — DHIS2 sync status for an entity.
   */
  @Get('sync/status/:entityId')
  async getSyncStatus(@Param('entityId') entityId: string, @Request() req: RequestWithTenant) {
    return this.epiService.getSyncStatus(req.tenantId, entityId);
  }

  /**
   * GET /epi/sync/pending — All pending DHIS2 sync log entries (used by CDSS batch sync).
   */
  @Get('sync/pending')
  async getPendingSyncRecords(@Request() req: RequestWithTenant) {
    return this.epiService.getPendingSyncRecords(req.tenantId);
  }
}
