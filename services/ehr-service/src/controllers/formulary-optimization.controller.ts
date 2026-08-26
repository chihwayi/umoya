import { UseGuards, Controller, Get, Post, Patch, Body, Param, Headers } from '@nestjs/common';
import { FormularyOptimizationService } from '../services/formulary-optimization.service';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';

@Controller('formulary')
@UseGuards(JwtAuthGuard)
export class FormularyOptimizationController {
  constructor(private readonly svc: FormularyOptimizationService) {}

  private tenant(h: Record<string, string>): string {
    return h['x-tenant-subdomain'] || 'default';
  }

  @Post('optimize')
  cdssOptimize(@Body() dto: any) {
    return this.svc.cdssOptimize(dto);
  }

  @Post('prescription')
  optimizeOnPrescription(@Headers() h: Record<string, string>, @Body() dto: {
    prescriptionId: string; patientId: string; drugName: string;
  }) {
    return this.svc.optimizeOnPrescription(this.tenant(h), dto.prescriptionId, dto.patientId, dto.drugName);
  }

  @Get('patient/:patientId')
  getSuggestions(@Headers() h: Record<string, string>, @Param('patientId') patientId: string) {
    return this.svc.getSuggestions(this.tenant(h), patientId);
  }

  @Patch('suggestion/:id/respond')
  respond(@Headers() h: Record<string, string>, @Param('id') id: string, @Body() dto: { accepted: boolean }) {
    return this.svc.respondToSuggestion(this.tenant(h), id, dto.accepted);
  }
}
