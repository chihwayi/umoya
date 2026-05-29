import {
  Controller, Get, Post, Patch, Body, Param, Query,
  Req, UseGuards, Optional,
} from '@nestjs/common';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { Roles } from '../decorators/roles.decorator';
import { RolesGuard } from '../guards/roles.guard';
import { UserRole } from '../entities/user.entity';
import { StoreroomService } from '../services/storeroom.service';
import { StoreroomIntelligenceService } from '../services/storeroom-intelligence.service';
import {
  CreateLocationDto, UpdateLocationDto, CreateCatalogItemDto,
  StockAdjustmentDto, ReceiveStockDto, CreateStockRequestDto,
  ApproveRequestDto, CreateTransferDto, ReceiveTransferItemDto,
} from '../services/storeroom.dto';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('storeroom')
export class StoreroomController {
  constructor(
    private readonly svc: StoreroomService,
    @Optional() private readonly intelligence: StoreroomIntelligenceService,
  ) {}

  @Get('dashboard')
  dashboard(@Req() req: any) {
    return this.svc.getDashboardStats(req.tenantDb);
  }

  // ── Locations ──────────────────────────────────────────────────────────────
  @Get('locations')
  listLocations(@Req() req: any) {
    return this.svc.listLocations(req.tenantDb);
  }

  @Post('locations')
  @Roles(UserRole.STORE_MANAGER, UserRole.ADMIN)
  createLocation(@Req() req: any, @Body() dto: CreateLocationDto) {
    return this.svc.createLocation(req.tenantDb, dto);
  }

  @Patch('locations/:id')
  @Roles(UserRole.STORE_MANAGER, UserRole.ADMIN)
  updateLocation(@Req() req: any, @Param('id') id: string, @Body() dto: UpdateLocationDto) {
    return this.svc.updateLocation(req.tenantDb, id, dto);
  }

  // ── Catalog ────────────────────────────────────────────────────────────────
  @Get('catalog')
  listCatalog(
    @Req() req: any,
    @Query('category') category?: string,
    @Query('search') search?: string,
  ) {
    return this.svc.listCatalog(req.tenantDb, { category, search });
  }

  @Post('catalog')
  @Roles(UserRole.STORE_MANAGER, UserRole.ADMIN)
  createCatalogItem(@Req() req: any, @Body() dto: CreateCatalogItemDto) {
    return this.svc.createCatalogItem(req.tenantDb, dto);
  }

  @Patch('catalog/:id')
  @Roles(UserRole.STORE_MANAGER, UserRole.ADMIN)
  updateCatalogItem(@Req() req: any, @Param('id') id: string, @Body() dto: Partial<CreateCatalogItemDto>) {
    return this.svc.updateCatalogItem(req.tenantDb, id, dto);
  }

  // ── Stock ──────────────────────────────────────────────────────────────────
  @Get('stock')
  getStock(
    @Req() req: any,
    @Query('locationId') locationId?: string,
    @Query('category') category?: string,
    @Query('lowStockOnly') lowStockOnly?: string,
  ) {
    if (locationId) {
      return this.svc.getStockByLocation(req.tenantDb, locationId, {
        category,
        lowStockOnly: lowStockOnly === 'true',
      });
    }
    return this.svc.listLocations(req.tenantDb);
  }

  @Get('stock/item/:catalogId')
  getStockByItem(@Req() req: any, @Param('catalogId') catalogId: string) {
    return this.svc.getStockByItem(req.tenantDb, catalogId);
  }

  @Get('stock/alerts')
  getAlerts(@Req() req: any) {
    return this.svc.getLowStockAlerts(req.tenantDb);
  }

  @Post('stock/adjust')
  @Roles(UserRole.STORE_MANAGER, UserRole.ADMIN)
  adjustStock(@Req() req: any, @Body() dto: StockAdjustmentDto) {
    return this.svc.adjustStock(req.tenantDb, dto, req.user.id);
  }

  @Post('stock/receive')
  @Roles(UserRole.STORE_MANAGER, UserRole.ADMIN)
  receiveStock(@Req() req: any, @Body() dto: ReceiveStockDto) {
    return this.svc.recordSupplierReceipt(req.tenantDb, dto, req.user.id);
  }

  // ── Requests ───────────────────────────────────────────────────────────────
  @Get('requests')
  listRequests(
    @Req() req: any,
    @Query('status') status?: string,
    @Query('locationId') locationId?: string,
  ) {
    return this.svc.listStockRequests(req.tenantDb, { status, locationId });
  }

  @Post('requests')
  createRequest(@Req() req: any, @Body() dto: CreateStockRequestDto) {
    return this.svc.createStockRequest(req.tenantDb, dto, req.user.id);
  }

