-- Create Test Data for Tier 1 Patient Portal
-- Patient: Thandeka Moyo (BUL544356195)

-- Get patient ID
DO $$
DECLARE
  v_patient_id UUID := '5c643267-233f-4c95-b978-835ec9b59cea';
  v_doctor_id UUID := 'f1777fa7-cf07-4c87-9c5e-4da405129512';
  v_consent_template_id UUID;
  v_pathway_id UUID;
  v_consent_id UUID;
  v_enrollment_id UUID;
BEGIN
  
  -- 1. Create a test consent for the patient
  SELECT id INTO v_consent_template_id FROM consent_templates LIMIT 1;
  
  IF v_consent_template_id IS NOT NULL THEN
    INSERT INTO patient_consents (
      consent_number,
      patient_id,
      template_id,
      template_version,
      consent_type,
      title,
      content,
      status,
      language_code,
      created_at
    ) VALUES (
      'CNS-2025-TEST001',
      v_patient_id,
      v_consent_template_id,
      '1.0',
      'treatment',
      'General Treatment Consent',
      '<h2>Consent for Medical Treatment</h2><p>I hereby consent to receive medical treatment...</p>',
      'pending',
      'en',
      NOW()
    )
    ON CONFLICT (consent_number) DO NOTHING
    RETURNING id INTO v_consent_id;
    
    RAISE NOTICE 'Created consent: %', v_consent_id;
  END IF;
  
  -- 2. Create test immunizations for the patient
  INSERT INTO immunizations (
    immunization_number,
    patient_id,
    vaccine_code,
    vaccine_name,
    administration_date,
    dose_number,
    route,
    site,
    administered_by,
    created_at
  ) VALUES 
  (
    'IMM-2025-TEST001',
    v_patient_id,
    'COVID19',
    'COVID-19 Vaccine (Pfizer)',
    '2024-01-15',
    1,
    'Intramuscular',
    'Left deltoid',
    v_doctor_id,
    NOW()
  ),
  (
    'IMM-2025-TEST002',
    v_patient_id,
    'FLU',
    'Influenza Vaccine',
    '2024-09-01',
    1,
    'Intramuscular',
    'Right deltoid',
    v_doctor_id,
    NOW()
  )
  ON CONFLICT (immunization_number) DO NOTHING;
  
  RAISE NOTICE 'Created immunizations';
  
  -- 3. Enroll patient in a clinical pathway
  SELECT id INTO v_pathway_id FROM clinical_pathways WHERE is_active = true LIMIT 1;
  
  IF v_pathway_id IS NOT NULL THEN
    INSERT INTO pathway_enrollments (
      pathway_id,
      patient_id,
      admission_id,
      enrollment_date,
      expected_completion_date,
      status,
      adherence_score,
      current_step,
      enrolled_by,
      created_at
    ) VALUES (
      v_pathway_id,
      v_patient_id,
      NULL,
      NOW() - INTERVAL '5 days',
      NOW() + INTERVAL '25 days',
      'active',
      85.5,
      'Step 2: Initial Assessment',
      v_doctor_id,
      NOW()
    )
    ON CONFLICT DO NOTHING
    RETURNING id INTO v_enrollment_id;
    
    RAISE NOTICE 'Created pathway enrollment: %', v_enrollment_id;
    
    -- Create some adherence records
    IF v_enrollment_id IS NOT NULL THEN
      INSERT INTO pathway_adherence (
        enrollment_id,
        step_id,
        is_completed,
        completed_date,
        completed_by,
        notes
      )
      SELECT 
        v_enrollment_id,
        ps.id,
        true,
        NOW() - INTERVAL '3 days',
        v_doctor_id,
        'Step completed successfully'
      FROM pathway_steps ps
      WHERE ps.pathway_id = v_pathway_id
      AND ps.step_number = 1
      LIMIT 1
      ON CONFLICT DO NOTHING;
    END IF;
  END IF;
  
  -- 4. Create a test ED visit
  INSERT INTO ed_visits (
    ed_visit_number,
    patient_id,
    arrival_date,
    arrival_time,
    arrival_mode,
    chief_complaint,
    chief_complaint_snomed,
    ed_status,
    discharge_time,
    total_ed_time_minutes,
    created_at
  ) VALUES (
    'ED-2025-TEST001',
    v_patient_id,
    '2024-11-15',
    '2024-11-15 10:30:00',
    'walk-in',
    'Chest pain',
    '29857009',
    'discharged',
    '2024-11-15 14:30:00',
    240,
    NOW()
  )
  ON CONFLICT (ed_visit_number) DO NOTHING;
  
  RAISE NOTICE 'Created ED visit';
  
  -- 5. Create triage assessment
  INSERT INTO ed_triage_assessments (
    visit_id,
    triage_level,
    triage_assessment,
    chief_complaint_details,
    triaged_by,
    triaged_at
  )
  SELECT 
    ev.id,
    3,
    'Patient stable, moderate pain',
    'Sharp chest pain, no radiation',
    v_doctor_id,
    '2024-11-15 10:45:00'
  FROM ed_visits ev
  WHERE ev.ed_visit_number = 'ED-2025-TEST001'
  ON CONFLICT DO NOTHING;
  
  -- 6. Create ED disposition
  INSERT INTO ed_dispositions (
    visit_id,
    disposition,
    discharge_diagnosis,
    discharge_diagnosis_icd10,
    discharge_instructions,
    follow_up_instructions,
    disposition_time,
    disposition_by
  )
  SELECT 
    ev.id,
    'home',
    'Gastroesophageal reflux',
    'K21.9',
    'Take prescribed medication, avoid spicy foods, follow up in 1 week',
    'Schedule appointment with primary care physician within 7 days',
    '2024-11-15 14:30:00',
    v_doctor_id
  FROM ed_visits ev
  WHERE ev.ed_visit_number = 'ED-2025-TEST001'
  ON CONFLICT DO NOTHING;
  
  RAISE NOTICE 'Test data creation complete!';
  
END $$;

-- Verify data was created
SELECT 'Consents' as type, COUNT(*)::text as count FROM patient_consents WHERE patient_id = '5c643267-233f-4c95-b978-835ec9b59cea'
UNION ALL
SELECT 'Immunizations', COUNT(*)::text FROM immunizations WHERE patient_id = '5c643267-233f-4c95-b978-835ec9b59cea'
UNION ALL
SELECT 'Pathway Enrollments', COUNT(*)::text FROM pathway_enrollments WHERE patient_id = '5c643267-233f-4c95-b978-835ec9b59cea'
UNION ALL
SELECT 'ED Visits', COUNT(*)::text FROM ed_visits WHERE patient_id = '5c643267-233f-4c95-b978-835ec9b59cea';

