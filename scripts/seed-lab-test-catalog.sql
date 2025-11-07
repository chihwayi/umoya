-- Seed Lab Test Catalog with Common Tests
-- This script populates the lab_test_catalog and lab_test_components tables with common laboratory tests

-- ===================================
-- HEMATOLOGY TESTS
-- ===================================

-- Complete Blood Count (CBC)
INSERT INTO lab_test_catalog (test_code, loinc_code, test_name, category, specimen_type, specimen_volume, container_type, turnaround_time, cost, description, clinical_significance, is_active)
VALUES (
  'CBC', '58410-2', 'Complete Blood Count (CBC)', 'Hematology', 'Whole Blood', '3-5 mL', 'EDTA (Purple Top)', 2, 15.00,
  'Comprehensive blood test measuring red blood cells, white blood cells, hemoglobin, hematocrit, and platelets',
  'Evaluates overall health, detects anemia, infection, and blood disorders', true
) ON CONFLICT (test_code) DO NOTHING;

-- CBC Components
INSERT INTO lab_test_components (test_catalog_id, component_name, component_code, loinc_code, unit, reference_range_min, reference_range_max, critical_low, critical_high, gender_specific, sort_order)
SELECT id, 'Hemoglobin', 'HGB', '718-7', 'g/dL', 12.0, 17.5, 7.0, 20.0, true, 1
FROM lab_test_catalog WHERE test_code = 'CBC' LIMIT 1
ON CONFLICT DO NOTHING;

INSERT INTO lab_test_components (test_catalog_id, component_name, component_code, loinc_code, unit, reference_range_min, reference_range_max, critical_low, critical_high, sort_order)
SELECT id, 'Hematocrit', 'HCT', '4544-3', '%', 36.0, 50.0, 20.0, 60.0, 2
FROM lab_test_catalog WHERE test_code = 'CBC' LIMIT 1
ON CONFLICT DO NOTHING;

INSERT INTO lab_test_components (test_catalog_id, component_name, component_code, loinc_code, unit, reference_range_min, reference_range_max, critical_low, critical_high, sort_order)
SELECT id, 'Red Blood Cell Count', 'RBC', '789-8', '10^12/L', 4.0, 5.5, 2.0, 7.0, 3
FROM lab_test_catalog WHERE test_code = 'CBC' LIMIT 1
ON CONFLICT DO NOTHING;

INSERT INTO lab_test_components (test_catalog_id, component_name, component_code, loinc_code, unit, reference_range_min, reference_range_max, critical_low, critical_high, sort_order)
SELECT id, 'White Blood Cell Count', 'WBC', '6690-2', '10^9/L', 4.0, 11.0, 2.0, 30.0, 4
FROM lab_test_catalog WHERE test_code = 'CBC' LIMIT 1
ON CONFLICT DO NOTHING;

INSERT INTO lab_test_components (test_catalog_id, component_name, component_code, loinc_code, unit, reference_range_min, reference_range_max, critical_low, critical_high, sort_order)
SELECT id, 'Platelet Count', 'PLT', '777-3', '10^9/L', 150.0, 400.0, 50.0, 1000.0, 5
FROM lab_test_catalog WHERE test_code = 'CBC' LIMIT 1
ON CONFLICT DO NOTHING;

INSERT INTO lab_test_components (test_catalog_id, component_name, component_code, unit, reference_range_min, reference_range_max, sort_order)
SELECT id, 'Mean Corpuscular Volume', 'MCV', 'fL', 80.0, 100.0, 6
FROM lab_test_catalog WHERE test_code = 'CBC' LIMIT 1
ON CONFLICT DO NOTHING;

INSERT INTO lab_test_components (test_catalog_id, component_name, component_code, unit, reference_range_min, reference_range_max, sort_order)
SELECT id, 'Mean Corpuscular Hemoglobin', 'MCH', 'pg', 27.0, 32.0, 7
FROM lab_test_catalog WHERE test_code = 'CBC' LIMIT 1
ON CONFLICT DO NOTHING;

INSERT INTO lab_test_components (test_catalog_id, component_name, component_code, unit, reference_range_min, reference_range_max, sort_order)
SELECT id, 'Mean Corpuscular Hemoglobin Concentration', 'MCHC', 'g/dL', 32.0, 36.0, 8
FROM lab_test_catalog WHERE test_code = 'CBC' LIMIT 1
ON CONFLICT DO NOTHING;

