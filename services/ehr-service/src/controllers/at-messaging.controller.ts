import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { AtMessagingService } from '../services/at-messaging.service';
import { Response } from 'express';

@Controller('at')
export class AtMessagingController {
  constructor(private readonly atService: AtMessagingService) {}

  // ── SMS ───────────────────────────────────────────────────────────────────

  /** POST /at/sms/send */
  @UseGuards(JwtAuthGuard)
  @Post('sms/send')
  async sendSms(@Req() req: any, @Body() body: any) {
    const tenantId: string = req.tenantId;
    const { to, message, patientId, messageType } = body;
    const recipients = Array.isArray(to) ? to : [to];
    return this.atService.sendSms(tenantId, recipients, message, { patientId, messageType });
  }

  /** POST /at/sms/appointment-reminder */
  @UseGuards(JwtAuthGuard)
  @Post('sms/appointment-reminder')
  async appointmentReminder(@Req() req: any, @Body() body: any) {
    const tenantId: string = req.tenantId;
    return this.atService.sendAppointmentReminder(
      tenantId,
      body.phoneNumber,
      body.patientName,
      body.appointmentDate,
      body.facilityName,
      body.patientId,
    );
  }

  /** POST /at/sms/medication-alert */
  @UseGuards(JwtAuthGuard)
  @Post('sms/medication-alert')
  async medicationAlert(@Req() req: any, @Body() body: any) {
    const tenantId: string = req.tenantId;
    return this.atService.sendMedicationAlert(
      tenantId,
      body.phoneNumber,
      body.patientName,
      body.medicationName,
      body.doseTime,
      body.patientId,
    );
  }

  /** POST /at/sms/lab-result */
  @UseGuards(JwtAuthGuard)
  @Post('sms/lab-result')
  async labResultNotification(@Req() req: any, @Body() body: any) {
    const tenantId: string = req.tenantId;
    return this.atService.sendLabResultNotification(
      tenantId,
      body.phoneNumber,
      body.patientName,
      body.testName,
      body.facilityName,
      body.patientId,
    );
  }

  // ── USSD callback (no JWT — called by Africa's Talking) ──────────────────

  /** POST /at/ussd/callback */
  @Post('ussd/callback')
  async ussdCallback(@Body() body: any, @Res() res: Response, @Query('tenantId') tenantId: string) {
    const { sessionId, phoneNumber, serviceCode, text } = body;
    // tenantId passed as query param since AT callback can't set headers
    const resolvedTenantId = tenantId || process.env.DEFAULT_TENANT_ID || '';

    const response = await this.atService.handleUssdCallback(
      resolvedTenantId,
      sessionId,
      phoneNumber,
      serviceCode,
      text ?? '',
    );

    res.set('Content-Type', 'text/plain');
    res.send(response);
  }

  // ── Delivery report webhook (no JWT — called by Africa's Talking) ─────────

  /** POST /at/sms/delivery-report */
  @Post('sms/delivery-report')
  async deliveryReport(@Body() body: any, @Query('tenantId') tenantId: string) {
    const resolvedTenantId = tenantId || process.env.DEFAULT_TENANT_ID || '';
    await this.atService.handleDeliveryReport(
      resolvedTenantId,
      body.id,
      body.status,
    );
    return { ok: true };
  }

  // ── Logs & Sessions ───────────────────────────────────────────────────────

  /** GET /at/logs */
  @UseGuards(JwtAuthGuard)
  @Get('logs')
  async getLogs(
    @Req() req: any,
    @Query('channel') channel?: string,
    @Query('patientId') patientId?: string,
    @Query('page') page = '1',
    @Query('limit') limit = '20',
  ) {
    return this.atService.getMessageLogs(req.tenantId, {
      channel,
      patientId,
      page: Number(page),
      limit: Number(limit),
    });
  }

  /** GET /at/ussd/sessions */
  @UseGuards(JwtAuthGuard)
  @Get('ussd/sessions')
  async getUssdSessions(
    @Req() req: any,
    @Query('page') page = '1',
    @Query('limit') limit = '20',
  ) {
    return this.atService.getUssdSessions(req.tenantId, Number(page), Number(limit));
  }

  // ── Templates ────────────────────────────────────────────────────────────

  /** GET /at/templates */
  @UseGuards(JwtAuthGuard)
  @Get('templates')
  async getTemplates(@Req() req: any) {
    return this.atService.getTemplates(req.tenantId);
  }

  /** PUT /at/templates */
  @UseGuards(JwtAuthGuard)
  @Put('templates')
  async upsertTemplate(@Req() req: any, @Body() body: any) {
    return this.atService.upsertTemplate(req.tenantId, body);
  }
}
