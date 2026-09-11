import { Controller, Get, Post, Patch, Body, Param, Query, Req, UseGuards } from '@nestjs/common';
import { MalariaService } from '../services/malaria.service';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { RequestWithTenant } from '../middleware/tenant.middleware';

@UseGuards(JwtAuthGuard)
@Controller('malaria')
export class MalariaController {
  constructor(private readonly malariaService: MalariaService) {}

  // ── Cases ──────────────────────────────────────────────────────────────────

  @Post()
  registerCase(@Req() req: RequestWithTenant, @Body() dto: any) {
    return this.malariaService.registerCase(req.tenantDb!, dto);
  }

  @Get()
  listCases(@Req() req: RequestWithTenant, @Query('patientId') patientId?: string) {
    return this.malariaService.listCases(req.tenantDb!, patientId);
  }

  @Get(':id')
  getCase(@Req() req: RequestWithTenant, @Param('id') id: string) {
    return this.malariaService.getCase(req.tenantDb!, id);
  }

  @Patch(':id')
  updateCase(@Req() req: RequestWithTenant, @Param('id') id: string, @Body() dto: any) {
    return this.malariaService.updateCase(req.tenantDb!, id, dto);
  }

  // ── Tests ──────────────────────────────────────────────────────────────────

  @Post(':id/tests')
  addTest(@Req() req: RequestWithTenant, @Param('id') id: string, @Body() dto: any) {
    return this.malariaService.addTest(req.tenantDb!, { ...dto, malariaCaseId: id });
  }

  @Get(':id/tests')
  getTests(@Req() req: RequestWithTenant, @Param('id') id: string) {
    return this.malariaService.getTests(req.tenantDb!, id);
  }

  // ── Treatments ─────────────────────────────────────────────────────────────

  @Post(':id/treatments')
  startTreatment(@Req() req: RequestWithTenant, @Param('id') id: string, @Body() dto: any) {
    return this.malariaService.startTreatment(req.tenantDb!, { ...dto, malariaCaseId: id });
  }

  @Get(':id/treatments')
  getTreatments(@Req() req: RequestWithTenant, @Param('id') id: string) {
    return this.malariaService.getTreatments(req.tenantDb!, id);
  }

  @Patch('treatments/:treatmentId')
  updateTreatment(
    @Req() req: RequestWithTenant,
    @Param('treatmentId') treatmentId: string,
    @Body() dto: any,
  ) {
    return this.malariaService.updateTreatment(req.tenantDb!, treatmentId, dto);
  }

  // ── Contact Tracing ────────────────────────────────────────────────────────

  @Post(':id/contacts')
  addContact(@Req() req: RequestWithTenant, @Param('id') id: string, @Body() dto: any) {
    return this.malariaService.addContact(req.tenantDb!, { ...dto, malariaCaseId: id });
  }

  @Get(':id/contacts')
  getContacts(@Req() req: RequestWithTenant, @Param('id') id: string) {
    return this.malariaService.getContacts(req.tenantDb!, id);
  }

  @Patch('contacts/:contactId')
  updateContact(
    @Req() req: RequestWithTenant,
    @Param('contactId') contactId: string,
    @Body() dto: any,
  ) {
    return this.malariaService.updateContact(req.tenantDb!, contactId, dto);
  }

  // ── Surveillance ───────────────────────────────────────────────────────────

  @Post('surveillance')
  upsertSurveillance(@Req() req: RequestWithTenant, @Body() dto: any) {
    return this.malariaService.upsertSurveillanceReport(req.tenantDb!, dto);
  }

  @Get('surveillance')
  getSurveillance(@Req() req: RequestWithTenant, @Query('year') year?: string) {
    return this.malariaService.getSurveillanceReports(req.tenantDb!, year ? +year : undefined);
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