-- Gender-specific reference ranges for Hemoglobin
INSERT INTO lab_reference_ranges (component_id, age_min, age_max, gender, range_min, range_max, unit)
SELECT id, 18, 120, 'male', 13.5, 17.5, 'g/dL'
FROM lab_test_components WHERE component_code = 'HGB' LIMIT 1
ON CONFLICT DO NOTHING;

INSERT INTO lab_reference_ranges (component_id, age_min, age_max, gender, range_min, range_max, unit)
SELECT id, 18, 120, 'female', 12.0, 15.5, 'g/dL'
FROM lab_test_components WHERE component_code = 'HGB' LIMIT 1
ON CONFLICT DO NOTHING;

-- ===================================
-- CHEMISTRY TESTS
-- ===================================

-- Basic Metabolic Panel (BMP)
INSERT INTO lab_test_catalog (test_code, loinc_code, test_name, category, specimen_type, specimen_volume, container_type, turnaround_time, cost, description, clinical_significance, is_active)
VALUES (
  'BMP', '51990-0', 'Basic Metabolic Panel', 'Chemistry', 'Serum', '5 mL', 'Red Top or Gold Top', 3, 25.00,
  'Tests for glucose, calcium, and electrolytes (sodium, potassium, CO2, chloride), plus kidney function (BUN, creatinine)',
  'Evaluates kidney function, electrolyte balance, and blood sugar levels', true
) ON CONFLICT (test_code) DO NOTHING;

-- BMP Components
INSERT INTO lab_test_components (test_catalog_id, component_name, component_code, loinc_code, unit, reference_range_min, reference_range_max, critical_low, critical_high, sort_order)
SELECT id, 'Glucose', 'GLU', '2345-7', 'mg/dL', 70.0, 100.0, 40.0, 500.0, 1
FROM lab_test_catalog WHERE test_code = 'BMP' LIMIT 1
ON CONFLICT DO NOTHING;

INSERT INTO lab_test_components (test_catalog_id, component_name, component_code, loinc_code, unit, reference_range_min, reference_range_max, critical_low, critical_high, sort_order)
SELECT id, 'Sodium', 'NA', '2951-2', 'mmol/L', 135.0, 145.0, 120.0, 160.0, 2
FROM lab_test_catalog WHERE test_code = 'BMP' LIMIT 1
ON CONFLICT DO NOTHING;

INSERT INTO lab_test_components (test_catalog_id, component_name, component_code, loinc_code, unit, reference_range_min, reference_range_max, critical_low, critical_high, sort_order)
SELECT id, 'Potassium', 'K', '2823-3', 'mmol/L', 3.5, 5.0, 2.5, 6.5, 3
FROM lab_test_catalog WHERE test_code = 'BMP' LIMIT 1
ON CONFLICT DO NOTHING;

INSERT INTO lab_test_components (test_catalog_id, component_name, component_code, loinc_code, unit, reference_range_min, reference_range_max, critical_low, critical_high, sort_order)
SELECT id, 'Chloride', 'CL', '2075-0', 'mmol/L', 96.0, 106.0, 80.0, 120.0, 4
FROM lab_test_catalog WHERE test_code = 'BMP' LIMIT 1
ON CONFLICT DO NOTHING;

INSERT INTO lab_test_components (test_catalog_id, component_name, component_code, loinc_code, unit, reference_range_min, reference_range_max, sort_order)
SELECT id, 'Carbon Dioxide', 'CO2', '2028-9', 'mmol/L', 23.0, 29.0, 5
FROM lab_test_catalog WHERE test_code = 'BMP' LIMIT 1
ON CONFLICT DO NOTHING;

INSERT INTO lab_test_components (test_catalog_id, component_name, component_code, loinc_code, unit, reference_range_min, reference_range_max, critical_high, sort_order)
SELECT id, 'Blood Urea Nitrogen (BUN)', 'BUN', '3094-0', 'mg/dL', 7.0, 20.0, 100.0, 6
FROM lab_test_catalog WHERE test_code = 'BMP' LIMIT 1
ON CONFLICT DO NOTHING;

