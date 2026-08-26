-- Migration 018: Dietary & Nutrition Services
-- Date: December 4, 2025
-- Description: Adds dietary orders, nutritional assessments, and meal planning.

-- =====================================================================================================================
-- 1. diet_orders Table
--    Diet orders for inpatients
-- =====================================================================================================================
CREATE TABLE IF NOT EXISTS diet_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  patient_id UUID NOT NULL REFERENCES patients(id),
  admission_id UUID REFERENCES admissions(id),
  
  -- Diet Type
  diet_type VARCHAR(100) NOT NULL CHECK (diet_type IN (
    'regular', 'NPO', 'clear_liquid', 'full_liquid', 'soft', 'diabetic', 
    'cardiac', 'renal', 'low_sodium', 'low_fat', 'gluten_free', 'pureed', 'mechanical_soft'
  )),
  diet_texture VARCHAR(50) CHECK (diet_texture IN ('regular', 'chopped', 'minced', 'pureed')),
  
  -- Restrictions
  food_allergies JSONB DEFAULT '[]'::jsonb,
  food_restrictions JSONB DEFAULT '[]'::jsonb,
  
  -- Supplements
  nutritional_supplements JSONB DEFAULT '[]'::jsonb,
  
  -- Tube Feeding
  tube_feeding BOOLEAN DEFAULT false,
  tube_feeding_formula VARCHAR(255),
  tube_feeding_rate VARCHAR(100),
  
  -- TPN (Total Parenteral Nutrition)
  tpn_ordered BOOLEAN DEFAULT false,
  tpn_formula TEXT,
  
  -- Start/End
  start_date DATE DEFAULT CURRENT_DATE,
  end_date DATE,
  
  -- Ordered By
  ordered_by UUID NOT NULL REFERENCES users(id),
  order_date DATE DEFAULT CURRENT_DATE,
  
  -- Status
  status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'discontinued', 'completed')),
  
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_diet_orders_patient ON diet_orders(patient_id);
CREATE INDEX IF NOT EXISTS idx_diet_orders_admission ON diet_orders(admission_id);
CREATE INDEX IF NOT EXISTS idx_diet_orders_status ON diet_orders(status);

-- =====================================================================================================================
-- 2. nutritional_assessments Table
--    Nutritional assessments by dietitians
-- =====================================================================================================================
CREATE TABLE IF NOT EXISTS nutritional_assessments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  patient_id UUID NOT NULL REFERENCES patients(id),
  admission_id UUID REFERENCES admissions(id),
  
  -- Assessment Date
  assessment_date DATE DEFAULT CURRENT_DATE,
  
  -- Anthropometrics
  height_cm DECIMAL(5, 2),
  weight_kg DECIMAL(5, 2),
  bmi DECIMAL(4, 2) GENERATED ALWAYS AS (weight_kg / ((height_cm / 100) * (height_cm / 100))) STORED,
  
  -- Nutritional Status
  nutritional_risk VARCHAR(50) CHECK (nutritional_risk IN ('low', 'moderate', 'high')),
  malnutrition_diagnosis VARCHAR(100),
  
  -- Dietary Intake
  oral_intake_percentage INTEGER CHECK (oral_intake_percentage BETWEEN 0 AND 100),
  swallowing_difficulty BOOLEAN DEFAULT false,
  
  -- Lab Values
  albumin DECIMAL(3, 2),
  prealbumin DECIMAL(4, 2),
  
  -- Recommendations
  dietary_recommendations TEXT,
  calorie_needs INTEGER, -- kcal/day
  protein_needs INTEGER, -- g/day
  
  -- Dietitian
  assessed_by UUID NOT NULL REFERENCES users(id),
  
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_nutrition_assessment_patient ON nutritional_assessments(patient_id);
CREATE INDEX IF NOT EXISTS idx_nutrition_assessment_date ON nutritional_assessments(assessment_date);

-- Comments
COMMENT ON TABLE diet_orders IS 'Diet orders for inpatients with allergies and restrictions';
COMMENT ON TABLE nutritional_assessments IS 'Nutritional assessments by dietitians with malnutrition screening';

COMMENT ON COLUMN diet_orders.diet_type IS 'NPO=Nothing by mouth, Regular, Diabetic, Cardiac, Renal, etc.';




