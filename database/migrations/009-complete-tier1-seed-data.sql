-- ============================================================================
-- Migration 009: Complete Tier 1 Seed Data
-- ============================================================================
-- Adds missing pathway steps, beds, and consent templates
-- Date: December 3, 2025
-- ============================================================================

-- ============================================================================
-- PART 1: PATHWAY STEPS (CRITICAL - Sprint 25)
-- ============================================================================

-- Get pathway IDs for reference
DO $$
DECLARE
  sepsis_pathway_id uuid;
  stroke_pathway_id uuid;
  pneumonia_pathway_id uuid;
  dka_pathway_id uuid;
  chf_pathway_id uuid;
BEGIN
  -- Get pathway IDs
  SELECT id INTO sepsis_pathway_id FROM clinical_pathways WHERE pathway_code = 'SEPSIS_V1';
  SELECT id INTO stroke_pathway_id FROM clinical_pathways WHERE pathway_code = 'STROKE_ACUTE_V1';
  SELECT id INTO pneumonia_pathway_id FROM clinical_pathways WHERE pathway_code = 'PNEUMONIA_CAP_V1';
  SELECT id INTO dka_pathway_id FROM clinical_pathways WHERE pathway_code = 'DKA_MGMT_V1';
  SELECT id INTO chf_pathway_id FROM clinical_pathways WHERE pathway_code = 'CHF_MGMT_V1';

  -- Sepsis Protocol Steps
  IF sepsis_pathway_id IS NOT NULL THEN
    INSERT INTO pathway_steps (pathway_id, step_number, step_name, description, instructions, timing_from_start_hours, is_required, step_type) VALUES
    (sepsis_pathway_id, 1, 'Initial Assessment', 'Rapid assessment and recognition of sepsis', 'Assess patient for sepsis criteria (qSOFA ≥2 or SIRS). Document suspected source.', 0, true, 'assessment'),
    (sepsis_pathway_id, 2, 'Obtain Blood Cultures', 'Draw blood cultures before antibiotics', 'Obtain 2 sets of blood cultures from separate venipuncture sites. Label with time and site.', 1, true, 'diagnostic_test'),
    (sepsis_pathway_id, 3, 'Lactate Measurement', 'Measure serum lactate level', 'Order stat serum lactate. Repeat if initial lactate ≥2 mmol/L.', 1, true, 'diagnostic_test'),
    (sepsis_pathway_id, 4, 'Broad-Spectrum Antibiotics', 'Administer antibiotics within 1 hour of recognition', 'Administer empiric broad-spectrum antibiotics per protocol. Document time and agents used.', 1, true, 'medication'),
    (sepsis_pathway_id, 5, 'Fluid Resuscitation', 'Administer 30 mL/kg crystalloid for hypotension or lactate ≥4', 'Infuse crystalloid (NS or LR) rapidly. Reassess frequently. Target MAP ≥65 mmHg.', 3, true, 'procedure'),
    (sepsis_pathway_id, 6, 'Vasopressor Therapy', 'Initiate if MAP <65 mmHg despite adequate fluid resuscitation', 'Start norepinephrine infusion. Titrate to MAP ≥65 mmHg. Consider central line.', 6, false, 'medication'),
    (sepsis_pathway_id, 7, 'Source Control', 'Identify and address infection source', 'Identify anatomic source of infection. Implement source control measures (drainage, debridement, device removal).', 12, true, 'procedure'),
    (sepsis_pathway_id, 8, '6-Hour Reassessment', 'Reassess vitals, lactate, and clinical status', 'Remeasure lactate. Assess volume status. Evaluate response to therapy. Adjust treatment.', 6, true, 'assessment');

    RAISE NOTICE '✅ Added 8 steps to Sepsis Protocol';
  END IF;

  -- Stroke Protocol Steps
  IF stroke_pathway_id IS NOT NULL THEN
    INSERT INTO pathway_steps (pathway_id, step_number, step_name, description, instructions, timing_from_start_hours, is_required, step_type) VALUES
    (stroke_pathway_id, 1, 'Initial Assessment', 'Rapid stroke assessment using FAST criteria', 'Perform FAST exam (Face, Arms, Speech, Time). Verify last known well time. Document NIHSS score.', 0, true, 'assessment'),
    (stroke_pathway_id, 2, 'Activate Stroke Code', 'Alert stroke team immediately', 'Activate stroke code overhead. Notify stroke neurologist, radiology, and lab. Document activation time.', 0, true, 'consultation'),
    (stroke_pathway_id, 3, 'CT/MRI Imaging', 'Emergent brain imaging', 'Complete non-contrast CT head within 25 minutes of arrival. Rule out hemorrhage. Alert radiologist.', 0, true, 'diagnostic_test'),
    (stroke_pathway_id, 4, 'tPA Eligibility Check', 'Assess thrombolytic eligibility', 'Review inclusion/exclusion criteria. Check time window (<4.5 hours). Assess contraindications. Discuss with family.', 1, true, 'assessment'),
    (stroke_pathway_id, 5, 'Administer tPA', 'Thrombolytic therapy if eligible', 'Administer IV alteplase 0.9 mg/kg (max 90mg): 10% bolus, 90% over 60 minutes. Monitor continuously.', 1, false, 'medication'),
    (stroke_pathway_id, 6, 'Neuro Monitoring', 'Intensive neurological monitoring', 'Neuro checks Q15min during and 2h after tPA, then Q30min x6h, then Q1h. Monitor for hemorrhage.', 24, true, 'monitoring'),
    (stroke_pathway_id, 7, 'Stroke Unit Admission', 'Transfer to specialized stroke unit', 'Arrange stroke unit bed. Continue monitoring. Initiate stroke secondary prevention.', 4, true, 'consultation');

    RAISE NOTICE '✅ Added 7 steps to Stroke Protocol';
  END IF;

  -- Pneumonia Protocol Steps
  IF pneumonia_pathway_id IS NOT NULL THEN
    INSERT INTO pathway_steps (pathway_id, step_number, step_name, description, instructions, timing_from_start_hours, is_required, step_type) VALUES
    (pneumonia_pathway_id, 1, 'Severity Assessment', 'Calculate CURB-65 or PSI score', 'Assess: Confusion, Urea >7 mmol/L, Respiratory rate ≥30, BP <90/60, age ≥65. Score determines disposition.', 1, true, 'assessment'),
    (pneumonia_pathway_id, 2, 'Blood Cultures', 'Obtain prior to antibiotics', 'Draw 2 sets of blood cultures from separate sites before antibiotics. Critical for severe CAP.', 1, true, 'diagnostic_test'),
    (pneumonia_pathway_id, 3, 'Chest X-ray', 'Radiographic confirmation', 'Order PA and lateral chest X-ray. Look for infiltrate, effusion, cavitation.', 2, true, 'diagnostic_test'),
    (pneumonia_pathway_id, 4, 'Empiric Antibiotics', 'Initiate therapy within 4 hours', 'Administer empiric antibiotics per guidelines. Typical: β-lactam + macrolide or respiratory fluoroquinolone.', 4, true, 'medication'),
    (pneumonia_pathway_id, 5, 'Oxygen Therapy', 'Maintain adequate saturation', 'Provide supplemental O2 to maintain SpO2 >90%. Escalate to BiPAP/ventilation if needed.', 4, true, 'procedure'),
    (pneumonia_pathway_id, 6, 'Clinical Response Check', 'Assess response to therapy', 'At 48-72h: check vitals, symptoms, inflammatory markers. Consider imaging if not improving.', 48, true, 'assessment');

    RAISE NOTICE '✅ Added 6 steps to Pneumonia Protocol';
  END IF;

  -- DKA Protocol Steps  
  IF dka_pathway_id IS NOT NULL THEN
    INSERT INTO pathway_steps (pathway_id, step_number, step_name, description, instructions, timing_from_start_hours, is_required, step_type) VALUES
    (dka_pathway_id, 1, 'Initial Laboratory Panel', 'Comprehensive metabolic assessment', 'Order: glucose, electrolytes (Na, K, Cl, HCO3), BUN, Cr, ABG, serum/urine ketones. Add phosphate, magnesium.', 0, true, 'diagnostic_test'),
    (dka_pathway_id, 2, 'IV Fluid Resuscitation', 'Aggressive volume repletion', 'Start NS 1L bolus over 1 hour. Then 250-500 mL/hr depending on dehydration severity. Monitor for overload.', 1, true, 'procedure'),
    (dka_pathway_id, 3, 'Insulin Therapy', 'Continuous IV insulin infusion', 'Begin regular insulin 0.1 units/kg/hr after initial bolus. Do NOT start if K+ <3.3 mEq/L.', 2, true, 'medication'),
    (dka_pathway_id, 4, 'Potassium Replacement', 'Maintain normokalemia', 'Add K+ 20-30 mEq/L to IV fluids if K+ <5.3 mEq/L. Hold insulin if K+ <3.3. Monitor closely.', 4, true, 'medication'),
    (dka_pathway_id, 5, 'Frequent Monitoring', 'Intensive glucose and electrolyte monitoring', 'Glucose Q1h. Electrolytes Q2-4h. Adjust insulin and fluids based on response.', 12, true, 'monitoring'),
    (dka_pathway_id, 6, 'Resolution Assessment', 'Verify DKA resolution', 'Confirm: glucose <200 mg/dL, pH >7.3, HCO3 >18 mEq/L. Transition to SC insulin when resolved.', 24, true, 'assessment');

    RAISE NOTICE '✅ Added 6 steps to DKA Protocol';
  END IF;

  -- CHF Protocol Steps
  IF chf_pathway_id IS NOT NULL THEN
    INSERT INTO pathway_steps (pathway_id, step_number, step_name, description, instructions, timing_from_start_hours, is_required, step_type) VALUES
    (chf_pathway_id, 1, 'Volume Status Assessment', 'Assess degree of volume overload', 'Perform physical exam: JVP, peripheral edema, pulmonary rales. Check I/Os. Review recent weights.', 1, true, 'assessment'),
    (chf_pathway_id, 2, 'Diuretic Therapy', 'Initiate or intensify loop diuretic', 'Administer IV furosemide (typically 2x home dose if on oral). Monitor UOP. Target negative fluid balance.', 2, true, 'medication'),
    (chf_pathway_id, 3, 'Daily Weights', 'Establish daily weight monitoring', 'Weigh patient same time daily (before breakfast). Goal: 1-2 lb/day weight loss. Document trends.', 24, true, 'monitoring'),
    (chf_pathway_id, 4, 'GDMT Optimization', 'Review guideline-directed medical therapy', 'Ensure on ACE-I/ARB, β-blocker, aldosterone antagonist if indicated. Uptitrate to target doses.', 48, true, 'medication'),
    (chf_pathway_id, 5, 'Discharge Planning', 'Prepare for safe transition', 'Arrange cardiology follow-up within 7-14 days. Provide patient education. Medication reconciliation.', 72, true, 'education');

    RAISE NOTICE '✅ Added 5 steps to CHF Protocol';
  END IF;

  RAISE NOTICE '🎉 Total pathway steps added: 32';
