import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { MedicationHistoryService } from '../services/medication-history.service';
import { RequestWithTenant } from '../middleware/tenant.middleware';
import {
  CreateMedicationDto,
  UpdateMedicationDto,
  RecordAdherenceDto,
  CreateReconciliationDto,
} from '../dto/medication-history.dto';
import { MedicationStatus, MedicationType } from '../entities/patient-medication.entity';

@ApiTags('Medication History')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('patients/:patientId/medications')
export class MedicationHistoryController {
  constructor(private readonly medicationHistoryService: MedicationHistoryService) {}

  @Get()
  @ApiOperation({ summary: 'List medications for a patient' })
  async listMedications(
    @Request() req: RequestWithTenant,
    @Param('patientId') patientId: string,
    @Query('type') type?: MedicationType,
    @Query('status') status?: MedicationStatus,
  ) {
    return this.medicationHistoryService.getMedications(req.tenantDb, patientId, { type, status });
  }

  @Get('current')
  @ApiOperation({ summary: 'Get current active medications' })
  async getCurrentMedications(@Request() req: RequestWithTenant, @Param('patientId') patientId: string) {
    return this.medicationHistoryService.getCurrentMedications(req.tenantDb, patientId);
  }

  @Post()
  @ApiOperation({ summary: 'Add a medication' })
  async createMedication(
    @Request() req: RequestWithTenant,
    @Param('patientId') patientId: string,
    @Body() dto: CreateMedicationDto,
  ) {
    const userId = (req.user as any)?.id || (req.user as any)?.userId;
    return this.medicationHistoryService.createMedication(req.tenantDb, patientId, dto, userId);
  }

  @Put(':medicationId')
  @ApiOperation({ summary: 'Update medication details' })
  async updateMedication(
    @Request() req: RequestWithTenant,
    @Param('patientId') patientId: string,
    @Param('medicationId') medicationId: string,
    @Body() dto: UpdateMedicationDto,
  ) {
    await this.medicationHistoryService.getMedicationById(req.tenantDb, medicationId);
    return this.medicationHistoryService.updateMedication(req.tenantDb, medicationId, dto);
  }

  @Put(':medicationId/discontinue')
  @ApiOperation({ summary: 'Discontinue medication' })
  async discontinueMedication(
    @Request() req: RequestWithTenant,
    @Param('medicationId') medicationId: string,
    @Body('reason') reason: string,
  ) {
    return this.medicationHistoryService.discontinueMedication(req.tenantDb, medicationId, reason);
  }

  @Delete(':medicationId')
  @ApiOperation({ summary: 'Delete medication record' })
  async deleteMedication(
    @Request() req: RequestWithTenant,
    @Param('medicationId') medicationId: string,
  ) {
    await this.medicationHistoryService.deleteMedication(req.tenantDb, medicationId);
    return { success: true };
  }

  @Post(':medicationId/adherence')
  @ApiOperation({ summary: 'Record adherence entry' })
  async recordAdherence(
    @Request() req: RequestWithTenant,
    @Param('patientId') patientId: string,
    @Param('medicationId') medicationId: string,
    @Body() dto: RecordAdherenceDto,
  ) {
    const userId = (req.user as any)?.id || (req.user as any)?.userId;
    return this.medicationHistoryService.recordAdherence(
      req.tenantDb,
      medicationId,
      dto,
      patientId,
      userId,
    );
  }

  @Get(':medicationId/adherence')
  @ApiOperation({ summary: 'Get adherence entries for medication' })
  async listAdherence(
    @Request() req: RequestWithTenant,
    @Param('medicationId') medicationId: string,
    @Query('limit') limit?: number,
  ) {
    return this.medicationHistoryService.getAdherenceRecords(req.tenantDb, medicationId, limit);
  }

  @Post('reconciliation')
  @ApiOperation({ summary: 'Perform medication reconciliation' })
  async reconcileMedications(
    @Request() req: RequestWithTenant,
    @Param('patientId') patientId: string,
    @Body() dto: CreateReconciliationDto,
  ) {
    const userId = (req.user as any)?.id || (req.user as any)?.userId;
    return this.medicationHistoryService.performReconciliation(req.tenantDb, patientId, dto, userId);
  }

  @Get('reconciliation/history')
  @ApiOperation({ summary: 'Get reconciliation history' })
  async reconciliationHistory(@Request() req: RequestWithTenant, @Param('patientId') patientId: string) {
    return this.medicationHistoryService.getReconciliationHistory(req.tenantDb, patientId);
  }

  @Get('timeline')
  @ApiOperation({ summary: 'Medication timeline' })
  async medicationTimeline(@Request() req: RequestWithTenant, @Param('patientId') patientId: string) {
    return this.medicationHistoryService.getMedicationTimeline(req.tenantDb, patientId);
  }
}

