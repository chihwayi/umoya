import { Injectable, Logger, NotFoundException, BadRequestException, Inject, Optional, forwardRef } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { BillingService } from './billing.service';
import { StoreroomService } from './storeroom.service';
import {
  CreateSupplierDto,
  UpdateSupplierDto,
  CreateInventoryDto,
  UpdateInventoryDto,
  CreatePurchaseOrderDto,
  CreatePurchaseOrderItemDto,
  UpdatePurchaseOrderDto,
  CreateReceiptDto,
  CreateReceiptItemDto,
  CreateDispensingDto,
  CreateDispensingItemDto,
  UpdateDispensingDto,
  CreateReturnDto,
  CreateReturnItemDto,
  CreateStockAdjustmentDto,
  CreateStockAdjustmentItemDto,
  CreatePricingRuleDto,
  UpdatePricingRuleDto,
  CreateFormularyDto,
  UpdateFormularyDto,
  CreateAlertDto,
  UpdateAlertDto,
} from '../dto/pharmacy.dto';
import { PaginationQueryDto } from '../dto/diabetes.dto';

@Injectable()
export class PharmacyService {
  private readonly logger = new Logger(PharmacyService.name);

  constructor(
    @Inject(forwardRef(() => BillingService))
    private readonly billingService: BillingService,
    @Optional() private readonly storeroomService: StoreroomService,
  ) {}

  private async getPharmacyLocationId(tenantDb: any): Promise<string | null> {
    if (!this.storeroomService) return null;
    const [row] = await tenantDb.query(
      `SELECT id FROM inventory_locations WHERE code = 'PHARMACY' AND is_active = true LIMIT 1`,
    );
    return row?.id ?? null;
  }

  private ensureTenantDb(tenantDb: DataSource) {
    if (!tenantDb) {
      throw new BadRequestException('Tenant database connection unavailable');
    }
  }

  private camelToSnake(value: string): string {
    return value.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
  }

  // ============================================
  // SUPPLIER METHODS
  // ============================================

  async listSuppliers(tenantDb: DataSource, filters: PaginationQueryDto & { search?: string; status?: string }) {
    this.ensureTenantDb(tenantDb);
    const where: string[] = [];
    const params: any[] = [];

    if (filters.search) {
      where.push(`(name ILIKE $${params.length + 1} OR contact_person ILIKE $${params.length + 1} OR email ILIKE $${params.length + 1})`);
      params.push(`%${filters.search}%`);
    }
    if (filters.status) {
      where.push(`status = $${params.length + 1}`);
      params.push(filters.status);
    }

    const whereClause = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const offset = filters.offset ?? 0;
    const limit = filters.limit ?? 25;
    params.push(limit, offset);

    const suppliers = await tenantDb.query(
      `SELECT * FROM pharmacy_suppliers ${whereClause}
       ORDER BY created_at DESC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params,
    );

    const totalResult = await tenantDb.query(
      `SELECT COUNT(*)::int as count FROM pharmacy_suppliers ${whereClause}`,
      params.slice(0, params.length - 2),
    );

    return { suppliers, total: totalResult[0]?.count ?? suppliers.length };
  }

  async createSupplier(tenantDb: DataSource, dto: CreateSupplierDto) {
    this.ensureTenantDb(tenantDb);
    const result = await tenantDb.query(
      `INSERT INTO pharmacy_suppliers (
        name, contact_person, email, phone, address, city, country,
        payment_terms, tax_id, notes, status, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, COALESCE($11, 'active'), NOW(), NOW())
      RETURNING *`,
      [
        dto.name,
        dto.contactPerson ?? null,
        dto.email ?? null,
        dto.phone ?? null,
        dto.address ?? null,
        dto.city ?? null,
        dto.country ?? null,
        dto.paymentTerms ?? null,
        dto.taxId ?? null,
        dto.notes ?? null,
        dto.status ?? 'active',
      ],
    );
    return result[0];
  }

  async getSupplier(tenantDb: DataSource, id: string) {
    this.ensureTenantDb(tenantDb);
    const [supplier] = await tenantDb.query(
      'SELECT * FROM pharmacy_suppliers WHERE id = $1',
      [id],
    );
    if (!supplier) {
      throw new NotFoundException(`Supplier ${id} not found`);
    }
    return supplier;
  }

  async updateSupplier(tenantDb: DataSource, id: string, dto: UpdateSupplierDto) {
    this.ensureTenantDb(tenantDb);
    const updates: string[] = [];
    const params: any[] = [];
    const fields: Array<keyof UpdateSupplierDto> = [
      'name', 'contactPerson', 'email', 'phone', 'address', 'city', 'country',
      'paymentTerms', 'taxId', 'notes', 'status',
    ];
    fields.forEach((field) => {
      if (dto[field] !== undefined) {
        updates.push(`${this.camelToSnake(field as string)} = $${params.length + 1}`);
        params.push(dto[field]);
      }
    });
    if (!updates.length) {
      throw new BadRequestException('No fields provided for update');
    }
    params.push(id);
    const result = await tenantDb.query(
      `UPDATE pharmacy_suppliers SET ${updates.join(', ')}, updated_at = NOW() WHERE id = $${params.length} RETURNING *`,
      params,
    );
    if (!result.length) {
      throw new NotFoundException(`Supplier ${id} not found`);
    }
    return result[0];
  }

  async deleteSupplier(tenantDb: DataSource, id: string) {
    this.ensureTenantDb(tenantDb);
    const result = await tenantDb.query(
      'DELETE FROM pharmacy_suppliers WHERE id = $1 RETURNING id',
      [id],
    );
    if (!result.length) {
      throw new NotFoundException(`Supplier ${id} not found`);
    }
    return { id: result[0].id };
  }

  async getSupplierStatistics(tenantDb: DataSource, supplierId: string) {
    this.ensureTenantDb(tenantDb);
    
    // Verify supplier exists
    const [supplier] = await tenantDb.query(
      'SELECT id FROM pharmacy_suppliers WHERE id = $1',
      [supplierId],
    );
    if (!supplier) {
      throw new NotFoundException(`Supplier ${supplierId} not found`);
    }
    
    // Get purchase orders for this supplier with calculated totals
    const [poStats] = await tenantDb.query(
      `SELECT 
        COUNT(DISTINCT po.id)::int as total_orders,
        COUNT(DISTINCT CASE WHEN po.status = 'ordered' THEN po.id END)::int as pending_orders,
        COUNT(DISTINCT CASE WHEN po.status = 'received' THEN po.id END)::int as completed_orders,
        COALESCE(SUM(poi.expected_total_cost), 0)::numeric as total_spent,
        COALESCE(AVG(order_totals.total), 0)::numeric as avg_order_value,
        MAX(po.order_date) as last_order_date
       FROM pharmacy_purchase_orders po
       LEFT JOIN pharmacy_purchase_order_items poi ON poi.purchase_order_id = po.id
       LEFT JOIN (
         SELECT purchase_order_id, SUM(expected_total_cost) as total
         FROM pharmacy_purchase_order_items
         GROUP BY purchase_order_id
       ) order_totals ON order_totals.purchase_order_id = po.id
       WHERE po.supplier_id = $1`,
      [supplierId],
    );

    // Get recent purchase orders with calculated totals
    const recentOrders = await tenantDb.query(
      `SELECT 
        po.id, 
        po.order_number, 
        po.order_date, 
        po.status,
        COALESCE(SUM(poi.expected_total_cost), 0)::numeric as total_amount
       FROM pharmacy_purchase_orders po
       LEFT JOIN pharmacy_purchase_order_items poi ON poi.purchase_order_id = po.id
       WHERE po.supplier_id = $1
       GROUP BY po.id, po.order_number, po.order_date, po.status
       ORDER BY po.order_date DESC
       LIMIT 5`,
      [supplierId],
    );

    return {
      total_orders: poStats?.total_orders || 0,
      pending_orders: poStats?.pending_orders || 0,
      completed_orders: poStats?.completed_orders || 0,
      total_spent: poStats?.total_spent || 0,
      avg_order_value: poStats?.avg_order_value || 0,
      last_order_date: poStats?.last_order_date || null,
      recentOrders: recentOrders || [],
    };
  }

  // ============================================
  // INVENTORY METHODS
  // ============================================

  async listInventory(tenantDb: DataSource, filters: { offset?: number; limit?: number; search?: string; status?: string; lowStock?: boolean }) {
    this.ensureTenantDb(tenantDb);
    const where: string[] = [];
    const params: any[] = [];

    if (filters.search) {
      where.push(`(pi.name ILIKE $${params.length + 1} OR pi.generic_name ILIKE $${params.length + 1} OR pi.sku ILIKE $${params.length + 1} OR d.generic_name ILIKE $${params.length + 1})`);
      params.push(`%${filters.search}%`);
    }
    if (filters.status) {
      where.push(`pi.status = $${params.length + 1}`);
      params.push(filters.status);
    }
    if (filters.lowStock) {
      where.push(`pi.quantity_on_hand <= pi.reorder_level`);
    }

    const whereClause = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const offset = filters.offset ?? 0;
    const limit = filters.limit ?? 25;
    params.push(limit, offset);

    const inventory = await tenantDb.query(
      `SELECT pi.*, d.generic_name as drug_generic_name, d.brand_names as drug_brand_names
       FROM pharmacy_inventory pi
       LEFT JOIN drugs d ON d.id = pi.drug_id
       ${whereClause}
       ORDER BY COALESCE(pi.name, d.generic_name) ASC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params,
    );

    const totalResult = await tenantDb.query(
      `SELECT COUNT(*)::int as count FROM pharmacy_inventory pi LEFT JOIN drugs d ON d.id = pi.drug_id ${whereClause}`,
      params.slice(0, params.length - 2),
    );

    return { inventory, total: totalResult[0]?.count ?? inventory.length };
  }

