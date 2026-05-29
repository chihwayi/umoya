import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import {
  CreateLocationDto, UpdateLocationDto, CreateCatalogItemDto,
  StockAdjustmentDto, ReceiveStockDto, CreateStockRequestDto,
  ApproveRequestDto, CreateTransferDto, ReceiveTransferItemDto,
  StockUnavailableException,
} from './storeroom.dto';

@Injectable()
export class StoreroomService {
  private readonly logger = new Logger(StoreroomService.name);

  // ── Locations ──────────────────────────────────────────────────────────────

  async listLocations(tenantDb: any): Promise<any[]> {
    const { rows } = await tenantDb.query(
      `SELECT l.*,
              u.first_name || ' ' || u.last_name AS manager_name
         FROM inventory_locations l
         LEFT JOIN users u ON u.id = l.manager_id
        ORDER BY l.location_type, l.name`,
    );
    return rows;
  }

  async createLocation(tenantDb: any, dto: CreateLocationDto): Promise<any> {
    const { rows } = await tenantDb.query(
      `INSERT INTO inventory_locations
         (name, code, location_type, parent_id, manager_id, is_dispensing_point, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7)
       RETURNING *`,
      [
        dto.name, dto.code.toUpperCase(), dto.location_type,
        dto.parent_id ?? null, dto.manager_id ?? null,
        dto.is_dispensing_point ?? false, dto.notes ?? null,
      ],
    );
    return rows[0];
  }

  async updateLocation(tenantDb: any, id: string, dto: UpdateLocationDto): Promise<any> {
    const fields: string[] = [];
    const vals: any[] = [];
    let i = 1;
    if (dto.name !== undefined) { fields.push(`name = $${i++}`); vals.push(dto.name); }
    if (dto.manager_id !== undefined) { fields.push(`manager_id = $${i++}`); vals.push(dto.manager_id); }
    if (dto.is_dispensing_point !== undefined) { fields.push(`is_dispensing_point = $${i++}`); vals.push(dto.is_dispensing_point); }
    if (dto.is_active !== undefined) { fields.push(`is_active = $${i++}`); vals.push(dto.is_active); }
    if (dto.notes !== undefined) { fields.push(`notes = $${i++}`); vals.push(dto.notes); }
    if (fields.length === 0) return this.getLocationById(tenantDb, id);
    fields.push(`updated_at = NOW()`);
    vals.push(id);
    const { rows } = await tenantDb.query(
      `UPDATE inventory_locations SET ${fields.join(',')} WHERE id = $${i} RETURNING *`,
      vals,
    );
    if (!rows[0]) throw new NotFoundException(`Location ${id} not found`);
    return rows[0];
  }

  async getLocationById(tenantDb: any, id: string): Promise<any> {
    const { rows } = await tenantDb.query(
      `SELECT * FROM inventory_locations WHERE id = $1`, [id],
    );
    if (!rows[0]) throw new NotFoundException(`Location ${id} not found`);
    return rows[0];
  }

  // ── Catalog ────────────────────────────────────────────────────────────────

  async listCatalog(
    tenantDb: any,
    filters: { category?: string; search?: string; activeOnly?: boolean } = {},
  ): Promise<any[]> {
    const conds: string[] = [];
    const vals: any[] = [];
    let i = 1;
    if (filters.activeOnly !== false) { conds.push(`c.is_active = true`); }
    if (filters.category) { conds.push(`c.category = $${i++}`); vals.push(filters.category); }
    if (filters.search) {
      conds.push(`(c.name ILIKE $${i} OR c.code ILIKE $${i})`);
      vals.push(`%${filters.search}%`); i++;
    }
    const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';
    const { rows } = await tenantDb.query(
      `SELECT c.*, d.generic_name AS drug_generic_name
         FROM storeroom_catalog c
         LEFT JOIN drugs d ON d.id = c.drug_id
        ${where}
        ORDER BY c.category, c.name`,
      vals,
    );
    return rows;
  }

  async createCatalogItem(tenantDb: any, dto: CreateCatalogItemDto): Promise<any> {
    const { rows } = await tenantDb.query(
      `INSERT INTO storeroom_catalog
         (name, code, category, subcategory, unit_of_measure, drug_id,
          atc_code, inn_name, drug_strength, drug_form, who_eml,
          regulatory_code, loinc_code,
          requires_cold_chain, storage_conditions, reorder_lead_days,
          default_reorder_qty, is_controlled)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)
       RETURNING *`,
      [
        dto.name, dto.code ?? null, dto.category,
        dto.subcategory ?? null, dto.unit_of_measure,
        dto.drug_id ?? null, dto.atc_code ?? null,
        dto.inn_name ?? null, dto.drug_strength ?? null,
        dto.drug_form ?? null, dto.who_eml ?? false,
        dto.regulatory_code ?? null, dto.loinc_code ?? null,
        dto.requires_cold_chain ?? false,
        dto.storage_conditions ?? null,
        dto.reorder_lead_days ?? 7,
        dto.default_reorder_qty ?? 0,
        dto.is_controlled ?? false,
      ],
    );
    return rows[0];
  }

  async updateCatalogItem(tenantDb: any, id: string, dto: Partial<CreateCatalogItemDto>): Promise<any> {
    const fields: string[] = [];
    const vals: any[] = [];
    let i = 1;
    const allowed = [
      'name','code','subcategory','unit_of_measure',
      'atc_code','inn_name','drug_strength','drug_form','who_eml','regulatory_code','loinc_code',
      'requires_cold_chain','storage_conditions','reorder_lead_days',
      'default_reorder_qty','is_controlled',
    ];
    for (const key of allowed) {
      if ((dto as any)[key] !== undefined) {
        fields.push(`${key} = $${i++}`);
        vals.push((dto as any)[key]);
      }
    }
    if (fields.length === 0) return this.getCatalogItemById(tenantDb, id);
    fields.push(`updated_at = NOW()`);
    vals.push(id);
    const { rows } = await tenantDb.query(
      `UPDATE storeroom_catalog SET ${fields.join(',')} WHERE id = $${i} RETURNING *`,
      vals,
    );
    if (!rows[0]) throw new NotFoundException(`Catalog item ${id} not found`);
    return rows[0];
  }

  async getCatalogItemById(tenantDb: any, id: string): Promise<any> {
    const { rows } = await tenantDb.query(
      `SELECT * FROM storeroom_catalog WHERE id = $1`, [id],
    );
    if (!rows[0]) throw new NotFoundException(`Catalog item ${id} not found`);
    return rows[0];
  }

  async getCatalogByDrugId(tenantDb: any, drugId: string): Promise<any | null> {
    const { rows } = await tenantDb.query(
      `SELECT * FROM storeroom_catalog WHERE drug_id = $1 AND is_active = true LIMIT 1`,
      [drugId],
    );
    return rows[0] ?? null;
  }

