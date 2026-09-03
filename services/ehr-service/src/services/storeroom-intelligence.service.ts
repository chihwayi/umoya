import { Injectable, Logger, Optional } from '@nestjs/common';
import { ClinicalLlmService } from './clinical-llm.service';
import { StoreroomService } from './storeroom.service';
import { AbstentionLogService } from './abstention-log.service';

export interface ForecastResult {
  predicted_qty: number;
  confidence: number;
  reasoning: string;
  days_of_supply: number;
  reorder_recommended: boolean;
  ai_source: string;
}

export interface AnomalyItem {
  catalog_id: string;
  location_id: string;
  item_name: string;
  location_name: string;
  avg_daily: number;
  recent_3d_daily: number;
  anomaly_type: 'spike' | 'zero_movement';
  deviation_factor: number;
}

export interface ReorderSuggestion {
  catalog_id: string;
  location_id: string;
  item_name: string;
  location_name: string;
  current_stock: number;
  predicted_30d: number;
  days_of_supply: number;
  reorder_qty: number;
}

export interface SubstitutionSuggestion {
  catalog_id: string;
  name: string;
  equivalence_type: 'direct' | 'therapeutic' | 'atc_code';
  quantity_available: number;
  confidence: 'high' | 'medium' | 'low';
  ai_reasoning?: string;
  unit_cost: number | null;
}

@Injectable()
export class StoreroomIntelligenceService {
  private readonly logger = new Logger(StoreroomIntelligenceService.name);

  constructor(
    @Optional() private readonly llm: ClinicalLlmService,
    private readonly storeroom: StoreroomService,
    @Optional() private readonly abstentionLog: AbstentionLogService,
  ) {}

  async forecastDemand(
    tenantDb: any,
    locationId: string,
    catalogId: string,
    horizonDays = 30,
    forceRefresh = false,
  ): Promise<ForecastResult> {
    if (!forceRefresh) {
      const { rows: cached } = await tenantDb.query(
        `SELECT * FROM storeroom_demand_forecasts
          WHERE location_id = $1 AND catalog_id = $2
            AND forecast_date = CURRENT_DATE AND horizon_days = $3
            AND generated_at > NOW() - INTERVAL '24 hours'
          LIMIT 1`,
        [locationId, catalogId, horizonDays],
      );
      if (cached[0]) {
        const stock = await this.storeroom.checkAvailability(tenantDb, locationId, catalogId, 1);
        const predicted = Number(cached[0].predicted_qty);
        return {
          predicted_qty: predicted,
          confidence: Number(cached[0].confidence),
          reasoning: cached[0].reasoning ?? '',
          days_of_supply: stock.quantity_available > 0 && predicted > 0
            ? Math.floor((stock.quantity_available / predicted) * horizonDays)
            : 0,
          reorder_recommended: stock.quantity_available < predicted,
          ai_source: `cached:${cached[0].model_backend ?? 'unknown'}`,
        };
      }
    }

    const twelveWeeksAgo = new Date(Date.now() - 84 * 24 * 60 * 60 * 1000);
    const [consumption, stockRows, catalog, admissions] = await Promise.all([
      this.storeroom.getConsumptionSummary(tenantDb, {
        locationId, catalogId,
        from: twelveWeeksAgo,
        groupBy: 'week',
      }),
      this.storeroom.getStockByLocation(tenantDb, locationId),
      this.storeroom.getCatalogItemById(tenantDb, catalogId),
      tenantDb.query(
        `SELECT COUNT(*) AS count, service
           FROM admissions
          WHERE discharge_date IS NULL
            AND ward_location_id = $1
          GROUP BY service`,
        [locationId],
      ).catch(() => ({ rows: [] })),
    ]);

    const currentStock = (stockRows as any[]).find((s: any) => s.catalog_id === catalogId);
    const stockOnHand = currentStock?.quantity_on_hand ?? 0;
    const location = await this.storeroom.getLocationById(tenantDb, locationId);

    const weeklyData = consumption.map((w: any) => `Week ${String(w.period).slice(0, 10)}: ${w.total_used} units`).join('\n');
    const censusData = admissions.rows.map((r: any) => `  ${r.service}: ${r.count} patients`).join('\n') || '  No current inpatients';

    const prompt =
      `You are a clinical pharmacy demand planning assistant.\n` +
      `Item: ${catalog.name} (${catalog.category})\n` +
      `Location: ${location.name}\n` +
      `Current stock: ${stockOnHand} ${catalog.unit_of_measure}\n` +
      `Forecast horizon: ${horizonDays} days\n\n` +
      `Weekly consumption (last 12 weeks, oldest first):\n${weeklyData || '  No history yet'}\n\n` +
      `Current inpatient census:\n${censusData}\n\n` +
      `Forecast total demand for the next ${horizonDays} days. ` +
      `Consider seasonality, trends, and census levels.\n` +
      `Respond with ONLY valid JSON, no markdown:\n` +
      `{"predicted_qty":<integer>,"confidence":<0.0-1.0>,"reasoning":"<max 40 words>"}`;

    if (!this.llm) {
      return this.ruleBasedForecast(consumption, stockOnHand, horizonDays);
    }

    const result = await this.llm.generate(prompt, {
      context: 'storeroom_demand_forecast',
      maxTokens: 120,
      temperature: 0.1,
    }, tenantDb);

    if (!result) {
      await this.abstentionLog?.log(tenantDb, 'storeroom_demand_forecast', 'timeout', {});
      return this.ruleBasedForecast(consumption, stockOnHand, horizonDays);
    }

    let parsed: { predicted_qty: number; confidence: number; reasoning: string };
    try {
      parsed = JSON.parse(result.text);
    } catch {
      this.logger.warn('Storeroom forecast: LLM returned non-JSON, using rule fallback');
      return this.ruleBasedForecast(consumption, stockOnHand, horizonDays);
    }

    await tenantDb.query(
      `INSERT INTO storeroom_demand_forecasts
         (location_id, catalog_id, forecast_date, horizon_days, predicted_qty,
          confidence, reasoning, model_backend)
       VALUES ($1,$2,CURRENT_DATE,$3,$4,$5,$6,$7)
       ON CONFLICT (location_id, catalog_id, forecast_date, horizon_days)
       DO UPDATE SET
         predicted_qty  = EXCLUDED.predicted_qty,
         confidence     = EXCLUDED.confidence,
         reasoning      = EXCLUDED.reasoning,
         model_backend  = EXCLUDED.model_backend,
         generated_at   = NOW()`,
      [locationId, catalogId, horizonDays, parsed.predicted_qty, parsed.confidence, parsed.reasoning, result.backend],
    );

    const daysOfSupply = parsed.predicted_qty > 0
      ? Math.floor((stockOnHand / parsed.predicted_qty) * horizonDays)
      : 999;

    return {
      predicted_qty: parsed.predicted_qty,
      confidence: parsed.confidence,
      reasoning: parsed.reasoning,
      days_of_supply: daysOfSupply,
      reorder_recommended: stockOnHand < parsed.predicted_qty,
      ai_source: `llm:${result.backend}`,
    };
  }

