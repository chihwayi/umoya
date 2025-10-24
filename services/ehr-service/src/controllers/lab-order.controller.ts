import { Controller, Get, Post, Put, Body, Param, Query, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiSecurity } from '@nestjs/swagger';
import { LabOrderService } from '../services/lab-order.service';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { RequestWithTenant } from '../middleware/tenant.middleware';

@ApiTags('Laboratory Orders')
@ApiSecurity('tenant-key')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('lab-orders')
export class LabOrderController {
  constructor(private labOrderService: LabOrderService) {}

  @Post()
  @ApiOperation({ summary: 'Create lab order' })
  async createLabOrder(@Body() createDto: any, @Request() req: RequestWithTenant) {
    return this.labOrderService.create(createDto, req.tenantDb, (req.user as any).id);
  }

  @Get()
  @ApiOperation({ summary: 'Get lab orders' })
  async getLabOrders(@Query() query: any, @Request() req: RequestWithTenant) {
    return this.labOrderService.findAll(query, req.tenantDb);
  }

  @Put(':id/results')
  @ApiOperation({ summary: 'Add lab results' })
  async addResults(@Param('id') id: string, @Body() resultsDto: any, @Request() req: RequestWithTenant) {
    return this.labOrderService.addResults(id, resultsDto, req.tenantDb, (req.user as any).id);
  }
}