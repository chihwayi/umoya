import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiSecurity } from '@nestjs/swagger';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { PharmacyService } from '../services/pharmacy.service';
import { PharmacyIntelligenceService } from '../services/pharmacy-intelligence.service';
import { RequestWithTenant } from '../middleware/tenant.middleware';
import {
  CreateSupplierDto,
  UpdateSupplierDto,
  CreateInventoryDto,
  UpdateInventoryDto,
  CreatePurchaseOrderDto,
  UpdatePurchaseOrderDto,
  CreateReceiptDto,
  CreateDispensingDto,
  CreateReturnDto,
  CreateStockAdjustmentDto,
  CreatePricingRuleDto,
  UpdatePricingRuleDto,
  CreateFormularyDto,
  UpdateFormularyDto,
} from '../dto/pharmacy.dto';
import { PaginationQueryDto } from 'src/dto/diabetes.dto';

@ApiTags('Pharmacy Management')
@ApiSecurity('tenant-key')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('pharmacy')
export class PharmacyController {
  constructor(
    private pharmacyService: PharmacyService,
    private pharmacyIntelligenceService: PharmacyIntelligenceService,
  ) {}

  // ============================================
  // SUPPLIER ENDPOINTS
  // ============================================

  @Get('suppliers')
  @ApiOperation({ summary: 'List suppliers' })
  async listSuppliers(@Query() query: { page?: number; limit?: number; search?: string; status?: string }, @Request() req: RequestWithTenant) {
    return this.pharmacyService.listSuppliers(req.tenantDb, query);
  }

  @Post('suppliers')
  @ApiOperation({ summary: 'Create supplier' })
  async createSupplier(@Body() dto: CreateSupplierDto, @Request() req: RequestWithTenant) {
    return this.pharmacyService.createSupplier(req.tenantDb, dto);
  }

  @Get('suppliers/:id')
  @ApiOperation({ summary: 'Get supplier' })
  async getSupplier(@Param('id') id: string, @Request() req: RequestWithTenant) {
    return this.pharmacyService.getSupplier(req.tenantDb, id);
  }

  @Put('suppliers/:id')
  @ApiOperation({ summary: 'Update supplier' })
  async updateSupplier(@Param('id') id: string, @Body() dto: UpdateSupplierDto, @Request() req: RequestWithTenant) {
    return this.pharmacyService.updateSupplier(req.tenantDb, id, dto);
  }

  @Delete('suppliers/:id')
  @ApiOperation({ summary: 'Delete supplier' })
  async deleteSupplier(@Param('id') id: string, @Request() req: RequestWithTenant) {
    return this.pharmacyService.deleteSupplier(req.tenantDb, id);
  }

  @Get('suppliers/:id/statistics')
  @ApiOperation({ summary: 'Get supplier statistics' })
  async getSupplierStatistics(@Param('id') id: string, @Request() req: RequestWithTenant) {
    return this.pharmacyService.getSupplierStatistics(req.tenantDb, id);
  }

  // ============================================
  // INVENTORY ENDPOINTS
  // ============================================

  @Get('inventory')
  @ApiOperation({ summary: 'List inventory items' })
  async listInventory(@Query() query: { page?: number; limit?: number; search?: string; status?: string; lowStock?: boolean }, @Request() req: RequestWithTenant) {
    return this.pharmacyService.listInventory(req.tenantDb, query);
  }

  @Post('inventory')
  @ApiOperation({ summary: 'Create inventory item' })
  async createInventory(@Body() dto: CreateInventoryDto, @Request() req: RequestWithTenant) {
    return this.pharmacyService.createInventory(req.tenantDb, dto);
  }

  @Get('inventory/:id')
  @ApiOperation({ summary: 'Get inventory item' })
  async getInventory(@Param('id') id: string, @Request() req: RequestWithTenant) {
    return this.pharmacyService.getInventory(req.tenantDb, id);
  }

  @Put('inventory/:id')
  @ApiOperation({ summary: 'Update inventory item' })
  async updateInventory(@Param('id') id: string, @Body() dto: UpdateInventoryDto, @Request() req: RequestWithTenant) {
    return this.pharmacyService.updateInventory(req.tenantDb, id, dto);
  }

  @Get('inventory/low-stock/items')
  @ApiOperation({ summary: 'Get low stock items' })
  async getLowStockItems(@Request() req: RequestWithTenant) {
    return this.pharmacyService.getLowStockItems(req.tenantDb);
  }

  // ============================================
  // PURCHASE ORDER ENDPOINTS
  // ============================================

