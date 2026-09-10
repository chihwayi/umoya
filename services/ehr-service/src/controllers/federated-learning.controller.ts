import { UseGuards, Controller, Post, Get, Body, Param, Query } from '@nestjs/common';
import { FederatedLearningService } from '../services/federated-learning.service';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { RolesGuard } from '../guards/roles.guard';
import { Roles } from '../decorators/roles.decorator';

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
    @Body('subdomain') subdomain: string,
    @Body('modelType') modelType: string,
  ) {
    return this.svc.initiateRound(subdomain, modelType);
  }

  @Get('rounds')
  getRounds(
    @Query('subdomain') subdomain: string,
    @Query('modelType') modelType?: string,
  ) {
    return this.svc.getRounds(subdomain, modelType);
  }

  @Get('round/:id')
  getRound(
    @Param('id') id: string,
    @Query('subdomain') subdomain: string,
  ) {
    return this.svc.getRound(subdomain, id);
  }

  @Post('round/:id/submit')
  submitLocalMetrics(
    @Param('id') roundId: string,
    @Query('subdomain') subdomain: string,
    @Body() metrics: { localModelMetrics: any; sampleCount: number; gradientNorm?: number; privacyEpsilon?: number },
  ) {
    return this.svc.submitLocalMetrics(subdomain, roundId, metrics);
  }

  @Get('round/:id/logs')
  getParticipationLogs(
    @Param('id') roundId: string,
    @Query('subdomain') subdomain: string,
  ) {
    return this.svc.getParticipationLogs(subdomain, roundId);
  }
}
