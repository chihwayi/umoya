import { Controller, Get, Post, Put, Body, Param, Query, UseGuards, Request, Res } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiSecurity } from '@nestjs/swagger';
import { Response } from 'express';
import { PrescriptionService } from '../services/prescription.service';
import { PrescriptionPdfService } from '../services/prescription-pdf.service';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { RequestWithTenant } from '../middleware/tenant.middleware';

@ApiTags('Prescription Management')
@ApiSecurity('tenant-key')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('prescriptions')
export class PrescriptionController {
  constructor(
    private prescriptionService: PrescriptionService,
    private prescriptionPdfService: PrescriptionPdfService,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Create prescription' })
  async createPrescription(@Body() createDto: any, @Request() req: RequestWithTenant) {
    return this.prescriptionService.create(createDto, req.tenantDb, (req.user as any).id, req.tenantId);
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

  @Get(':id/download')
  @ApiOperation({ summary: 'Download prescription as PDF' })
  @ApiResponse({ status: 200, description: 'PDF file' })
  async downloadPrescription(
    @Param('id') id: string,
    @Request() req: RequestWithTenant,
    @Res() res: Response,
  ) {
    try {
      const { buffer, fileName } = await this.prescriptionPdfService.generatePrescriptionPDF(
        req.tenantDb,
        id,
      );

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
      res.setHeader('Content-Length', buffer.length);

      // Log download for audit
      await req.tenantDb.query(
        `INSERT INTO prescription_downloads (prescription_id, downloaded_by, downloaded_at, user_type)
         VALUES ($1, $2, NOW(), $3)`,
        [id, (req.user as any).id, 'doctor'],
      );

      res.send(buffer);
    } catch (error) {
      if (error instanceof Error && error.message.includes('not found')) {
        res.status(404).json({ message: error.message });
      } else {
        res.status(500).json({ message: 'Failed to generate prescription PDF' });
      }
    }
  }
}