  async detectAnomalies(tenantDb: any): Promise<AnomalyItem[]> {
    const { rows } = await tenantDb.query(
      `SELECT
          cl.catalog_id, cl.location_id,
          sc.name AS item_name, il.name AS location_name,
          AVG(cl.quantity_used)::NUMERIC(10,2) AS avg_daily,
          COALESCE(STDDEV(cl.quantity_used), 0)::NUMERIC(10,2) AS stddev_daily,
          COALESCE(SUM(
            CASE WHEN cl.performed_at > NOW() - INTERVAL '3 days'
                 THEN cl.quantity_used ELSE 0 END
          ), 0)::NUMERIC(10,2) AS recent_3d_total,
          COUNT(*) AS event_count
         FROM stock_consumption_log cl
         JOIN storeroom_catalog sc ON sc.id = cl.catalog_id
         JOIN inventory_locations il ON il.id = cl.location_id
        WHERE cl.performed_at > NOW() - INTERVAL '30 days'
        GROUP BY cl.catalog_id, cl.location_id, sc.name, il.name
       HAVING COUNT(*) >= 5`,
    );

    const anomalies: AnomalyItem[] = [];
    for (const r of rows) {
      const avgDaily = Number(r.avg_daily);
      const stddev = Number(r.stddev_daily);
      const recent3dDaily = Number(r.recent_3d_total) / 3;

      if (stddev > 0 && recent3dDaily > avgDaily + 2 * stddev) {
        anomalies.push({
          catalog_id: r.catalog_id,
          location_id: r.location_id,
          item_name: r.item_name,
          location_name: r.location_name,
          avg_daily: avgDaily,
          recent_3d_daily: recent3dDaily,
          anomaly_type: 'spike',
          deviation_factor: Number(((recent3dDaily - avgDaily) / stddev).toFixed(1)),
        });
      } else if (avgDaily > 0.5 && Number(r.recent_3d_total) === 0) {
        anomalies.push({
          catalog_id: r.catalog_id,
          location_id: r.location_id,
          item_name: r.item_name,
          location_name: r.location_name,
          avg_daily: avgDaily,
          recent_3d_daily: 0,
          anomaly_type: 'zero_movement',
          deviation_factor: 0,
        });
      }
    }
    return anomalies;
  }

