import { Body, Controller, Get, Param, Post, Request, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { RequestWithTenant } from '../middleware/tenant.middleware';
import { MalariaEpisodeService } from '../services/malaria-episode.service';

@Controller('malaria')
@UseGuards(JwtAuthGuard)
export class MalariaEpisodeController {
  constructor(private readonly malariaEpisodeService: MalariaEpisodeService) {}

  @Post('episodes')
  recordEpisode(@Body() body: any, @Request() req: RequestWithTenant) {
    return this.malariaEpisodeService.recordEpisode(req.tenantId!, body);
  }

  @Get('episodes/:patientId')
  getPatientEpisodes(@Param('patientId') patientId: string, @Request() req: RequestWithTenant) {
    return this.malariaEpisodeService.getPatientEpisodes(req.tenantId!, patientId);
  }

  @Post('iptp/record')
  recordIptp(@Body() body: any, @Request() req: RequestWithTenant) {
    return this.malariaEpisodeService.recordIptp(req.tenantId!, body);
  }

  @Get('iptp/:patientId')
  getIptpHistory(@Param('patientId') patientId: string, @Request() req: RequestWithTenant) {
    return this.malariaEpisodeService.getIptpHistory(req.tenantId!, patientId);
  }
}
