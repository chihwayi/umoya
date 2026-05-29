import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards, Req, Logger } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery, ApiParam } from '@nestjs/swagger';
import { PatientProService } from '../services/patient-pro.service';
import { SmsService } from '../services/sms.service';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { RequestWithTenant } from '../middleware/tenant.middleware';

@ApiTags('Patient-Reported Outcomes (PROs)')
@ApiBearerAuth()
@Controller('pro')
@UseGuards(JwtAuthGuard)
export class PatientProController {
  private readonly logger = new Logger(PatientProController.name);

  constructor(
    private readonly patientProService: PatientProService,
    private readonly smsService: SmsService,
  ) {}

  @Post('patients/:patientId/schedules')
  @ApiOperation({ summary: 'Create questionnaire schedule', description: 'Create a scheduled questionnaire assignment for a patient' })
  @ApiParam({ name: 'patientId', description: 'Patient ID' })
  @ApiResponse({ status: 201, description: 'Schedule created successfully' })
  async createSchedule(
    @Param('patientId') patientId: string,
    @Body() scheduleData: {
      templateId: string;
      scheduleType: 'one_time' | 'daily' | 'weekly' | 'monthly' | 'event_triggered';
      startDate: string;
      endDate?: string;
      frequency?: number;
      dayOfWeek?: number;
      dayOfMonth?: number;
      triggerEvent?: string;
    },
    @Req() req: RequestWithTenant & { user: any },
  ) {
    const userId = req.user?.id || req.user?.userId;
    return this.patientProService.createQuestionnaireSchedule(req.tenantDb, patientId, scheduleData.templateId, {
      scheduleType: scheduleData.scheduleType,
      startDate: new Date(scheduleData.startDate),
      endDate: scheduleData.endDate ? new Date(scheduleData.endDate) : undefined,
      frequency: scheduleData.frequency,
      dayOfWeek: scheduleData.dayOfWeek,
      dayOfMonth: scheduleData.dayOfMonth,
      triggerEvent: scheduleData.triggerEvent,
      createdBy: userId,
    });
  }

  @Get('patients/:patientId/schedules')
  @ApiOperation({ summary: 'Get patient schedules', description: 'Get all questionnaire schedules for a patient' })
  @ApiParam({ name: 'patientId', description: 'Patient ID' })
  @ApiResponse({ status: 200, description: 'Schedules retrieved successfully' })
  async getPatientSchedules(@Param('patientId') patientId: string, @Req() req: RequestWithTenant) {
    return this.patientProService.getPatientSchedules(req.tenantDb, patientId);
  }

  @Put('schedules/:scheduleId')
  @ApiOperation({ summary: 'Update schedule', description: 'Update a questionnaire schedule' })
  @ApiParam({ name: 'scheduleId', description: 'Schedule ID' })
  @ApiResponse({ status: 200, description: 'Schedule updated successfully' })
  async updateSchedule(
    @Param('scheduleId') scheduleId: string,
    @Body() updates: {
      isActive?: boolean;
      endDate?: string;
      frequency?: number;
    },
    @Req() req: RequestWithTenant,
  ) {
    return this.patientProService.updateSchedule(req.tenantDb, scheduleId, {
      ...updates,
      endDate: updates.endDate ? new Date(updates.endDate) : undefined,
    });
  }

  @Delete('schedules/:scheduleId')
  @ApiOperation({ summary: 'Delete schedule', description: 'Delete a questionnaire schedule' })
  @ApiParam({ name: 'scheduleId', description: 'Schedule ID' })
  @ApiResponse({ status: 200, description: 'Schedule deleted successfully' })
  async deleteSchedule(@Param('scheduleId') scheduleId: string, @Req() req: RequestWithTenant) {
    await this.patientProService.deleteSchedule(req.tenantDb, scheduleId);
    return { message: 'Schedule deleted successfully' };
  }

  @Get('patients/:patientId/trends')
  @ApiOperation({ summary: 'Get PRO trends', description: 'Get PRO score trends for a patient' })
  @ApiParam({ name: 'patientId', description: 'Patient ID' })
  @ApiQuery({ name: 'questionnaireCode', required: false, type: String })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiResponse({ status: 200, description: 'PRO trends retrieved successfully' })
  async getProTrends(
    @Param('patientId') patientId: string,
    @Req() req: RequestWithTenant,
    @Query('questionnaireCode') questionnaireCode?: string,
    @Query('limit') limit?: number,
  ) {
    return this.patientProService.getProTrends(
      req.tenantDb,
      patientId,
      questionnaireCode,
      limit ? parseInt(String(limit), 10) : 10,
    );
  }

