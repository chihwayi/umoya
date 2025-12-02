import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery, ApiParam } from '@nestjs/swagger';
import { CarePlanService } from '../services/care-plan.service';
import { CarePlanTemplateService } from '../services/care-plan-template.service';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { RequestWithTenant } from '../middleware/tenant.middleware';

@ApiTags('Care Plans')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('care-plans')
export class CarePlanController {
  constructor(
    private readonly carePlanService: CarePlanService,
    private readonly templateService: CarePlanTemplateService,
  ) {}

  // ==================== CARE PLAN MANAGEMENT ====================

  @Post()
  @ApiOperation({ summary: 'Create a new care plan' })
  @ApiResponse({ status: 201, description: 'Care plan created successfully' })
  async createCarePlan(@Body() body: any, @Request() req: RequestWithTenant & { user: any }) {
    const userId = req.user?.id || req.user?.userId;
    return this.carePlanService.createCarePlan(body.patientId, body, req.tenantDb, userId);
  }

  @Get()
  @ApiOperation({ summary: 'Get care plans for a patient' })
  @ApiQuery({ name: 'patientId', required: true, type: String })
  @ApiQuery({ name: 'status', required: false, type: String })
  @ApiQuery({ name: 'category', required: false, type: String })
  @ApiQuery({ name: 'primaryProviderId', required: false, type: String })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiResponse({ status: 200, description: 'Care plans retrieved successfully' })
  async getCarePlans(
    @Query('patientId') patientId: string,
    @Query('status') status?: string,
    @Query('category') category?: string,
    @Query('primaryProviderId') primaryProviderId?: string,
    @Query('limit') limit?: number,
    @Request() req: RequestWithTenant,
  ) {
    return this.carePlanService.getCarePlans(
      patientId,
      {
        status,
        category,
        primaryProviderId,
        limit: limit ? parseInt(String(limit), 10) : undefined,
      },
      req.tenantDb,
    );
  }

  // ==================== SPECIFIC ROUTES (before :id routes) ====================

  @Get('templates')
  @ApiOperation({ summary: 'Get care plan templates' })
  @ApiQuery({ name: 'category', required: false, type: String })
  @ApiResponse({ status: 200, description: 'Templates retrieved successfully' })
  async getTemplates(@Query('category') category: string, @Request() req: RequestWithTenant) {
    return this.templateService.getTemplates(category || null, req.tenantDb);
  }

  @Post('templates')
  @ApiOperation({ summary: 'Create a care plan template' })
  @ApiResponse({ status: 201, description: 'Template created successfully' })
  async createTemplate(@Body() templateData: any, @Request() req: RequestWithTenant & { user: any }) {
    const userId = req.user?.id || req.user?.userId;
    return this.templateService.createTemplate(templateData, req.tenantDb, userId);
  }

  @Get('templates/:id')
  @ApiOperation({ summary: 'Get template details' })
  @ApiParam({ name: 'id', description: 'Template ID' })
  @ApiResponse({ status: 200, description: 'Template retrieved successfully' })
  async getTemplateById(@Param('id') id: string, @Request() req: RequestWithTenant) {
    return this.templateService.getTemplateById(id, req.tenantDb);
  }

  @Put('templates/:id')
  @ApiOperation({ summary: 'Update template' })
  @ApiParam({ name: 'id', description: 'Template ID' })
  @ApiResponse({ status: 200, description: 'Template updated successfully' })
  async updateTemplate(@Param('id') id: string, @Body() updates: any, @Request() req: RequestWithTenant) {
    return this.templateService.updateTemplate(id, updates, req.tenantDb);
  }

  @Post('templates/:id/apply')
  @ApiOperation({ summary: 'Apply template to create care plan' })
  @ApiParam({ name: 'id', description: 'Template ID' })
  @ApiResponse({ status: 201, description: 'Care plan created from template successfully' })
  async applyTemplate(
    @Param('id') id: string,
    @Body() body: { patientId: string; customizations?: any },
    @Request() req: RequestWithTenant & { user: any },
  ) {
    const userId = req.user?.id || req.user?.userId;
    return this.templateService.applyTemplate(id, body.patientId, body.customizations || {}, req.tenantDb, userId);
  }

