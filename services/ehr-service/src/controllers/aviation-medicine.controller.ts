import { Controller, Get, Post, Patch, Body, Param, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { AviationMedicineService } from '../services/aviation-medicine.service';

@UseGuards(JwtAuthGuard)
@Controller('aviation')
export class AviationMedicineController {
  constructor(private readonly svc: AviationMedicineService) {}

  @Post('applicants')
  registerApplicant(@Req() req: any, @Body() body: any) {
    return this.svc.registerApplicant(req.tenantDb, body);
  }

  @Get('applicants')
  getApplicants(@Req() req: any) {
    return this.svc.getApplicants(req.tenantDb);
  }

  @Post('examinations')
  createExamination(@Req() req: any, @Body() body: any) {
    return this.svc.createExamination(req.tenantDb, req.user.id, body);
  }

  @Patch('examinations/:id/decision')
  recordDecision(
    @Req() req: any,
    @Param('id') id: string,
    @Body() body: { decision: string; limitations?: string[]; nextExamMonths?: number; notes?: string },
  ) {
    return this.svc.recordDecision(req.tenantDb, id, body);
  }

  @Post('certificates')
  issueCertificate(
    @Req() req: any,
    @Body() body: { examinationId: string; applicantId: string; certClass: string; validityMonths: number; limitationsText?: string },
  ) {
    return this.svc.issueCertificate(req.tenantDb, req.user.id, body);
  }

  @Get('certificates/expiring-soon')
  getExpiringSoon(@Req() req: any) {
    return this.svc.getExpiringSoon(req.tenantDb);
  }

  @Get('certificates/:applicantId')
  getCertificates(@Req() req: any, @Param('applicantId') applicantId: string) {
    return this.svc.getCertificates(req.tenantDb, applicantId);
  }

  @Post('waivers')
  recordWaiver(@Req() req: any, @Body() body: any) {
    return this.svc.recordWaiver(req.tenantDb, body);
  }
}
