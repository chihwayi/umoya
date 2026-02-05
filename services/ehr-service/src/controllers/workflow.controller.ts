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
import { ClinicalWorkflowService } from '../services/clinical-workflow.service';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { RequestWithTenant } from '../middleware/tenant.middleware';

@ApiTags('Clinical Workflows')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('workflows')
export class WorkflowController {
  constructor(private readonly workflowService: ClinicalWorkflowService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new workflow' })
  @ApiResponse({ status: 201, description: 'Workflow created successfully' })
  async createWorkflow(@Body() workflowData: any, @Request() req: RequestWithTenant & { user: any }) {
    const userId = req.user?.id || req.user?.userId;
    return this.workflowService.createWorkflow(workflowData, req.tenantDb, userId);
  }

  @Get()
  @ApiOperation({ summary: 'List workflows' })
  @ApiQuery({ name: 'triggerEvent', required: false, type: String })
  @ApiQuery({ name: 'isActive', required: false, type: Boolean })
  @ApiQuery({ name: 'search', required: false, type: String })
  @ApiResponse({ status: 200, description: 'Workflows retrieved successfully' })
  async getWorkflows(
    @Request() req: RequestWithTenant,
    @Query('triggerEvent') triggerEvent?: string,
    @Query('isActive') isActive?: boolean,
    @Query('search') search?: string,
  ) {
    return this.workflowService.getWorkflows(
      {
        triggerEvent,
        isActive: isActive !== undefined ? isActive === true : undefined,
        search,
      },
      req.tenantDb,
    );
  }

  // ==================== SPECIFIC ROUTES (must come before :id routes) ====================

  @Post('execute')
  @ApiOperation({ summary: 'Manually trigger workflow' })
  @ApiResponse({ status: 200, description: 'Workflow execution started' })
  async executeWorkflow(@Body() executionData: any, @Request() req: RequestWithTenant) {
    return this.workflowService.executeWorkflow(
      executionData.triggerEvent,
      {
        entityType: executionData.entityType,
        entityId: executionData.entityId,
        patientId: executionData.patientId,
        data: executionData.data,
      },
      req.tenantDb,
    );
  }

  @Get('executions')
  @ApiOperation({ summary: 'Get workflow execution history' })
  @ApiQuery({ name: 'workflowId', required: false, type: String })
  @ApiQuery({ name: 'patientId', required: false, type: String })
  @ApiQuery({ name: 'status', required: false, type: String })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiResponse({ status: 200, description: 'Executions retrieved successfully' })
  async getWorkflowExecutions(
    @Request() req: RequestWithTenant,
    @Query('workflowId') workflowId?: string,
    @Query('patientId') patientId?: string,
    @Query('status') status?: string,
    @Query('limit') limit?: number,
  ) {
    return this.workflowService.getWorkflowExecutions(
      {
        workflowId,
        patientId,
        status,
        limit: limit ? parseInt(String(limit), 10) : 100,
      },
      req.tenantDb,
    );
  }

  @Get('executions/:id')
  @ApiOperation({ summary: 'Get workflow execution details' })
  @ApiParam({ name: 'id', description: 'Execution ID' })
  @ApiResponse({ status: 200, description: 'Execution details retrieved successfully' })
  async getWorkflowExecution(@Param('id') id: string, @Request() req: RequestWithTenant) {
    const executions = await this.workflowService.getWorkflowExecutions({}, req.tenantDb);
    return executions.find((e: any) => e.id === id) || null;
  }

  @Get('executions/:id/steps')
  @ApiOperation({ summary: 'Get step execution details' })
  @ApiParam({ name: 'id', description: 'Execution ID' })
  @ApiResponse({ status: 200, description: 'Step executions retrieved successfully' })
  async getStepExecutions(@Param('id') id: string, @Request() req: RequestWithTenant) {
    return this.workflowService.getStepExecutions(id, req.tenantDb);
  }

  @Get('templates')
  @ApiOperation({ summary: 'Get workflow templates' })
  @ApiQuery({ name: 'category', required: false, type: String })
  @ApiResponse({ status: 200, description: 'Templates retrieved successfully' })
  async getWorkflowTemplates(@Query('category') category: string, @Request() req: RequestWithTenant) {
    return this.workflowService.getWorkflowTemplates(category || null, req.tenantDb);
  }

  @Post('templates/:id/apply')
  @ApiOperation({ summary: 'Create workflow from template' })
  @ApiParam({ name: 'id', description: 'Template ID' })
  @ApiResponse({ status: 201, description: 'Workflow created from template successfully' })
  async createWorkflowFromTemplate(@Param('id') id: string, @Request() req: RequestWithTenant & { user: any }) {
    const userId = req.user?.id || req.user?.userId;
    return this.workflowService.createWorkflowFromTemplate(id, req.tenantDb, userId);
  }

  @Put('steps/:stepId')
  @ApiOperation({ summary: 'Update workflow step' })
  @ApiParam({ name: 'stepId', description: 'Step ID' })
  @ApiResponse({ status: 200, description: 'Step updated successfully' })
  async updateWorkflowStep(@Param('stepId') stepId: string, @Body() updates: any, @Request() req: RequestWithTenant) {
    return this.workflowService.updateWorkflowStep(stepId, updates, req.tenantDb);
  }

  @Delete('steps/:stepId')
  @ApiOperation({ summary: 'Delete workflow step' })
  @ApiParam({ name: 'stepId', description: 'Step ID' })
  @ApiResponse({ status: 200, description: 'Step deleted successfully' })
  async deleteWorkflowStep(@Param('stepId') stepId: string, @Request() req: RequestWithTenant) {
    return this.workflowService.deleteWorkflowStep(stepId, req.tenantDb);
  }

  // ==================== PARAMETERIZED ROUTES (must come after specific routes) ====================

  @Get(':id')
  @ApiOperation({ summary: 'Get workflow details' })
  @ApiParam({ name: 'id', description: 'Workflow ID' })
  @ApiResponse({ status: 200, description: 'Workflow retrieved successfully' })
  async getWorkflowById(@Param('id') id: string, @Request() req: RequestWithTenant) {
    return this.workflowService.getWorkflowById(id, req.tenantDb);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update workflow' })
  @ApiParam({ name: 'id', description: 'Workflow ID' })
  @ApiResponse({ status: 200, description: 'Workflow updated successfully' })
  async updateWorkflow(@Param('id') id: string, @Body() updates: any, @Request() req: RequestWithTenant) {
    return this.workflowService.updateWorkflow(id, updates, req.tenantDb);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete workflow' })
  @ApiParam({ name: 'id', description: 'Workflow ID' })
  @ApiResponse({ status: 200, description: 'Workflow deleted successfully' })
  async deleteWorkflow(@Param('id') id: string, @Request() req: RequestWithTenant) {
    return this.workflowService.deleteWorkflow(id, req.tenantDb);
  }

  @Post(':id/activate')
  @ApiOperation({ summary: 'Activate workflow' })
  @ApiParam({ name: 'id', description: 'Workflow ID' })
  @ApiResponse({ status: 200, description: 'Workflow activated successfully' })
  async activateWorkflow(@Param('id') id: string, @Request() req: RequestWithTenant) {
    return this.workflowService.updateWorkflow(id, { isActive: true }, req.tenantDb);
  }

  @Post(':id/deactivate')
  @ApiOperation({ summary: 'Deactivate workflow' })
  @ApiParam({ name: 'id', description: 'Workflow ID' })
  @ApiResponse({ status: 200, description: 'Workflow deactivated successfully' })
  async deactivateWorkflow(@Param('id') id: string, @Request() req: RequestWithTenant) {
    return this.workflowService.updateWorkflow(id, { isActive: false }, req.tenantDb);
  }

  @Post(':id/duplicate')
  @ApiOperation({ summary: 'Duplicate workflow' })
  @ApiParam({ name: 'id', description: 'Workflow ID' })
  @ApiResponse({ status: 201, description: 'Workflow duplicated successfully' })
  async duplicateWorkflow(@Param('id') id: string, @Request() req: RequestWithTenant & { user: any }) {
    const workflow = await this.workflowService.getWorkflowById(id, req.tenantDb);
    const userId = req.user?.id || req.user?.userId;
    return this.workflowService.createWorkflow(
      {
        ...workflow,
        name: `${workflow.name} (Copy)`,
        id: undefined,
      },
      req.tenantDb,
      userId,
    );
  }

  // ==================== WORKFLOW STEPS ====================

  @Post(':id/steps')
  @ApiOperation({ summary: 'Add step to workflow' })
  @ApiParam({ name: 'id', description: 'Workflow ID' })
  @ApiResponse({ status: 201, description: 'Step added successfully' })
  async addWorkflowStep(@Param('id') id: string, @Body() stepData: any, @Request() req: RequestWithTenant) {
    return this.workflowService.addWorkflowStep(id, stepData, req.tenantDb);
  }

  // ==================== ANALYTICS ====================

  @Get('analytics/overview')
  @ApiOperation({ summary: 'Get overall workflow analytics' })
  @ApiResponse({ status: 200, description: 'Analytics retrieved successfully' })
  async getWorkflowAnalytics(@Request() req: RequestWithTenant) {
    return this.workflowService.getWorkflowAnalytics(req.tenantDb);
  }

  @Get('analytics/:id')
  @ApiOperation({ summary: 'Get workflow-specific analytics' })
  @ApiParam({ name: 'id', description: 'Workflow ID' })
  @ApiResponse({ status: 200, description: 'Workflow analytics retrieved successfully' })
  async getWorkflowAnalyticsById(@Param('id') id: string, @Request() req: RequestWithTenant) {
    return this.workflowService.getWorkflowAnalyticsById(id, req.tenantDb);
  }

  // ==================== EXECUTION MANAGEMENT ====================

  @Post('executions/:id/cancel')
  @ApiOperation({ summary: 'Cancel a running workflow execution' })
  @ApiParam({ name: 'id', description: 'Execution ID' })
  @ApiResponse({ status: 200, description: 'Execution cancelled successfully' })
  async cancelExecution(@Param('id') id: string, @Body() body: { reason?: string }, @Request() req: RequestWithTenant) {
    return this.workflowService.cancelExecution(id, req.tenantDb, body.reason);
  }

  @Post('step-executions/:id/retry')
  @ApiOperation({ summary: 'Retry a failed workflow step' })
  @ApiParam({ name: 'id', description: 'Step Execution ID' })
  @ApiResponse({ status: 200, description: 'Step retry initiated successfully' })
  async retryFailedStep(@Param('id') id: string, @Request() req: RequestWithTenant) {
    return this.workflowService.retryFailedStep(id, req.tenantDb);
  }
}

