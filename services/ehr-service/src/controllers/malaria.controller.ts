import { Controller, Get, Post, Patch, Body, Param, Query, Headers } from '@nestjs/common';
import { MalariaService } from '../services/malaria.service';

@Controller('malaria')
export class MalariaController {
  constructor(private readonly malariaService: MalariaService) {}

  private tenant(h: Record<string, string>): string {
    return h['x-tenant-subdomain'] || 'default';
  }

  // ── Cases ──────────────────────────────────────────────────────────────────

  @Post()
  registerCase(@Headers() h: Record<string, string>, @Body() dto: any) {
    return this.malariaService.registerCase(this.tenant(h), dto);
  }

  @Get()
  listCases(@Headers() h: Record<string, string>, @Query('patientId') patientId?: string) {
    return this.malariaService.listCases(this.tenant(h), patientId);
  }

  @Get(':id')
  getCase(@Headers() h: Record<string, string>, @Param('id') id: string) {
    return this.malariaService.getCase(this.tenant(h), id);
  }

  @Patch(':id')
  updateCase(@Headers() h: Record<string, string>, @Param('id') id: string, @Body() dto: any) {
    return this.malariaService.updateCase(this.tenant(h), id, dto);
  }

  // ── Tests ──────────────────────────────────────────────────────────────────

  @Post(':id/tests')
  addTest(@Headers() h: Record<string, string>, @Param('id') id: string, @Body() dto: any) {
    return this.malariaService.addTest(this.tenant(h), { ...dto, malariaCaseId: id });
  }

  @Get(':id/tests')
  getTests(@Headers() h: Record<string, string>, @Param('id') id: string) {
    return this.malariaService.getTests(this.tenant(h), id);
  }

  // ── Treatments ─────────────────────────────────────────────────────────────

  @Post(':id/treatments')
  startTreatment(@Headers() h: Record<string, string>, @Param('id') id: string, @Body() dto: any) {
    return this.malariaService.startTreatment(this.tenant(h), { ...dto, malariaCaseId: id });
  }

  @Get(':id/treatments')
  getTreatments(@Headers() h: Record<string, string>, @Param('id') id: string) {
    return this.malariaService.getTreatments(this.tenant(h), id);
  }

  @Patch('treatments/:treatmentId')
  updateTreatment(
    @Headers() h: Record<string, string>,
    @Param('treatmentId') treatmentId: string,
    @Body() dto: any,
  ) {
    return this.malariaService.updateTreatment(this.tenant(h), treatmentId, dto);
  }

  // ── Contact Tracing ────────────────────────────────────────────────────────

  @Post(':id/contacts')
  addContact(@Headers() h: Record<string, string>, @Param('id') id: string, @Body() dto: any) {
    return this.malariaService.addContact(this.tenant(h), { ...dto, malariaCaseId: id });
  }

  @Get(':id/contacts')
  getContacts(@Headers() h: Record<string, string>, @Param('id') id: string) {
    return this.malariaService.getContacts(this.tenant(h), id);
  }

  @Patch('contacts/:contactId')
  updateContact(
    @Headers() h: Record<string, string>,
    @Param('contactId') contactId: string,
    @Body() dto: any,
  ) {
    return this.malariaService.updateContact(this.tenant(h), contactId, dto);
  }

  // ── Surveillance ───────────────────────────────────────────────────────────

  @Post('surveillance')
  upsertSurveillance(@Headers() h: Record<string, string>, @Body() dto: any) {
    return this.malariaService.upsertSurveillanceReport(this.tenant(h), dto);
  }

  @Get('surveillance')
  getSurveillance(@Headers() h: Record<string, string>, @Query('year') year?: string) {
    return this.malariaService.getSurveillanceReports(this.tenant(h), year ? +year : undefined);
  }

  // ── CDSS ───────────────────────────────────────────────────────────────────

  @Post('cdss/treatment')
  recommendTreatment(@Body() body: any) {
    return this.malariaService.recommendTreatment(body);
  }

  @Post('cdss/severity')
  scoreSeverity(@Body() body: any) {
    return this.malariaService.scoreSeverity(body);
  }
}