INSERT INTO lab_test_components (test_catalog_id, component_name, component_code, loinc_code, unit, reference_range_min, reference_range_max, critical_high, sort_order)
SELECT id, 'Creatinine', 'CREAT', '2160-0', 'mg/dL', 0.6, 1.2, 10.0, 7
FROM lab_test_catalog WHERE test_code = 'BMP' LIMIT 1
ON CONFLICT DO NOTHING;

INSERT INTO lab_test_components (test_catalog_id, component_name, component_code, loinc_code, unit, reference_range_min, reference_range_max, critical_low, critical_high, sort_order)
SELECT id, 'Calcium', 'CA', '17861-6', 'mg/dL', 8.5, 10.5, 6.0, 13.0, 8
FROM lab_test_catalog WHERE test_code = 'BMP' LIMIT 1
ON CONFLICT DO NOTHING;

-- Lipid Panel
INSERT INTO lab_test_catalog (test_code, loinc_code, test_name, category, specimen_type, specimen_volume, container_type, turnaround_time, cost, description, clinical_significance, is_active)
VALUES (
  'LIPID', '57698-3', 'Lipid Panel', 'Chemistry', 'Serum', '5 mL', 'Red Top or Gold Top', 4, 30.00,
  'Measures cholesterol and triglycerides to assess cardiovascular risk',
  'Screens for risk of heart disease and stroke', true
) ON CONFLICT (test_code) DO NOTHING;

-- Lipid Panel Components
INSERT INTO lab_test_components (test_catalog_id, component_name, component_code, loinc_code, unit, reference_range_max, sort_order)
SELECT id, 'Total Cholesterol', 'CHOL', '2093-3', 'mg/dL', 200.0, 1
FROM lab_test_catalog WHERE test_code = 'LIPID' LIMIT 1
ON CONFLICT DO NOTHING;

INSERT INTO lab_test_components (test_catalog_id, component_name, component_code, loinc_code, unit, reference_range_max, sort_order)
SELECT id, 'Triglycerides', 'TRIG', '2571-8', 'mg/dL', 150.0, 2
FROM lab_test_catalog WHERE test_code = 'LIPID' LIMIT 1
ON CONFLICT DO NOTHING;

INSERT INTO lab_test_components (test_catalog_id, component_name, component_code, loinc_code, unit, reference_range_min, sort_order)
SELECT id, 'HDL Cholesterol', 'HDL', '2085-9', 'mg/dL', 40.0, 3
FROM lab_test_catalog WHERE test_code = 'LIPID' LIMIT 1
ON CONFLICT DO NOTHING;

INSERT INTO lab_test_components (test_catalog_id, component_name, component_code, loinc_code, unit, reference_range_max, sort_order)
SELECT id, 'LDL Cholesterol', 'LDL', '18262-6', 'mg/dL', 130.0, 4
FROM lab_test_catalog WHERE test_code = 'LIPID' LIMIT 1
ON CONFLICT DO NOTHING;

-- Liver Function Tests (LFT)
INSERT INTO lab_test_catalog (test_code, loinc_code, test_name, category, specimen_type, specimen_volume, container_type, turnaround_time, cost, description, clinical_significance, is_active)
VALUES (
  'LFT', '24325-3', 'Liver Function Tests', 'Chemistry', 'Serum', '5 mL', 'Red Top or Gold Top', 4, 35.00,
  'Measures liver enzymes and proteins to assess liver function',
  'Detects liver disease, damage, or dysfunction', true
) ON CONFLICT (test_code) DO NOTHING;

-- LFT Components
INSERT INTO lab_test_components (test_catalog_id, component_name, component_code, loinc_code, unit, reference_range_max, critical_high, sort_order)
SELECT id, 'Alanine Aminotransferase (ALT)', 'ALT', '1742-6', 'U/L', 40.0, 1000.0, 1
FROM lab_test_catalog WHERE test_code = 'LFT' LIMIT 1
ON CONFLICT DO NOTHING;

INSERT INTO lab_test_components (test_catalog_id, component_name, component_code, loinc_code, unit, reference_range_max, critical_high, sort_order)
SELECT id, 'Aspartate Aminotransferase (AST)', 'AST', '1920-8', 'U/L', 40.0, 1000.0, 2
FROM lab_test_catalog WHERE test_code = 'LFT' LIMIT 1
ON CONFLICT DO NOTHING;

