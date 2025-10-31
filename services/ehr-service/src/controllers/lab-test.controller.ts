import { Controller, Get, Param, Query, UseGuards, Request, Post, Body } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiSecurity } from '@nestjs/swagger';
import { LabTestService } from '../services/lab-test.service';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { RequestWithTenant } from '../middleware/tenant.middleware';

@ApiTags('Lab Tests')
@ApiSecurity('tenant-key')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('lab-tests')
export class LabTestController {
  constructor(private labTestService: LabTestService) {}

  @Get()
  @ApiOperation({ summary: 'Get all lab tests (test catalog)' })
  @ApiResponse({ status: 200, description: 'Tests retrieved successfully' })
  async findAll(@Request() req: RequestWithTenant, @Query('category') category?: string, @Query('search') search?: string) {
    return this.labTestService.findAll(req.tenantDb, category, search);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get test by ID' })
  async findOne(@Param('id') id: string, @Request() req: RequestWithTenant) {
    return this.labTestService.findOne(id, req.tenantDb);
  }

  @Get(':id/reference-range')
  @ApiOperation({ summary: 'Get reference range for a test based on patient gender' })
  async getReferenceRange(
    @Param('id') id: string,
    @Query('gender') gender: string,
    @Request() req: RequestWithTenant
  ) {
    return this.labTestService.getReferenceRange(id, gender, req.tenantDb);
  }

  @Post('seed')
  @ApiOperation({ summary: 'Seed default lab tests (admin only)' })
  async seedDefaultTests(@Request() req: RequestWithTenant) {
    await this.labTestService.seedDefaultTests(req.tenantDb);
    return { message: 'Default lab tests seeded successfully' };
  }
}

