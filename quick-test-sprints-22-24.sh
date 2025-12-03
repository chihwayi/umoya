#!/bin/bash

echo "🧪 QUICK TEST: SPRINTS 22 & 24"
echo "=============================="
echo ""

# Sprint 22: Immunization
echo "=== SPRINT 22: IMMUNIZATION SCHEDULES ==="
echo ""
echo "Total schedules:"
docker exec medicore-postgres-master psql -U medicore -d tenant_bulawayo_general -c "
SELECT COUNT(*) as total_schedules FROM immunization_schedules;
"

echo ""
echo "Sample schedules (first 5):"
docker exec medicore-postgres-master psql -U medicore -d tenant_bulawayo_general -c "
SELECT schedule_name, vaccine_name, dose_number, recommended_age_months 
FROM immunization_schedules 
ORDER BY recommended_age_months, dose_number 
LIMIT 5;
"

echo ""
echo "Vaccine breakdown:"
docker exec medicore-postgres-master psql -U medicore -d tenant_bulawayo_general -c "
SELECT vaccine_name, COUNT(*) as doses 
FROM immunization_schedules 
GROUP BY vaccine_name 
ORDER BY vaccine_name;
"

# Sprint 24: ED
echo ""
echo "=== SPRINT 24: EMERGENCY DEPARTMENT ==="
echo ""
echo "ED visits table column count:"
docker exec medicore-postgres-master psql -U medicore -d tenant_bulawayo_general -c "
SELECT COUNT(*) as column_count
FROM information_schema.columns 
WHERE table_name = 'ed_visits';
"

echo ""
echo "Current ED visits:"
docker exec medicore-postgres-master psql -U medicore -d tenant_bulawayo_general -c "
SELECT COUNT(*) as visit_count FROM ed_visits;
"

echo ""
echo "Key ED columns:"
docker exec medicore-postgres-master psql -U medicore -d tenant_bulawayo_general -c "
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'ed_visits' 
AND column_name IN ('esi_level', 'chief_complaint', 'status', 'arrival_time', 'triage_time')
ORDER BY column_name;
"

echo ""
echo "✅ Database verification complete!"
echo ""
echo "Next: Test APIs at http://localhost:3013/api/docs"
echo "  - GET /api/immunizations/schedules"
echo "  - GET /api/ed/tracking-board"
echo "  - GET /api/ed/metrics"