  @Patch('requests/:id/approve')
  @Roles(UserRole.STORE_MANAGER, UserRole.ADMIN)
  approveRequest(
    @Req() req: any,
    @Param('id') id: string,
    @Body() dto: ApproveRequestDto,
  ) {
    return this.svc.approveStockRequest(req.tenantDb, id, dto, req.user.id);
  }

  @Patch('requests/:id/reject')
  @Roles(UserRole.STORE_MANAGER, UserRole.ADMIN)
  rejectRequest(
    @Req() req: any,
    @Param('id') id: string,
    @Body() body: { reason: string },
  ) {
    return this.svc.rejectStockRequest(req.tenantDb, id, body.reason, req.user.id);
  }

  // ── Transfers ──────────────────────────────────────────────────────────────
  @Get('transfers')
  listTransfers(
    @Req() req: any,
    @Query('status') status?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.svc.listTransfers(req.tenantDb, { status, from, to });
  }

  @Post('transfers')
  @Roles(UserRole.STORE_MANAGER, UserRole.ADMIN)
  createTransfer(@Req() req: any, @Body() dto: CreateTransferDto) {
    return this.svc.createTransfer(req.tenantDb, dto, req.user.id);
  }

  @Patch('transfers/:id/receive')
  receiveTransfer(
    @Req() req: any,
    @Param('id') id: string,
    @Body() body: { items: ReceiveTransferItemDto[] },
  ) {
    return this.svc.receiveTransfer(req.tenantDb, id, body.items, req.user.id);
  }

  // ── Consumption ────────────────────────────────────────────────────────────
  @Get('consumption')
  getConsumption(
    @Req() req: any,
    @Query('locationId') locationId?: string,
    @Query('catalogId') catalogId?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('groupBy') groupBy?: 'day' | 'week' | 'month',
  ) {
    return this.svc.getConsumptionSummary(req.tenantDb, {
      locationId, catalogId,
      from: from ? new Date(from) : undefined,
      to: to ? new Date(to) : undefined,
      groupBy,
    });
  }

  // ── Intelligence ───────────────────────────────────────────────────────────
  @Post('intelligence/forecast')
  @Roles(UserRole.STORE_MANAGER, UserRole.ADMIN, UserRole.PHARMACIST)
  forecastDemand(
    @Req() req: any,
    @Body() body: { location_id: string; catalog_id: string; horizon_days?: number; force_refresh?: boolean },
  ) {
    if (!this.intelligence) return { error: 'AI intelligence not available' };
    return this.intelligence.forecastDemand(
      req.tenantDb, body.location_id, body.catalog_id,
      body.horizon_days ?? 30, body.force_refresh ?? false,
    );
  }

  @Get('intelligence/anomalies')
  @Roles(UserRole.STORE_MANAGER, UserRole.ADMIN)
  detectAnomalies(@Req() req: any) {
    if (!this.intelligence) return [];
    return this.intelligence.detectAnomalies(req.tenantDb);
  }

  @Get('intelligence/reorder-suggestions')
  @Roles(UserRole.STORE_MANAGER, UserRole.ADMIN)
  reorderSuggestions(@Req() req: any) {
    if (!this.intelligence) return [];
    return this.intelligence.getReorderSuggestions(req.tenantDb);
  }

  @Get('expiry-alerts')
  @Roles(UserRole.STORE_MANAGER, UserRole.ADMIN, UserRole.PHARMACIST, UserRole.NURSE)
  getExpiryAlerts(@Req() req: any, @Query('within_days') withinDays?: string, @Query('location_id') locationId?: string) {
    const days = withinDays ? parseInt(withinDays, 10) : 30;
    return this.svc.getExpiringBatches(req.tenantDb, locationId ?? null, days);
  }

  @Get('fefo-batches')
  @Roles(UserRole.STORE_MANAGER, UserRole.ADMIN, UserRole.PHARMACIST)
  getFEFOBatches(@Req() req: any, @Query('location_id') locationId: string, @Query('catalog_id') catalogId: string) {
    return this.svc.getFEFOBatches(req.tenantDb, locationId, catalogId);
  }

  @Patch('catalog/:id/cold-chain')
  @Roles(UserRole.STORE_MANAGER, UserRole.ADMIN)
  async patchColdChain(
    @Req() req: any,
    @Param('id') id: string,
    @Body() body: { requires_refrigeration: boolean; cold_chain_notes?: string },
  ) {
    await this.svc.markColdChain(req.tenantDb, id, body.requires_refrigeration, body.cold_chain_notes);
    return { success: true };
  }

