import { UseGuards, Controller, Get, Post, Patch, Body, Param, Req } from '@nestjs/common';
import { AutoCodingService } from '../services/auto-coding.service';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { RequestWithTenant } from '../middleware/tenant.middleware';

@Controller('coding')
@UseGuards(JwtAuthGuard)
export class AutoCodingController {
  constructor(private readonly svc: AutoCodingService) {}

  @Get('pending')
  getPendingReview(@Req() req: RequestWithTenant) {
    return this.svc.getPendingReview(req.tenantDb!);
  }

  @Get('patient/:patientId')
  getSuggestions(@Req() req: RequestWithTenant, @Param('patientId') patientId: string) {
    return this.svc.getSuggestions(req.tenantDb!, patientId);
  }

  @Get('note/:noteId')
  getSuggestionByNote(@Req() req: RequestWithTenant, @Param('noteId') noteId: string) {
    return this.svc.getSuggestionByNote(req.tenantDb!, noteId);
  }

  @Post('extract')
  extractCodes(@Req() req: RequestWithTenant, @Body() dto: {
    noteId: string; patientId: string; noteText: string; encounterId?: string;
  }) {
    return this.svc.extractAndSaveCodes(req.tenantId!, req.tenantDb!, dto.noteId, dto.patientId, dto.noteText, dto.encounterId);
  }

  @Patch(':id/review')
  reviewSuggestion(@Req() req: RequestWithTenant, @Param('id') id: string, @Body() dto: any) {
    return this.svc.reviewSuggestion(req.tenantDb!, id, dto);
  }
}