  async getReorderSuggestions(tenantDb: any): Promise<ReorderSuggestion[]> {
    const { rows: stockRows } = await tenantDb.query(
      `SELECT
          ls.location_id, ls.catalog_id,
          sc.name AS item_name, sc.default_reorder_qty,
          il.name AS location_name,
          SUM(ls.quantity_on_hand - ls.quantity_reserved) AS available
         FROM location_stock ls
         JOIN storeroom_catalog sc ON sc.id = ls.catalog_id
         JOIN inventory_locations il ON il.id = ls.location_id
        WHERE sc.is_active = true
        GROUP BY ls.location_id, ls.catalog_id, sc.name, sc.default_reorder_qty, il.name`,
    );

    const suggestions: ReorderSuggestion[] = [];
    for (const row of stockRows) {
      const { rows: forecast } = await tenantDb.query(
        `SELECT predicted_qty FROM storeroom_demand_forecasts
          WHERE location_id = $1 AND catalog_id = $2
            AND forecast_date = CURRENT_DATE AND horizon_days = 30
          LIMIT 1`,
        [row.location_id, row.catalog_id],
      );

      const predicted30d = forecast[0]?.predicted_qty;
      if (!predicted30d || predicted30d <= 0) continue;

      const available = Number(row.available);
      const daysOfSupply = available > 0 ? Math.floor((available / predicted30d) * 30) : 0;

      if (daysOfSupply < 14) {
        suggestions.push({
          catalog_id: row.catalog_id,
          location_id: row.location_id,
          item_name: row.item_name,
          location_name: row.location_name,
          current_stock: available,
          predicted_30d: predicted30d,
          days_of_supply: daysOfSupply,
          reorder_qty: Math.max(Number(row.default_reorder_qty) || predicted30d, predicted30d - available),
        });
      }
    }
    return suggestions.sort((a, b) => a.days_of_supply - b.days_of_supply);
  }

  async buildWardStockContext(tenantDb: any, wardLocationId: string): Promise<string> {
    try {
      const stock = await this.storeroom.getStockByLocation(tenantDb, wardLocationId);
      const inStock = stock
        .filter((s: any) => s.quantity_on_hand > 0)
        .map((s: any) => `${s.item_name} (${s.quantity_on_hand} ${s.unit_of_measure})`)
        .join(', ');
      const oos = stock
        .filter((s: any) => s.quantity_on_hand === 0)
        .map((s: any) => s.item_name)
        .join(', ');
      let ctx = '';
      if (inStock) ctx += `\nMedications available at this ward: ${inStock}.`;
      if (oos) ctx += `\nOUT OF STOCK at this ward: ${oos}. Avoid recommending these unless no alternative exists.`;
      return ctx;
    } catch {
      return '';
    }
  }