INSERT INTO lab_test_components (test_catalog_id, component_name, component_code, loinc_code, unit, reference_range_max, critical_high, sort_order)
SELECT id, 'Alkaline Phosphatase (ALP)', 'ALP', '6768-6', 'U/L', 120.0, 500.0, 3
FROM lab_test_catalog WHERE test_code = 'LFT' LIMIT 1
ON CONFLICT DO NOTHING;

INSERT INTO lab_test_components (test_catalog_id, component_name, component_code, loinc_code, unit, reference_range_max, critical_high, sort_order)
SELECT id, 'Total Bilirubin', 'TBIL', '1975-2', 'mg/dL', 1.2, 15.0, 4
FROM lab_test_catalog WHERE test_code = 'LFT' LIMIT 1
ON CONFLICT DO NOTHING;

INSERT INTO lab_test_components (test_catalog_id, component_name, component_code, loinc_code, unit, reference_range_min, reference_range_max, critical_low, sort_order)
SELECT id, 'Albumin', 'ALB', '1751-7', 'g/dL', 3.5, 5.0, 2.0, 5
FROM lab_test_catalog WHERE test_code = 'LFT' LIMIT 1
ON CONFLICT DO NOTHING;

INSERT INTO lab_test_components (test_catalog_id, component_name, component_code, loinc_code, unit, reference_range_min, reference_range_max, sort_order)
SELECT id, 'Total Protein', 'TP', '2885-2', 'g/dL', 6.0, 8.3, 6
FROM lab_test_catalog WHERE test_code = 'LFT' LIMIT 1
ON CONFLICT DO NOTHING;

-- Hemoglobin A1C (HbA1c)
INSERT INTO lab_test_catalog (test_code, loinc_code, test_name, category, specimen_type, specimen_volume, container_type, turnaround_time, cost, description, clinical_significance, is_active)
VALUES (
  'HBA1C', '4548-4', 'Hemoglobin A1C', 'Chemistry', 'Whole Blood', '2 mL', 'EDTA (Purple Top)', 3, 20.00,
  'Measures average blood glucose control over the past 2-3 months',
  'Monitors long-term diabetes control', true
) ON CONFLICT (test_code) DO NOTHING;

INSERT INTO lab_test_components (test_catalog_id, component_name, component_code, loinc_code, unit, reference_range_max, sort_order)
SELECT id, 'Hemoglobin A1C', 'HBA1C', '4548-4', '%', 5.7, 1
FROM lab_test_catalog WHERE test_code = 'HBA1C' LIMIT 1
ON CONFLICT DO NOTHING;

-- ===================================
-- MICROBIOLOGY / SEROLOGY TESTS
-- ===================================

-- Malaria Rapid Test
INSERT INTO lab_test_catalog (test_code, test_name, category, specimen_type, specimen_volume, container_type, turnaround_time, cost, description, clinical_significance, is_active)
VALUES (
  'MALARIA', 'Malaria Rapid Test (RDT)', 'Microbiology', 'Whole Blood', '5 µL', 'Capillary or EDTA', 1, 5.00,
  'Rapid diagnostic test for Plasmodium species antigens',
  'Detects active malaria infection', true
) ON CONFLICT (test_code) DO NOTHING;

INSERT INTO lab_test_components (test_catalog_id, component_name, component_code, reference_range_text, sort_order)
SELECT id, 'Malaria Antigen', 'MALARIA_AG', 'Negative', 1
FROM lab_test_catalog WHERE test_code = 'MALARIA' LIMIT 1
ON CONFLICT DO NOTHING;

-- HIV Rapid Test
INSERT INTO lab_test_catalog (test_code, test_name, category, specimen_type, specimen_volume, container_type, turnaround_time, cost, description, clinical_significance, is_active)
VALUES (
  'HIV', 'HIV Rapid Antibody Test', 'Serology', 'Whole Blood or Serum', '50 µL', 'Capillary or Red Top', 1, 8.00,
  'Rapid antibody test for HIV-1 and HIV-2',
  'Screens for HIV infection', true
) ON CONFLICT (test_code) DO NOTHING;

INSERT INTO lab_test_components (test_catalog_id, component_name, component_code, reference_range_text, sort_order)
SELECT id, 'HIV Antibody', 'HIV_AB', 'Non-Reactive', 1
FROM lab_test_catalog WHERE test_code = 'HIV' LIMIT 1
ON CONFLICT DO NOTHING;

