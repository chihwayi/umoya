import { Controller, Get, Patch, Param, Body, Query, Req, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { AiOrderPipelineService } from '../services/ai-order-pipeline.service';

@ApiTags('AI Order Suggestions')
@Controller('ai-order-suggestions')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class AiOrderSuggestionsController {
  constructor(private readonly svc: AiOrderPipelineService) {}

  @Get()
  @ApiOperation({ summary: 'List pending AI order suggestions for a patient' })
  list(@Query('patientId') patientId: string, @Req() req: any) {
    return this.svc.getPendingSuggestions(patientId, req.tenantDb);
  }

  @Patch(':id/approve')
  @ApiOperation({ summary: 'Approve an AI order suggestion — creates real order' })
  approve(@Param('id') id: string, @Req() req: any) {
    const tenantId = req.headers['x-tenant-id'] as string;
    return this.svc.approveSuggestion(id, req.user.sub, tenantId, req.tenantDb);
  }

  @Patch(':id/reject')
  @ApiOperation({ summary: 'Reject an AI order suggestion' })
  reject(
    @Param('id') id: string,
    @Body() body: { rejectionReason: string },
    @Req() req: any,
  ) {
    return this.svc.rejectSuggestion(id, req.user.sub, body.rejectionReason, req.tenantDb);
  }
}
