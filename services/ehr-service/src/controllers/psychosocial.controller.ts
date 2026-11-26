import { Controller, Get, Post, Patch, Param, Body, Req, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { HivDisclosureService } from '../services/hiv-disclosure.service';
import { AlhivTransitionService } from '../services/alhiv-transition.service';
import { GbvService } from '../services/gbv.service';
import { CounsellorSessionsService } from '../services/counsellor-sessions.service';
import { PatientAccessService, Accessor } from '../services/patient-access.service';
import { ConsentRecordsService, CONSENT_TYPES } from '../services/consent-records.service';
import { ForbiddenException } from '@nestjs/common';

@ApiTags('Psychosocial')
@Controller('psychosocial')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class PsychosocialController {
  constructor(
    private readonly disclosureSvc: HivDisclosureService,
    private readonly transitionSvc: AlhivTransitionService,
    private readonly gbvSvc: GbvService,
    private readonly counsellorSvc: CounsellorSessionsService,
    private readonly patientAccess: PatientAccessService,
    private readonly consentRecords: ConsentRecordsService,
  ) {}

  private accessorOf(req: any): Accessor {
    const u = req?.user ?? {};
    return { userId: u.sub || u.id || u.userId, role: u.role, facilityId: u.facilityId ?? null };
  }

  private async assertDisclosureRead(req: any, patientId: string): Promise<void> {
    await this.patientAccess.assertCanAccess(req.tenantDb, this.accessorOf(req), patientId, 'disclosure-read');
  }

  private async assertDisclosureWrite(req: any, patientId: string): Promise<void> {
    const acc = this.accessorOf(req);
    // R2 / FX-012: disclosure writes are counsellor/clinician-only.
    if (!['counsellor', 'doctor', 'nurse', 'admin'].includes(acc.role)) {
      throw new ForbiddenException('Disclosure records are restricted to clinical roles');
    }
    await this.patientAccess.assertCanAccess(req.tenantDb, acc, patientId, 'disclosure-write');
    // R2 / FX-012: MINOR_ASSENT is now wired into the disclosure-write path —
    // the consent type existed in the model with no call site until now.
    const [row] = await req.tenantDb.query(
      `SELECT date_of_birth FROM patients WHERE id = $1`,
      [patientId],
    );
    if (row?.date_of_birth) {
      const dob = new Date(row.date_of_birth);
      let age = new Date().getFullYear() - dob.getFullYear();
      const m = new Date().getMonth() - dob.getMonth();
      if (m < 0 || (m === 0 && new Date().getDate() < dob.getDate())) age--;
      if (age < 18) {
        const ok = await this.consentRecords.hasActiveConsent(patientId, CONSENT_TYPES.MINOR_ASSENT, req.tenantDb);
        if (!ok) {
          throw new ForbiddenException(
            'Adolescent/minor disclosure requires an active minor-assent consent record',
          );
        }
      }
    }
  }

  @Get('patients/:id/disclosure')
  @ApiOperation({ summary: 'Get HIV disclosure history for patient' })
  async getDisclosureHistory(@Param('id') id: string, @Req() req: any) {
    await this.assertDisclosureRead(req, id);
    return this.disclosureSvc.getDisclosureHistory(id, req.tenantDb);
  }

  @Post('patients/:id/disclosure')
  @ApiOperation({ summary: 'Record HIV disclosure assessment' })
  async createDisclosure(@Param('id') id: string, @Body() body: any, @Req() req: any) {
    await this.assertDisclosureWrite(req, id);
    return this.disclosureSvc.createDisclosureRecord({
      ...body,
      patientId: id,
      assessedBy: req.user.sub,
      db: req.tenantDb,
    });
  }

  @Get('patients/:id/transition')
  @ApiOperation({ summary: 'Get ALHIV transition assessment history' })
  async getTransitionHistory(@Param('id') id: string, @Req() req: any) {
    await this.assertDisclosureRead(req, id);
    return req.tenantDb.query(
      `SELECT * FROM alhiv_transition_assessments WHERE patient_id = $1 ORDER BY assessment_date DESC`,
      [id],
    );
  }

  @Post('patients/:id/transition')
  @ApiOperation({ summary: 'Create ALHIV transition readiness assessment' })
  createTransitionAssessment(@Param('id') id: string, @Body() body: any, @Req() req: any) {
    return this.transitionSvc.createTransitionAssessment({
      ...body,
      patientId: id,
      assessedBy: req.user.sub,
      db: req.tenantDb,
    });
  }

  @Patch('transition/:assessmentId/mark-transferred')
  @ApiOperation({ summary: 'Mark ALHIV patient as transferred to adult services' })
  markTransferred(
    @Param('assessmentId') id: string,
    @Body() body: { transferDate: string },
    @Req() req: any,
  ) {
    return this.transitionSvc.markTransferred(id, body.transferDate, req.tenantDb);
  }

  @Get('patients/:id/gbv')
  @ApiOperation({ summary: 'Get GBV assessment history (restricted access)' })
  async getGbvHistory(@Param('id') id: string, @Req() req: any) {
    await this.assertDisclosureRead(req, id);
    return this.gbvSvc.getGbvHistory(id, req.tenantDb);
  }

  @Post('patients/:id/gbv')
  @ApiOperation({ summary: 'Record HITS GBV screening and safety plan' })
  createGbvAssessment(@Param('id') id: string, @Body() body: any, @Req() req: any) {
    return this.gbvSvc.createGbvAssessment({
      ...body,
      patientId: id,
      screenedBy: req.user.sub,
      db: req.tenantDb,
    });
  }

  @Get('patients/:id/sessions')
  @ApiOperation({ summary: 'Get counsellor session records for patient' })
  async getSessions(@Param('id') id: string, @Req() req: any) {
    await this.assertDisclosureRead(req, id);
    const isCounsellor = req.user.role === 'counsellor';
    return this.counsellorSvc.getPatientSessions(
      id,
      isCounsellor ? req.user.sub : null,
      req.tenantDb,
    );
  }

  @Post('patients/:id/sessions')
  @ApiOperation({ summary: 'Record counsellor session' })
  createSession(@Param('id') id: string, @Body() body: any, @Req() req: any) {
    return this.counsellorSvc.createSession({
      ...body,
      patientId: id,
      counsellorId: req.user.sub,
      db: req.tenantDb,
    });
  }
}
