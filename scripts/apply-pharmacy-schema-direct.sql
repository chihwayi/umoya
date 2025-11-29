-- Direct SQL to create pharmacy tables
-- This is a temporary fix until provisioning works correctly

-- Pharmacy Suppliers
CREATE TABLE IF NOT EXISTS pharmacy_suppliers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  contact_person VARCHAR(255),
  email VARCHAR(255),
  phone VARCHAR(50),
  address TEXT,
  city VARCHAR(100),
  country VARCHAR(100),
  payment_terms VARCHAR(100),
  tax_id VARCHAR(100),
  status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active','inactive')),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID REFERENCES users(id),
  updated_by UUID REFERENCES users(id)
);
CREATE INDEX IF NOT EXISTS idx_pharmacy_suppliers_name ON pharmacy_suppliers(name);
CREATE INDEX IF NOT EXISTS idx_pharmacy_suppliers_status ON pharmacy_suppliers(status);

-- Pharmacy Inventory
CREATE TABLE IF NOT EXISTS pharmacy_inventory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255),
  generic_name VARCHAR(255),
  sku VARCHAR(100),
  barcode VARCHAR(100),
  drug_id UUID REFERENCES drugs(id) ON DELETE SET NULL,
  snomed_code VARCHAR(50),
  snomed_term TEXT,
  category VARCHAR(100),
  unit_of_measure VARCHAR(50) DEFAULT 'unit',
  quantity_on_hand INTEGER NOT NULL DEFAULT 0 CHECK (quantity_on_hand >= 0),
  reorder_level INTEGER DEFAULT 10 CHECK (reorder_level >= 0),
  max_stock_level INTEGER CHECK (max_stock_level > 0),
  cost_per_unit NUMERIC(12,2) CHECK (cost_per_unit >= 0),
  selling_price NUMERIC(12,2) CHECK (selling_price >= 0),
  expiry_date DATE,
  batch_number VARCHAR(100),
  location VARCHAR(100),
  supplier_id UUID REFERENCES pharmacy_suppliers(id) ON DELETE SET NULL,
  status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active','discontinued','expired','recalled')),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID REFERENCES users(id),
  updated_by UUID REFERENCES users(id)
);
CREATE INDEX IF NOT EXISTS idx_pharmacy_inventory_name ON pharmacy_inventory(name);
CREATE INDEX IF NOT EXISTS idx_pharmacy_inventory_sku ON pharmacy_inventory(sku);
CREATE INDEX IF NOT EXISTS idx_pharmacy_inventory_drug_id ON pharmacy_inventory(drug_id);
CREATE INDEX IF NOT EXISTS idx_pharmacy_inventory_status ON pharmacy_inventory(status);
CREATE INDEX IF NOT EXISTS idx_pharmacy_inventory_supplier_id ON pharmacy_inventory(supplier_id);

-- Pharmacy Purchase Orders
CREATE TABLE IF NOT EXISTS pharmacy_purchase_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number VARCHAR(50) UNIQUE,
  supplier_id UUID REFERENCES pharmacy_suppliers(id) ON DELETE RESTRICT,
  order_date DATE NOT NULL DEFAULT CURRENT_DATE,
  expected_delivery_date DATE,
  status VARCHAR(20) DEFAULT 'draft' CHECK (status IN ('draft','pending','approved','ordered','received','cancelled')),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID REFERENCES users(id),
  updated_by UUID REFERENCES users(id)
);
CREATE INDEX IF NOT EXISTS idx_pharmacy_po_supplier_id ON pharmacy_purchase_orders(supplier_id);
CREATE INDEX IF NOT EXISTS idx_pharmacy_po_status ON pharmacy_purchase_orders(status);

-- Pharmacy Purchase Order Items
CREATE TABLE IF NOT EXISTS pharmacy_purchase_order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_order_id UUID NOT NULL REFERENCES pharmacy_purchase_orders(id) ON DELETE CASCADE,
  inventory_id UUID REFERENCES pharmacy_inventory(id) ON DELETE SET NULL,
  quantity_ordered INTEGER NOT NULL CHECK (quantity_ordered > 0),
  unit_cost NUMERIC(12,2),
  expected_total_cost NUMERIC(12,2),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_pharmacy_po_items_po_id ON pharmacy_purchase_order_items(purchase_order_id);

