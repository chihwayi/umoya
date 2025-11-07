#!/bin/bash

# Apply Maternity Module Schema to Existing Tenant Databases
# This script adds maternity & obstetrics tables

set -e

echo "🏥 Applying Maternity Module Schema to Tenant Databases..."

# Get list of tenant databases
echo "📋 Finding tenant databases..."
TENANT_DBS=$(docker exec -i medicore-postgres-master psql -U medicore -d postgres -t -c "SELECT datname FROM pg_database WHERE datname LIKE 'tenant_%' OR datname LIKE 'clinic_%';")

if [ -z "$TENANT_DBS" ]; then
  echo "⚠️  No tenant databases found!"
  exit 0
fi

echo "Found tenant databases:"
echo "$TENANT_DBS"
echo ""

# Apply schema to each tenant database
for DB in $TENANT_DBS; do
  DB=$(echo $DB | xargs)  # Trim whitespace
  
  echo "🔧 Applying Maternity schema to: $DB"
  
  cat <<'EOF' | docker exec -i medicore-postgres-master psql -U medicore -d $DB
-- Maternity & Obstetrics Module

-- Maternity Enrollments
CREATE TABLE IF NOT EXISTS maternity_enrollments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  enrollment_number VARCHAR(50) UNIQUE NOT NULL,
  enrollment_date DATE NOT NULL,
  expected_delivery_date DATE,
  edd_method VARCHAR(50) CHECK (edd_method IN ('LMP','Ultrasound','Clinical')),
  lmp_date DATE,
  gestational_age_at_enrollment INTEGER,
  gravida INTEGER,
  para INTEGER,
  parity_term INTEGER,
  parity_preterm INTEGER,
  parity_abortions INTEGER,
  parity_living INTEGER,
  previous_cesarean BOOLEAN DEFAULT false,
  previous_complications TEXT,
  current_pregnancy_complications TEXT,
  risk_category VARCHAR(20) DEFAULT 'low' CHECK (risk_category IN ('low','medium','high')),
  enrollment_status VARCHAR(30) DEFAULT 'active' CHECK (enrollment_status IN ('active','delivered','transferred_out','pregnancy_loss')),
  enrolled_by UUID REFERENCES users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_maternity_enrollments_patient_id ON maternity_enrollments(patient_id);
CREATE INDEX IF NOT EXISTS idx_maternity_enrollments_enrollment_number ON maternity_enrollments(enrollment_number);
CREATE INDEX IF NOT EXISTS idx_maternity_enrollments_enrollment_status ON maternity_enrollments(enrollment_status);
CREATE INDEX IF NOT EXISTS idx_maternity_enrollments_risk_category ON maternity_enrollments(risk_category);
CREATE INDEX IF NOT EXISTS idx_maternity_enrollments_expected_delivery_date ON maternity_enrollments(expected_delivery_date);

-- ANC Visits
CREATE TABLE IF NOT EXISTS anc_visits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  maternity_enrollment_id UUID NOT NULL REFERENCES maternity_enrollments(id) ON DELETE CASCADE,
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  visit_number INTEGER NOT NULL,
  visit_date DATE NOT NULL,
  gestational_age INTEGER,
  gestational_age_days INTEGER,
  weight DECIMAL(5,2),
  height DECIMAL(5,2),
  bmi DECIMAL(5,2),
  blood_pressure_systolic INTEGER,
  blood_pressure_diastolic INTEGER,
  temperature DECIMAL(4,2),
  pulse INTEGER,
  respiratory_rate INTEGER,
  fundal_height DECIMAL(4,1),
  fetal_heart_rate INTEGER,
  fetal_presentation VARCHAR(50),
  fetal_movement VARCHAR(50),
  edema VARCHAR(50),
  edema_location TEXT,
  proteinuria VARCHAR(50),
  glucose_urine VARCHAR(50),
  hemoglobin DECIMAL(4,1),
  blood_group VARCHAR(10),
  rhesus VARCHAR(10),
  vdrl_syphilis VARCHAR(20),
  hiv_status VARCHAR(20),
  hep_b_status VARCHAR(20),
  tetanus_immunization BOOLEAN,
  ipt_malaria INTEGER,
  iron_folate BOOLEAN,
  deworming BOOLEAN,
  insecticide_treated_net BOOLEAN,
  danger_signs_discussed BOOLEAN,
  birth_plan_discussed BOOLEAN,
  complications_identified TEXT,
  interventions TEXT,
  referral_needed BOOLEAN,
  referral_reason TEXT,
  referral_facility VARCHAR(255),
  next_visit_date DATE,
  provider UUID REFERENCES users(id),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_anc_visits_maternity_enrollment_id ON anc_visits(maternity_enrollment_id);