  async getCatalogByName(tenantDb: any, name: string, category?: string): Promise<any | null> {
    const cond = category ? `AND category = $2` : '';
    const vals = category ? [name, category] : [name];
    const { rows } = await tenantDb.query(
      `SELECT * FROM storeroom_catalog
        WHERE name ILIKE $1 AND is_active = true ${cond}
        LIMIT 1`,
      vals,
    );
    return rows[0] ?? null;
  }

  // ── Stock Queries ──────────────────────────────────────────────────────────

  async getStockByLocation(
    tenantDb: any,
    locationId: string,
    filters: { category?: string; lowStockOnly?: boolean } = {},
  ): Promise<any[]> {
    const conds = [`ls.location_id = $1`];
    const vals: any[] = [locationId];
    let i = 2;
    if (filters.category) { conds.push(`c.category = $${i++}`); vals.push(filters.category); }
    if (filters.lowStockOnly) { conds.push(`ls.quantity_on_hand <= ls.min_level`); }
    const { rows } = await tenantDb.query(
      `SELECT
          ls.*,
          c.name AS item_name, c.category, c.unit_of_measure,
          c.requires_cold_chain, c.is_controlled,
          ls.quantity_on_hand - ls.quantity_reserved AS quantity_available,
          CASE
            WHEN ls.quantity_on_hand = 0              THEN 'stockout'
            WHEN ls.quantity_on_hand <= ls.min_level  THEN 'low'
            WHEN ls.max_level IS NOT NULL AND ls.quantity_on_hand > ls.max_level THEN 'overstock'
            ELSE 'ok'
          END AS stock_status,
          l.name AS location_name, l.code AS location_code
        FROM location_stock ls
        JOIN storeroom_catalog c ON c.id = ls.catalog_id
        JOIN inventory_locations l ON l.id = ls.location_id
       WHERE ${conds.join(' AND ')}
       ORDER BY c.category, c.name`,
      vals,
    );
    return rows;
  }

  async getStockByItem(tenantDb: any, catalogId: string): Promise<any[]> {
    const { rows } = await tenantDb.query(
      `SELECT
          ls.*,
          l.name AS location_name, l.code AS location_code, l.location_type,
          ls.quantity_on_hand - ls.quantity_reserved AS quantity_available
        FROM location_stock ls
        JOIN inventory_locations l ON l.id = ls.location_id
       WHERE ls.catalog_id = $1
       ORDER BY l.name`,
      [catalogId],
    );
    return rows;
  }

  async checkAvailability(
    tenantDb: any,
    locationId: string,
    catalogId: string,
    quantity: number,
  ): Promise<{
    available: boolean;
    quantity_on_hand: number;
    quantity_available: number;
    item_name?: string;
    quantity_check?: { controlled: boolean; requested: number; available: number; exceeds_stock: boolean };
  }> {
    const { rows } = await tenantDb.query(
      `SELECT
          COALESCE(SUM(ls.quantity_on_hand), 0)                       AS quantity_on_hand,
          COALESCE(SUM(ls.quantity_on_hand - ls.quantity_reserved), 0) AS quantity_available,
          sc.name                                                       AS item_name,
          sc.category
        FROM location_stock ls
        JOIN storeroom_catalog sc ON sc.id = ls.catalog_id
       WHERE ls.location_id = $1 AND ls.catalog_id = $2
       GROUP BY sc.name, sc.category`,
      [locationId, catalogId],
    );
    const row = rows[0] ?? { quantity_on_hand: '0', quantity_available: '0', item_name: null, category: 'general' };
    const qoh = Number(row.quantity_on_hand);
    const qav = Number(row.quantity_available);
    const isControlled = row.category === 'controlled';
    return {
      available: qav >= quantity,
      quantity_on_hand: qoh,
      quantity_available: qav,
      item_name: row.item_name ?? undefined,
      ...(isControlled ? {
        quantity_check: {
          controlled: true,
          requested: quantity,
          available: qav,
          exceeds_stock: quantity > qav,
        },
      } : {}),
    };
  }

  async findTherapeuticEquivalents(
    tenantDb: any,
    catalogId: string,
    quantity: number,
    locationId: string,
  ): Promise<Array<{
    catalog_id: string;
    name: string;
    equivalence_type: string;
    quantity_available: number;
    unit_cost: number | null;
  }>> {
    // Direct equivalency mappings
    const { rows: mapped } = await tenantDb.query(
      `SELECT
         de.equivalent_id AS catalog_id,
         sc.name,
         de.equivalence_type,
         COALESCE(SUM(ls.quantity_on_hand - ls.quantity_reserved), 0) AS quantity_available,
         sc.unit_price AS unit_cost
       FROM drug_equivalents de
       JOIN storeroom_catalog sc ON sc.id = de.equivalent_id
       LEFT JOIN location_stock ls ON ls.catalog_id = de.equivalent_id
         AND ls.location_id = $3
         AND ls.quantity_on_hand > 0
       WHERE de.catalog_id = $1
       GROUP BY de.equivalent_id, sc.name, de.equivalence_type, sc.unit_price
       HAVING COALESCE(SUM(ls.quantity_on_hand - ls.quantity_reserved), 0) >= $2`,
      [catalogId, quantity, locationId],
    ).catch(() => ({ rows: [] }));

    if (mapped.length > 0) return mapped;

    // Fallback: same ATC code family (first 4 chars = same therapeutic group)
    const { rows: atcMatch } = await tenantDb.query(
      `SELECT
         sc2.id AS catalog_id,
         sc2.name,
         'atc_code' AS equivalence_type,
         COALESCE(SUM(ls.quantity_on_hand - ls.quantity_reserved), 0) AS quantity_available,
         sc2.unit_price AS unit_cost
       FROM storeroom_catalog sc1
       JOIN storeroom_catalog sc2 ON LEFT(sc2.atc_code, 4) = LEFT(sc1.atc_code, 4)
         AND sc2.id <> sc1.id
       LEFT JOIN location_stock ls ON ls.catalog_id = sc2.id
         AND ls.location_id = $3
         AND ls.quantity_on_hand > 0
       WHERE sc1.id = $1
         AND sc1.atc_code IS NOT NULL
       GROUP BY sc2.id, sc2.name, sc2.unit_price
       HAVING COALESCE(SUM(ls.quantity_on_hand - ls.quantity_reserved), 0) >= $2
       LIMIT 5`,
      [catalogId, quantity, locationId],
    ).catch(() => ({ rows: [] }));

    return atcMatch;
  }

  // ── Stock Mutations ────────────────────────────────────────────────────────

