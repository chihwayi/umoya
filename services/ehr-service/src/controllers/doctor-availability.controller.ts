import { Controller, Get, Post, Body, Patch, Param, Delete, Query, UseGuards, Req } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { DoctorAvailabilityService } from '../services/doctor-availability.service';
import { CreateDoctorAvailabilityDto, UpdateDoctorAvailabilityDto, DoctorAvailabilityQueryDto } from '../dto/doctor-availability.dto';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { RequestWithTenant } from '../middleware/tenant.middleware';

@ApiTags('Doctor Availability')
@ApiBearerAuth()
@Controller('doctor-availability')
@UseGuards(JwtAuthGuard)
export class DoctorAvailabilityController {
  constructor(private readonly availabilityService: DoctorAvailabilityService) {}

  @Post()
  @ApiOperation({ summary: 'Create doctor availability/unavailability' })
  @ApiResponse({ status: 201, description: 'Availability created successfully' })
  create(@Body() createDto: CreateDoctorAvailabilityDto, @Req() req: RequestWithTenant) {
    const userId = (req.user as any)?.id || (req.user as any)?.userId;
    return this.availabilityService.create(createDto, userId, req.tenantId);
  }

  @Get()
  @ApiOperation({ summary: 'Get doctor availability records' })
  @ApiResponse({ status: 200, description: 'Availability records retrieved successfully' })
  findAll(@Query() query: DoctorAvailabilityQueryDto, @Req() req: RequestWithTenant) {
    return this.availabilityService.findAll(query, req.tenantId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get availability by ID' })
  @ApiResponse({ status: 200, description: 'Availability retrieved successfully' })
  findOne(@Param('id') id: string, @Req() req: RequestWithTenant) {
    return this.availabilityService.findOne(id, req.tenantId);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update availability' })
  @ApiResponse({ status: 200, description: 'Availability updated successfully' })
  update(@Param('id') id: string, @Body() updateDto: UpdateDoctorAvailabilityDto, @Req() req: RequestWithTenant) {
    const userId = (req.user as any)?.id || (req.user as any)?.userId;
    return this.availabilityService.update(id, updateDto, userId, req.tenantId);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete availability' })
  @ApiResponse({ status: 200, description: 'Availability deleted successfully' })
  remove(@Param('id') id: string, @Req() req: RequestWithTenant) {
    return this.availabilityService.remove(id, req.tenantId);
  }
}

