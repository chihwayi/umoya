import { UseGuards, Controller, Post, Get, Body, Param, Query, Req } from '@nestjs/common';
import { ModelRegistryService, ShadowEvaluationReviewRequest } from '../services/model-registry.service';
import { FederatedLearningService } from '../services/federated-learning.service';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { RolesGuard } from '../guards/roles.guard';
import { Roles } from '../decorators/roles.decorator';
import { RequestWithTenant } from '../middleware/tenant.middleware';

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
  getAllProduction(@Req() req: RequestWithTenant) {
    return this.registry.getAllProduction(req.tenantDb!);
  }

  @Get(':modelName/production')
  getProduction(
    @Req() req: RequestWithTenant,
    @Param('modelName') modelName: string,
  ) {
    return this.registry.getCurrentProduction(req.tenantDb!, modelName);
  }

  @Get(':modelName/history')
  getHistory(
    @Req() req: RequestWithTenant,
    @Param('modelName') modelName: string,
  ) {
    return this.registry.getHistory(req.tenantDb!, modelName);
  }

  @Get('cards')
  getModelCards(@Req() req: RequestWithTenant) {
    return this.registry.getModelCards(req.tenantDb!);
  }

  @Get(':modelName/card')
  getModelCard(
    @Req() req: RequestWithTenant,
    @Param('modelName') modelName: string,
  ) {
    return this.registry.getModelCard(req.tenantDb!, modelName);
  }

  @Get('shadow-evaluations')
  getShadowEvaluations(
    @Req() req: RequestWithTenant,
    @Query('modelName') modelName?: string,
  ) {
    return this.registry.getShadowEvaluations(req.tenantDb!, modelName);
  }

  @Post('shadow-evaluations/:id/review')
  @Roles('admin', 'super_admin')
  reviewShadowEvaluation(
    @Req() req: RequestWithTenant,
    @Param('id') id: string,
    @Body() review: ShadowEvaluationReviewRequest,
  ) {
    return this.registry.reviewShadowEvaluation(req.tenantDb!, id, review);
  }

  @Post(':id/promote')
  @Roles('admin', 'super_admin')
  promote(
    @Req() req: RequestWithTenant,
    @Param('id') id: string,
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
    return this.registry.evaluateAndPromote(req.tenantDb!, id, review);
  }

  @Post(':modelName/rollback')
  @Roles('admin', 'super_admin')
  rollback(
    @Req() req: RequestWithTenant,
    @Param('modelName') modelName: string,
  ) {
    return this.registry.rollback(req.tenantDb!, modelName);
  }

  @Post('train/:modelName')
  @Roles('admin', 'super_admin')
  triggerTraining(
    @Req() req: RequestWithTenant,
    @Param('modelName') modelName: string,
  ) {
    return this.fl.initiateRound(req.tenantDb!, modelName);
  }
}
