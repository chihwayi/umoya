#!/bin/bash
echo "📝 Applying Sprint 34: Dietary & Nutrition Services"
cat /Users/devoop/Dev/personal/medicore/database/migrations/018-dietary-nutrition.sql | docker exec -i medicore-postgres-master psql -U medicore -d tenant_bulawayo_general
echo ""
echo "✅ Verifying tables:"
docker exec medicore-postgres-master psql -U medicore -d tenant_bulawayo_general -c "SELECT table_name FROM information_schema.tables WHERE table_name IN ('diet_orders', 'nutritional_assessments') ORDER BY table_name;"
echo ""
echo "🎉 Sprint 34 complete!"




