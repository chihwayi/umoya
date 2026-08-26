import { UseGuards, Controller, Get, Post, Patch, Body, Param, Query, Req } from '@nestjs/common';
import { WardRoundService } from '../services/ward-round.service';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';

@Controller('ward')
@UseGuards(JwtAuthGuard)
export class WardRoundController {
  constructor(private readonly ward: WardRoundService) {}

  @Get('census')
  getCensus(@Req() req: any, @Query('doctorId') doctorId?: string) {
    return this.ward.getInpatientCensus(req.tenantDb, doctorId);
  }

  @Post('admissions')
  admit(
    @Req() req: any,
    @Body() body: { patientId: string; encounterId: string; bedId: string; notes?: string },
  ) {
    return this.ward.admitPatient(req.tenantDb, body.patientId, body.encounterId, body.bedId, req.user.id, body.notes);
  }

  @Patch('admissions/:id/discharge')
  discharge(@Req() req: any, @Param('id') id: string) {
    return this.ward.dischargePatient(req.tenantDb, id);
  }

  @Post('admissions/:id/notes')
  saveNote(
    @Req() req: any,
    @Param('id') id: string,
    @Body() body: { encounterId: string; subjective?: string; objective?: string; assessment?: string; plan?: string; dictationRaw?: string },
  ) {
    return this.ward.saveRoundNote(req.tenantDb, id, body.encounterId, req.user.id, body);
  }

  @Get('admissions/:id/notes')
  getNotes(@Req() req: any, @Param('id') id: string) {
    return this.ward.getRoundNotes(req.tenantDb, id);
  }

  @Post('admissions/:id/orders')
  createOrder(
    @Req() req: any,
    @Param('id') id: string,
    @Body() body: { encounterId: string; orderType: any; drugName?: string; dose?: string; route?: string; frequency?: string; durationDays?: number; testName?: string; taskDescription?: string; priority?: string; notes?: string },
  ) {
    return this.ward.createOrder(req.tenantDb, id, body.encounterId, req.user.id, body);
  }

  @Get('admissions/:id/orders')
  getOrders(@Req() req: any, @Param('id') id: string) {
    return this.ward.getAdmissionOrders(req.tenantDb, id);
  }
}
