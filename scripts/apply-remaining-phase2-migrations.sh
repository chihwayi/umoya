#!/bin/bash
# Apply remaining Phase 2 migrations (Sprints 34-37)

echo "🚀 Applying Remaining Phase 2 Migrations (Sprints 34-37)"
echo "========================================================"

echo ""
echo "Sprint 34: Dietary Services"
cat /Users/devoop/Dev/personal/medicore/database/migrations/018-dietary-nutrition.sql | docker exec -i medicore-postgres-master psql -U medicore -d tenant_bulawayo_general

echo ""
echo "Sprint 35: Respiratory Therapy"
cat /Users/devoop/Dev/personal/medicore/database/migrations/019-respiratory-therapy.sql | docker exec -i medicore-postgres-master psql -U medicore -d tenant_bulawayo_general

echo ""
echo "Sprint 36: Physical Therapy"
cat /Users/devoop/Dev/personal/medicore/database/migrations/020-physical-therapy.sql | docker exec -i medicore-postgres-master psql -U medicore -d tenant_bulawayo_general

echo ""
echo "Sprint 37: Supply Chain"
cat /Users/devoop/Dev/personal/medicore/database/migrations/021-supply-chain.sql | docker exec -i medicore-postgres-master psql -U medicore -d tenant_bulawayo_general

echo ""
echo "========================================================"
echo "✅ ALL PHASE 2 MIGRATIONS COMPLETE!"
echo "========================================================"

echo ""
echo "📊 Verification:"
docker exec medicore-postgres-master psql -U medicore -d tenant_bulawayo_general -c "
SELECT 'Dietary' as module, COUNT(*) FROM information_schema.tables WHERE table_name IN ('diet_orders', 'nutritional_assessments')
UNION ALL SELECT 'Respiratory', COUNT(*) FROM information_schema.tables WHERE table_name = 'respiratory_orders'
UNION ALL SELECT 'PT/OT', COUNT(*) FROM information_schema.tables WHERE table_name = 'therapy_orders'
UNION ALL SELECT 'Supply Chain', COUNT(*) FROM information_schema.tables WHERE table_name = 'supply_inventory';
"

echo ""
echo "🎉 Phase 2: 100% COMPLETE!"




