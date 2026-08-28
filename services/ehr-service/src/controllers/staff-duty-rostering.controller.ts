import { Controller, Get, Post, Patch, Body, Param, Query, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { StaffDutyRosteringService } from '../services/staff-duty-rostering.service';

@UseGuards(JwtAuthGuard)
@Controller('staff-rostering')
export class StaffDutyRosteringController {
  constructor(private readonly svc: StaffDutyRosteringService) {}

  @Post('shifts')
  createShift(@Req() req: any, @Body() body: any) {
    return this.svc.createShift(req.tenantDb, req.tenantId, req.user.id, body);
  }

  @Get('shifts')
  listShifts(@Req() req: any, @Query() query: any) {
    return this.svc.listShifts(req.tenantDb, req.tenantId, query);
  }

  @Get('on-call')
  getOnCallStaff(@Req() req: any, @Query('date') date: string, @Query('ward') ward?: string) {
    return this.svc.getOnCallStaff(req.tenantDb, req.tenantId, date, ward);
  }

  @Patch('shifts/:id/status')
  updateShiftStatus(@Req() req: any, @Param('id') id: string, @Body() body: { status: string }) {
    return this.svc.updateShiftStatus(req.tenantDb, req.tenantId, id, body.status);
  }

  @Patch('shifts/:id/reschedule')
  rescheduleShift(@Req() req: any, @Param('id') id: string, @Body() body: any) {
    return this.svc.rescheduleShift(req.tenantDb, req.tenantId, id, body);
  }

  @Post('handover-notes')
  addHandoverNote(@Req() req: any, @Body() body: any) {
    return this.svc.addHandoverNote(req.tenantDb, req.tenantId, req.user.id, body);
  }

  @Get('handover-notes')
  listHandoverNotes(@Req() req: any, @Query('ward') ward: string, @Query('limit') limit?: string) {
    return this.svc.listHandoverNotes(req.tenantDb, req.tenantId, ward, limit ? Number(limit) : undefined);
  }
}
