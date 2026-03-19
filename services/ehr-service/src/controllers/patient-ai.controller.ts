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
}
