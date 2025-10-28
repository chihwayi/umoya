import { Controller, Get, Post, Body, Patch, Param, Delete, Query, UseGuards, Req, Put } from '@nestjs/common';
import { AppointmentService } from '../services/appointment.service';
import { CreateAppointmentDto, UpdateAppointmentDto, AppointmentQueryDto } from '../dto/appointment.dto';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { RequestWithTenant } from '../middleware/tenant.middleware';

@Controller('appointments')
@UseGuards(JwtAuthGuard)
export class AppointmentController {
  constructor(private readonly appointmentService: AppointmentService) {}

  @Post()
  create(@Body() createAppointmentDto: CreateAppointmentDto, @Req() req: RequestWithTenant) {
    return this.appointmentService.create(createAppointmentDto, req.user.userId, req.tenantId);
  }

  @Get()
  async findAll(@Query() query: AppointmentQueryDto, @Req() req: RequestWithTenant) {
    return this.appointmentService.findAll(query, req.tenantId);
  }

  @Get('doctor/:doctorId/schedule')
  getDoctorSchedule(@Param('doctorId') doctorId: string, @Query('date') date: string, @Req() req: RequestWithTenant) {
    return this.appointmentService.getDoctorSchedule(doctorId, date, req.tenantId);
  }

  @Get('doctor/:doctorId/available-slots')
  getAvailableSlots(@Param('doctorId') doctorId: string, @Query('date') date: string, @Req() req: RequestWithTenant) {
    return this.appointmentService.getAvailableSlots(doctorId, date, req.tenantId);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @Req() req: RequestWithTenant) {
    return this.appointmentService.findOne(id, req.tenantId);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateAppointmentDto: UpdateAppointmentDto, @Req() req: RequestWithTenant) {
    return this.appointmentService.update(id, updateAppointmentDto, req.tenantId);
  }

  @Put(':id/status')
  updateStatus(@Param('id') id: string, @Body() body: { status: string }, @Req() req: RequestWithTenant) {
    return this.appointmentService.updateStatus(id, body.status, req.tenantId);
  }

  @Put(':id/check-in')
  checkIn(@Param('id') id: string, @Req() req: RequestWithTenant) {
    return this.appointmentService.checkInPatient(id, req.tenantId);
  }

  @Put(':id/start')
  startAppointment(@Param('id') id: string, @Req() req: RequestWithTenant) {
    return this.appointmentService.startAppointment(id, req.tenantId);
  }

  @Put(':id/complete')
  completeAppointment(@Param('id') id: string, @Req() req: RequestWithTenant) {
    return this.appointmentService.completeAppointment(id, req.tenantId);
  }

  @Get('doctor/:doctorId/wait-times')
  getWaitTimes(@Param('doctorId') doctorId: string, @Query('date') date: string, @Req() req: RequestWithTenant) {
    return this.appointmentService.getWaitTimes(doctorId, date, req.tenantId);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @Req() req: RequestWithTenant) {
    return this.appointmentService.remove(id, req.tenantId);
  }
}