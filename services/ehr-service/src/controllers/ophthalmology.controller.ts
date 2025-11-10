import { Body, Controller, Get, Param, Patch, Post, Query, Request, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { OphthalmologyService } from '../services/ophthalmology.service';
import { RequestWithTenant } from '../middleware/tenant.middleware';

@ApiTags('Ophthalmology')
@Controller('ophthalmology')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class OphthalmologyController {
  constructor(private readonly ophthalmologyService: OphthalmologyService) {}

  @Get('encounters')
  @ApiOperation({ summary: 'List ophthalmology encounters' })
  @ApiResponse({ status: 200, description: 'Encounter list' })
  async listEncounters(
    @Request() req: RequestWithTenant,
    @Query('patient_id') patientId?: string,
    @Query('ophthalmologist_id') ophthalmologistId?: string,
    @Query('from') fromDate?: string,
    @Query('to') toDate?: string,
    @Query('encounter_type') encounterType?: string,
  ) {
    return this.ophthalmologyService.listEncounters(req.tenantDb, {
      patientId,
      ophthalmologistId,
      fromDate,
      toDate,
      encounterType,
    });
  }

  @Post('encounters')
  @ApiOperation({ summary: 'Create ophthalmology encounter' })
  @ApiResponse({ status: 201, description: 'Encounter created' })
  async createEncounter(@Request() req: RequestWithTenant, @Body() body: any) {
    const userId = (req.user as any)?.id || (req.user as any)?.userId;
    return this.ophthalmologyService.createEncounter(req.tenantDb, body, userId);
  }

  @Patch('encounters/:id')
  @ApiOperation({ summary: 'Update ophthalmology encounter' })
  @ApiResponse({ status: 200, description: 'Encounter updated' })
  async updateEncounter(@Request() req: RequestWithTenant, @Param('id') encounterId: string, @Body() body: any) {
    return this.ophthalmologyService.updateEncounter(req.tenantDb, encounterId, body);
  }

  @Get('encounters/:id')
  @ApiOperation({ summary: 'Get encounter detail with exam findings' })
  @ApiResponse({ status: 200, description: 'Encounter detail' })
  async getEncounterDetail(@Request() req: RequestWithTenant, @Param('id') encounterId: string) {
    return this.ophthalmologyService.getEncounterDetail(req.tenantDb, encounterId);
  }

  @Post('encounters/:id/visual-acuity')
  @ApiOperation({ summary: 'Record visual acuity entry' })
  @ApiResponse({ status: 201, description: 'Visual acuity recorded' })
  async recordVisualAcuity(
    @Request() req: RequestWithTenant,
    @Param('id') encounterId: string,
    @Body() body: any,
  ) {
    return this.ophthalmologyService.addVisualAcuityEntry(req.tenantDb, encounterId, body);
  }

  @Post('encounters/:id/refraction')
  @ApiOperation({ summary: 'Record refraction entry' })
  @ApiResponse({ status: 201, description: 'Refraction recorded' })
  async recordRefraction(
    @Request() req: RequestWithTenant,
    @Param('id') encounterId: string,
    @Body() body: any,
  ) {
    return this.ophthalmologyService.addRefractionEntry(req.tenantDb, encounterId, body);
  }

  @Post('encounters/:id/slit-lamp')
  @ApiOperation({ summary: 'Record slit-lamp finding' })
  @ApiResponse({ status: 201, description: 'Slit lamp finding recorded' })
  async recordSlitLamp(
    @Request() req: RequestWithTenant,
    @Param('id') encounterId: string,
    @Body() body: any,
  ) {
    return this.ophthalmologyService.addSlitLampFinding(req.tenantDb, encounterId, body);
  }

  @Post('encounters/:id/oct')
  @ApiOperation({ summary: 'Link OCT study to encounter' })
  @ApiResponse({ status: 201, description: 'OCT study linked' })
  async addOctStudy(
    @Request() req: RequestWithTenant,
    @Param('id') encounterId: string,
    @Body() body: any,
  ) {
    return this.ophthalmologyService.addOctStudy(req.tenantDb, encounterId, body);
  }

  @Post('follow-ups')
  @ApiOperation({ summary: 'Schedule ophthalmology follow-up' })
  @ApiResponse({ status: 201, description: 'Follow-up scheduled' })
  async scheduleFollowUp(@Request() req: RequestWithTenant, @Body() body: any) {
    const userId = (req.user as any)?.id || (req.user as any)?.userId;
    return this.ophthalmologyService.scheduleFollowUp(req.tenantDb, body, userId);
  }

  @Patch('follow-ups/:id')
  @ApiOperation({ summary: 'Update ophthalmology follow-up' })
  @ApiResponse({ status: 200, description: 'Follow-up updated' })
  async updateFollowUp(@Request() req: RequestWithTenant, @Param('id') followUpId: string, @Body() body: any) {
    return this.ophthalmologyService.updateFollowUp(req.tenantDb, followUpId, body);
  }

  @Get('patients/:id/follow-ups')
  @ApiOperation({ summary: 'List follow-ups for patient' })
  @ApiResponse({ status: 200, description: 'Patient follow-ups' })
  async listFollowUps(@Request() req: RequestWithTenant, @Param('id') patientId: string) {
    return this.ophthalmologyService.listFollowUps(req.tenantDb, patientId);
  }

  @Post('procedures')
  @ApiOperation({ summary: 'Record ophthalmology procedure' })
  @ApiResponse({ status: 201, description: 'Procedure recorded' })
  async recordProcedure(@Request() req: RequestWithTenant, @Body() body: any) {
    return this.ophthalmologyService.recordProcedure(req.tenantDb, body);
  }

  @Get('patients/:id/procedures')
  @ApiOperation({ summary: 'List ophthalmology procedures for patient' })
  @ApiResponse({ status: 200, description: 'Patient procedures' })
  async listProcedures(@Request() req: RequestWithTenant, @Param('id') patientId: string) {
    return this.ophthalmologyService.listProcedures(req.tenantDb, patientId);
  }

  @Get('dashboard/summary')
  @ApiOperation({ summary: 'Get ophthalmology dashboard summary' })
  @ApiResponse({ status: 200, description: 'Dashboard summary' })
  async getDashboardSummary(@Request() req: RequestWithTenant) {
    return this.ophthalmologyService.getDashboardSummary(req.tenantDb);
  }
}

