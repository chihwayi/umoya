import { Controller, Get, Post, Put, Body, Param, Query, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiSecurity } from '@nestjs/swagger';
import { PrescriptionService } from '../services/prescription.service';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { RequestWithTenant } from '../middleware/tenant.middleware';

@ApiTags('Prescription Management')
@ApiSecurity('tenant-key')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('prescriptions')
export class PrescriptionController {
  constructor(private prescriptionService: PrescriptionService) {}

  @Post()
  @ApiOperation({ summary: 'Create prescription' })
  async createPrescription(@Body() createDto: any, @Request() req: RequestWithTenant) {
    return this.prescriptionService.create(createDto, req.tenantDb, (req.user as any).id);
  }

  @Get('patient/:patientId')
  @ApiOperation({ summary: 'Get patient prescriptions' })
  async getPatientPrescriptions(@Param('patientId') patientId: string, @Request() req: RequestWithTenant) {
    return this.prescriptionService.findByPatient(patientId, req.tenantDb);
  }

  @Put(':id/dispense')
  @ApiOperation({ summary: 'Dispense prescription' })
  async dispensePrescription(@Param('id') id: string, @Request() req: RequestWithTenant) {
    return this.prescriptionService.dispense(id, req.tenantDb, (req.user as any).id);
  }
}