  @Get('analytics/population')
  @ApiOperation({ summary: 'Get population PRO analytics', description: 'Get PRO analytics across all patients' })
  @ApiQuery({ name: 'dateFrom', required: false, type: String })
  @ApiQuery({ name: 'dateTo', required: false, type: String })
  @ApiQuery({ name: 'questionnaireCode', required: false, type: String })
  @ApiQuery({ name: 'category', required: false, type: String })
  @ApiResponse({ status: 200, description: 'Analytics retrieved successfully' })
  async getPopulationAnalytics(
    @Req() req: RequestWithTenant,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
    @Query('questionnaireCode') questionnaireCode?: string,
    @Query('category') category?: string,
  ) {
    return this.patientProService.getPopulationProAnalytics(req.tenantDb, {
      dateFrom,
      dateTo,
      questionnaireCode,
      category,
    });
  }

  @Post('patients/:patientId/trigger-event')
  @ApiOperation({ summary: 'Trigger event-based questionnaire', description: 'Manually trigger an event-based questionnaire assignment' })
  @ApiParam({ name: 'patientId', description: 'Patient ID' })
  @ApiResponse({ status: 200, description: 'Event triggered successfully' })
  async triggerEvent(
    @Param('patientId') patientId: string,
    @Body() body: { eventType: string },
    @Req() req: RequestWithTenant,
  ) {
    await this.patientProService.triggerEventQuestionnaire(req.tenantDb, patientId, body.eventType);
    return { message: 'Event triggered successfully' };
  }

  @Get('patients/:patientId/alerts')
  @ApiOperation({ summary: 'Get PRO alerts for a patient', description: 'Get all active PRO alerts for a patient' })
  @ApiParam({ name: 'patientId', description: 'Patient ID' })
  @ApiQuery({ name: 'status', required: false, enum: ['active', 'acknowledged', 'resolved', 'dismissed'] })
  @ApiResponse({ status: 200, description: 'PRO alerts retrieved successfully' })
  async getPatientProAlerts(
    @Param('patientId') patientId: string,
    @Req() req: RequestWithTenant,
    @Query('status') status?: 'active' | 'acknowledged' | 'resolved' | 'dismissed',
  ) {
    return this.patientProService.getPatientProAlerts(req.tenantDb, patientId, status);
  }