  @Get('intelligence/expiry-risk')
  @Roles(UserRole.STORE_MANAGER, UserRole.ADMIN)
  getExpiryRisk(@Req() req: any) {
    if (!this.intelligence) return { error: 'AI intelligence not available' };
    return this.intelligence.getExpiryRiskReport(req.tenantDb);
  }

  @Get('emergency-kit/:locationId')
  @Roles(UserRole.STORE_MANAGER, UserRole.ADMIN, UserRole.NURSE, UserRole.DOCTOR)
  getEmergencyKitStatus(@Req() req: any, @Param('locationId') locationId: string) {
    return this.svc.getEmergencyKitStatus(req.tenantDb, locationId);
  }

  @Get('arv-patient-load')
  @Roles(UserRole.STORE_MANAGER, UserRole.ADMIN, UserRole.PHARMACIST)
  getArvLoad(@Req() req: any) {
    return this.svc.getArvStockVsPatientLoad(req.tenantDb);
  }

  @Post('chemo-ingredients/check')
  @Roles(UserRole.STORE_MANAGER, UserRole.ADMIN, UserRole.DOCTOR)
  checkChemoIngredients(
    @Req() req: any,
    @Body() body: { regimen_id: string; location_id: string },
  ) {
    return this.svc.checkChemoIngredients(req.tenantDb, body.regimen_id, body.location_id);
  }

  @Get('suppliers')
  @Roles(UserRole.STORE_MANAGER, UserRole.ADMIN)
  async listSuppliers(@Req() req: any) {
    const { rows } = await req.tenantDb.query(`SELECT * FROM storeroom_suppliers WHERE is_active = true ORDER BY name`);
    return rows;
  }

  @Post('suppliers')
  @Roles(UserRole.STORE_MANAGER, UserRole.ADMIN)
  async createSupplier(@Req() req: any, @Body() body: any) {
    const { rows } = await req.tenantDb.query(
      `INSERT INTO storeroom_suppliers (name, contact_person, email, phone, address, lead_time_days)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [body.name, body.contact_person ?? null, body.email ?? null, body.phone ?? null, body.address ?? null, body.lead_time_days ?? 7],
    );
    return rows[0];
  }

  @Get('purchase-orders')
  @Roles(UserRole.STORE_MANAGER, UserRole.ADMIN)
  async listPOs(@Req() req: any, @Query('status') status?: string) {
    const params: any[] = [];
    const where = status ? `WHERE po.status = $1` : '';
    if (status) params.push(status);
    const { rows } = await req.tenantDb.query(
      `SELECT po.*, s.name AS supplier_name,
              (SELECT COUNT(*) FROM storeroom_po_items WHERE po_id = po.id) AS item_count
         FROM storeroom_purchase_orders po
         JOIN storeroom_suppliers s ON s.id = po.supplier_id
         ${where}
        ORDER BY po.created_at DESC`,
      params,
    );
    return rows;
  }

  @Post('purchase-orders')
  @Roles(UserRole.STORE_MANAGER, UserRole.ADMIN)
  async createPO(@Req() req: any, @Body() body: { supplier_id: string; items: any[] }) {
    const id = await this.svc.createPurchaseOrder(req.tenantDb, body.supplier_id, body.items, req.user?.id ?? 'system');
    return { id };
  }

  @Patch('purchase-orders/:id/submit')
  @Roles(UserRole.STORE_MANAGER, UserRole.ADMIN)
  async submitPO(@Req() req: any, @Param('id') id: string) {
    await this.svc.submitPurchaseOrder(req.tenantDb, id);
    return { success: true };
  }

  @Post('purchase-orders/:id/receive')
  @Roles(UserRole.STORE_MANAGER, UserRole.ADMIN)
  async receivePO(@Req() req: any, @Param('id') id: string, @Body() body: { items: any[] }) {
    await this.svc.receivePOItems(req.tenantDb, id, body.items, req.user?.id ?? 'system');
    return { success: true };
  }

  @Post('purchase-orders/auto-generate')
  @Roles(UserRole.STORE_MANAGER, UserRole.ADMIN)
  async autoGeneratePOs(@Req() req: any) {
    const count = await this.svc.autoGeneratePOs(req.tenantDb);
    return { created: count };
  }

  @Post('substitutions')
  @Roles(UserRole.DOCTOR, UserRole.PHARMACIST, UserRole.STORE_MANAGER, UserRole.ADMIN)
  async getSubstitutions(
    @Req() req: any,
    @Body() body: { catalog_id: string; quantity: number; location_id: string },
  ) {
    if (!this.intelligence) {
      return this.svc.findTherapeuticEquivalents(req.tenantDb, body.catalog_id, body.quantity, body.location_id);
    }
    return this.intelligence.suggestSubstitutions(req.tenantDb, body.catalog_id, body.quantity, body.location_id);
  }
}
