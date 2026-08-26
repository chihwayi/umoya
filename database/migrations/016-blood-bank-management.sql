-- Migration 013: Blood Bank Management
-- Date: December 4, 2025
-- Description: Adds comprehensive blood bank management including donor tracking, inventory, cross-matching, and transfusion documentation.

-- =====================================================================================================================
-- 1. blood_donors Table
--    Blood donor registry and screening
-- =====================================================================================================================
CREATE TABLE IF NOT EXISTS blood_donors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Donor Info (can link to patient if they're also a patient)
  patient_id UUID REFERENCES patients(id),
  
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  date_of_birth DATE NOT NULL,
  gender VARCHAR(20) NOT NULL,
  national_id VARCHAR(50),
  phone VARCHAR(50),
  email VARCHAR(100),
  address TEXT,
  
  -- Blood Type
  blood_group VARCHAR(5) NOT NULL CHECK (blood_group IN ('A', 'B', 'AB', 'O')),
  rh_factor VARCHAR(10) NOT NULL CHECK (rh_factor IN ('positive', 'negative')),
  
  -- Donor Status
  donor_type VARCHAR(50) DEFAULT 'voluntary' CHECK (donor_type IN ('voluntary', 'replacement', 'directed', 'autologous')),
  donor_status VARCHAR(50) DEFAULT 'active' CHECK (donor_status IN ('active', 'deferred', 'permanently_deferred', 'inactive')),
  
  -- Screening
  last_donation_date DATE,
  total_donations INTEGER DEFAULT 0,
  
  -- Deferral
  deferral_reason TEXT,
  deferral_until DATE,
  
  -- Contact Preference
  willing_to_donate BOOLEAN DEFAULT true,
  preferred_contact VARCHAR(50) DEFAULT 'phone',
  
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_blood_donors_group ON blood_donors(blood_group, rh_factor);
CREATE INDEX IF NOT EXISTS idx_blood_donors_status ON blood_donors(donor_status);
CREATE INDEX IF NOT EXISTS idx_blood_donors_phone ON blood_donors(phone);

-- =====================================================================================================================
-- 2. blood_donations Table
--    Individual blood donation events
-- =====================================================================================================================
CREATE TABLE IF NOT EXISTS blood_donations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  donation_number VARCHAR(50) UNIQUE NOT NULL,
  
  donor_id UUID NOT NULL REFERENCES blood_donors(id),
  
  -- Donation Details
  donation_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  donation_type VARCHAR(50) NOT NULL CHECK (donation_type IN ('whole_blood', 'plasma', 'platelets', 'double_red_cells')),
  volume_collected INTEGER NOT NULL, -- mL
  
  -- Pre-Donation Screening
  hemoglobin DECIMAL(4, 1),
  blood_pressure VARCHAR(20),
  pulse INTEGER,
  temperature DECIMAL(4, 2),
  weight DECIMAL(5, 2), -- kg
  
  screening_passed BOOLEAN DEFAULT true,
  screening_notes TEXT,
  
  -- Collection
  collection_site VARCHAR(100),
  phlebotomist_id UUID REFERENCES users(id),
  adverse_event BOOLEAN DEFAULT false,
  adverse_event_details TEXT,
  
  -- Blood Bag
  bag_number VARCHAR(50) UNIQUE,
  anticoagulant VARCHAR(50) DEFAULT 'CPDA-1',
  
  -- Testing
  abo_group_confirmed VARCHAR(5),
  rh_factor_confirmed VARCHAR(10),
  infection_screening_status VARCHAR(50) CHECK (infection_screening_status IN ('pending', 'cleared', 'rejected')),
  hiv_test_result VARCHAR(20),
  hbsag_test_result VARCHAR(20),
  hcv_test_result VARCHAR(20),
  syphilis_test_result VARCHAR(20),
  malaria_test_result VARCHAR(20),
  
  -- Status
  donation_status VARCHAR(50) DEFAULT 'collected' CHECK (donation_status IN 
    ('collected', 'tested', 'cleared', 'quarantined', 'discarded', 'issued')),
  
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_blood_donations_donor ON blood_donations(donor_id);
CREATE INDEX IF NOT EXISTS idx_blood_donations_date ON blood_donations(donation_date);
CREATE INDEX IF NOT EXISTS idx_blood_donations_status ON blood_donations(donation_status);
CREATE INDEX IF NOT EXISTS idx_blood_donations_bag ON blood_donations(bag_number);

-- =====================================================================================================================
-- 3. blood_inventory Table
--    Blood component inventory management
-- =====================================================================================================================
CREATE TABLE IF NOT EXISTS blood_inventory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  donation_id UUID NOT NULL REFERENCES blood_donations(id),
  
  -- Component
  component_type VARCHAR(50) NOT NULL CHECK (component_type IN 
    ('whole_blood', 'packed_rbc', 'ffp', 'platelets', 'cryoprecipitate', 'plasma')),
  unit_number VARCHAR(50) UNIQUE NOT NULL,
  
  -- Blood Type
  blood_group VARCHAR(5) NOT NULL,
  rh_factor VARCHAR(10) NOT NULL,
  
  -- Volume & Quantity
  volume_ml INTEGER NOT NULL,
  
  -- Dates
  collection_date DATE NOT NULL,
  expiry_date DATE NOT NULL,
  
  -- Storage
  storage_location VARCHAR(100),
  storage_temperature DECIMAL(4, 2), -- °C
  
  -- Status
  status VARCHAR(50) DEFAULT 'available' CHECK (status IN 
    ('available', 'reserved', 'issued', 'expired', 'discarded', 'transfused')),
  
  -- Quality Control
  visual_inspection_passed BOOLEAN DEFAULT true,
  inspection_notes TEXT,
  
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_blood_inventory_component ON blood_inventory(component_type);
CREATE INDEX IF NOT EXISTS idx_blood_inventory_group ON blood_inventory(blood_group, rh_factor);
CREATE INDEX IF NOT EXISTS idx_blood_inventory_status ON blood_inventory(status);
CREATE INDEX IF NOT EXISTS idx_blood_inventory_expiry ON blood_inventory(expiry_date);

-- =====================================================================================================================
-- 4. blood_cross_match Table
--    Cross-matching for blood transfusion compatibility
-- =====================================================================================================================
CREATE TABLE IF NOT EXISTS blood_cross_match (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  patient_id UUID NOT NULL REFERENCES patients(id),
  inventory_id UUID NOT NULL REFERENCES blood_inventory(id),
  
  -- Request
  requested_by UUID NOT NULL REFERENCES users(id),
  requested_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  urgency VARCHAR(50) DEFAULT 'routine' CHECK (urgency IN ('routine', 'urgent', 'emergency')),
  
  -- Patient Blood Type
  patient_blood_group VARCHAR(5) NOT NULL,
  patient_rh_factor VARCHAR(10) NOT NULL,
  
  -- Cross-Match Testing
  major_cross_match VARCHAR(50) CHECK (major_cross_match IN ('compatible', 'incompatible', 'pending')),
  minor_cross_match VARCHAR(50) CHECK (minor_cross_match IN ('compatible', 'incompatible', 'pending')),
  antibody_screen VARCHAR(50) CHECK (antibody_screen IN ('negative', 'positive', 'pending')),
  
  -- Result
  cross_match_result VARCHAR(50) DEFAULT 'pending' CHECK (cross_match_result IN 
    ('pending', 'compatible', 'incompatible', 'conditional')),
  result_date TIMESTAMP WITH TIME ZONE,
  result_notes TEXT,
  
  -- Lab Tech
  performed_by UUID REFERENCES users(id),
  verified_by UUID REFERENCES users(id),
  
  -- Valid Until
  expires_at TIMESTAMP WITH TIME ZONE, -- Usually 72 hours
  
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cross_match_patient ON blood_cross_match(patient_id);
CREATE INDEX IF NOT EXISTS idx_cross_match_inventory ON blood_cross_match(inventory_id);
CREATE INDEX IF NOT EXISTS idx_cross_match_result ON blood_cross_match(cross_match_result);

-- =====================================================================================================================
-- 5. blood_transfusions Table
--    Complete transfusion documentation
-- =====================================================================================================================
CREATE TABLE IF NOT EXISTS blood_transfusions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  patient_id UUID NOT NULL REFERENCES patients(id),
  admission_id UUID REFERENCES admissions(id),
  inventory_id UUID NOT NULL REFERENCES blood_inventory(id),
  cross_match_id UUID REFERENCES blood_cross_match(id),
  
  -- Order
  ordered_by UUID NOT NULL REFERENCES users(id),
  order_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  indication TEXT NOT NULL,
  urgency VARCHAR(50) DEFAULT 'routine',
  
  -- Pre-Transfusion
  pre_transfusion_vitals JSONB,
  consent_obtained BOOLEAN DEFAULT false,
  consent_obtained_by UUID REFERENCES users(id),
  
  -- Transfusion
  start_time TIMESTAMP WITH TIME ZONE,
  end_time TIMESTAMP WITH TIME ZONE,
  volume_transfused INTEGER, -- mL
  
  -- Monitoring (vitals every 15 min)
  transfusion_vitals JSONB DEFAULT '[]'::jsonb,
  /* Format: [{
    time: "10:15",
    bp: "120/80",
    hr: 75,
    temp: 36.5,
    spo2: 98,
    notes: ""
  }] */
  
  -- Staff
  administered_by UUID NOT NULL REFERENCES users(id),
  monitored_by UUID REFERENCES users(id),
  
  -- Reactions
  transfusion_reaction BOOLEAN DEFAULT false,
  reaction_type VARCHAR(100), -- Allergic, febrile, hemolytic, etc.
  reaction_severity VARCHAR(50) CHECK (reaction_severity IN ('mild', 'moderate', 'severe', 'life_threatening')),
  reaction_time TIMESTAMP WITH TIME ZONE,
  reaction_management TEXT,
  
  -- Completion
  transfusion_status VARCHAR(50) DEFAULT 'ordered' CHECK (transfusion_status IN 
    ('ordered', 'in_progress', 'completed', 'stopped', 'reaction_occurred')),
  completion_notes TEXT,
  
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_transfusion_patient ON blood_transfusions(patient_id);
CREATE INDEX IF NOT EXISTS idx_transfusion_inventory ON blood_transfusions(inventory_id);
CREATE INDEX IF NOT EXISTS idx_transfusion_status ON blood_transfusions(transfusion_status);
CREATE INDEX IF NOT EXISTS idx_transfusion_start_time ON blood_transfusions(start_time);

-- Comments for documentation
COMMENT ON TABLE blood_donors IS 'Blood donor registry with screening and deferral tracking';
COMMENT ON TABLE blood_donations IS 'Individual blood donation events with testing results';
COMMENT ON TABLE blood_inventory IS 'Blood component inventory with expiry tracking';
COMMENT ON TABLE blood_cross_match IS 'Cross-matching for transfusion compatibility (valid 72 hours)';
COMMENT ON TABLE blood_transfusions IS 'Complete transfusion documentation with reaction monitoring';

COMMENT ON COLUMN blood_inventory.expiry_date IS 'Whole blood: 35 days, Packed RBC: 42 days, FFP: 1 year, Platelets: 5 days';
COMMENT ON COLUMN blood_cross_match.expires_at IS 'Cross-match valid for 72 hours';
COMMENT ON COLUMN blood_transfusions.transfusion_vitals IS 'Monitor vitals every 15 minutes during transfusion';