END $$;

-- ============================================================================
-- PART 2: ADDITIONAL BEDS (Sprint 23)
-- ============================================================================

-- Add Surgical Ward (15 beds) - Currently missing entirely
INSERT INTO beds (ward_name, bed_number, room_number, bed_type, status, floor, has_equipment, features) VALUES
('Surgical Ward', 'SURG-01', '201', 'general', 'available', '2', '["oxygen", "suction"]'::jsonb, '[]'::jsonb),
('Surgical Ward', 'SURG-02', '202', 'general', 'available', '2', '["oxygen", "suction"]'::jsonb, '[]'::jsonb),
('Surgical Ward', 'SURG-03', '203', 'general', 'available', '2', '["oxygen", "suction"]'::jsonb, '[]'::jsonb),
('Surgical Ward', 'SURG-04', '204', 'general', 'available', '2', '["oxygen", "suction"]'::jsonb, '[]'::jsonb),
('Surgical Ward', 'SURG-05', '205', 'general', 'available', '2', '["oxygen", "suction"]'::jsonb, '[]'::jsonb),
('Surgical Ward', 'SURG-06', '206', 'general', 'available', '2', '["oxygen", "suction"]'::jsonb, '[]'::jsonb),
('Surgical Ward', 'SURG-07', '207', 'general', 'available', '2', '["oxygen", "suction"]'::jsonb, '[]'::jsonb),
('Surgical Ward', 'SURG-08', '208', 'general', 'available', '2', '["oxygen", "suction"]'::jsonb, '[]'::jsonb),
('Surgical Ward', 'SURG-09', '209', 'general', 'available', '2', '["oxygen", "suction"]'::jsonb, '[]'::jsonb),
('Surgical Ward', 'SURG-10', '210', 'general', 'available', '2', '["oxygen", "suction"]'::jsonb, '[]'::jsonb),
('Surgical Ward', 'SURG-11', '211', 'general', 'available', '2', '["oxygen", "suction"]'::jsonb, '[]'::jsonb),
('Surgical Ward', 'SURG-12', '212', 'general', 'available', '2', '["oxygen", "suction"]'::jsonb, '[]'::jsonb),
('Surgical Ward', 'SURG-13', '213', 'general', 'available', '2', '["oxygen", "suction"]'::jsonb, '[]'::jsonb),
('Surgical Ward', 'SURG-14', '214', 'general', 'available', '2', '["oxygen", "suction"]'::jsonb, '[]'::jsonb),
('Surgical Ward', 'SURG-15', '215', 'general', 'available', '2', '["oxygen", "suction"]'::jsonb, '[]'::jsonb);

