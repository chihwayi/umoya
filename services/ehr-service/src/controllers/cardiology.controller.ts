import { Body, Controller, Get, Param, Patch, Post, Query, Request, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { RequestWithTenant } from '../middleware/tenant.middleware';
import { CardiologyService } from '../services/cardiology.service';

@ApiTags('Cardiology')
@Controller('cardiology')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class CardiologyController {
  constructor(private readonly cardiologyService: CardiologyService) {}

  @Get('encounters')
  @ApiOperation({ summary: 'List cardiology encounters' })
  @ApiResponse({ status: 200, description: 'Encounter list' })
  async listEncounters(
    @Request() req: RequestWithTenant,
    @Query('patient_id') patientId?: string,
    @Query('cardiologist_id') cardiologistId?: string,
    @Query('payment_status') paymentStatus?: string,
    @Query('care_status') careStatus?: string,
    @Query('risk_score') riskScore?: string,
    @Query('from') fromDate?: string,
    @Query('to') toDate?: string,
    @Query('search') search?: string,
    @Query('q') q?: string,
  ) {
    const searchTerm = search || q || undefined;
    return this.cardiologyService.listEncounters(req.tenantDb, {
      patientId,
      cardiologistId,
      paymentStatus,
      careStatus,
      riskScore,
      fromDate,
      toDate,
      searchTerm,
    });
  }

  @Post('encounters')
  @ApiOperation({ summary: 'Create cardiology encounter' })
  @ApiResponse({ status: 201, description: 'Encounter created' })
  async createEncounter(@Request() req: RequestWithTenant, @Body() body: any) {
    const userId = (req.user as any)?.id || (req.user as any)?.userId;
    return this.cardiologyService.createEncounter(req.tenantDb, body, userId);
  }

  @Patch('encounters/:id')
  @ApiOperation({ summary: 'Update cardiology encounter' })
  @ApiResponse({ status: 200, description: 'Encounter updated' })
  async updateEncounter(@Request() req: RequestWithTenant, @Param('id') encounterId: string, @Body() body: any) {
    return this.cardiologyService.updateEncounter(req.tenantDb, encounterId, body);
  }

  @Get('dashboard/summary')
  @ApiOperation({ summary: 'Get cardiology dashboard summary' })
  @ApiResponse({ status: 200, description: 'Dashboard summary' })
  async getDashboardSummary(@Request() req: RequestWithTenant) {
    return this.cardiologyService.getDashboardSummary(req.tenantDb);
  }
}
