import { UseGuards, Controller, Get, Post, Patch, Body, Param, Req } from '@nestjs/common';
import { HouseholdRiskService } from '../services/household-risk.service';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';

@Controller('household')
@UseGuards(JwtAuthGuard)
export class HouseholdRiskController {
  constructor(private readonly household: HouseholdRiskService) {}

  @Post()
  createHousehold(@Req() req: any, @Body() body: { line1?: string; line2?: string; suburb?: string; city?: string }) {
    return this.household.createHousehold(req.tenantDb, body);
  }

  @Post('link')
  linkPatients(
    @Req() req: any,
    @Body() body: { patientAId: string; patientBId: string; relationship: string },
  ) {
    return this.household.linkPatients(req.tenantDb, body.patientAId, body.patientBId, body.relationship);
  }

  @Post('assign')
  assignHousehold(@Req() req: any, @Body() body: { patientId: string; householdId: string }) {
    return this.household.assignHousehold(req.tenantDb, body.patientId, body.householdId);
  }

  @Get('patients/:patientId/family')
  getFamilyPanel(@Req() req: any, @Param('patientId') id: string) {
    return this.household.getFamilyPanel(req.tenantDb, id);
  }

  @Get('patients/:patientId/alerts')
  getAlerts(@Req() req: any, @Param('patientId') id: string) {
    return this.household.getHouseholdAlerts(req.tenantDb, id);
  }

  @Patch('alerts/:alertId/resolve')
  resolveAlert(@Req() req: any, @Param('alertId') id: string) {
    return this.household.resolveAlert(req.tenantDb, id);
  }

  @Post('propagate')
  propagate(@Req() req: any, @Body() body: { patientId: string; conditionName: string }) {
    return this.household.propagateDiagnosis(req.tenantDb, body.patientId, body.conditionName);
  }
}
