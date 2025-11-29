import { Controller, Get, Post, Body, Patch, Param, Delete, Query, UseGuards, Req, Put } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery, ApiParam } from '@nestjs/swagger';
import { AppointmentService } from '../services/appointment.service';
import { CreateAppointmentDto, UpdateAppointmentDto, AppointmentQueryDto } from '../dto/appointment.dto';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { RequestWithTenant } from '../middleware/tenant.middleware';

@ApiTags('Appointments')
@ApiBearerAuth()
@Controller('appointments')
@UseGuards(JwtAuthGuard)
export class AppointmentController {
  constructor(private readonly appointmentService: AppointmentService) {}

  @Post()
  @ApiOperation({ summary: 'Create new appointment', description: 'Schedule a new appointment for a patient with conflict detection' })
  @ApiResponse({ status: 201, description: 'Appointment created successfully' })
  @ApiResponse({ status: 409, description: 'Appointment conflict detected' })
  create(@Body() createAppointmentDto: CreateAppointmentDto, @Req() req: RequestWithTenant) {
    const userId = (req.user as any)?.id || (req.user as any)?.userId;
    return this.appointmentService.create(createAppointmentDto, userId, req.tenantId);
  }

  @Get()
  @ApiOperation({ summary: 'Get appointments', description: 'Retrieve appointments with filtering and pagination' })
  @ApiResponse({ status: 200, description: 'Appointments retrieved successfully' })
  async findAll(@Query() query: AppointmentQueryDto, @Req() req: RequestWithTenant) {
    return this.appointmentService.findAll(query, req.tenantId);
  }

  @Get('doctor/:doctorId/schedule')
  @ApiOperation({ summary: 'Get doctor schedule', description: 'Get all appointments for a specific doctor on a given date' })
  @ApiParam({ name: 'doctorId', description: 'Doctor ID' })
  @ApiQuery({ name: 'date', description: 'Date in YYYY-MM-DD format' })
  getDoctorSchedule(@Param('doctorId') doctorId: string, @Query('date') date: string, @Req() req: RequestWithTenant) {
    return this.appointmentService.getDoctorSchedule(doctorId, date, req.tenantId);
  }

  @Get('doctor/:doctorId/available-slots')
  @ApiOperation({ summary: 'Get available time slots', description: 'Get available appointment slots for a doctor on a specific date' })
  @ApiParam({ name: 'doctorId', description: 'Doctor ID' })
  @ApiQuery({ name: 'date', description: 'Date in YYYY-MM-DD format' })
  getAvailableSlots(@Param('doctorId') doctorId: string, @Query('date') date: string, @Req() req: RequestWithTenant) {
    return this.appointmentService.getAvailableSlots(doctorId, date, req.tenantId);
  }

