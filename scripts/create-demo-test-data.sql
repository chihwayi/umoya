-- Create Demo/Test Data for All 3 Modules
-- This script creates realistic test data to demonstrate workflows

-- ===================================================
-- 1. ENHANCED LIS - Test Demo Data
-- ===================================================

-- Simulate a critical lab result scenario
DO $$
DECLARE
  v_patient_id UUID;
  v_doctor_id UUID;
  v_lab_order_id UUID;
  v_test_catalog_id UUID;
  v_component_id UUID;
BEGIN
  -- Get a patient
  SELECT id INTO v_patient_id FROM patients LIMIT 1;
  
  -- Get a doctor
  SELECT id INTO v_doctor_id FROM users WHERE role = 'doctor' LIMIT 1;
  
  -- Get test catalog ID for BMP
  SELECT id INTO v_test_catalog_id FROM lab_test_catalog WHERE test_code = 'BMP' LIMIT 1;
  
  IF v_patient_id IS NOT NULL AND v_doctor_id IS NOT NULL AND v_test_catalog_id IS NOT NULL THEN
    -- Create a lab order
    INSERT INTO lab_orders (
      order_number, patient_id, ordering_provider_id, test_catalog_id,
      tests, priority, status, clinical_indication, ordering_provider
    )
    VALUES (
      'LAB-DEMO-' || EXTRACT(EPOCH FROM NOW())::TEXT,
      v_patient_id,
      v_doctor_id,
      v_test_catalog_id,
      '[{"testName": "Basic Metabolic Panel", "testCode": "BMP"}]'::jsonb,
      'urgent',
      'completed',
      'Patient presenting with weakness and confusion',
      v_doctor_id
    )
    RETURNING id INTO v_lab_order_id;
    
    -- Simulate critical potassium result
    SELECT id INTO v_component_id FROM lab_test_components WHERE component_code = 'K' LIMIT 1;
    
    IF v_component_id IS NOT NULL THEN
      -- Create critical alert for high potassium (6.8 mmol/L)
      INSERT INTO lab_critical_alerts (
        patient_id, lab_order_id, component_name, result_value,
        critical_range, severity, alert_status, alerted_to, alerted_at
      )
      VALUES (
        v_patient_id,
        v_lab_order_id,
        'Potassium',
        '6.8 mmol/L',
        '>= 6.5',
        'panic',
        'pending',
        v_doctor_id,
        NOW() - INTERVAL '15 minutes'
      );
      
      RAISE NOTICE '✅ Created demo lab order with critical potassium alert';
    END IF;
  END IF;
END $$;

-- ===================================================
-- 2. RADIOLOGY - Test Demo Data
-- ===================================================

-- Ensure a demo radiologist exists
DO $$
DECLARE
  v_radiologist_id UUID;
BEGIN
  SELECT id INTO v_radiologist_id FROM users WHERE email = 'radiologist@bulawayo-general.co.zw';

  IF v_radiologist_id IS NULL THEN
    INSERT INTO users (
      email,
      password_hash,
      first_name,
      last_name,
      role,
      license_number,
      specialization,
      phone,
      must_change_password
    )
    VALUES (
      'radiologist@bulawayo-general.co.zw',
      '$2b$10$53yYB1QraHibRFYL1g1Bzu9zRcQ90b5QciaSd9GBmo5laFu8lqVbC', -- Password1#
      'Rudo',
      'Munyoro',
      'radiologist',
      'RAD-001234',
      'Diagnostic Radiology',
      '+263 77 555 1212',
      false
    )
    RETURNING id INTO v_radiologist_id;
  END IF;
END $$;

DO $$
DECLARE
  v_patient_id UUID;
  v_doctor_id UUID;
  v_radiologist_id UUID;
  v_study_type_id UUID;
  v_imaging_order_id UUID;
  v_imaging_study_id UUID;
