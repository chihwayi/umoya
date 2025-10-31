import { Controller, Get, Param, Query, UseGuards, Request, Post } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiSecurity } from '@nestjs/swagger';
import { LabOrderSetService } from '../services/lab-order-set.service';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { RequestWithTenant } from '../middleware/tenant.middleware';

@ApiTags('Lab Order Sets')
@ApiSecurity('tenant-key')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('lab-order-sets')
export class LabOrderSetController {
  constructor(private labOrderSetService: LabOrderSetService) {}

  @Get()
  @ApiOperation({ summary: 'Get all lab order sets' })
  @ApiResponse({ status: 200, description: 'Order sets retrieved successfully' })
  async findAll(@Request() req: RequestWithTenant, @Query('category') category?: string) {
    return this.labOrderSetService.findAll(req.tenantDb, category);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get order set by ID with tests' })
  async findOne(@Param('id') id: string, @Request() req: RequestWithTenant) {
    return this.labOrderSetService.getSetWithTests(id, req.tenantDb);
  }

  @Post('seed')
  @ApiOperation({ summary: 'Seed default order sets (admin only)' })
  async seedDefaultOrderSets(@Request() req: RequestWithTenant) {
    await this.labOrderSetService.seedDefaultOrderSets(req.tenantDb);
    return { message: 'Default order sets seeded successfully' };
  }
}

