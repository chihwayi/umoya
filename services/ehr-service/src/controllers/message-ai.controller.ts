import { Body, Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { MessageAiService } from '../services/message-ai.service';

@UseGuards(JwtAuthGuard)
@Controller('messages')
export class MessageAiController {
  constructor(private readonly messageAi: MessageAiService) {}

  @Get('inbox')
  async getInbox(@Req() req: any): Promise<unknown[]> {
    return this.messageAi.getEnrichedInbox(req.user.sub, req.tenantDb);
  }

  @Post(':messageId/enrich')
  async enrich(
    @Param('messageId') messageId: string,
    @Body() body: { content: string; patientId: string },
    @Req() req: any,
  ): Promise<unknown> {
    return this.messageAi.enrichMessage(
      messageId,
      body.content,
      body.patientId,
      req.user.preferredLanguage ?? 'en',
      req.tenantDb,
    );
  }

  @Post(':messageId/approve-draft')
  async approveDraft(
    @Param('messageId') messageId: string,
    @Body() body: { editedContent?: string },
    @Req() req: any,
  ): Promise<{ replyContent: string }> {
    return this.messageAi.approveDraft(
      messageId,
      req.user.sub,
      body.editedContent ?? null,
      req.tenantDb,
    );
  }
}
