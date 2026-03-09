import { Controller, Get, Post, Param, Query, Request, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { RolesGuard } from '../guards/roles.guard';
import { Roles } from '../decorators/roles.decorator';
import { MlFeedbackService } from '../services/ml-feedback.service';
import { MlModelsService } from '../services/ml-models.service';
import { MedicalNlpService } from '../services/medical-nlp.service';

@ApiTags('ML Admin')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
@Controller('admin/ml')
export class MlAdminController {
  constructor(
    private readonly mlFeedbackService: MlFeedbackService,
    private readonly mlModelsService: MlModelsService,
    private readonly medicalNlpService: MedicalNlpService,
  ) {}

  @Post('train/:modelName')
  async trainModel(
    @Param('modelName') modelName: string,
    @Request() req: any,
  ) {
    const tenantDb = req.tenantDb;
    if (modelName === 'no_show') {
      return this.mlModelsService.trainNoShowModel(tenantDb);
    }
    if (modelName === 'encounter_coding') {
      return this.mlModelsService.trainCodingModel(tenantDb);
    }
    return { error: 'Unknown model. Use: no_show, encounter_coding' };
  }

  @Post('nlp/reconcile-allergies')
  async reconcileAllergies(@Request() req: any) {
    return this.medicalNlpService.batchReconcileAllPatients(req.tenantDb);
  }

  @Get('performance/:modelName')
  async getPerformance(
    @Param('modelName') modelName: string,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
    @Request() req: any,
  ) {
    const tenantDb = req.tenantDb;
    return this.mlFeedbackService.getModelPerformance(
      tenantDb,
      modelName,
      startDate || new Date(Date.now() - 30 * 86400000).toISOString(),
      endDate || new Date().toISOString(),
    );
  }
}