  async createInventory(tenantDb: DataSource, dto: CreateInventoryDto) {
    this.ensureTenantDb(tenantDb);
    // Get drug name if drug_id provided
    let drugName = null;
    let drugGenericName = null;
    if (dto.drugId) {
      const [drug] = await tenantDb.query('SELECT generic_name, brand_names FROM drugs WHERE id = $1', [dto.drugId]);
      if (drug) {
        drugName = drug.brand_names && drug.brand_names.length > 0 ? drug.brand_names[0] : drug.generic_name;
        drugGenericName = drug.generic_name;
      }
    }
    
    const result = await tenantDb.query(
      `INSERT INTO pharmacy_inventory (
        name, generic_name, drug_id, snomed_code, snomed_term, sku, barcode,
        batch_number, expiry_date, quantity_on_hand, reorder_level, max_stock_level,
        cost_per_unit, selling_price, location, supplier_id, status, notes,
        created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, COALESCE($17, 'active'), $18, NOW(), NOW())
      RETURNING *`,
      [
        drugName ?? dto.rxnormName ?? null,
        drugGenericName ?? null,
        dto.drugId ?? null,
        dto.rxnormCode ?? null,
        dto.rxnormName ?? null,
        null, // sku
        null, // barcode
        dto.batchNumber ?? null,
        dto.expiryDate ?? null,
        dto.quantityOnHand ?? 0,
        dto.reorderLevel ?? 10,
        dto.maximumStockLevel ?? null,
        dto.unitCost ?? null,
        dto.unitPrice ?? null,
        null, // location
        dto.supplierId ?? null,
        dto.status ?? 'active',
        null, // notes
      ],
    );
    return result[0];
  }

  async getInventory(tenantDb: DataSource, id: string) {
    this.ensureTenantDb(tenantDb);
    const [item] = await tenantDb.query(
      'SELECT * FROM pharmacy_inventory WHERE id = $1',
      [id],
    );
    if (!item) {
      throw new NotFoundException(`Inventory item ${id} not found`);
    }
    return item;
  }

  async updateInventory(tenantDb: DataSource, id: string, dto: UpdateInventoryDto) {
    this.ensureTenantDb(tenantDb);
    const updates: string[] = [];
    const params: any[] = [];
    
    // Handle drug_id update - also update name if drug changes
    if (dto.drugId !== undefined) {
      updates.push(`drug_id = $${params.length + 1}`);
      params.push(dto.drugId);
      if (dto.drugId) {
        const [drug] = await tenantDb.query('SELECT generic_name, brand_names FROM drugs WHERE id = $1', [dto.drugId]);
        if (drug) {
          const drugName = drug.brand_names && drug.brand_names.length > 0 ? drug.brand_names[0] : drug.generic_name;
          updates.push(`name = $${params.length + 1}`);
          params.push(drugName);
          updates.push(`generic_name = $${params.length + 1}`);
          params.push(drug.generic_name);
        }
      }
    }
    
    const fields: Array<keyof UpdateInventoryDto> = [
      'rxnormCode', 'rxnormName', 'batchNumber', 'expiryDate', 'manufacturingDate',
      'quantityOnHand', 'unitCost', 'unitPrice', 'reorderLevel', 'reorderQuantity',
      'maximumStockLevel', 'location', 'storageConditions', 'supplierId', 'status',
    ];
    fields.forEach((field) => {
      if (dto[field] !== undefined) {
        updates.push(`${this.camelToSnake(field as string)} = $${params.length + 1}`);
        params.push(dto[field]);
      }
    });
    if (!updates.length) {
      throw new BadRequestException('No fields provided for update');
    }
    params.push(id);
    const result = await tenantDb.query(
      `UPDATE pharmacy_inventory SET ${updates.join(', ')}, updated_at = NOW() WHERE id = $${params.length} RETURNING *`,
      params,
    );
    if (!result.length) {
      throw new NotFoundException(`Inventory item ${id} not found`);
    }
    return result[0];
  }

  async deleteInventory(tenantDb: DataSource, id: string) {
    this.ensureTenantDb(tenantDb);
    const result = await tenantDb.query(
      'DELETE FROM pharmacy_inventory WHERE id = $1 RETURNING id',
      [id],
    );
    if (!result.length) {
      throw new NotFoundException(`Inventory item ${id} not found`);
    }
    return { id: result[0].id };
  }

  async getLowStockItems(tenantDb: DataSource) {
    this.ensureTenantDb(tenantDb);
    return await tenantDb.query(
      `SELECT * FROM pharmacy_inventory
       WHERE quantity_on_hand <= reorder_level AND status = 'active'
       ORDER BY (quantity_on_hand::numeric / NULLIF(reorder_level, 0)) ASC`,
    );
  }

  // ============================================
  // PURCHASE ORDER METHODS
  // ============================================

