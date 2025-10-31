import { Controller, Get, Post, Put, Body, Param, Query, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiSecurity } from '@nestjs/swagger';
import { LabOrderService } from '../services/lab-order.service';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { RequestWithTenant } from '../middleware/tenant.middleware';
import { LabOrderStatus } from '../entities/lab-order.entity';

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

  @Get('patient/:patientId/results')
  @ApiOperation({ summary: 'Get completed lab results for a patient' })
  async getPatientResults(@Param('patientId') patientId: string, @Request() req: RequestWithTenant) {
    return this.labOrderService.getPatientResults(patientId, req.tenantDb);
  }

  // Lab Technician Endpoints
  @Get('pending')
  @ApiOperation({ summary: 'Get pending lab orders (for lab technicians)' })
  async getPendingOrders(@Request() req: RequestWithTenant) {
    return this.labOrderService.getPendingOrders(req.tenantDb);
  }

  @Get('in-progress')
  @ApiOperation({ summary: 'Get in-progress lab orders (for lab technicians)' })
  async getInProgressOrders(@Request() req: RequestWithTenant) {
    return this.labOrderService.getInProgressOrders(req.tenantDb);
  }

  @Put(':id/collect')
  @ApiOperation({ summary: 'Mark sample as collected' })
  async collectSample(@Param('id') id: string, @Request() req: RequestWithTenant) {
    return this.labOrderService.collectSample(id, req.tenantDb, (req.user as any).id);
  }

  @Put(':id/start-processing')
  @ApiOperation({ summary: 'Start processing lab order' })
  async startProcessing(@Param('id') id: string, @Request() req: RequestWithTenant) {
    return this.labOrderService.startProcessing(id, req.tenantDb);
  }

  @Put(':id/submit-results')
  @ApiOperation({ summary: 'Submit lab results (with optional documents)' })
  async submitResults(@Param('id') id: string, @Body() resultsDto: any, @Request() req: RequestWithTenant) {
    return this.labOrderService.submitResults(id, resultsDto, req.tenantDb, (req.user as any).id);
  }

  @Put(':id/status')
  @ApiOperation({ summary: 'Update lab order status' })
  async updateStatus(@Param('id') id: string, @Body() body: { status: string }, @Request() req: RequestWithTenant) {
    return this.labOrderService.updateStatus(id, body.status as LabOrderStatus, req.tenantDb);
  }
}