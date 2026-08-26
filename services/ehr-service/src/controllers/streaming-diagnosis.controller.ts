import { UseGuards, Controller, Post, Body, Headers, Res, Get, Query, Request } from '@nestjs/common';
import { Response } from 'express';
import { StreamingDiagnosisService } from '../services/streaming-diagnosis.service';
import { RequestWithTenant } from '../middleware/tenant.middleware';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';

@Controller('diagnosis')
@UseGuards(JwtAuthGuard)
export class StreamingDiagnosisController {
  constructor(private readonly svc: StreamingDiagnosisService) {}

  /**
   * SSE endpoint — debounce on frontend (800ms), call on each HPI keypress.
   * GET so browser EventSource can connect; also accept POST for programmatic use.
   */
  @Post('suggest/stream')
  async streamDifferential(
    @Body() dto: { text: string; patientId: string; sessionId?: string },
    @Res() res: Response,
    @Request() req: RequestWithTenant,
  ) {
    return this.svc.streamDifferential(dto.text, dto.patientId, dto.sessionId || 'anon', res, req.tenantId);
  }

  @Post('suggest')
  suggestDifferential(@Body() dto: { text: string; patientId: string }, @Request() req: RequestWithTenant) {
    return this.svc.suggestDifferential(dto.text, dto.patientId, req.tenantId);
  }
}
