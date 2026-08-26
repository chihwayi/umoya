import { UseGuards, Controller, Get, Post, Patch, Body, Param, Headers } from '@nestjs/common';
import { AiExplainabilityService } from '../services/ai-explainability.service';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';

@Controller('ai/explainability')
@UseGuards(JwtAuthGuard)
export class AiExplainabilityController {
  constructor(private readonly svc: AiExplainabilityService) {}

  private tenant(h: Record<string, string>): string {
    return h['x-tenant-subdomain'] || 'default';
  }

  @Get('patient/:patientId')
  getAuditHistory(@Headers() h: Record<string, string>, @Param('patientId') patientId: string) {
    return this.svc.getAuditHistory(this.tenant(h), patientId);
  }

  @Get('overrides')
  getOverrides(@Headers() h: Record<string, string>) {
    return this.svc.getOverrides(this.tenant(h));
  }

  @Patch(':id/override')
  logOverride(@Headers() h: Record<string, string>, @Param('id') id: string, @Body() dto: { reason: string; overrideBy: string }) {
    return this.svc.logOverride(this.tenant(h), id, dto.reason, dto.overrideBy);
  }

  @Patch(':id/displayed')
  markDisplayed(@Headers() h: Record<string, string>, @Param('id') id: string) {
    return this.svc.markDisplayed(this.tenant(h), id);
  }
}
