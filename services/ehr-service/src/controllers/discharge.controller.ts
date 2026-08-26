import { Controller, Post, Get, Param, Req, UseGuards } from '@nestjs/common';
import { DischargeDocumentService } from '../services/discharge-document.service';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { PatientJwtAuthGuard } from '../guards/patient-jwt-auth.guard';

@Controller('encounters/:encounterId/discharge')
@UseGuards(JwtAuthGuard)
export class DischargeController {
  constructor(private readonly discharge: DischargeDocumentService) {}

  @Post('finalise')
  async finalise(@Req() req: any, @Param('encounterId') encounterId: string) {
    return this.discharge.finaliseAndSend(
      req.tenantDb,
      encounterId,
      req.user.id,
      req.tenantSubdomain ?? 'app',
    );
  }
}

@Controller('patient/discharge-documents')
@UseGuards(PatientJwtAuthGuard)
export class PatientDischargeController {
  constructor(private readonly discharge: DischargeDocumentService) {}

  @Get()
  async list(@Req() req: any) {
    return this.discharge.listForPatient(req.tenantDb, req.patientId);
  }

  @Get(':documentId/url')
  async getUrl(@Req() req: any, @Param('documentId') documentId: string) {
    return { url: await this.discharge.getDownloadUrl(req.tenantDb, documentId, req.patientId) };
  }
}
