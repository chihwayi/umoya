import { BadRequestException, Controller, Post, Get, Body, Param, UseGuards, Request } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
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

  // Previously took an arbitrary `phone` straight from the request body with
  // no validation it belonged to anyone in this tenant, no rate limit, and
  // no RBAC — any authenticated staff account (any role) could send SMS to
  // any number, unlimited times: a real cost-abuse (per-message provider
  // billing) and harassment vector. Now requires a patientId and resolves
  // the destination number server-side from that patient's own record.
  @Throttle({ default: { ttl: 60000, limit: 15 } })
  @Post('sms')
  @ApiOperation({ summary: 'Send SMS notification to a patient (Econet/Telecel/NetOne)' })
  @ApiResponse({ status: 201, description: 'SMS sent successfully' })
  async sendSms(
    @Body() body: { patientId: string; message: string; network?: string },
    @Request() req: RequestWithTenant,
  ) {
    if (!body?.patientId) {
      throw new BadRequestException('patientId is required');
    }
    if (!body?.message?.trim()) {
      throw new BadRequestException('message is required');
    }
    return this.notificationsService.sendSmsToPatient(body.patientId, body.message, req.tenantDb, body.network);
  }

  @Throttle({ default: { ttl: 60000, limit: 15 } })
  @Post('appointment-reminder')
  @ApiOperation({ summary: 'Send appointment reminder SMS' })
  @ApiResponse({ status: 201, description: 'Reminder sent successfully' })
  async sendAppointmentReminder(@Body() data: { appointmentId: string }, @Request() req: RequestWithTenant) {
    return this.notificationsService.sendAppointmentReminder(data.appointmentId, req.tenantDb);
  }

  @Throttle({ default: { ttl: 60000, limit: 15 } })
  @Post('prescription-ready')
  @ApiOperation({ summary: 'Send prescription ready notification' })
  @ApiResponse({ status: 201, description: 'Notification sent successfully' })
  async sendPrescriptionReady(@Body() data: { prescriptionId: string }, @Request() req: RequestWithTenant) {
    return this.notificationsService.sendPrescriptionReady(data.prescriptionId, req.tenantDb);
  }

  @Throttle({ default: { ttl: 60000, limit: 15 } })
  @Post('lab-results-ready')
  @ApiOperation({ summary: 'Send lab results ready notification' })
  @ApiResponse({ status: 201, description: 'Notification sent successfully' })
  async sendLabResultsReady(@Body() data: { labOrderId: string }, @Request() req: RequestWithTenant) {
    return this.notificationsService.sendLabResultsReady(data.labOrderId, req.tenantDb);
  }

  @Throttle({ default: { ttl: 60000, limit: 15 } })
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