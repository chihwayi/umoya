import { UseGuards, Controller, Get, Post, Patch, Body, Param, Req } from '@nestjs/common';
import { HouseholdRiskService } from '../services/household-risk.service';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { RolesGuard } from '../guards/roles.guard';
import { Roles } from '../decorators/roles.decorator';

@Controller('household')
@UseGuards(JwtAuthGuard, RolesGuard)
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
  @Roles('doctor', 'nurse', 'admin')
  getFamilyPanel(@Req() req: any, @Param('patientId') id: string) {
    return this.household.getFamilyPanel(req.tenantDb, id, req.user?.role);
  }

  @Get('patients/:patientId/alerts')
  @Roles('doctor', 'nurse', 'admin')
  getAlerts(@Req() req: any, @Param('patientId') id: string) {
    return this.household.getHouseholdAlerts(req.tenantDb, id, req.user?.role);
  }

  @Patch('alerts/:alertId/resolve')
  resolveAlert(@Req() req: any, @Param('alertId') id: string) {
    return this.household.resolveAlert(req.tenantDb, id);
  }

  @Post('propagate')
  @Roles('doctor', 'nurse', 'admin')
  propagate(@Req() req: any, @Body() body: { patientId: string; conditionName: string }) {
    return this.household.propagateDiagnosis(req.tenantDb, body.patientId, body.conditionName, req.user?.role);
  }
}
