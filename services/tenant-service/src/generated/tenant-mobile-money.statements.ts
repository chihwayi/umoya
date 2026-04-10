export const TENANT_MOBILE_MONEY_BUNDLE_VERSION = '2026.04.09.3';
export const TENANT_MOBILE_MONEY_STATEMENTS: string[] = [
  `CREATE TABLE IF NOT EXISTS mobile_money_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    provider VARCHAR(30) NOT NULL,
    country_code VARCHAR(3) NOT NULL,
    is_active BOOLEAN DEFAULT true NOT NULL,
    api_base_url TEXT NOT NULL,
    business_short_code VARCHAR(20),
    till_number VARCHAR(20),
    merchant_id VARCHAR(50),
    callback_url TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS mobile_money_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_id UUID NOT NULL,
    patient_id UUID NOT NULL,
    provider VARCHAR(30) NOT NULL,
    phone_number VARCHAR(20) NOT NULL,
    amount NUMERIC(12,2) NOT NULL,
    currency VARCHAR(5) NOT NULL,
    provider_reference VARCHAR(100),
    checkout_request_id VARCHAR(100),
    status VARCHAR(20) DEFAULT 'pending' NOT NULL,
    failure_reason TEXT,
    initiated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    completed_at TIMESTAMP WITH TIME ZONE,
    receipt_number VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS idx_mobile_money_transactions_invoice ON mobile_money_transactions(invoice_id)`,
  `CREATE INDEX IF NOT EXISTS idx_mobile_money_transactions_patient ON mobile_money_transactions(patient_id)`,
  `CREATE INDEX IF NOT EXISTS idx_mobile_money_transactions_status ON mobile_money_transactions(status)`,
];
