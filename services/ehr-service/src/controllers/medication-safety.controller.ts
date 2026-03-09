import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { RequestWithTenant } from '../middleware/tenant.middleware';
import { TenantService } from '../services/tenant.service';
import { MedicationSafetyService } from '../services/medication-safety.service';

@ApiTags('Medication Safety')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('medication-safety')
export class MedicationSafetyController {
  constructor(
    private readonly tenantService: TenantService,
    private readonly medicationSafetyService: MedicationSafetyService,
  ) {}

  @Post('assess')
  @ApiOperation({ summary: 'Assess pregnancy, renal, and hepatic safety for a medication list' })
  async assess(@Body() body: any, @Req() req: RequestWithTenant) {
    const tenantDb = await this.tenantService.getTenantDatabase(req.tenantId);
    const patientId = String(body?.patientId || '').trim();
    if (!patientId) {
      throw new Error('patientId is required');
    }
    const medications = Array.isArray(body?.medications) ? body.medications : [];
    return await this.medicationSafetyService.assessMedicationSafety(tenantDb, patientId, medications);
  }
}

