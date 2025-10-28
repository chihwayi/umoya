import { Controller, Get, Post, Body, Patch, Param, Delete, Query, UseGuards, Req, Put } from '@nestjs/common';
import { MockAppointmentService } from '../services/mock-appointment.service';
import { CreateAppointmentDto, UpdateAppointmentDto, AppointmentQueryDto } from '../dto/appointment.dto';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';

@Controller('appointments')
@UseGuards(JwtAuthGuard)
export class MockAppointmentController {
  constructor(private readonly appointmentService: MockAppointmentService) {}

  @Post()
  create(@Body() createAppointmentDto: CreateAppointmentDto, @Req() req: any) {
    return this.appointmentService.create(createAppointmentDto, req.user.userId);
  }

  @Get()
  async findAll(@Query() query: AppointmentQueryDto, @Req() req: any) {
    console.log('🚀 MockAppointmentController.findAll called');
    console.log('👤 User from token:', req.user);
    console.log('🏢 Tenant from header:', req.headers['x-tenant-id']);
    console.log('📋 Query params:', query);
    console.log('📋 Query type:', typeof query);
    console.log('📋 Query keys:', Object.keys(query || {}));
    
    const result = await this.appointmentService.findAll(query);
    console.log('✅ Service returned:', result);
    console.log('✅ Appointments count:', result.appointments?.length || 0);
    return result;
  }

  @Get('doctor/:doctorId/schedule')
  getDoctorSchedule(@Param('doctorId') doctorId: string, @Query('date') date: string) {
    return this.appointmentService.findAll({ doctorId, date });
  }

  @Get('doctor/:doctorId/available-slots')
  getAvailableSlots(@Param('doctorId') doctorId: string, @Query('date') date: string) {
    return this.appointmentService.getAvailableSlots(doctorId, date);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.appointmentService.findOne(id);
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() updateAppointmentDto: UpdateAppointmentDto) {
    return this.appointmentService.update(id, updateAppointmentDto);
  }

  @Patch(':id/status')
  updateStatus(@Param('id') id: string, @Body() body: { status: string }) {
    return this.appointmentService.update(id, { status: body.status });
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.appointmentService.remove(id);
  }
}
