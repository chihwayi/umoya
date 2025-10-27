import { Controller, Post, Get, Body, Param, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiSecurity } from '@nestjs/swagger';
import { NotificationsService } from '../services/notifications.service';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { RequestWithTenant } from '../middleware/tenant.middleware';

@ApiTags('Notifications (Zimbabwe Networks)')
@ApiSecurity('tenant-key')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('notifications')
export class NotificationsController {
  constructor(private notificationsService: NotificationsService) {}

  @Post('sms')
  @ApiOperation({ summary: 'Send SMS notification (Econet/Telecel/NetOne)' })
  @ApiResponse({ status: 201, description: 'SMS sent successfully' })
  async sendSms(@Body() smsData: any, @Request() req: RequestWithTenant) {
    return this.notificationsService.sendSms(smsData);
  }

  @Post('appointment-reminder')
  @ApiOperation({ summary: 'Send appointment reminder SMS' })
  @ApiResponse({ status: 201, description: 'Reminder sent successfully' })
  async sendAppointmentReminder(@Body() data: { appointmentId: string }, @Request() req: RequestWithTenant) {
    return this.notificationsService.sendAppointmentReminder(data.appointmentId, req.tenantDb);
  }

  @Post('prescription-ready')
  @ApiOperation({ summary: 'Send prescription ready notification' })
  @ApiResponse({ status: 201, description: 'Notification sent successfully' })
  async sendPrescriptionReady(@Body() data: { prescriptionId: string }, @Request() req: RequestWithTenant) {
    return this.notificationsService.sendPrescriptionReady(data.prescriptionId, req.tenantDb);
  }

  @Post('lab-results-ready')
  @ApiOperation({ summary: 'Send lab results ready notification' })
  @ApiResponse({ status: 201, description: 'Notification sent successfully' })
  async sendLabResultsReady(@Body() data: { labOrderId: string }, @Request() req: RequestWithTenant) {
    return this.notificationsService.sendLabResultsReady(data.labOrderId, req.tenantDb);
  }

  @Post('payment-reminder')
  @ApiOperation({ summary: 'Send payment reminder SMS' })
  @ApiResponse({ status: 201, description: 'Payment reminder sent' })
  async sendPaymentReminder(@Body() data: { billId: string }, @Request() req: RequestWithTenant) {
    return this.notificationsService.sendPaymentReminder(data.billId, req.tenantDb);
  }

  @Get('delivery-status/:messageId')
  @ApiOperation({ summary: 'Check SMS delivery status' })
  @ApiResponse({ status: 200, description: 'Delivery status retrieved' })
  async getDeliveryStatus(@Param('messageId') messageId: string, @Request() req: RequestWithTenant) {
    return this.notificationsService.getDeliveryStatus(messageId);
  }
}