BEGIN
  -- Get a patient
  SELECT id INTO v_patient_id FROM patients LIMIT 1;
  
  -- Get a doctor
  SELECT id INTO v_doctor_id FROM users WHERE role = 'doctor' LIMIT 1;
  -- Get the demo radiologist
  SELECT id INTO v_radiologist_id FROM users WHERE role = 'radiologist' ORDER BY created_at LIMIT 1;
  
  -- Get Chest X-Ray study type
  SELECT id INTO v_study_type_id FROM imaging_study_types WHERE study_code = 'CXR-PA-LAT' LIMIT 1;
  
  IF v_patient_id IS NOT NULL AND v_doctor_id IS NOT NULL AND v_study_type_id IS NOT NULL THEN
    -- Create imaging order
    INSERT INTO imaging_orders (
      patient_id, order_number, study_type_id, ordering_provider,
      clinical_indication, clinical_history, suspected_diagnosis,
      priority, order_status, ordered_at, created_by
    )
    VALUES (
      v_patient_id,
      'IMG-DEMO-' || EXTRACT(EPOCH FROM NOW())::TEXT,
      v_study_type_id,
      v_doctor_id,
      'R/O pneumonia',
      'Cough x 2 weeks, fever, shortness of breath',
      'Community acquired pneumonia',
      'urgent',
      'in_progress',
      NOW() - INTERVAL '2 hours',
      v_doctor_id
    )
    RETURNING id INTO v_imaging_order_id;
    
    -- Create imaging study
    INSERT INTO imaging_studies (
      imaging_order_id, patient_id, accession_number, study_type_id,
      study_date, study_time, study_status, number_of_images,
      study_description, technique, radiologist_assigned
    )
    VALUES (
      v_imaging_order_id,
      v_patient_id,
      'ACC-DEMO-' || EXTRACT(EPOCH FROM NOW())::TEXT,
      v_study_type_id,
      CURRENT_DATE,
      CURRENT_TIME,
      CASE WHEN v_radiologist_id IS NOT NULL THEN 'awaiting_report' ELSE 'in_progress' END,
      2,
      'Chest X-Ray PA and Lateral views',
      'PA and lateral chest radiographs obtained in upright position',
      v_radiologist_id
    )
    RETURNING id INTO v_imaging_study_id;

    IF v_radiologist_id IS NOT NULL THEN
      UPDATE imaging_orders
      SET order_status = 'awaiting_report'
      WHERE id = v_imaging_order_id;
    END IF;

    RAISE NOTICE '✅ Created demo chest X-ray order awaiting report';
  END IF;
END $$;

-- ===================================================
-- 3. MATERNITY - Test Demo Data
-- ===================================================

DO $$
DECLARE
  v_patient_id UUID;
  v_nurse_id UUID;
  v_enrollment_id UUID;
  v_lmp_date DATE;
  v_edd DATE;
