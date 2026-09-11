import { Controller, Post, Get, Patch, Body, Param, Query, UseGuards, Req } from '@nestjs/common';
import { PatientAiService } from '../services/patient-ai.service';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { RequestWithTenant } from '../middleware/tenant.middleware';

// Used by both staff (mobile clinician view) and patients (self-service symptom
// checker/adherence chat) under the same JWT issuer, so this intentionally accepts
// any authenticated role rather than PatientJwtAuthGuard's patient-only restriction.
@Controller('patient-ai')
@UseGuards(JwtAuthGuard)
export class PatientAiController {
  constructor(private readonly svc: PatientAiService) {}

  // ── Symptom Checker ─────────────────────────────────────────────────────

  @Post('symptoms/check')
  checkSymptoms(@Req() req: RequestWithTenant, @Body() dto: any) {
    return this.svc.checkSymptoms(req.tenantDb!, dto);
  }

  @Get('symptoms/patient/:patientId')
  getSymptomHistory(@Req() req: RequestWithTenant, @Param('patientId') patientId: string) {
    return this.svc.getSymptomHistory(req.tenantDb!, patientId);
  }

  @Patch('symptoms/:id/escalate')
  escalate(
    @Req() req: RequestWithTenant,
    @Param('id') id: string,
    @Body('encounterId') encounterId: string,
  ) {
    return this.svc.escalateToEncounter(req.tenantDb!, id, encounterId);
  }

  // ── Adherence Chatbot ───────────────────────────────────────────────────

  @Post('adherence/chat')
  adherenceChat(@Req() req: RequestWithTenant, @Body() dto: any) {
    return this.svc.adherenceChat(req.tenantDb!, dto);
  }

  @Get('adherence/patient/:patientId')
  getChatHistory(
    @Req() req: RequestWithTenant,
    @Param('patientId') patientId: string,
    @Query('sessionId') sessionId?: string,
  ) {
    return this.svc.getChatHistory(req.tenantDb!, patientId, sessionId);
  }

  @Get('sessions/patient/:patientId')
  getPatientAiSessions(
    @Req() req: RequestWithTenant,
    @Param('patientId') patientId: string,
  ) {
    return this.svc.getPatientAiSessions(req.tenantDb!, patientId);
  }

  @Get('escalations/patient/:patientId')
  getPatientAiEscalations(
    @Req() req: RequestWithTenant,
    @Param('patientId') patientId: string,
  ) {
    return this.svc.getPatientAiEscalations(req.tenantDb!, patientId);
  }

  @Get('followups/patient/:patientId')
  getPatientFollowups(
    @Req() req: RequestWithTenant,
    @Param('patientId') patientId: string,
  ) {
    return this.svc.getPatientFollowupOrchestrations(req.tenantDb!, patientId);
  }

  @Patch('followups/:id')
  updateFollowupOrchestration(
    @Req() req: RequestWithTenant,
    @Param('id') id: string,
    @Body() body: { status?: string; reminderState?: string },
  ) {
    return this.svc.updateFollowupOrchestration(req.tenantDb!, id, body);
  }
}
