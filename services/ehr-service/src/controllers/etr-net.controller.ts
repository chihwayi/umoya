import { Controller, Get, Param, Post, Request, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { RequestWithTenant } from '../middleware/tenant.middleware';
import { EtrNetService } from '../services/etr-net.service';

@Controller('etr-net')
@UseGuards(JwtAuthGuard)
export class EtrNetController {
  constructor(private readonly etrNetService: EtrNetService) {}

  @Post('notify/:tbCaseId')
  notifyCase(@Param('tbCaseId') tbCaseId: string, @Request() req: RequestWithTenant) {
    return this.etrNetService.notifyCase(req.tenantId, tbCaseId);
  }

  @Get('notifications')
  getNotifications(@Request() req: RequestWithTenant) {
    return this.etrNetService.getNotifications(req.tenantId);
  }
}