-- Add more Medical Ward beds (9 more)
INSERT INTO beds (ward_name, bed_number, room_number, bed_type, status, floor, has_equipment, features) VALUES
('Medical Ward', 'MED-07', '107', 'general', 'available', '1', '["oxygen"]'::jsonb, '[]'::jsonb),
('Medical Ward', 'MED-08', '108', 'general', 'available', '1', '["oxygen"]'::jsonb, '[]'::jsonb),
('Medical Ward', 'MED-09', '109', 'general', 'available', '1', '["oxygen"]'::jsonb, '[]'::jsonb),
('Medical Ward', 'MED-10', '110', 'general', 'available', '1', '["oxygen"]'::jsonb, '[]'::jsonb),
('Medical Ward', 'MED-11', '111', 'general', 'available', '1', '["oxygen"]'::jsonb, '[]'::jsonb),
('Medical Ward', 'MED-12', '112', 'general', 'available', '1', '["oxygen"]'::jsonb, '[]'::jsonb),
('Medical Ward', 'MED-13', '113', 'general', 'available', '1', '["oxygen"]'::jsonb, '[]'::jsonb),
('Medical Ward', 'MED-14', '114', 'general', 'available', '1', '["oxygen"]'::jsonb, '[]'::jsonb),
('Medical Ward', 'MED-15', '115', 'general', 'available', '1', '["oxygen"]'::jsonb, '[]'::jsonb);