  @Get('purchase-orders')
  @ApiOperation({ summary: 'List purchase orders' })
  async listPurchaseOrders(@Query() query: PaginationQueryDto & { status?: string; supplierId?: string }, @Request() req: RequestWithTenant) {
    return this.pharmacyService.listPurchaseOrders(req.tenantDb, query);
  }

  @Post('purchase-orders')
  @ApiOperation({ summary: 'Create purchase order' })
  async createPurchaseOrder(@Body() dto: CreatePurchaseOrderDto, @Request() req: RequestWithTenant) {
    return this.pharmacyService.createPurchaseOrder(req.tenantDb, dto, (req.user as any)?.userId ?? (req.user as any)?.id);
  }

  @Get('purchase-orders/:id')
  @ApiOperation({ summary: 'Get purchase order' })
  async getPurchaseOrder(@Param('id') id: string, @Request() req: RequestWithTenant) {
    return this.pharmacyService.getPurchaseOrder(req.tenantDb, id);
  }

  @Put('purchase-orders/:id')
  @ApiOperation({ summary: 'Update purchase order' })
  async updatePurchaseOrder(@Param('id') id: string, @Body() dto: UpdatePurchaseOrderDto, @Request() req: RequestWithTenant) {
    return this.pharmacyService.updatePurchaseOrder(req.tenantDb, id, dto);
  }

  // ============================================
  // RECEIPT ENDPOINTS
  // ============================================

  @Post('receipts')
  @ApiOperation({ summary: 'Create receipt' })
  async createReceipt(@Body() dto: CreateReceiptDto, @Request() req: RequestWithTenant) {
    return this.pharmacyService.createReceipt(req.tenantDb, dto, (req.user as any)?.userId ?? (req.user as any)?.id);
  }

  @Get('receipts')
  @ApiOperation({ summary: 'List receipts' })
  async listReceipts(@Query() query: PaginationQueryDto & { purchaseOrderId?: string; status?: string }, @Request() req: RequestWithTenant) {
    return this.pharmacyService.listReceipts(req.tenantDb, query);
  }

  @Get('receipts/:id')
  @ApiOperation({ summary: 'Get receipt' })
  async getReceipt(@Param('id') id: string, @Request() req: RequestWithTenant) {
    return this.pharmacyService.getReceipt(req.tenantDb, id);
  }

  // ============================================
  // DISPENSING ENDPOINTS
  // ============================================

  @Post('dispensings')
  @ApiOperation({ summary: 'Create dispensing' })
  async createDispensing(@Body() dto: CreateDispensingDto, @Request() req: RequestWithTenant) {
    return this.pharmacyService.createDispensing(req.tenantDb, dto, (req.user as any)?.userId ?? (req.user as any)?.id);
  }

  @Post('intelligence/reconciliation-review')
  @ApiOperation({ summary: 'Generate AI medication reconciliation, substitution, and counseling review' })
  async generateMedicationReview(
    @Body()
    body: {
      patientId: string;
      encounterId?: string;
      language?: string;
      readingLevel?: number;
      reportedMedications?: Array<Record<string, any>>;
    },
    @Request() req: RequestWithTenant,
  ) {
    const actorUserId = (req.user as any)?.userId ?? (req.user as any)?.id ?? null;
    return this.pharmacyIntelligenceService.generateMedicationReview(
      req.tenantId,
      req.tenantDb!,
      body,
      actorUserId,
    );
  }

  @Get('intelligence/reconciliation-review/:id')
  @ApiOperation({ summary: 'Get persisted AI medication reconciliation review with substitution recommendations' })
  async getMedicationReview(@Param('id') id: string, @Request() req: RequestWithTenant) {
    return this.pharmacyIntelligenceService.getReviewById(req.tenantDb!, id);
  }

  @Post('intelligence/dispense-plan')
  @ApiOperation({ summary: 'Prepare governed dispense-plan intelligence for a prescription' })
  async prepareDispensePlan(
    @Body() body: { prescriptionId: string },
    @Request() req: RequestWithTenant,
  ) {
    const actorUserId = (req.user as any)?.userId ?? (req.user as any)?.id ?? null;
    return this.pharmacyIntelligenceService.prepareDispensePlan(
      req.tenantId,
      req.tenantDb!,
      body.prescriptionId,
      actorUserId,
    );
  }

  @Post('intelligence/inventory-forecast')
  @ApiOperation({ summary: 'Generate persisted inventory shortage forecasts and reorder guidance' })
  async generateInventoryForecasts(
    @Body() body: { horizonDays?: number; lookbackDays?: number; inventoryIds?: string[] },
    @Request() req: RequestWithTenant,
  ) {
    const actorUserId = (req.user as any)?.userId ?? (req.user as any)?.id ?? null;
    return this.pharmacyIntelligenceService.generateInventoryForecasts(
      req.tenantDb!,
      body,
      actorUserId,
    );
  }

