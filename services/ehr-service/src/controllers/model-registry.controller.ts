import { Controller, Post, Get, Body, Param, Query } from '@nestjs/common';
import { ModelRegistryService } from '../services/model-registry.service';
import { FederatedLearningService } from '../services/federated-learning.service';

@Controller('model-registry')
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

  @Post(':id/promote')
  promote(
    @Param('id') id: string,
    @Query('subdomain') subdomain: string,
  ) {
    return this.registry.evaluateAndPromote(subdomain, id);
  }

  @Post(':modelName/rollback')
  rollback(
    @Param('modelName') modelName: string,
    @Query('subdomain') subdomain: string,
  ) {
    return this.registry.rollback(subdomain, modelName);
  }

  @Post('train/:modelName')
  triggerTraining(
    @Param('modelName') modelName: string,
    @Body('subdomain') subdomain: string,
  ) {
    return this.fl.initiateRound(subdomain, modelName);
  }
}