-- Add more ICU beds (6 more)
INSERT INTO beds (ward_name, bed_number, room_number, bed_type, status, floor, has_equipment, features) VALUES
('Intensive Care Unit', 'ICU-05', '305', 'icu', 'available', '3', '["oxygen", "suction", "monitor", "ventilator"]'::jsonb, '["isolation_capable"]'::jsonb),
('Intensive Care Unit', 'ICU-06', '306', 'icu', 'available', '3', '["oxygen", "suction", "monitor", "ventilator"]'::jsonb, '["isolation_capable"]'::jsonb),
('Intensive Care Unit', 'ICU-07', '307', 'icu', 'available', '3', '["oxygen", "suction", "monitor", "ventilator"]'::jsonb, '["isolation_capable"]'::jsonb),
('Intensive Care Unit', 'ICU-08', '308', 'icu', 'available', '3', '["oxygen", "suction", "monitor", "ventilator"]'::jsonb, '["isolation_capable"]'::jsonb),
('Intensive Care Unit', 'ICU-09', '309', 'icu', 'available', '3', '["oxygen", "suction", "monitor", "ventilator"]'::jsonb, '["isolation_capable"]'::jsonb),
('Intensive Care Unit', 'ICU-10', '310', 'icu', 'available', '3', '["oxygen", "suction", "monitor", "ventilator"]'::jsonb, '["isolation_capable"]'::jsonb);

