import { UseGuards, Controller, Get, Post, Patch, Body, Param, Req } from '@nestjs/common';
import { FormularyOptimizationService } from '../services/formulary-optimization.service';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { RequestWithTenant } from '../middleware/tenant.middleware';

@Controller('formulary')
@UseGuards(JwtAuthGuard)
export class FormularyOptimizationController {
  constructor(private readonly svc: FormularyOptimizationService) {}

  @Post('optimize')
  cdssOptimize(@Body() dto: any) {
    return this.svc.cdssOptimize(dto);
  }

  @Post('prescription')
  optimizeOnPrescription(@Req() req: RequestWithTenant, @Body() dto: {
    prescriptionId: string; patientId: string; drugName: string;
  }) {
    return this.svc.optimizeOnPrescription(req.tenantId!, req.tenantDb!, dto.prescriptionId, dto.patientId, dto.drugName);
  }

  @Get('patient/:patientId')
  getSuggestions(@Req() req: RequestWithTenant, @Param('patientId') patientId: string) {
    return this.svc.getSuggestions(req.tenantDb!, patientId);
  }

  @Patch('suggestion/:id/respond')
  respond(@Req() req: RequestWithTenant, @Param('id') id: string, @Body() dto: { accepted: boolean }) {
    return this.svc.respondToSuggestion(req.tenantDb!, id, dto.accepted);
  }
}