CREATE INDEX IF NOT EXISTS idx_anc_visits_patient_id ON anc_visits(patient_id);
CREATE INDEX IF NOT EXISTS idx_anc_visits_visit_date ON anc_visits(visit_date);
CREATE INDEX IF NOT EXISTS idx_anc_visits_provider ON anc_visits(provider);
CREATE INDEX IF NOT EXISTS idx_anc_visits_next_visit_date ON anc_visits(next_visit_date);

-- Ultrasound Scans
CREATE TABLE IF NOT EXISTS ultrasound_scans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  maternity_enrollment_id UUID NOT NULL REFERENCES maternity_enrollments(id) ON DELETE CASCADE,
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  scan_date DATE NOT NULL,
  gestational_age INTEGER,
  scan_type VARCHAR(50) CHECK (scan_type IN ('dating','anomaly','growth','biophysical','other')),
  number_of_fetuses INTEGER DEFAULT 1,
  fetal_viability BOOLEAN,
  fetal_heartbeat INTEGER,
  fetal_presentation VARCHAR(50),
  placenta_position VARCHAR(100),
  amniotic_fluid VARCHAR(50),
  afi DECIMAL(4,1),
  estimated_fetal_weight DECIMAL(6,2),
  biparietal_diameter DECIMAL(4,1),
  head_circumference DECIMAL(5,1),
  abdominal_circumference DECIMAL(5,1),
  femur_length DECIMAL(4,1),
  anomalies_detected TEXT,
  edd_by_ultrasound DATE,
  findings TEXT,
  performed_by UUID REFERENCES users(id),
  image_path TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ultrasound_scans_maternity_enrollment_id ON ultrasound_scans(maternity_enrollment_id);
CREATE INDEX IF NOT EXISTS idx_ultrasound_scans_patient_id ON ultrasound_scans(patient_id);
CREATE INDEX IF NOT EXISTS idx_ultrasound_scans_scan_date ON ultrasound_scans(scan_date);
CREATE INDEX IF NOT EXISTS idx_ultrasound_scans_scan_type ON ultrasound_scans(scan_type);

-- Deliveries
CREATE TABLE IF NOT EXISTS deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  maternity_enrollment_id UUID NOT NULL REFERENCES maternity_enrollments(id) ON DELETE CASCADE,
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  delivery_date DATE NOT NULL,
  delivery_time TIME NOT NULL,
  gestational_age_at_delivery INTEGER,
  gestational_age_days INTEGER,
  admission_date TIMESTAMP WITH TIME ZONE,
  delivery_type VARCHAR(50) CHECK (delivery_type IN ('spontaneous_vaginal','assisted_vaginal','cesarean','instrumental')),
  delivery_method VARCHAR(100),
  indication_for_intervention TEXT,
  labor_onset VARCHAR(50),
  induction_method VARCHAR(100),
  duration_of_labor_hours DECIMAL(4,1),
  rupture_of_membranes TIMESTAMP WITH TIME ZONE,
  membrane_rupture_type VARCHAR(50),
  anesthesia_type VARCHAR(50),
  episiotomy BOOLEAN,
  perineal_tear_degree VARCHAR(20),
  blood_loss DECIMAL(6,1),
  placenta_delivery VARCHAR(50),
  placenta_complete BOOLEAN,
  maternal_complications TEXT,
  maternal_outcome VARCHAR(50),
  attending_provider UUID REFERENCES users(id),
  assistant_provider UUID REFERENCES users(id),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_deliveries_maternity_enrollment_id ON deliveries(maternity_enrollment_id);
CREATE INDEX IF NOT EXISTS idx_deliveries_patient_id ON deliveries(patient_id);
CREATE INDEX IF NOT EXISTS idx_deliveries_delivery_date ON deliveries(delivery_date);
CREATE INDEX IF NOT EXISTS idx_deliveries_delivery_type ON deliveries(delivery_type);
CREATE INDEX IF NOT EXISTS idx_deliveries_attending_provider ON deliveries(attending_provider);

-- Birth Outcomes
CREATE TABLE IF NOT EXISTS birth_outcomes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  delivery_id UUID NOT NULL REFERENCES deliveries(id) ON DELETE CASCADE,
  birth_order INTEGER DEFAULT 1,
  birth_outcome VARCHAR(50) CHECK (birth_outcome IN ('live_birth','stillbirth','neonatal_death')),
  sex VARCHAR(20),
  birth_weight DECIMAL(5,2),
  birth_length DECIMAL(4,1),
  head_circumference DECIMAL(4,1),
  apgar_1min INTEGER,
  apgar_5min INTEGER,
  apgar_10min INTEGER,
  resuscitation_required BOOLEAN,
  resuscitation_type TEXT,
  congenital_anomalies TEXT,
  neonatal_complications TEXT,
  breastfeeding_initiated BOOLEAN,
  breastfeeding_within_1hour BOOLEAN,
  vitamin_k_given BOOLEAN,
  eye_prophylaxis_given BOOLEAN,
  newborn_outcome VARCHAR(50),
  time_of_death TIMESTAMP WITH TIME ZONE,
  cause_of_death TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_birth_outcomes_delivery_id ON birth_outcomes(delivery_id);