  @Get('intelligence/inventory-forecast')
  @ApiOperation({ summary: 'List persisted inventory forecasts' })
  async listInventoryForecasts(
    @Query() query: { shortageRisk?: string; limit?: number },
    @Request() req: RequestWithTenant,
  ) {
    return this.pharmacyIntelligenceService.listInventoryForecasts(req.tenantDb!, query);
  }

  @Post('intelligence/dispensing-anomalies')
  @ApiOperation({ summary: 'Detect and persist dispensing anomalies for pharmacist review' })
  async detectDispensingAnomalies(
    @Body() body: { lookbackDays?: number; limit?: number },
    @Request() req: RequestWithTenant,
  ) {
    return this.pharmacyIntelligenceService.detectDispensingAnomalies(req.tenantDb!, body);
  }

  @Get('intelligence/dispensing-anomalies')
  @ApiOperation({ summary: 'List persisted dispensing anomalies' })
  async listDispensingAnomalies(
    @Query() query: { status?: string; severity?: string; limit?: number },
    @Request() req: RequestWithTenant,
  ) {
    return this.pharmacyIntelligenceService.listDispensingAnomalies(req.tenantDb!, query);
  }

  @Post('intelligence/high-risk-review')
  @ApiOperation({ summary: 'Generate high-risk medication review and antimicrobial stewardship output' })
  async generateHighRiskMedicationReview(
    @Body()
    body: {
      patientId?: string;
      prescriptionId?: string;
      medications?: Array<Record<string, any>>;
      patientAge?: number;
      patientGender?: string;
      diagnoses?: string[];
      renalFunction?: number;
      route?: string;
      indication?: string;
      cultureSent?: boolean;
      cultureSource?: string;
      cultureResult?: string;
      organismIdentified?: string;
      sensitivityProfile?: Record<string, any>;
      plannedDurationDays?: number;
      startDate?: string;
    },
    @Request() req: RequestWithTenant,
  ) {
    const actorUserId = (req.user as any)?.userId ?? (req.user as any)?.id ?? null;
    return this.pharmacyIntelligenceService.generateHighRiskMedicationReview(
      req.tenantDb!,
      body,
      actorUserId,
    );
  }

  @Get('intelligence/stewardship')
  @ApiOperation({ summary: 'List persisted antimicrobial stewardship reviews generated from pharmacy intelligence' })
  async listStewardshipReviews(
    @Query() query: { patientId?: string; reviewRequired?: boolean; limit?: number },
    @Request() req: RequestWithTenant,
  ) {
    return this.pharmacyIntelligenceService.listStewardshipReviews(req.tenantDb!, query);
  }

  @Get('dispensings/:id')
  @ApiOperation({ summary: 'Get dispensing' })
  async getDispensing(@Param('id') id: string, @Request() req: RequestWithTenant) {
    return this.pharmacyService.getDispensing(req.tenantDb, id);
  }

  @Put('dispensings/:id')
  @ApiOperation({ summary: 'Update dispensing' })
  async updateDispensing(@Param('id') id: string, @Body() dto: CreateDispensingDto, @Request() req: RequestWithTenant) {
    return this.pharmacyService.updateDispensing(req.tenantDb, id, dto);
  }

  // ============================================
  // RETURN ENDPOINTS
  // ============================================

  @Post('returns')
  @ApiOperation({ summary: 'Create return' })
  async createReturn(@Body() dto: CreateReturnDto, @Request() req: RequestWithTenant) {
    return this.pharmacyService.createReturn(req.tenantDb, dto, (req.user as any)?.userId ?? (req.user as any)?.id);
  }

  @Get('returns/:id')
  @ApiOperation({ summary: 'Get return' })
  async getReturn(@Param('id') id: string, @Request() req: RequestWithTenant) {
    return this.pharmacyService.getReturn(req.tenantDb, id);
  }

  // ============================================
  // STOCK ADJUSTMENT ENDPOINTS
  // ============================================

  @Post('stock-adjustments')
  @ApiOperation({ summary: 'Create stock adjustment' })
  async createStockAdjustment(@Body() dto: CreateStockAdjustmentDto, @Request() req: RequestWithTenant) {
    return this.pharmacyService.createStockAdjustment(req.tenantDb, dto, (req.user as any)?.userId ?? (req.user as any)?.id);
  }

  @Get('stock-adjustments/:id')
  @ApiOperation({ summary: 'Get stock adjustment' })
  async getStockAdjustment(@Param('id') id: string, @Request() req: RequestWithTenant) {
    return this.pharmacyService.getStockAdjustment(req.tenantDb, id);
  }

