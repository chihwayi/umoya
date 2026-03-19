import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { TenantService } from './tenant.service';
import { StockoutPrediction } from '../entities/stockout-prediction.entity';
import { ProcurementAlert } from '../entities/procurement-alert.entity';
import axios from 'axios';

@Injectable()
export class SupplyChainAiService {
  private readonly logger = new Logger(SupplyChainAiService.name);
  private cdssUrl = process.env.CDSS_SERVICE_URL || 'http://localhost:8001';

  constructor(private readonly tenantService: TenantService) {}

  // ── On-demand prediction ───────────────────────────────────────────────────

  async predictStockouts(subdomain: string, drugName?: string): Promise<StockoutPrediction[]> {
    const ds = await this.tenantService.getTenantDatabase(subdomain);

    const drugs = await this.fetchDrugInventory(ds, drugName);
    if (!drugs.length) return [];

    const results: StockoutPrediction[] = [];

    for (const drug of drugs) {
      const prediction = await this.predictForDrug(ds, drug);
      if (prediction) results.push(prediction);
    }

    return results;
  }

  async getPredictions(subdomain: string): Promise<StockoutPrediction[]> {
    const ds = await this.tenantService.getTenantDatabase(subdomain);
    return ds.getRepository(StockoutPrediction).find({
      order: { daysToStockout: 'ASC' },
      take: 100,
    });
  }

  async getProcurementAlerts(subdomain: string): Promise<ProcurementAlert[]> {
    const ds = await this.tenantService.getTenantDatabase(subdomain);
    return ds.getRepository(ProcurementAlert).find({
      where: { status: 'open' },
      order: { daysToStockout: 'ASC' },
    });
  }

  async acknowledgeProcurementAlert(subdomain: string, alertId: string, userId: string, orderRef?: string): Promise<ProcurementAlert | null> {
    const ds = await this.tenantService.getTenantDatabase(subdomain);
    const repo = ds.getRepository(ProcurementAlert);
    await repo.update(alertId, {
      status: orderRef ? 'ordered' : 'acknowledged',
      acknowledgedBy: userId,
      acknowledgedAt: new Date(),
      orderReference: orderRef,
    });
    return repo.findOneBy({ id: alertId });
  }

  // ── Daily cron ─────────────────────────────────────────────────────────────

  @Cron('0 6 * * *') // Every day 06:00
  async dailyStockoutSweep() {
    this.logger.log('Running daily supply chain stockout prediction sweep…');
    try {
      const tenants = await this.tenantService.getAllActiveTenants?.() ?? [];
      for (const subdomain of tenants) {
        await this.predictStockouts(subdomain).catch(e =>
          this.logger.error(`Stockout sweep failed for ${subdomain}: ${e?.message}`));
      }
    } catch (e: any) {
      this.logger.error(`Daily stockout sweep error: ${e?.message}`);
    }
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  private async fetchDrugInventory(ds: any, drugName?: string): Promise<any[]> {
    const where = drugName ? `AND d.name ILIKE '%${drugName.replace(/'/g, '')}%'` : '';
    return ds.query(`
      SELECT d.id, d.name,
             COALESCE(ph.quantity_on_hand, 0) AS current_stock,
             COALESCE(ph.reorder_level, 30) AS safety_stock_days
      FROM drugs d
      LEFT JOIN pharmacy_inventory ph ON ph.drug_id = d.id
      WHERE d.is_active = TRUE ${where}
      LIMIT 200
    `).catch(() => []);
  }

  private async predictForDrug(ds: any, drug: any): Promise<StockoutPrediction | null> {
    // Calculate consumption velocity from last 90 days of prescriptions
    const consumption = await ds.query(`
      SELECT COUNT(*)::float / 90 AS avg_daily
      FROM prescription_items pi
      INNER JOIN prescriptions p ON p.id = pi.prescription_id
      WHERE pi.drug_name ILIKE $1
      AND p.created_at > NOW() - INTERVAL '90 days'
    `, [`%${drug.name}%`]).catch(() => [{ avg_daily: 0 }]);

    const avgDaily = Number(consumption[0]?.avg_daily || 0);
    if (avgDaily === 0) return null;

    let predData: any = { seasonal_factor: 1.0 };
    try {
      const { data } = await axios.post(`${this.cdssUrl}/supply/stockout-predict`, {
        drugName: drug.name,
        currentStock: drug.current_stock,
        avgDailyConsumption: avgDaily,
        safetyStockDays: drug.safety_stock_days,
      }, { timeout: 5000 });
      predData = data;
    } catch {}

    const seasonalFactor = predData.seasonal_factor || 1.0;
    const adjustedDaily = avgDaily * seasonalFactor;
    const daysToStockout = adjustedDaily > 0 ? drug.current_stock / adjustedDaily : 999;

    const stockoutDate = new Date();
    stockoutDate.setDate(stockoutDate.getDate() + Math.floor(daysToStockout));

    const riskLevel = daysToStockout <= 7 ? 'critical'
      : daysToStockout <= 14 ? 'high'
      : daysToStockout <= 30 ? 'medium' : 'low';

    const reorderQuantity = Math.ceil(adjustedDaily * 90); // 90-day supply

    const predRepo = ds.getRepository(StockoutPrediction);
    const saved = await predRepo.save(predRepo.create({
      drugId: drug.id,
      drugName: drug.name,
      currentStockUnits: drug.current_stock,
      avgDailyConsumption: avgDaily,
      daysToStockout,
      predictedStockoutDate: stockoutDate.toISOString().split('T')[0],
      safetyStockDays: drug.safety_stock_days,
      reorderQuantity,
      riskLevel,
      seasonalFactor,
    }));

    // Create procurement alert if within safety stock threshold
    if (daysToStockout <= drug.safety_stock_days) {
      const alertRepo = ds.getRepository(ProcurementAlert);
      const existing = await alertRepo.findOne({
        where: { drugName: drug.name, status: 'open' },
      });
      if (!existing) {
        await alertRepo.save(alertRepo.create({
          predictionId: saved.id,
          drugName: drug.name,
          daysToStockout,
          recommendedOrderQty: reorderQuantity,
          urgency: daysToStockout <= 7 ? 'immediate' : daysToStockout <= 14 ? 'within_7_days' : 'within_30_days',
        }));
      }
    }

    return saved;
  }
}
