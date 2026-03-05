import { Body, Controller, Get, Param, Post, Query, Request, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiSecurity, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { RolesGuard } from '../guards/roles.guard';
import { Roles } from '../decorators/roles.decorator';
import { RequestWithTenant } from '../middleware/tenant.middleware';
import { NurseWorklistService } from '../services/nurse-worklist.service';

@ApiTags('Nurse Worklist State')
@ApiSecurity('tenant-key')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('nurse-worklist')
export class NurseWorklistController {
  constructor(private readonly nurseWorklistService: NurseWorklistService) {}

  @Get('state')
  @Roles('nurse', 'doctor', 'admin')
  @ApiOperation({ summary: 'Get server-scoped nurse task/alert state for current user' })
  @ApiResponse({ status: 200, description: 'Nurse worklist state fetched' })
  async getState(@Request() req: RequestWithTenant) {
    const user = req.user as any;
    return this.nurseWorklistService.getState(req.tenantDb, user.id);
  }

  @Get('cross-module-feed')
  @Roles('nurse', 'doctor', 'admin')
  @ApiOperation({ summary: 'Get cross-module specialist escalation feed for nurse workflow' })
  @ApiResponse({ status: 200, description: 'Cross-module escalation feed fetched' })
  async getCrossModuleFeed(@Request() req: RequestWithTenant) {
    return this.nurseWorklistService.getCrossModuleEscalationFeed(req.tenantDb);
  }

  @Get('analytics/outcomes')
  @Roles('nurse', 'doctor', 'admin')
  @ApiOperation({ summary: 'Get nurse outcome analytics for cross-module AI/CDSS workflow execution' })
  @ApiResponse({ status: 200, description: 'Nurse outcome analytics fetched' })
  async getOutcomeAnalytics(
    @Query('days') daysRaw: string,
    @Request() req: RequestWithTenant,
  ) {
    const parsedDays = Number(daysRaw);
    return this.nurseWorklistService.getOutcomeAnalytics(req.tenantDb, {
      days: Number.isFinite(parsedDays) ? parsedDays : undefined,
    });
  }

  @Get('analytics/doctor-outcomes')
  @Roles('nurse', 'doctor', 'admin')
  @ApiOperation({ summary: 'Get doctor outcome analytics for doctor-routed cross-module workflow execution' })
  @ApiResponse({ status: 200, description: 'Doctor outcome analytics fetched' })
  async getDoctorOutcomeAnalytics(
    @Query('days') daysRaw: string,
    @Query('module') moduleRaw: string,
    @Query('status') statusRaw: string,
    @Query('caseId') caseIdRaw: string,
    @Query('dateFrom') dateFromRaw: string,
    @Query('dateTo') dateToRaw: string,
    @Request() req: RequestWithTenant,
  ) {
    const parsedDays = Number(daysRaw);
    return this.nurseWorklistService.getDoctorOutcomeAnalytics(req.tenantDb, {
      days: Number.isFinite(parsedDays) ? parsedDays : undefined,
      module: moduleRaw,
      status: statusRaw,
      caseId: caseIdRaw,
      dateFrom: dateFromRaw,
      dateTo: dateToRaw,
    });
  }

  @Post('cross-module/workflow')
  @Roles('nurse', 'doctor', 'admin')
  @ApiOperation({ summary: 'Update shared workflow status for a cross-module nurse queue item' })
  @ApiResponse({ status: 200, description: 'Cross-module workflow status recorded' })
  async updateCrossModuleWorkflow(
    @Body()
    body: {
      itemId: string;
      module: string;
      itemType: string;
      sourceRecordId?: string | null;
      patientId?: string | null;
      enrollmentId?: string | null;
      status: 'acknowledged' | 'completed';
      note?: string;
      context?: any;
      destinationRole?: string | null;
      destinationService?: string | null;
      destinationSpecialty?: string | null;
      destinationUserId?: string | null;
      destinationFacilityId?: string | null;
      destinationFacilityName?: string | null;
    },
    @Request() req: RequestWithTenant,
  ) {
    const user = req.user as any;
    return this.nurseWorklistService.updateCrossModuleWorkflowState(
      req.tenantDb,
      user,
      body,
      {
        ipAddress: String(req.ip || req.headers['x-forwarded-for'] || ''),
        userAgent: req.headers['user-agent'],
        sessionId: (req.headers['x-session-id'] as string) || undefined,
      },
    );
  }

  @Post('cross-module/hiv-recommendation-action')
  @Roles('nurse', 'doctor', 'admin')
  @ApiOperation({ summary: 'Execute an HIV recommendation bundle action from the nurse queue' })
  @ApiResponse({ status: 200, description: 'HIV recommendation action executed' })
  async executeHivRecommendationAction(
    @Body()
    body: {
      itemId: string;
      itemType: string;
      sourceRecordId?: string | null;
      patientId?: string | null;
      enrollmentId?: string | null;
      actionId: string;
      actionType?: string | null;
      actionTitle?: string | null;
      actionPayload?: any;
      destinationRole?: string | null;
      destinationService?: string | null;
      destinationSpecialty?: string | null;
      destinationUserId?: string | null;
      destinationUserName?: string | null;
      destinationFacilityId?: string | null;
      destinationFacilityName?: string | null;
    },
    @Request() req: RequestWithTenant,
  ) {
    const user = req.user as any;
    return this.nurseWorklistService.executeHivRecommendationAction(
      req.tenantDb,
      user,
      body,
      {
        ipAddress: String(req.ip || req.headers['x-forwarded-for'] || ''),
        userAgent: req.headers['user-agent'],
        sessionId: (req.headers['x-session-id'] as string) || undefined,
      },
    );
  }

  @Post('cross-module/oncology-recommendation-action')
  @Roles('nurse', 'doctor', 'admin')
  @ApiOperation({ summary: 'Execute an oncology recommendation bundle action from the nurse queue' })
  @ApiResponse({ status: 200, description: 'Oncology recommendation action executed' })
  async executeOncologyRecommendationAction(
    @Body()
    body: {
      itemId: string;
      itemType: string;
      sourceRecordId?: string | null;
      patientId?: string | null;
      caseId?: string | null;
      actionId: string;
      actionType?: string | null;
      actionTitle?: string | null;
      actionPayload?: any;
      destinationRole?: string | null;
      destinationService?: string | null;
      destinationSpecialty?: string | null;
      destinationUserId?: string | null;
      destinationUserName?: string | null;
      destinationFacilityId?: string | null;
      destinationFacilityName?: string | null;
    },
    @Request() req: RequestWithTenant,
  ) {
    const user = req.user as any;
    return this.nurseWorklistService.executeOncologyRecommendationAction(
      req.tenantDb,
      user,
      body,
      {
        ipAddress: String(req.ip || req.headers['x-forwarded-for'] || ''),
        userAgent: req.headers['user-agent'],
        sessionId: (req.headers['x-session-id'] as string) || undefined,
      },
    );
  }

  @Post('cross-module/cardiology-recommendation-action')
  @Roles('nurse', 'doctor', 'admin')
  @ApiOperation({ summary: 'Execute a cardiology recommendation bundle action from the nurse queue' })
  @ApiResponse({ status: 200, description: 'Cardiology recommendation action executed' })
  async executeCardiologyRecommendationAction(
    @Body()
    body: {
      itemId: string;
      itemType: string;
      sourceRecordId?: string | null;
      patientId?: string | null;
      encounterId?: string | null;
      actionId: string;
      actionType?: string | null;
      actionTitle?: string | null;
      actionPayload?: any;
      destinationRole?: string | null;
      destinationService?: string | null;
      destinationSpecialty?: string | null;
      destinationUserId?: string | null;
      destinationUserName?: string | null;
      destinationFacilityId?: string | null;
      destinationFacilityName?: string | null;
    },
    @Request() req: RequestWithTenant,
  ) {
    const user = req.user as any;
    return this.nurseWorklistService.executeCardiologyRecommendationAction(
      req.tenantDb,
      user,
      body,
      {
        ipAddress: String(req.ip || req.headers['x-forwarded-for'] || ''),
        userAgent: req.headers['user-agent'],
        sessionId: (req.headers['x-session-id'] as string) || undefined,
      },
    );
  }

  @Post('cross-module/ed-recommendation-action')
  @Roles('nurse', 'doctor', 'admin')
  @ApiOperation({ summary: 'Execute an emergency department recommendation bundle action from the nurse queue' })
  @ApiResponse({ status: 200, description: 'ED recommendation action executed' })
  async executeEdRecommendationAction(
    @Body()
    body: {
      itemId: string;
      itemType: string;
      sourceRecordId?: string | null;
      patientId?: string | null;
      visitId?: string | null;
      actionId: string;
      actionType?: string | null;
      actionTitle?: string | null;
      actionPayload?: any;
      destinationRole?: string | null;
      destinationService?: string | null;
      destinationSpecialty?: string | null;
      destinationUserId?: string | null;
      destinationUserName?: string | null;
      destinationFacilityId?: string | null;
      destinationFacilityName?: string | null;
    },
    @Request() req: RequestWithTenant,
  ) {
    const user = req.user as any;
    return this.nurseWorklistService.executeEdRecommendationAction(
      req.tenantDb,
      user,
      body,
      {
        ipAddress: String(req.ip || req.headers['x-forwarded-for'] || ''),
        userAgent: req.headers['user-agent'],
        sessionId: (req.headers['x-session-id'] as string) || undefined,
      },
    );
  }

  @Post('cross-module/sepsis-recommendation-action')
  @Roles('nurse', 'doctor', 'admin')
  @ApiOperation({ summary: 'Execute a sepsis recommendation bundle action from the nurse queue' })
  @ApiResponse({ status: 200, description: 'Sepsis recommendation action executed' })
  async executeSepsisRecommendationAction(
    @Body()
    body: {
      itemId: string;
      itemType: string;
      sourceRecordId?: string | null;
      patientId?: string | null;
      bundleId?: string | null;
      actionId: string;
      actionType?: string | null;
      actionTitle?: string | null;
      actionPayload?: any;
      destinationRole?: string | null;
      destinationService?: string | null;
      destinationSpecialty?: string | null;
      destinationUserId?: string | null;
      destinationUserName?: string | null;
      destinationFacilityId?: string | null;
      destinationFacilityName?: string | null;
    },
    @Request() req: RequestWithTenant,
  ) {
    const user = req.user as any;
    return this.nurseWorklistService.executeSepsisRecommendationAction(
      req.tenantDb,
      user,
      body,
      {
        ipAddress: String(req.ip || req.headers['x-forwarded-for'] || ''),
        userAgent: req.headers['user-agent'],
        sessionId: (req.headers['x-session-id'] as string) || undefined,
      },
    );
  }

  @Post('tasks/:taskId/complete')
  @Roles('nurse', 'doctor', 'admin')
  @ApiOperation({ summary: 'Persist server-scoped task completion for current user' })
  @ApiResponse({ status: 200, description: 'Task completion recorded' })
  async completeTask(
    @Param('taskId') taskId: string,
    @Body() body: { reason?: string; patientId?: string; context?: any },
    @Request() req: RequestWithTenant,
  ) {
    const user = req.user as any;
    return this.nurseWorklistService.completeTask(
      req.tenantDb,
      user,
      taskId,
      body,
      {
        ipAddress: String(req.ip || req.headers['x-forwarded-for'] || ''),
        userAgent: req.headers['user-agent'],
        sessionId: (req.headers['x-session-id'] as string) || undefined,
      },
    );
  }

  @Post('alerts/:alertId/acknowledge')
  @Roles('nurse', 'doctor', 'admin')
  @ApiOperation({ summary: 'Persist server-scoped alert acknowledgement for current user' })
  @ApiResponse({ status: 200, description: 'Alert acknowledgement recorded' })
  async acknowledgeAlert(
    @Param('alertId') alertId: string,
    @Body() body: { reason?: string; patientId?: string; context?: any },
    @Request() req: RequestWithTenant,
  ) {
    const user = req.user as any;
    return this.nurseWorklistService.acknowledgeAlert(
      req.tenantDb,
      user,
      alertId,
      body,
      {
        ipAddress: String(req.ip || req.headers['x-forwarded-for'] || ''),
        userAgent: req.headers['user-agent'],
        sessionId: (req.headers['x-session-id'] as string) || undefined,
      },
    );
  }

  @Get('handoff/:patientId/state')
  @Roles('nurse', 'doctor', 'admin')
  @ApiOperation({ summary: 'Get nurse handoff workflow state for a patient' })
  @ApiResponse({ status: 200, description: 'Handoff state fetched' })
  async getHandoffState(@Param('patientId') patientId: string, @Request() req: RequestWithTenant) {
    return this.nurseWorklistService.getHandoffState(req.tenantDb, patientId);
  }

  @Post('handoff/:patientId/finalize')
  @Roles('nurse', 'doctor', 'admin')
  @ApiOperation({ summary: 'Finalize nurse handoff summary for a patient' })
  @ApiResponse({ status: 200, description: 'Handoff finalized' })
  async finalizeHandoff(
    @Param('patientId') patientId: string,
    @Body() body: { summary?: string; context?: any; reason?: string },
    @Request() req: RequestWithTenant,
  ) {
    const user = req.user as any;
    return this.nurseWorklistService.finalizeHandoff(
      req.tenantDb,
      user,
      patientId,
      body,
      {
        ipAddress: String(req.ip || req.headers['x-forwarded-for'] || ''),
        userAgent: req.headers['user-agent'],
        sessionId: (req.headers['x-session-id'] as string) || undefined,
      },
    );
  }

  @Post('handoff/:patientId/review')
  @Roles('nurse', 'doctor', 'admin')
  @ApiOperation({ summary: 'Confirm reviewer acknowledgement for nurse handoff' })
  @ApiResponse({ status: 200, description: 'Handoff review confirmation recorded' })
  async reviewHandoff(
    @Param('patientId') patientId: string,
    @Body() body: { reviewerName?: string; reviewerRole?: string; context?: any; reason?: string },
    @Request() req: RequestWithTenant,
  ) {
    const user = req.user as any;
    return this.nurseWorklistService.confirmHandoffReview(
      req.tenantDb,
      user,
      patientId,
      body,
      {
        ipAddress: String(req.ip || req.headers['x-forwarded-for'] || ''),
        userAgent: req.headers['user-agent'],
        sessionId: (req.headers['x-session-id'] as string) || undefined,
      },
    );
  }

  @Post('handoff/:patientId/share')
  @Roles('nurse', 'doctor', 'admin')
  @ApiOperation({ summary: 'Share finalized handoff summary to next shift/recipient' })
  @ApiResponse({ status: 200, description: 'Handoff share recorded' })
  async shareHandoff(
    @Param('patientId') patientId: string,
    @Body() body: { channel?: string; recipient?: string; context?: any; reason?: string },
    @Request() req: RequestWithTenant,
  ) {
    const user = req.user as any;
    return this.nurseWorklistService.shareHandoff(
      req.tenantDb,
      user,
      patientId,
      body,
      {
        ipAddress: String(req.ip || req.headers['x-forwarded-for'] || ''),
        userAgent: req.headers['user-agent'],
        sessionId: (req.headers['x-session-id'] as string) || undefined,
      },
    );
  }
}
