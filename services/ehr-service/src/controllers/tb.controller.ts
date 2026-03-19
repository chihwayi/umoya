import {
  Controller, Get, Post, Patch, Param, Body, Query, Request, UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { TbService } from '../services/tb.service';
import { RequestWithTenant } from '../middleware/tenant.middleware';

@Controller('tb')
@UseGuards(JwtAuthGuard)
export class TbController {
  constructor(private readonly tbService: TbService) {}

  // ── Patients ──────────────────────────────────────────────────────────────

  @Get()
  list(
    @Request() req: RequestWithTenant,
    @Query('status') status?: string,
    @Query('caseType') caseType?: string,
    @Query('limit') limit?: string,
  ) {
    return this.tbService.listTbPatients(req.tenantDb, {
      status,
      caseType,
      limit: limit ? Number(limit) : undefined,
    });
  }

  @Post()
  register(@Body() body: Record<string, any>, @Request() req: RequestWithTenant) {
    return this.tbService.registerPatient(body, req.tenantDb);
  }

  @Get('patient/:patientId')
  getByPatient(@Param('patientId') patientId: string, @Request() req: RequestWithTenant) {
    return this.tbService.getTbPatientByPatientId(patientId, req.tenantDb);
  }

  @Get(':id')
  get(@Param('id') id: string, @Request() req: RequestWithTenant) {
    return this.tbService.getTbPatient(id, req.tenantDb);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() body: Record<string, any>, @Request() req: RequestWithTenant) {
    return this.tbService.updateTbPatient(id, body, req.tenantDb);
  }

  // ── Diagnosis ─────────────────────────────────────────────────────────────

  @Get(':id/diagnoses')
  getDiagnoses(@Param('id') id: string, @Request() req: RequestWithTenant) {
    return this.tbService.getDiagnoses(id, req.tenantDb);
  }

  @Post(':id/diagnoses')
  addDiagnosis(@Param('id') id: string, @Body() body: Record<string, any>, @Request() req: RequestWithTenant) {
    return this.tbService.addDiagnosis({ ...body, tbPatientId: id }, req.tenantDb);
  }

  // ── Treatment episodes ────────────────────────────────────────────────────

  @Get(':id/episodes')
  getEpisodes(@Param('id') id: string, @Request() req: RequestWithTenant) {
    return this.tbService.getEpisodes(id, req.tenantDb);
  }

  @Post(':id/episodes')
  startEpisode(@Param('id') id: string, @Body() body: Record<string, any>, @Request() req: RequestWithTenant) {
    return this.tbService.startEpisode({ ...body, tbPatientId: id }, req.tenantDb);
  }

  @Patch(':id/episodes/:episodeId')
  updateEpisode(
    @Param('episodeId') episodeId: string,
    @Body() body: Record<string, any>,
    @Request() req: RequestWithTenant,
  ) {
    return this.tbService.updateEpisode(episodeId, body, req.tenantDb);
  }

  // ── DOT records ───────────────────────────────────────────────────────────

  @Get(':id/dot')
  getDotRecords(
    @Param('id') id: string,
    @Request() req: RequestWithTenant,
    @Query('episodeId') episodeId?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.tbService.getDotRecords(id, req.tenantDb, {
      episodeId,
      from: from ? new Date(from) : undefined,
      to:   to   ? new Date(to)   : undefined,
    });
  }

  @Post(':id/dot')
  recordDot(@Param('id') id: string, @Body() body: Record<string, any>, @Request() req: RequestWithTenant) {
    return this.tbService.recordDot({ ...body, tbPatientId: id }, req.tenantDb);
  }

  // ── Contact investigation ─────────────────────────────────────────────────

  @Get(':id/contacts')
  getContacts(@Param('id') id: string, @Request() req: RequestWithTenant) {
    return this.tbService.getContacts(id, req.tenantDb);
  }

  @Post(':id/contacts')
  addContact(@Param('id') id: string, @Body() body: Record<string, any>, @Request() req: RequestWithTenant) {
    return this.tbService.addContact({ ...body, tbPatientId: id }, req.tenantDb);
  }

  @Patch(':id/contacts/:contactId')
  updateContact(
    @Param('contactId') contactId: string,
    @Body() body: Record<string, any>,
    @Request() req: RequestWithTenant,
  ) {
    return this.tbService.updateContact(contactId, body, req.tenantDb);
  }

  // ── DST ───────────────────────────────────────────────────────────────────

  @Get(':id/dst')
  getDst(@Param('id') id: string, @Request() req: RequestWithTenant) {
    return this.tbService.getDstResults(id, req.tenantDb);
  }

  @Post(':id/dst')
  addDst(@Param('id') id: string, @Body() body: Record<string, any>, @Request() req: RequestWithTenant) {
    return this.tbService.addDst({ ...body, tbPatientId: id }, req.tenantDb);
  }

  // ── Outcome ───────────────────────────────────────────────────────────────

  @Get(':id/outcomes')
  getOutcomes(@Param('id') id: string, @Request() req: RequestWithTenant) {
    return this.tbService.getOutcomes(id, req.tenantDb);
  }

  @Post(':id/outcomes')
  recordOutcome(@Param('id') id: string, @Body() body: Record<string, any>, @Request() req: RequestWithTenant) {
    return this.tbService.recordOutcome({ ...body, tbPatientId: id }, req.tenantDb);
  }

  // ── CDSS ──────────────────────────────────────────────────────────────────

  @Post('cdss/regimen')
  recommendRegimen(@Body() body: Record<string, any>) {
    return this.tbService.recommendRegimen(body);
  }

  @Post('cdss/contact-risk')
  contactRisk(@Body() body: Record<string, any>) {
    return this.tbService.assessContactRisk(body);
  }

  @Post('cdss/adherence')
  adherence(@Body() body: Record<string, any>) {
    return this.tbService.analyseAdherence(body);
  }
}
