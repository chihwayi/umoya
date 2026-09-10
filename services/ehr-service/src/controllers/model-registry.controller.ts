import { UseGuards, Controller, Post, Get, Body, Param, Query } from '@nestjs/common';
import { ModelRegistryService, ShadowEvaluationReviewRequest } from '../services/model-registry.service';
import { FederatedLearningService } from '../services/federated-learning.service';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { RolesGuard } from '../guards/roles.guard';
import { Roles } from '../decorators/roles.decorator';

// Read endpoints (production status/history/cards) stay open to any
// authenticated role — clinical staff reviewing AI model transparency cards
// is legitimate. The mutating endpoints (promote/rollback/review/train) are
// admin-only below — these had no role restriction at all before, found
// while verifying the FL/model-governance pipeline live.
@Controller('model-registry')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ModelRegistryController {
  constructor(
    private readonly registry: ModelRegistryService,
    private readonly fl: FederatedLearningService,
  ) {}

  @Get('production')
  getAllProduction(@Query('subdomain') subdomain: string) {
    return this.registry.getAllProduction(subdomain);
  }

  @Get(':modelName/production')
  getProduction(
    @Param('modelName') modelName: string,
    @Query('subdomain') subdomain: string,
  ) {
    return this.registry.getCurrentProduction(subdomain, modelName);
  }

  @Get(':modelName/history')
  getHistory(
    @Param('modelName') modelName: string,
    @Query('subdomain') subdomain: string,
  ) {
    return this.registry.getHistory(subdomain, modelName);
  }

  @Get('cards')
  getModelCards(@Query('subdomain') subdomain: string) {
    return this.registry.getModelCards(subdomain);
  }

  @Get(':modelName/card')
  getModelCard(
    @Param('modelName') modelName: string,
    @Query('subdomain') subdomain: string,
  ) {
    return this.registry.getModelCard(subdomain, modelName);
  }

  @Get('shadow-evaluations')
  getShadowEvaluations(
    @Query('subdomain') subdomain: string,
    @Query('modelName') modelName?: string,
  ) {
    return this.registry.getShadowEvaluations(subdomain, modelName);
  }

  @Post('shadow-evaluations/:id/review')
  @Roles('admin', 'super_admin')
  reviewShadowEvaluation(
    @Param('id') id: string,
    @Query('subdomain') subdomain: string,
    @Body() review: ShadowEvaluationReviewRequest,
  ) {
    return this.registry.reviewShadowEvaluation(subdomain, id, review);
  }

  @Post(':id/promote')
  @Roles('admin', 'super_admin')
  promote(
    @Param('id') id: string,
    @Query('subdomain') subdomain: string,
    @Body() review: {
      requestedStage?: 'shadow' | 'canary' | 'production';
      requestedBy?: string;
      decisionBy?: string;
      decisionNotes?: string;
      shadowValidationPassed?: boolean;
      rollbackReady?: boolean;
      clinicalApproval?: boolean;
    } = {},
  ) {
    return this.registry.evaluateAndPromote(subdomain, id, review);
  }

  @Post(':modelName/rollback')
  @Roles('admin', 'super_admin')
  rollback(
    @Param('modelName') modelName: string,
    @Query('subdomain') subdomain: string,
  ) {
    return this.registry.rollback(subdomain, modelName);
  }

  @Post('train/:modelName')
  @Roles('admin', 'super_admin')
  triggerTraining(
    @Param('modelName') modelName: string,
    @Body('subdomain') subdomain: string,
  ) {
    return this.fl.initiateRound(subdomain, modelName);
  }
}