  async listPurchaseOrders(tenantDb: DataSource, filters: { offset?: number; limit?: number; status?: string; supplierId?: string }) {
    this.ensureTenantDb(tenantDb);
    const where: string[] = [];
    const params: any[] = [];

    if (filters.status) {
      where.push(`po.status = $${params.length + 1}`);
      params.push(filters.status);
    }
    if (filters.supplierId) {
      where.push(`po.supplier_id = $${params.length + 1}`);
      params.push(filters.supplierId);
    }

    const whereClause = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const offset = filters.offset ?? 0;
    const limit = filters.limit ?? 25;
    params.push(limit, offset);

    const orders = await tenantDb.query(
      `SELECT po.*, ps.name as supplier_name
       FROM pharmacy_purchase_orders po
       LEFT JOIN pharmacy_suppliers ps ON ps.id = po.supplier_id
       ${whereClause}
       ORDER BY po.created_at DESC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params,
    );

    const totalResult = await tenantDb.query(
      `SELECT COUNT(*)::int as count FROM pharmacy_purchase_orders po ${whereClause}`,
      params.slice(0, params.length - 2),
    );

    return { orders, total: totalResult[0]?.count ?? orders.length };
  }

  async createPurchaseOrder(tenantDb: DataSource, dto: CreatePurchaseOrderDto, userId?: string) {
    this.ensureTenantDb(tenantDb);
    const queryRunner = tenantDb.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const [order] = await queryRunner.query(
        `INSERT INTO pharmacy_purchase_orders (
          supplier_id, order_date, expected_delivery_date, status, notes,
          created_by, created_at, updated_at
        ) VALUES ($1, $2, $3, COALESCE($4, 'draft'), $5, $6, NOW(), NOW())
        RETURNING *`,
        [
          dto.supplierId,
          dto.orderDate ?? new Date().toISOString(),
          dto.expectedDeliveryDate ?? null,
          dto.status ?? 'draft',
          dto.notes ?? null,
          userId ?? null,
        ],
      );

      if (dto.items && dto.items.length > 0) {
        for (const item of dto.items) {
          await queryRunner.query(
            `INSERT INTO pharmacy_purchase_order_items (
              purchase_order_id, inventory_id, quantity_ordered, unit_cost,
              expected_total_cost, notes, created_at, updated_at
            ) VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())`,
            [
              order.id,
              item.inventoryId || null,
              item.quantityOrdered,
              item.unitCost ?? null,
              item.unitCost ? item.quantityOrdered * item.unitCost : null,
              item.notes ?? null,
            ],
          );
        }
      }

      await queryRunner.commitTransaction();
      return await this.getPurchaseOrder(tenantDb, order.id);
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async getPurchaseOrder(tenantDb: DataSource, id: string) {
    this.ensureTenantDb(tenantDb);
    const [order] = await tenantDb.query(
      `SELECT po.*, ps.name as supplier_name
       FROM pharmacy_purchase_orders po
       LEFT JOIN pharmacy_suppliers ps ON ps.id = po.supplier_id
       WHERE po.id = $1`,
      [id],
    );
    if (!order) {
      throw new NotFoundException(`Purchase order ${id} not found`);
    }
    const items = await tenantDb.query(
      `SELECT poi.*, pi.name as inventory_name, pi.sku
       FROM pharmacy_purchase_order_items poi
       LEFT JOIN pharmacy_inventory pi ON pi.id = poi.inventory_id
       WHERE poi.purchase_order_id = $1
       ORDER BY poi.created_at ASC`,
      [id],
    );
    return { ...order, items };
  }

  async updatePurchaseOrder(tenantDb: DataSource, id: string, dto: UpdatePurchaseOrderDto) {
    this.ensureTenantDb(tenantDb);
    const updates: string[] = [];
    const params: any[] = [];
    const fields: Array<keyof UpdatePurchaseOrderDto> = [
      'supplierId', 'orderDate', 'expectedDeliveryDate', 'status', 'notes',
    ];
    fields.forEach((field) => {
      if (dto[field] !== undefined) {
        updates.push(`${this.camelToSnake(field as string)} = $${params.length + 1}`);
        params.push(dto[field]);
      }
    });
    if (!updates.length) {
      throw new BadRequestException('No fields provided for update');
    }
    params.push(id);
    const result = await tenantDb.query(
      `UPDATE pharmacy_purchase_orders SET ${updates.join(', ')}, updated_at = NOW() WHERE id = $${params.length} RETURNING *`,
      params,
    );
    if (!result.length) {
      throw new NotFoundException(`Purchase order ${id} not found`);
    }
    return result[0];
  }

  // ============================================
  // RECEIPT METHODS
  // ============================================

  async createReceipt(tenantDb: DataSource, dto: CreateReceiptDto, userId?: string) {
    this.ensureTenantDb(tenantDb);
    const queryRunner = tenantDb.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const [receipt] = await queryRunner.query(
        `INSERT INTO pharmacy_receipts (
          purchase_order_id, receipt_date, received_by, status, notes,
          created_by, created_at, updated_at
        ) VALUES ($1, $2, $3, COALESCE($4, 'pending'), $5, $6, NOW(), NOW())
        RETURNING *`,
        [
          dto.purchaseOrderId,
          dto.receiptDate ?? new Date().toISOString(),
          userId ?? null, // receivedBy comes from userId parameter, not DTO
          dto.status ?? 'pending',
          dto.notes ?? null,
          userId ?? null,
        ],
      );

      if (dto.items && dto.items.length > 0) {
        for (const item of dto.items) {
          // Get inventory_id from purchase order item if available, or find/create from drugId
          let inventoryId: string | null = null;
          
          // First, try to get inventory_id from purchase order item
          if (item.purchaseOrderItemId) {
            const [poItem] = await queryRunner.query(
              `SELECT inventory_id FROM pharmacy_purchase_order_items WHERE id = $1`,
              [item.purchaseOrderItemId],
            );
            if (poItem?.inventory_id) {
              inventoryId = poItem.inventory_id;
            }
          }
          
          // If not found, try to get from purchase order by drugId
          if (!inventoryId && item.drugId && dto.purchaseOrderId) {
            const [poItem] = await queryRunner.query(
              `SELECT poi.inventory_id 
               FROM pharmacy_purchase_order_items poi
               JOIN pharmacy_inventory pi ON pi.id = poi.inventory_id
               WHERE poi.purchase_order_id = $1 AND pi.drug_id = $2
               LIMIT 1`,
              [dto.purchaseOrderId, item.drugId],
            );
            if (poItem?.inventory_id) {
              inventoryId = poItem.inventory_id;
            }
          }
          
          // If still not found, find existing inventory item by drug_id
          if (!inventoryId && item.drugId) {
            const [existingInv] = await queryRunner.query(
              `SELECT id FROM pharmacy_inventory WHERE drug_id = $1 AND status = 'active' LIMIT 1`,
              [item.drugId],
            );
            if (existingInv?.id) {
              inventoryId = existingInv.id;
            } else {
              // Create new inventory item from drugId
              const [newInv] = await queryRunner.query(
                `INSERT INTO pharmacy_inventory (
                  drug_id, quantity_on_hand, reorder_level, expiry_date,
                  cost_per_unit, selling_price, status, created_at, updated_at
                ) VALUES ($1, 0, 10, $2, $3, $4, 'active', NOW(), NOW())
                RETURNING id`,
                [
                  item.drugId,
                  item.expiryDate || new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
                  item.unitCost || 0,
                  (item.unitCost || 0) * 2, // Default selling price is 2x cost
                ],
              );
              if (newInv?.id) {
                inventoryId = newInv.id;
              }
            }
          }

          if (!inventoryId) {
            throw new BadRequestException(`Cannot determine inventory_id for receipt item with drugId: ${item.drugId}`);
          }

          await queryRunner.query(
            `INSERT INTO pharmacy_receipt_items (
              receipt_id, inventory_id, quantity_received, quantity_accepted,
              quantity_rejected, unit_cost, condition, notes, created_at, updated_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())`,
            [
              receipt.id,
              inventoryId,
              item.quantityReceived,
              item.quantityReceived, // quantityAccepted = quantityReceived (all accepted by default)
              0, // quantityRejected = 0 (all accepted by default)
              item.unitCost ?? null,
              item.condition ?? 'good',
              item.notes ?? null,
            ],
          );

          if (item.quantityReceived > 0 && item.condition === 'good') {
            await queryRunner.query(
              `UPDATE pharmacy_inventory
               SET quantity_on_hand = quantity_on_hand + $1,
                   cost_per_unit = COALESCE($2, cost_per_unit),
                   updated_at = NOW()
               WHERE id = $3`,
              [item.quantityReceived, item.unitCost, inventoryId],
            );

            await queryRunner.query(
              `INSERT INTO pharmacy_stock_movements (
                inventory_id, movement_type, quantity, reference_type, reference_id,
                notes, created_at
              ) VALUES ($1, 'receipt', $2, 'receipt', $3, $4, NOW())`,
              [inventoryId, item.quantityReceived, receipt.id, item.notes ?? null],
            );

            // ── Storeroom replenishment ────────────────────────────────────────
            if (this.storeroomService && item.drugId) {
              const pharmacyLocationId = await this.getPharmacyLocationId(tenantDb);
              if (pharmacyLocationId) {
                const catalogItem = await this.storeroomService.getCatalogByDrugId(tenantDb, item.drugId);
                if (catalogItem) {
                  try {
                    await this.storeroomService.receiveStock(
                      tenantDb, pharmacyLocationId, catalogItem.id,
                      item.batchNumber ?? null, item.expiryDate ?? null,
                      item.quantityReceived, item.unitCost ?? 0,
                    );
                  } catch (e: any) {
                    this.logger.warn(`Storeroom receipt sync failed for drug ${item.drugId}: ${e.message}`);
                  }
                }
              }
            }
            // ── end storeroom replenishment ────────────────────────────────────
          }
        }
      }

      await queryRunner.commitTransaction();
      return await this.getReceipt(tenantDb, receipt.id);
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async listReceipts(tenantDb: DataSource, filters: PaginationQueryDto & { purchaseOrderId?: string; status?: string }) {
    this.ensureTenantDb(tenantDb);
    const where: string[] = [];
    const params: any[] = [];

    if (filters.purchaseOrderId) {
      where.push(`r.purchase_order_id = $${params.length + 1}`);
      params.push(filters.purchaseOrderId);
    }
    if (filters.status) {
      where.push(`r.status = $${params.length + 1}`);
      params.push(filters.status);
    }

    const whereClause = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const offset = filters.offset ?? 0;
    const limit = filters.limit ?? 25;
    params.push(limit, offset);

    const receipts = await tenantDb.query(
      `SELECT r.*, po.order_number
       FROM pharmacy_receipts r
       LEFT JOIN pharmacy_purchase_orders po ON po.id = r.purchase_order_id
       ${whereClause}
       ORDER BY r.created_at DESC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params,
    );

