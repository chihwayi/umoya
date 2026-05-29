import { Controller, Get, Post, Put, Patch, Body, Param, Query, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiSecurity } from '@nestjs/swagger';
import { LabOrderService } from '../services/lab-order.service';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { RequestWithTenant } from '../middleware/tenant.middleware';
import { LabOrderStatus } from '../entities/lab-order.entity';
import { ProactiveAiService } from '../services/proactive-ai.service';

@ApiTags('Laboratory Orders')
@ApiSecurity('tenant-key')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('lab-orders')
export class LabOrderController {
  constructor(
    private labOrderService: LabOrderService,
    private proactiveAiService: ProactiveAiService,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Create lab order' })
  async createLabOrder(@Body() createDto: any, @Request() req: RequestWithTenant) {
    return this.labOrderService.create(createDto, req.tenantDb, (req.user as any)?.userId ?? (req.user as any)?.id, req.tenantId);
  }

  @Get()
  @ApiOperation({ summary: 'Get lab orders' })
  async getLabOrders(@Query() query: any, @Request() req: RequestWithTenant) {
    return this.labOrderService.findAll(query, req.tenantDb);
  }

  @Put(':id/results')
  @ApiOperation({ summary: 'Add lab results' })
  async addResults(@Param('id') id: string, @Body() resultsDto: any, @Request() req: RequestWithTenant) {
    const updated = await this.labOrderService.addResults(id, resultsDto, req.tenantDb, (req.user as any)?.userId ?? (req.user as any)?.id);

    // ── PROACTIVE TRIGGER — pass fresh lab results ──
    if (updated?.patientId) {
      this.proactiveAiService.triggerAnalysis({
        patientId: updated.patientId,
        tenantId: req.tenantId,
        triggeredByUserId: (req.user as any)?.userId,
        triggerType: 'labs',
        freshLabs: resultsDto.results || [],
      }).catch(() => {});
    }

    return updated;
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
    return this.labOrderService.collectSample(id, req.tenantDb, (req.user as any)?.userId ?? (req.user as any)?.id);
  }

  @Put(':id/start-processing')
  @ApiOperation({ summary: 'Start processing lab order' })
  async startProcessing(@Param('id') id: string, @Request() req: RequestWithTenant) {
    return this.labOrderService.startProcessing(id, req.tenantDb);
  }

  @Put(':id/submit-results')
  @ApiOperation({ summary: 'Submit lab results (with optional documents)' })
  async submitResults(@Param('id') id: string, @Body() resultsDto: any, @Request() req: RequestWithTenant) {
    const updated = await this.labOrderService.submitResults(id, resultsDto, req.tenantDb, (req.user as any)?.userId ?? (req.user as any)?.id);

    // ── PROACTIVE TRIGGER — pass fresh lab results ──
    if (updated?.patientId) {
      this.proactiveAiService.triggerAnalysis({
        patientId: updated.patientId,
        tenantId: req.tenantId,
        triggeredByUserId: (req.user as any)?.userId,
        triggerType: 'labs',
        freshLabs: resultsDto.results || [],
      }).catch(() => {});
    }

    return updated;
  }

  @Put(':id/status')
  @ApiOperation({ summary: 'Update lab order status' })
  async updateStatus(@Param('id') id: string, @Body() body: { status: string }, @Request() req: RequestWithTenant) {
    return this.labOrderService.updateStatus(id, body.status as LabOrderStatus, req.tenantDb);
  }

  @Put(':id/processing-context')
  @ApiOperation({ summary: 'Update processing context, analyzer assignment, or workflow notes' })
  async updateProcessingContext(
    @Param('id') id: string,
    @Body()
    body: {
      processingContext?: Record<string, any>;
      appendEvent?: { type: string; description: string; metadata?: Record<string, any> };
      status?: LabOrderStatus;
      handoffNote?: { note: string; shift?: string };
      notify?: {
        channel: 'system' | 'sms' | 'email' | 'push';
        recipients: string[];
        subject?: string;
        message: string;
      };
    },
    @Request() req: RequestWithTenant,
  ) {
    const userId = (req.user as any)?.userId ?? (req.user as any)?.id;
    return this.labOrderService.updateProcessingContext(id, body, req.tenantDb, userId);
  }

  @Get('quality-controls')
  @ApiOperation({ summary: 'List recent quality control runs' })
  async getQualityControls(
    @Query('analyzer') analyzer: string,
    @Query('status') status: string,
    @Query('limit') limit: string,
    @Request() req: RequestWithTenant,
  ) {
    return this.labOrderService.getQualityControls(req.tenantDb, {
      analyzerName: analyzer,
      status,
      limit: limit ? Number(limit) : undefined,
    });
  }

  @Post('quality-controls')
  @ApiOperation({ summary: 'Log a quality control run' })
  async createQualityControl(
    @Body()
    body: {
      analyzer_name: string;
      test_code?: string;
      level?: string;
      lot_number?: string;
      run_datetime?: string;
      result_value?: string;
      status?: 'pending' | 'pass' | 'fail' | 'review';
      comments?: string;
    },
    @Request() req: RequestWithTenant,
  ) {
    const userId = (req.user as any)?.userId ?? (req.user as any)?.id;
    return this.labOrderService.createQualityControlEntry(req.tenantDb, body, userId);
  }

  @Get('inventory/reagents')
  @ApiOperation({ summary: 'Get reagent inventory levels' })
  async getReagentInventory(@Request() req: RequestWithTenant) {
    return this.labOrderService.getReagentInventory(req.tenantDb);
  }

  @Post('inventory/reagents')
  @ApiOperation({ summary: 'Create or update a reagent inventory item' })
  async upsertReagentInventory(
    @Body()
    body: {
      id?: string;
      reagent_name: string;
      analyzer_name?: string;
      lot_number?: string;
      quantity_available?: number;
      unit?: string;
      minimum_threshold?: number;
      expires_on?: string;
      status?: 'ok' | 'warning' | 'critical' | 'expired';
      notes?: string;
    },
    @Request() req: RequestWithTenant,
  ) {
    const userId = (req.user as any)?.userId ?? (req.user as any)?.id;
    return this.labOrderService.upsertReagentInventoryItem(req.tenantDb, body, userId);
  }

  @Get('kits/stock')
  @ApiOperation({ summary: 'Get test kit stock levels at the LAB location' })
  async getKitStock(@Request() req: RequestWithTenant) {
    return this.labOrderService.getKitStockAtLab(req.tenantDb);
  }

  @Patch('inventory/reagents/:id/quantity')
  @ApiOperation({ summary: 'Update reagent quantity' })
  async updateReagentQuantity(
    @Param('id') id: string,
    @Body() body: { quantity_available: number; status?: 'ok' | 'warning' | 'critical' | 'expired' },
    @Request() req: RequestWithTenant,
  ) {
    const userId = (req.user as any)?.userId ?? (req.user as any)?.id;
    return this.labOrderService.updateReagentInventoryQuantity(req.tenantDb, id, body, userId);
  }
}