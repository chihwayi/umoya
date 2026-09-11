import { Body, Controller, Param, Post, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { PatientMessagingService } from '../services/patient-messaging.service';
import { RequestWithTenant } from '../middleware/tenant.middleware';

// Staff reply action for the shared provider inbox (SmartInbox, Sprint 65) — used when a
// clinician sends (verbatim or edited) the AI-drafted reply attached to a patient_message
// inbox item. Triage/display itself lives in InboxController (@Controller('inbox')); this only
// handles sending the reply back to the patient via PatientMessagingService.
@UseGuards(JwtAuthGuard)
@Controller('patient-messages')
export class PatientMessageReplyController {
  constructor(private readonly patientMessaging: PatientMessagingService) {}

  @Post(':messageId/reply')
  async reply(
    @Param('messageId') messageId: string,
    @Body() body: { content: string },
    @Req() req: RequestWithTenant & { user: any },
  ) {
    return this.patientMessaging.replyAsStaff(messageId, req.user.sub, body.content, req.tenantId!);
  }
}