-- ============================================================================
-- PART 3: ADDITIONAL CONSENT TEMPLATES (Sprint 21)
-- ============================================================================

INSERT INTO consent_templates (
  template_name,
  template_code,
  consent_type,
  version,
  title,
  content,
  signature_requirements,
  effective_date,
  is_active,
  is_default
) VALUES
-- Surgical Procedure Consent
(
  'Surgical Procedure Consent',
  'SURGICAL_CONSENT_V1',
  'surgery',
  '1.0',
  'Informed Consent for Surgical Procedure',
  'I hereby authorize the medical staff to perform the surgical procedure(s) as discussed with my physician. I understand the nature of the procedure, including its risks, benefits, and alternatives. I have been given the opportunity to ask questions and all my questions have been answered to my satisfaction.',
  '{"patient": true, "witness": true, "guardian": false, "provider": true}'::jsonb,
  '2025-12-03',
  true,
  true
),
-- Anesthesia Consent
(
  'Anesthesia Consent',
  'ANESTHESIA_CONSENT_V1',
  'anesthesia',
  '1.0',
  'Consent for Anesthesia Services',
  'I consent to the administration of anesthesia as deemed appropriate by my anesthesiologist. I understand that anesthesia involves risks, including but not limited to allergic reactions, breathing difficulties, and cardiovascular complications. I have discussed these risks with my anesthesia provider.',
  '{"patient": true, "witness": false, "guardian": false, "provider": true}'::jsonb,
  '2025-12-03',
  true,
  true
),
-- Blood Transfusion Consent
(
  'Blood Transfusion Consent',
  'TRANSFUSION_CONSENT_V1',
  'blood_transfusion',
  '1.0',
  'Consent for Blood Product Administration',
  'I consent to receive blood products (packed red blood cells, platelets, plasma, or other blood components) as medically necessary. I understand the risks including transfusion reactions, infectious disease transmission, and immune complications. I have had the opportunity to discuss alternatives.',
  '{"patient": true, "witness": true, "guardian": false, "provider": true}'::jsonb,
  '2025-12-03',
  true,
  true
),
-- Research Participation Consent
(
  'Research Participation Consent',
  'RESEARCH_CONSENT_V1',
  'research',
  '1.0',
  'Informed Consent for Research Participation',
  'I voluntarily agree to participate in the research study as described. I understand that my participation is voluntary and I may withdraw at any time without penalty. I understand the potential risks and benefits of participation. I consent to the use of my medical information for research purposes.',
  '{"patient": true, "witness": true, "guardian": false, "provider": true}'::jsonb,
  '2025-12-03',
  true,
  false
);

-- ============================================================================
-- VERIFICATION
-- ============================================================================

-- Count pathway steps
DO $$
DECLARE
  step_count integer;
  bed_count integer;
  template_count integer;
BEGIN
  SELECT COUNT(*) INTO step_count FROM pathway_steps;
  SELECT COUNT(*) INTO bed_count FROM beds;
  SELECT COUNT(*) INTO template_count FROM consent_templates;
  
  RAISE NOTICE '';
  RAISE NOTICE '🎉 MIGRATION 009 COMPLETE';
  RAISE NOTICE '========================';
  RAISE NOTICE 'Pathway Steps: % (expected ~32)', step_count;
  RAISE NOTICE 'Total Beds: % (expected 40)', bed_count;
  RAISE NOTICE 'Consent Templates: % (expected 7)', template_count;
  RAISE NOTICE '';
  
  IF step_count < 30 THEN
    RAISE WARNING '⚠️  Pathway steps may be incomplete!';
  END IF;
  
  IF bed_count < 40 THEN
    RAISE WARNING '⚠️  Some beds may be missing!';
  END IF;
  
  IF template_count < 7 THEN
    RAISE WARNING '⚠️  Some consent templates may be missing!';
  END IF;
  
  RAISE NOTICE '✅ Migration completed successfully!';
END $$;