-- Pharmacy Receipts
CREATE TABLE IF NOT EXISTS pharmacy_receipts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_order_id UUID REFERENCES pharmacy_purchase_orders(id) ON DELETE SET NULL,
  receipt_date DATE NOT NULL DEFAULT CURRENT_DATE,
  received_by UUID REFERENCES users(id),
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending','verified','rejected','processed')),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID REFERENCES users(id),
  updated_by UUID REFERENCES users(id)
);
CREATE INDEX IF NOT EXISTS idx_pharmacy_receipts_po_id ON pharmacy_receipts(purchase_order_id);

-- Pharmacy Receipt Items
CREATE TABLE IF NOT EXISTS pharmacy_receipt_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  receipt_id UUID NOT NULL REFERENCES pharmacy_receipts(id) ON DELETE CASCADE,
  inventory_id UUID NOT NULL REFERENCES pharmacy_inventory(id) ON DELETE RESTRICT,
  quantity_received INTEGER NOT NULL CHECK (quantity_received > 0),
  quantity_accepted INTEGER,
  quantity_rejected INTEGER DEFAULT 0,
  unit_cost NUMERIC(12,2),
  condition VARCHAR(20) DEFAULT 'good' CHECK (condition IN ('good','damaged','expired','short_supply')),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_pharmacy_receipt_items_receipt_id ON pharmacy_receipt_items(receipt_id);

-- Pharmacy Dispensings
CREATE TABLE IF NOT EXISTS pharmacy_dispensings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prescription_id UUID REFERENCES prescriptions(id) ON DELETE SET NULL,
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  dispensing_date DATE NOT NULL DEFAULT CURRENT_DATE,
  dispensed_by UUID REFERENCES users(id),
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending','dispensed','partial','cancelled','returned')),
  payment_status VARCHAR(20) DEFAULT 'pending' CHECK (payment_status IN ('pending','paid','partially_paid','refunded')),
  payment_method VARCHAR(50),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID REFERENCES users(id),
  updated_by UUID REFERENCES users(id)
);
CREATE INDEX IF NOT EXISTS idx_pharmacy_dispensings_patient_id ON pharmacy_dispensings(patient_id);
CREATE INDEX IF NOT EXISTS idx_pharmacy_dispensings_status ON pharmacy_dispensings(status);

-- Pharmacy Dispensing Items
CREATE TABLE IF NOT EXISTS pharmacy_dispensing_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dispensing_id UUID NOT NULL REFERENCES pharmacy_dispensings(id) ON DELETE CASCADE,
  inventory_id UUID NOT NULL REFERENCES pharmacy_inventory(id) ON DELETE RESTRICT,
  quantity_dispensed INTEGER NOT NULL CHECK (quantity_dispensed > 0),
  unit_price NUMERIC(12,2),
  total_price NUMERIC(12,2),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_pharmacy_dispensing_items_dispensing_id ON pharmacy_dispensing_items(dispensing_id);

-- Pharmacy Returns
CREATE TABLE IF NOT EXISTS pharmacy_returns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dispensing_id UUID REFERENCES pharmacy_dispensings(id) ON DELETE SET NULL,
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  return_date DATE NOT NULL DEFAULT CURRENT_DATE,
  returned_by UUID REFERENCES users(id),
  reason VARCHAR(100),
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','processed')),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID REFERENCES users(id),
  updated_by UUID REFERENCES users(id)
);
CREATE INDEX IF NOT EXISTS idx_pharmacy_returns_dispensing_id ON pharmacy_returns(dispensing_id);

-- Pharmacy Return Items
CREATE TABLE IF NOT EXISTS pharmacy_return_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  return_id UUID NOT NULL REFERENCES pharmacy_returns(id) ON DELETE CASCADE,
  inventory_id UUID NOT NULL REFERENCES pharmacy_inventory(id) ON DELETE RESTRICT,
  quantity_returned INTEGER NOT NULL CHECK (quantity_returned > 0),
  condition VARCHAR(20) DEFAULT 'good' CHECK (condition IN ('good','damaged','expired')),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_pharmacy_return_items_return_id ON pharmacy_return_items(return_id);

-- Pharmacy Stock Movements
CREATE TABLE IF NOT EXISTS pharmacy_stock_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inventory_id UUID NOT NULL REFERENCES pharmacy_inventory(id) ON DELETE CASCADE,
  movement_type VARCHAR(20) NOT NULL CHECK (movement_type IN ('receipt','dispensing','return','adjustment')),
  quantity INTEGER NOT NULL,
  reference_type VARCHAR(50),
  reference_id UUID,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_pharmacy_stock_movements_inventory_id ON pharmacy_stock_movements(inventory_id);