-- Syphilis (VDRL)
INSERT INTO lab_test_catalog (test_code, loinc_code, test_name, category, specimen_type, specimen_volume, container_type, turnaround_time, cost, description, clinical_significance, is_active)
VALUES (
  'VDRL', '5292-8', 'VDRL (Syphilis Screen)', 'Serology', 'Serum', '2 mL', 'Red Top', 2, 10.00,
  'Screening test for syphilis antibodies',
  'Detects syphilis infection', true
) ON CONFLICT (test_code) DO NOTHING;

INSERT INTO lab_test_components (test_catalog_id, component_name, component_code, loinc_code, reference_range_text, sort_order)
SELECT id, 'VDRL', 'VDRL', '5292-8', 'Non-Reactive', 1
FROM lab_test_catalog WHERE test_code = 'VDRL' LIMIT 1
ON CONFLICT DO NOTHING;

-- Hepatitis B Surface Antigen
INSERT INTO lab_test_catalog (test_code, loinc_code, test_name, category, specimen_type, specimen_volume, container_type, turnaround_time, cost, description, clinical_significance, is_active)
VALUES (
  'HBSAG', '5196-1', 'Hepatitis B Surface Antigen', 'Serology', 'Serum', '2 mL', 'Red Top', 2, 12.00,
  'Tests for active Hepatitis B infection',
  'Screens for Hepatitis B virus', true
) ON CONFLICT (test_code) DO NOTHING;

INSERT INTO lab_test_components (test_catalog_id, component_name, component_code, loinc_code, reference_range_text, sort_order)
SELECT id, 'HBsAg', 'HBSAG', '5196-1', 'Negative', 1
FROM lab_test_catalog WHERE test_code = 'HBSAG' LIMIT 1
ON CONFLICT DO NOTHING;

-- ===================================
-- URINALYSIS
-- ===================================

INSERT INTO lab_test_catalog (test_code, loinc_code, test_name, category, specimen_type, specimen_volume, container_type, turnaround_time, cost, description, clinical_significance, is_active)
VALUES (
  'UA', '24356-8', 'Urinalysis (Complete)', 'Urinalysis', 'Urine', '10-15 mL', 'Sterile Container', 2, 10.00,
  'Complete urinalysis including physical, chemical, and microscopic examination',
  'Screens for urinary tract infections, kidney disease, and metabolic disorders', true
) ON CONFLICT (test_code) DO NOTHING;

-- Urinalysis Components
INSERT INTO lab_test_components (test_catalog_id, component_name, component_code, reference_range_text, sort_order)
SELECT id, 'Color', 'COLOR', 'Yellow', 1
FROM lab_test_catalog WHERE test_code = 'UA' LIMIT 1
ON CONFLICT DO NOTHING;

INSERT INTO lab_test_components (test_catalog_id, component_name, component_code, reference_range_text, sort_order)
SELECT id, 'Appearance', 'APPEAR', 'Clear', 2
FROM lab_test_catalog WHERE test_code = 'UA' LIMIT 1
ON CONFLICT DO NOTHING;

INSERT INTO lab_test_components (test_catalog_id, component_name, component_code, unit, reference_range_min, reference_range_max, sort_order)
SELECT id, 'Specific Gravity', 'SG', '', 1.005, 1.030, 3
FROM lab_test_catalog WHERE test_code = 'UA' LIMIT 1
ON CONFLICT DO NOTHING;

INSERT INTO lab_test_components (test_catalog_id, component_name, component_code, unit, reference_range_min, reference_range_max, sort_order)
SELECT id, 'pH', 'PH', '', 4.5, 8.0, 4
FROM lab_test_catalog WHERE test_code = 'UA' LIMIT 1
ON CONFLICT DO NOTHING;

INSERT INTO lab_test_components (test_catalog_id, component_name, component_code, reference_range_text, sort_order)
SELECT id, 'Protein', 'PROT', 'Negative', 5
FROM lab_test_catalog WHERE test_code = 'UA' LIMIT 1
ON CONFLICT DO NOTHING;

INSERT INTO lab_test_components (test_catalog_id, component_name, component_code, reference_range_text, sort_order)
SELECT id, 'Glucose', 'GLU_U', 'Negative', 6
FROM lab_test_catalog WHERE test_code = 'UA' LIMIT 1
ON CONFLICT DO NOTHING;