  // ============================================
  // PRICING RULE ENDPOINTS
  // ============================================

  @Get('pricing-rules')
  @ApiOperation({ summary: 'List pricing rules' })
  async listPricingRules(@Query() query: PaginationQueryDto & { active?: boolean }, @Request() req: RequestWithTenant) {
    return this.pharmacyService.listPricingRules(req.tenantDb, query);
  }

  @Post('pricing-rules')
  @ApiOperation({ summary: 'Create pricing rule' })
  async createPricingRule(@Body() dto: CreatePricingRuleDto, @Request() req: RequestWithTenant) {
    return this.pharmacyService.createPricingRule(req.tenantDb, dto);
  }

  @Put('pricing-rules/:id')
  @ApiOperation({ summary: 'Update pricing rule' })
  async updatePricingRule(@Param('id') id: string, @Body() dto: UpdatePricingRuleDto, @Request() req: RequestWithTenant) {
    return this.pharmacyService.updatePricingRule(req.tenantDb, id, dto);
  }

  // ============================================
  // FORMULARY ENDPOINTS
  // ============================================

  @Get('formulary')
  @ApiOperation({ summary: 'List formulary items' })
  async listFormulary(@Query() query: PaginationQueryDto & { search?: string; category?: string }, @Request() req: RequestWithTenant) {
    return this.pharmacyService.listFormulary(req.tenantDb, query);
  }

  @Post('formulary')
  @ApiOperation({ summary: 'Create formulary item' })
  async createFormulary(@Body() dto: CreateFormularyDto, @Request() req: RequestWithTenant) {
    return this.pharmacyService.createFormulary(req.tenantDb, dto);
  }

  @Put('formulary/:id')
  @ApiOperation({ summary: 'Update formulary item' })
  async updateFormulary(@Param('id') id: string, @Body() dto: UpdateFormularyDto, @Request() req: RequestWithTenant) {
    return this.pharmacyService.updateFormulary(req.tenantDb, id, dto);
  }

  // ============================================
  // ALERT ENDPOINTS
  // ============================================

  @Get('alerts')
  @ApiOperation({ summary: 'List alerts' })
  async listAlerts(@Query() query: PaginationQueryDto & { type?: string; severity?: string; resolved?: boolean }, @Request() req: RequestWithTenant) {
    return this.pharmacyService.listAlerts(req.tenantDb, query);
  }

  @Post('alerts')
  @ApiOperation({ summary: 'Create alert' })
  async createAlert(@Body() dto: any, @Request() req: RequestWithTenant) {
    return this.pharmacyService.createAlert(req.tenantDb, dto);
  }

  @Put('alerts/:id')
  @ApiOperation({ summary: 'Update alert' })
  async updateAlert(@Param('id') id: string, @Body() dto: any, @Request() req: RequestWithTenant) {
    return this.pharmacyService.updateAlert(req.tenantDb, id, dto, (req.user as any)?.userId ?? (req.user as any)?.id);
  }

  // ============================================
  // PRESCRIPTION INTEGRATION ENDPOINTS
  // ============================================

  @Get('prescriptions/pending')
  @ApiOperation({ summary: 'Get pending prescriptions' })
  async getPendingPrescriptions(@Query() query: { patientId?: string; limit?: number; offset?: number }, @Request() req: RequestWithTenant) {
    return this.pharmacyService.getPendingPrescriptions(req.tenantDb, query);
  }

  @Get('prescriptions/:id/stock-check')
  @ApiOperation({ summary: 'Check stock availability for a prescription' })
  async checkPrescriptionStock(@Param('id') id: string, @Request() req: RequestWithTenant) {
    return this.pharmacyService.checkPrescriptionStockAvailability(req.tenantDb, id);
  }

  @Post('prescriptions/:id/dispense')
  @ApiOperation({ summary: 'Dispense a prescription' })
  async dispensePrescription(
    @Param('id') id: string,
    @Body() dto: CreateDispensingDto,
    @Request() req: RequestWithTenant,
  ) {
    return this.pharmacyService.dispensePrescription(req.tenantDb, id, dto, (req.user as any)?.userId ?? (req.user as any)?.id);
  }

  @Post('dispensings/:id/payment')
  @ApiOperation({ summary: 'Process payment for a dispensing' })
  async processDispensingPayment(
    @Param('id') id: string,
    @Body() dto: { amount: number; method: string; reference?: string },
    @Request() req: RequestWithTenant,
  ) {
    return this.pharmacyService.processDispensingPayment(req.tenantDb, id, dto, (req.user as any)?.userId ?? (req.user as any)?.id);
  }
}
