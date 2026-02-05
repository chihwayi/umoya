-- Simple Test Data Creation for Tier 1 Patient Portal
-- Patient: Thandeka Mkhize (ID: 5c643267-233f-4c95-b978-835ec9b59cea)

\set patient_id '5c643267-233f-4c95-b978-835ec9b59cea'
\set doctor_id 'f1777fa7-cf07-4c87-9c5e-4da405129512'

-- 1. Create consent (if template exists)
INSERT INTO patient_consents (
  consent_number,
  patient_id,
  template_id,
  template_version,
  consent_type,
  title,
  content,
  status
)
SELECT 
  'CNS-2025-' || LPAD((SELECT COUNT(*) + 1 FROM patient_consents)::text, 6, '0'),
  :'patient_id'::uuid,
  ct.id,
  '1.0',
  ct.consent_type,
  ct.title,
  ct.content,
  'pending'
FROM consent_templates ct
WHERE ct.is_active = true
LIMIT 1
ON CONFLICT (consent_number) DO NOTHING;

-- 2. Create immunizations
INSERT INTO immunizations (
  immunization_number,
  patient_id,
  vaccine_code,
  vaccine_name,
  administration_date,
  dose_number,
  route,
  site,
  administered_by
) VALUES 
(
  'IMM-2025-' || LPAD((SELECT COUNT(*) + 1 FROM immunizations)::text, 6, '0'),
  :'patient_id'::uuid,
  'COVID19',
  'COVID-19 Vaccine',
  '2024-01-15',
  1,
  'Intramuscular',
  'Left deltoid',
  :'doctor_id'::uuid
),
(
  'IMM-2025-' || LPAD((SELECT COUNT(*) + 2 FROM immunizations)::text, 6, '0'),
  :'patient_id'::uuid,
  'FLU',
  'Influenza Vaccine',
  '2024-09-01',
  1,
  'Intramuscular',
  'Right deltoid',
  :'doctor_id'::uuid
)
ON CONFLICT (immunization_number) DO NOTHING;

-- 3. Enroll in pathway
INSERT INTO pathway_enrollments (
  enrollment_number,
  patient_id,
  pathway_id,
  enrolled_date,
  enrolled_by,
  start_date,
  expected_end_date,
  enrollment_status,
  adherence_score,
  current_step,
  completion_percentage
)
SELECT 
  'PE-2025-' || LPAD((SELECT COUNT(*) + 1 FROM pathway_enrollments)::text, 6, '0'),
  :'patient_id'::uuid,
  cp.id,
  NOW() - INTERVAL '5 days',
  :'doctor_id'::uuid,
  NOW() - INTERVAL '5 days',
  NOW() + INTERVAL '25 days',
  'active',
  85.50,
  2,
  40.00
FROM clinical_pathways cp
WHERE cp.is_active = true
LIMIT 1
ON CONFLICT (enrollment_number) DO NOTHING;

-- 4. Create ED visit
INSERT INTO ed_visits (
  ed_visit_number,
  patient_id,
  arrival_date,
  arrival_time,
  arrival_mode,
  chief_complaint,
  ed_status,
  discharge_time,
  total_ed_time_minutes
) VALUES (
  'ED-2025-' || LPAD((SELECT COUNT(*) + 1 FROM ed_visits)::text, 6, '0'),
  :'patient_id'::uuid,
  '2024-11-15',
  '2024-11-15 10:30:00',
  'walk-in',
  'Chest pain',
  'discharged',
  '2024-11-15 14:30:00',
  240
)
ON CONFLICT (ed_visit_number) DO NOTHING;

-- Verify created data
SELECT 'Consents' as type, COUNT(*)::text as count FROM patient_consents WHERE patient_id = :'patient_id'::uuid
UNION ALL
SELECT 'Immunizations', COUNT(*)::text FROM immunizations WHERE patient_id = :'patient_id'::uuid
UNION ALL
SELECT 'Pathway Enrollments', COUNT(*)::text FROM pathway_enrollments WHERE patient_id = :'patient_id'::uuid
UNION ALL
SELECT 'ED Visits', COUNT(*)::text FROM ed_visits WHERE patient_id = :'patient_id'::uuid;

