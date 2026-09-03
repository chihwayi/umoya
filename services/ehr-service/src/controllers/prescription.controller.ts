import { Controller, Get, Post, Put, Patch, Body, Param, Query, UseGuards, Request, Res, Logger } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiSecurity } from '@nestjs/swagger';
import { Response } from 'express';
import { PrescriptionService } from '../services/prescription.service';
import { PrescriptionPdfService } from '../services/prescription-pdf.service';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { RequestWithTenant } from '../middleware/tenant.middleware';
import { ProactiveAiService } from '../services/proactive-ai.service';

@ApiTags('Prescription Management')
@ApiSecurity('tenant-key')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('prescriptions')
export class PrescriptionController {
  private readonly logger = new Logger(PrescriptionController.name);

  constructor(
    private prescriptionService: PrescriptionService,
    private prescriptionPdfService: PrescriptionPdfService,
    private proactiveAiService: ProactiveAiService,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Create prescription' })
  async createPrescription(@Body() createDto: any, @Request() req: RequestWithTenant) {
    const saved = await this.prescriptionService.create(createDto, req.tenantDb, (req.user as any)?.userId ?? (req.user as any)?.id, req.tenantId);

    // ── PROACTIVE TRIGGER — drug interaction + allergy check ──
    if (createDto.patientId) {
      this.proactiveAiService.triggerAnalysis({
        patientId: createDto.patientId,
        tenantId: req.tenantId,
        triggeredByUserId: (req.user as any)?.userId,
        triggerType: 'prescription',
        freshPrescriptions: [{ name: createDto.medicationName, dosage: createDto.dosage }],
      }).catch((e: any) => this.logger.warn(`Prescription proactive analysis trigger failed: ${e?.message}`));
    }

    return saved;
  }

  @Get('patient/:patientId')
  @ApiOperation({ summary: 'Get patient prescriptions' })
  async getPatientPrescriptions(@Param('patientId') patientId: string, @Request() req: RequestWithTenant) {
    return this.prescriptionService.findByPatient(patientId, req.tenantDb);
  }

  @Put(':id/dispense')
  @ApiOperation({ summary: 'Dispense prescription' })
  async dispensePrescription(@Param('id') id: string, @Request() req: RequestWithTenant) {
    return this.prescriptionService.dispense(id, req.tenantDb, (req.user as any)?.userId ?? (req.user as any)?.id);
  }

  @Patch(':id/cancel')
  @ApiOperation({ summary: 'Cancel prescription and release any stock reservation' })
  async cancelPrescription(@Param('id') id: string, @Request() req: RequestWithTenant) {
    await this.prescriptionService.cancelPrescription(id, req.tenantDb);
    return { success: true };
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
        [id, (req.user as any)?.userId ?? (req.user as any)?.id, 'doctor'],
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