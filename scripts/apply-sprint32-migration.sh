#!/bin/bash
# Apply Sprint 32 (CDI) migration

echo "📝 Applying Sprint 32: Clinical Documentation Improvement (CDI)"
cat /Users/devoop/Dev/personal/medicore/database/migrations/016-clinical-documentation-improvement.sql | docker exec -i medicore-postgres-master psql -U medicore -d tenant_bulawayo_general

echo ""
echo "✅ Verifying tables created:"
docker exec medicore-postgres-master psql -U medicore -d tenant_bulawayo_general -c "SELECT table_name FROM information_schema.tables WHERE table_name IN ('cdi_reviews', 'physician_queries', 'documentation_completeness', 'cdi_opportunities') ORDER BY table_name;"

echo ""
echo "🎉 Sprint 32 database provisioning complete!"