BEGIN
  -- Find or create a female patient
  SELECT id INTO v_patient_id 
  FROM patients 
  WHERE gender = 'female' 
    AND EXTRACT(YEAR FROM AGE(date_of_birth)) BETWEEN 18 AND 45
  LIMIT 1;
  
  -- Get a nurse
  SELECT id INTO v_nurse_id FROM users WHERE role = 'nurse' LIMIT 1;
  
  IF v_patient_id IS NOT NULL AND v_nurse_id IS NOT NULL THEN
    -- Set LMP to 12 weeks ago
    v_lmp_date := CURRENT_DATE - INTERVAL '12 weeks';
    v_edd := v_lmp_date + INTERVAL '280 days';
    
    -- Create maternity enrollment
    INSERT INTO maternity_enrollments (
      patient_id, enrollment_number, enrollment_date, expected_delivery_date,
      edd_method, lmp_date, gestational_age_at_enrollment,
      gravida, para, parity_term, parity_preterm, parity_abortions, parity_living,
      previous_cesarean, risk_category, enrollment_status, enrolled_by
    )
    VALUES (
      v_patient_id,
      'MAT-DEMO-' || EXTRACT(EPOCH FROM NOW())::TEXT,
      CURRENT_DATE - INTERVAL '1 week',
      v_edd,
      'LMP',
      v_lmp_date,
      12,
      2,  -- Second pregnancy
      1,  -- One previous delivery
      1,  -- One term delivery
      0,  -- No preterm
      0,  -- No abortions
      1,  -- One living child
      false,
      'low',
      'active',
      v_nurse_id
    )
    RETURNING id INTO v_enrollment_id;
    
    -- Create first ANC visit (at enrollment)
    INSERT INTO anc_visits (
      maternity_enrollment_id, patient_id, visit_number, visit_date,
      gestational_age, gestational_age_days, weight, height, bmi,
      blood_pressure_systolic, blood_pressure_diastolic, temperature,
      pulse, fundal_height, fetal_heart_rate, fetal_presentation,
      hemoglobin, blood_group, rhesus, vdrl_syphilis, hiv_status,
      tetanus_immunization, iron_folate, danger_signs_discussed,
      birth_plan_discussed, next_visit_date, provider
    )
    VALUES (
      v_enrollment_id,
      v_patient_id,
      1,  -- First visit
      CURRENT_DATE - INTERVAL '1 week',
      12,  -- 12 weeks
      0,
      65.5,  -- weight in kg
      162.0,  -- height in cm
      24.96,  -- BMI
      120,  -- BP systolic
      75,  -- BP diastolic
      36.6,  -- Temperature
      78,  -- Pulse
      12.0,  -- Fundal height (roughly matches GA)
      150,  -- Fetal heart rate
      'cephalic',
      11.5,  -- Hemoglobin
      'O',  -- Blood group
      'positive',
      'non_reactive',
      'negative',
      true,
      true,
      true,
      true,
      CURRENT_DATE + INTERVAL '4 weeks',  -- Next visit in 4 weeks
      v_nurse_id
    );
    
    -- Create dating ultrasound scan
    INSERT INTO ultrasound_scans (
      maternity_enrollment_id, patient_id, scan_date, gestational_age,
      scan_type, number_of_fetuses, fetal_viability, fetal_heartbeat,
      fetal_presentation, placenta_position, amniotic_fluid,
      biparietal_diameter, findings, performed_by
    )
    VALUES (
      v_enrollment_id,
      v_patient_id,
      CURRENT_DATE - INTERVAL '5 days',
      12,
      'dating',
      1,
      true,
      156,
      'cephalic',
      'anterior',
      'normal',
      21.0,  -- BPD in mm
      'Single viable intrauterine pregnancy. Fetal cardiac activity seen. Gestational age by biometry: 12 weeks 2 days.',
      v_nurse_id
    );
    
    RAISE NOTICE '✅ Created demo maternity enrollment with first ANC visit and ultrasound';
    RAISE NOTICE '   Patient ID: %', v_patient_id;
    RAISE NOTICE '   Enrollment ID: %', v_enrollment_id;
    RAISE NOTICE '   EDD: %', v_edd;
  ELSE
    RAISE NOTICE '⚠️  Could not create maternity demo data (no suitable patient or nurse found)';
  END IF;
END $$;

-- Success message
DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '🎉 Demo test data creation complete!';
  RAISE NOTICE '';
  RAISE NOTICE '✅ Enhanced LIS: Created lab order with critical potassium alert';
  RAISE NOTICE '✅ Radiology: Created chest X-ray order awaiting report';
  RAISE NOTICE '✅ Maternity: Created pregnancy enrollment with ANC visit and ultrasound';
  RAISE NOTICE '';
  RAISE NOTICE '🧪 Test the workflows:';
  RAISE NOTICE '   - Check critical alerts in doctor dashboard';
  RAISE NOTICE '   - View radiologist worklist';
  RAISE NOTICE '   - Review maternity enrollments';
END $$;

