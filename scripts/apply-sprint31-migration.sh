#!/bin/bash
# Apply Sprint 31 (Charge Capture) migration

echo "📝 Applying Sprint 31: Charge Capture & Revenue Cycle"
cat /Users/devoop/Dev/personal/medicore/database/migrations/015-charge-capture-revenue.sql | docker exec -i medicore-postgres-master psql -U medicore -d tenant_bulawayo_general

echo ""
echo "✅ Verifying tables created:"
docker exec medicore-postgres-master psql -U medicore -d tenant_bulawayo_general -c "SELECT table_name FROM information_schema.tables WHERE table_name IN ('charge_master', 'patient_charges', 'drg_assignments', 'missed_charges', 'charge_capture_rules') ORDER BY table_name;"

echo ""
echo "🎉 Sprint 31 database provisioning complete!"




