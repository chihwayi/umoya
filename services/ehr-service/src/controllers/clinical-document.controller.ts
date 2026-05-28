import { Controller, Get, Post, Patch, Param, Body, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { PatientJwtAuthGuard } from '../guards/patient-jwt-auth.guard';
import { ClinicalDocumentService } from '../services/clinical-document.service';

@Controller('documents')
export class ClinicalDocumentController {
  constructor(private readonly docService: ClinicalDocumentService) {}

  @UseGuards(JwtAuthGuard)
  @Post('generate')
  async generate(
    @Body() body: {
      patientId: string;
      documentType: string;
      encounterId?: string;
      recipient?: string;
      additionalContext?: string;
    },
    @Req() req: any,
  ): Promise<unknown> {
    return this.docService.generateDocument(
      body.patientId,
      body.documentType as any,
      req.user?.sub ?? 'api',
      req.tenantDb,
      {
        encounterId: body.encounterId,
        recipient: body.recipient,
        additionalContext: body.additionalContext,
      },
    );
  }

  @UseGuards(JwtAuthGuard)
  @Get('patients/:patientId')
  async listDocuments(
    @Param('patientId') patientId: string,
    @Req() req: any,
  ): Promise<unknown[]> {
    return this.docService.getDocuments(patientId, req.tenantDb);
  }

  @UseGuards(PatientJwtAuthGuard)
  @Get('patient/my-documents')
  async myDocuments(@Req() req: any): Promise<unknown[]> {
    return req.tenantDb.query(
      `SELECT id, document_type, title, created_at, signed_at
       FROM clinical_documents
       WHERE patient_id = $1 AND status = 'signed'
       ORDER BY signed_at DESC`,
      [req.patientId],
    );
  }

  @UseGuards(PatientJwtAuthGuard)
  @Get('patient/:documentId')
  async getPatientDocument(
    @Param('documentId') documentId: string,
    @Req() req: any,
  ): Promise<unknown> {
    const rows = await req.tenantDb.query(
      `SELECT id, document_type, title, content, signed_at
       FROM clinical_documents
       WHERE id = $1 AND patient_id = $2 AND status = 'signed'`,
      [documentId, req.patientId],
    );
    return rows[0] ?? null;
  }

  @UseGuards(JwtAuthGuard)
  @Get(':documentId')
  async getDocument(
    @Param('documentId') documentId: string,
    @Req() req: any,
  ): Promise<unknown> {
    return this.docService.getDocument(documentId, req.tenantDb);
  }

  @UseGuards(JwtAuthGuard)
  @Patch(':documentId/content')
  async updateContent(
    @Param('documentId') documentId: string,
    @Body() body: { content: string },
    @Req() req: any,
  ): Promise<unknown> {
    return this.docService.updateContent(documentId, body.content, req.tenantDb);
  }

  @UseGuards(JwtAuthGuard)
  @Post(':documentId/sign')
  async sign(
    @Param('documentId') documentId: string,
    @Req() req: any,
  ): Promise<unknown> {
    return this.docService.signDocument(documentId, req.user?.sub ?? 'api', req.tenantDb);
  }
}