-- Pharmacy Stock Adjustments
CREATE TABLE IF NOT EXISTS pharmacy_stock_adjustments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  adjustment_date DATE NOT NULL DEFAULT CURRENT_DATE,
  adjustment_type VARCHAR(20) NOT NULL CHECK (adjustment_type IN ('increase','decrease','correction')),
  reason VARCHAR(100),
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','processed')),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID REFERENCES users(id),
  updated_by UUID REFERENCES users(id)
);
CREATE INDEX IF NOT EXISTS idx_pharmacy_stock_adjustments_status ON pharmacy_stock_adjustments(status);

-- Pharmacy Stock Adjustment Items
CREATE TABLE IF NOT EXISTS pharmacy_stock_adjustment_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  adjustment_id UUID NOT NULL REFERENCES pharmacy_stock_adjustments(id) ON DELETE CASCADE,
  inventory_id UUID NOT NULL REFERENCES pharmacy_inventory(id) ON DELETE RESTRICT,
  quantity_adjusted INTEGER NOT NULL,
  previous_quantity INTEGER,
  new_quantity INTEGER,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_pharmacy_stock_adjustment_items_adjustment_id ON pharmacy_stock_adjustment_items(adjustment_id);

-- Pharmacy Pricing Rules
CREATE TABLE IF NOT EXISTS pharmacy_pricing_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_name VARCHAR(255) NOT NULL,
  rule_type VARCHAR(30) NOT NULL CHECK (rule_type IN ('markup_percentage','markup_fixed','discount_percentage','discount_fixed','fixed_price')),
  applies_to VARCHAR(20) CHECK (applies_to IN ('all','category','drug','supplier')),
  discount_percentage NUMERIC(5,2),
  fixed_amount NUMERIC(12,2),
  min_quantity INTEGER,
  max_quantity INTEGER,
  start_date DATE,
  end_date DATE,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_pharmacy_pricing_rules_is_active ON pharmacy_pricing_rules(is_active);

-- Pharmacy Formulary
CREATE TABLE IF NOT EXISTS pharmacy_formulary (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  drug_name VARCHAR(255) NOT NULL,
  generic_name VARCHAR(255),
  drug_id UUID REFERENCES drugs(id) ON DELETE SET NULL,
  snomed_code VARCHAR(50),
  snomed_term TEXT,
  category VARCHAR(100),
  is_preferred BOOLEAN DEFAULT false,
  requires_prior_auth BOOLEAN DEFAULT false,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_pharmacy_formulary_drug_name ON pharmacy_formulary(drug_name);

-- Pharmacy Alerts
CREATE TABLE IF NOT EXISTS pharmacy_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_type VARCHAR(50) NOT NULL CHECK (alert_type IN ('low_stock','expiry','recall','price_change','other')),
  severity VARCHAR(20) NOT NULL CHECK (severity IN ('low','medium','high','critical')),
  message TEXT NOT NULL,
  inventory_id UUID REFERENCES pharmacy_inventory(id) ON DELETE SET NULL,
  resolved BOOLEAN DEFAULT false,
  resolved_at TIMESTAMP WITH TIME ZONE,
  resolved_by UUID REFERENCES users(id),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_pharmacy_alerts_resolved ON pharmacy_alerts(resolved);
CREATE INDEX IF NOT EXISTS idx_pharmacy_alerts_severity ON pharmacy_alerts(severity);

-- Add updated_at triggers
CREATE TRIGGER update_pharmacy_suppliers_updated_at BEFORE UPDATE ON pharmacy_suppliers FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_pharmacy_inventory_updated_at BEFORE UPDATE ON pharmacy_inventory FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_pharmacy_purchase_orders_updated_at BEFORE UPDATE ON pharmacy_purchase_orders FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_pharmacy_receipts_updated_at BEFORE UPDATE ON pharmacy_receipts FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_pharmacy_dispensings_updated_at BEFORE UPDATE ON pharmacy_dispensings FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_pharmacy_returns_updated_at BEFORE UPDATE ON pharmacy_returns FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_pharmacy_stock_adjustments_updated_at BEFORE UPDATE ON pharmacy_stock_adjustments FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

