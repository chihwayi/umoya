
-- Provision missing tables for Sprint 1
-- Includes Charge Master, Patient Charges, DRG Assignments (Mig 015)
-- Includes Pharmacy Module (Drugs, Suppliers, Inventory, Dispensings)

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================================================================================================================
-- 1. charge_master Table (from Migration 015)
-- =====================================================================================================================
CREATE TABLE IF NOT EXISTS charge_master (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  charge_code VARCHAR(50) UNIQUE NOT NULL,
  charge_description TEXT NOT NULL,
  cpt_code VARCHAR(10),
  hcpcs_code VARCHAR(10),
  revenue_code VARCHAR(10),
  standard_charge DECIMAL(10, 2) NOT NULL,
  medicare_rate DECIMAL(10, 2),
  medicaid_rate DECIMAL(10, 2),
  department VARCHAR(100),
  service_category VARCHAR(100),
  billable BOOLEAN DEFAULT true,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_charge_master_code ON charge_master(charge_code);
CREATE INDEX IF NOT EXISTS idx_charge_master_cpt ON charge_master(cpt_code);
CREATE INDEX IF NOT EXISTS idx_charge_master_department ON charge_master(department);

-- =====================================================================================================================
-- 2. patient_charges Table (from Migration 015 + Mig 028)
-- =====================================================================================================================
CREATE TABLE IF NOT EXISTS patient_charges (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id UUID NOT NULL REFERENCES patients(id),
  admission_id UUID REFERENCES admissions(id),
  charge_code VARCHAR(50) NOT NULL,
  charge_description TEXT NOT NULL,
  quantity DECIMAL(10, 2) DEFAULT 1,
  unit_price DECIMAL(10, 2) NOT NULL,
  total_charge DECIMAL(10, 2) GENERATED ALWAYS AS (quantity * unit_price) STORED,
  service_date DATE NOT NULL,
  source_type VARCHAR(100),
  source_id UUID,
  cpt_code VARCHAR(10),
  icd10_code VARCHAR(10),
  department VARCHAR(100),
  ordering_provider UUID REFERENCES users(id),
  charge_status VARCHAR(50) DEFAULT 'pending' CHECK (charge_status IN ('pending', 'reviewed', 'approved', 'rejected', 'billed', 'paid', 'adjusted', 'written_off')),
  capture_method VARCHAR(50) CHECK (capture_method IN ('automatic', 'manual', 'imported')),
  captured_by UUID REFERENCES users(id),
  captured_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Approval Workflow (Mig 028)
  reviewed_by UUID REFERENCES users(id),
  reviewed_at TIMESTAMP WITH TIME ZONE,
  approved_by UUID REFERENCES users(id),
  approved_at TIMESTAMP WITH TIME ZONE,
  approval_notes TEXT,
  rejection_reason TEXT,
  
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_patient_charges_patient ON patient_charges(patient_id);
CREATE INDEX IF NOT EXISTS idx_patient_charges_admission ON patient_charges(admission_id);
CREATE INDEX IF NOT EXISTS idx_patient_charges_service_date ON patient_charges(service_date);
CREATE INDEX IF NOT EXISTS idx_patient_charges_status ON patient_charges(charge_status);
CREATE INDEX IF NOT EXISTS idx_patient_charges_reviewed_by ON patient_charges(reviewed_by);
CREATE INDEX IF NOT EXISTS idx_patient_charges_approved_by ON patient_charges(approved_by);

-- =====================================================================================================================
-- 3. drg_assignments Table (from Migration 015)
-- =====================================================================================================================
CREATE TABLE IF NOT EXISTS drg_assignments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  admission_id UUID NOT NULL REFERENCES admissions(id),
  drg_code VARCHAR(10) NOT NULL,
  drg_description TEXT,
  drg_weight DECIMAL(10, 4),
  severity_of_illness INTEGER,
  risk_of_mortality INTEGER,
  assigned_by UUID REFERENCES users(id),
  assigned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_drg_admission ON drg_assignments(admission_id);
CREATE INDEX IF NOT EXISTS idx_drg_code ON drg_assignments(drg_code);

-- =====================================================================================================================
-- 4. drugs Table (Reconstructed from Entity + Mig 029)
-- =====================================================================================================================
CREATE TABLE IF NOT EXISTS drugs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  generic_name VARCHAR(255) NOT NULL,
  brand_names TEXT[],
  atc_code VARCHAR(50),
  drug_class VARCHAR(100),
  active_ingredients TEXT[],
  dosage_forms TEXT[],
  route_of_administration TEXT[],
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  
  -- RxNorm / SNOMED / NDC (Mig 029)
  rxnorm_code VARCHAR(20),
  rxnorm_name TEXT,
  rxnorm_tty VARCHAR(20),
  snomed_code VARCHAR(50),
  snomed_term TEXT,
  ndc_code VARCHAR(50),
  strength VARCHAR(100),
  unit VARCHAR(50),
  status VARCHAR(20) DEFAULT 'active',
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_drugs_rxnorm_code ON drugs(rxnorm_code);
CREATE INDEX IF NOT EXISTS idx_drugs_rxnorm_name ON drugs USING gin(to_tsvector('english', rxnorm_name));
CREATE INDEX IF NOT EXISTS idx_drugs_snomed_code ON drugs(snomed_code);
CREATE INDEX IF NOT EXISTS idx_drugs_ndc_code ON drugs(ndc_code);
CREATE INDEX IF NOT EXISTS idx_drugs_status ON drugs(status);

-- =====================================================================================================================
-- 5. pharmacy_suppliers Table (Reconstructed from Entity)
-- =====================================================================================================================
CREATE TABLE IF NOT EXISTS pharmacy_suppliers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  contact_person VARCHAR(255),
  email VARCHAR(255),
  phone VARCHAR(50),
  address TEXT,
  city VARCHAR(100),
  country VARCHAR(100),
  payment_terms VARCHAR(100),
  tax_id VARCHAR(100),
  status VARCHAR(20) DEFAULT 'active',
  notes TEXT,
  created_by UUID REFERENCES users(id),
  updated_by UUID REFERENCES users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================================================================================
-- 6. pharmacy_inventory Table (Reconstructed from Entity)
-- =====================================================================================================================
CREATE TABLE IF NOT EXISTS pharmacy_inventory (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  drug_id UUID NOT NULL REFERENCES drugs(id) ON DELETE RESTRICT,
  rxnorm_code VARCHAR(50),
  rxnorm_name TEXT,
  batch_number VARCHAR(100),
  expiry_date DATE NOT NULL,
  manufacturing_date DATE,
  quantity_on_hand INTEGER DEFAULT 0,
  quantity_reserved INTEGER DEFAULT 0,
  quantity_available INTEGER GENERATED ALWAYS AS (quantity_on_hand - quantity_reserved) STORED,
  unit_cost DECIMAL(12, 2) NOT NULL,
  unit_price DECIMAL(12, 2) NOT NULL,
  reorder_level INTEGER DEFAULT 10,
  reorder_quantity INTEGER DEFAULT 50,
  maximum_stock_level INTEGER,
  location VARCHAR(100),
  storage_conditions VARCHAR(255),
  supplier_id UUID REFERENCES pharmacy_suppliers(id) ON DELETE SET NULL,
  last_purchase_date DATE,
  last_purchase_price DECIMAL(12, 2),
  status VARCHAR(20) DEFAULT 'active',
  created_by UUID REFERENCES users(id),
  updated_by UUID REFERENCES users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pharmacy_inventory_drug_id ON pharmacy_inventory(drug_id);
CREATE INDEX IF NOT EXISTS idx_pharmacy_inventory_expiry ON pharmacy_inventory(expiry_date);
CREATE INDEX IF NOT EXISTS idx_pharmacy_inventory_batch ON pharmacy_inventory(batch_number);

-- =====================================================================================================================
-- 7. pharmacy_dispensings Table (Reconstructed from Entity + Mig 030)
-- =====================================================================================================================
CREATE TABLE IF NOT EXISTS pharmacy_dispensings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  prescription_id UUID REFERENCES prescriptions(id) ON DELETE SET NULL,
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  dispensing_number VARCHAR(50) UNIQUE,
  dispensing_date DATE DEFAULT CURRENT_DATE,
  dispensed_by UUID REFERENCES users(id),
  status VARCHAR(20) DEFAULT 'pending',
  payment_status VARCHAR(20) DEFAULT 'pending',
  payment_method VARCHAR(50),
  total_amount DECIMAL(12, 2) DEFAULT 0,
  amount_paid DECIMAL(12, 2) DEFAULT 0,
  discount_amount DECIMAL(12, 2) DEFAULT 0,
  bill_id UUID, -- References billing(id) conceptually
  notes TEXT,
  created_by UUID REFERENCES users(id),
  updated_by UUID REFERENCES users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pharmacy_dispensings_patient ON pharmacy_dispensings(patient_id);
CREATE INDEX IF NOT EXISTS idx_pharmacy_dispensings_prescription ON pharmacy_dispensings(prescription_id);
CREATE INDEX IF NOT EXISTS idx_pharmacy_dispensings_dispensing_number ON pharmacy_dispensings(dispensing_number);

-- =====================================================================================================================
-- 8. pharmacy_dispensing_items Table (Reconstructed from Entity)
-- =====================================================================================================================
CREATE TABLE IF NOT EXISTS pharmacy_dispensing_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  dispensing_id UUID NOT NULL REFERENCES pharmacy_dispensings(id) ON DELETE CASCADE,
  inventory_id UUID NOT NULL REFERENCES pharmacy_inventory(id) ON DELETE RESTRICT,
  quantity_dispensed INTEGER NOT NULL,
  unit_price DECIMAL(12, 2) NOT NULL,
  total_price DECIMAL(12, 2) GENERATED ALWAYS AS (quantity_dispensed * unit_price) STORED,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pharmacy_dispensing_items_dispensing ON pharmacy_dispensing_items(dispensing_id);
CREATE INDEX IF NOT EXISTS idx_pharmacy_dispensing_items_inventory ON pharmacy_dispensing_items(inventory_id);