  async suggestSubstitutions(
    tenantDb: any,
    catalogId: string,
    quantity: number,
    locationId: string,
  ): Promise<SubstitutionSuggestion[]> {
    const ruleEquivs = await this.storeroom.findTherapeuticEquivalents(
      tenantDb, catalogId, quantity, locationId,
    );

    if (!this.llm || ruleEquivs.length === 0) {
      return ruleEquivs.map(e => ({
        catalog_id: e.catalog_id,
        name: e.name,
        equivalence_type: e.equivalence_type as SubstitutionSuggestion['equivalence_type'],
        quantity_available: e.quantity_available,
        unit_cost: e.unit_cost,
        confidence: (e.equivalence_type === 'direct' || e.equivalence_type === 'therapeutic' ? 'high' : 'medium') as SubstitutionSuggestion['confidence'],
      }));
    }

    const { rows: orig } = await tenantDb.query(
      `SELECT name, drug_class, atc_code FROM storeroom_catalog WHERE id = $1`,
      [catalogId],
    ).catch(() => ({ rows: [] }));
    if (!orig[0]) {
      return ruleEquivs.map(e => ({
        catalog_id: e.catalog_id,
        name: e.name,
        equivalence_type: e.equivalence_type as SubstitutionSuggestion['equivalence_type'],
        quantity_available: e.quantity_available,
        unit_cost: e.unit_cost,
        confidence: 'medium' as const,
      }));
    }

    const prompt = `A patient has been prescribed "${orig[0].name}" (ATC: ${orig[0].atc_code ?? 'unknown'}, class: ${orig[0].drug_class ?? 'unknown'}) but it is out of stock. The following in-stock alternatives were found:\n\n${ruleEquivs.map((e: any, i: number) => `${i + 1}. ${e.name} (${e.equivalence_type}, qty available: ${e.quantity_available})`).join('\n')}\n\nFor each alternative, rate clinical equivalence as high/medium/low and provide a one-sentence clinical reasoning. Return ONLY valid JSON: [{"catalog_id":"...","confidence":"high|medium|low","ai_reasoning":"..."}]`;

    const result = await this.llm.generate(prompt, { context: 'drug-substitution', maxTokens: 300 }, tenantDb).catch((e: any) => { this.logger.warn(`LLM drug substitution recommendation generation failed: ${e?.message}`); return null; });
    if (!result?.text) {
      return ruleEquivs.map(e => ({
        catalog_id: e.catalog_id,
        name: e.name,
        equivalence_type: e.equivalence_type as SubstitutionSuggestion['equivalence_type'],
        quantity_available: e.quantity_available,
        unit_cost: e.unit_cost,
        confidence: 'medium' as const,
      }));
    }

    try {
      const jsonMatch = result.text.match(/\[[\s\S]*\]/);
      if (!jsonMatch) throw new Error('no JSON array');
      const aiRatings: Array<{ catalog_id: string; confidence: string; ai_reasoning: string }> = JSON.parse(jsonMatch[0]);
      const ratingMap = new Map(aiRatings.map(r => [r.catalog_id, r]));

      return ruleEquivs.map(e => {
        const ai = ratingMap.get(e.catalog_id);
        return {
          catalog_id: e.catalog_id,
          name: e.name,
          equivalence_type: e.equivalence_type as SubstitutionSuggestion['equivalence_type'],
          quantity_available: e.quantity_available,
          unit_cost: e.unit_cost,
          confidence: (ai?.confidence ?? 'medium') as SubstitutionSuggestion['confidence'],
          ai_reasoning: ai?.ai_reasoning,
        };
      });
    } catch {
      return ruleEquivs.map(e => ({
        catalog_id: e.catalog_id,
        name: e.name,
        equivalence_type: e.equivalence_type as SubstitutionSuggestion['equivalence_type'],
        quantity_available: e.quantity_available,
        unit_cost: e.unit_cost,
        confidence: 'medium' as const,
      }));
    }
  }

  async getExpiryRiskReport(tenantDb: any): Promise<{
    batches_expiring_7d: any[];
    batches_expiring_30d: any[];
    batches_expiring_90d: any[];
    total_waste_value_30d: number;
  }> {
    const [d7, d30, d90] = await Promise.all([
      this.storeroom.getExpiringBatches(tenantDb, null, 7),
      this.storeroom.getExpiringBatches(tenantDb, null, 30),
      this.storeroom.getExpiringBatches(tenantDb, null, 90),
    ]);
    const total30 = d30.reduce((s: number, r: any) => s + Number(r.estimated_waste_value ?? 0), 0);
    return {
      batches_expiring_7d: d7,
      batches_expiring_30d: d30,
      batches_expiring_90d: d90,
      total_waste_value_30d: total30,
    };
  }

  private ruleBasedForecast(
    consumption: any[],
    currentStock: number,
    horizonDays: number,
  ): ForecastResult {
    const weeklyTotals = consumption.map((w: any) => Number(w.total_used));
    const avg = weeklyTotals.length > 0
      ? weeklyTotals.reduce((s, v) => s + v, 0) / weeklyTotals.length
      : 0;
    const predicted = Math.ceil((avg / 7) * horizonDays);
    const daysOfSupply = predicted > 0 ? Math.floor((currentStock / predicted) * horizonDays) : 999;
    return {
      predicted_qty: predicted,
      confidence: 0.5,
      reasoning: `Rule-based average from ${weeklyTotals.length} weeks of history`,
      days_of_supply: daysOfSupply,
      reorder_recommended: currentStock < predicted,
      ai_source: 'rule',
    };
  }
}
