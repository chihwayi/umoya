import { Controller, Post, Body, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { ClinicalNlpService } from '../services/clinical-nlp.service';

@UseGuards(JwtAuthGuard)
@Controller('cdss/nlp')
export class CdssNlpController {
  constructor(private readonly nlp: ClinicalNlpService) {}

  @Post('extract')
  async extract(
    @Req() req: any,
    @Body() body: {
      text: string;
      patientId?: number;
      encounterId?: number;
      context?: string;
    },
  ) {
    return this.nlp.extractEntities(
      body.text,
      {
        context: body.context ?? 'ehr_realtime',
        patientId: body.patientId,
        encounterId: body.encounterId,
      },
      req.tenantDb,
    );
  }
}
