import { UseGuards, Controller, Get, Post, Patch, Body, Param, Req } from '@nestjs/common';
import { AiExplainabilityService } from '../services/ai-explainability.service';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { RequestWithTenant } from '../middleware/tenant.middleware';

@Controller('ai/explainability')
@UseGuards(JwtAuthGuard)
export class AiExplainabilityController {
  constructor(private readonly svc: AiExplainabilityService) {}

  @Get('patient/:patientId')
  getAuditHistory(@Req() req: RequestWithTenant, @Param('patientId') patientId: string) {
    return this.svc.getAuditHistory(req.tenantDb!, patientId);
  }

  @Get('overrides')
  getOverrides(@Req() req: RequestWithTenant) {
    return this.svc.getOverrides(req.tenantDb!);
  }

  @Patch(':id/override')
  logOverride(@Req() req: RequestWithTenant, @Param('id') id: string, @Body() dto: { reason: string; overrideBy: string }) {
    return this.svc.logOverride(req.tenantDb!, id, dto.reason, dto.overrideBy);
  }

  @Patch(':id/displayed')
  markDisplayed(@Req() req: RequestWithTenant, @Param('id') id: string) {
    return this.svc.markDisplayed(req.tenantDb!, id);
  }
}