  @Get('patients/:patientId/questionnaires/history')
  @ApiOperation({ summary: 'Get patient questionnaire history', description: 'Get all completed questionnaires for a patient' })
  @ApiParam({ name: 'patientId', description: 'Patient ID' })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'category', required: false, type: String })
  @ApiResponse({ status: 200, description: 'Questionnaire history retrieved successfully' })
  async getPatientQuestionnaireHistory(
    @Param('patientId') patientId: string,
    @Req() req: RequestWithTenant,
    @Query('limit') limit?: number,
    @Query('category') category?: string,
  ) {
    return this.patientProService.getPatientQuestionnaireHistory(req.tenantDb, patientId, {
      limit: limit ? parseInt(String(limit), 10) : undefined,
      category,
    });
  }

  // ============================================
  // QUESTIONNAIRE LIBRARY ENDPOINTS (Doctor-facing)
  // ============================================

  @Get('library')
  @ApiOperation({ summary: 'Browse questionnaire library', description: 'Browse all available questionnaires from the library' })
  @ApiQuery({ name: 'category', required: false, type: String, description: 'Filter by category' })
  @ApiQuery({ name: 'search', required: false, type: String, description: 'Search by name or code' })
  @ApiResponse({ status: 200, description: 'Questionnaire library retrieved successfully' })
  async browseLibrary(
    @Req() req: RequestWithTenant,
    @Query('category') category?: string,
    @Query('search') search?: string,
  ) {
    return this.patientProService.browseQuestionnaireLibrary({ category, search });
  }

  @Get('library/:code')
  @ApiOperation({ summary: 'Get questionnaire details from library', description: 'Get full details of a questionnaire from the library' })
  @ApiParam({ name: 'code', description: 'Questionnaire code' })
  @ApiResponse({ status: 200, description: 'Questionnaire details retrieved successfully' })
  async getLibraryQuestionnaire(@Param('code') code: string, @Req() req: RequestWithTenant) {
    return this.patientProService.getQuestionnaireFromLibrary(code);
  }

  @Post('library/:code/import')
  @ApiOperation({ summary: 'Import questionnaire from library', description: 'Import a questionnaire from the library into the database' })
  @ApiParam({ name: 'code', description: 'Questionnaire code' })
  @ApiQuery({ name: 'overwrite', required: false, type: Boolean, description: 'Overwrite if already exists' })
  @ApiResponse({ status: 200, description: 'Questionnaire imported successfully' })
  async importQuestionnaire(
    @Param('code') code: string,
    @Req() req: RequestWithTenant,
    @Query('overwrite') overwrite?: boolean,
  ) {
    return this.patientProService.importQuestionnaireFromLibrary(req.tenantDb, code, { overwrite: overwrite === true });
  }

  @Post('patients/:patientId/assign/:code')
  @ApiOperation({ summary: 'Assign questionnaire to patient by code', description: 'Assign a questionnaire to a patient using the questionnaire code (auto-imports from library if needed)' })
  @ApiParam({ name: 'patientId', description: 'Patient ID' })
  @ApiParam({ name: 'code', description: 'Questionnaire code' })
  @ApiQuery({ name: 'autoImport', required: false, type: Boolean, description: 'Auto-import from library if not in database' })
  @ApiQuery({ name: 'dueDate', required: false, type: String, description: 'Due date (ISO format)' })
  @ApiResponse({ status: 200, description: 'Questionnaire assigned successfully' })
  async assignQuestionnaireByCode(
    @Param('patientId') patientId: string,
    @Param('code') code: string,
    @Req() req: RequestWithTenant & { user: any },
    @Query('autoImport') autoImport?: boolean,
    @Query('dueDate') dueDate?: string,
    @Body() body?: { notes?: string; appointmentId?: string },
  ) {
    const userId = req.user?.id || req.user?.userId;
    return this.patientProService.assignQuestionnaireByCode(
      req.tenantDb,
      patientId,
      code,
      {
        assignedBy: userId,
        dueDate: dueDate || undefined,
        notes: body?.notes,
        appointmentId: body?.appointmentId,
        autoImport: autoImport === true,
      },
    );
  }

  // ============================================
  // QUESTIONNAIRE TEMPLATE MANAGEMENT (Doctor-facing)
  // ============================================

  @Post('templates')
  @ApiOperation({ summary: 'Create custom questionnaire template', description: 'Create a new custom questionnaire template' })
  @ApiResponse({ status: 201, description: 'Questionnaire template created successfully' })
  async createTemplate(
    @Body() templateData: any,
    @Req() req: RequestWithTenant & { user: { id: string } },
  ) {
    const createdBy = (req.user as any)?.userId ?? (req.user as any)?.id;
    return this.patientProService.createQuestionnaireTemplate(req.tenantDb, templateData, createdBy);
  }

  @Put('templates/:templateId')
  @ApiOperation({ summary: 'Update questionnaire template', description: 'Update an existing questionnaire template' })
  @ApiParam({ name: 'templateId', description: 'Template ID' })
  @ApiResponse({ status: 200, description: 'Template updated successfully' })
  async updateTemplate(
    @Param('templateId') templateId: string,
    @Body() updates: any,
    @Req() req: RequestWithTenant,
  ) {
    return this.patientProService.updateQuestionnaireTemplate(req.tenantDb, templateId, updates);
  }

  @Delete('templates/:templateId')
  @ApiOperation({ summary: 'Delete questionnaire template', description: 'Soft delete a custom questionnaire template' })
  @ApiParam({ name: 'templateId', description: 'Template ID' })
  @ApiResponse({ status: 200, description: 'Template deleted successfully' })
  async deleteTemplate(
    @Param('templateId') templateId: string,
    @Req() req: RequestWithTenant,
  ) {
    return this.patientProService.deleteQuestionnaireTemplate(req.tenantDb, templateId);
  }

  @Get('templates')
  @ApiOperation({ summary: 'Get all questionnaire templates', description: 'Get all questionnaire templates (both standard and custom)' })
  @ApiQuery({ name: 'includeInactive', required: false, type: Boolean, description: 'Include inactive templates' })
  @ApiResponse({ status: 200, description: 'Templates retrieved successfully' })
  async getTemplates(
    @Req() req: RequestWithTenant,
    @Query('includeInactive') includeInactive?: boolean,
  ) {
    const query = includeInactive
      ? `SELECT * FROM questionnaire_templates ORDER BY is_standard DESC, name ASC`
      : `SELECT * FROM questionnaire_templates WHERE is_active = true ORDER BY is_standard DESC, name ASC`;
    return req.tenantDb.query(query);
  }

  @Put('alerts/:alertId/status')
  @ApiOperation({ summary: 'Update PRO alert status', description: 'Mark a PRO alert as acknowledged, resolved, or dismissed' })
  @ApiParam({ name: 'alertId', description: 'PRO alert ID' })
  async updateAlertStatus(
    @Param('alertId') alertId: string,
    @Body() body: { status: 'acknowledged' | 'resolved' | 'dismissed'; notes?: string },
    @Req() req: RequestWithTenant & { user: any },
  ) {
    const clinicianId = req.user?.id ?? req.user?.userId ?? 'unknown';
    await req.tenantDb.query(
      `UPDATE pro_alerts
       SET status = $1,
           acknowledged_by = $2,
           acknowledged_at = NOW(),
           notes = COALESCE($3, notes),
           updated_at = NOW()
       WHERE id = $4`,
      [body.status, clinicianId, body.notes ?? null, alertId],
    );
    return { ok: true };
  }

  @Post('responses/:responseId/feedback')
  @ApiOperation({ summary: 'Send clinician feedback to patient', description: 'Clinician writes a message to the patient about their PRO result' })
  @ApiParam({ name: 'responseId', description: 'Patient questionnaire (response) ID' })
  async addClinicianFeedback(
    @Param('responseId') responseId: string,
    @Body() body: { message: string },
    @Req() req: RequestWithTenant & { user: any },
  ) {
    if (!body.message?.trim()) {
      throw new Error('Message is required');
    }
    const clinicianId = req.user?.id ?? req.user?.userId ?? 'unknown';

    const [row] = await req.tenantDb.query(
      `INSERT INTO pro_clinician_feedback
         (patient_questionnaire_id, clinician_id, message, created_at)
       VALUES ($1, $2, $3, NOW())
       RETURNING id, created_at`,
      [responseId, clinicianId, body.message.trim()],
    );

    // Mark all active alerts for this questionnaire as acknowledged
    await req.tenantDb.query(
      `UPDATE pro_alerts
       SET status = 'acknowledged', acknowledged_by = $1, acknowledged_at = NOW(), updated_at = NOW()
       WHERE patient_questionnaire_id = $2 AND status = 'active'`,
      [clinicianId, responseId],
    );

    // SMS the patient
    try {
      const patientRow = await req.tenantDb.query(
        `SELECT p.phone, p.first_name
         FROM patient_questionnaires pq
         JOIN patients p ON p.id = pq.patient_id
         WHERE pq.id = $1 LIMIT 1`,
        [responseId],
      );
      const phone = patientRow?.[0]?.phone;
      const firstName = patientRow?.[0]?.first_name ?? 'there';
      if (phone) {
        await this.smsService.send(
          phone,
          `Umoya: Hi ${firstName}, your care team has left you a message about your recent health questionnaire. Please open the Umoya Patient app to read it.`,
        );
      }
    } catch {
      // Never block feedback on SMS failure
    }

    return { ok: true, feedbackId: row?.id, createdAt: row?.created_at };
  }

  @Get('responses/:responseId/feedback')
  @ApiOperation({ summary: 'Get clinician feedback for a response', description: 'Patient or clinician reads feedback messages for a questionnaire response' })
  @ApiParam({ name: 'responseId', description: 'Patient questionnaire (response) ID' })
  async getClinicianFeedback(
    @Param('responseId') responseId: string,
    @Req() req: RequestWithTenant,
  ) {
    const rows = await req.tenantDb.query(
      `SELECT pcf.id, pcf.message, pcf.created_at,
              u.first_name || ' ' || u.last_name AS clinician_name
       FROM pro_clinician_feedback pcf
       LEFT JOIN users u ON u.id = pcf.clinician_id
       WHERE pcf.patient_questionnaire_id = $1
       ORDER BY pcf.created_at ASC`,
      [responseId],
    );
    return rows;
  }
}
