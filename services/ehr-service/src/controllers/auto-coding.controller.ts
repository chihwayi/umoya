import { UseGuards, Controller, Get, Post, Patch, Body, Param, Headers } from '@nestjs/common';
import { AutoCodingService } from '../services/auto-coding.service';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';

@Controller('coding')
@UseGuards(JwtAuthGuard)
export class AutoCodingController {
  constructor(private readonly svc: AutoCodingService) {}

  private tenant(h: Record<string, string>): string {
    return h['x-tenant-subdomain'] || 'default';
  }

  @Get('pending')
  getPendingReview(@Headers() h: Record<string, string>) {
    return this.svc.getPendingReview(this.tenant(h));
  }

  @Get('patient/:patientId')
  getSuggestions(@Headers() h: Record<string, string>, @Param('patientId') patientId: string) {
    return this.svc.getSuggestions(this.tenant(h), patientId);
  }

  @Get('note/:noteId')
  getSuggestionByNote(@Headers() h: Record<string, string>, @Param('noteId') noteId: string) {
    return this.svc.getSuggestionByNote(this.tenant(h), noteId);
  }

  @Post('extract')
  extractCodes(@Headers() h: Record<string, string>, @Body() dto: {
    noteId: string; patientId: string; noteText: string; encounterId?: string;
  }) {
    return this.svc.extractAndSaveCodes(this.tenant(h), dto.noteId, dto.patientId, dto.noteText, dto.encounterId);
  }

  @Patch(':id/review')
  reviewSuggestion(@Headers() h: Record<string, string>, @Param('id') id: string, @Body() dto: any) {
    return this.svc.reviewSuggestion(this.tenant(h), id, dto);
  }
}
