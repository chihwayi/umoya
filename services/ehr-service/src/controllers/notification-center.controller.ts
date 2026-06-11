import { Controller, Get, Post, Patch, Body, Param, Query, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiSecurity } from '@nestjs/swagger';
import { NotificationCenterService } from '../services/notification-center.service';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { RequestWithTenant } from '../middleware/tenant.middleware';

@ApiTags('Notification Center')
@ApiSecurity('tenant-key')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('notification-center')
export class NotificationCenterController {
  constructor(private readonly notificationCenterService: NotificationCenterService) {}

  @Get('triggers')
  @ApiOperation({ summary: 'List automated notification trigger configs' })
  @ApiResponse({ status: 200, description: 'Trigger configs retrieved' })
  async getTriggers(@Request() req: RequestWithTenant) {
    return this.notificationCenterService.getTriggerConfigs(req.tenantDb);
  }

  @Patch('triggers/:key')
  @ApiOperation({ summary: 'Toggle SMS/Email for a notification trigger' })
  @ApiResponse({ status: 200, description: 'Trigger config updated' })
  async updateTrigger(@Param('key') key: string, @Body() body: any, @Request() req: RequestWithTenant) {
    return this.notificationCenterService.updateTriggerConfig(req.tenantDb, key, body);
  }

  @Post('manual-reminder')
  @ApiOperation({ summary: 'Send a one-off manual reminder (SMS or Email)' })
  @ApiResponse({ status: 201, description: 'Reminder dispatched and logged' })
  async sendManualReminder(@Body() body: any, @Request() req: RequestWithTenant) {
    const sentBy = (req.user as any)?.id ?? null;
    return this.notificationCenterService.sendManualReminder(req.tenantDb, sentBy, body);
  }

  @Get('log')
  @ApiOperation({ summary: 'Notification audit log' })
  @ApiResponse({ status: 200, description: 'Notification log retrieved' })
  async getLog(@Query() query: any, @Request() req: RequestWithTenant) {
    return this.notificationCenterService.listLog(req.tenantDb, query);
  }
}