CREATE INDEX IF NOT EXISTS idx_birth_outcomes_birth_outcome ON birth_outcomes(birth_outcome);

-- Postnatal Visits
CREATE TABLE IF NOT EXISTS postnatal_visits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  maternity_enrollment_id UUID NOT NULL REFERENCES maternity_enrollments(id) ON DELETE CASCADE,
  delivery_id UUID REFERENCES deliveries(id),
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  visit_date DATE NOT NULL,
  days_postpartum INTEGER,
  weight DECIMAL(5,2),
  blood_pressure_systolic INTEGER,
  blood_pressure_diastolic INTEGER,
  temperature DECIMAL(4,2),
  pulse INTEGER,
  general_condition VARCHAR(50),
  uterine_involution VARCHAR(50),
  lochia VARCHAR(50),
  perineum_condition VARCHAR(50),
  breast_condition VARCHAR(50),
  breastfeeding_status VARCHAR(50),
  breastfeeding_problems TEXT,
  emotional_status VARCHAR(50),
  danger_signs TEXT,
  family_planning_discussed BOOLEAN,
  family_planning_method VARCHAR(100),
  newborn_status VARCHAR(50),
  newborn_complications TEXT,
  provider UUID REFERENCES users(id),
  notes TEXT,
  next_visit_date DATE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_postnatal_visits_maternity_enrollment_id ON postnatal_visits(maternity_enrollment_id);
CREATE INDEX IF NOT EXISTS idx_postnatal_visits_patient_id ON postnatal_visits(patient_id);
CREATE INDEX IF NOT EXISTS idx_postnatal_visits_visit_date ON postnatal_visits(visit_date);
CREATE INDEX IF NOT EXISTS idx_postnatal_visits_provider ON postnatal_visits(provider);

-- Maternity Risk Factors
CREATE TABLE IF NOT EXISTS maternity_risk_factors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  maternity_enrollment_id UUID NOT NULL REFERENCES maternity_enrollments(id) ON DELETE CASCADE,
  risk_factor VARCHAR(100) NOT NULL,
  risk_category VARCHAR(20) CHECK (risk_category IN ('medical','obstetric','social')),
  severity VARCHAR(20) CHECK (severity IN ('low','medium','high')),
  identified_date DATE NOT NULL,
  resolved_date DATE,
  notes TEXT,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_maternity_risk_factors_maternity_enrollment_id ON maternity_risk_factors(maternity_enrollment_id);
CREATE INDEX IF NOT EXISTS idx_maternity_risk_factors_risk_category ON maternity_risk_factors(risk_category);
CREATE INDEX IF NOT EXISTS idx_maternity_risk_factors_severity ON maternity_risk_factors(severity);

-- Add triggers
DROP TRIGGER IF EXISTS update_maternity_enrollments_updated_at ON maternity_enrollments;
CREATE TRIGGER update_maternity_enrollments_updated_at 
  BEFORE UPDATE ON maternity_enrollments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_anc_visits_updated_at ON anc_visits;
CREATE TRIGGER update_anc_visits_updated_at 
  BEFORE UPDATE ON anc_visits
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_ultrasound_scans_updated_at ON ultrasound_scans;
CREATE TRIGGER update_ultrasound_scans_updated_at 
  BEFORE UPDATE ON ultrasound_scans
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_deliveries_updated_at ON deliveries;
CREATE TRIGGER update_deliveries_updated_at 
  BEFORE UPDATE ON deliveries
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_postnatal_visits_updated_at ON postnatal_visits;
CREATE TRIGGER update_postnatal_visits_updated_at 
  BEFORE UPDATE ON postnatal_visits
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

\echo '✅ Maternity schema applied successfully!'
EOF

  if [ $? -eq 0 ]; then
    echo "✅ Schema applied successfully to $DB"
  else
    echo "❌ Failed to apply schema to $DB"
  fi
  
  echo ""
done

echo "🎉 Maternity module schema application complete!"
echo ""
echo "📋 Summary:"
echo "  - Added 6 maternity tables"
echo "  - maternity_enrollments (pregnancy registration)"
echo "  - anc_visits (WHO 8-visit model)"
echo "  - ultrasound_scans (obstetric ultrasound)"
echo "  - deliveries (labor & delivery)"
echo "  - birth_outcomes (birth records)"
echo "  - postnatal_visits (postpartum care)"
echo "  - maternity_risk_factors (risk tracking)"
echo ""
echo "🚀 Next steps:"
echo "  1. Restart ehr-service: docker restart medicore-ehr-service"
echo "  2. Implement backend APIs for maternity module"
echo "  3. Build frontend components for ANC/delivery workflow"

