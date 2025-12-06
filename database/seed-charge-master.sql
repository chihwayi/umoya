-- Seed Charge Master with Common Medical Charges
-- This populates the charge_master table with standard billable services

-- =====================================================================================================================
-- CONSULTATIONS & OFFICE VISITS
-- =====================================================================================================================
INSERT INTO charge_master (charge_code, charge_description, cpt_code, standard_charge, medicare_rate, department, service_category, billable, is_active) VALUES
('CONSULT-NEW', 'New Patient Consultation', '99203', 150.00, 120.00, 'General', 'Consultation', true, true),
('CONSULT-FOLLOW', 'Follow-up Consultation', '99213', 100.00, 80.00, 'General', 'Consultation', true, true),
('CONSULT-COMPLEX', 'Complex Consultation', '99215', 250.00, 200.00, 'General', 'Consultation', true, true),
('CONSULT-EMERGENCY', 'Emergency Consultation', '99284', 300.00, 250.00, 'Emergency', 'Consultation', true, true);

-- =====================================================================================================================
-- SURGICAL PROCEDURES
-- =====================================================================================================================
INSERT INTO charge_master (charge_code, charge_description, cpt_code, standard_charge, medicare_rate, department, service_category, billable, is_active) VALUES
('SURG-APPENDECTOMY', 'Appendectomy', '44970', 2500.00, 2000.00, 'Surgery', 'Surgical Procedure', true, true),
('SURG-CHOLECYSTECTOMY', 'Cholecystectomy', '47562', 3500.00, 2800.00, 'Surgery', 'Surgical Procedure', true, true),
('SURG-HERNIA-REPAIR', 'Hernia Repair', '49505', 2000.00, 1600.00, 'Surgery', 'Surgical Procedure', true, true),
('SURG-BIOPSY', 'Surgical Biopsy', '19100', 800.00, 650.00, 'Surgery', 'Surgical Procedure', true, true),
('SURG-LAPAROSCOPY', 'Diagnostic Laparoscopy', '49320', 3000.00, 2400.00, 'Surgery', 'Surgical Procedure', true, true);

-- =====================================================================================================================
-- LABORATORY TESTS
-- =====================================================================================================================
INSERT INTO charge_master (charge_code, charge_description, cpt_code, standard_charge, medicare_rate, department, service_category, billable, is_active) VALUES
('LAB-CBC', 'Complete Blood Count', '85027', 25.00, 20.00, 'Lab', 'Laboratory', true, true),
('LAB-CMP', 'Comprehensive Metabolic Panel', '80053', 45.00, 35.00, 'Lab', 'Laboratory', true, true),
('LAB-LIPID', 'Lipid Panel', '80061', 35.00, 28.00, 'Lab', 'Laboratory', true, true),
('LAB-HBA1C', 'Hemoglobin A1C', '83036', 30.00, 24.00, 'Lab', 'Laboratory', true, true),
('LAB-TSH', 'Thyroid Stimulating Hormone', '84443', 40.00, 32.00, 'Lab', 'Laboratory', true, true),
('LAB-URINALYSIS', 'Urinalysis', '81001', 15.00, 12.00, 'Lab', 'Laboratory', true, true),
('LAB-CULTURE', 'Culture and Sensitivity', '87040', 50.00, 40.00, 'Lab', 'Laboratory', true, true),
('LAB-BLOOD-GLUCOSE', 'Blood Glucose', '82947', 10.00, 8.00, 'Lab', 'Laboratory', true, true);

-- =====================================================================================================================
-- RADIOLOGY & IMAGING
-- =====================================================================================================================
INSERT INTO charge_master (charge_code, charge_description, cpt_code, standard_charge, medicare_rate, department, service_category, billable, is_active) VALUES
('RAD-XRAY-CHEST', 'Chest X-Ray', '71020', 120.00, 95.00, 'Radiology', 'Imaging', true, true),
('RAD-XRAY-EXTREMITY', 'Extremity X-Ray', '73060', 80.00, 65.00, 'Radiology', 'Imaging', true, true),
('RAD-CT-HEAD', 'CT Head', '70450', 500.00, 400.00, 'Radiology', 'Imaging', true, true),
('RAD-CT-ABDOMEN', 'CT Abdomen', '74150', 600.00, 480.00, 'Radiology', 'Imaging', true, true),
('RAD-ULTRASOUND-ABDOMEN', 'Abdominal Ultrasound', '76700', 300.00, 240.00, 'Radiology', 'Imaging', true, true),
('RAD-ULTRASOUND-PELVIC', 'Pelvic Ultrasound', '76856', 350.00, 280.00, 'Radiology', 'Imaging', true, true),
('RAD-MRI-BRAIN', 'MRI Brain', '70551', 1200.00, 960.00, 'Radiology', 'Imaging', true, true);

-- =====================================================================================================================
-- ANESTHESIA
-- =====================================================================================================================
INSERT INTO charge_master (charge_code, charge_description, cpt_code, standard_charge, medicare_rate, department, service_category, billable, is_active) VALUES
('ANES-GENERAL', 'General Anesthesia', '00100', 800.00, 640.00, 'Anesthesia', 'Anesthesia', true, true),
('ANES-REGIONAL', 'Regional Anesthesia', '00300', 600.00, 480.00, 'Anesthesia', 'Anesthesia', true, true),
('ANES-MONITORED', 'Monitored Anesthesia Care', '99155', 400.00, 320.00, 'Anesthesia', 'Anesthesia', true, true);

