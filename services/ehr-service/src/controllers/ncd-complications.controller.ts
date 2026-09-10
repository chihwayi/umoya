import { Body, Controller, Get, Post, Query, Request, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { RequestWithTenant } from '../middleware/tenant.middleware';
import { NcdComplicationsService } from '../services/ncd-complications.service';

@Controller('ncd-complications')
@UseGuards(JwtAuthGuard)
export class NcdComplicationsController {
  constructor(private readonly ncdComplicationsService: NcdComplicationsService) {}

  @Post('complication-events')
  recordComplicationEvent(@Body() body: any, @Request() req: RequestWithTenant) {
    return this.ncdComplicationsService.recordComplicationEvent(
      req.tenantId!,
      body.patientId,
      req.user?.sub || req.user?.id,
      {
        complicationType: body.complicationType,
        severity: body.severity,
        measurements: body.measurements,
        notes: body.notes,
      },
    );
  }

  @Get('complication-events')
  getComplicationEvents(@Query('patientId') patientId: string, @Request() req: RequestWithTenant) {
    return this.ncdComplicationsService.getComplicationEvents(req.tenantId!, patientId);
  }
}