  @Get('stats/dashboard')
  @ApiOperation({ summary: 'Get appointment statistics', description: 'Get appointment statistics for dashboard' })
  getAppointmentStats(@Req() req: RequestWithTenant) {
    return this.appointmentService.getAppointmentStats(req.tenantId);
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
  @ApiOperation({ summary: 'Cancel appointment', description: 'Cancel an appointment (soft delete)' })
  remove(@Param('id') id: string, @Req() req: RequestWithTenant) {
    return this.appointmentService.remove(id, req.tenantId);
  }

  @Post('recurring')
  @ApiOperation({ summary: 'Create recurring appointments', description: 'Create multiple appointments based on a recurring pattern' })
  @ApiResponse({ status: 201, description: 'Recurring appointments created successfully' })
  createRecurring(
    @Body() body: { appointment: CreateAppointmentDto; pattern: string; endDate: string },
    @Req() req: RequestWithTenant,
  ) {
    const userId = (req.user as any)?.id || (req.user as any)?.userId;
    return this.appointmentService.createRecurringAppointments(
      body.appointment,
      body.pattern,
      new Date(body.endDate),
      req.tenantId,
      userId,
    );
  }

  @Get('calendar/:date')
  @ApiOperation({ summary: 'Get calendar view', description: 'Get all appointments for calendar view (day/week/month)' })
  @ApiParam({ name: 'date', description: 'Date in YYYY-MM-DD format' })
  @ApiQuery({ name: 'view', description: 'View type: day, week, or month', required: false })
  getCalendarView(
    @Param('date') date: string,
    @Query('view') view: 'day' | 'week' | 'month' = 'day',
    @Req() req: RequestWithTenant
  ) {
    return this.appointmentService.getCalendarView(date, view, req.tenantId);
  }

  @Get('calendar/month/:year/:month')
  @ApiOperation({ summary: 'Get month view', description: 'Get all appointments for a specific month' })
  @ApiParam({ name: 'year', description: 'Year (e.g., 2025)' })
  @ApiParam({ name: 'month', description: 'Month (1-12)' })
  getMonthView(
    @Param('year') year: string,
    @Param('month') month: string,
    @Req() req: RequestWithTenant
  ) {
    return this.appointmentService.getMonthView(parseInt(year, 10), parseInt(month, 10), req.tenantId);
  }

  @Get('calendar/week/:startDate')
  @ApiOperation({ summary: 'Get week view', description: 'Get all appointments for a week starting from the given date' })
  @ApiParam({ name: 'startDate', description: 'Start date in YYYY-MM-DD format' })
  getWeekView(@Param('startDate') startDate: string, @Req() req: RequestWithTenant) {
    return this.appointmentService.getWeekView(startDate, req.tenantId);
  }

  @Put(':id/reschedule')
  @ApiOperation({ summary: 'Reschedule appointment', description: 'Reschedule an appointment to a new date/time' })
  reschedule(
    @Param('id') id: string,
    @Body() body: { newDate: string; reason?: string },
    @Req() req: RequestWithTenant
  ) {
    return this.appointmentService.reschedule(id, body.newDate, body.reason, req.tenantId);
  }

  @Put(':id/no-show')
  @ApiOperation({ summary: 'Mark as no-show', description: 'Mark appointment as no-show when patient does not arrive' })
  markNoShow(@Param('id') id: string, @Req() req: RequestWithTenant) {
    return this.appointmentService.markNoShow(id, req.tenantId);
  }

  @Get('search')
  @ApiOperation({ summary: 'Search appointments', description: 'Search appointments by patient name, MRN, or appointment details' })
  @ApiQuery({ name: 'q', description: 'Search query' })
  searchAppointments(@Query('q') query: string, @Req() req: RequestWithTenant) {
    return this.appointmentService.searchAppointments(query, req.tenantId);
  }

  @Get('templates')
  @ApiOperation({ summary: 'Get appointment templates', description: 'Get predefined appointment templates for quick booking' })
  getAppointmentTemplates(@Req() req: RequestWithTenant) {
    return this.appointmentService.getAppointmentTemplates(req.tenantId);
  }

  @Post('templates')
  @ApiOperation({ summary: 'Create appointment template', description: 'Create a new appointment template for quick booking' })
  createAppointmentTemplate(
    @Body() template: { name: string; type: string; duration: number; instructions?: string },
    @Req() req: RequestWithTenant
  ) {
    return this.appointmentService.createAppointmentTemplate(template, req.tenantId);
  }

  @Get('analytics/trends')
  @ApiOperation({ summary: 'Get appointment trends', description: 'Get appointment analytics and trends over time' })
  @ApiQuery({ name: 'period', description: 'Time period (week, month, quarter, year)' })
  getAppointmentTrends(@Query('period') period: string, @Req() req: RequestWithTenant) {
    return this.appointmentService.getAppointmentTrends(period || 'month', req.tenantId);
  }

  @Get('analytics/doctor-performance')
  @ApiOperation({ summary: 'Get doctor performance metrics', description: 'Get appointment performance metrics for doctors' })
  @ApiQuery({ name: 'doctorId', description: 'Doctor ID (optional)' })
  getDoctorPerformance(@Query('doctorId') doctorId: string, @Req() req: RequestWithTenant) {
    return this.appointmentService.getDoctorPerformance(doctorId, req.tenantId);
  }

  @Post(':id/reminder')
  @ApiOperation({ summary: 'Send appointment reminder', description: 'Send reminder notification for an appointment' })
  sendReminder(@Param('id') id: string, @Req() req: RequestWithTenant) {
    return this.appointmentService.sendReminder(id, req.tenantId);
  }

  @Get('conflicts/:doctorId')
  @ApiOperation({ summary: 'Check appointment conflicts', description: 'Check for potential conflicts for a doctor at a specific time' })
  @ApiQuery({ name: 'date', description: 'Date in YYYY-MM-DD format' })
  @ApiQuery({ name: 'time', description: 'Time in HH:MM format' })
  @ApiQuery({ name: 'duration', description: 'Duration in minutes' })
  checkConflicts(
    @Param('doctorId') doctorId: string,
    @Query('date') date: string,
    @Query('time') time: string,
    @Query('duration') duration: string,
    @Req() req: RequestWithTenant
  ) {
    return this.appointmentService.checkConflicts(doctorId, date, time, parseInt(duration), req.tenantId);
  }
}