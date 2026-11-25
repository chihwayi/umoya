import { UseGuards, Controller, Get, Post, Patch, Body, Param, Req } from '@nestjs/common';
import { HouseholdRiskService } from '../services/household-risk.service';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { RolesGuard } from '../guards/roles.guard';
import { Roles } from '../decorators/roles.decorator';
import { PatientAccessService, Accessor } from '../services/patient-access.service';

@Controller('household')
@UseGuards(JwtAuthGuard, RolesGuard)
export class HouseholdRiskController {
  constructor(
    private readonly household: HouseholdRiskService,
    private readonly patientAccess: PatientAccessService,
  ) {}

  @Post()
  createHousehold(@Req() req: any, @Body() body: { line1?: string; line2?: string; suburb?: string; city?: string }) {
    return this.household.createHousehold(req.tenantDb, body);
  }

  @Post('link')
  linkPatients(
    @Req() req: any,
    @Body() body: { patientAId: string; patientBId: string; relationship: string; doNotNotify?: boolean },
  ) {
    // R2 / FX-012: safeguarding flag — "unsafe/do not notify" household links.
    return this.household.linkPatients(
      req.tenantDb, body.patientAId, body.patientBId, body.relationship, body.doNotNotify === true,
    );
  }

  @Post('assign')
  assignHousehold(@Req() req: any, @Body() body: { patientId: string; householdId: string }) {
    return this.household.assignHousehold(req.tenantDb, body.patientId, body.householdId);
  }

  // R2 / FX-012: @Roles now mirrors the service's clinical set (incl.
  // counsellor) as early-reject defense in depth; the service enforces
  // role + relationship + consent + age. Handlers pass an Accessor (never
  // a bare role string) so the full model runs.
  private accessorOf(req: any): Accessor {
    const u = req?.user ?? {};
    return { userId: u.sub || u.id || u.userId, role: u.role, facilityId: u.facilityId ?? null };
  }

  @Get('patients/:patientId/family')
  @Roles('doctor', 'nurse', 'admin', 'counsellor')
  getFamilyPanel(@Req() req: any, @Param('patientId') id: string) {
    return this.household.getFamilyPanel(req.tenantDb, id, this.accessorOf(req));
  }

  @Get('patients/:patientId/alerts')
  @Roles('doctor', 'nurse', 'admin', 'counsellor')
  getAlerts(@Req() req: any, @Param('patientId') id: string) {
    return this.household.getHouseholdAlerts(req.tenantDb, id, this.accessorOf(req));
  }

  @Patch('alerts/:alertId/resolve')
  resolveAlert(@Req() req: any, @Param('alertId') id: string) {
    return this.household.resolveAlert(req.tenantDb, id, this.accessorOf(req));
  }

  @Post('propagate')
  @Roles('doctor', 'nurse', 'admin', 'counsellor')
  propagate(@Req() req: any, @Body() body: { patientId: string; conditionName: string }) {
    return this.household.propagateDiagnosis(req.tenantDb, body.patientId, body.conditionName, this.accessorOf(req));
  }

  @Post('disclosures/consent')
  @Roles('doctor', 'nurse', 'admin', 'counsellor')
  async grantDisclosureConsent(
    @Req() req: any,
    @Body() body: {
      sourcePatientId: string; targetHouseholdId?: string; targetPatientId?: string;
      conditionCategory: string; expiresAt?: string;
    },
  ) {
    const acc = this.accessorOf(req);
    // Granting consent for someone else's disclosure needs a relationship
    // to the source patient — the consent record itself is the permission.
    await this.patientAccess.assertCanAccess(req.tenantDb, acc, body.sourcePatientId, 'disclosure-write');
    return this.household.requestDisclosureConsent(req.tenantDb, {
      sourcePatientId: body.sourcePatientId,
      targetHouseholdId: body.targetHouseholdId,
      targetPatientId: body.targetPatientId,
      conditionCategory: body.conditionCategory,
      collectedBy: acc.userId,
      expiresAt: body.expiresAt,
    });
  }

  @Post('disclosures/consent/:consentId/revoke')
  @Roles('doctor', 'nurse', 'admin', 'counsellor')
  revokeDisclosureConsent(
    @Req() req: any,
    @Param('consentId') consentId: string,
    @Body() body: { reason: string },
  ) {
    if (!body?.reason?.trim()) {
      throw new Error('Revocation requires a reason');
    }
    return this.household.revokeDisclosureConsent(req.tenantDb, consentId, body.reason);
  }
}
