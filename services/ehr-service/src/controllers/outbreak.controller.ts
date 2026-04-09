import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  ParseIntPipe,
  DefaultValuePipe,
} from '@nestjs/common';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { OutbreakService } from '../services/outbreak.service';
import { RequestWithTenant } from '../middleware/tenant.middleware';

@UseGuards(JwtAuthGuard)
@Controller('outbreak')
export class OutbreakController {
  constructor(private readonly outbreakService: OutbreakService) {}

  // ── Notifiable diseases ───────────────────────────────────────────────────

  @Get('notifiable-diseases')
  async getNotifiableDiseases(
    @Query('countryCode') countryCode: string,
    @Request() req: RequestWithTenant,
  ) {
    return this.outbreakService.getNotifiableDiseases(req.tenantId, countryCode);
  }

  @Post('notifiable-diseases')
  async upsertNotifiableDisease(@Body() body: any, @Request() req: RequestWithTenant) {
    return this.outbreakService.upsertNotifiableDisease(req.tenantId, body);
  }

  // ── Cases ─────────────────────────────────────────────────────────────────

  @Post('cases')
  async registerCase(@Body() body: any, @Request() req: RequestWithTenant) {
    const userId = (req.user as any)?.userId ?? (req.user as any)?.id;
    return this.outbreakService.registerCase(req.tenantId, userId, body);
  }

  @Get('cases')
  async getCases(
    @Query('diseaseId') diseaseId: string,
    @Query('status') status: string,
    @Query('from') from: string,
    @Query('to') to: string,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(50), ParseIntPipe) limit: number,
    @Request() req: RequestWithTenant,
  ) {
    return this.outbreakService.getCases(req.tenantId, { diseaseId, status, from, to, page, limit });
  }

  @Patch('cases/:id')
  async updateCase(@Param('id') id: string, @Body() body: any, @Request() req: RequestWithTenant) {
    return this.outbreakService.updateCase(req.tenantId, id, body);
  }

  // ── Contact tracing ───────────────────────────────────────────────────────

  @Post('cases/:id/contacts')
  async addContact(@Param('id') id: string, @Body() body: any, @Request() req: RequestWithTenant) {
    return this.outbreakService.addContact(req.tenantId, id, body);
  }

  @Get('cases/:id/contacts')
  async getContacts(@Param('id') id: string, @Request() req: RequestWithTenant) {
    return this.outbreakService.getContacts(req.tenantId, id);
  }

  @Patch('contacts/:id/follow-up')
  async updateFollowUp(@Param('id') id: string, @Body() body: any, @Request() req: RequestWithTenant) {
    return this.outbreakService.updateContactFollowUp(req.tenantId, id, body);
  }

  // ── Dashboard ─────────────────────────────────────────────────────────────

  @Get('dashboard')
  async getDashboard(@Query('countryCode') countryCode: string, @Request() req: RequestWithTenant) {
    return this.outbreakService.getDashboard(req.tenantId, countryCode);
  }

  // ── MOH Alerts ────────────────────────────────────────────────────────────

  @Get('alerts')
  async getAlerts(@Request() req: RequestWithTenant) {
    return this.outbreakService.getAlerts(req.tenantId);
  }

  @Post('alerts/:id/acknowledge')
  async acknowledgeAlert(@Param('id') id: string, @Request() req: RequestWithTenant) {
    return this.outbreakService.acknowledgeAlert(req.tenantId, id);
  }
}
