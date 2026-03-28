import { Controller, Post, Get, Body, Param, Query } from '@nestjs/common';
import { FederatedLearningService } from '../services/federated-learning.service';

@Controller('fl')
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
