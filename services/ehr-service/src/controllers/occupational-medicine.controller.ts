import { Controller, Get, Post, Patch, Body, Param, Query, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { OccupationalMedicineService } from '../services/occupational-medicine.service';

@UseGuards(JwtAuthGuard)
@Controller('oem')
export class OccupationalMedicineController {
  constructor(private readonly oem: OccupationalMedicineService) {}

  @Get('employers')
  listEmployers(@Req() req: any, @Query('active') active?: string) {
    return this.oem.listEmployers(req.tenantDb, active !== 'false');
  }

  @Post('employers')
  createEmployer(@Req() req: any, @Body() body: any) {
    return this.oem.createEmployer(req.tenantDb, body);
  }

  @Patch('employers/:id')
  updateEmployer(@Req() req: any, @Param('id') id: string, @Body() body: any) {
    return this.oem.updateEmployer(req.tenantDb, id, body);
  }

  @Get('employers/:id/employees')
  listEmployees(@Req() req: any, @Param('id') id: string) {
    return this.oem.listEmployeesByEmployer(req.tenantDb, id);
  }

  @Post('employee-links')
  linkEmployee(@Req() req: any, @Body() body: { patientId: string; employerId: string; jobTitle?: string; department?: string; hazardClasses?: string[] }) {
    return this.oem.linkEmployee(req.tenantDb, body);
  }

  @Get('patients/:patientId/employers')
  getPatientEmployers(@Req() req: any, @Param('patientId') patientId: string) {
    return this.oem.getPatientEmployers(req.tenantDb, patientId);
  }

  @Post('encounters')
  createEncounter(
    @Req() req: any,
    @Body() body: {
      patientId: string;
      employerId: string;
      encounterType: string;
      jobTitle?: string;
      jobDemands?: string;
      findings?: Record<string, any>;
      bpSystolic?: number;
      bpDiastolic?: number;
      pulse?: number;
      bmi?: number;
      spirometryFev1?: number;
      spirometryFvc?: number;
      substanceScreenResult?: string;
      restrictions?: string;
      notes?: string;
    },
  ) {
    return this.oem.createEncounter(req.tenantDb, req.user.id, body);
  }

  @Get('patients/:patientId/encounters')
  getPatientEncounters(@Req() req: any, @Param('patientId') patientId: string) {
    return this.oem.getPatientEncounters(req.tenantDb, patientId);
  }

  @Get('employers/:employerId/encounters')
  getEmployerEncounters(
    @Req() req: any,
    @Param('employerId') employerId: string,
    @Query('encounterType') encounterType?: string,
  ) {
    return this.oem.getEmployerEncounters(req.tenantDb, employerId, encounterType);
  }

  @Post('certificates')
  issueCertificate(
    @Req() req: any,
    @Body() body: {
      oemEncounterId: string;
      patientId: string;
      employerId: string;
      certType: string;
      fitnessCategory: 'fit' | 'fit_with_restrictions' | 'temporarily_unfit' | 'permanently_unfit';
      restrictionsDetail?: string;
      validUntil?: string;
    },
  ) {
    return this.oem.issueCertificate(req.tenantDb, req.user.id, body);
  }

  @Get('patients/:patientId/certificates')
  getPatientCertificates(@Req() req: any, @Param('patientId') patientId: string) {
    return this.oem.getPatientCertificates(req.tenantDb, patientId);
  }

  @Get('dashboard')
  getDashboard(@Req() req: any) {
    return this.oem.getDashboardSummary(req.tenantDb);
  }
}