INSERT INTO lab_test_components (test_catalog_id, component_name, component_code, reference_range_text, sort_order)
SELECT id, 'Ketones', 'KET', 'Negative', 7
FROM lab_test_catalog WHERE test_code = 'UA' LIMIT 1
ON CONFLICT DO NOTHING;

INSERT INTO lab_test_components (test_catalog_id, component_name, component_code, reference_range_text, sort_order)
SELECT id, 'Blood', 'BLOOD', 'Negative', 8
FROM lab_test_catalog WHERE test_code = 'UA' LIMIT 1
ON CONFLICT DO NOTHING;

INSERT INTO lab_test_components (test_catalog_id, component_name, component_code, reference_range_text, sort_order)
SELECT id, 'Leukocyte Esterase', 'LE', 'Negative', 9
FROM lab_test_catalog WHERE test_code = 'UA' LIMIT 1
ON CONFLICT DO NOTHING;

INSERT INTO lab_test_components (test_catalog_id, component_name, component_code, reference_range_text, sort_order)
SELECT id, 'Nitrite', 'NIT', 'Negative', 10
FROM lab_test_catalog WHERE test_code = 'UA' LIMIT 1
ON CONFLICT DO NOTHING;

-- ===================================
-- PREGNANCY TEST
-- ===================================

INSERT INTO lab_test_catalog (test_code, loinc_code, test_name, category, specimen_type, specimen_volume, container_type, turnaround_time, cost, description, clinical_significance, is_active)
VALUES (
  'HCG', '21198-7', 'Pregnancy Test (HCG)', 'Serology', 'Urine or Serum', '5 mL', 'Sterile Container or Red Top', 1, 8.00,
  'Qualitative test for human chorionic gonadotropin',
  'Confirms pregnancy', true
) ON CONFLICT (test_code) DO NOTHING;

INSERT INTO lab_test_components (test_catalog_id, component_name, component_code, loinc_code, reference_range_text, sort_order)
SELECT id, 'HCG', 'HCG', '21198-7', 'Negative', 1
FROM lab_test_catalog WHERE test_code = 'HCG' LIMIT 1
ON CONFLICT DO NOTHING;

-- ===================================
-- COMMON LAB ORDER SETS
-- ===================================

-- Create common order sets using the new structure
-- Note: This uses the old JSONB structure - we'll need to migrate to the new junction table

INSERT INTO lab_order_sets (set_name, set_code, description, test_ids, category, is_active)
VALUES (
  'Pre-Operative Panel', 'PREOP', 'Standard pre-operative tests', '[]'::jsonb, 'Surgery', true
) ON CONFLICT (set_code) DO NOTHING;

INSERT INTO lab_order_sets (set_name, set_code, description, test_ids, category, is_active)
VALUES (
  'Diabetes Monitoring', 'DM', 'Standard diabetes monitoring tests', '[]'::jsonb, 'Endocrinology', true
) ON CONFLICT (set_code) DO NOTHING;

INSERT INTO lab_order_sets (set_name, set_code, description, test_ids, category, is_active)
VALUES (
  'Antenatal Panel', 'ANC', 'Standard antenatal care tests', '[]'::jsonb, 'Obstetrics', true
) ON CONFLICT (set_code) DO NOTHING;

INSERT INTO lab_order_sets (set_name, set_code, description, test_ids, category, is_active)
VALUES (
  'Cardiac Risk Assessment', 'CARDIAC', 'Cardiovascular risk evaluation', '[]'::jsonb, 'Cardiology', true
) ON CONFLICT (set_code) DO NOTHING;

-- Link tests to order sets using junction table
-- Pre-Operative Panel: CBC, BMP, HCG (for women of childbearing age)
INSERT INTO lab_order_set_items (order_set_id, test_catalog_id, sort_order)
SELECT os.id, tc.id, 1
FROM lab_order_sets os, lab_test_catalog tc
WHERE os.set_code = 'PREOP' AND tc.test_code = 'CBC'
ON CONFLICT DO NOTHING;

INSERT INTO lab_order_set_items (order_set_id, test_catalog_id, sort_order)
SELECT os.id, tc.id, 2
FROM lab_order_sets os, lab_test_catalog tc
WHERE os.set_code = 'PREOP' AND tc.test_code = 'BMP'
ON CONFLICT DO NOTHING;