  async reserveStock(
    tenantDb: any,
    locationId: string,
    catalogId: string,
    quantity: number,
    prescriptionId: string,
    patientId: string,
    reservedBy: string,
    expiresInHours = 48,
  ): Promise<string> {
    const avail = await this.checkAvailability(tenantDb, locationId, catalogId, quantity);
    if (!avail.available) {
      const catalog = await this.getCatalogItemById(tenantDb, catalogId);
      throw new BadRequestException(
        `Cannot reserve ${quantity} of "${catalog?.name ?? catalogId}": only ${avail.quantity_available} available.`,
      );
    }

    const { rows: batches } = await tenantDb.query(
      `SELECT id, quantity_on_hand, quantity_reserved
         FROM location_stock
        WHERE location_id = $1 AND catalog_id = $2
          AND quantity_on_hand - quantity_reserved > 0
        ORDER BY expiry_date ASC NULLS LAST, created_at ASC
        LIMIT 1`,
      [locationId, catalogId],
    );
    if (!batches[0]) throw new BadRequestException('No available batch to reserve');

    await tenantDb.query(
      `UPDATE location_stock SET quantity_reserved = quantity_reserved + $1 WHERE id = $2`,
      [quantity, batches[0].id],
    );

    const { rows } = await tenantDb.query(
      `INSERT INTO stock_reservations
         (location_id, catalog_id, batch_id, prescription_id, patient_id,
          reserved_by, quantity, expires_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7, NOW() + ($8 || ' hours')::INTERVAL)
       RETURNING id`,
      [locationId, catalogId, batches[0].id, prescriptionId, patientId,
       reservedBy, quantity, String(expiresInHours)],
    );
    return rows[0].id;
  }

  async releaseReservation(tenantDb: any, reservationId: string): Promise<void> {
    const { rows } = await tenantDb.query(
      `UPDATE stock_reservations
          SET status = 'released', released_at = NOW()
        WHERE id = $1 AND status = 'active'
        RETURNING batch_id, quantity`,
      [reservationId],
    );
    if (!rows[0]) return;

    await tenantDb.query(
      `UPDATE location_stock
          SET quantity_reserved = GREATEST(0, quantity_reserved - $1)
        WHERE id = $2`,
      [rows[0].quantity, rows[0].batch_id],
    );
  }

  async releaseReservationsByPrescription(tenantDb: any, prescriptionId: string): Promise<void> {
    const { rows } = await tenantDb.query(
      `UPDATE stock_reservations
          SET status = 'released', released_at = NOW()
        WHERE prescription_id = $1 AND status = 'active'
        RETURNING batch_id, quantity`,
      [prescriptionId],
    );
    for (const r of rows) {
      await tenantDb.query(
        `UPDATE location_stock
            SET quantity_reserved = GREATEST(0, quantity_reserved - $1)
          WHERE id = $2`,
        [r.quantity, r.batch_id],
      );
    }
  }

  async expireStaleReservations(tenantDb: any): Promise<number> {
    const { rows } = await tenantDb.query(
      `UPDATE stock_reservations
          SET status = 'expired', released_at = NOW()
        WHERE status = 'active' AND expires_at < NOW()
        RETURNING id, batch_id, quantity`,
    );
    for (const r of rows) {
      await tenantDb.query(
        `UPDATE location_stock
            SET quantity_reserved = GREATEST(0, quantity_reserved - $1)
          WHERE id = $2`,
        [r.quantity, r.batch_id],
      );
    }
    return rows.length;
  }

