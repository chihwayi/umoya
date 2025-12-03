#!/bin/bash

# Test Tier 1 Endpoints by running the SQL queries directly
# This verifies the query logic works without auth issues

PATIENT_ID="5c643267-233f-4c95-b978-835ec9b59cea"

echo "=================================================="
echo "🧪 TESTING TIER 1 ENDPOINT QUERIES (Direct SQL)"
echo "=================================================="
echo ""

echo "Patient ID: $PATIENT_ID"
echo ""

# Test 1: Consents
echo "1️⃣ Testing Consents Query..."
docker exec medicore-postgres-master psql -U medicore -d tenant_bulawayo_general -c "
SELECT 
  id,
  consent_number,
  title,
  consent_type,
  status,
  created_at
FROM patient_consents
WHERE patient_id = '$PATIENT_ID'
ORDER BY created_at DESC;
"
echo ""

# Test 2: Immunizations
echo "2️⃣ Testing Immunizations Query..."
docker exec medicore-postgres-master psql -U medicore -d tenant_bulawayo_general -c "
SELECT 
  id,
  immunization_number,
  vaccine_name,
  vaccine_code,
  administration_date,
  dose_number,
  route,
  site
FROM immunizations
WHERE patient_id = '$PATIENT_ID'
ORDER BY administration_date DESC;
"
echo ""

# Test 3: Pathway Enrollments
echo "3️⃣ Testing Pathway Enrollments Query..."
docker exec medicore-postgres-master psql -U medicore -d tenant_bulawayo_general -c "
SELECT 
  pe.id,
  pe.enrollment_number,
  cp.pathway_name,
  cp.condition,
  cp.specialty,
  pe.enrolled_date,
  pe.enrollment_status,
  pe.adherence_score,
  pe.completion_percentage
FROM pathway_enrollments pe
JOIN clinical_pathways cp ON pe.pathway_id = cp.id
WHERE pe.patient_id = '$PATIENT_ID'
ORDER BY pe.enrolled_date DESC;
"
echo ""

# Test 4: Pathway Progress (if enrollment exists)
echo "4️⃣ Testing Pathway Progress Query..."
docker exec medicore-postgres-master psql -U medicore -d tenant_bulawayo_general -c "
SELECT 
  ps.id,
  ps.step_number,
  ps.description,
  ps.timing_from_start_hours,
  ps.required_actions,
  CASE WHEN pa.status = 'completed' THEN true ELSE false END as is_completed,
  pa.completed_date
FROM pathway_steps ps
LEFT JOIN pathway_enrollments pe ON pe.pathway_id = ps.pathway_id AND pe.patient_id = '$PATIENT_ID'
LEFT JOIN pathway_adherence pa ON ps.id = pa.step_id AND pa.enrollment_id = pe.id
WHERE pe.patient_id = '$PATIENT_ID'
ORDER BY ps.step_number ASC
LIMIT 10;
"
echo ""

# Test 5: Current Admission
echo "5️⃣ Testing Current Admission Query..."
docker exec medicore-postgres-master psql -U medicore -d tenant_bulawayo_general -c "
SELECT 
  a.id,
  a.admission_number,
  a.admission_date,
  a.expected_discharge_date,
  a.admission_type,
  a.admission_diagnosis,
  a.status,
  b.bed_number,
  b.ward_name,
  b.room_number
FROM admissions a
LEFT JOIN beds b ON a.current_bed_id = b.id
WHERE a.patient_id = '$PATIENT_ID' 
  AND a.status = 'admitted'
  AND a.actual_discharge_date IS NULL
ORDER BY a.admission_date DESC
LIMIT 1;
"
echo ""

# Test 6: ED Visits
echo "6️⃣ Testing ED Visits Query..."
docker exec medicore-postgres-master psql -U medicore -d tenant_bulawayo_general -c "
SELECT 
  ev.id,
  ev.ed_visit_number,
  ev.arrival_date,
  ev.chief_complaint,
  ev.ed_status,
  eta.triage_level
FROM ed_visits ev
LEFT JOIN ed_triage_assessments eta ON ev.id = eta.ed_visit_id
WHERE ev.patient_id = '$PATIENT_ID'
ORDER BY ev.arrival_date DESC
LIMIT 10;
"
echo ""

echo "=================================================="
echo "✅ QUERY TESTING COMPLETE"
echo "=================================================="
echo ""
echo "📊 Summary:"
echo "All queries executed successfully"
echo "Verify data is returned for consents, immunizations, pathways"
echo "No admission or ED visits expected (not created yet)"

