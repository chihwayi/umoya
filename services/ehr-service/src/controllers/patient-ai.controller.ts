import { Controller, Post, Get, Patch, Body, Param, Query } from '@nestjs/common';
import { PatientAiService } from '../services/patient-ai.service';

@Controller('patient-ai')
export class PatientAiController {
  constructor(private readonly svc: PatientAiService) {}

  // ── Symptom Checker ─────────────────────────────────────────────────────

  @Post('symptoms/check')
  checkSymptoms(@Body() dto: any, @Query('subdomain') subdomain: string) {
    return this.svc.checkSymptoms(subdomain, dto);
  }

  @Get('symptoms/patient/:patientId')
  getSymptomHistory(@Param('patientId') patientId: string, @Query('subdomain') subdomain: string) {
    return this.svc.getSymptomHistory(subdomain, patientId);
  }

  @Patch('symptoms/:id/escalate')
  escalate(
    @Param('id') id: string,
    @Query('subdomain') subdomain: string,
    @Body('encounterId') encounterId: string,
  ) {
    return this.svc.escalateToEncounter(subdomain, id, encounterId);
  }

  // ── Adherence Chatbot ───────────────────────────────────────────────────

  @Post('adherence/chat')
  adherenceChat(@Body() dto: any, @Query('subdomain') subdomain: string) {
    return this.svc.adherenceChat(subdomain, dto);
  }

  @Get('adherence/patient/:patientId')
  getChatHistory(
    @Param('patientId') patientId: string,
    @Query('subdomain') subdomain: string,
    @Query('sessionId') sessionId?: string,
  ) {
    return this.svc.getChatHistory(subdomain, patientId, sessionId);
  }

  @Get('sessions/patient/:patientId')
  getPatientAiSessions(
    @Param('patientId') patientId: string,
    @Query('subdomain') subdomain: string,
  ) {
    return this.svc.getPatientAiSessions(subdomain, patientId);
  }

  @Get('escalations/patient/:patientId')
  getPatientAiEscalations(
    @Param('patientId') patientId: string,
    @Query('subdomain') subdomain: string,
  ) {
    return this.svc.getPatientAiEscalations(subdomain, patientId);
  }

  @Get('followups/patient/:patientId')
  getPatientFollowups(
    @Param('patientId') patientId: string,
    @Query('subdomain') subdomain: string,
  ) {
    return this.svc.getPatientFollowupOrchestrations(subdomain, patientId);
  }

  @Patch('followups/:id')
  updateFollowupOrchestration(
    @Param('id') id: string,
    @Query('subdomain') subdomain: string,
    @Body() body: { status?: string; reminderState?: string },
  ) {
    return this.svc.updateFollowupOrchestration(subdomain, id, body);
  }
}