  // ==================== PARAMETERIZED ROUTES ====================

  @Get(':id')
  @ApiOperation({ summary: 'Get care plan details' })
  @ApiParam({ name: 'id', description: 'Care Plan ID' })
  @ApiResponse({ status: 200, description: 'Care plan retrieved successfully' })
  async getCarePlanById(@Param('id') id: string, @Request() req: RequestWithTenant) {
    return this.carePlanService.getCarePlanById(id, req.tenantDb);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update care plan' })
  @ApiParam({ name: 'id', description: 'Care Plan ID' })
  @ApiResponse({ status: 200, description: 'Care plan updated successfully' })
  async updateCarePlan(@Param('id') id: string, @Body() updates: any, @Request() req: RequestWithTenant) {
    return this.carePlanService.updateCarePlan(id, updates, req.tenantDb);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete care plan' })
  @ApiParam({ name: 'id', description: 'Care Plan ID' })
  @ApiResponse({ status: 200, description: 'Care plan deleted successfully' })
  async deleteCarePlan(@Param('id') id: string, @Request() req: RequestWithTenant) {
    return this.carePlanService.deleteCarePlan(id, req.tenantDb);
  }

  @Post(':id/complete')
  @ApiOperation({ summary: 'Complete care plan' })
  @ApiParam({ name: 'id', description: 'Care Plan ID' })
  @ApiResponse({ status: 200, description: 'Care plan completed successfully' })
  async completeCarePlan(@Param('id') id: string, @Request() req: RequestWithTenant) {
    return this.carePlanService.completeCarePlan(id, req.tenantDb);
  }

  @Post(':id/activate')
  @ApiOperation({ summary: 'Activate care plan' })
  @ApiParam({ name: 'id', description: 'Care Plan ID' })
  @ApiResponse({ status: 200, description: 'Care plan activated successfully' })
  async activateCarePlan(@Param('id') id: string, @Request() req: RequestWithTenant) {
    return this.carePlanService.activateCarePlan(id, req.tenantDb);
  }

  @Post(':id/hold')
  @ApiOperation({ summary: 'Put care plan on hold' })
  @ApiParam({ name: 'id', description: 'Care Plan ID' })
  @ApiResponse({ status: 200, description: 'Care plan put on hold successfully' })
  async holdCarePlan(@Param('id') id: string, @Request() req: RequestWithTenant) {
    return this.carePlanService.holdCarePlan(id, req.tenantDb);
  }

  // ==================== GOALS ====================

  @Post(':id/goals')
  @ApiOperation({ summary: 'Add goal to care plan' })
  @ApiParam({ name: 'id', description: 'Care Plan ID' })
  @ApiResponse({ status: 201, description: 'Goal added successfully' })
  async addGoal(@Param('id') id: string, @Body() goalData: any, @Request() req: RequestWithTenant) {
    return this.carePlanService.addGoal(id, goalData, req.tenantDb);
  }

  @Put('goals/:goalId')
  @ApiOperation({ summary: 'Update goal' })
  @ApiParam({ name: 'goalId', description: 'Goal ID' })
  @ApiResponse({ status: 200, description: 'Goal updated successfully' })
  async updateGoal(@Param('goalId') goalId: string, @Body() updates: any, @Request() req: RequestWithTenant) {
    return this.carePlanService.updateGoal(goalId, updates, req.tenantDb);
  }

  @Delete('goals/:goalId')
  @ApiOperation({ summary: 'Delete goal' })
  @ApiParam({ name: 'goalId', description: 'Goal ID' })
  @ApiResponse({ status: 200, description: 'Goal deleted successfully' })
  async deleteGoal(@Param('goalId') goalId: string, @Request() req: RequestWithTenant) {
    return this.carePlanService.deleteGoal(goalId, req.tenantDb);
  }

  @Post('goals/:goalId/achieve')
  @ApiOperation({ summary: 'Mark goal as achieved' })
  @ApiParam({ name: 'goalId', description: 'Goal ID' })
  @ApiResponse({ status: 200, description: 'Goal marked as achieved successfully' })
  async achieveGoal(@Param('goalId') goalId: string, @Request() req: RequestWithTenant) {
    return this.carePlanService.achieveGoal(goalId, req.tenantDb);
  }

  // ==================== INTERVENTIONS ====================

  @Post(':id/interventions')
  @ApiOperation({ summary: 'Add intervention to care plan' })
  @ApiParam({ name: 'id', description: 'Care Plan ID' })
  @ApiResponse({ status: 201, description: 'Intervention added successfully' })
  async addIntervention(@Param('id') id: string, @Body() interventionData: any, @Request() req: RequestWithTenant) {
    return this.carePlanService.addIntervention(id, interventionData, req.tenantDb);
  }

  @Put('interventions/:interventionId')
  @ApiOperation({ summary: 'Update intervention' })
  @ApiParam({ name: 'interventionId', description: 'Intervention ID' })
  @ApiResponse({ status: 200, description: 'Intervention updated successfully' })
  async updateIntervention(
    @Param('interventionId') interventionId: string,
    @Body() updates: any,
    @Request() req: RequestWithTenant,
  ) {
    return this.carePlanService.updateIntervention(interventionId, updates, req.tenantDb);
  }

  @Delete('interventions/:interventionId')
  @ApiOperation({ summary: 'Delete intervention' })
  @ApiParam({ name: 'interventionId', description: 'Intervention ID' })
  @ApiResponse({ status: 200, description: 'Intervention deleted successfully' })
  async deleteIntervention(@Param('interventionId') interventionId: string, @Request() req: RequestWithTenant) {
    return this.carePlanService.deleteIntervention(interventionId, req.tenantDb);
  }

  @Post('interventions/:interventionId/complete')
  @ApiOperation({ summary: 'Complete intervention' })
  @ApiParam({ name: 'interventionId', description: 'Intervention ID' })
  @ApiResponse({ status: 200, description: 'Intervention completed successfully' })
  async completeIntervention(
    @Param('interventionId') interventionId: string,
    @Body() body: { outcomeNotes?: string },
    @Request() req: RequestWithTenant,
  ) {
    return this.carePlanService.completeIntervention(interventionId, body.outcomeNotes || '', req.tenantDb);
  }

  // ==================== PROGRESS ====================

  @Post(':id/progress')
  @ApiOperation({ summary: 'Record progress' })
  @ApiParam({ name: 'id', description: 'Care Plan ID' })
  @ApiResponse({ status: 201, description: 'Progress recorded successfully' })
  async recordProgress(
    @Param('id') id: string,
    @Body() progressData: any,
    @Request() req: RequestWithTenant & { user: any },
  ) {
    const userId = req.user?.id || req.user?.userId;
    return this.carePlanService.recordProgress(id, progressData, req.tenantDb, userId);
  }

  @Get(':id/progress')
  @ApiOperation({ summary: 'Get progress history' })
  @ApiParam({ name: 'id', description: 'Care Plan ID' })
  @ApiResponse({ status: 200, description: 'Progress history retrieved successfully' })
  async getCarePlanProgress(@Param('id') id: string, @Request() req: RequestWithTenant) {
    return this.carePlanService.getCarePlanProgress(id, req.tenantDb);
  }

  // ==================== OUTCOMES ====================

  @Post(':id/outcomes')
  @ApiOperation({ summary: 'Assess outcome' })
  @ApiParam({ name: 'id', description: 'Care Plan ID' })
  @ApiResponse({ status: 201, description: 'Outcome assessed successfully' })
  async assessOutcome(
    @Param('id') id: string,
    @Body() outcomeData: any,
    @Request() req: RequestWithTenant & { user: any },
  ) {
    const userId = req.user?.id || req.user?.userId;
    return this.carePlanService.assessOutcome(id, outcomeData, req.tenantDb, userId);
  }

  @Get(':id/outcomes')
  @ApiOperation({ summary: 'Get outcomes' })
  @ApiParam({ name: 'id', description: 'Care Plan ID' })
  @ApiResponse({ status: 200, description: 'Outcomes retrieved successfully' })
  async getOutcomes(@Param('id') id: string, @Request() req: RequestWithTenant) {
    return this.carePlanService.getOutcomes(id, req.tenantDb);
  }
}

