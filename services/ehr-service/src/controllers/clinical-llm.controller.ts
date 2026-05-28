import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { ClinicalLlmService } from '../services/clinical-llm.service';

@UseGuards(JwtAuthGuard)
@Controller('clinical-llm')
export class ClinicalLlmController {
  constructor(private readonly svc: ClinicalLlmService) {}

  @Get('health')
  health() {
    return {
      backend: this.svc.getBackend(),
      configured: this.svc.isConfigured(),
    };
  }
}
