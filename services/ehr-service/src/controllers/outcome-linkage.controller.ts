import {
  Controller, Post, Get, Param, Body, Query,
  UseGuards, ParseUUIDPipe,
} from '@nestjs/common';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { OutcomeLinkageService } from '../services/outcome-linkage.service';
import { RecordOutcomeDto, ScheduleFollowUpDto } from '../dto/outcome-linkage.dto';
import { EncounterType } from '../entities/encounter-outcome.entity';

@UseGuards(JwtAuthGuard)
@Controller('tenants/:tenantId/outcomes')
export class OutcomeLinkageController {
  constructor(private readonly svc: OutcomeLinkageService) {}

  @Post('schedule')
  scheduleFollowUps(
    @Param('tenantId') tenantId: string,
    @Body() dto: ScheduleFollowUpDto,
  ) {
    return this.svc.scheduleFollowUps(
      tenantId,
      dto.encounterId,
      dto.encounterType as EncounterType,
      dto.patientId,
      new Date(dto.baseDate),
    );
  }

  @Post()
  recordOutcome(
    @Param('tenantId') tenantId: string,
    @Body() dto: RecordOutcomeDto,
  ) {
    return this.svc.recordOutcome(tenantId, dto);
  }

  @Get('patient/:patientId')
  getPatientOutcomes(
    @Param('tenantId') tenantId: string,
    @Param('patientId', ParseUUIDPipe) patientId: string,
  ) {
    return this.svc.getPatientOutcomes(tenantId, patientId);
  }

  @Get('pending')
  getPendingFollowUps(
    @Param('tenantId') tenantId: string,
    @Query('dueBefore') dueBefore?: string,
    @Query('assignedTo') assignedTo?: string,
  ) {
    const date = dueBefore ? new Date(dueBefore) : new Date(Date.now() + 7 * 86400_000);
    return this.svc.getPendingFollowUps(tenantId, date, assignedTo);
  }

  @Get('overdue')
  getOverdueFollowUps(@Param('tenantId') tenantId: string) {
    return this.svc.getOverdueFollowUps(tenantId);
  }

  @Get('rates')
  getOutcomeRates(
    @Param('tenantId') tenantId: string,
    @Query('encounterType') encounterType: EncounterType,
    @Query('windowDays') windowDays: string,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
  ) {
    return this.svc.getOutcomeRates(tenantId, encounterType, Number(windowDays), startDate, endDate);
  }
}
