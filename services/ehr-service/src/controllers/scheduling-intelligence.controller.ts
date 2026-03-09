import {
  Controller,
  Get,
  Param,
  Post,
  Body,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { RolesGuard } from '../guards/roles.guard';
import { RequestWithTenant } from '../middleware/tenant.middleware';
import { SchedulingIntelligenceService } from '../services/scheduling-intelligence.service';

@ApiTags('Scheduling Intelligence')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('appointments')
export class SchedulingIntelligenceController {
  constructor(private readonly schedulingService: SchedulingIntelligenceService) {}

  @Get(':id/no-show-prediction')
  @ApiOperation({ summary: 'Get no-show prediction for an appointment' })
  async getPrediction(
    @Request() req: RequestWithTenant,
    @Param('id') appointmentId: string,
  ) {
    const existing = await this.schedulingService.getPredictionForAppointment(req.tenantDb, appointmentId);
    if (existing) return existing;

    const apptRow = await req.tenantDb.query(
      `SELECT patient_id FROM appointments WHERE id = $1 LIMIT 1`,
      [appointmentId],
    );
    if (!apptRow?.length) return { error: 'Appointment not found' };

    return this.schedulingService.predictNoShow(req.tenantDb, appointmentId, apptRow[0].patient_id);
  }

  @Post('smart-suggestions')
  @ApiOperation({ summary: 'Get AI-powered slot suggestions for a patient' })
  async smartSuggestions(
    @Request() req: RequestWithTenant,
    @Body() body: { patientId: string; visitType?: string; preferredDoctorId?: string },
  ) {
    return this.schedulingService.getSmartSlotSuggestions(
      req.tenantDb,
      body.patientId,
      body.visitType || null,
      body.preferredDoctorId || null,
    );
  }

  @Get('no-show-risk/today')
  @ApiOperation({ summary: 'List today\'s high-risk no-show appointments' })
  async highRiskToday(
    @Request() req: RequestWithTenant,
    @Query('threshold') threshold?: string,
  ) {
    const t = threshold ? parseFloat(threshold) : 0.4;
    const rows = await this.schedulingService.getHighRiskToday(req.tenantDb, t);
    return { highRiskAppointments: rows, total: rows.length };
  }
}