    const totalResult = await tenantDb.query(
      `SELECT COUNT(*)::int as count FROM pharmacy_receipts r ${whereClause}`,
      params.slice(0, params.length - 2),
    );

    return { receipts, total: totalResult[0]?.count ?? receipts.length };
  }

  async getReceipt(tenantDb: DataSource, id: string) {
    this.ensureTenantDb(tenantDb);
    const [receipt] = await tenantDb.query(
      `SELECT r.*, po.order_number
       FROM pharmacy_receipts r
       LEFT JOIN pharmacy_purchase_orders po ON po.id = r.purchase_order_id
       WHERE r.id = $1`,
      [id],
    );
    if (!receipt) {
      throw new NotFoundException(`Receipt ${id} not found`);
    }
    const items = await tenantDb.query(
      `SELECT ri.*, pi.name as inventory_name, pi.sku
       FROM pharmacy_receipt_items ri
       LEFT JOIN pharmacy_inventory pi ON pi.id = ri.inventory_id
       WHERE ri.receipt_id = $1
       ORDER BY ri.created_at ASC`,
      [id],
    );
    return { ...receipt, items };
  }

  // ============================================
  // DISPENSING METHODS
  // ============================================

  async createDispensing(tenantDb: DataSource, dto: CreateDispensingDto, userId?: string) {
    this.ensureTenantDb(tenantDb);
    const queryRunner = tenantDb.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const [dispensing] = await queryRunner.query(
        `INSERT INTO pharmacy_dispensings (
          prescription_id, patient_id, dispensing_date, dispensed_by, status,
          payment_status, payment_method, notes, created_by, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, COALESCE($5, 'pending'), $6, $7, $8, $9, NOW(), NOW())
        RETURNING *`,
        [
          dto.prescriptionId ?? null,
          dto.patientId,
          dto.dispensingDate ?? new Date().toISOString(),
          userId ?? null, // dispensedBy comes from userId parameter, not DTO
          'pending', // status default
          'pending', // paymentStatus default
          dto.paymentMethod ?? null,
          dto.notes ?? null,
          userId ?? null,
        ],
      );

      if (dto.items && dto.items.length > 0) {
        for (const item of dto.items) {
          const [inventory] = await queryRunner.query(
            'SELECT quantity_on_hand, selling_price FROM pharmacy_inventory WHERE id = $1',
            [item.inventoryId],
          );
          if (!inventory) {
            throw new NotFoundException(`Inventory item ${item.inventoryId} not found`);
          }
          if (inventory.quantity_on_hand < item.quantityDispensed) {
            throw new BadRequestException(`Insufficient stock for ${item.inventoryId}`);
          }

          await queryRunner.query(
            `INSERT INTO pharmacy_dispensing_items (
              dispensing_id, inventory_id, quantity_dispensed, unit_price,
              total_price, notes, created_at, updated_at
            ) VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())`,
            [
              dispensing.id,
              item.inventoryId,
              item.quantityDispensed,
              item.unitPrice ?? inventory.selling_price,
              (item.unitPrice ?? inventory.selling_price) * item.quantityDispensed,
              item.notes ?? null,
            ],
          );

          await queryRunner.query(
            `UPDATE pharmacy_inventory
             SET quantity_on_hand = quantity_on_hand - $1, updated_at = NOW()
             WHERE id = $2`,
            [item.quantityDispensed, item.inventoryId],
          );

          await queryRunner.query(
            `INSERT INTO pharmacy_stock_movements (
              inventory_id, movement_type, quantity, reference_type, reference_id,
              notes, created_at
            ) VALUES ($1, 'dispensing', $2, 'dispensing', $3, $4, NOW())`,
            [item.inventoryId, -item.quantityDispensed, dispensing.id, item.notes ?? null],
          );
        }
      }

      await queryRunner.commitTransaction();
      return await this.getDispensing(tenantDb, dispensing.id);
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  // ============================================
  // PRESCRIPTION INTEGRATION METHODS
  // ============================================

  async getPendingPrescriptions(tenantDb: DataSource, filters?: { patientId?: string; limit?: number; offset?: number }) {
    this.ensureTenantDb(tenantDb);
    const params: any[] = [];
    const where: string[] = ["p.status = 'active'"];
    
    // Check if prescription has been dispensed by looking for pharmacy_dispensings
    where.push(`NOT EXISTS (SELECT 1 FROM pharmacy_dispensings d WHERE d.prescription_id = p.id)`);
    
    if (filters?.patientId) {
      where.push(`p.patient_id = $${params.length + 1}`);
      params.push(filters.patientId);
    }
    
    const whereClause = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const limit = filters?.limit ?? 50;
    const offset = filters?.offset ?? 0;
    params.push(limit, offset);

    const prescriptions = await tenantDb.query(
      `SELECT p.*, 
              p.id::text as prescription_number,
              pt.first_name || ' ' || pt.last_name as patient_name,
              pt.patient_number,
              u.first_name || ' ' || u.last_name as prescriber_name
       FROM prescriptions p
       LEFT JOIN patients pt ON pt.id = p.patient_id
       LEFT JOIN users u ON u.id = p.doctor_id
       ${whereClause}
       ORDER BY p.created_at DESC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params,
    );

    // For each prescription, check stock availability
    for (const prescription of prescriptions) {
      prescription.stockAvailability = await this.checkPrescriptionStockAvailability(tenantDb, prescription.id);
    }

    return prescriptions;
  }

  async checkPrescriptionStockAvailability(tenantDb: DataSource, prescriptionId: string) {
    this.ensureTenantDb(tenantDb);
    const [prescription] = await tenantDb.query(
      `SELECT * FROM prescriptions WHERE id = $1`,
      [prescriptionId],
    );
    if (!prescription) {
      throw new NotFoundException(`Prescription ${prescriptionId} not found`);
    }

    // Try to find matching inventory items by medication name or SNOMED code
    const searchTerms: string[] = [];
    const searchParams: any[] = [];
    
    if (prescription.medication_name) {
      searchTerms.push(`(pi.name ILIKE $${searchParams.length + 1} OR pi.generic_name ILIKE $${searchParams.length + 1})`);
      searchParams.push(`%${prescription.medication_name}%`);
    }
    if (prescription.medication_name_snomed_code) {
      searchTerms.push(`pi.snomed_code = $${searchParams.length + 1}`);
      searchParams.push(prescription.medication_name_snomed_code);
    }
    if (prescription.generic_name) {
      searchTerms.push(`pi.generic_name ILIKE $${searchParams.length + 1}`);
      searchParams.push(`%${prescription.generic_name}%`);
    }

    if (searchTerms.length === 0) {
      return {
        available: false,
        message: 'No matching inventory items found',
        matchingItems: [],
      };
    }

    const matchingItems = await tenantDb.query(
      `SELECT pi.*,
              (pi.quantity_on_hand >= $${searchParams.length + 1}) as has_sufficient_stock
       FROM pharmacy_inventory pi
       WHERE (${searchTerms.join(' OR ')})
         AND pi.status = 'active'
       ORDER BY pi.expiry_date ASC, pi.quantity_on_hand DESC
       LIMIT 10`,
      [...searchParams, prescription.quantity],
    );

    // Enrich with storeroom reserved quantity for each matching drug
    const reservedByDrug: Record<string, number> = {};
    try {
      const drugIds = matchingItems.map((i: any) => i.drug_id).filter(Boolean);
      if (drugIds.length > 0) {
        const placeholders = drugIds.map((_: any, idx: number) => `$${idx + 1}`).join(',');
        const reserved = await tenantDb.query(
          `SELECT sc.drug_id, COALESCE(SUM(sr.quantity), 0) AS reserved_qty
             FROM stock_reservations sr
             JOIN storeroom_catalog sc ON sc.id = sr.catalog_id
            WHERE sc.drug_id IN (${placeholders}) AND sr.status = 'active'
            GROUP BY sc.drug_id`,
          drugIds,
        );
        for (const r of reserved) reservedByDrug[r.drug_id] = Number(r.reserved_qty);
      }
    } catch { /* non-blocking: storeroom table may not exist yet */ }

    const availableItems = matchingItems.filter((item: any) => item.has_sufficient_stock);
    const totalAvailable = availableItems.reduce((sum: number, item: any) => sum + item.quantity_on_hand, 0);

    return {
      available: availableItems.length > 0 && totalAvailable >= prescription.quantity,
      quantityNeeded: prescription.quantity,
      quantityAvailable: totalAvailable,
      matchingItems: matchingItems.map((item: any) => ({
        id: item.id,
        name: item.name,
        genericName: item.generic_name,
        quantityOnHand: item.quantity_on_hand,
        unitPrice: item.selling_price,
        expiryDate: item.expiry_date,
        batchNumber: item.batch_number,
        hasSufficientStock: item.has_sufficient_stock,
        reserved_qty: reservedByDrug[(item as any).drug_id] ?? 0,
      })),
      message: availableItems.length > 0 
        ? `Stock available: ${totalAvailable} units`
        : `Insufficient stock. Available: ${totalAvailable} units, Needed: ${prescription.quantity}`,
    };
  }

  async dispensePrescription(
    tenantDb: DataSource,
    prescriptionId: string,
    dto: CreateDispensingDto,
    userId: string,
  ) {
    this.ensureTenantDb(tenantDb);
    const queryRunner = tenantDb.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Get prescription
      const [prescription] = await queryRunner.query(
        `SELECT * FROM prescriptions WHERE id = $1`,
        [prescriptionId],
      );
      if (!prescription) {
        throw new NotFoundException(`Prescription ${prescriptionId} not found`);
      }
      if (prescription.dispensed_at) {
        throw new BadRequestException('Prescription already dispensed');
      }

      const openSubstitutionRecommendations = await queryRunner.query(
        `SELECT id, source_medication_name, generic_alternative, recommendation_status
         FROM pharmacy_substitution_recommendations
         WHERE prescription_id = $1
           AND recommendation_status = 'recommended'
         ORDER BY created_at DESC`,
        [prescriptionId],
      );
      const openStewardshipReviews = await queryRunner.query(
        `SELECT id, antibiotic_name, stewardship_recommendation, review_required
         FROM antimicrobial_stewardship
         WHERE prescription_id = $1
           AND review_required = true
         ORDER BY created_at DESC`,
        [prescriptionId],
      );
      const requiresAiAcknowledgement =
        Boolean(dto.medicationReviewId) ||
        openSubstitutionRecommendations.length > 0 ||
        openStewardshipReviews.length > 0;

      if (requiresAiAcknowledgement && dto.aiReviewAcknowledged !== true) {
        throw new BadRequestException(
          'Pharmacy intelligence review must be acknowledged before dispensing this prescription',
        );
      }

      // ── Storeroom availability check ────────────────────────────────────────
      if (this.storeroomService) {
        const pharmacyLocationId = await this.getPharmacyLocationId(tenantDb);
        if (pharmacyLocationId) {
          for (const item of dto.items) {
            const [invRow] = await queryRunner.query(
              `SELECT drug_id, name FROM pharmacy_inventory WHERE id = $1`,
              [item.inventoryId],
            );
            if (invRow?.drug_id) {
              const catalogItem = await this.storeroomService.getCatalogByDrugId(tenantDb, invRow.drug_id);
              if (catalogItem) {
                const avail = await this.storeroomService.checkAvailability(
                  tenantDb, pharmacyLocationId, catalogItem.id, item.quantityDispensed,
                );
                if (!avail.available) {
                  throw new BadRequestException(
                    `"${invRow.name ?? catalogItem.name}" is out of stock at the pharmacy ` +
                    `(${avail.quantity_available} available, ${item.quantityDispensed} requested). ` +
                    `Submit a storeroom request to replenish.`,
                  );
                }
              }
            }
          }
        }
      }
      // ── end storeroom check ─────────────────────────────────────────────────

      // Generate dispensing number
      const [countResult] = await queryRunner.query('SELECT COUNT(*)::int as count FROM pharmacy_dispensings');
      const count = (countResult?.count ?? 0) + 1;
      const dispensingNumber = `DISP${String(count).padStart(8, '0')}`;

      // Create dispensing record
      let totalAmount = 0;
      const dispensingItems = [];

      for (const item of dto.items) {
        const [inventory] = await queryRunner.query(
          `SELECT quantity_on_hand, selling_price, name, expiry_date, batch_number 
           FROM pharmacy_inventory WHERE id = $1`,
          [item.inventoryId],
        );
        if (!inventory) {
          throw new NotFoundException(`Inventory item ${item.inventoryId} not found`);
        }
        if (inventory.quantity_on_hand < item.quantityDispensed) {
          throw new BadRequestException(`Insufficient stock for ${inventory.name}`);
        }

        const unitPrice = inventory.selling_price;
        const totalPrice = unitPrice * item.quantityDispensed;
        totalAmount += totalPrice;

        dispensingItems.push({
          inventoryId: item.inventoryId,
          quantityDispensed: item.quantityDispensed,
          unitPrice,
          totalPrice,
        });
      }

      const aiReviewSummary = {
        ...(dto.aiReviewSummary ?? {}),
        medicationReviewId: dto.medicationReviewId ?? null,
        selectedSubstitutionRecommendationIds: dto.selectedSubstitutionRecommendationIds ?? [],
        stewardshipReviewIds: dto.stewardshipReviewIds ?? [],
        substitutionRecommendations: openSubstitutionRecommendations.map((row: any) => ({
          id: row.id,
          sourceMedicationName: row.source_medication_name,
          genericAlternative: row.generic_alternative,
        })),
        stewardshipReviews: openStewardshipReviews.map((row: any) => ({
          id: row.id,
          antibioticName: row.antibiotic_name,
          recommendation: row.stewardship_recommendation,
        })),
        acknowledged: Boolean(dto.aiReviewAcknowledged),
        acknowledgedBy: userId,
        acknowledgedAt: dto.aiReviewAcknowledged ? new Date().toISOString() : null,
      };

      const [dispensing] = await queryRunner.query(
        `INSERT INTO pharmacy_dispensings (
          prescription_id, patient_id, dispensing_number, dispensing_date, 
          dispensed_by, status, payment_status, payment_method, total_amount,
          ai_review_acknowledged_at, ai_review_acknowledged_by, ai_review_summary,
          notes, created_by, created_at, updated_at
        ) VALUES ($1, $2, $3, CURRENT_DATE, $4, 'dispensed', 'pending', $5, $6, $7, $8, $9::jsonb, $10, $11, NOW(), NOW())
        RETURNING *`,
        [
          prescriptionId,
          prescription.patient_id,
          dispensingNumber,
          userId,
          dto.paymentMethod ?? null,
          totalAmount,
          dto.aiReviewAcknowledged ? new Date().toISOString() : null,
          dto.aiReviewAcknowledged ? userId : null,
          JSON.stringify(aiReviewSummary),
          dto.notes ?? null,
          userId,
        ],
      );

      // Create dispensing items and update inventory
      for (const item of dispensingItems) {
        await queryRunner.query(
          `INSERT INTO pharmacy_dispensing_items (
            dispensing_id, inventory_id, quantity_dispensed, unit_price, total_price, created_at, updated_at
          ) VALUES ($1, $2, $3, $4, $5, NOW(), NOW())`,
          [dispensing.id, item.inventoryId, item.quantityDispensed, item.unitPrice, item.totalPrice],
        );

        await queryRunner.query(
          `UPDATE pharmacy_inventory
           SET quantity_on_hand = quantity_on_hand - $1, updated_at = NOW()
           WHERE id = $2`,
          [item.quantityDispensed, item.inventoryId],
        );

        await queryRunner.query(
          `INSERT INTO pharmacy_stock_movements (
            inventory_id, movement_type, quantity_before, quantity_change, quantity_after,
            reference_type, reference_id, performed_by, created_at
          ) 
          SELECT 
            $1, 'dispensing', quantity_on_hand + $2, -$2, quantity_on_hand,
            'dispensing', $3, $4, NOW()
          FROM pharmacy_inventory WHERE id = $1`,
          [item.inventoryId, item.quantityDispensed, dispensing.id, userId],
        );
      }

      // ── Storeroom deduction ─────────────────────────────────────────────────
      if (this.storeroomService) {
        const pharmacyLocationId = await this.getPharmacyLocationId(tenantDb);
        if (pharmacyLocationId) {
          for (const item of dispensingItems) {
            const [invRow] = await tenantDb.query(
              `SELECT drug_id FROM pharmacy_inventory WHERE id = $1`,
              [item.inventoryId],
            );
            if (invRow?.drug_id) {
              const catalogItem = await this.storeroomService.getCatalogByDrugId(tenantDb, invRow.drug_id);
              if (catalogItem) {
                try {
                  await this.storeroomService.deductStock(
                    tenantDb, pharmacyLocationId, catalogItem.id, item.quantityDispensed,
                    'prescription', dispensing.id, prescription.patient_id, userId,
                  );
                } catch (e: any) {
                  this.logger.warn(`Storeroom deduction failed for inventory ${item.inventoryId}: ${e.message}`);
                }
              }
            }
          }
        }
      }
      // ── end storeroom deduction ─────────────────────────────────────────────

      // Update prescription status
      await queryRunner.query(
        `UPDATE prescriptions
         SET status = 'completed'
         WHERE id = $1`,
        [prescriptionId],
      );

      // Create billing entry for the dispensing
      let billId: string | null = null;
      try {
        // Get inventory names for bill items
        const billItems = [];
        for (const item of dispensingItems) {
          const [inventoryInfo] = await queryRunner.query(
            `SELECT name, generic_name FROM pharmacy_inventory WHERE id = $1`,
            [item.inventoryId],
          );
          billItems.push({
            code: `MED-${item.inventoryId.slice(0, 8)}`,
            description: inventoryInfo?.name || inventoryInfo?.generic_name || `Medication - ${item.inventoryId.slice(0, 8)}`,
            quantity: item.quantityDispensed,
            unitPrice: item.unitPrice,
            totalPrice: item.totalPrice,
            category: 'medication' as const,
          });
        }

        const finalAmount = totalAmount - (dto.discountAmount || 0);
        const bill = await this.billingService.createBill(
          {
            patientId: prescription.patient_id,
            items: billItems,
            subtotal: totalAmount,
            taxAmount: 0,
            discountAmount: dto.discountAmount || 0,
            totalAmount: finalAmount,
            status: dto.paymentMethod === 'medical_aid' || dto.paymentMethod === 'insurance' ? 'pending' : 'pending',
            notes: `Pharmacy dispensing: ${dispensingNumber}`,
            insurance: dto.medicalAidId ? {
              provider: dto.medicalAidName || 'Unknown',
              policyNumber: dto.policyNumber || '',
              coveragePercentage: dto.coveragePercentage || 0,
            } : undefined,
          },
          tenantDb,
          userId,
        );

        billId = bill.id;

        // Update dispensing with bill reference and discount
        await queryRunner.query(
          `UPDATE pharmacy_dispensings 
           SET bill_id = $1, discount_amount = $2, updated_at = NOW()
           WHERE id = $3`,
          [billId, dto.discountAmount || 0, dispensing.id],
        );

        // If payment method is provided and not medical aid, process payment
        if (dto.paymentMethod && dto.paymentMethod !== 'medical_aid' && dto.paymentMethod !== 'insurance' && dto.amountPaid) {
          await this.billingService.addPayment(
            billId,
            {
              amount: dto.amountPaid,
              method: dto.paymentMethod,
              reference: `DISP-${dispensingNumber}`,
            },
            tenantDb,
            userId,
          );

          // Update dispensing payment status
          const paymentStatus = dto.amountPaid >= finalAmount ? 'paid' : 'partially_paid';
          await queryRunner.query(
            `UPDATE pharmacy_dispensings 
             SET payment_status = $1, amount_paid = $2, updated_at = NOW()
             WHERE id = $3`,
            [paymentStatus, dto.amountPaid, dispensing.id],
          );
        }
      } catch (billingError) {
        this.logger.warn(`Failed to create billing entry for dispensing ${dispensing.id}: ${billingError instanceof Error ? billingError.message : String(billingError)}`);
        // Continue without billing - don't fail the dispensing
      }

      await queryRunner.commitTransaction();
      const result = await this.getDispensing(tenantDb, dispensing.id);
      return { ...result, billId };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async getDispensing(tenantDb: DataSource, id: string) {
    this.ensureTenantDb(tenantDb);
    const [dispensing] = await tenantDb.query(
      `SELECT d.*, p.first_name || ' ' || p.last_name as patient_name, p.patient_number
       FROM pharmacy_dispensings d
       LEFT JOIN patients p ON p.id = d.patient_id
       WHERE d.id = $1`,
      [id],
    );
    if (!dispensing) {
      throw new NotFoundException(`Dispensing ${id} not found`);
    }
    const items = await tenantDb.query(
      `SELECT di.*, pi.name as inventory_name, pi.sku
       FROM pharmacy_dispensing_items di
       LEFT JOIN pharmacy_inventory pi ON pi.id = di.inventory_id
       WHERE di.dispensing_id = $1
       ORDER BY di.created_at ASC`,
      [id],
    );
    return { ...dispensing, items };
  }

  async processDispensingPayment(
    tenantDb: DataSource,
    dispensingId: string,
    dto: { amount: number; method: string; reference?: string },
    userId: string,
  ) {
    this.ensureTenantDb(tenantDb);
    
    const [dispensing] = await tenantDb.query(
      `SELECT * FROM pharmacy_dispensings WHERE id = $1`,
      [dispensingId],
    );
    if (!dispensing) {
      throw new NotFoundException(`Dispensing ${dispensingId} not found`);
    }

    if (!dispensing.bill_id) {
      throw new BadRequestException('Dispensing does not have an associated bill');
    }

    // Add payment to bill
    const bill = await this.billingService.addPayment(
      dispensing.bill_id,
      {
        amount: dto.amount,
        method: dto.method,
        reference: dto.reference || `DISP-${dispensing.dispensing_number}`,
      },
      tenantDb,
      userId,
    );

    // Update dispensing payment status
    const newAmountPaid = (parseFloat(dispensing.amount_paid?.toString() || '0')) + dto.amount;
    const totalAmount = parseFloat(dispensing.total_amount?.toString() || '0');
    const discountAmount = parseFloat(dispensing.discount_amount?.toString() || '0');
    const finalAmount = totalAmount - discountAmount;
    
    const paymentStatus = newAmountPaid >= finalAmount ? 'paid' : 'partially_paid';
    
    await tenantDb.query(
      `UPDATE pharmacy_dispensings 
       SET payment_status = $1, amount_paid = $2, payment_method = $3, updated_at = NOW()
       WHERE id = $4`,
      [paymentStatus, newAmountPaid, dto.method, dispensingId],
    );

    return {
      dispensing: await this.getDispensing(tenantDb, dispensingId),
      bill,
    };
  }

  async updateDispensing(tenantDb: DataSource, id: string, dto: UpdateDispensingDto) {
    this.ensureTenantDb(tenantDb);
    const updates: string[] = [];
    const params: any[] = [];
    const fields: Array<keyof UpdateDispensingDto> = [
      'status', 'paymentStatus', 'paymentMethod', 'notes',
    ];
    fields.forEach((field) => {
      if (dto[field] !== undefined) {
        updates.push(`${this.camelToSnake(field as string)} = $${params.length + 1}`);
        params.push(dto[field]);
      }
    });
    if (!updates.length) {
      throw new BadRequestException('No fields provided for update');
    }
    params.push(id);
    const result = await tenantDb.query(
      `UPDATE pharmacy_dispensings SET ${updates.join(', ')}, updated_at = NOW() WHERE id = $${params.length} RETURNING *`,
      params,
    );
    if (!result.length) {
      throw new NotFoundException(`Dispensing ${id} not found`);
    }
    return result[0];
  }

  // ============================================
  // RETURN METHODS
  // ============================================

  async createReturn(tenantDb: DataSource, dto: CreateReturnDto, userId?: string) {
    this.ensureTenantDb(tenantDb);
    const queryRunner = tenantDb.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Get patient_id from dispensing if not provided
      let patientId: string | null = null;
      if (dto.dispensingId) {
        const [dispensing] = await queryRunner.query(
          `SELECT patient_id FROM pharmacy_dispensings WHERE id = $1`,
          [dto.dispensingId],
        );
        if (dispensing) {
          patientId = dispensing.patient_id;
        }
      }

      const [returnRecord] = await queryRunner.query(
        `INSERT INTO pharmacy_returns (
          dispensing_id, patient_id, return_date, returned_by, reason, status,
          notes, created_by, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, COALESCE($6, 'pending'), $7, $8, NOW(), NOW())
        RETURNING *`,
        [
          dto.dispensingId ?? null,
          patientId,
          dto.returnDate ?? new Date().toISOString(),
          userId ?? null, // returnedBy comes from userId parameter, not DTO
          dto.returnReason ?? null, // Use returnReason from DTO
          'pending', // status default
          dto.notes ?? null,
          userId ?? null,
        ],
      );

      if (dto.items && dto.items.length > 0) {
        for (const item of dto.items) {
          await queryRunner.query(
            `INSERT INTO pharmacy_return_items (
              return_id, inventory_id, quantity_returned, condition, notes,
              created_at, updated_at
            ) VALUES ($1, $2, $3, $4, $5, NOW(), NOW())`,
            [
              returnRecord.id,
              item.inventoryId,
              item.quantityReturned,
              item.condition ?? 'good',
              item.notes ?? null,
            ],
          );

          if (item.condition === 'good') {
            await queryRunner.query(
              `UPDATE pharmacy_inventory
               SET quantity_on_hand = quantity_on_hand + $1, updated_at = NOW()
               WHERE id = $2`,
              [item.quantityReturned, item.inventoryId],
            );

            await queryRunner.query(
              `INSERT INTO pharmacy_stock_movements (
                inventory_id, movement_type, quantity, reference_type, reference_id,
                notes, created_at
              ) VALUES ($1, 'return', $2, 'return', $3, $4, NOW())`,
              [item.inventoryId, item.quantityReturned, returnRecord.id, item.notes ?? null],
            );
          }
        }
      }

      await queryRunner.commitTransaction();
      return await this.getReturn(tenantDb, returnRecord.id);
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async getReturn(tenantDb: DataSource, id: string) {
    this.ensureTenantDb(tenantDb);
    const [returnRecord] = await tenantDb.query(
      `SELECT r.*, p.first_name || ' ' || p.last_name as patient_name
       FROM pharmacy_returns r
       LEFT JOIN patients p ON p.id = r.patient_id
       WHERE r.id = $1`,
      [id],
    );
    if (!returnRecord) {
      throw new NotFoundException(`Return ${id} not found`);
    }
    const items = await tenantDb.query(
      `SELECT ri.*, pi.name as inventory_name, pi.sku
       FROM pharmacy_return_items ri
       LEFT JOIN pharmacy_inventory pi ON pi.id = ri.inventory_id
       WHERE ri.return_id = $1
       ORDER BY ri.created_at ASC`,
      [id],
    );
    return { ...returnRecord, items };
  }

  // ============================================
  // STOCK ADJUSTMENT METHODS
  // ============================================

  async createStockAdjustment(tenantDb: DataSource, dto: CreateStockAdjustmentDto, userId?: string) {
    this.ensureTenantDb(tenantDb);
    const queryRunner = tenantDb.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const [adjustment] = await queryRunner.query(
        `INSERT INTO pharmacy_stock_adjustments (
          adjustment_date, adjustment_type, reason, status, notes,
          created_by, created_at, updated_at
        ) VALUES ($1, $2, $3, 'pending', $4, $5, NOW(), NOW())
        RETURNING *`,
        [
          dto.adjustmentDate ?? new Date().toISOString(),
          dto.adjustmentType,
          dto.reason ?? null,
          dto.notes ?? null,
          userId ?? null,
        ],
      );

      if (dto.items && dto.items.length > 0) {
        for (const item of dto.items) {
          await queryRunner.query(
            `INSERT INTO pharmacy_stock_adjustment_items (
              adjustment_id, inventory_id, quantity_adjusted, previous_quantity,
              new_quantity, notes, created_at, updated_at
            ) VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())`,
            [
              adjustment.id,
              item.inventoryId,
              item.quantityAdjustment,
              null, // previousQuantity - not provided in DTO
              null, // newQuantity - not provided in DTO
              item.notes ?? null,
            ],
          );

          const quantityChange = item.quantityAdjustment;
          await queryRunner.query(
            `UPDATE pharmacy_inventory
             SET quantity_on_hand = quantity_on_hand + $1, updated_at = NOW()
             WHERE id = $2`,
            [quantityChange, item.inventoryId],
          );

          await queryRunner.query(
            `INSERT INTO pharmacy_stock_movements (
              inventory_id, movement_type, quantity, reference_type, reference_id,
              notes, created_at
            ) VALUES ($1, 'adjustment', $2, 'adjustment', $3, $4, NOW())`,
            [item.inventoryId, quantityChange, adjustment.id, item.notes ?? null],
          );
        }
      }

      await queryRunner.commitTransaction();
      return await this.getStockAdjustment(tenantDb, adjustment.id);
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async getStockAdjustment(tenantDb: DataSource, id: string) {
    this.ensureTenantDb(tenantDb);
    const [adjustment] = await tenantDb.query(
      'SELECT * FROM pharmacy_stock_adjustments WHERE id = $1',
      [id],
    );
    if (!adjustment) {
      throw new NotFoundException(`Stock adjustment ${id} not found`);
    }
    const items = await tenantDb.query(
      `SELECT ai.*, pi.name as inventory_name, pi.sku
       FROM pharmacy_stock_adjustment_items ai
       LEFT JOIN pharmacy_inventory pi ON pi.id = ai.inventory_id
       WHERE ai.adjustment_id = $1
       ORDER BY ai.created_at ASC`,
      [id],
    );
    return { ...adjustment, items };
  }

  // ============================================
  // PRICING RULE METHODS
  // ============================================

  async listPricingRules(tenantDb: DataSource, filters: PaginationQueryDto & { active?: boolean }) {
    this.ensureTenantDb(tenantDb);
    const where: string[] = [];
    const params: any[] = [];

    if (filters.active !== undefined) {
      where.push(`is_active = $${params.length + 1}`);
      params.push(filters.active);
    }

    const whereClause = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const offset = filters.offset ?? 0;
    const limit = filters.limit ?? 25;
    params.push(limit, offset);

    const rules = await tenantDb.query(
      `SELECT * FROM pharmacy_pricing_rules ${whereClause}
       ORDER BY created_at DESC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params,
    );

    const totalResult = await tenantDb.query(
      `SELECT COUNT(*)::int as count FROM pharmacy_pricing_rules ${whereClause}`,
      params.slice(0, params.length - 2),
    );

    return { rules, total: totalResult[0]?.count ?? rules.length };
  }

  async createPricingRule(tenantDb: DataSource, dto: CreatePricingRuleDto) {
    this.ensureTenantDb(tenantDb);
    const result = await tenantDb.query(
      `INSERT INTO pharmacy_pricing_rules (
        rule_name, rule_type, applies_to, markup_percentage, markup_fixed,
        discount_percentage, discount_fixed, fixed_price, category_id, drug_id,
        supplier_id, priority, active, valid_from, valid_to, notes,
        created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, COALESCE($13, true), $14, $15, $16, NOW(), NOW())
      RETURNING *`,
      [
        dto.ruleName,
        dto.ruleType,
        dto.appliesTo ?? null,
        dto.markupPercentage ?? null,
        dto.markupFixed ?? null,
        dto.discountPercentage ?? null,
        dto.discountFixed ?? null,
        dto.fixedPrice ?? null,
        dto.categoryId ?? null,
        dto.drugId ?? null,
        dto.supplierId ?? null,
        dto.priority ?? 0,
        dto.active ?? true,
        dto.validFrom ?? new Date().toISOString().split('T')[0],
        dto.validTo ?? null,
        dto.notes ?? null,
      ],
    );
    return result[0];
  }

  async updatePricingRule(tenantDb: DataSource, id: string, dto: UpdatePricingRuleDto) {
    this.ensureTenantDb(tenantDb);
    const updates: string[] = [];
    const params: any[] = [];
    
    // Map DTO fields to database columns
    const fieldMap: Record<string, string> = {
      'ruleName': 'rule_name',
      'ruleType': 'rule_type',
      'appliesTo': 'applies_to',
      'markupPercentage': 'markup_percentage',
      'markupFixed': 'markup_fixed',
      'discountPercentage': 'discount_percentage',
      'discountFixed': 'discount_fixed',
      'fixedPrice': 'fixed_price',
      'categoryId': 'category_id',
      'drugId': 'drug_id',
      'supplierId': 'supplier_id',
      'priority': 'priority',
      'active': 'active',
      'validFrom': 'valid_from',
      'validTo': 'valid_to',
      'notes': 'notes',
    };

    Object.keys(dto).forEach((key) => {
      if (dto[key as keyof UpdatePricingRuleDto] !== undefined && fieldMap[key]) {
        updates.push(`${fieldMap[key]} = $${params.length + 1}`);
        params.push(dto[key as keyof UpdatePricingRuleDto]);
      }
    });

    if (!updates.length) {
      throw new BadRequestException('No fields provided for update');
    }
    params.push(id);
    const result = await tenantDb.query(
      `UPDATE pharmacy_pricing_rules SET ${updates.join(', ')}, updated_at = NOW() WHERE id = $${params.length} RETURNING *`,
      params,
    );
    if (!result.length) {
      throw new NotFoundException(`Pricing rule ${id} not found`);
    }
    return result[0];
  }

  // ============================================
  // FORMULARY METHODS
  // ============================================

  async listFormulary(tenantDb: DataSource, filters: PaginationQueryDto & { search?: string; category?: string }) {
    this.ensureTenantDb(tenantDb);
    const where: string[] = [];
    const params: any[] = [];

    if (filters.search) {
      where.push(`(d.generic_name ILIKE $${params.length + 1} OR d.brand_names::text ILIKE $${params.length + 1})`);
      params.push(`%${filters.search}%`);
    }

    const whereClause = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const offset = filters.offset ?? 0;
    const limit = filters.limit ?? 25;
    params.push(limit, offset);

    const formulary = await tenantDb.query(
      `SELECT * FROM pharmacy_formulary ${whereClause}
       ORDER BY drug_name ASC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params,
    );

    const totalResult = await tenantDb.query(
      `SELECT COUNT(*)::int as count FROM pharmacy_formulary ${whereClause}`,
      params.slice(0, params.length - 2),
    );

    return { formulary, total: totalResult[0]?.count ?? formulary.length };
  }

  async createFormulary(tenantDb: DataSource, dto: CreateFormularyDto) {
    this.ensureTenantDb(tenantDb);
    const result = await tenantDb.query(
      `INSERT INTO pharmacy_formulary (
        medical_aid_id, medical_aid_name, drug_id, rxnorm_code, covered,
        requires_prior_auth, co_pay_amount, co_pay_percentage, max_quantity_per_month,
        max_days_supply, tier, effective_date, expiry_date, notes,
        created_at, updated_at
      ) VALUES ($1, $2, $3, $4, COALESCE($5, true), $6, $7, $8, $9, $10, $11, $12, $13, $14, NOW(), NOW())
      RETURNING *`,
      [
        dto.medicalAidId ?? null,
        dto.medicalAidName ?? null,
        dto.drugId,
        dto.rxnormCode ?? null,
        dto.covered ?? true,
        dto.requiresPriorAuth ?? false,
        dto.coPayAmount ?? null,
        dto.coPayPercentage ?? null,
        dto.maxQuantityPerMonth ?? null,
        dto.maxDaysSupply ?? null,
        dto.tier ?? null,
        dto.effectiveDate ?? new Date().toISOString().split('T')[0],
        dto.expiryDate ?? null,
        dto.notes ?? null,
      ],
    );
    return result[0];
  }

  async updateFormulary(tenantDb: DataSource, id: string, dto: UpdateFormularyDto) {
    this.ensureTenantDb(tenantDb);
    const updates: string[] = [];
    const params: any[] = [];
    
    // Map DTO fields to database columns
    const fieldMap: Record<string, string> = {
      'medicalAidId': 'medical_aid_id',
      'medicalAidName': 'medical_aid_name',
      'drugId': 'drug_id',
      'rxnormCode': 'rxnorm_code',
      'covered': 'covered',
      'requiresPriorAuth': 'requires_prior_auth',
      'coPayAmount': 'co_pay_amount',
      'coPayPercentage': 'co_pay_percentage',
      'maxQuantityPerMonth': 'max_quantity_per_month',
      'maxDaysSupply': 'max_days_supply',
      'tier': 'tier',
      'effectiveDate': 'effective_date',
      'expiryDate': 'expiry_date',
      'notes': 'notes',
    };

    Object.keys(dto).forEach((key) => {
      if (dto[key as keyof UpdateFormularyDto] !== undefined && fieldMap[key]) {
        updates.push(`${fieldMap[key]} = $${params.length + 1}`);
        params.push(dto[key as keyof UpdateFormularyDto]);
      }
    });

    if (!updates.length) {
      throw new BadRequestException('No fields provided for update');
    }
    params.push(id);
    const result = await tenantDb.query(
      `UPDATE pharmacy_formulary SET ${updates.join(', ')}, updated_at = NOW() WHERE id = $${params.length} RETURNING *`,
      params,
    );
    if (!result.length) {
      throw new NotFoundException(`Formulary item ${id} not found`);
    }
    return result[0];
  }

  // ============================================
  // ALERT METHODS
  // ============================================

  async listAlerts(tenantDb: DataSource, filters: PaginationQueryDto & { type?: string; severity?: string; resolved?: boolean }) {
    this.ensureTenantDb(tenantDb);
    const where: string[] = [];
    const params: any[] = [];

    if (filters.type) {
      where.push(`alert_type = $${params.length + 1}`);
      params.push(filters.type);
    }
    if (filters.severity) {
      where.push(`severity = $${params.length + 1}`);
      params.push(filters.severity);
    }
    if (filters.resolved !== undefined) {
      where.push(`resolved = $${params.length + 1}`);
      params.push(filters.resolved);
    }

    const whereClause = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const offset = filters.offset ?? 0;
    const limit = filters.limit ?? 25;
    params.push(limit, offset);

    const alerts = await tenantDb.query(
      `SELECT * FROM pharmacy_alerts ${whereClause}
       ORDER BY created_at DESC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params,
    );

    const totalResult = await tenantDb.query(
      `SELECT COUNT(*)::int as count FROM pharmacy_alerts ${whereClause}`,
      params.slice(0, params.length - 2),
    );

    return { alerts, total: totalResult[0]?.count ?? alerts.length };
  }

  async createAlert(tenantDb: DataSource, dto: CreateAlertDto) {
    this.ensureTenantDb(tenantDb);
    const result = await tenantDb.query(
      `INSERT INTO pharmacy_alerts (
        alert_type, severity, message, inventory_id, resolved, resolved_at,
        resolved_by, notes, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, COALESCE($5, false), $6, $7, $8, NOW(), NOW())
      RETURNING *`,
      [
        dto.alertType,
        dto.severity,
        dto.message,
        dto.inventoryId ?? null,
        dto.resolved ?? false,
        null,
        null,
        dto.notes ?? null,
      ],
    );
    return result[0];
  }

  async updateAlert(tenantDb: DataSource, id: string, dto: UpdateAlertDto, userId?: string) {
    this.ensureTenantDb(tenantDb);
    const updates: string[] = [];
    const params: any[] = [];
    const fields: Array<keyof UpdateAlertDto> = [
      'resolved', 'notes',
    ];
    fields.forEach((field) => {
      if (dto[field] !== undefined) {
        updates.push(`${this.camelToSnake(field as string)} = $${params.length + 1}`);
        params.push(dto[field]);
      }
    });
    if (dto.resolved && !dto.resolvedAt) {
      updates.push(`resolved_at = NOW()`);
      if (userId) {
        updates.push(`resolved_by = $${params.length + 1}`);
        params.push(userId);
      }
    }
    if (!updates.length) {
      throw new BadRequestException('No fields provided for update');
    }
    params.push(id);
    const result = await tenantDb.query(
      `UPDATE pharmacy_alerts SET ${updates.join(', ')}, updated_at = NOW() WHERE id = $${params.length} RETURNING *`,
      params,
    );
    if (!result.length) {
      throw new NotFoundException(`Alert ${id} not found`);
    }
    return result[0];
  }

  async createPrescriptionWithContraindicationOverride(dto: any, userId: string, tenantDb: DataSource): Promise<any> {
    this.ensureTenantDb(tenantDb);
    // Log the override decision to cdss_decision_log
    await tenantDb.query(
      `INSERT INTO cdss_decision_log (patient_id, decision_type, clinician_action, override_reason, created_at, updated_at)
       VALUES ($1, 'contraindication_override', 'overridden', $2, NOW(), NOW())
       ON CONFLICT DO NOTHING`,
      [dto.patientId, dto.overrideReason],
    ).catch(() => {
      // cdss_decision_log may have different schema; log warning and continue
      this.logger.warn('Could not write contraindication override to cdss_decision_log');
    });

    // Create the prescription bypassing the contraindication block
    const count = await tenantDb.query('SELECT COUNT(*) as count FROM prescriptions');
    const prescriptionNumber = `RX${String(parseInt(count[0].count) + 1).padStart(8, '0')}`;

    const result = await tenantDb.query(
      `INSERT INTO prescriptions (
        prescription_number, patient_id, prescriber_id, medication_name,
        generic_name, strength, form, dosage, frequency, route, quantity,
        start_date, instructions, status, pharmacy_notes
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, 'active', $14)
      RETURNING *`,
      [
        prescriptionNumber,
        dto.patientId,
        userId,
        dto.drugName ?? dto.medicationName,
        dto.genericName ?? null,
        dto.strength ?? null,
        dto.form ?? null,
        dto.dosage ?? null,
        dto.frequency ?? null,
        dto.route ?? null,
        dto.quantity ?? null,
        new Date(),
        dto.instructions ?? null,
        `CONTRAINDICATION OVERRIDE: ${dto.overrideReason}`,
      ],
    );
    return result[0];
  }
}
