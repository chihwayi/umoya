import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards, Req } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { AppointmentResourceService, CreateResourceDto, UpdateResourceDto, BookResourceDto } from '../services/appointment-resource.service';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { RequestWithTenant } from '../middleware/tenant.middleware';

@ApiTags('Appointment Resources')
@ApiBearerAuth()
@Controller('appointments/resources')
@UseGuards(JwtAuthGuard)
export class AppointmentResourceController {
  constructor(private readonly resourceService: AppointmentResourceService) {}

  @Post()
  @ApiOperation({ summary: 'Create resource', description: 'Create a new room or equipment resource' })
  @ApiResponse({ status: 201, description: 'Resource created successfully' })
  createResource(@Body() dto: CreateResourceDto, @Req() req: RequestWithTenant) {
    return this.resourceService.createResource(dto, req.tenantId);
  }

  @Get()
  @ApiOperation({ summary: 'Get all resources', description: 'Get all rooms and equipment resources' })
  @ApiQuery({ name: 'type', description: 'Filter by type (room or equipment)', required: false })
  getResources(@Query('type') type: 'room' | 'equipment', @Req() req: RequestWithTenant) {
    return this.resourceService.findAllResources(req.tenantId, type);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get resource by ID' })
  getResource(@Param('id') id: string, @Req() req: RequestWithTenant) {
    return this.resourceService.findOneResource(id, req.tenantId);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update resource' })
  updateResource(@Param('id') id: string, @Body() dto: UpdateResourceDto, @Req() req: RequestWithTenant) {
    return this.resourceService.updateResource(id, dto, req.tenantId);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete resource', description: 'Soft delete a resource' })
  deleteResource(@Param('id') id: string, @Req() req: RequestWithTenant) {
    return this.resourceService.deleteResource(id, req.tenantId);
  }

  @Get(':id/availability')
  @ApiOperation({ summary: 'Check resource availability', description: 'Check if a resource is available at a specific time' })
  @ApiQuery({ name: 'startTime', description: 'Start time in ISO format' })
  @ApiQuery({ name: 'endTime', description: 'End time in ISO format' })
  @ApiQuery({ name: 'excludeAppointmentId', description: 'Exclude this appointment ID from conflict check', required: false })
  checkAvailability(
    @Param('id') id: string,
    @Query('startTime') startTime: string,
    @Query('endTime') endTime: string,
    @Query('excludeAppointmentId') excludeAppointmentId: string,
    @Req() req: RequestWithTenant,
  ) {
    return this.resourceService.checkResourceAvailability(
      id,
      new Date(startTime),
      new Date(endTime),
      req.tenantId,
      excludeAppointmentId,
    );
  }

  @Post('bookings')
  @ApiOperation({ summary: 'Book resource', description: 'Book a resource for an appointment' })
  @ApiResponse({ status: 201, description: 'Resource booked successfully' })
  @ApiResponse({ status: 409, description: 'Resource conflict detected' })
  bookResource(@Body() dto: BookResourceDto, @Req() req: RequestWithTenant) {
    return this.resourceService.bookResource(dto, req.tenantId);
  }

  @Get('bookings/resource/:resourceId')
  @ApiOperation({ summary: 'Get resource bookings', description: 'Get all bookings for a resource in a date range' })
  @ApiQuery({ name: 'startDate', description: 'Start date in ISO format' })
  @ApiQuery({ name: 'endDate', description: 'End date in ISO format' })
  getResourceBookings(
    @Param('resourceId') resourceId: string,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
    @Req() req: RequestWithTenant,
  ) {
    return this.resourceService.getResourceBookings(
      resourceId,
      new Date(startDate),
      new Date(endDate),
      req.tenantId,
    );
  }

  @Get('bookings/appointment/:appointmentId')
  @ApiOperation({ summary: 'Get appointment resources', description: 'Get all resources booked for an appointment' })
  getAppointmentResources(@Param('appointmentId') appointmentId: string, @Req() req: RequestWithTenant) {
    return this.resourceService.getAppointmentResources(appointmentId, req.tenantId);
  }

  @Delete('bookings/:id')
  @ApiOperation({ summary: 'Cancel resource booking' })
  cancelBooking(@Param('id') id: string, @Req() req: RequestWithTenant) {
    return this.resourceService.cancelResourceBooking(id, req.tenantId);
  }
}

