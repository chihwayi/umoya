import { Controller, Get, Post, Body, Param, Query, UseGuards, Req } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiSecurity } from '@nestjs/swagger';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { RequestWithTenant } from '../middleware/tenant.middleware';
import { PopulationHealthService } from '../services/population-health.service';

@ApiTags('Population Health')
@ApiSecurity('tenant-key')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('population-health')
export class PopulationHealthController {
  constructor(private readonly populationHealthService: PopulationHealthService) {}

  @Post('registry')
  @ApiOperation({ summary: 'Enroll patient in chronic disease registry' })
  @ApiResponse({ status: 201, description: 'Enrolled' })
  async enrollInRegistry(
    @Body()
    body: {
      patientId: string;
      conditionCode: string;
      conditionName: string;
      conditionType: string;
      onsetDate?: string;
      status?: string;
      riskLevel?: string;
      nextReviewDate?: string;
      managementPlan?: string;
      notes?: string;
    },
    @Req() req: RequestWithTenant,
  ) {
    const tenantDb = req.tenantDb;
    return this.populationHealthService.enrollInRegistry(tenantDb, body.patientId, body);
  }

  @Get('registry')
  @ApiOperation({ summary: 'Get registry dashboard (totals by condition, risk, overdue, uncontrolled)' })
  @ApiResponse({ status: 200, description: 'Dashboard data' })
  async getRegistryDashboard(
    @Query('conditionType') conditionType?: string,
    @Query('riskLevel') riskLevel?: string,
    @Query('status') status?: string,
    @Req() req?: RequestWithTenant,
  ) {
    const tenantDb = req!.tenantDb;
    const filters = [conditionType, riskLevel, status].some(Boolean)
      ? { conditionType, riskLevel, status }
      : undefined;
    return this.populationHealthService.getRegistryDashboard(tenantDb, filters);
  }

  @Get('registry/patient/:id')
  @ApiOperation({ summary: 'Get registry entries for a patient' })
  @ApiResponse({ status: 200, description: 'Registry entries' })
  async getRegistryByPatient(@Param('id') id: string, @Req() req: RequestWithTenant) {
    return this.populationHealthService.getRegistryByPatient(req.tenantDb, id);
  }

  @Get('preventive-care/:patientId')
  @ApiOperation({ summary: 'Get preventive care reminders for a patient' })
  @ApiResponse({ status: 200, description: 'Reminders' })
  async getPreventiveCareReminders(
    @Param('patientId') patientId: string,
    @Req() req: RequestWithTenant,
  ) {
    return this.populationHealthService.getPreventiveCareReminders(req.tenantDb, patientId);
  }

  @Post('preventive-care/generate')
  @ApiOperation({ summary: 'Generate preventive care reminders (optional patientId for single patient)' })
  @ApiResponse({ status: 200, description: 'Generated count' })
  async generatePreventiveCare(
    @Body() body: { patientId?: string },
    @Req() req: RequestWithTenant,
  ) {
    return this.populationHealthService.generatePreventiveCareReminders(
      req.tenantDb,
      body?.patientId,
    );
  }

  @Post('recall-lists')
  @ApiOperation({ summary: 'Create a recall list' })
  @ApiResponse({ status: 201, description: 'Recall list created' })
  async createRecallList(
    @Body() body: { name: string; criteria: Record<string, any> },
    @Req() req: RequestWithTenant,
  ) {
    const userId = (req.user as any)?.userId ?? (req.user as any)?.id ?? null;
    return this.populationHealthService.createRecallList(
      req.tenantDb,
      body.name,
      body.criteria ?? {},
      userId,
    );
  }

  @Get('recall-lists')
  @ApiOperation({ summary: 'List recall lists' })
  @ApiResponse({ status: 200, description: 'Recall lists' })
  async getRecallLists(@Req() req: RequestWithTenant) {
    return this.populationHealthService.getRecallLists(req.tenantDb);
  }

  @Post('recall-lists/:id/generate')
  @ApiOperation({ summary: 'Generate/refresh patient list for a recall list' })
  @ApiResponse({ status: 200, description: 'Patient IDs' })
  async generateRecallList(@Param('id') id: string, @Req() req: RequestWithTenant) {
    return this.populationHealthService.generateRecallListPatients(req.tenantDb, id);
  }

  @Post('recall-lists/:id/notify')
  @ApiOperation({ summary: 'Bulk notify recall list (placeholder)' })
  @ApiResponse({ status: 200, description: 'Notify result' })
  async notifyRecallList(
    @Param('id') id: string,
    @Body() body: { channel?: 'sms' | 'email' },
    @Req() req: RequestWithTenant,
  ) {
    return this.populationHealthService.notifyRecallList(
      req.tenantDb,
      id,
      body?.channel ?? 'sms',
    );
  }
}