-- =====================================================================================================================
-- EMERGENCY DEPARTMENT
-- =====================================================================================================================
INSERT INTO charge_master (charge_code, charge_description, cpt_code, standard_charge, medicare_rate, department, service_category, billable, is_active) VALUES
('ED-LEVEL-1', 'ED Level 1', '99281', 150.00, 120.00, 'Emergency', 'Emergency', true, true),
('ED-LEVEL-2', 'ED Level 2', '99282', 250.00, 200.00, 'Emergency', 'Emergency', true, true),
('ED-LEVEL-3', 'ED Level 3', '99283', 400.00, 320.00, 'Emergency', 'Emergency', true, true),
('ED-LEVEL-4', 'ED Level 4', '99284', 600.00, 480.00, 'Emergency', 'Emergency', true, true),
('ED-LEVEL-5', 'ED Level 5', '99285', 900.00, 720.00, 'Emergency', 'Emergency', true, true);

-- =====================================================================================================================
-- PHARMACY / MEDICATIONS
-- =====================================================================================================================
INSERT INTO charge_master (charge_code, charge_description, cpt_code, standard_charge, medicare_rate, department, service_category, billable, is_active) VALUES
('PHARM-DISPENSING', 'Pharmacy Dispensing Fee', NULL, 10.00, 8.00, 'Pharmacy', 'Pharmacy', true, true),
('PHARM-COMPOUNDING', 'Pharmacy Compounding', '99070', 25.00, 20.00, 'Pharmacy', 'Pharmacy', true, true);

-- =====================================================================================================================
-- PROCEDURES
-- =====================================================================================================================
INSERT INTO charge_master (charge_code, charge_description, cpt_code, standard_charge, medicare_rate, department, service_category, billable, is_active) VALUES
('PROC-ECG', 'Electrocardiogram', '93000', 50.00, 40.00, 'Cardiology', 'Procedure', true, true),
('PROC-ECHO', 'Echocardiogram', '93307', 400.00, 320.00, 'Cardiology', 'Procedure', true, true),
('PROC-ENDOSCOPY', 'Upper Endoscopy', '43239', 1200.00, 960.00, 'Gastroenterology', 'Procedure', true, true),
('PROC-COLONOSCOPY', 'Colonoscopy', '45378', 1500.00, 1200.00, 'Gastroenterology', 'Procedure', true, true),
('PROC-SPIROMETRY', 'Pulmonary Function Test', '94010', 150.00, 120.00, 'Pulmonology', 'Procedure', true, true),
('PROC-STRESS-TEST', 'Stress Test', '93017', 300.00, 240.00, 'Cardiology', 'Procedure', true, true);

-- =====================================================================================================================
-- INPATIENT SERVICES
-- =====================================================================================================================
INSERT INTO charge_master (charge_code, charge_description, cpt_code, standard_charge, medicare_rate, department, service_category, billable, is_active) VALUES
('INPT-DAILY-ROOM', 'Daily Room Charge', NULL, 500.00, 400.00, 'Inpatient', 'Room & Board', true, true),
('INPT-ICU-DAILY', 'ICU Daily Charge', NULL, 1200.00, 960.00, 'Inpatient', 'Room & Board', true, true),
('INPT-OR-TIME', 'Operating Room Time (per hour)', NULL, 800.00, 640.00, 'Surgery', 'Operating Room', true, true),
('INPT-RECOVERY', 'Recovery Room (per hour)', NULL, 200.00, 160.00, 'PACU', 'Recovery', true, true);

-- =====================================================================================================================
-- BLOOD BANK
-- =====================================================================================================================
INSERT INTO charge_master (charge_code, charge_description, cpt_code, standard_charge, medicare_rate, department, service_category, billable, is_active) VALUES
('BB-TYPE-SCREEN', 'Blood Type & Screen', '86900', 80.00, 64.00, 'Lab', 'Blood Bank', true, true),
('BB-CROSSMATCH', 'Crossmatch', '86901', 100.00, 80.00, 'Lab', 'Blood Bank', true, true),
('BB-UNIT-RBC', 'Red Blood Cell Unit', 'P9016', 300.00, 240.00, 'Lab', 'Blood Bank', true, true),
('BB-UNIT-PLATELETS', 'Platelet Unit', 'P9031', 400.00, 320.00, 'Lab', 'Blood Bank', true, true),
('BB-UNIT-PLASMA', 'Plasma Unit', 'P9021', 250.00, 200.00, 'Lab', 'Blood Bank', true, true);

-- =====================================================================================================================
-- VACCINATIONS
-- =====================================================================================================================
INSERT INTO charge_master (charge_code, charge_description, cpt_code, standard_charge, medicare_rate, department, service_category, billable, is_active) VALUES
('VAC-ADMIN-FEE', 'Vaccination Administration', '90471', 25.00, 20.00, 'General', 'Vaccination', true, true),
('VAC-FLU', 'Influenza Vaccine', '90682', 35.00, 28.00, 'General', 'Vaccination', true, true),
('VAC-COVID', 'COVID-19 Vaccine', '91300', 0.00, 0.00, 'General', 'Vaccination', false, true),
('VAC-HEP-B', 'Hepatitis B Vaccine', '90740', 50.00, 40.00, 'General', 'Vaccination', true, true);

-- =====================================================================================================================
-- NON-BILLABLE SERVICES (for reference)
-- =====================================================================================================================
INSERT INTO charge_master (charge_code, charge_description, cpt_code, standard_charge, medicare_rate, department, service_category, billable, is_active) VALUES
('NON-BILL-EDUCATION', 'Patient Education', NULL, 0.00, 0.00, 'General', 'Education', false, true),
('NON-BILL-COUNSELING', 'Counseling Session', NULL, 0.00, 0.00, 'General', 'Counseling', false, true);

-- Note: If you need to update existing charges, use:
-- UPDATE charge_master SET ... WHERE charge_code = '...';

