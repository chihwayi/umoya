import { Controller, Get, Post, Put, Body, Param, Query, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiSecurity } from '@nestjs/swagger';
import { MedicalRecordService } from '../services/medical-record.service';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { RequestWithTenant } from '../middleware/tenant.middleware';

@ApiTags('Medical Records')
@ApiSecurity('tenant-key')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('medical-records')
export class MedicalRecordController {
  constructor(private medicalRecordService: MedicalRecordService) {}

  @Post()
  @ApiOperation({ summary: 'Create medical record' })
  async createRecord(@Body() createDto: any, @Request() req: RequestWithTenant) {
    return this.medicalRecordService.create(createDto, req.tenantDb, (req.user as any).id);
  }

  @Get('patient/:patientId')
  @ApiOperation({ summary: 'Get patient medical records' })
  async getPatientRecords(@Param('patientId') patientId: string, @Request() req: RequestWithTenant) {
    try {
      const records = await this.medicalRecordService.findByPatient(patientId, req.tenantDb);
      return records || [];
    } catch (error) {
      console.error(`Error fetching medical records for patient ${patientId}:`, error);
      // Return empty array instead of throwing 500 error
      return [];
    }
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get medical record by ID' })
  async getRecord(@Param('id') id: string, @Request() req: RequestWithTenant) {
    return this.medicalRecordService.findById(id, req.tenantDb);
  }
}