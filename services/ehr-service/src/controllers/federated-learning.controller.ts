import { UseGuards, Controller, Post, Get, Body, Param, Query, Req } from '@nestjs/common';
import { FederatedLearningService } from '../services/federated-learning.service';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { RolesGuard } from '../guards/roles.guard';
import { Roles } from '../decorators/roles.decorator';
import { RequestWithTenant } from '../middleware/tenant.middleware';

// Initiating/aggregating FL rounds triggers real compute (sklearn training
// across every active tenant) and writes model artifacts that later feed
// production inference — this had only JwtAuthGuard (any authenticated user,
// any role, could trigger it), found while verifying the FL pipeline live.
@Controller('fl')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin', 'super_admin')
export class FederatedLearningController {
  constructor(private readonly svc: FederatedLearningService) {}

  @Post('round')
  initiateRound(
    @Req() req: RequestWithTenant,
    @Body('modelType') modelType: string,
  ) {
    return this.svc.initiateRound(req.tenantDb!, modelType);
  }

  @Get('rounds')
  getRounds(
    @Req() req: RequestWithTenant,
    @Query('modelType') modelType?: string,
  ) {
    return this.svc.getRounds(req.tenantDb!, modelType);
  }

  @Get('round/:id')
  getRound(
    @Req() req: RequestWithTenant,
    @Param('id') id: string,
  ) {
    return this.svc.getRound(req.tenantDb!, id);
  }

  @Post('round/:id/submit')
  submitLocalMetrics(
    @Req() req: RequestWithTenant,
    @Param('id') roundId: string,
    @Body() metrics: { localModelMetrics: any; sampleCount: number; gradientNorm?: number; privacyEpsilon?: number },
  ) {
    return this.svc.submitLocalMetrics(req.tenantDb!, roundId, metrics);
  }

  @Get('round/:id/logs')
  getParticipationLogs(
    @Req() req: RequestWithTenant,
    @Param('id') roundId: string,
  ) {
    return this.svc.getParticipationLogs(req.tenantDb!, roundId);
  }
}
