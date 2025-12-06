#!/bin/bash
echo "📝 Sprint 38: Sepsis Management"
cat /Users/devoop/Dev/personal/medicore/database/migrations/022-sepsis-management.sql | docker exec -i medicore-postgres-master psql -U medicore -d tenant_bulawayo_general
echo ""
docker exec medicore-postgres-master psql -U medicore -d tenant_bulawayo_general -c "SELECT table_name FROM information_schema.tables WHERE table_name IN ('sepsis_screenings', 'sepsis_bundles') ORDER BY table_name;"
echo "✅ Sprint 38 complete!"