  async deductStock(
    tenantDb: any,
    locationId: string,
    catalogId: string,
    quantity: number,
    sourceModule: string,
    sourceReferenceId: string | null,
    patientId: string | null,
    performedBy: string,
    notes?: string,
  ): Promise<void> {
    // If deducting for a prescription, convert existing soft lock to hard deduct
    if (sourceModule === 'prescription' && sourceReferenceId) {
      const { rows: reservations } = await tenantDb.query(
        `SELECT id, batch_id, quantity FROM stock_reservations
          WHERE prescription_id = $1 AND catalog_id = $2 AND location_id = $3
            AND status = 'active'
          LIMIT 1`,
        [sourceReferenceId, catalogId, locationId],
      );
      if (reservations[0]) {
        const res = reservations[0];
        await tenantDb.query(
          `UPDATE location_stock
              SET quantity_on_hand  = quantity_on_hand  - $1,
                  quantity_reserved = GREATEST(0, quantity_reserved - $1)
            WHERE id = $2`,
          [Math.min(quantity, res.quantity), res.batch_id],
        );
        await tenantDb.query(
          `UPDATE stock_reservations SET status = 'deducted', deducted_at = NOW() WHERE id = $1`,
          [res.id],
        );
        await tenantDb.query(
          `INSERT INTO stock_consumption_log
             (location_id, catalog_id, batch_number, quantity_used,
              source_module, source_reference_id, patient_id, performed_by, notes)
           SELECT $1, $2, batch_number, $3, $4, $5, $6, $7, $8
             FROM location_stock WHERE id = $9`,
          [locationId, catalogId, quantity, sourceModule, sourceReferenceId,
           patientId, performedBy, notes ?? null, res.batch_id],
        );
        await this.checkAndAlertLowStock(tenantDb, locationId, catalogId);
        return;
      }
    }

    const { rows: batches } = await tenantDb.query(
      `SELECT id, batch_number, quantity_on_hand, quantity_reserved, min_level
         FROM location_stock
        WHERE location_id = $1 AND catalog_id = $2
          AND quantity_on_hand - quantity_reserved > 0
        ORDER BY expiry_date ASC NULLS LAST, created_at ASC`,
      [locationId, catalogId],
    );

    const totalAvailable = batches.reduce(
      (sum: number, b: any) => sum + (b.quantity_on_hand - b.quantity_reserved), 0,
    );

    if (totalAvailable < quantity) {
      const catalog = await this.getCatalogItemById(tenantDb, catalogId);
      throw new StockUnavailableException(catalog.name, quantity, totalAvailable);
    }

    let remaining = quantity;
    let batchDeducted: string | null = null;
    for (const batch of batches) {
      if (remaining <= 0) break;
      const canTake = Math.min(remaining, batch.quantity_on_hand - batch.quantity_reserved);
      await tenantDb.query(
        `UPDATE location_stock
            SET quantity_on_hand = quantity_on_hand - $1,
                updated_at = NOW()
          WHERE id = $2
            AND quantity_on_hand >= $1`,
        [canTake, batch.id],
      );
      batchDeducted = batch.batch_number;
      remaining -= canTake;
    }

    await tenantDb.query(
      `INSERT INTO stock_consumption_log
         (location_id, catalog_id, batch_number, quantity_used,
          source_module, source_reference_id, patient_id, performed_by, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [
        locationId, catalogId, batchDeducted, quantity,
        sourceModule, sourceReferenceId, patientId, performedBy,
        notes ?? null,
      ],
    );

    await this.checkAndAlertLowStock(tenantDb, locationId, catalogId);

    // Auto-replenish emergency kit locations when below minimum
    try {
      const { rows: locMeta } = await tenantDb.query(
        `SELECT location_subtype FROM inventory_locations WHERE id = $1`,
        [locationId],
      );
      if (locMeta[0]?.location_subtype === 'emergency_kit') {
        const { rows: kitItem } = await tenantDb.query(
          `SELECT eki.minimum_qty, eki.replenish_qty,
                  COALESCE(SUM(ls.quantity_on_hand - ls.quantity_reserved), 0) AS current_qty
             FROM emergency_kit_items eki
             LEFT JOIN location_stock ls ON ls.catalog_id = eki.catalog_id AND ls.location_id = eki.location_id
            WHERE eki.location_id = $1 AND eki.catalog_id = $2
            GROUP BY eki.minimum_qty, eki.replenish_qty`,
          [locationId, catalogId],
        );
        if (kitItem[0] && Number(kitItem[0].current_qty) < kitItem[0].minimum_qty) {
          this.triggerEmergencyReplenishment(
            tenantDb, locationId, catalogId, kitItem[0].replenish_qty, performedBy,
          ).catch((err: any) => this.logger.warn(`Emergency replenishment trigger failed: ${err.message}`));
        }
      }
    } catch { /* non-blocking */ }
  }

  async receiveStock(
    tenantDb: any,
    locationId: string,
    catalogId: string,
    batchNumber: string | null,
    expiryDate: string | null,
    quantity: number,
    unitCost?: number,
  ): Promise<void> {
    await tenantDb.query(
      `INSERT INTO location_stock
         (location_id, catalog_id, batch_number, expiry_date,
          quantity_on_hand, unit_cost, last_restocked_at)
       VALUES ($1,$2,$3,$4,$5,$6,NOW())
       ON CONFLICT (location_id, catalog_id, COALESCE(batch_number, ''))
       DO UPDATE SET
          quantity_on_hand  = location_stock.quantity_on_hand + EXCLUDED.quantity_on_hand,
          unit_cost         = COALESCE(EXCLUDED.unit_cost, location_stock.unit_cost),
          last_restocked_at = NOW(),
          updated_at        = NOW()`,
      [locationId, catalogId, batchNumber ?? null, expiryDate ?? null, quantity, unitCost ?? null],
    );
    await tenantDb.query(
      `UPDATE storeroom_alerts
          SET resolved = true, resolved_at = NOW()
        WHERE location_id = $1 AND catalog_id = $2
          AND alert_type IN ('low_stock','stockout') AND resolved = false`,
      [locationId, catalogId],
    );
  }

  async adjustStock(tenantDb: any, dto: StockAdjustmentDto, userId: string): Promise<void> {
    if (dto.quantity_delta === 0) return;
    if (dto.quantity_delta > 0) {
      await this.receiveStock(
        tenantDb, dto.location_id, dto.catalog_id,
        dto.batch_number ?? null, null, dto.quantity_delta,
      );
    } else {
      await tenantDb.query(
        `UPDATE location_stock
            SET quantity_on_hand = GREATEST(0, quantity_on_hand + $1),
                updated_at = NOW()
          WHERE location_id = $2 AND catalog_id = $3
            AND COALESCE(batch_number,'') = COALESCE($4,'')`,
        [dto.quantity_delta, dto.location_id, dto.catalog_id, dto.batch_number ?? null],
      );
    }
    await tenantDb.query(
      `INSERT INTO stock_consumption_log
         (location_id, catalog_id, batch_number, quantity_used,
          source_module, performed_by, notes)
       VALUES ($1,$2,$3,$4,'adjustment',$5,$6)`,
      [
        dto.location_id, dto.catalog_id, dto.batch_number ?? null,
        Math.abs(dto.quantity_delta), userId, dto.notes ?? dto.reason,
      ],
    );
  }

  async recordSupplierReceipt(tenantDb: any, dto: ReceiveStockDto, userId: string): Promise<any> {
    const seq = await tenantDb.query(
      `SELECT COALESCE(MAX(CAST(SPLIT_PART(receipt_number,'-',3) AS BIGINT)),0)+1 AS next
         FROM storeroom_supplier_receipts`,
    );
    const receiptNumber = `SRR-${new Date().getFullYear()}-${String(seq.rows[0].next).padStart(5,'0')}`;

    const { rows } = await tenantDb.query(
      `INSERT INTO storeroom_supplier_receipts
         (receipt_number, location_id, supplier_id, po_reference, received_by, notes)
       VALUES ($1,$2,$3,$4,$5,$6)
       RETURNING *`,
      [
        receiptNumber, dto.location_id, dto.supplier_id ?? null,
        dto.po_reference ?? null, userId, dto.notes ?? null,
      ],
    );
    const receipt = rows[0];

    await tenantDb.query(
      `INSERT INTO storeroom_supplier_receipt_items
         (receipt_id, catalog_id, batch_number, expiry_date, quantity_received, unit_cost)
       VALUES ($1,$2,$3,$4,$5,$6)`,
      [
        receipt.id, dto.catalog_id, dto.batch_number ?? null,
        dto.expiry_date ?? null, dto.quantity, dto.unit_cost ?? null,
      ],
    );

    await this.receiveStock(
      tenantDb, dto.location_id, dto.catalog_id,
      dto.batch_number ?? null, dto.expiry_date ?? null,
      dto.quantity, dto.unit_cost,
    );

    return receipt;
  }

  // ── Stock Requests ─────────────────────────────────────────────────────────

  async createStockRequest(
    tenantDb: any, dto: CreateStockRequestDto, userId: string,
  ): Promise<any> {
    const seq = await tenantDb.query(
      `SELECT COALESCE(MAX(CAST(SPLIT_PART(request_number,'-',3) AS BIGINT)),0)+1 AS next
         FROM stock_requests`,
    );
    const requestNumber = `SR-${new Date().getFullYear()}-${String(seq.rows[0].next).padStart(5,'0')}`;

    const { rows } = await tenantDb.query(
      `INSERT INTO stock_requests
         (request_number, requesting_location_id, fulfilling_location_id,
          requested_by, priority, notes)
       VALUES ($1,$2,$3,$4,$5,$6)
       RETURNING *`,
      [
        requestNumber, dto.requesting_location_id, dto.fulfilling_location_id,
        userId, dto.priority ?? 'routine', dto.notes ?? null,
      ],
    );
    const request = rows[0];

    for (const item of dto.items) {
      await tenantDb.query(
        `INSERT INTO stock_request_items
           (request_id, catalog_id, quantity_requested, notes)
         VALUES ($1,$2,$3,$4)`,
        [request.id, item.catalog_id, item.quantity_requested, item.notes ?? null],
      );
    }
    return this.getStockRequestById(tenantDb, request.id);
  }

  async listStockRequests(
    tenantDb: any,
    filters: { status?: string; locationId?: string } = {},
  ): Promise<any[]> {
    const conds: string[] = [];
    const vals: any[] = [];
    let i = 1;
    if (filters.status) { conds.push(`r.status = $${i++}`); vals.push(filters.status); }
    if (filters.locationId) {
      conds.push(`(r.requesting_location_id = $${i} OR r.fulfilling_location_id = $${i})`);
      vals.push(filters.locationId); i++;
    }
    const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';
    const { rows } = await tenantDb.query(
      `SELECT r.*,
              rl.name AS requesting_location_name,
              fl.name AS fulfilling_location_name,
              u.first_name || ' ' || u.last_name AS requested_by_name,
              (SELECT json_agg(
                  json_build_object(
                    'id', i.id,
                    'catalog_id', i.catalog_id,
                    'item_name', c.name,
                    'category', c.category,
                    'unit_of_measure', c.unit_of_measure,
                    'quantity_requested', i.quantity_requested,
                    'quantity_approved', i.quantity_approved,
                    'quantity_fulfilled', i.quantity_fulfilled
                  )
                )
               FROM stock_request_items i
               JOIN storeroom_catalog c ON c.id = i.catalog_id
               WHERE i.request_id = r.id
              ) AS items
         FROM stock_requests r
         JOIN inventory_locations rl ON rl.id = r.requesting_location_id
         JOIN inventory_locations fl ON fl.id = r.fulfilling_location_id
         LEFT JOIN users u ON u.id = r.requested_by
        ${where}
        ORDER BY
          CASE r.priority WHEN 'urgent' THEN 0 ELSE 1 END,
          r.created_at DESC`,
      vals,
    );
    return rows;
  }

  async getStockRequestById(tenantDb: any, id: string): Promise<any> {
    const rows = await this.listStockRequests(tenantDb, {});
    const found = rows.find((r: any) => r.id === id);
    if (!found) throw new NotFoundException(`Stock request ${id} not found`);
    return found;
  }

  async approveStockRequest(
    tenantDb: any, requestId: string, dto: ApproveRequestDto, userId: string,
  ): Promise<any> {
    for (const ai of dto.approved_items) {
      await tenantDb.query(
        `UPDATE stock_request_items SET quantity_approved = $1 WHERE id = $2`,
        [ai.quantity_approved, ai.item_id],
      );
    }
    await tenantDb.query(
      `UPDATE stock_requests
          SET status = 'approved', approved_by = $1, approved_at = NOW(), updated_at = NOW()
        WHERE id = $2`,
      [userId, requestId],
    );
    return this.getStockRequestById(tenantDb, requestId);
  }

  async rejectStockRequest(
    tenantDb: any, requestId: string, reason: string, userId: string,
  ): Promise<any> {
    const { rows } = await tenantDb.query(
      `UPDATE stock_requests
          SET status = 'rejected', rejection_reason = $1,
              approved_by = $2, approved_at = NOW(), updated_at = NOW()
        WHERE id = $3
        RETURNING *`,
      [reason, userId, requestId],
    );
    if (!rows[0]) throw new NotFoundException(`Stock request ${requestId} not found`);
    return rows[0];
  }

  // ── Transfers ──────────────────────────────────────────────────────────────

  async createTransfer(tenantDb: any, dto: CreateTransferDto, userId: string): Promise<any> {
    const seq = await tenantDb.query(
      `SELECT COALESCE(MAX(CAST(SPLIT_PART(transfer_number,'-',3) AS BIGINT)),0)+1 AS next
         FROM stock_transfers`,
    );
    const transferNumber = `ST-${new Date().getFullYear()}-${String(seq.rows[0].next).padStart(5,'0')}`;

    const { rows } = await tenantDb.query(
      `INSERT INTO stock_transfers
         (transfer_number, request_id, from_location_id, to_location_id, transferred_by, notes)
       VALUES ($1,$2,$3,$4,$5,$6)
       RETURNING *`,
      [
        transferNumber, dto.request_id ?? null,
        dto.from_location_id, dto.to_location_id, userId, dto.notes ?? null,
      ],
    );
    const transfer = rows[0];

    for (const item of dto.items) {
      await tenantDb.query(
        `INSERT INTO stock_transfer_items
           (transfer_id, catalog_id, batch_number, expiry_date, quantity_transferred)
         VALUES ($1,$2,$3,$4,$5)`,
        [
          transfer.id, item.catalog_id, item.batch_number ?? null,
          item.expiry_date ?? null, item.quantity_transferred,
        ],
      );
      await this.deductStock(
        tenantDb, dto.from_location_id, item.catalog_id, item.quantity_transferred,
        'transfer', transfer.id, null, userId,
        `Transfer ${transferNumber} to ${dto.to_location_id}`,
      );
    }
    return transfer;
  }

  async listTransfers(
    tenantDb: any,
    filters: { status?: string; from?: string; to?: string } = {},
  ): Promise<any[]> {
    const conds: string[] = [];
    const vals: any[] = [];
    let i = 1;
    if (filters.status) { conds.push(`t.status = $${i++}`); vals.push(filters.status); }
    if (filters.from) { conds.push(`t.from_location_id = $${i++}`); vals.push(filters.from); }
    if (filters.to) { conds.push(`t.to_location_id = $${i++}`); vals.push(filters.to); }
    const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';
    const { rows } = await tenantDb.query(
      `SELECT t.*,
              fl.name AS from_location_name, tl.name AS to_location_name,
              u.first_name || ' ' || u.last_name AS transferred_by_name,
              (SELECT json_agg(json_build_object(
                  'id', i.id, 'catalog_id', i.catalog_id, 'item_name', c.name,
                  'batch_number', i.batch_number, 'expiry_date', i.expiry_date,
                  'quantity_transferred', i.quantity_transferred,
                  'quantity_received', i.quantity_received,
                  'condition', i.condition
               ))
               FROM stock_transfer_items i
               JOIN storeroom_catalog c ON c.id = i.catalog_id
               WHERE i.transfer_id = t.id
              ) AS items
         FROM stock_transfers t
         JOIN inventory_locations fl ON fl.id = t.from_location_id
         JOIN inventory_locations tl ON tl.id = t.to_location_id
         LEFT JOIN users u ON u.id = t.transferred_by
        ${where}
        ORDER BY t.dispatched_at DESC`,
      vals,
    );
    return rows;
  }

  async receiveTransfer(
    tenantDb: any, transferId: string,
    receivedItems: ReceiveTransferItemDto[], userId: string,
  ): Promise<any> {
    const { rows: [transfer] } = await tenantDb.query(
      `SELECT * FROM stock_transfers WHERE id = $1`, [transferId],
    );
    if (!transfer) throw new NotFoundException(`Transfer ${transferId} not found`);

    for (const ri of receivedItems) {
      const { rows: [item] } = await tenantDb.query(
        `SELECT * FROM stock_transfer_items WHERE id = $1`, [ri.item_id],
      );
      if (!item) continue;

      await tenantDb.query(
        `UPDATE stock_transfer_items
            SET quantity_received = $1, condition = $2
          WHERE id = $3`,
        [ri.quantity_received, ri.condition, ri.item_id],
      );

      if (ri.condition !== 'expired' && ri.condition !== 'damaged' && ri.quantity_received > 0) {
        await this.receiveStock(
          tenantDb, transfer.to_location_id, item.catalog_id,
          item.batch_number, item.expiry_date, ri.quantity_received,
        );
      }
    }

    const allReceived = receivedItems.every(
      (ri) => ri.quantity_received >= (receivedItems.find(x => x.item_id === ri.item_id)?.quantity_received ?? 0),
    );
    await tenantDb.query(
      `UPDATE stock_transfers
          SET status = $1, received_by = $2, received_at = NOW()
        WHERE id = $3`,
      [allReceived ? 'received' : 'partially_received', userId, transferId],
    );

    if (transfer.request_id) {
      await this.refreshRequestStatus(tenantDb, transfer.request_id);
    }

    return this.listTransfers(tenantDb, {}).then(ts => ts.find((t: any) => t.id === transferId));
  }

  // ── Dashboard & Analytics ──────────────────────────────────────────────────

  async getDashboardStats(tenantDb: any): Promise<any> {
    const [catalog, stock, alerts, requests, expiring] = await Promise.all([
      tenantDb.query(`SELECT COUNT(*) AS total FROM storeroom_catalog WHERE is_active = true`),
      tenantDb.query(`
        SELECT
          COUNT(*) FILTER (WHERE quantity_on_hand = 0) AS stockout_count,
          COUNT(*) FILTER (WHERE quantity_on_hand > 0 AND quantity_on_hand <= min_level) AS low_stock_count,
          COUNT(*) AS total_stock_rows
        FROM location_stock`),
      tenantDb.query(`SELECT COUNT(*) AS open FROM storeroom_alerts WHERE resolved = false`),
      tenantDb.query(`SELECT COUNT(*) AS pending FROM stock_requests WHERE status = 'pending'`),
      tenantDb.query(`
        SELECT ls.*, c.name AS item_name, l.name AS location_name
          FROM location_stock ls
          JOIN storeroom_catalog c ON c.id = ls.catalog_id
          JOIN inventory_locations l ON l.id = ls.location_id
         WHERE ls.expiry_date IS NOT NULL
           AND ls.expiry_date <= CURRENT_DATE + INTERVAL '30 days'
           AND ls.quantity_on_hand > 0
         ORDER BY ls.expiry_date ASC
         LIMIT 10`),
    ]);
    return {
      total_catalog_items: Number(catalog.rows[0].total),
      stockout_count: Number(stock.rows[0].stockout_count),
      low_stock_count: Number(stock.rows[0].low_stock_count),
      open_alerts: Number(alerts.rows[0].open),
      pending_requests: Number(requests.rows[0].pending),
      expiring_soon: expiring.rows,
    };
  }

  async getConsumptionSummary(
    tenantDb: any,
    filters: { locationId?: string; catalogId?: string; from?: Date; to?: Date; groupBy?: 'day' | 'week' | 'month' } = {},
  ): Promise<any[]> {
    const conds: string[] = [];
    const vals: any[] = [];
    let i = 1;
    if (filters.locationId) { conds.push(`location_id = $${i++}`); vals.push(filters.locationId); }
    if (filters.catalogId)  { conds.push(`catalog_id = $${i++}`); vals.push(filters.catalogId); }
    if (filters.from) { conds.push(`performed_at >= $${i++}`); vals.push(filters.from); }
    if (filters.to)   { conds.push(`performed_at <= $${i++}`); vals.push(filters.to); }
    const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';
    const trunc = filters.groupBy ?? 'week';
    const { rows } = await tenantDb.query(
      `SELECT DATE_TRUNC('${trunc}', performed_at) AS period,
              catalog_id, location_id,
              SUM(quantity_used) AS total_used,
              COUNT(*) AS event_count
         FROM stock_consumption_log
        ${where}
        GROUP BY DATE_TRUNC('${trunc}', performed_at), catalog_id, location_id
        ORDER BY period DESC`,
      vals,
    );
    return rows;
  }

  async getLowStockAlerts(tenantDb: any): Promise<any[]> {
    const { rows } = await tenantDb.query(
      `SELECT a.*, c.name AS item_name, l.name AS location_name
         FROM storeroom_alerts a
         LEFT JOIN storeroom_catalog c ON c.id = a.catalog_id
         LEFT JOIN inventory_locations l ON l.id = a.location_id
        WHERE a.resolved = false
        ORDER BY CASE a.severity WHEN 'critical' THEN 0 WHEN 'high' THEN 1
                                 WHEN 'medium' THEN 2 ELSE 3 END,
                 a.created_at DESC`,
    );
    return rows;
  }

  // ── Internal Helpers ───────────────────────────────────────────────────────

  async getExpiringBatches(
    tenantDb: any,
    locationId: string | null,
    withinDays: number,
  ): Promise<any[]> {
    const cutoff = new Date(Date.now() + withinDays * 24 * 60 * 60 * 1000).toISOString();
    const params: any[] = [cutoff];
    let locationClause = '';
    if (locationId) {
      params.push(locationId);
      locationClause = `AND ls.location_id = $${params.length}`;
    }
    const { rows } = await tenantDb.query(
      `SELECT
         ls.id            AS batch_id,
         ls.location_id,
         il.name          AS location_name,
         ls.catalog_id,
         sc.name          AS item_name,
         sc.requires_refrigeration,
         ls.batch_number,
         ls.expiry_date,
         ls.quantity_on_hand,
         ls.quantity_reserved,
         ls.unit_cost,
         (ls.quantity_on_hand * COALESCE(ls.unit_cost, 0)) AS estimated_waste_value
       FROM location_stock ls
       JOIN inventory_locations il ON il.id = ls.location_id
       JOIN storeroom_catalog sc   ON sc.id = ls.catalog_id
       WHERE ls.expiry_date <= $1
         AND ls.quantity_on_hand > 0
         ${locationClause}
       ORDER BY ls.expiry_date ASC`,
      params,
    );
    return rows;
  }

  async getFEFOBatches(
    tenantDb: any,
    locationId: string,
    catalogId: string,
  ): Promise<any[]> {
    const { rows } = await tenantDb.query(
      `SELECT
         ls.id         AS batch_id,
         ls.batch_number,
         ls.expiry_date,
         ls.quantity_on_hand,
         ls.quantity_reserved,
         ls.quantity_on_hand - ls.quantity_reserved AS quantity_available,
         sc.requires_refrigeration,
         CASE
           WHEN ls.expiry_date IS NOT NULL AND ls.expiry_date <= NOW() + INTERVAL '7 days'  THEN 'critical'
           WHEN ls.expiry_date IS NOT NULL AND ls.expiry_date <= NOW() + INTERVAL '30 days' THEN 'expiring_soon'
           ELSE 'ok'
         END AS expiry_status
       FROM location_stock ls
       JOIN storeroom_catalog sc ON sc.id = ls.catalog_id
       WHERE ls.location_id = $1
         AND ls.catalog_id  = $2
         AND ls.quantity_on_hand - ls.quantity_reserved > 0
       ORDER BY ls.expiry_date ASC NULLS LAST, ls.created_at ASC`,
      [locationId, catalogId],
    );
    return rows;
  }

  async markColdChain(
    tenantDb: any,
    catalogId: string,
    requiresRefrigeration: boolean,
    notes?: string,
  ): Promise<void> {
    await tenantDb.query(
      `UPDATE storeroom_catalog
          SET requires_refrigeration = $1,
              cold_chain_notes = COALESCE($2, cold_chain_notes)
        WHERE id = $3`,
      [requiresRefrigeration, notes ?? null, catalogId],
    );
  }

  async getEmergencyKitStatus(tenantDb: any, maternityLocationId: string): Promise<any[]> {
    const { rows } = await tenantDb.query(
      `SELECT
         eki.id            AS kit_item_id,
         eki.catalog_id,
         sc.name           AS drug_name,
         eki.minimum_qty,
         eki.replenish_qty,
         COALESCE(SUM(ls.quantity_on_hand - ls.quantity_reserved), 0) AS current_qty,
         CASE
           WHEN COALESCE(SUM(ls.quantity_on_hand - ls.quantity_reserved), 0) = 0 THEN 'stockout'
           WHEN COALESCE(SUM(ls.quantity_on_hand - ls.quantity_reserved), 0) < eki.minimum_qty THEN 'critical'
           ELSE 'ok'
         END AS status
       FROM emergency_kit_items eki
       JOIN storeroom_catalog sc ON sc.id = eki.catalog_id
       LEFT JOIN location_stock ls ON ls.catalog_id = eki.catalog_id
         AND ls.location_id = eki.location_id
         AND ls.quantity_on_hand > 0
       WHERE eki.location_id = $1
       GROUP BY eki.id, eki.catalog_id, sc.name, eki.minimum_qty, eki.replenish_qty`,
      [maternityLocationId],
    );
    return rows;
  }

  async triggerEmergencyReplenishment(
    tenantDb: any,
    kitLocationId: string,
    catalogId: string,
    replenishQty: number,
    triggeredBy = 'system',
  ): Promise<void> {
    const { rows: central } = await tenantDb.query(
      `SELECT id FROM inventory_locations WHERE location_type = 'central' LIMIT 1`,
    );
    if (!central[0]) return;

    await tenantDb.query(
      `INSERT INTO stock_transfers
         (from_location_id, to_location_id, catalog_id, quantity, status, requested_by, notes)
       VALUES ($1, $2, $3, $4, 'pending', $5, 'Auto-replenishment: emergency kit below minimum threshold')
       ON CONFLICT DO NOTHING`,
      [central[0].id, kitLocationId, catalogId, replenishQty, triggeredBy],
    );
  }

  async getArvStockVsPatientLoad(tenantDb: any): Promise<any[]> {
    const { rows: arvStock } = await tenantDb.query(
      `SELECT
         sc.id AS catalog_id,
         sc.name,
         COALESCE(SUM(ls.quantity_on_hand - ls.quantity_reserved), 0) AS available_qty
       FROM storeroom_catalog sc
       LEFT JOIN location_stock ls ON ls.catalog_id = sc.id AND ls.quantity_on_hand > 0
       WHERE sc.is_arv = true
       GROUP BY sc.id, sc.name`,
    );

    const { rows: patientLoad } = await tenantDb.query(
      `SELECT
         p.drug_id,
         COUNT(DISTINCT p.patient_id) AS patients_due,
         SUM(p.quantity)              AS total_qty_needed
       FROM prescriptions p
       WHERE p.next_refill_date <= NOW() + INTERVAL '30 days'
         AND p.status = 'active'
       GROUP BY p.drug_id`,
    ).catch(() => ({ rows: [] }));

    const loadMap: Record<string, { patients_due: number; total_qty_needed: number }> = {};
    for (const pl of patientLoad) {
      loadMap[pl.drug_id] = { patients_due: Number(pl.patients_due), total_qty_needed: Number(pl.total_qty_needed) };
    }

    return arvStock.map((arv: any) => {
      const load = loadMap[arv.catalog_id] ?? { patients_due: 0, total_qty_needed: 0 };
      const shortage = Math.max(0, load.total_qty_needed - Number(arv.available_qty));
      return {
        catalog_id: arv.catalog_id,
        drug_name: arv.name,
        available_qty: Number(arv.available_qty),
        patients_due: load.patients_due,
        total_qty_needed: load.total_qty_needed,
        shortage,
        status: shortage > 0 ? 'shortage' : Number(arv.available_qty) < load.total_qty_needed * 1.2 ? 'low_buffer' : 'adequate',
      };
    });
  }

  async checkChemoIngredients(
    tenantDb: any,
    regimenId: string,
    locationId: string,
  ): Promise<{ ready: boolean; missing: any[] }> {
    const { rows: components } = await tenantDb.query(
      `SELECT
         crc.catalog_id,
         sc.name,
         crc.quantity_per_session,
         COALESCE(SUM(ls.quantity_on_hand - ls.quantity_reserved), 0) AS available_qty
       FROM chemo_regimen_components crc
       JOIN storeroom_catalog sc ON sc.id = crc.catalog_id
       LEFT JOIN location_stock ls ON ls.catalog_id = crc.catalog_id
         AND ls.location_id = $2
         AND ls.quantity_on_hand > 0
       WHERE crc.regimen_id = $1
       GROUP BY crc.catalog_id, sc.name, crc.quantity_per_session`,
      [regimenId, locationId],
    );

    const missing = components.filter(
      (c: any) => Number(c.available_qty) < c.quantity_per_session,
    );
    return { ready: missing.length === 0, missing };
  }

  async createPurchaseOrder(
    tenantDb: any,
    supplierId: string,
    items: Array<{ catalogId: string; locationId: string; quantityOrdered: number; unitCost?: number }>,
    createdBy: string,
    autoGenerated = false,
  ): Promise<string> {
    const { rows } = await tenantDb.query(
      `INSERT INTO storeroom_purchase_orders (supplier_id, created_by, auto_generated, status)
       VALUES ($1, $2, $3, 'draft') RETURNING id`,
      [supplierId, createdBy, autoGenerated],
    );
    const poId = rows[0].id;

    for (const item of items) {
      await tenantDb.query(
        `INSERT INTO storeroom_po_items (po_id, catalog_id, to_location_id, quantity_ordered, unit_cost)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (po_id, catalog_id) DO UPDATE SET quantity_ordered = EXCLUDED.quantity_ordered`,
        [poId, item.catalogId, item.locationId, item.quantityOrdered, item.unitCost ?? null],
      );
    }

    await tenantDb.query(
      `UPDATE storeroom_purchase_orders
          SET total_amount = (SELECT SUM(quantity_ordered * COALESCE(unit_cost, 0)) FROM storeroom_po_items WHERE po_id = $1)
        WHERE id = $1`,
      [poId],
    );
    return poId;
  }

  async submitPurchaseOrder(tenantDb: any, poId: string): Promise<void> {
    await tenantDb.query(
      `UPDATE storeroom_purchase_orders po
          SET status = 'submitted',
              ordered_at = NOW(),
              expected_at = NOW() + (
                SELECT (s.lead_time_days || ' days')::INTERVAL
                  FROM storeroom_suppliers s WHERE s.id = po.supplier_id
              )
        WHERE po.id = $1 AND po.status = 'draft'`,
      [poId],
    );
  }

  async receivePOItems(
    tenantDb: any,
    poId: string,
    received: Array<{ poItemId: string; quantityReceived: number; batchNumber?: string; expiryDate?: string; unitCost?: number }>,
    receivedBy: string,
  ): Promise<void> {
    for (const r of received) {
      const { rows } = await tenantDb.query(
        `UPDATE storeroom_po_items
            SET quantity_received = quantity_received + $1,
                received_at = NOW(),
                unit_cost = COALESCE($2, unit_cost)
          WHERE id = $3
          RETURNING catalog_id, to_location_id`,
        [r.quantityReceived, r.unitCost ?? null, r.poItemId],
      );
      if (!rows[0]) continue;

      await tenantDb.query(
        `INSERT INTO location_stock
           (location_id, catalog_id, quantity_on_hand, batch_number, expiry_date, unit_cost)
         VALUES ($1, $2, $3, $4, $5::DATE, $6)
         ON CONFLICT (location_id, catalog_id, COALESCE(batch_number, ''))
         DO UPDATE SET quantity_on_hand = location_stock.quantity_on_hand + EXCLUDED.quantity_on_hand`,
        [rows[0].to_location_id, rows[0].catalog_id, r.quantityReceived,
         r.batchNumber ?? null, r.expiryDate ?? null, r.unitCost ?? null],
      );
    }

    await tenantDb.query(
      `UPDATE storeroom_purchase_orders po
          SET status = CASE
            WHEN (SELECT COUNT(*) FROM storeroom_po_items poi
                  WHERE poi.po_id = po.id AND poi.quantity_received < poi.quantity_ordered) = 0
            THEN 'fulfilled'
            WHEN (SELECT SUM(quantity_received) FROM storeroom_po_items WHERE po_id = po.id) > 0
            THEN 'partial'
            ELSE status
          END,
          fulfilled_at = CASE
            WHEN (SELECT COUNT(*) FROM storeroom_po_items poi
                  WHERE poi.po_id = po.id AND poi.quantity_received < poi.quantity_ordered) = 0
            THEN NOW()
            ELSE NULL
          END
        WHERE id = $1`,
      [poId],
    );
  }

  async autoGeneratePOs(tenantDb: any): Promise<number> {
    const { rows: items } = await tenantDb.query(
      `SELECT
         sc.id                    AS catalog_id,
         sc.preferred_supplier_id AS supplier_id,
         il.id                    AS location_id,
         COALESCE(SUM(ls.quantity_on_hand - ls.quantity_reserved), 0) AS available_qty,
         sc.reorder_level,
         sc.reorder_quantity
       FROM storeroom_catalog sc
       JOIN inventory_locations il ON il.location_type = 'central'
       LEFT JOIN location_stock ls ON ls.catalog_id = sc.id AND ls.location_id = il.id
       WHERE sc.preferred_supplier_id IS NOT NULL
         AND sc.reorder_level IS NOT NULL
         AND sc.reorder_quantity IS NOT NULL
       GROUP BY sc.id, sc.preferred_supplier_id, il.id, sc.reorder_level, sc.reorder_quantity
       HAVING COALESCE(SUM(ls.quantity_on_hand - ls.quantity_reserved), 0) <= sc.reorder_level`,
    );

    if (items.length === 0) return 0;

    const bySupplier: Record<string, typeof items> = {};
    for (const item of items) {
      const key = item.supplier_id;
      bySupplier[key] = bySupplier[key] ?? [];
      bySupplier[key].push(item);
    }

    let created = 0;
    for (const [supplierId, supplierItems] of Object.entries(bySupplier)) {
      await this.createPurchaseOrder(
        tenantDb,
        supplierId,
        supplierItems.map((i: any) => ({
          catalogId: i.catalog_id,
          locationId: i.location_id,
          quantityOrdered: i.reorder_quantity,
        })),
        'system',
        true,
      );
      created++;
    }
    return created;
  }

  private async checkAndAlertLowStock(
    tenantDb: any, locationId: string, catalogId: string,
  ): Promise<void> {
    const { rows: [stock] } = await tenantDb.query(
      `SELECT quantity_on_hand, min_level FROM location_stock
        WHERE location_id = $1 AND catalog_id = $2
        ORDER BY quantity_on_hand ASC LIMIT 1`,
      [locationId, catalogId],
    );
    if (!stock) return;

    const qoh = Number(stock.quantity_on_hand);
    const min = Number(stock.min_level);
    if (qoh > min) return;

    const alertType = qoh === 0 ? 'stockout' : 'low_stock';
    const severity  = qoh === 0 ? 'critical' : 'high';
    const catalog = await this.getCatalogItemById(tenantDb, catalogId);
    const location = await this.getLocationById(tenantDb, locationId);

    await tenantDb.query(
      `INSERT INTO storeroom_alerts
         (alert_type, severity, location_id, catalog_id, message)
       VALUES ($1,$2,$3,$4,$5)
       ON CONFLICT (alert_type, location_id, catalog_id, resolved) DO NOTHING`,
      [
        alertType, severity, locationId, catalogId,
        `${catalog.name} at ${location.name}: ${qoh === 0 ? 'STOCKOUT' : `only ${qoh} remaining (min: ${min})`}`,
      ],
    );

    if (catalog.default_reorder_qty > 0) {
      const { rows: existing } = await tenantDb.query(
        `SELECT sr.id FROM stock_requests sr
          JOIN stock_request_items sri ON sri.request_id = sr.id
         WHERE sr.requesting_location_id = $1
           AND sri.catalog_id = $2
           AND sr.status IN ('pending','approved')
         LIMIT 1`,
        [locationId, catalogId],
      );
      if (existing.length === 0) {
        const { rows: [central] } = await tenantDb.query(
          `SELECT id FROM inventory_locations WHERE code = 'CENTRAL' LIMIT 1`,
        );
        if (central) {
          await this.createStockRequest(tenantDb, {
            requesting_location_id: locationId,
            fulfilling_location_id: central.id,
            priority: qoh === 0 ? 'urgent' : 'routine',
            notes: `Auto-generated: stock dropped below minimum level`,
            items: [{ catalog_id: catalogId, quantity_requested: catalog.default_reorder_qty }],
          }, 'system');
        }
      }
    }
  }

  private async refreshRequestStatus(tenantDb: any, requestId: string): Promise<void> {
    const { rows: items } = await tenantDb.query(
      `SELECT quantity_requested, quantity_fulfilled FROM stock_request_items WHERE request_id = $1`,
      [requestId],
    );
    const allFulfilled = items.every(
      (i: any) => i.quantity_fulfilled >= i.quantity_requested,
    );
    const anyFulfilled = items.some((i: any) => i.quantity_fulfilled > 0);
    const newStatus = allFulfilled ? 'fulfilled' : anyFulfilled ? 'partially_fulfilled' : 'approved';
    await tenantDb.query(
      `UPDATE stock_requests
          SET status = $1, fulfilled_at = CASE WHEN $1 = 'fulfilled' THEN NOW() ELSE NULL END,
              updated_at = NOW()
        WHERE id = $2`,
      [newStatus, requestId],
    );
  }
}
