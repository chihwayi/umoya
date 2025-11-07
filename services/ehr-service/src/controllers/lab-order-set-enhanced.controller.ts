import { Controller, Get, Post, Patch, Delete, Body, Param, Query, Request, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { LabOrderSetEnhancedService } from '../services/lab-order-set-enhanced.service';
import { RequestWithTenant } from '../middleware/tenant.middleware';

@ApiTags('Lab Order Sets (Enhanced)')
@Controller('lab/order-sets-enhanced')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class LabOrderSetEnhancedController {
  constructor(private readonly labOrderSetEnhancedService: LabOrderSetEnhancedService) {}

  @Get()
  @ApiOperation({ summary: 'Get all order sets with test counts' })
  @ApiResponse({ status: 200, description: 'List of order sets' })
  async getAllOrderSets(
    @Request() req: RequestWithTenant,
    @Query('category') category?: string,
    @Query('active') active?: boolean,
  ) {
    return this.labOrderSetEnhancedService.getAllOrderSets(req.tenantDb, { category, active });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get order set details with all tests' })
  @ApiResponse({ status: 200, description: 'Order set details' })
  async getOrderSetById(
    @Request() req: RequestWithTenant,
    @Param('id') id: string,
  ) {
    return this.labOrderSetEnhancedService.getOrderSetById(req.tenantDb, id);
  }

  @Get(':id/tests')
  @ApiOperation({ summary: 'Get all tests in an order set' })
  @ApiResponse({ status: 200, description: 'Tests in order set' })
  async getOrderSetTests(
    @Request() req: RequestWithTenant,
    @Param('id') id: string,
  ) {
    return this.labOrderSetEnhancedService.getOrderSetTests(req.tenantDb, id);
  }

  @Post()
  @ApiOperation({ summary: 'Create new order set' })
  @ApiResponse({ status: 201, description: 'Order set created successfully' })
  async createOrderSet(
    @Request() req: RequestWithTenant,
    @Body() orderSetData: any,
  ) {
    const userId = req.user?.userId;
    return this.labOrderSetEnhancedService.createOrderSet(req.tenantDb, orderSetData, userId);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update order set' })
  @ApiResponse({ status: 200, description: 'Order set updated successfully' })
  async updateOrderSet(
    @Request() req: RequestWithTenant,
    @Param('id') id: string,
    @Body() orderSetData: any,
  ) {
    return this.labOrderSetEnhancedService.updateOrderSet(req.tenantDb, id, orderSetData);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete order set' })
  @ApiResponse({ status: 200, description: 'Order set deleted successfully' })
  async deleteOrderSet(
    @Request() req: RequestWithTenant,
    @Param('id') id: string,
  ) {
    return this.labOrderSetEnhancedService.deleteOrderSet(req.tenantDb, id);
  }

  @Post(':id/tests')
  @ApiOperation({ summary: 'Add test to order set' })
  @ApiResponse({ status: 201, description: 'Test added to order set' })
  async addTestToOrderSet(
    @Request() req: RequestWithTenant,
    @Param('id') orderSetId: string,
    @Body() body: { test_catalog_id: string; sort_order?: number },
  ) {
    return this.labOrderSetEnhancedService.addTestToOrderSet(
      req.tenantDb,
      orderSetId,
      body.test_catalog_id,
      body.sort_order,
    );
  }

  @Delete(':id/tests/:testCatalogId')
  @ApiOperation({ summary: 'Remove test from order set' })
  @ApiResponse({ status: 200, description: 'Test removed from order set' })
  async removeTestFromOrderSet(
    @Request() req: RequestWithTenant,
    @Param('id') orderSetId: string,
    @Param('testCatalogId') testCatalogId: string,
  ) {
    return this.labOrderSetEnhancedService.removeTestFromOrderSet(req.tenantDb, orderSetId, testCatalogId);
  }

  @Patch(':id/tests/reorder')
  @ApiOperation({ summary: 'Reorder tests in order set' })
  @ApiResponse({ status: 200, description: 'Tests reordered successfully' })
  async reorderTests(
    @Request() req: RequestWithTenant,
    @Param('id') orderSetId: string,
    @Body() body: { test_orders: Array<{ test_catalog_id: string; sort_order: number }> },
  ) {
    return this.labOrderSetEnhancedService.reorderTests(req.tenantDb, orderSetId, body.test_orders);
  }

  @Post('create-from-order-set')
  @ApiOperation({ summary: 'Create lab orders from an order set' })
  @ApiResponse({ status: 201, description: 'Lab orders created successfully' })
  async createOrdersFromSet(
    @Request() req: RequestWithTenant,
    @Body() body: {
      order_set_id: string;
      patient_id: string;
      ordering_provider_id: string;
      priority?: string;
      clinical_indication?: string;
    },
  ) {
    const userId = req.user?.userId;
    return this.labOrderSetEnhancedService.createOrdersFromSet(req.tenantDb, body, userId);
  }
}

