/**
 * Sprint 101 — Supply Chain AI / Stockout Prediction
 * Tables: stockout_predictions, procurement_alerts
 * Also adds pharmacy_inventory table if not exists
 */
const BUNDLE_ID = 'sprint101_supply_chain_ai';

export async function provisionSprint101(ds: any): Promise<void> {
  const already = await ds.query(`SELECT id FROM tenant_schema_versions WHERE bundle_id=$1`, [BUNDLE_ID]).catch(() => []);
  if (already.length) return;

  await ds.query(`
    CREATE TABLE IF NOT EXISTS pharmacy_inventory (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      drug_id UUID NOT NULL,
      drug_name VARCHAR(200) NOT NULL,
      quantity_on_hand FLOAT NOT NULL DEFAULT 0,
      unit VARCHAR(20),
      reorder_level FLOAT DEFAULT 30,
      reorder_quantity FLOAT,
      last_counted_at TIMESTAMPTZ,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await ds.query(`CREATE INDEX IF NOT EXISTS idx_ph_inv_drug ON pharmacy_inventory(drug_id)`);

  await ds.query(`
    CREATE TABLE IF NOT EXISTS stockout_predictions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      drug_id UUID,
      drug_name VARCHAR(200) NOT NULL,
      current_stock_units FLOAT NOT NULL DEFAULT 0,
      avg_daily_consumption FLOAT NOT NULL DEFAULT 0,
      days_to_stockout FLOAT,
      predicted_stockout_date DATE,
      safety_stock_days FLOAT NOT NULL DEFAULT 30,
      reorder_quantity FLOAT,
      risk_level VARCHAR(20) NOT NULL,
      seasonal_factor FLOAT NOT NULL DEFAULT 1.0,
      predicted_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await ds.query(`CREATE INDEX IF NOT EXISTS idx_stockout_drug ON stockout_predictions(drug_name)`);
  await ds.query(`CREATE INDEX IF NOT EXISTS idx_stockout_risk ON stockout_predictions(risk_level)`);

  await ds.query(`
    CREATE TABLE IF NOT EXISTS procurement_alerts (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      prediction_id UUID NOT NULL,
      drug_name VARCHAR(200) NOT NULL,
      days_to_stockout FLOAT NOT NULL,
      recommended_order_qty FLOAT NOT NULL,
      urgency VARCHAR(20) NOT NULL,
      status VARCHAR(20) NOT NULL DEFAULT 'open',
      acknowledged_by UUID,
      acknowledged_at TIMESTAMPTZ,
      order_reference VARCHAR(100),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await ds.query(`CREATE INDEX IF NOT EXISTS idx_proc_alert_drug ON procurement_alerts(drug_name)`);
  await ds.query(`CREATE INDEX IF NOT EXISTS idx_proc_alert_status ON procurement_alerts(status)`);

  await ds.query(`INSERT INTO tenant_schema_versions(bundle_id,applied_at) VALUES($1,NOW())`, [BUNDLE_ID]);
}
