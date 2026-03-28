import {
  Controller, Get, Patch, Param, Query, UseGuards, Request,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { StaffNotificationsService } from '../services/staff-notifications.service';
import { RequestWithTenant } from '../middleware/tenant.middleware';

@ApiTags('Staff Notifications')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('staff-notifications')
export class StaffNotificationsController {
  constructor(private readonly svc: StaffNotificationsService) {}

  @Get()
  @ApiOperation({ summary: 'Get notifications for the authenticated staff user' })
  @ApiQuery({ name: 'read', required: false, type: Boolean, description: 'Filter by read status' })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiResponse({ status: 200, description: 'Returns notifications + unreadCount' })
  getMyNotifications(
    @Request() req: RequestWithTenant & { user: { userId: string } },
    @Query('read') read?: string,
    @Query('limit') limit?: string,
  ) {
    const opts: { read?: boolean; limit?: number } = {};
    if (read !== undefined) opts.read = read === 'true';
    if (limit) opts.limit = parseInt(limit, 10);
    return this.svc.getForUser(req.tenantId!, req.user.userId, opts);
  }

  @Get('unread-count')
  @ApiOperation({ summary: 'Get unread notification badge count for authenticated user' })
  @ApiResponse({ status: 200, description: 'Returns { count: number }' })
  async getUnreadCount(@Request() req: RequestWithTenant & { user: { userId: string } }) {
    const count = await this.svc.getUnreadCount(req.tenantId!, req.user.userId);
    return { count };
  }

  @Patch(':id/read')
  @ApiOperation({ summary: 'Mark a specific notification as read' })
  @ApiResponse({ status: 200 })
  markAsRead(
    @Param('id') id: string,
    @Request() req: RequestWithTenant & { user: { userId: string } },
  ) {
    return this.svc.markAsRead(req.tenantId!, id, req.user.userId);
  }

  @Patch('read-all')
  @ApiOperation({ summary: 'Mark all notifications as read for the authenticated user' })
  @ApiResponse({ status: 200 })
  markAllAsRead(@Request() req: RequestWithTenant & { user: { userId: string } }) {
    return this.svc.markAllAsRead(req.tenantId!, req.user.userId);
  }
}
