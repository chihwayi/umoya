import {
  Controller, Get, Patch, Param, Query, Request, UseGuards, HttpCode,
} from '@nestjs/common';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { InboxTriageService } from '../services/inbox-triage.service';
import { RequestWithTenant } from '../middleware/tenant.middleware';

@Controller('inbox')
@UseGuards(JwtAuthGuard)
export class InboxController {
  constructor(private readonly inboxService: InboxTriageService) {}

  /** GET /inbox?unreadOnly=true&priority=critical&limit=50 */
  @Get()
  async getInbox(
    @Request() req: RequestWithTenant,
    @Query('unreadOnly') unreadOnly?: string,
    @Query('priority') priority?: string,
    @Query('limit') limit?: string,
  ) {
    const userId = (req as any).user?.sub;
    return this.inboxService.getInbox(userId, req.tenantDb, {
      unreadOnly: unreadOnly === 'true',
      priority:   priority || undefined,
      limit:      limit ? Number(limit) : undefined,
    });
  }

  /** GET /inbox/counts — unread counts by priority */
  @Get('counts')
  async getCounts(@Request() req: RequestWithTenant) {
    const userId = (req as any).user?.sub;
    return this.inboxService.getUnreadCounts(userId, req.tenantDb);
  }

  /** PATCH /inbox/:id/read */
  @Patch(':id/read')
  @HttpCode(204)
  async markRead(@Param('id') id: string, @Request() req: RequestWithTenant) {
    const userId = (req as any).user?.sub;
    await this.inboxService.markRead(id, userId, req.tenantDb);
  }

  /** PATCH /inbox/:id/actioned */
  @Patch(':id/actioned')
  @HttpCode(204)
  async markActioned(@Param('id') id: string, @Request() req: RequestWithTenant) {
    const userId = (req as any).user?.sub;
    await this.inboxService.markActioned(id, userId, req.tenantDb);
  }

  /** PATCH /inbox/read-all */
  @Patch('read-all')
  @HttpCode(204)
  async markAllRead(@Request() req: RequestWithTenant) {
    const userId = (req as any).user?.sub;
    await this.inboxService.markAllRead(userId, req.tenantDb);
  }
}
