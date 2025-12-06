#!/bin/bash
# Apply Sprint 33 (Case Management) migration

echo "📝 Applying Sprint 33: Case Management & Discharge Planning"
cat /Users/devoop/Dev/personal/medicore/database/migrations/017-case-management-discharge.sql | docker exec -i medicore-postgres-master psql -U medicore -d tenant_bulawayo_general

echo ""
echo "✅ Verifying tables created:"
docker exec medicore-postgres-master psql -U medicore -d tenant_bulawayo_general -c "SELECT table_name FROM information_schema.tables WHERE table_name IN ('case_management_assessments', 'discharge_plans', 'utilization_reviews') ORDER BY table_name;"

echo ""
echo "🎉 Sprint 33 database provisioning complete!"




