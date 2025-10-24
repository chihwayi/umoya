import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiSecurity } from '@nestjs/swagger';
import { AppointmentService } from '../services/appointment.service';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { RequestWithTenant } from '../middleware/tenant.middleware';

@ApiTags('Appointment Management')
@ApiSecurity('tenant-key')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('appointments')
export class AppointmentController {
  constructor(private appointmentService: AppointmentService) {}

  @Post()
  @ApiOperation({ summary: 'Create new appointment' })
  @ApiResponse({ status: 201, description: 'Appointment created successfully' })
  async createAppointment(@Body() createAppointmentDto: any, @Request() req: RequestWithTenant) {
    return this.appointmentService.create(createAppointmentDto, req.tenantDb, (req.user as any).id);
  }

  @Get()
  @ApiOperation({ summary: 'Get appointments with filters' })
  @ApiResponse({ status: 200, description: 'Appointments retrieved successfully' })
  async getAppointments(@Query() query: any, @Request() req: RequestWithTenant) {
    return this.appointmentService.findAll(query, req.tenantDb);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get appointment by ID' })
  @ApiResponse({ status: 200, description: 'Appointment retrieved successfully' })
  async getAppointment(@Param('id') id: string, @Request() req: RequestWithTenant) {
    return this.appointmentService.findById(id, req.tenantDb);
  }

  @Put(':id/status')
  @ApiOperation({ summary: 'Update appointment status' })
  @ApiResponse({ status: 200, description: 'Appointment status updated successfully' })
  async updateAppointmentStatus(
    @Param('id') id: string,
    @Body() body: { status: string },
    @Request() req: RequestWithTenant
  ) {
    return this.appointmentService.updateStatus(id, body.status as any, req.tenantDb);
  }
}