-- Diabetes Monitoring: HbA1c, BMP, Lipid Panel
INSERT INTO lab_order_set_items (order_set_id, test_catalog_id, sort_order)
SELECT os.id, tc.id, 1
FROM lab_order_sets os, lab_test_catalog tc
WHERE os.set_code = 'DM' AND tc.test_code = 'HBA1C'
ON CONFLICT DO NOTHING;

INSERT INTO lab_order_set_items (order_set_id, test_catalog_id, sort_order)
SELECT os.id, tc.id, 2
FROM lab_order_sets os, lab_test_catalog tc
WHERE os.set_code = 'DM' AND tc.test_code = 'BMP'
ON CONFLICT DO NOTHING;

INSERT INTO lab_order_set_items (order_set_id, test_catalog_id, sort_order)
SELECT os.id, tc.id, 3
FROM lab_order_sets os, lab_test_catalog tc
WHERE os.set_code = 'DM' AND tc.test_code = 'LIPID'
ON CONFLICT DO NOTHING;

-- Antenatal Panel: CBC, HIV, VDRL, HBsAg, Urinalysis
INSERT INTO lab_order_set_items (order_set_id, test_catalog_id, sort_order)
SELECT os.id, tc.id, 1
FROM lab_order_sets os, lab_test_catalog tc
WHERE os.set_code = 'ANC' AND tc.test_code = 'CBC'
ON CONFLICT DO NOTHING;

INSERT INTO lab_order_set_items (order_set_id, test_catalog_id, sort_order)
SELECT os.id, tc.id, 2
FROM lab_order_sets os, lab_test_catalog tc
WHERE os.set_code = 'ANC' AND tc.test_code = 'HIV'
ON CONFLICT DO NOTHING;

INSERT INTO lab_order_set_items (order_set_id, test_catalog_id, sort_order)
SELECT os.id, tc.id, 3
FROM lab_order_sets os, lab_test_catalog tc
WHERE os.set_code = 'ANC' AND tc.test_code = 'VDRL'
ON CONFLICT DO NOTHING;

INSERT INTO lab_order_set_items (order_set_id, test_catalog_id, sort_order)
SELECT os.id, tc.id, 4
FROM lab_order_sets os, lab_test_catalog tc
WHERE os.set_code = 'ANC' AND tc.test_code = 'HBSAG'
ON CONFLICT DO NOTHING;

INSERT INTO lab_order_set_items (order_set_id, test_catalog_id, sort_order)
SELECT os.id, tc.id, 5
FROM lab_order_sets os, lab_test_catalog tc
WHERE os.set_code = 'ANC' AND tc.test_code = 'UA'
ON CONFLICT DO NOTHING;

-- Cardiac Risk: Lipid Panel, HbA1c, BMP
INSERT INTO lab_order_set_items (order_set_id, test_catalog_id, sort_order)
SELECT os.id, tc.id, 1
FROM lab_order_sets os, lab_test_catalog tc
WHERE os.set_code = 'CARDIAC' AND tc.test_code = 'LIPID'
ON CONFLICT DO NOTHING;

INSERT INTO lab_order_set_items (order_set_id, test_catalog_id, sort_order)
SELECT os.id, tc.id, 2
FROM lab_order_sets os, lab_test_catalog tc
WHERE os.set_code = 'CARDIAC' AND tc.test_code = 'HBA1C'
ON CONFLICT DO NOTHING;

INSERT INTO lab_order_set_items (order_set_id, test_catalog_id, sort_order)
SELECT os.id, tc.id, 3
FROM lab_order_sets os, lab_test_catalog tc
WHERE os.set_code = 'CARDIAC' AND tc.test_code = 'BMP'
ON CONFLICT DO NOTHING;

-- Success message
DO $$
BEGIN
  RAISE NOTICE 'Lab test catalog seeded successfully!';
  RAISE NOTICE 'Added: CBC, BMP, Lipid Panel, LFT, HbA1c, Malaria, HIV, VDRL, HBsAg, Urinalysis, Pregnancy Test';
  RAISE NOTICE 'Created order sets: Pre-Operative, Diabetes Monitoring, Antenatal Panel, Cardiac Risk';
END $$;

