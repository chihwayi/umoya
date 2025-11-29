import { Controller, Get, Post, Put, Delete, Body, Param, UseGuards, Request, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { PatientHistoryService } from '../services/patient-history.service';
import {
  CreateMedicalHistoryDto,
  CreateFamilyHistoryDto,
  CreateSocialHistoryDto,
  UpdateMedicalHistoryDto,
} from '../dto/patient-history.dto';
import { RequestWithTenant } from '../middleware/tenant.middleware';

@ApiTags('Patient History')
@ApiBearerAuth()
@Controller('patients/:patientId/history')
@UseGuards(JwtAuthGuard)
export class PatientHistoryController {
  constructor(private patientHistoryService: PatientHistoryService) {}

  // Medical History
  @Get('medical')
  @ApiOperation({ summary: 'Get patient medical history' })
  @ApiResponse({ status: 200, description: 'Medical history retrieved successfully' })
  async getMedicalHistory(@Param('patientId') patientId: string, @Request() req: RequestWithTenant) {
    return this.patientHistoryService.getMedicalHistory(patientId, req.tenantDb);
  }

  @Post('medical')
  @ApiOperation({ summary: 'Add medical history entry' })
  @ApiResponse({ status: 201, description: 'Medical history entry created successfully' })
  async createMedicalHistory(
    @Param('patientId') patientId: string,
    @Body() dto: CreateMedicalHistoryDto,
    @Request() req: RequestWithTenant
  ) {
    return this.patientHistoryService.createMedicalHistory(
      { ...dto, patientId },
      req.tenantDb,
      req.user?.userId
    );
  }

  @Put('medical/:id')
  @ApiOperation({ summary: 'Update medical history entry' })
  @ApiResponse({ status: 200, description: 'Medical history entry updated successfully' })
  async updateMedicalHistory(
    @Param('id') id: string,
    @Body() dto: UpdateMedicalHistoryDto,
    @Request() req: RequestWithTenant
  ) {
    return this.patientHistoryService.updateMedicalHistory(id, dto, req.tenantDb);
  }

  @Delete('medical/:id')
  @ApiOperation({ summary: 'Delete medical history entry' })
  @ApiResponse({ status: 200, description: 'Medical history entry deleted successfully' })
  async deleteMedicalHistory(@Param('id') id: string, @Request() req: RequestWithTenant) {
    await this.patientHistoryService.deleteMedicalHistory(id, req.tenantDb);
    return { message: 'Medical history entry deleted successfully' };
  }

  // Family History
  @Get('family')
  @ApiOperation({ summary: 'Get patient family history' })
  @ApiResponse({ status: 200, description: 'Family history retrieved successfully' })
  async getFamilyHistory(@Param('patientId') patientId: string, @Request() req: RequestWithTenant) {
    return this.patientHistoryService.getFamilyHistory(patientId, req.tenantDb);
  }

  @Post('family')
  @ApiOperation({ summary: 'Add family history entry' })
  @ApiResponse({ status: 201, description: 'Family history entry created successfully' })
  async createFamilyHistory(
    @Param('patientId') patientId: string,
    @Body() dto: CreateFamilyHistoryDto,
    @Request() req: RequestWithTenant
  ) {
    return this.patientHistoryService.createFamilyHistory(
      { ...dto, patientId },
      req.tenantDb,
      req.user?.userId
    );
  }

  @Put('family/:id')
  @ApiOperation({ summary: 'Update family history entry' })
  @ApiResponse({ status: 200, description: 'Family history entry updated successfully' })
  async updateFamilyHistory(
    @Param('id') id: string,
    @Body() dto: Partial<CreateFamilyHistoryDto>,
    @Request() req: RequestWithTenant
  ) {
    return this.patientHistoryService.updateFamilyHistory(id, dto, req.tenantDb);
  }

  @Delete('family/:id')
  @ApiOperation({ summary: 'Delete family history entry' })
  @ApiResponse({ status: 200, description: 'Family history entry deleted successfully' })
  async deleteFamilyHistory(@Param('id') id: string, @Request() req: RequestWithTenant) {
    await this.patientHistoryService.deleteFamilyHistory(id, req.tenantDb);
    return { message: 'Family history entry deleted successfully' };
  }

  // Social History
  @Get('social')
  @ApiOperation({ summary: 'Get patient social history' })
  @ApiResponse({ status: 200, description: 'Social history retrieved successfully' })
  async getSocialHistory(@Param('patientId') patientId: string, @Request() req: RequestWithTenant) {
    return this.patientHistoryService.getSocialHistory(patientId, req.tenantDb);
  }

  @Post('social')
  @ApiOperation({ summary: 'Add social history entry' })
  @ApiResponse({ status: 201, description: 'Social history entry created successfully' })
  async createSocialHistory(
    @Param('patientId') patientId: string,
    @Body() dto: CreateSocialHistoryDto,
    @Request() req: RequestWithTenant
  ) {
    return this.patientHistoryService.createSocialHistory(
      { ...dto, patientId },
      req.tenantDb,
      req.user?.userId
    );
  }

  @Put('social/:id')
  @ApiOperation({ summary: 'Update social history entry' })
  @ApiResponse({ status: 200, description: 'Social history entry updated successfully' })
  async updateSocialHistory(
    @Param('id') id: string,
    @Body() dto: Partial<CreateSocialHistoryDto>,
    @Request() req: RequestWithTenant
  ) {
    return this.patientHistoryService.updateSocialHistory(id, dto, req.tenantDb);
  }

  @Delete('social/:id')
  @ApiOperation({ summary: 'Delete social history entry' })
  @ApiResponse({ status: 200, description: 'Social history entry deleted successfully' })
  async deleteSocialHistory(@Param('id') id: string, @Request() req: RequestWithTenant) {
    await this.patientHistoryService.deleteSocialHistory(id, req.tenantDb);
    return { message: 'Social history entry deleted successfully' };
  }

  // Combined Timeline
  @Get('timeline')
  @ApiOperation({ summary: 'Get complete patient history timeline' })
  @ApiResponse({ status: 200, description: 'History timeline retrieved successfully' })
  async getHistoryTimeline(@Param('patientId') patientId: string, @Request() req: RequestWithTenant) {
    return this.patientHistoryService.getPatientHistoryTimeline(patientId, req.tenantDb);
  }
}

