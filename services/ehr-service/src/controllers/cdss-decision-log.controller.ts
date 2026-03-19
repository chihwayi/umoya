import {
  Controller, Get, Post, Patch, Body, Param, Query, UseGuards, Request,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import {
  CdssDecisionLogService,
  LogDecisionDto,
  RecordActionDto,
  LinkOutcomeDto,
} from '../services/cdss-decision-log.service';
import { RequestWithTenant } from '../middleware/tenant.middleware';

@ApiTags('CDSS Decision Log')
@ApiBearerAuth()
@Controller('cdss-log')
@UseGuards(JwtAuthGuard)
export class CdssDecisionLogController {
  constructor(private readonly logService: CdssDecisionLogService) {}

  /**
   * Log a new CDSS recommendation.  Called internally by the CDSS hook service
   * after every AI call, but also available as a REST endpoint for flexibility.
   */
  @Post()
  @ApiOperation({ summary: 'Log a CDSS recommendation' })
  @ApiResponse({ status: 201 })
  async logDecision(@Body() dto: LogDecisionDto, @Request() req: RequestWithTenant) {
    return this.logService.logDecision(dto, req.tenantDb);
  }

  /**
   * Record the clinician's response to a specific recommendation.
   */
  @Patch(':id/action')
  @ApiOperation({ summary: 'Record clinician action on a CDSS recommendation' })
  @ApiResponse({ status: 200 })
  async recordAction(
    @Param('id') id: string,
    @Body() dto: RecordActionDto,
    @Request() req: RequestWithTenant,
  ) {
    return this.logService.recordClinicianAction(id, dto, req.tenantDb);
  }

  /**
   * Link a clinical outcome to a logged decision.
   */
  @Patch(':id/outcome')
  @ApiOperation({ summary: 'Link patient outcome to a CDSS decision log entry' })
  @ApiResponse({ status: 200 })
  async linkOutcome(
    @Param('id') id: string,
    @Body() dto: LinkOutcomeDto,
    @Request() req: RequestWithTenant,
  ) {
    return this.logService.linkOutcome(id, dto, req.tenantDb);
  }

  /**
   * Fetch decision history for a patient.
   */
  @Get('patient/:patientId')
  @ApiOperation({ summary: 'Get CDSS decision history for a patient' })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiResponse({ status: 200 })
  async getForPatient(
    @Param('patientId') patientId: string,
    @Query('limit') limit?: string,
    @Request() req?: RequestWithTenant,
  ) {
    return this.logService.getForPatient(patientId, req!.tenantDb, limit ? parseInt(limit, 10) : 20);
  }

  /**
   * Action statistics for analytics dashboard.
   */
  @Get('stats')
  @ApiOperation({ summary: 'Get CDSS action acceptance stats for this tenant' })
  @ApiResponse({ status: 200 })
  async getStats(@Request() req: RequestWithTenant) {
    return this.logService.getActionStats(req.tenantDb);
  }
}
