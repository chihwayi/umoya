import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { WaitlistService, CreateWaitlistEntryDto, UpdateWaitlistEntryDto } from '../services/waitlist.service';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { RequestWithTenant } from '../middleware/tenant.middleware';
import { TenantService } from '../services/tenant.service';

@ApiTags('Appointment Waitlist')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('waitlist')
export class WaitlistController {
  constructor(
    private readonly waitlistService: WaitlistService,
    private readonly tenantService: TenantService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Get waitlist entries', description: 'Get all waitlist entries with optional filters' })
  @ApiResponse({ status: 200, description: 'Waitlist entries retrieved successfully' })
  async getWaitlist(
    @Request() req: RequestWithTenant,
    @Query('status') status?: string,
    @Query('priority') priority?: string,
    @Query('doctorId') doctorId?: string,
    @Query('patientId') patientId?: string,
  ) {
    const tenantDb = await this.tenantService.getTenantDatabase(req.tenantId);
    if (!tenantDb) {
      throw new Error('Failed to connect to tenant database');
    }

    return this.waitlistService.getWaitlistEntries(tenantDb, {
      status,
      priority,
      doctorId,
      patientId,
    });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get waitlist entry by ID' })
  @ApiResponse({ status: 200, description: 'Waitlist entry retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Waitlist entry not found' })
  async getWaitlistEntry(@Request() req: RequestWithTenant, @Param('id') id: string) {
    const tenantDb = await this.tenantService.getTenantDatabase(req.tenantId);
    if (!tenantDb) {
      throw new Error('Failed to connect to tenant database');
    }

    return this.waitlistService.getWaitlistEntry(tenantDb, id);
  }

  @Post()
  @ApiOperation({ summary: 'Add patient to waitlist' })
  @ApiResponse({ status: 201, description: 'Patient added to waitlist successfully' })
  async createWaitlistEntry(
    @Request() req: RequestWithTenant,
    @Body() dto: CreateWaitlistEntryDto,
  ) {
    const tenantDb = await this.tenantService.getTenantDatabase(req.tenantId);
    if (!tenantDb) {
      throw new Error('Failed to connect to tenant database');
    }

    const userId = (req.user as any)?.id || (req.user as any)?.userId;
    return this.waitlistService.createWaitlistEntry(tenantDb, dto, userId);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update waitlist entry' })
  @ApiResponse({ status: 200, description: 'Waitlist entry updated successfully' })
  async updateWaitlistEntry(
    @Request() req: RequestWithTenant,
    @Param('id') id: string,
    @Body() dto: UpdateWaitlistEntryDto,
  ) {
    const tenantDb = await this.tenantService.getTenantDatabase(req.tenantId);
    if (!tenantDb) {
      throw new Error('Failed to connect to tenant database');
    }

    return this.waitlistService.updateWaitlistEntry(tenantDb, id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Remove patient from waitlist' })
  @ApiResponse({ status: 200, description: 'Patient removed from waitlist successfully' })
  async deleteWaitlistEntry(@Request() req: RequestWithTenant, @Param('id') id: string) {
    const tenantDb = await this.tenantService.getTenantDatabase(req.tenantId);
    if (!tenantDb) {
      throw new Error('Failed to connect to tenant database');
    }

    await this.waitlistService.deleteWaitlistEntry(tenantDb, id);
    return { message: 'Waitlist entry deleted successfully' };
  }

  @Post(':id/schedule')
  @ApiOperation({ summary: 'Schedule appointment from waitlist entry' })
  @ApiResponse({ status: 200, description: 'Appointment scheduled from waitlist successfully' })
  async scheduleFromWaitlist(
    @Request() req: RequestWithTenant,
    @Param('id') id: string,
    @Body() body: { appointmentDate: string },
  ) {
    const tenantDb = await this.tenantService.getTenantDatabase(req.tenantId);
    if (!tenantDb) {
      throw new Error('Failed to connect to tenant database');
    }

    const userId = (req.user as any)?.id || (req.user as any)?.userId;
    return this.waitlistService.scheduleFromWaitlist(tenantDb, id, body.appointmentDate, userId, req.tenantId);
  }

  @Post(':id/notify')
  @ApiOperation({ summary: 'Mark waitlist entry as notified' })
  @ApiResponse({ status: 200, description: 'Waitlist entry marked as notified' })
  async notifyWaitlistEntry(@Request() req: RequestWithTenant, @Param('id') id: string) {
    const tenantDb = await this.tenantService.getTenantDatabase(req.tenantId);
    if (!tenantDb) {
      throw new Error('Failed to connect to tenant database');
    }

    return this.waitlistService.notifyWaitlistEntry(tenantDb, id);
  }

  @Post('check-availability/:doctorId')
  @ApiOperation({ summary: 'Check available slots and notify waitlist patients' })
  @ApiResponse({ status: 200, description: 'Availability checked and patients notified' })
  async checkAvailabilityAndNotify(
    @Request() req: RequestWithTenant,
    @Param('doctorId') doctorId: string,
    @Query('date') date: string,
  ) {
    const tenantDb = await this.tenantService.getTenantDatabase(req.tenantId);
    if (!tenantDb) {
      throw new Error('Failed to connect to tenant database');
    }

    return this.waitlistService.checkAvailableSlotsAndNotify(tenantDb, doctorId, date, req.tenantId);
  }
}

