import { Injectable, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { TenantService } from './tenant.service';

export interface FacilityStockLevel {
  facilitySubdomain: string;
  itemCode: string;
  itemName: string;
  category: string;
  currentStock: number;
  minStockLevel: number;
  reorderPoint: number;
  isShortage: boolean;
  isSurplus: boolean;
}

export interface RebalanceRecommendation {
  itemCode: string;
  itemName: string;
  surplusFacility: string;
  shortageFacility: string;
  recommendedTransferQty: number;
  urgency: 'low' | 'medium' | 'high';
}

@Injectable()
export class CrossFacilityStockService {
  private readonly logger = new Logger(CrossFacilityStockService.name);

  constructor(private readonly tenantService: TenantService) {}

  async getNetworkStockLevels(): Promise<FacilityStockLevel[]> {
    const tenants = await this.tenantService.getAllActiveTenants();
    const results: FacilityStockLevel[] = [];

    for (const tenant of tenants) {
      try {
        const db = await this.tenantService.getTenantDatabase(tenant.subdomain);
        if (!db) continue;

        const rows = await db.query(
          `SELECT item_code, item_name, category,
                  current_stock, min_stock_level, reorder_point
           FROM storeroom_items
           WHERE is_active = TRUE`,
        );

        for (const row of rows) {
          const current = Number(row.current_stock ?? 0);
          const min = Number(row.min_stock_level ?? 0);
          const reorder = Number(row.reorder_point ?? 0);
          results.push({
            facilitySubdomain: tenant.subdomain,
            itemCode:          row.item_code,
            itemName:          row.item_name,
            category:          row.category,
            currentStock:      current,
            minStockLevel:     min,
            reorderPoint:      reorder,
            isShortage:        current < min,
            isSurplus:         min > 0 && current > min * 3,
          });
        }
      } catch (err: any) {
        this.logger.warn(`Stock query failed for tenant ${tenant.subdomain}: ${err.message}`);
      }
    }
    return results;
  }

  async getRebalanceRecommendations(): Promise<RebalanceRecommendation[]> {
    const levels = await this.getNetworkStockLevels();
    const recommendations: RebalanceRecommendation[] = [];

    const shortages = levels.filter((l) => l.isShortage);
    const surpluses  = levels.filter((l) => l.isSurplus);

    for (const shortage of shortages) {
      const surplus = surpluses.find(
        (s) => s.itemCode === shortage.itemCode && s.facilitySubdomain !== shortage.facilitySubdomain,
      );
      if (!surplus) continue;

      const needed  = shortage.minStockLevel - shortage.currentStock;
      const available = surplus.currentStock - surplus.minStockLevel;
      const qty = Math.min(needed, Math.floor(available / 2));
      if (qty <= 0) continue;

      recommendations.push({
        itemCode:               shortage.itemCode,
        itemName:               shortage.itemName,
        surplusFacility:        surplus.facilitySubdomain,
        shortageFacility:       shortage.facilitySubdomain,
        recommendedTransferQty: qty,
        urgency:                shortage.currentStock === 0 ? 'high' : shortage.currentStock < shortage.reorderPoint ? 'medium' : 'low',
      });
    }
    return recommendations;
  }

  async raiseTransferOrder(
    db: DataSource,
    itemId: string,
    quantity: number,
    fromFacility: string,
    toFacility: string,
    requestedBy: string,
    notes?: string,
  ): Promise<string> {
    const [row] = await db.query(
      `INSERT INTO stock_transfer_orders
         (item_id, quantity, from_facility, to_facility, requested_by, notes)
       VALUES ($1,$2,$3,$4,$5,$6)
       RETURNING id`,
      [itemId, quantity, fromFacility, toFacility, requestedBy, notes ?? null],
    );
    this.logger.log(`Transfer order raised: ${quantity} of item=${itemId} from=${fromFacility} to=${toFacility}`);
    return row.id;
  }

  async updateTransferStatus(
    db: DataSource,
    orderId: string,
    status: 'approved' | 'dispatched' | 'received' | 'cancelled',
    userId: string,
  ): Promise<void> {
    const extra: Record<string, string> = {
      dispatched: 'dispatched_at = now(),',
      received:   'received_at = now(),',
    };
    const extraSql = extra[status] ?? '';
    const approvedSql = status === 'approved' ? 'approved_by = $3,' : '';
    await db.query(
      `UPDATE stock_transfer_orders
       SET status = $1, ${approvedSql} ${extraSql} updated_at = now()
       WHERE id = $2`,
      status === 'approved' ? [status, orderId, userId] : [status, orderId],
    );
  }

  async listTransferOrders(db: DataSource, status?: string): Promise<any[]> {
    const where = status ? `WHERE sto.status = $1` : '';
    const params = status ? [status] : [];
    return db.query(
      `SELECT sto.*, si.item_name, si.item_code
       FROM stock_transfer_orders sto
       LEFT JOIN storeroom_items si ON si.id = sto.item_id
       ${where}
       ORDER BY sto.created_at DESC`,
      params,
    );
  }
}
